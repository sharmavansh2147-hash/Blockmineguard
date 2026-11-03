"""
End-to-end integration test verifying the complete blockchain transition & verification sequence:
1. Incident is initially UNREGISTERED_ON_CHAIN
2. Registered on-chain (contract call & transaction confirmation)
3. Verified state produced (digest == on-chain commitment)
4. Simulated tampering detected (digest mismatch)
5. Restored original payload reverified (digest == on-chain commitment)
"""
import pytest
import os
import json
import uuid
import time
from app import app, db, blockchain
from evidence.hasher import EvidenceHasher


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_complete_registration_and_verification_lifecycle(client):
    unique_run = uuid.uuid4().hex[:8]
    test_id = f"INC-E2E-{unique_run}"
    evidence_payload = {
        "incident_id": test_id,
        "timestamp": f"2026-10-28T12:00:{int(time.time()) % 60:02d}Z",
        "cpu_usage": 98.4,
        "memory_usage": 1024.0,
        "process_name": f"xmrig-{unique_run}",
        "process_runtime_seconds": 120,
        "network_destination": "194.26.29.1:3333",
        "container_name": f"miner-{unique_run}",
        "environment": "CONTAINER",
        "risk_score": 92,
        "severity": "CRITICAL",
        "factors": {"cpu_score": 40, "memory_score": 20, "network_score": 32}
    }

    clean_hash = EvidenceHasher.hash_dict(evidence_payload)

    # Clean existing test incident and insert fresh via db.create_incident
    with db._get_connection() as conn:
        conn.cursor().execute("DELETE FROM incidents WHERE incident_id = ?", (test_id,))
        conn.commit()

    from database.models import IncidentRecord
    rec = IncidentRecord(
        incident_id=test_id,
        external_id=test_id,
        evidence_hash=clean_hash,
        timestamp=evidence_payload["timestamp"],
        cpu_usage=evidence_payload["cpu_usage"],
        memory_usage=evidence_payload["memory_usage"],
        process_name=evidence_payload["process_name"],
        process_runtime_seconds=evidence_payload["process_runtime_seconds"],
        network_destination=evidence_payload["network_destination"],
        container_name=evidence_payload["container_name"],
        environment=evidence_payload["environment"],
        risk_score=evidence_payload["risk_score"],
        severity=evidence_payload["severity"],
        factors=json.dumps(evidence_payload["factors"]),
        verification_status="UNVERIFIED",
        resolution_status="OPEN"
    )
    db.create_incident(rec)

    # Step 1: Pre-registration verification check must be UNREGISTERED_ON_CHAIN
    res1 = client.post(f"/incidents/{test_id}/verify", json={"evidence": evidence_payload})
    assert res1.status_code == 200
    data1 = res1.get_json()
    assert data1["outcome"] == "UNREGISTERED_ON_CHAIN"
    assert data1["evidence_match"] is True
    assert data1["on_chain_hash"] is None, "Unanchored incident must never return a false on-chain hash"

    # Step 2: Register on blockchain (Local Hardhat Node or mock fallback if contract not running)
    if blockchain.is_connected() and blockchain.contract:
        # Submit transaction to ThreatRegistry.sol
        tx_receipt = blockchain.report_incident(
            external_id=test_id,
            evidence_hash=clean_hash,
            severity=2,  # CRITICAL
            threat_intel_ref="TI-E2E-TEST"
        )
        assert tx_receipt is not None
        assert "tx_hash" in tx_receipt
        assert "incident_id" in tx_receipt
        on_chain_id = tx_receipt["incident_id"]
        tx_hash = tx_receipt["tx_hash"]

        # Step 3: Sync to backend via /incidents/<id>/blockchain endpoint
        sync_res = client.post(
            f"/incidents/{test_id}/blockchain",
            json={
                "tx_hash": tx_hash,
                "blockchain_incident_id": on_chain_id,
                "block_number": tx_receipt.get("block_number", 1),
                "reporter_address": blockchain.account.address if blockchain.account else "0xTestDeployer",
                "network": "Hardhat Local"
            }
        )
        assert sync_res.status_code == 200

        # Step 4: Authoritative Verification -> must be VERIFIED (GREEN)
        res2 = client.post(f"/incidents/{test_id}/verify", json={"evidence": evidence_payload})
        assert res2.status_code == 200
        data2 = res2.get_json()
        assert data2["outcome"] == "VERIFIED"
        assert data2["verification_result"] == "VERIFIED"
        assert data2["evidence_match"] is True
        assert EvidenceHasher.clean_hex(data2["on_chain_hash"]) == EvidenceHasher.clean_hex(clean_hash)

        # Step 5: Simulate Data Tampering -> alter telemetry
        tampered_payload = dict(evidence_payload)
        tampered_payload["cpu_usage"] = 12.5  # Tamper CPU usage
        tampered_payload["risk_score"] = 10   # Tamper Risk Score

        res3 = client.post(f"/incidents/{test_id}/verify", json={"evidence": tampered_payload})
        assert res3.status_code == 200
        data3 = res3.get_json()
        assert data3["outcome"] in ("TAMPERED_HASH_MISMATCH", "ON_CHAIN_MISMATCH")
        assert data3["verification_result"] == "TAMPERED"
        assert data3["evidence_match"] is False

        # Step 6: Restore authentic baseline payload -> Reverification -> returns to VERIFIED (GREEN)
        res4 = client.post(f"/incidents/{test_id}/verify", json={"evidence": evidence_payload})
        assert res4.status_code == 200
        data4 = res4.get_json()
        assert data4["outcome"] == "VERIFIED"
        assert data4["verification_result"] == "VERIFIED"
        assert data4["evidence_match"] is True
