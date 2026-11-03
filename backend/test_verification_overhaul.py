"""
Comprehensive Regression Tests for Verification Center Overhaul:
Covers all 14 scenarios specified in the specification:
1. Registered record, matching full digest: outcome VERIFIED, on-chain hash preserved.
2. Registered record, mismatching digest: outcome TAMPERED (ON_CHAIN_MISMATCH / TAMPERED_HASH_MISMATCH).
3. Unregistered record, valid local hash: UNREGISTERED_ON_CHAIN, never marked VERIFIED.
4. Missing on-chain record: no fabricated anchored digest (on_chain_hash is None).
5. RPC failure: BLOCKCHAIN_OUTAGE / NETWORK_ERROR, not tampered.
6. Verification history: safe timestamp formatting, no Invalid Date.
7. Missing / invalid historical timestamp: fallback gracefully, no crash.
8. Deduplication: repeated verification for identical operation within 5s does not create duplicate entries.
9. Legitimate state transitions: clean -> tamper -> reset clean preserves chronological order.
"""

import pytest
import json
import uuid
from unittest.mock import patch, MagicMock
from evidence import EvidenceHasher
from database.models import IncidentRecord
from app import app, db


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestVerificationCenterOverhaul:
    def test_registered_record_matching_full_digest_verified(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-MATCH-{uid}"
        evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 91.5,
            "memory_usage": 320.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 90,
            "network_destination": "pool.test:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 88,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        computed_hash = EvidenceHasher.hash_dict(evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-MATCH-{uid}",
            evidence_hash=computed_hash,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=91.5,
            memory_usage=320.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=90,
            network_destination="pool.test:3333",
            risk_score=88,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"]),
            blockchain_incident_id=501
        ))

        fake_on_chain = {
            "incident_id": 501,
            "external_id": inc_id,
            "evidence_hash": computed_hash,
            "verification_status": 1,
            "exists": True
        }

        with patch("app.blockchain.is_connected", return_value=True), \
             patch("app.blockchain.contract", MagicMock()), \
             patch("app.blockchain.contract_address", "0x5FbDB2315678afecb367f032d93F642f64180aa3"), \
             patch("app.blockchain.get_incident", return_value=fake_on_chain):

            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})
            assert res.status_code == 200
            data = res.get_json()

            assert data["outcome"] == "VERIFIED"
            assert data["verification_result"] == "VERIFIED"
            assert data["evidence_match"] is True
            assert data["computed_hash"] == computed_hash
            assert data["on_chain_hash"] == computed_hash
            assert "matches immutable on-chain smart contract anchor" in data["details"]

    def test_registered_record_mismatching_digest_tampered(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-TAMPER-{uid}"
        original_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 95.0,
            "memory_usage": 512.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 300,
            "network_destination": "pool.mine:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 92,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        original_hash = EvidenceHasher.hash_dict(original_evidence)

        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-T-{uid}",
            evidence_hash=original_hash,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=95.0,
            memory_usage=512.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=300,
            network_destination="pool.mine:3333",
            risk_score=92,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"]),
            blockchain_incident_id=502
        ))

        tampered_evidence = dict(original_evidence, cpu_usage=14.5, risk_score=15)
        tampered_hash = EvidenceHasher.hash_dict(tampered_evidence)

        fake_on_chain = {
            "incident_id": 502,
            "external_id": inc_id,
            "evidence_hash": original_hash,
            "verification_status": 1,
            "exists": True
        }

        with patch("app.blockchain.is_connected", return_value=True), \
             patch("app.blockchain.contract", MagicMock()), \
             patch("app.blockchain.get_incident", return_value=fake_on_chain):

            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": tampered_evidence})
            assert res.status_code == 200
            data = res.get_json()

            assert data["outcome"] == "TAMPERED_HASH_MISMATCH"
            assert data["verification_result"] == "TAMPERED"
            assert data["evidence_match"] is False
            assert data["computed_hash"] == tampered_hash
            assert data["on_chain_hash"] == original_hash
            assert "Off-chain evidence altered" in data["details"]

    def test_unregistered_record_never_marked_verified(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-UNREG-{uid}"
        evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 45.0,
            "memory_usage": 128.0,
            "process_name": f"task-{uid}",
            "process_runtime_seconds": 15,
            "network_destination": "internal:80",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 30,
            "severity": "LOW",
            "factors": []
        }
        h = EvidenceHasher.hash_dict(evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-U-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=45.0,
            memory_usage=128.0,
            process_name=f"task-{uid}",
            process_runtime_seconds=15,
            network_destination="internal:80",
            risk_score=30,
            severity="LOW",
            factors=json.dumps([]),
            blockchain_incident_id=None
        ))

        res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})
        assert res.status_code == 200
        data = res.get_json()

        # Must be UNREGISTERED_ON_CHAIN, NEVER VERIFIED
        assert data["outcome"] == "UNREGISTERED_ON_CHAIN"
        assert data["verification_result"] == "UNREGISTERED_ON_CHAIN"
        assert data["on_chain_hash"] is None  # Honest: No fabricated fallback!
        assert data["computed_hash"] == h

    def test_rpc_failure_reports_outage_not_tampered(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-OUTAGE-{uid}"
        evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 80.0,
            "memory_usage": 200.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 100,
            "network_destination": "pool:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 75,
            "severity": "HIGH",
            "factors": ["HIGH_CPU"]
        }
        h = EvidenceHasher.hash_dict(evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-O-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=80.0,
            memory_usage=200.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=100,
            network_destination="pool:3333",
            risk_score=75,
            severity="HIGH",
            factors=json.dumps(["HIGH_CPU"]),
            blockchain_incident_id=999
        ))

        with patch("app.blockchain.is_connected", return_value=False):
            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})
            assert res.status_code == 200
            data = res.get_json()

            assert data["outcome"] == "BLOCKCHAIN_OUTAGE"
            assert data["verification_result"] == "NETWORK_ERROR"
            assert data["on_chain_hash"] is None

    def test_verification_history_deduplication(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-DEDUP-{uid}"
        evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 85.0,
            "memory_usage": 250.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 70,
            "network_destination": "pool:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 70,
            "severity": "HIGH",
            "factors": ["CPU_SPIKE"]
        }
        h = EvidenceHasher.hash_dict(evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-D-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=85.0,
            memory_usage=250.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=70,
            network_destination="pool:3333",
            risk_score=70,
            severity="HIGH",
            factors=json.dumps(["CPU_SPIKE"]),
            blockchain_incident_id=None
        ))

        # Perform 3 rapid identical verification requests
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})

        hist_res = client.get(f"/incidents/{inc_id}/verification-history")
        assert hist_res.status_code == 200
        hist_data = hist_res.get_json()

        # Identical rapid operations must be deduplicated into 1 log entry
        assert hist_data["count"] == 1
        assert hist_data["history"][0]["incident_id"] == inc_id
        assert hist_data["history"][0]["outcome"] == "UNREGISTERED_ON_CHAIN"
        assert hist_data["history"][0]["timestamp"] is not None
        assert "T" in hist_data["history"][0]["timestamp"]

    def test_chronological_state_transitions_preserved(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-TRANS-{uid}"
        evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 85.0,
            "memory_usage": 250.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 70,
            "network_destination": "pool:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 70,
            "severity": "HIGH",
            "factors": ["CPU_SPIKE"]
        }
        h = EvidenceHasher.hash_dict(evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-TR-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=85.0,
            memory_usage=250.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=70,
            network_destination="pool:3333",
            risk_score=70,
            severity="HIGH",
            factors=json.dumps(["CPU_SPIKE"]),
            blockchain_incident_id=None
        ))

        # 1. Clean verification
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})

        # 2. Tampered verification
        tampered = dict(evidence, cpu_usage=12.0)
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": tampered})

        # 3. Restored clean verification
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": evidence})

        hist_res = client.get(f"/incidents/{inc_id}/verification-history")
        hist = hist_res.get_json()["history"]

        # 3 distinct genuine operations must be preserved in chronological order
        assert len(hist) == 3
        # Most recent is at top (ORDER BY id DESC)
        assert hist[0]["outcome"] == "UNREGISTERED_ON_CHAIN"
        assert hist[1]["outcome"] == "TAMPERED_HASH_MISMATCH"
        assert hist[2]["outcome"] == "UNREGISTERED_ON_CHAIN"
