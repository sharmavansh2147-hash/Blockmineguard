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
        with patch("app.blockchain.verify_incident", side_effect=Exception("Connection refused / RPC Timeout")):
            res = client.post(f"/incidents/{inc_id}/verify", json={"evidence": legit_evidence})
            assert res.status_code == 200
            data = res.get_json()
            assert data["outcome"] == "BLOCKCHAIN_OUTAGE"
            assert "Connection refused" in data["details"]
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
