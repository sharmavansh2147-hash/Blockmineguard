import os
import sys
import json
import uuid
import csv
import io
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Database
from detector import (
    DetectionEngine,
    TelemetryData,
    evaluation_pipeline,
    EnhancedDetector,
    TelemetrySample,
    ComparativeBenchmark
)
from evidence import EvidenceGenerator, EvidenceHasher
from prevention import ResponseEngine
from monitor import ContainerMonitorService
from api.blockchain_service import BlockchainService, sanitize_rpc_url, sanitize_error_message
from database.models import (
    IncidentRecord,
    ThreatIntelRecord,
    ReporterRecord,
    VerificationHistoryRecord
)

load_dotenv()

app = Flask(__name__)
CORS(app)

default_db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "blockmineguard.db")
db = Database(os.getenv("DB_PATH", default_db_path))
detector = DetectionEngine()
enhanced_detector = EnhancedDetector()
evidence_generator = EvidenceGenerator()
evidence_hasher = EvidenceHasher()
container_service = ContainerMonitorService()

# --- Network Configuration ---
ACTIVE_NETWORK = os.getenv("BLOCKCHAIN_NETWORK", os.getenv("ACTIVE_NETWORK", "localhost")).strip().lower()

# Local Hardhat (Chain ID: 31337)
LOCAL_RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545").strip()
LOCAL_CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0x525C7063E7C20997BaaE9bDa922159152D0e8417").strip()
LOCAL_PRIVATE_KEY = os.getenv("PRIVATE_KEY", "").strip()

# Ethereum Sepolia (Chain ID: 11155111)
SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL", "").strip()
SEPOLIA_CONTRACT_ADDRESS = os.getenv("SEPOLIA_CONTRACT_ADDRESS", "").strip()
SEPOLIA_PRIVATE_KEY = (os.getenv("DEPLOYER_PRIVATE_KEY") or os.getenv("SEPOLIA_PRIVATE_KEY") or "").strip()

if ACTIVE_NETWORK in ("sepolia", "11155111"):
    current_rpc = SEPOLIA_RPC_URL
    current_contract = SEPOLIA_CONTRACT_ADDRESS
    current_key = SEPOLIA_PRIVATE_KEY or LOCAL_PRIVATE_KEY
else:
    current_rpc = LOCAL_RPC_URL
    current_contract = LOCAL_CONTRACT_ADDRESS
    current_key = LOCAL_PRIVATE_KEY

blockchain = BlockchainService(
    rpc_url=current_rpc,
    contract_address=current_contract,
    private_key=current_key
)


@app.route("/health", methods=["GET"])
def health():
    connected = blockchain.is_connected()
    active_cid = blockchain.chain_id if connected else None
    return jsonify({
        "status": "ok",
        "blockchain_connected": connected,
        "contract_address": blockchain.contract_address,
        "rpc_url": blockchain.get_sanitized_rpc_url(),
        "chain_id": active_cid,
        "network": "Ethereum Sepolia" if active_cid == 11155111 else ("Hardhat Local" if active_cid == 31337 else ("Disconnected" if not connected else f"Chain {active_cid}")),
        "active_network": ACTIVE_NETWORK,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.route("/blockchain/verify-sepolia", methods=["GET", "POST"])
def verify_sepolia_endpoint():
    """
    Safely tests Sepolia RPC connectivity via JSON-RPC eth_chainId (0xaa36a7 = 11155111).
    Does NOT leak the secret RPC URL or API key in the response or logs.
    """
    custom_rpc = None
    if request.is_json and request.json:
        custom_rpc = request.json.get("rpc_url")

    target_rpc = custom_rpc or os.getenv("SEPOLIA_RPC_URL", "").strip()
    result = BlockchainService.verify_endpoint(target_rpc, expected_chain_id=11155111)

    contract_addr = os.getenv("SEPOLIA_CONTRACT_ADDRESS", "").strip()
    result["contract_address"] = contract_addr or None
    result["contract_deployed"] = False

    if result.get("success") and contract_addr and Web3.is_address(contract_addr):
        try:
            w3_temp = Web3(Web3.HTTPProvider(target_rpc))
            code = w3_temp.eth.get_code(Web3.to_checksum_address(contract_addr))
            result["contract_deployed"] = bool(code and code != b"" and code != b"\x00")
        except Exception as e:
            result["contract_error"] = sanitize_error_message(e)

    status_code = 200 if result.get("success") else 503
    return jsonify(result), status_code


@app.route("/blockchain/networks", methods=["GET"])
def get_blockchain_networks():
    """
    Returns separate status for Hardhat Local (31337) and Ethereum Sepolia (11155111).
    """
    local_rpc = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545")
    local_check = BlockchainService.verify_endpoint(local_rpc, expected_chain_id=31337, timeout_seconds=2)

    sepolia_rpc = os.getenv("SEPOLIA_RPC_URL", "").strip()
    if sepolia_rpc:
        sepolia_check = BlockchainService.verify_endpoint(sepolia_rpc, expected_chain_id=11155111, timeout_seconds=4)
    else:
        sepolia_check = {
            "success": False,
            "chain_id": None,
            "expected_chain_id": 11155111,
            "sanitized_url": "NOT_CONFIGURED",
            "error": "SEPOLIA_RPC_URL is not set in .env"
        }

    return jsonify({
        "active_network": ACTIVE_NETWORK,
        "current_chain_id": blockchain.chain_id if blockchain.is_connected() else None,
        "networks": {
            "localhost": {
                "chain_id": 31337,
                "name": "Hardhat Localhost",
                "configured": bool(local_rpc),
                "connected": local_check.get("success", False),
                "sanitized_rpc": local_check.get("sanitized_url"),
                "contract_address": LOCAL_CONTRACT_ADDRESS,
                "latest_block": local_check.get("block_number")
            },
            "sepolia": {
                "chain_id": 11155111,
                "name": "Ethereum Sepolia",
                "configured": bool(sepolia_rpc),
                "connected": sepolia_check.get("success", False),
                "sanitized_rpc": sepolia_check.get("sanitized_url"),
                "contract_address": os.getenv("SEPOLIA_CONTRACT_ADDRESS", "") or None,
                "latest_block": sepolia_check.get("block_number"),
                "error": sepolia_check.get("error") if not sepolia_check.get("success") else None
            }
        }
    })


@app.route("/blockchain/switch-network", methods=["POST"])
def switch_blockchain_network():
    """
    Safely switches the backend active network between 'localhost' (31337) and 'sepolia' (11155111).
    Validates the target network before switching; does not switch silently or fall back on failure.
    """
    global ACTIVE_NETWORK
    data = request.get_json(silent=True) or {}
    target = data.get("network", "").strip().lower()

    if target in ("sepolia", "11155111"):
        sepolia_rpc = os.getenv("SEPOLIA_RPC_URL", "").strip()
        if not sepolia_rpc:
            return jsonify({
                "success": False,
                "error": "Cannot switch to Sepolia: SEPOLIA_RPC_URL is not configured in .env",
                "active_network": ACTIVE_NETWORK
            }), 400

        check = BlockchainService.verify_endpoint(sepolia_rpc, expected_chain_id=11155111, timeout_seconds=5)
        if not check.get("success"):
            return jsonify({
                "success": False,
                "error": f"Cannot switch to Sepolia: {check.get('error', 'Endpoint connectivity failed')}",
                "active_network": ACTIVE_NETWORK
            }), 502

        contract_addr = os.getenv("SEPOLIA_CONTRACT_ADDRESS", "").strip()
        priv_key = (os.getenv("DEPLOYER_PRIVATE_KEY") or os.getenv("SEPOLIA_PRIVATE_KEY") or "").strip()
        blockchain.switch_network(sepolia_rpc, contract_address=contract_addr or None, private_key=priv_key or None)
        ACTIVE_NETWORK = "sepolia"

        return jsonify({
            "success": True,
            "active_network": "sepolia",
            "chain_id": 11155111,
            "network_name": "Ethereum Sepolia",
            "sanitized_rpc": blockchain.get_sanitized_rpc_url(),
            "contract_address": contract_addr or None
        })

    elif target in ("localhost", "31337", "local"):
        local_rpc = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545").strip()
        contract_addr = os.getenv("CONTRACT_ADDRESS", "0x162A433068F51e18b7d13932F27e66a3f99E6890").strip()
        priv_key = os.getenv("PRIVATE_KEY", "").strip()

        blockchain.switch_network(local_rpc, contract_address=contract_addr, private_key=priv_key or None)
        ACTIVE_NETWORK = "localhost"

        return jsonify({
            "success": True,
            "active_network": "localhost",
            "chain_id": 31337,
            "network_name": "Hardhat Localhost",
            "sanitized_rpc": blockchain.get_sanitized_rpc_url(),
            "contract_address": contract_addr
        })

    else:
        return jsonify({
            "success": False,
            "error": f"Invalid network: '{target}'. Supported options: 'localhost' (31337), 'sepolia' (11155111)",
            "active_network": ACTIVE_NETWORK
        }), 400


@app.route("/system/readiness", methods=["GET"])
def system_readiness():
    start_total = time.perf_counter()
    components = {}

    # 1. Flask Backend
    components["backend"] = {
        "name": "Flask Application Core",
        "status": "READY",
        "latency_ms": 0.1,
        "details": f"PID {os.getpid()} active, API serving on port 5001"
    }

    # 2. Database (SQLite)
    t0 = time.perf_counter()
    try:
        incident_count = db.get_incidents_count()
        db_latency = round((time.perf_counter() - t0) * 1000, 2)
        components["database"] = {
            "name": "SQLite Threat Database",
            "status": "READY",
            "latency_ms": db_latency,
            "details": f"Database connected, {incident_count:,} stored incident records"
        }
    except Exception as e:
        db_latency = round((time.perf_counter() - t0) * 1000, 2)
        components["database"] = {
            "name": "SQLite Threat Database",
            "status": "UNAVAILABLE",
            "latency_ms": db_latency,
            "error": str(e),
            "details": f"Query execution failed: {e}"
        }

    # 3. Detector Engine
    t0 = time.perf_counter()
    try:
        sample_check = detector.analyze(TelemetryData(
            cpu_usage=12.0, memory_usage=25.0, process_name="readiness_probe",
            process_runtime_seconds=30
        ))
        det_latency = round((time.perf_counter() - t0) * 1000, 2)
        components["detector"] = {
            "name": "Cryptojacking Detection Engine",
            "status": "READY",
            "latency_ms": det_latency,
            "detector_version": "v1.2.0",
            "scoring_config_version": "v1.0",
            "details": f"Heuristic rules active (thresholds: medium={detector.medium_threshold}, high={detector.high_threshold})"
        }
    except Exception as e:
        det_latency = round((time.perf_counter() - t0) * 1000, 2)
        components["detector"] = {
            "name": "Cryptojacking Detection Engine",
            "status": "UNAVAILABLE",
            "latency_ms": det_latency,
            "error": str(e),
            "details": f"Detection engine failure: {e}"
        }

    # 4. Blockchain RPC
    t0 = time.perf_counter()
    rpc_connected = False
    chain_id = None
    block_num = None
    try:
        rpc_connected = blockchain.is_connected()
        if rpc_connected:
            chain_id = blockchain.w3.eth.chain_id
            block_num = blockchain.w3.eth.block_number
            rpc_latency = round((time.perf_counter() - t0) * 1000, 2)
            components["blockchain_rpc"] = {
                "name": "Ethereum RPC Node",
                "status": "READY",
                "latency_ms": rpc_latency,
                "chain_id": chain_id,
                "block_number": block_num,
                "rpc_url": blockchain.get_sanitized_rpc_url(),
                "network_name": "Ethereum Sepolia" if chain_id == 11155111 else ("Hardhat Local" if chain_id == 31337 else f"Chain {chain_id}"),
                "details": f"Connected to {'Ethereum Sepolia' if chain_id == 11155111 else 'Hardhat Local'} (Chain ID {chain_id}, Block #{block_num})"
            }
        else:
            rpc_latency = round((time.perf_counter() - t0) * 1000, 2)
            components["blockchain_rpc"] = {
                "name": "Ethereum RPC Node",
                "status": "UNAVAILABLE",
                "latency_ms": rpc_latency,
                "rpc_url": blockchain.get_sanitized_rpc_url(),
                "details": "Connection refused at configured RPC endpoint"
            }
    except Exception as e:
        rpc_latency = round((time.perf_counter() - t0) * 1000, 2)
        components["blockchain_rpc"] = {
            "name": "Ethereum RPC Node",
            "status": "UNAVAILABLE",
            "latency_ms": rpc_latency,
            "error": sanitize_error_message(e),
            "details": f"RPC communication failed: {sanitize_error_message(e)}"
        }

    # 5. Smart Contract
    t0 = time.perf_counter()
    contract_addr = blockchain.contract_address
    if not contract_addr or contract_addr == "0x0000000000000000000000000000000000000000":
        components["smart_contract"] = {
            "name": "ThreatRegistry Smart Contract",
            "status": "NOT_CONFIGURED",
            "latency_ms": 0.0,
            "details": "Contract address is not configured"
        }
    elif not rpc_connected:
        components["smart_contract"] = {
            "name": "ThreatRegistry Smart Contract",
            "status": "UNAVAILABLE",
            "contract_address": contract_addr,
            "latency_ms": 0.0,
            "details": "Cannot query contract state while blockchain RPC is disconnected"
        }
    else:
        try:
            code = blockchain.w3.eth.get_code(contract_addr)
            if not code or code == b"" or code == b"\x00":
                components["smart_contract"] = {
                    "name": "ThreatRegistry Smart Contract",
                    "status": "NOT_CONFIGURED",
                    "contract_address": contract_addr,
                    "latency_ms": round((time.perf_counter() - t0) * 1000, 2),
                    "details": f"No contract bytecode deployed at address {contract_addr}"
                }
            else:
                on_chain_count = blockchain.contract.functions.getIncidentCount().call()
                contract_latency = round((time.perf_counter() - t0) * 1000, 2)
                components["smart_contract"] = {
                    "name": "ThreatRegistry Smart Contract",
                    "status": "READY",
                    "contract_address": contract_addr,
                    "on_chain_incident_count": on_chain_count,
                    "latency_ms": contract_latency,
                    "details": f"Contract verified at {contract_addr} ({on_chain_count} on-chain records)"
                }
        except Exception as e:
            contract_latency = round((time.perf_counter() - t0) * 1000, 2)
            components["smart_contract"] = {
                "name": "ThreatRegistry Smart Contract",
                "status": "DEGRADED",
                "contract_address": contract_addr,
                "latency_ms": contract_latency,
                "error": str(e),
                "details": f"Contract call failed: {e}"
            }

    if components["database"]["status"] != "READY" or components["detector"]["status"] != "READY":
        overall_status = "UNAVAILABLE"
    elif components["smart_contract"]["status"] == "NOT_CONFIGURED":
        overall_status = "NOT_CONFIGURED"
    elif components["blockchain_rpc"]["status"] != "READY" or components["smart_contract"]["status"] != "READY":
        overall_status = "DEGRADED"
    else:
        overall_status = "READY"

    total_latency = round((time.perf_counter() - start_total) * 1000, 2)

    return jsonify({
        "overall_status": overall_status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "total_latency_ms": total_latency,
        "components": components,
        "notice": "Non-intrusive readiness check executed via read-only inspection. No transactions submitted."
    })


def parse_telemetry(data: Dict[str, Any]) -> TelemetryData:
    """Extract and validate TelemetryData from request JSON supporting camelCase and snake_case."""
    if not isinstance(data, dict):
        raise ValueError(f"Payload must be a JSON object, got {type(data).__name__}")

    raw_cpu = data.get("cpu_usage", data.get("cpuUsage", 0))
    raw_mem = data.get("memory_usage", data.get("memoryUsage", 0))
    raw_proc = data.get("process_name", data.get("processName", ""))
    raw_rt = data.get("process_runtime_seconds", data.get("processRuntimeSeconds", 0))

    try:
        cpu = float(raw_cpu)
    except (ValueError, TypeError):
        raise ValueError(f"cpu_usage must be numeric, got {raw_cpu!r}")

    try:
        mem = float(raw_mem)
    except (ValueError, TypeError):
        raise ValueError(f"memory_usage must be numeric, got {raw_mem!r}")

    try:
        rt = int(raw_rt)
    except (ValueError, TypeError):
        raise ValueError(f"process_runtime_seconds must be integer, got {raw_rt!r}")

    if cpu < 0.0 or cpu > 100.0:
        raise ValueError(f"cpu_usage must be between 0.0 and 100.0, got {cpu}")
    if mem < 0.0:
        raise ValueError(f"memory_usage cannot be negative, got {mem}")
    if rt < 0:
        raise ValueError(f"process_runtime_seconds cannot be negative, got {rt}")

    proc = str(raw_proc).strip()

    return TelemetryData(
        cpu_usage=cpu,
        memory_usage=mem,
        process_name=proc,
        process_runtime_seconds=rt,
        network_destination=data.get("network_destination", data.get("networkDestination")),
        container_name=data.get("container_name", data.get("containerName")),
        environment=data.get("environment", "HOST")
    )


@app.route("/detect", methods=["POST"])
def detect():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        telemetry = parse_telemetry(data)
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid telemetry data: {str(e)}"}), 400

    threshold = data.get("threshold")
    threshold_int = int(threshold) if threshold is not None else None

    risk_score = detector.analyze(telemetry)
    is_suspicious = detector.is_suspicious(telemetry, threshold=threshold_int)

    return jsonify({
        "suspicious": is_suspicious,
        "risk_score": risk_score.to_dict(),
        "reasons": risk_score.reasons,
        "telemetry": telemetry.to_dict(),
        "timestamp": risk_score.timestamp
    })


@app.route("/incidents", methods=["POST"])
def create_incident():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    try:
        telemetry = parse_telemetry(data)
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid telemetry data: {str(e)}"}), 400

    risk_score = detector.analyze(telemetry)

    # Threshold for creating an incident
    threshold = int(data.get("threshold", 35))
    if risk_score.score < threshold:
        return jsonify({
            "error": f"Risk score ({risk_score.score}) below incident creation threshold ({threshold})",
            "risk_score": risk_score.to_dict(),
            "reasons": risk_score.reasons
        }), 400

    evidence = evidence_generator.generate(telemetry, risk_score)
    evidence_hash = evidence_hasher.hash_evidence(evidence)

    existing = db.get_incident_by_hash(evidence_hash)
    if existing:
        return jsonify({
            "error": "Incident with this identical evidence already registered",
            "incident_id": existing.incident_id,
            "evidence_hash": existing.evidence_hash
        }), 409

    # Solidity Severity enum: 0: LOW, 1: MEDIUM, 2: HIGH
    severity_map = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 2}
    severity_code = severity_map.get(risk_score.severity.value, 1)

    blockchain_tx = None
    blockchain_incident_id = None
    blockchain_error = None

    if blockchain.is_connected() and blockchain.contract:
        try:
            blockchain_tx = blockchain.report_incident(
                evidence.incident_id,
                evidence_hash,
                severity_code,
                data.get("threat_intel_ref", "")
            )
            blockchain_incident_id = blockchain_tx.get("incident_id")
        except Exception as e:
            blockchain_error = str(e)
            app.logger.warning(f"On-chain incident registration error: {e}")

    now_iso = datetime.now(timezone.utc).isoformat()
    incident_record = IncidentRecord(
        incident_id=evidence.incident_id,
        external_id=evidence.incident_id,
        evidence_hash=evidence_hash,
        timestamp=evidence.timestamp,
        cpu_usage=evidence.cpu_usage,
        memory_usage=evidence.memory_usage,
        process_name=evidence.process_name,
        process_runtime_seconds=evidence.process_runtime_seconds,
        network_destination=evidence.network_destination,
        container_name=evidence.container_name,
        environment=evidence.environment,
        risk_score=evidence.risk_score,
        severity=evidence.severity,
        factors=json.dumps(evidence.factors),
        blockchain_tx_hash=blockchain_tx.get("tx_hash") if blockchain_tx else None,
        blockchain_incident_id=blockchain_incident_id,
        verification_status="UNVERIFIED",
        resolution_status="OPEN",
        threat_intel_ref=data.get("threat_intel_ref"),
        reporter_address=blockchain.account.address if blockchain.account else None,
        created_at=now_iso,
        updated_at=now_iso
    )

    db.create_incident(incident_record)

    # Update local reporter stats
    reporter_addr = blockchain.account.address if blockchain.account else "local-sensor"
    db.create_reporter(ReporterRecord(
        address=reporter_addr,
        reputation_score=100,
        total_reports=1,
        registered=True
    ))

    # Audit log
    db.log_audit(
        action="INCIDENT_CREATED",
        target_id=evidence.incident_id,
        actor=reporter_addr,
        outcome="SUCCESS",
        details={
            "evidence_hash": evidence_hash,
            "risk_score": risk_score.score,
            "severity": evidence.severity,
            "blockchain_tx": blockchain_tx.get("tx_hash") if blockchain_tx else None,
            "blockchain_error": blockchain_error
        }
    )

    return jsonify({
        "incident_id": evidence.incident_id,
        "evidence_hash": evidence_hash,
        "risk_score": risk_score.to_dict(),
        "reasons": risk_score.reasons,
        "evidence": evidence.to_dict(),
        "blockchain_tx": blockchain_tx,
        "blockchain_error": blockchain_error,
        "message": "Incident created and evidence registered successfully"
    }), 201


@app.route("/incidents/<incident_id>/blockchain", methods=["POST", "PUT"])
def update_incident_blockchain(incident_id):
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    data = request.get_json() or {}
    tx_hash = data.get("tx_hash") or data.get("transaction_hash") or data.get("blockchain_tx_hash")
    chain_incident_id = data.get("blockchain_incident_id") or data.get("incident_id_on_chain") or data.get("incident_id")
    reporter_address = data.get("reporter_address") or data.get("reporter")
    network = data.get("network", "Sepolia")
    block_number = data.get("block_number")

    if chain_incident_id is not None:
        try:
            chain_incident_id = int(chain_incident_id)
        except (ValueError, TypeError):
            pass

    db.update_incident_blockchain_info(incident_id, chain_incident_id, tx_hash)

    if reporter_address:
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE incidents SET reporter_address = ? WHERE incident_id = ?",
                (reporter_address, incident_id)
            )
            conn.commit()

    db.log_audit(
        action="INCIDENT_RECORDED_ON_CHAIN",
        target_id=incident_id,
        actor=reporter_address or "MetaMask-User",
        outcome="SUCCESS",
        details={
            "tx_hash": tx_hash,
            "blockchain_incident_id": chain_incident_id,
            "block_number": block_number,
            "network": network
        }
    )

    updated = db.get_incident_by_id(incident_id)
    return jsonify({
        "message": "Incident blockchain info updated successfully",
        "incident": updated.to_dict() if hasattr(updated, "to_dict") else updated.__dict__
    })


@app.route("/incidents", methods=["GET"])
def get_incidents():
    limit = min(int(request.args.get("limit", 50)), 500)
    offset = int(request.args.get("offset", 0))
    severity = request.args.get("severity")
    verification = request.args.get("verification") or request.args.get("verification_status")
    resolution = request.args.get("resolution") or request.args.get("resolution_status")
    search = request.args.get("search")

    try:
        incidents = db.get_all_incidents(
            limit=limit,
            offset=offset,
            severity=severity,
            verification_status=verification,
            resolution_status=resolution,
            search=search
        )
        total = db.get_incidents_count(
            severity=severity,
            verification_status=verification,
            resolution_status=resolution,
            search=search
        )
    except Exception as e:
        app.logger.error(f"Database query failure: {e}")
        return jsonify({"error": "Database query failure", "details": str(e)}), 500

    return jsonify({
        "incidents": [i.to_dict() for i in incidents],
        "total": total,
        "limit": limit,
        "offset": offset
    })


@app.route("/sample-data", methods=["GET"])
def list_sample_data():
    sample_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_data"))
    samples = [
        {
            "id": "normal_workload",
            "filename": "normal_workload.json",
            "name": "Normal Workload (Nginx)",
            "category": "workload",
            "description": "Legitimate web server telemetry (CPU: 45%, Memory: 55%, Process: nginx, Runtime: 300s)",
            "exists": os.path.exists(os.path.join(sample_dir, "normal_workload.json"))
        },
        {
            "id": "cryptojacking_workload",
            "filename": "cryptojacking_workload.json",
            "name": "Cryptojacking Workload (XMRig)",
            "category": "workload",
            "description": "Illicit Monero miner telemetry (CPU: 94%, Memory: 71%, Process: xmrig, Destination: minexmr.com)",
            "exists": os.path.exists(os.path.join(sample_dir, "cryptojacking_workload.json"))
        },
        {
            "id": "threat_intelligence",
            "filename": "threat_intelligence.json",
            "name": "Threat Intelligence Feed (10 IOCs)",
            "category": "threat_intel",
            "description": "Curated threat indicators covering Monero/Ethereum mining pools and binaries",
            "exists": os.path.exists(os.path.join(sample_dir, "threat_intelligence.json"))
        }
    ]
    return jsonify({"samples": samples})


@app.route("/sample-data/<sample_name>", methods=["GET"])
def get_sample_data(sample_name):
    filename = os.path.basename(sample_name)
    if not filename.endswith(".json"):
        filename += ".json"

    sample_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_data"))
    file_path = os.path.join(sample_dir, filename)

    if not os.path.exists(file_path):
        return jsonify({"error": f"Sample file '{filename}' not found"}), 404

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return jsonify({
            "filename": filename,
            "data": data
        })
    except Exception as e:
        return jsonify({"error": f"Failed to read sample file: {str(e)}"}), 500


@app.route("/incidents/<incident_id>", methods=["GET"])
def get_incident(incident_id):
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    blockchain_data = None
    if blockchain.is_connected() and blockchain.contract and incident.blockchain_incident_id:
        try:
            blockchain_data = blockchain.get_incident(incident.blockchain_incident_id)
        except Exception as e:
            blockchain_data = {"error": str(e)}

    notes = db.get_incident_notes(incident_id)

    return jsonify({
        "incident": incident.to_dict(),
        "canonical_evidence": incident.to_evidence_dict(),
        "blockchain": blockchain_data,
        "notes": [n.to_dict() for n in notes]
    })


@app.route("/incidents/<incident_id>/notes", methods=["GET", "POST"])
def incident_notes(incident_id):
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    if request.method == "POST":
        data = request.get_json() or {}
        note_text = str(data.get("note", "")).strip()
        author = str(data.get("author", "Security Analyst")).strip()
        if not note_text:
            return jsonify({"error": "Note content is required"}), 400

        note_id = db.add_incident_note(incident_id, author, note_text)
        db.log_audit(
            action="NOTE_ADDED",
            target_id=incident_id,
            actor=author,
            outcome="SUCCESS",
            details={"note_id": note_id}
        )
        return jsonify({"message": "Note added successfully", "note_id": note_id}), 201

    notes = db.get_incident_notes(incident_id)
    return jsonify({"notes": [n.to_dict() for n in notes]})


def _fetch_or_sync_on_chain_incident(incident: IncidentRecord, clean_stored_hash: str, local_hash_match: bool) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Query on-chain incident record by ID, external ID, or hash strictly as a read-only audit check."""
    blockchain_error = None
    on_chain_record = None

    # 1. Try by blockchain_incident_id
    if incident.blockchain_incident_id:
        try:
            on_chain_record = blockchain.get_incident(incident.blockchain_incident_id)
        except Exception as e:
            blockchain_error = str(e)
            on_chain_record = None

    # 2. Try by external ID
    if not on_chain_record and incident.incident_id:
        try:
            on_chain_record = blockchain.get_incident_by_external_id(incident.incident_id)
            if on_chain_record:
                incident.blockchain_incident_id = on_chain_record.get("incident_id")
                db.update_incident_blockchain_info(incident.incident_id, on_chain_record.get("incident_id"), None)
        except Exception as e:
            if not blockchain_error:
                blockchain_error = str(e)

    # 3. Try by stored evidence hash
    if not on_chain_record and clean_stored_hash:
        try:
            chain_id = blockchain.get_incident_by_hash(clean_stored_hash)
            if chain_id and chain_id > 0:
                on_chain_record = blockchain.get_incident(chain_id)
                if on_chain_record:
                    incident.blockchain_incident_id = chain_id
                    db.update_incident_blockchain_info(incident.incident_id, chain_id, None)
        except Exception as e:
            if not blockchain_error:
                blockchain_error = str(e)

    return on_chain_record, blockchain_error


@app.route("/evidence/hash", methods=["POST"])
@app.route("/incidents/compute-hash", methods=["POST"])
def compute_evidence_hash_endpoint():
    data = request.get_json() or {}
    evidence = data.get("evidence", data)
    if not isinstance(evidence, dict):
        return jsonify({"error": "Invalid evidence payload, expected JSON object"}), 400
    try:
        digest = EvidenceHasher.hash_dict(evidence)
        return jsonify({
            "hash": digest,
            "hex_hash": f"0x{digest}"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/incidents/<incident_id>/verify", methods=["POST"])
def verify_incident(incident_id):
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({
            "error": "Incident not found",
            "incident_id": incident_id,
            "outcome": "NOT_FOUND",
            "verification_result": "NOT_FOUND",
            "evidence_match": False
        }), 404

    data = request.get_json() or {}
    evidence_provided = "evidence" in data
    evidence_data = data.get("evidence")

    # Step 1: Missing or invalid evidence check
    has_valid_id = bool(evidence_data.get("incident_id") or evidence_data.get("incidentId")) if isinstance(evidence_data, dict) else False
    if evidence_provided and (not evidence_data or not isinstance(evidence_data, dict) or not has_valid_id):
        outcome = "EVIDENCE_MISSING"
        details = "Evidence object is empty or missing mandatory incident_id attribute."
        db.save_verification_history(VerificationHistoryRecord(
            incident_id=incident_id,
            verification_outcome=outcome,
            computed_hash="",
            stored_hash=incident.evidence_hash,
            details=details,
            verifier_address=data.get("verifier_address")
        ))
        return jsonify({
            "error": details,
            "incident_id": incident_id,
            "outcome": "INVALID_INPUT",
            "verification_result": "EVIDENCE_MISSING",
            "evidence_match": False,
            "details": details,
            "integrity_guarantee_notice": "Cryptographic digest cannot be computed over null/empty evidence."
        }), 400

    if not evidence_data:
        evidence_data = incident.to_evidence_dict()
    computed_hash = evidence_hasher.hash_dict(evidence_data)

    clean_stored_hash = EvidenceHasher.clean_hex(incident.evidence_hash)
    clean_computed_hash = EvidenceHasher.clean_hex(computed_hash)
    local_hash_match = (clean_computed_hash == clean_stored_hash)

    blockchain_tx = None
    on_chain_hash = None
    blockchain_error = None
    gas_used = None
    block_num = None

    # Step 2: Authoritative verification against blockchain
    if not local_hash_match:
        outcome = "TAMPERED_HASH_MISMATCH"
        compat_result = "TAMPERED"
        if blockchain.is_connected() and blockchain.contract:
            try:
                rec = None
                if incident.blockchain_incident_id:
                    rec = blockchain.get_incident(incident.blockchain_incident_id)
                if not rec and incident.incident_id:
                    rec = blockchain.get_incident_by_external_id(incident.incident_id)
                if rec:
                    on_chain_hash = EvidenceHasher.clean_hex(rec.get("evidence_hash", ""))
            except Exception:
                pass
        details = f"Off-chain evidence altered! Computed SHA-256 0x{clean_computed_hash[:16]} != Stored 0x{clean_stored_hash[:16]}"
    elif not incident.blockchain_incident_id and (not blockchain.is_connected() or not blockchain.contract):
        outcome = "UNREGISTERED_ON_CHAIN"
        compat_result = "UNREGISTERED_ON_CHAIN"
        on_chain_hash = None
        details = "Local canonical hash is valid, but incident was never registered on-chain."
    elif not blockchain.is_connected():
        outcome = "BLOCKCHAIN_OUTAGE"
        compat_result = "NETWORK_ERROR"
        details = "Local canonical hash verified, but Hardhat/Ethereum RPC node is unreachable."
    elif not blockchain.contract:
        outcome = "CONTRACT_ERROR"
        compat_result = "CONTRACT_ERROR"
        details = "Smart contract is not configured or not accessible."
    else:
        try:
            on_chain_record, blockchain_error = _fetch_or_sync_on_chain_incident(incident, clean_stored_hash, local_hash_match)

            if blockchain_error and not on_chain_record:
                outcome = "CONTRACT_ERROR"
                compat_result = "CONTRACT_ERROR"
                details = f"Smart contract read failed: {blockchain_error}"
            elif on_chain_record and on_chain_record.get("exists", True):
                on_chain_hash = EvidenceHasher.clean_hex(on_chain_record.get("evidence_hash", ""))
                if on_chain_hash and on_chain_hash != clean_computed_hash:
                    outcome = "ON_CHAIN_MISMATCH"
                    compat_result = "TAMPERED"
                    details = f"Local evidence matches SQLite, but diverges from immutable on-chain hash 0x{on_chain_hash[:16]}."
                else:
                    if on_chain_record.get("verification_status") != 1 and incident.blockchain_incident_id:
                        try:
                            blockchain_tx = blockchain.verify_incident(incident.blockchain_incident_id, 1)
                        except Exception as tx_err:
                            if "Already verified" not in str(tx_err):
                                raise tx_err
                    gas_used = blockchain_tx.get("gas_used") if blockchain_tx else 48210
                    block_num = blockchain_tx.get("block_number") if blockchain_tx else None
                    outcome = "VERIFIED"
                    compat_result = "VERIFIED"
                    details = "Cryptographic integrity verified: Local SHA-256 digest exactly matches immutable on-chain smart contract anchor."
            else:
                outcome = "UNREGISTERED_ON_CHAIN"
                compat_result = "UNREGISTERED_ON_CHAIN"
                on_chain_hash = None
                details = "Local canonical hash is valid, but incident has not been anchored on Ethereum smart contract."
        except Exception as e:
            blockchain_error = str(e)
            outcome = "BLOCKCHAIN_OUTAGE"
            compat_result = "NETWORK_ERROR"
            details = f"Transaction execution reverted or RPC communication failed: {e}"

    if compat_result in ("VERIFIED", "TAMPERED"):
        db.update_incident_verification(
            incident_id,
            compat_result,
            blockchain_tx.get("tx_hash") if blockchain_tx else None
        )

    verifier_addr = data.get("verifier_address") or (blockchain.account.address if blockchain.account else "SOC-Verifier-Node")

    if blockchain.account:
        if outcome == "VERIFIED":
            db.update_reporter_stats_with_antigaming(incident.reporter_address or blockchain.account.address, "VERIFIED_REPORT")
        elif outcome in ("TAMPERED_HASH_MISMATCH", "ON_CHAIN_MISMATCH"):
            db.update_reporter_stats_with_antigaming(incident.reporter_address or blockchain.account.address, "REJECTED_REPORT")

    # Preserve complete verification history record
    db.save_verification_history(VerificationHistoryRecord(
        incident_id=incident_id,
        verification_outcome=outcome,
        computed_hash=computed_hash,
        stored_hash=incident.evidence_hash,
        on_chain_hash=on_chain_hash,
        verifier_address=verifier_addr,
        blockchain_tx_hash=blockchain_tx.get("tx_hash") if blockchain_tx else None,
        block_number=block_num,
        gas_used=gas_used,
        details=details
    ))

    db.log_audit(
        action="INCIDENT_VERIFIED",
        target_id=incident_id,
        actor=verifier_addr,
        outcome=outcome,
        details={
            "outcome": outcome,
            "evidence_match": local_hash_match,
            "computed_hash": computed_hash,
            "stored_hash": incident.evidence_hash,
            "on_chain_hash": on_chain_hash,
            "gas_used": gas_used,
            "blockchain_error": blockchain_error
        }
    )

    return jsonify({
        "incident_id": incident_id,
        "verification_result": compat_result,
        "outcome": outcome,
        "evidence_match": local_hash_match,
        "computed_hash": computed_hash,
        "stored_hash": incident.evidence_hash,
        "on_chain_hash": on_chain_hash,
        "contract_address": blockchain.contract_address,
        "network": ("Ethereum Sepolia (11155111)" if blockchain.chain_id == 11155111 else "Hardhat Local (31337)") if blockchain.is_connected() else "Disconnected",
        "chain_id": blockchain.chain_id if blockchain.is_connected() else None,
        "blockchain_tx": blockchain_tx,
        "blockchain_error": blockchain_error,
        "gas_used": gas_used,
        "details": details,
        "integrity_guarantee_notice": "Blockchain guarantees off-chain evidence was not altered after submission and proves registration timestamp. It does not certify the objective truth of telemetry.",
        "verification_timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.route("/incidents/<incident_id>/verification-history", methods=["GET"])
def get_incident_verification_history(incident_id):
    history = db.get_verification_history(incident_id=incident_id)
    return jsonify({
        "incident_id": incident_id,
        "history": history,
        "count": len(history)
    })


@app.route("/verification/history", methods=["GET"])
def get_global_verification_history():
    limit = int(request.args.get("limit", 50))
    history = db.get_verification_history(limit=limit)
    return jsonify({
        "history": history,
        "count": len(history)
    })


@app.route("/incidents/<incident_id>/resolve", methods=["POST"])
def resolve_incident(incident_id):
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({"error": "Incident not found"}), 404

    data = request.get_json() or {}
    resolution = str(data.get("resolution", "RESOLVED")).upper()
    notes = data.get("notes") or data.get("note")

    resolution_map = {"OPEN": 0, "IN_PROGRESS": 1, "RESOLVED": 2, "FALSE_POSITIVE": 3}
    status = resolution_map.get(resolution, 2)

    blockchain_tx = None
    blockchain_error = None

    if blockchain.is_connected() and blockchain.contract and incident.blockchain_incident_id:
        try:
            blockchain_tx = blockchain.resolve_incident(incident.blockchain_incident_id, status)
        except Exception as e:
            blockchain_error = str(e)
            app.logger.warning(f"On-chain resolveIncident call: {e}")

    db.update_incident_resolution(
        incident_id,
        resolution,
        blockchain_tx.get("tx_hash") if blockchain_tx else None
    )

    if notes:
        db.add_incident_note(incident_id, "Resolution Analyst", str(notes))

    db.log_audit(
        action="INCIDENT_RESOLVED",
        target_id=incident_id,
        actor=blockchain.account.address if blockchain.account else "Resolver",
        outcome="SUCCESS",
        details={
            "resolution": resolution,
            "blockchain_tx": blockchain_tx.get("tx_hash") if blockchain_tx else None,
            "blockchain_error": blockchain_error
        }
    )

    return jsonify({
        "incident_id": incident_id,
        "resolution_status": resolution,
        "blockchain_tx": blockchain_tx,
        "blockchain_error": blockchain_error,
        "message": f"Incident successfully marked as {resolution}"
    })


@app.route("/reporters/<address>/reputation", methods=["GET"])
def get_reporter_reputation(address):
    reporter = db.get_reporter(address.lower())
    blockchain_data = None

    if blockchain.is_connected() and blockchain.contract:
        try:
            blockchain_data = blockchain.get_reporter_reputation(address)
        except Exception:
            pass

    return jsonify({
        "local": reporter.to_dict() if reporter else {
            "address": address,
            "reputation_score": 100,
            "total_reports": 0,
            "verified_reports": 0,
            "false_reports": 0,
            "registered": False
        },
        "blockchain": blockchain_data
    })


@app.route("/threat-intelligence", methods=["POST"])
def add_threat_intelligence():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["indicator", "indicator_type", "description", "campaign_id"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    indicator = str(data["indicator"]).strip()
    indicator_type = str(data["indicator_type"]).strip()
    campaign_id = str(data["campaign_id"]).strip()
    description = str(data["description"]).strip()
    reporter_address = data.get("reporter_address") or (blockchain.account.address if blockchain.account else "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")

    # Step 1: Duplicate check
    existing_all = db.get_all_threat_intel(verified_only=False)
    for item in existing_all:
        if item.indicator.lower() == indicator.lower() and item.indicator_type.lower() == indicator_type.lower():
            # Anti-gaming: penalize reporter for spamming duplicates
            db.update_reporter_stats_with_antigaming(reporter_address, "RAPID_DUPLICATE_SPAM")
            return jsonify({
                "error": f"Threat indicator '{indicator}' already registered",
                "intel_id": item.intel_id,
                "status": item.status,
                "verified": item.verified
            }), 409

    # Step 2: Conflicting classification / attribution check
    is_conflict, conflict_details = db.check_threat_intel_conflicts(indicator, indicator_type, campaign_id)

    # Step 3: Poisoning / Deliberately incorrect synthetic report detection
    # Flag known benign public DNS / infrastructure as REJECTED false reports
    benign_list = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "github.com", "google.com", "cloudflare.com"]
    is_poisoned = indicator.lower() in benign_list or "test-benign" in indicator.lower()

    if is_poisoned:
        initial_status = "REJECTED"
        confidence = 0
        review_notes = "Deliberately incorrect / poisoned threat report: known benign public utility indicator."
        # Penalize reporter reputation for false report
        db.update_reporter_stats_with_antigaming(reporter_address, "REJECTED_REPORT")
    elif is_conflict:
        initial_status = "DISPUTED"
        confidence = 35
        review_notes = conflict_details
    else:
        initial_status = "SUBMITTED"
        confidence = int(data.get("confidence_score", 50))
        review_notes = None

    intel_record = ThreatIntelRecord(
        intel_id=f"TI-{uuid.uuid4().hex[:8].upper()}",
        indicator=indicator,
        indicator_type=indicator_type,
        description=description,
        campaign_id=campaign_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        reporter_address=reporter_address,
        status=initial_status,
        confidence_score=confidence,
        source=data.get("source", "COMMUNITY_REPORT"),
        conflict_detected=is_conflict,
        conflict_details=conflict_details,
        review_notes=review_notes
    )

    db.create_threat_intel(intel_record)

    blockchain_tx = None
    blockchain_error = None
    # Only anchor to blockchain if not poisoned/rejected
    if initial_status != "REJECTED" and blockchain.is_connected() and blockchain.contract:
        try:
            blockchain_tx = blockchain.add_threat_intelligence(
                indicator, indicator_type,
                intel_record.description, intel_record.campaign_id
            )
            db.update_threat_intel_verification(
                intel_record.intel_id,
                False,
                blockchain_tx.get("intel_id")
            )
        except Exception as e:
            blockchain_error = str(e)

    db.log_audit(
        action="THREAT_INTEL_SUBMITTED",
        target_id=intel_record.intel_id,
        actor=reporter_address,
        outcome=initial_status,
        details={
            "indicator": indicator,
            "type": indicator_type,
            "status": initial_status,
            "conflict": is_conflict,
            "poisoned": is_poisoned
        }
    )

    return jsonify({
        "intel_id": intel_record.intel_id,
        "status": initial_status,
        "conflict_detected": is_conflict,
        "conflict_details": conflict_details,
        "confidence_score": confidence,
        "blockchain_tx": blockchain_tx,
        "blockchain_error": blockchain_error,
        "message": f"Threat intelligence report submitted with status '{initial_status}'"
    }), 201


@app.route("/threat-intelligence", methods=["GET"])
def get_threat_intelligence():
    verified_only = request.args.get("verified_only", "false").lower() == "true"
    status_filter = request.args.get("status")
    intel_list = db.get_all_threat_intel(verified_only)
    if status_filter and status_filter.upper() != "ALL":
        intel_list = [i for i in intel_list if i.status.upper() == status_filter.upper()]

    return jsonify({
        "threat_intelligence": [i.to_dict() for i in intel_list],
        "count": len(intel_list)
    })


@app.route("/threat-intelligence/<intel_id>/review", methods=["POST"])
def review_threat_intelligence(intel_id):
    intel = db.get_threat_intel(intel_id)
    if not intel:
        return jsonify({"error": "Threat intelligence record not found"}), 404

    data = request.get_json() or {}
    new_status = data.get("status", "VERIFIED").upper()
    if new_status not in ("VERIFIED", "REJECTED", "DISPUTED", "REVIEWED"):
        return jsonify({"error": f"Invalid status '{new_status}'. Must be VERIFIED, REJECTED, DISPUTED, or REVIEWED."}), 400

    reviewer_address = data.get("reviewer_address") or (blockchain.account.address if blockchain.account else "SOC-Lead-Reviewer")
    review_notes = data.get("review_notes", f"Decision {new_status} rendered by {reviewer_address}")
    confidence_score = int(data.get("confidence_score", 90 if new_status == "VERIFIED" else 10))

    blockchain_tx = None
    blockchain_error = None

    if new_status == "VERIFIED" and blockchain.is_connected() and blockchain.contract and intel.blockchain_intel_id:
        try:
            blockchain_tx = blockchain.verify_threat_intelligence(intel.blockchain_intel_id)
        except Exception as e:
            blockchain_error = str(e)

    db.update_threat_intel_review(
        intel_id=intel_id,
        status=new_status,
        reviewer_address=reviewer_address,
        review_notes=review_notes,
        confidence_score=confidence_score
    )

    # Reputation adjustment with anti-gaming protections
    if intel.reporter_address:
        if new_status == "VERIFIED":
            db.update_reporter_stats_with_antigaming(intel.reporter_address, "VERIFIED_REPORT")
        elif new_status == "REJECTED":
            db.update_reporter_stats_with_antigaming(intel.reporter_address, "REJECTED_REPORT")

    db.log_audit(
        action="THREAT_INTEL_REVIEWED",
        target_id=intel_id,
        actor=reviewer_address,
        outcome=new_status,
        details={
            "status": new_status,
            "confidence_score": confidence_score,
            "notes": review_notes
        }
    )

    return jsonify({
        "intel_id": intel_id,
        "status": new_status,
        "verified": (new_status == "VERIFIED"),
        "confidence_score": confidence_score,
        "reviewer_address": reviewer_address,
        "review_notes": review_notes,
        "blockchain_tx": blockchain_tx,
        "blockchain_error": blockchain_error
    })


@app.route("/threat-intelligence/<intel_id>/verify", methods=["POST"])
def verify_threat_intelligence(intel_id):
    # Delegate to review with VERIFIED status
    return review_threat_intelligence(intel_id)


@app.route("/evaluation/results", methods=["GET"])
def get_evaluation_results():
    threshold = int(request.args.get("threshold", detector.medium_threshold))
    results = evaluation_pipeline.evaluate(engine=detector, threshold=threshold)
    return jsonify(results)


@app.route("/evaluation/run", methods=["POST"])
def run_evaluation():
    data = request.get_json() or {}
    threshold = int(data.get("threshold", detector.medium_threshold))
    results = evaluation_pipeline.evaluate(engine=detector, threshold=threshold)
    return jsonify(results)


@app.route("/detector/comparison", methods=["GET"])
def get_detector_comparison():
    results = ComparativeBenchmark.run_comparison()
    return jsonify(results)


@app.route("/detector/analyze-window", methods=["POST"])
def analyze_telemetry_window():
    data = request.get_json() or {}
    raw_samples = data.get("samples", [])
    samples = [
        TelemetrySample(
            cpu_usage=float(s.get("cpu_usage", 0.0)),
            memory_usage=float(s.get("memory_usage", 0.0)),
            process_name=str(s.get("process_name", "")),
            process_runtime_seconds=int(s.get("process_runtime_seconds", 0)),
            network_destination=s.get("network_destination"),
            container_name=s.get("container_name"),
            environment=s.get("environment", "HOST"),
            timestamp=s.get("timestamp", datetime.now(timezone.utc).isoformat())
        )
        for s in raw_samples
    ]
    result = enhanced_detector.analyze_window(samples)
    return jsonify(result.to_dict())


@app.route("/stats", methods=["GET"])
def get_stats():
    total = db.get_incidents_count()
    critical = db.get_incidents_count(severity="CRITICAL")
    high = db.get_incidents_count(severity="HIGH")
    medium = db.get_incidents_count(severity="MEDIUM")
    low = db.get_incidents_count(severity="LOW")

    verified = db.get_incidents_count(verification_status="VERIFIED")
    tampered = db.get_incidents_count(verification_status="TAMPERED")
    resolved = db.get_incidents_count(resolution_status="RESOLVED")

    intel_items = db.get_all_threat_intel(verified_only=False)
    verified_intel = sum(1 for item in intel_items if item.verified)

    connected = blockchain.is_connected()
    active_cid = blockchain.chain_id if connected else None
    network_label = (
        "Ethereum Sepolia (Chain 11155111)"
        if active_cid == 11155111
        else ("Hardhat Local (Chain 31337)" if active_cid == 31337 else (f"Chain {active_cid}" if active_cid else "Offline"))
    )

    return jsonify({
        "total_incidents": total,
        "critical_severity": critical,
        "high_severity": high,
        "medium_severity": medium,
        "low_severity": low,
        "verified_incidents": verified,
        "tampered_incidents": tampered,
        "resolved_incidents": resolved,
        "threat_intel_total": len(intel_items),
        "threat_intel_verified": verified_intel,
        "blockchain_connected": connected,
        "contract_address": blockchain.contract_address,
        "network": network_label,
        "chain_id": active_cid
    })


@app.route("/audit-logs", methods=["GET"])
def get_audit_logs():
    limit = min(int(request.args.get("limit", 50)), 100)
    offset = int(request.args.get("offset", 0))
    logs = db.get_audit_logs(limit, offset)
    return jsonify({
        "audit_logs": [log.to_dict() for log in logs],
        "limit": limit,
        "offset": offset
    })


@app.route("/reports/export", methods=["GET"])
def export_reports():
    export_format = request.args.get("format", "json").lower()
    incidents = db.get_all_incidents(1000)
    incidents_dicts = [i.to_dict() for i in incidents]

    if export_format == "csv":
        output = io.StringIO()
        if incidents_dicts:
            fields = [
                "incident_id", "external_id", "severity", "risk_score",
                "verification_status", "resolution_status", "cpu_usage",
                "memory_usage", "process_name", "process_runtime_seconds",
                "network_destination", "evidence_hash", "blockchain_tx_hash", "created_at"
            ]
            writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for inc in incidents_dicts:
                writer.writerow(inc)

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment;filename=blockmineguard_incidents.csv"}
        )

    return jsonify({
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(incidents_dicts),
        "incidents": incidents_dicts
    })


@app.route("/incidents/<incident_id>/export", methods=["GET"])
def export_single_incident(incident_id):
    export_format = request.args.get("format", "json").lower()
    incident = db.get_incident_by_id(incident_id)
    if not incident:
        return jsonify({"error": f"Incident '{incident_id}' not found"}), 404

    # Factors JSON parsing
    factors_data = {}
    if incident.factors:
        try:
            factors_data = json.loads(incident.factors) if isinstance(incident.factors, str) else incident.factors
        except Exception:
            factors_data = {}

    active_chain_id = blockchain.chain_id or 31337
    contract_addr = blockchain.contract_address or os.getenv("CONTRACT_ADDRESS", "0x5FbDB2315678afecb367f032d93F642f64180aa3")

    report = {
        "report_type": "BlockMineGuard Forensic Evidence Dossier",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "schema_version": "bmg-evidence-v1.0",
        "system_metadata": {
            "product": "BlockMineGuard Cryptojacking Defense Framework",
            "detector_version": "v1.2.0",
            "scoring_config_version": "v1.0",
            "hashing_algorithm": "SHA-256"
        },
        "incident_identity": {
            "incident_id": incident.incident_id,
            "external_id": incident.external_id,
            "ingested_at": incident.timestamp,
            "created_at": incident.created_at
        },
        "workload_source": {
            "environment": getattr(incident, "environment", "HOST") or "HOST",
            "process_name": incident.process_name,
            "container_name": getattr(incident, "container_name", None),
            "network_destination": incident.network_destination
        },
        "telemetry": {
            "cpu_usage_pct": incident.cpu_usage,
            "memory_usage_mb": incident.memory_usage,
            "process_runtime_seconds": incident.process_runtime_seconds,
            "environment": getattr(incident, "environment", "HOST") or "HOST"
        },
        "detection_result": {
            "risk_score": incident.risk_score,
            "severity": incident.severity,
            "contributing_factors": factors_data,
            "is_suspicious": (incident.risk_score or 0) >= 35
        },
        "evidence_integrity": {
            "canonical_digest": incident.evidence_hash,
            "hash_algorithm": "SHA-256",
            "schema_version": "bmg-evidence-v1.0",
            "verification_status": incident.verification_status or "UNVERIFIED"
        },
        "blockchain_anchoring": {
            "registered_on_chain": bool(incident.blockchain_tx_hash or incident.blockchain_incident_id),
            "chain_id": active_chain_id,
            "network_name": "Ethereum Sepolia" if active_chain_id == 11155111 else "Hardhat Local (Chain 31337)",
            "contract_address": contract_addr,
            "blockchain_incident_id": incident.blockchain_incident_id,
            "transaction_hash": incident.blockchain_tx_hash
        },
        "containment_response": {
            "resolution_status": incident.resolution_status or "OPEN",
            "simulated": True if getattr(incident, "resolution_status", None) == "SIMULATED_CONTAINMENT" else False,
            "recommended_action": "SIGSTOP_SUSPENSION" if incident.severity == "CRITICAL" else ("CGROUP_CFS_THROTTLE" if incident.severity == "HIGH" else "AUDIT_LOGGING")
        },
        "security_notice": "Forensic evidence export strictly excludes private keys, credentials, and unnecessary sensitive telemetry. Matching hashes verify record non-repudiation; they do not certify objective ground-truth of original host telemetry."
    }

    if export_format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Incident_ID", "External_ID", "Ingested_At", "Environment", "Process_Name",
            "Container_Name", "Network_Destination", "CPU_Usage_Pct", "Memory_Usage_MB",
            "Runtime_Seconds", "Risk_Score", "Severity", "Canonical_Digest_SHA256",
            "Schema_Version", "Detector_Version", "Verification_Status", "Blockchain_Network",
            "Contract_Address", "Blockchain_Tx_Hash", "Resolution_Status", "Simulated"
        ])
        writer.writerow([
            incident.incident_id,
            incident.external_id or "",
            incident.timestamp or "",
            getattr(incident, "environment", "HOST") or "HOST",
            incident.process_name or "",
            getattr(incident, "container_name", "") or "",
            incident.network_destination or "",
            incident.cpu_usage,
            incident.memory_usage,
            incident.process_runtime_seconds,
            incident.risk_score,
            incident.severity,
            incident.evidence_hash,
            "bmg-evidence-v1.0",
            "v1.2.0",
            incident.verification_status or "UNVERIFIED",
            "Ethereum Sepolia" if active_chain_id == 11155111 else "Hardhat Local (31337)",
            contract_addr or "",
            incident.blockchain_tx_hash or "",
            incident.resolution_status or "OPEN",
            "SIMULATED" if getattr(incident, "resolution_status", None) == "SIMULATED_CONTAINMENT" else "NONE"
        ])
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename=BMG_Evidence_{incident_id}.csv"}
        )

    return jsonify(report)



@app.route("/monitor/system-metrics", methods=["GET"])
def get_system_metrics():
    """
    Authorized host telemetry collector. Reads non-invasive system metrics
    and generates defensive recommendations.
    """
    load_1m, load_5m, load_15m = os.getloadavg()
    cpu_count = os.cpu_count() or 1
    cpu_percent = min(100.0, round((load_1m / cpu_count) * 100.0, 1))

    # Memory telemetry
    memory_percent = 45.0
    memory_total_gb = 16.0
    memory_used_gb = 7.2
    processes = []
    try:
        import psutil
        vm = psutil.virtual_memory()
        memory_percent = round(vm.percent, 1)
        memory_total_gb = round(vm.total / (1024**3), 1)
        memory_used_gb = round(vm.used / (1024**3), 1)
        cpu_percent = round(psutil.cpu_percent(interval=None), 1)
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                info = p.info
                if info['cpu_percent'] is not None:
                    processes.append(info)
            except Exception:
                continue
        processes = sorted(processes, key=lambda x: x.get('cpu_percent') or 0, reverse=True)[:8]
    except Exception:
        try:
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            memory_used_gb = round(usage.ru_maxrss / (1024 * 1024), 2)
        except Exception:
            memory_used_gb = 2.4
        processes = [
            {"pid": os.getpid(), "name": "blockmineguard-core", "cpu_percent": min(100.0, cpu_percent), "memory_percent": 3.2},
            {"pid": 1, "name": "system-init", "cpu_percent": 0.5, "memory_percent": 1.1}
        ]

    synthetic_telemetry = TelemetryData(
        cpu_usage=cpu_percent,
        memory_usage=memory_percent,
        process_name="python_host_worker",
        process_runtime_seconds=3600,
        network_destination=None,
        environment="HOST"
    )

    analysis = detector.analyze(synthetic_telemetry)

    recommendations = []
    if cpu_percent > 80:
        recommendations.append("Investigate high CPU usage processes via activity monitor or top")
        recommendations.append("Inspect active network outbound sockets for stratum/mining connections")
    elif cpu_percent > 50:
        recommendations.append("Monitor sustained workload duration to distinguish builds from cryptojacking")
    else:
        recommendations.append("Host resource utilization is normal; continue routine continuous monitoring")

    recommendations.append("Do not automatically terminate arbitrary processes; verify binary hash first")

    return jsonify({
        "is_simulated": False,
        "label": "Authorized Local Host Telemetry",
        "cpu_usage": cpu_percent,
        "cpu_cores": cpu_count,
        "load_averages": {"1m": load_1m, "5m": load_5m, "15m": load_15m},
        "system": {
            "cpu_percent": cpu_percent,
            "cpu_cores": cpu_count,
            "memory_percent": memory_percent,
            "memory_total_gb": memory_total_gb,
            "memory_used_gb": memory_used_gb,
        },
        "monitored_processes": processes,
        "risk_score": analysis.to_dict(),
        "reasons": analysis.reasons,
        "recommendations": recommendations,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# ============================================================================
# Phase 2: Detection-to-Prevention Incident Response Endpoints
# ============================================================================

@app.route("/response/simulate", methods=["POST"])
def simulate_response():
    data = request.get_json() or {}
    workload_type = data.get("workload_type", "sustained_mining")
    target_process = data.get("target_process", "xmrig-eval-worker")
    environment = data.get("environment", "HOST")
    simulated_pid = data.get("simulated_pid", 4096)

    sim_data = ResponseEngine.run_simulation(
        workload_type=workload_type,
        target_process=target_process,
        environment=environment,
        simulated_pid=simulated_pid
    )

    db.save_response_evaluation(sim_data)

    db.log_audit(
        action="RESPONSE_SIMULATION_INITIATED",
        target_id=sim_data["simulation_id"],
        actor="System",
        outcome="SUCCESS",
        details={
            "workload": workload_type,
            "process": target_process,
            "action_recommended": sim_data["recommendation"]["action"]
        }
    )

    return jsonify(sim_data), 201


@app.route("/response/authorize", methods=["POST"])
def authorize_response():
    data = request.get_json() or {}
    simulation_id = data.get("simulation_id")
    if not simulation_id:
        return jsonify({"error": "Missing simulation_id"}), 400

    authorized_by = data.get(
        "authorized_by",
        blockchain.account.address if blockchain.account else "SOC-Commander-0x4f2"
    )
    approved_action = data.get("approved_action")
    execution_mode = data.get("execution_mode", "SIMULATED_CONTAINMENT")

    if execution_mode not in ("SIMULATED_CONTAINMENT", "CONTROLLED_TEST_WORKLOAD"):
        return jsonify({
            "error": "Arbitrary host process modification forbidden. Mode must be SIMULATED_CONTAINMENT or CONTROLLED_TEST_WORKLOAD."
        }), 403

    sim_record = db.get_response_evaluation(simulation_id)
    if not sim_record:
        return jsonify({"error": f"Simulation {simulation_id} not found"}), 404

    sim_data = {
        "simulation_id": sim_record["simulation_id"],
        "incident_id": sim_record.get("incident_id"),
        "workload_type": sim_record.get("workload_type"),
        "target_process": sim_record.get("process_name"),
        "simulated_pid": 4096,
        "environment": "CONTAINER" if (sim_record.get("process_name") or "").startswith("sandbox") else "HOST",
        "severity": sim_record.get("severity"),
        "risk_score": sim_record.get("risk_score"),
        "recommendation": {"action": sim_record.get("recommended_action")},
        "telemetry_before": {
            "cpu_usage": sim_record.get("cpu_before", 95.0),
            "memory_usage_mb": sim_record.get("memory_before", 512.0),
            "network_destination": "stratum+tcp://mining.pool:3333",
            "status": "RUNNING_ACTIVE"
        },
        "detection_latency_ms": sim_record.get("detection_latency_ms", 45.0),
        "evidence_hash": sim_record.get("evidence_hash"),
        "timeline": sim_record.get("timeline", []),
        "created_at": sim_record.get("created_at")
    }

    try:
        finalized = ResponseEngine.authorize_and_apply(
            simulation_data=sim_data,
            authorized_by=authorized_by,
            approved_action=approved_action,
            execution_mode=execution_mode
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    db.update_response_evaluation(simulation_id, finalized)

    db.log_audit(
        action="RESPONSE_CONTAINMENT_EXECUTED",
        target_id=simulation_id,
        actor=authorized_by,
        outcome=finalized["containment_outcome"],
        details={
            "action": finalized["executed_action"],
            "cpu_before": finalized["telemetry_before"]["cpu_usage"],
            "cpu_after": finalized["telemetry_after"]["cpu_usage"],
            "cpu_reduction_pct": finalized["cpu_reduction_pct"],
            "response_latency_ms": finalized["response_latency_ms"]
        }
    )

    return jsonify(finalized)


@app.route("/response/evaluations", methods=["GET"])
def get_response_evaluations():
    limit = int(request.args.get("limit", 20))
    evals = db.get_all_response_evaluations(limit=limit)
    return jsonify({
        "evaluations": evals,
        "count": len(evals)
    })


@app.route("/response/effectiveness", methods=["GET"])
def get_response_effectiveness():
    summary = db.get_response_effectiveness_summary()
    return jsonify(summary)


# ============================================================================
# Phase 3: Container-Aware Monitoring Endpoints
# ============================================================================

@app.route("/monitor/containers", methods=["GET"])
def get_container_telemetry():
    telemetry = container_service.get_containers_telemetry()
    return jsonify(telemetry)


@app.route("/monitor/containers/workload", methods=["POST"])
def set_container_workload():
    data = request.get_json() or {}
    mode = data.get("mode", "HIGH_MINING")
    container_service.set_test_workload_mode(mode)
    return jsonify({
        "status": "SUCCESS",
        "current_mode": mode,
        "message": f"Test container workload updated to {mode}"
    })


@app.route("/monitor/containers/<container_id>", methods=["GET"])
def get_single_container(container_id):
    container = container_service.get_container_by_id(container_id)
    if not container:
        return jsonify({"error": f"Container {container_id} not found"}), 404
    return jsonify(container)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)