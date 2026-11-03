"""
Unit and Integration Tests for Phase 5: Privacy-Preserving Evidence Integrity.
"""

import pytest
import json
import uuid
from evidence import EvidenceHasher
from database.models import IncidentRecord
from app import app, db


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestEvidenceIntegrity:
    def test_canonical_serialization_determinism(self):
        data_a = {
            "incident_id": "INC-TEST-01",
            "cpu_usage": 94.5,
            "memory_usage": 512.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 120,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        data_b = {
            "factors": ["HIGH_CPU"],
            "severity": "critical",
            "process_runtime_seconds": "120",
            "process_name": "xmrig",
            "memory_usage": "512.0",
            "cpu_usage": "94.5",
            "incident_id": "INC-TEST-01"
        }

        hash_a = EvidenceHasher.hash_dict(data_a)
        hash_b = EvidenceHasher.hash_dict(data_b)
        assert hash_a == hash_b
        assert len(hash_a) == 64

    def test_versioned_evidence_determinism(self):
        base_data = {
            "incident_id": "INC-V1-001",
            "timestamp": "2026-10-25T01:00:00Z",
            "cpu_usage": 98.2,
            "memory_usage": 450.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 1200,
            "severity": "CRITICAL",
            "risk_score": 96
        }
        v1 = EvidenceHasher.build_versioned_evidence(base_data)
        v2 = EvidenceHasher.build_versioned_evidence(dict(base_data))

        assert v1["schema_version"] == "bmg-evidence-v1.0"
        assert v1["detector_version"] == "v1.2.0"
        assert v1["scoring_config_version"] == "v1.0"
        assert v1["hash_algorithm"] == "SHA-256"

        hash_v1 = EvidenceHasher.hash_dict(v1)
        hash_v2 = EvidenceHasher.hash_dict(v2)
        assert hash_v1 == hash_v2

    def test_altered_timestamp_divergence(self):
        base = {
            "incident_id": "INC-TIME-001",
            "timestamp": "2026-10-25T01:00:00Z",
            "cpu_usage": 95.0,
            "memory_usage": 200.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 500,
            "risk_score": 90,
            "severity": "CRITICAL"
        }
        altered_time = dict(base)
        altered_time["timestamp"] = "2026-10-25T01:00:01Z"

        hash_orig = EvidenceHasher.hash_dict(base)
        hash_altered = EvidenceHasher.hash_dict(altered_time)
        assert hash_orig != hash_altered

    def test_altered_field_divergence(self):
        base = {
            "incident_id": "INC-DIFF-001",
            "timestamp": "2026-10-25T01:00:00Z",
            "cpu_usage": 95.0,
            "memory_usage": 200.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 500,
            "risk_score": 90,
            "severity": "CRITICAL"
        }
        # Alter CPU
        tampered_cpu = dict(base, cpu_usage=94.9)
        assert EvidenceHasher.hash_dict(base) != EvidenceHasher.hash_dict(tampered_cpu)

        # Alter process name
        tampered_proc = dict(base, process_name="miner")
        assert EvidenceHasher.hash_dict(base) != EvidenceHasher.hash_dict(tampered_proc)

    def test_altered_version_metadata_divergence(self):
        base = {
            "incident_id": "INC-VER-001",
            "timestamp": "2026-10-25T01:00:00Z",
            "cpu_usage": 90.0,
            "memory_usage": 180.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 300,
            "risk_score": 85,
            "severity": "CRITICAL"
        }
        v1 = EvidenceHasher.build_versioned_evidence(base, detector_version="v1.2.0")
        v2 = EvidenceHasher.build_versioned_evidence(base, detector_version="v2.0.0")
        v3 = EvidenceHasher.build_versioned_evidence(base, schema_version="bmg-evidence-v2.0")

        assert EvidenceHasher.hash_dict(v1) != EvidenceHasher.hash_dict(v2)
        assert EvidenceHasher.hash_dict(v1) != EvidenceHasher.hash_dict(v3)

    def test_invalid_and_malformed_evidence_inputs(self):
        # Non-dictionary input raises ValueError
        with pytest.raises(ValueError):
            EvidenceHasher.normalize_dict("not-a-dict")

        with pytest.raises(ValueError):
            EvidenceHasher.normalize_dict([1, 2, 3])

        # Clean hex handles non-string and None inputs safely
        assert EvidenceHasher.clean_hex(None) == ""
        assert EvidenceHasher.clean_hex("0xABCDEF") == "abcdef"
        assert EvidenceHasher.clean_hex(b"\xde\xad\xbe\xef") == "deadbeef"

    def test_tamper_detection_mismatch_outcome(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-TAMPER-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 92.0,
            "memory_usage": 256.0,
            "process_name": f"miner-{uid}",
            "process_runtime_seconds": 60,
            "network_destination": "pool.mine.org:3333",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 90,
            "severity": "CRITICAL",
            "factors": ["HIGH_CPU"]
        }
        legit_hash = EvidenceHasher.hash_dict(legit_evidence)

        inc_record = IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-T-{uid}",
            evidence_hash=legit_hash,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=92.0,
            memory_usage=256.0,
            process_name=f"miner-{uid}",
            process_runtime_seconds=60,
            network_destination="pool.mine.org:3333",
            risk_score=90,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"])
        )
        db.create_incident(inc_record)

        # Alter evidence
        tampered_evidence = dict(legit_evidence)
        tampered_evidence["cpu_usage"] = 15.0

        res_tamper = client.post(f"/incidents/{inc_id}/verify", json={
            "evidence": tampered_evidence
        })
        assert res_tamper.status_code == 200
        data_t = res_tamper.get_json()
        assert data_t["verification_result"] == "TAMPERED"
        assert data_t["outcome"] == "TAMPERED_HASH_MISMATCH"
        assert data_t["evidence_match"] is False
        assert "Off-chain evidence altered" in data_t["details"]

    def test_missing_evidence_taxonomy_outcome(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-MISSING-{uid}"
        inc_record = IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-M-{uid}",
            evidence_hash=f"hash-{uid}-00000000000000000000000000000000000000000000000000",
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=85.0,
            memory_usage=256.0,
            process_name="miner",
            process_runtime_seconds=60,
            risk_score=85,
            severity="CRITICAL",
            factors=json.dumps(["HIGH_CPU"])
        )
        db.create_incident(inc_record)

        # Verify with empty evidence dict
        res_empty = client.post(f"/incidents/{inc_id}/verify", json={"evidence": {}})
        assert res_empty.status_code == 400
        data_e = res_empty.get_json()
        assert data_e["verification_result"] == "EVIDENCE_MISSING"

    def test_verification_history_audit_trail(self, client):
        uid = uuid.uuid4().hex[:8]
        inc_id = f"INC-HIST-{uid}"
        legit_evidence = {
            "incident_id": inc_id,
            "timestamp": "2026-10-12T00:00:00Z",
            "cpu_usage": 80.0,
            "memory_usage": 200.0,
            "process_name": f"worker-{uid}",
            "process_runtime_seconds": 50,
            "network_destination": "1.2.3.4:80",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 60,
            "severity": "HIGH",
            "factors": ["CPU_SPIKE"]
        }
        h = EvidenceHasher.hash_dict(legit_evidence)
        db.create_incident(IncidentRecord(
            incident_id=inc_id,
            external_id=f"EXT-H-{uid}",
            evidence_hash=h,
            timestamp="2026-10-12T00:00:00Z",
            cpu_usage=80.0,
            memory_usage=200.0,
            process_name=f"worker-{uid}",
            process_runtime_seconds=50,
            network_destination="1.2.3.4:80",
            risk_score=60,
            severity="HIGH",
            factors=json.dumps(["CPU_SPIKE"])
        ))

        # Perform a verification
        client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})

        # Fetch history
        res_hist = client.get(f"/incidents/{inc_id}/verification-history")
        assert res_hist.status_code == 200
        hist_data = res_hist.get_json()
        assert hist_data["count"] >= 1
        assert hist_data["history"][0]["incident_id"] == inc_id

        # Global history
        res_glob = client.get("/verification/history")
        assert res_glob.status_code == 200
        assert res_glob.get_json()["count"] >= 1
