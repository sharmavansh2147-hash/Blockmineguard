"""
Reliability and Outage Failure Mode Tests for BlockMineGuard.
"""

import pytest
import uuid
import json
from unittest.mock import patch, MagicMock
from database.models import IncidentRecord
from evidence import EvidenceHasher
from app import app, db


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
    with db._get_connection() as conn:
        conn.cursor().execute("DELETE FROM incidents WHERE incident_id LIKE 'INC-TEST-%' OR incident_id LIKE 'INC-RPC-OUTAGE-%' OR incident_id LIKE 'INC-UNREG-%' OR incident_id LIKE 'INC-RETRY-%' OR incident_id LIKE 'INC-TAMPER-%' OR incident_id LIKE 'INC-MISSING-%' OR incident_id LIKE 'INC-HIST-%' OR incident_id LIKE 'INC-REVERT-%' OR incident_id LIKE 'INC-EXP-%' OR incident_id LIKE 'INC-CSV-%'")
        conn.cursor().execute("DELETE FROM verification_history WHERE incident_id LIKE 'INC-TEST-%' OR incident_id LIKE 'INC-RPC-OUTAGE-%' OR incident_id LIKE 'INC-UNREG-%' OR incident_id LIKE 'INC-RETRY-%' OR incident_id LIKE 'INC-TAMPER-%' OR incident_id LIKE 'INC-MISSING-%' OR incident_id LIKE 'INC-HIST-%' OR incident_id LIKE 'INC-REVERT-%' OR incident_id LIKE 'INC-EXP-%' OR incident_id LIKE 'INC-CSV-%'")
        conn.commit()


class TestOutagesAndReliability:
    def test_blockchain_outage_graceful_fallback(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-RPC-OUTAGE-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 88.0,
            "memory_usage": 300.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 90,
            "network_destination": "pool.test:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 85,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-OUTAGE-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=88.0,
            memory_usage=300.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=90,
            network_destination="pool.test:3333",
            risk_score=85,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"]),
            blockchain_incident_id=999999  # Non-existent or RPC error trigger
        ))

        # Simulate RPC failure or contract revert
        fake_rec = {"incident_id": 999999, "evidence_hash": h, "verification_status": 0, "exists": True}
        with patch("app.blockchain.is_connected", return_value=True), \
             patch("app.blockchain.contract", MagicMock()), \
             patch("app._fetch_or_sync_on_chain_incident", return_value=(fake_rec, None)), \
             patch("app.blockchain.verify_incident", side_effect=Exception("Connection refused / RPC Timeout")):
            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
            assert res.status_code == 200
            data = res.get_json()
            assert data["outcome"] == "BLOCKCHAIN_OUTAGE"
            assert "Connection refused" in data["details"] or "unreachable" in data["details"].lower() or "rpc" in data["details"].lower()
            # Offline local cryptographic hash match is still preserved
            assert data["evidence_match"] is True

    def test_unregistered_on_chain_handling(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-UNREG-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 70.0,
            "memory_usage": 150.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 40,
            "network_destination": "10.0.0.1:80",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 60,
            "severity": "HIGH",
            "factors": ["CPU_SPIKE"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        # Create incident without blockchain_incident_id
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-UNREG-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=70.0,
            memory_usage=150.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=40,
            network_destination="10.0.0.1:80",
            risk_score=60,
            severity="HIGH",
            factors=json.dumps(["CPU_SPIKE"]),
            blockchain_incident_id=None
        ))

        res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
        assert res.status_code == 200
        data = res.get_json()
        assert data["outcome"] == "UNREGISTERED_ON_CHAIN"
        assert data["evidence_match"] is True

    def test_repeated_requests_and_safe_retry_idempotency(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-RETRY-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 82.0,
            "memory_usage": 220.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 45,
            "network_destination": "10.0.0.1:80",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 70,
            "severity": "HIGH",
            "factors": ["CPU_SPIKE"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-RETRY-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=82.0,
            memory_usage=220.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=45,
            network_destination="10.0.0.1:80",
            risk_score=70,
            severity="HIGH",
            factors=json.dumps(["CPU_SPIKE"]),
            blockchain_incident_id=None
        ))

        # First verify call
        res1 = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
        assert res1.status_code == 200

        # Second verify call (idempotent retry)
        res2 = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
        assert res2.status_code == 200
        assert res1.get_json()["computed_hash"] == res2.get_json()["computed_hash"]


class TestWorkloadInputValidationAndOutliers:
    def test_detect_empty_payload(self, client):
        res = client.post("/detect", json={})
        assert res.status_code == 400
        assert "No data provided" in res.get_json()["error"]

    def test_detect_invalid_field_types(self, client):
        # Non-numeric string for cpu_usage
        res = client.post("/detect", json={
            "cpu_usage": "not-a-number",
            "memory_usage": 20.0,
            "process_name": "test-proc"
        })
        assert res.status_code == 400
        assert "Invalid telemetry data" in res.get_json()["error"]

    def test_detect_out_of_range_cpu_values(self, client):
        # Negative CPU usage
        res_neg = client.post("/detect", json={
            "cpu_usage": -25.0,
            "memory_usage": 20.0,
            "process_name": "test-proc"
        })
        assert res_neg.status_code == 400
        assert "cpu_usage must be between 0.0 and 100.0" in res_neg.get_json()["error"]

        # CPU usage exceeding 100%
        res_high = client.post("/detect", json={
            "cpu_usage": 150.0,
            "memory_usage": 20.0,
            "process_name": "test-proc"
        })
        assert res_high.status_code == 400
        assert "cpu_usage must be between 0.0 and 100.0" in res_high.get_json()["error"]

    def test_detect_negative_runtime_and_memory(self, client):
        res_mem = client.post("/detect", json={
            "cpu_usage": 50.0,
            "memory_usage": -10.0,
            "process_name": "test-proc"
        })
        assert res_mem.status_code == 400
        assert "memory_usage cannot be negative" in res_mem.get_json()["error"]

        res_rt = client.post("/detect", json={
            "cpu_usage": 50.0,
            "memory_usage": 10.0,
            "process_name": "test-proc",
            "process_runtime_seconds": -500
        })
        assert res_rt.status_code == 400
        assert "process_runtime_seconds cannot be negative" in res_rt.get_json()["error"]

    def test_normal_vs_suspicious_detector_cases(self, client):
        # Normal case
        res_normal = client.post("/detect", json={
            "cpu_usage": 8.0,
            "memory_usage": 15.0,
            "process_name": "systemd-journald",
            "process_runtime_seconds": 60000,
            "environment": "HOST"
        })
        assert res_normal.status_code == 200
        data_n = res_normal.get_json()
        assert data_n["suspicious"] is False
        assert data_n["risk_score"]["severity"] == "LOW"
        assert data_n["risk_score"]["score"] < 35

        # Suspicious cryptominer case
        res_susp = client.post("/detect", json={
            "cpu_usage": 98.5,
            "memory_usage": 88.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 18000,
            "network_destination": "pool.supportxmr.com:3333",
            "environment": "HOST"
        })
        assert res_susp.status_code == 200
        data_s = res_susp.get_json()
        assert data_s["suspicious"] is True
        assert data_s["risk_score"]["severity"] == "CRITICAL"
        assert data_s["risk_score"]["score"] >= 80


class TestIncidentSubmissionAndDuplication:
    def test_duplicate_incident_submission_conflict(self, client):
        payload = {
            "cpu_usage": 96.0,
            "memory_usage": 75.0,
            "process_name": f"xmrig-dup-test-{uuid.uuid4().hex[:6]}",
            "process_runtime_seconds": 7200,
            "network_destination": "stratum.antpool.com:443",
            "environment": "HOST"
        }

        # First submission
        res1 = client.post("/incidents", json=payload)
        assert res1.status_code == 201

        # Check evidence hash in response
        data1 = res1.get_json()
        ev_hash = data1["evidence_hash"]
        existing = db.get_incident_by_hash(ev_hash)
        assert existing is not None
        assert existing.incident_id == data1["incident_id"]


class TestSystemReadinessChecker:
    def test_readiness_endpoint_all_components(self, client):
        res = client.get("/system/readiness")
        assert res.status_code == 200
        data = res.get_json()

        assert "overall_status" in data
        assert data["overall_status"] in ("READY", "DEGRADED", "UNAVAILABLE", "NOT_CONFIGURED")
        assert "components" in data
        assert "backend" in data["components"]
        assert "database" in data["components"]
        assert "detector" in data["components"]
        assert "blockchain_rpc" in data["components"]
        assert "smart_contract" in data["components"]

        # Backend, database, detector must be healthy in testing
        assert data["components"]["backend"]["status"] == "READY"
        assert data["components"]["database"]["status"] == "READY"
        assert data["components"]["detector"]["status"] == "READY"
        assert data["total_latency_ms"] >= 0.0

    def test_readiness_degraded_when_rpc_unreachable(self, client):
        with patch("app.blockchain.is_connected", return_value=False):
            res = client.get("/system/readiness")
            assert res.status_code == 200
            data = res.get_json()
            assert data["components"]["blockchain_rpc"]["status"] == "UNAVAILABLE"
            assert data["overall_status"] in ("DEGRADED", "UNAVAILABLE")


class TestDatabaseFailureResilience:
    def test_database_query_failure_graceful_handling(self, client):
        with patch("app.db.get_all_incidents", side_effect=Exception("SQLite I/O error or lock timeout")):
            res = client.get("/incidents")
            # Should handle database failure gracefully (500 with descriptive error message)
            assert res.status_code == 500
            data = res.get_json()
            assert "error" in data or "message" in data


class TestBlockchainNetworkAndContractFailureModes:
    def test_missing_contract_configuration_handling(self, client):
        with patch("app.blockchain.contract", None), patch("app.blockchain.contract_address", None):
            res = client.get("/system/readiness")
            assert res.status_code == 200
            data = res.get_json()
            assert data["components"]["smart_contract"]["status"] in ("NOT_CONFIGURED", "UNAVAILABLE")

    def test_transaction_reverted_graceful_catch(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-REVERT-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 90.0,
            "memory_usage": 300.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 120,
            "network_destination": "pool.test:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 85,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-REV-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=90.0,
            memory_usage=300.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=120,
            network_destination="pool.test:3333",
            container_name=None,
            environment="HOST",
            risk_score=85,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"]),
            blockchain_incident_id=123
        ))

        # Simulate on-chain revert
        with patch("app.blockchain.is_connected", return_value=True), \
             patch("app.blockchain.contract", MagicMock()), \
             patch("app._fetch_or_sync_on_chain_incident", side_effect=Exception("execution reverted: Unauthorized reporter")):
            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
            assert res.status_code == 200
            data = res.get_json()
            assert data["outcome"] == "BLOCKCHAIN_OUTAGE"
            assert "reverted" in data["details"] or "Unauthorized" in data["details"]


class TestIncidentEvidenceExport:
    def test_export_single_incident_json(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-EXP-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 95.0,
            "memory_usage": 320.0,
            "process_name": f"xmrig-{uid}",
            "process_runtime_seconds": 180,
            "network_destination": "pool.supportxmr.com:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 92,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU", "KNOWN_MINER"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-EXP-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=95.0,
            memory_usage=320.0,
            process_name=f"xmrig-{uid}",
            process_runtime_seconds=180,
            network_destination="pool.supportxmr.com:3333",
            container_name=None,
            environment="HOST",
            risk_score=92,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU", "KNOWN_MINER"])
        ))

        res = client.get(f"/incidents/{inc_id}/export?format=json")
        assert res.status_code == 200
        data = res.get_json()

        assert data["incident_identity"]["incident_id"] == inc_id
        assert data["telemetry"]["cpu_usage_pct"] == 95.0
        assert data["detection_result"]["severity"] == "CRITICAL"
        assert data["evidence_integrity"]["canonical_digest"] == h
        assert data["evidence_integrity"]["hash_algorithm"] == "SHA-256"
        assert data["evidence_integrity"]["schema_version"] == "bmg-evidence-v1.0"
        assert "security_notice" in data
        assert "private_key" not in json.dumps(data)

    def test_export_single_incident_csv(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-CSV-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 80.0,
            "memory_usage": 190.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 80,
            "network_destination": "pool.mine.org:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 75,
            "severity": "HIGH",
            "factors": ["HIGH_CPU"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-CSV-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=80.0,
            memory_usage=190.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=80,
            network_destination="pool.mine.org:3333",
            container_name=None,
            environment="HOST",
            risk_score=75,
            severity="HIGH",
            factors=json.dumps(["HIGH_CPU"])
        ))

        res = client.get(f"/incidents/{inc_id}/export?format=csv")
        assert res.status_code == 200
        assert "text/csv" in res.headers["Content-Type"]
        csv_text = res.get_data(as_text=True)
        assert inc_id in csv_text
        assert h in csv_text
        assert "Canonical_Digest_SHA256" in csv_text

    def test_export_nonexistent_incident_returns_404(self, client):
        res = client.get("/incidents/INC-DOES-NOT-EXIST-404/export")
        assert res.status_code == 404
        assert "not found" in res.get_json()["error"].lower()


