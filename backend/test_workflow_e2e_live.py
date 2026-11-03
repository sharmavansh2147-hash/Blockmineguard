"""
End-to-end live verification of Step 7 workflow against the actual running Hardhat node and Flask backend.
"""
import requests
import time
import json
from web3 import Web3
from eth_account import Account
from evidence.hasher import EvidenceHasher

RPC_URL = "http://127.0.0.1:8545"
BACKEND_URL = "http://127.0.0.1:5001"
DEPLOYER_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
DEPLOYER_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

def run_step_7_workflow():
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    assert w3.is_connected(), "Hardhat node is not reachable at 8545"

    # 1. Check health
    health_res = requests.get(f"{BACKEND_URL}/health").json()
    assert health_res["status"] == "ok"
    assert health_res["blockchain_connected"] is True
    contract_addr = health_res["contract_address"]
    print(f"[*] Verified Backend & Hardhat connected. Contract: {contract_addr}")

    # 2. Step A: Create and select a fresh incident
    unique_suffix = hex(int(time.time() * 1000))[2:]
    inc_id = f"INC-LIVE-{unique_suffix}"
    
    canonical_payload = {
        "incident_id": inc_id,
        "timestamp": "2026-10-28T12:00:00Z",
        "cpu_usage": 85.0,
        "memory_usage": 400.0,
        "process_name": "xmrig-cuda",
        "process_runtime_seconds": 180,
        "network_destination": "198.51.100.24:3333",
        "container_name": None,
        "environment": "HOST",
        "risk_score": 90,
        "severity": "CRITICAL",
        "factors": ["HIGH_CPU", "STRATUM_DETECTED"]
    }

    original_digest = EvidenceHasher.hash_dict(canonical_payload)
    print(f"[*] Original Canonical SHA-256 Digest: 0x{original_digest}")

    from database import Database, IncidentRecord
    db = Database("blockmineguard.db")
    now_iso = "2026-10-28T12:00:00Z"
    inc_record = IncidentRecord(
        incident_id=inc_id,
        external_id=f"EXT-{unique_suffix}",
        evidence_hash=original_digest,
        timestamp=canonical_payload["timestamp"],
        cpu_usage=canonical_payload["cpu_usage"],
        memory_usage=canonical_payload["memory_usage"],
        process_name=canonical_payload["process_name"],
        process_runtime_seconds=canonical_payload["process_runtime_seconds"],
        network_destination=canonical_payload["network_destination"],
        risk_score=canonical_payload["risk_score"],
        severity=canonical_payload["severity"],
        factors=json.dumps(canonical_payload["factors"]),
        blockchain_tx_hash=None,
        blockchain_incident_id=None,
        verification_status="UNVERIFIED",
        resolution_status="OPEN",
        created_at=now_iso,
        updated_at=now_iso
    )
    db.create_incident(inc_record)
    print(f"[A] Incident {inc_id} created in database (unanchored baseline).")

    # Step B: Edit JSON and confirm that draft and digest change without touching original saved incident
    edited_draft = dict(canonical_payload, cpu_usage=86.0)
    edited_digest = EvidenceHasher.hash_dict(edited_draft)
    assert edited_digest != original_digest, "Digest must change when cpu_usage changes 85 -> 86"
    assert canonical_payload["cpu_usage"] == 85.0, "Original payload must remain unmodified"

    # Confirm original in database is untouched
    fetched = requests.get(f"{BACKEND_URL}/incidents/{inc_id}").json()
    assert fetched["incident"]["cpu_usage"] == 85.0, "Database incident was modified prematurely!"
    assert fetched["incident"]["evidence_hash"] == original_digest
    print(f"[B] JSON edited (CPU 85 -> 86): working digest 0x{edited_digest[:16]}... differs from original. Database untouched.")

    # Pre-registration verification check: must report UNREGISTERED_ON_CHAIN, not tampered
    pre_verify = requests.post(f"{BACKEND_URL}/incidents/{inc_id}/verify", json={"evidence": canonical_payload}).json()
    assert pre_verify["outcome"] == "UNREGISTERED_ON_CHAIN"
    assert pre_verify["verification_result"] == "UNREGISTERED_ON_CHAIN"
    assert pre_verify["on_chain_hash"] is None, "Local hash must not be copied to anchored hash when unregistered!"
    print(f"[*] Pre-registration check: correctly reports UNREGISTERED_ON_CHAIN with on_chain_hash=None.")

    # Step C & D: Register original version on Hardhat Local via actual transaction and wait for receipt
    with open("blockchain/artifacts/contracts/ThreatRegistry.sol/ThreatRegistry.json", "r") as f:
        artifact = json.load(f)
    contract = w3.eth.contract(address=contract_addr, abi=artifact["abi"])

    account = Account.from_key(DEPLOYER_PK)
    nonce = w3.eth.get_transaction_count(account.address)
    hash_bytes32 = Web3.to_bytes(hexstr="0x" + original_digest)

    tx = contract.functions.reportIncident(
        inc_id,
        hash_bytes32,
        2, # HIGH/CRITICAL
        "TI-LIVE-REF"
    ).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": 400000,
        "gasPrice": w3.eth.gas_price,
        "chainId": 31337
    })

    signed_tx = w3.eth.account.sign_transaction(tx, DEPLOYER_PK)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    assert receipt.status == 1, "Registration transaction reverted!"
    
    # Extract on-chain incident ID
    on_chain_inc_id = None
    for log in receipt.logs:
        try:
            parsed = contract.events.IncidentReported().process_log(log)
            on_chain_inc_id = parsed.args.incidentId
            break
        except Exception:
            continue
    assert on_chain_inc_id is not None, "Could not find IncidentReported event log"
    print(f"[C & D] Registered on-chain: tx {receipt.transactionHash.hex()}, Block #{receipt.blockNumber}, Index #{on_chain_inc_id}")

    # Read back from contract to verify stored commitment
    on_chain_record = contract.functions.getIncident(on_chain_inc_id).call()
    retrieved_hash = on_chain_record[2].hex().replace("0x", "")
    assert retrieved_hash.lower() == original_digest.lower(), "Retrieved digest does not match submitted digest!"
    print(f"[*] Read-back verification confirmed: contract hash 0x{retrieved_hash[:16]}... matches submitted digest.")

    # Persist registration details to application database
    sync_res = requests.post(f"{BACKEND_URL}/incidents/{inc_id}/blockchain", json={
        "tx_hash": receipt.transactionHash.hex(),
        "blockchain_incident_id": on_chain_inc_id,
        "block_number": receipt.blockNumber,
        "gas_used": receipt.gasUsed,
        "contract_address": contract_addr,
        "chain_id": 31337,
        "reporter_address": account.address
    })
    assert sync_res.status_code == 200, f"Failed to sync blockchain info: {sync_res.text}"

    # Step E: Verify original payload and confirm green state (VERIFIED)
    verify_res = requests.post(f"{BACKEND_URL}/incidents/{inc_id}/verify", json={"evidence": canonical_payload}).json()
    assert verify_res["outcome"] == "VERIFIED", f"Expected VERIFIED, got {verify_res['outcome']}"
    assert verify_res["verification_result"] == "VERIFIED"
    assert verify_res["evidence_match"] is True
    assert verify_res["on_chain_hash"] == original_digest
    print(f"[E] Verified original payload on blockchain: GREEN verified state confirmed!")

    # Step F & G: Change one field using Simulate Tampering
    tampered_copy = dict(canonical_payload, cpu_usage=14.5, risk_score=15)
    tampered_digest = EvidenceHasher.hash_dict(tampered_copy)
    assert tampered_digest != original_digest

    tamper_verify = requests.post(f"{BACKEND_URL}/incidents/{inc_id}/verify", json={"evidence": tampered_copy}).json()
    assert tamper_verify["outcome"] == "TAMPERED_HASH_MISMATCH"
    assert tamper_verify["verification_result"] == "TAMPERED"
    assert tamper_verify["evidence_match"] is False
    assert tamper_verify["computed_hash"] == tampered_digest
    assert tamper_verify["on_chain_hash"] == original_digest, "Anchored hash must reflect immutable on-chain record!"
    print(f"[F & G] Simulate Tampering executed: RED state confirmed! Working: 0x{tampered_digest[:16]}... != Anchored: 0x{original_digest[:16]}...")

    # Step H & I: Reset Clean (Restore baseline and reverify)
    restored_copy = dict(canonical_payload)
    restored_digest = EvidenceHasher.hash_dict(restored_copy)
    assert restored_digest == original_digest

    reset_verify = requests.post(f"{BACKEND_URL}/incidents/{inc_id}/verify", json={"evidence": restored_copy}).json()
    assert reset_verify["outcome"] == "VERIFIED"
    assert reset_verify["verification_result"] == "VERIFIED"
    assert reset_verify["evidence_match"] is True
    assert reset_verify["on_chain_hash"] == original_digest
    print(f"[H & I] Reset Clean executed: Green VERIFIED state restored after actual smart contract comparison!")

    # Step J: Reload from real data sources and confirm recovery
    reloaded_detail = requests.get(f"{BACKEND_URL}/incidents/{inc_id}").json()
    assert reloaded_detail["incident"]["blockchain_incident_id"] == on_chain_inc_id
    assert reloaded_detail["incident"]["verification_status"] == "VERIFIED"
    
    # Check verification history
    history_res = requests.get(f"{BACKEND_URL}/incidents/{inc_id}/verification-history").json()
    outcomes = [h["verification_outcome"] for h in history_res["history"]]
    print(f"[J] Reloaded page data sources. Historical events: {outcomes}")
    assert "VERIFIED" in outcomes
    assert "TAMPERED_HASH_MISMATCH" in outcomes

    print("\n========================================================")
    print(">>> COMPLETE STEP 7 SEQUENCE A-J PASSED PERFECTLY! <<<")
    print("========================================================")

if __name__ == "__main__":
    run_step_7_workflow()
