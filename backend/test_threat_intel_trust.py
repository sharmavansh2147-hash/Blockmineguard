"""
Unit and Integration Tests for Phase 4: Trustworthy Threat Intelligence.
"""

import pytest
import uuid
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestTrustworthyThreatIntel:
    def test_duplicate_submission_prevention(self, client):
        uid = uuid.uuid4().hex[:8]
        ind = f"185.193.{uid[:3]}.{uid[3:6]}"
        # 1. First submission
        res1 = client.post("/threat-intelligence", json={
            "indicator": ind,
            "indicator_type": "IP_ADDRESS",
            "description": "Known Monero ocean stratum proxy node",
            "campaign_id": f"CAMP-{uid}",
            "reporter_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        })
        assert res1.status_code == 201

        # 2. Duplicate submission must be rejected with 409
        res2 = client.post("/threat-intelligence", json={
            "indicator": ind,
            "indicator_type": "IP_ADDRESS",
            "description": "Attempted duplicate report",
            "campaign_id": f"CAMP-{uid}",
            "reporter_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        })
        assert res2.status_code == 409
        assert "already registered" in res2.get_json()["error"]

    def test_conflicting_report_detection(self, client):
        uid = uuid.uuid4().hex[:8]
        ind = f"stratum-conflict-{uid}.pool.org"
        # Submit indicator as POOL_DOMAIN
        res_first = client.post("/threat-intelligence", json={
            "indicator": ind,
            "indicator_type": "POOL_DOMAIN",
            "description": "Mining pool hostname",
            "campaign_id": "CAMP-XMR-A",
            "reporter_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
        })
        assert res_first.status_code == 201

        # Submit conflicting type or contradictory campaign
        res_conflict = client.post("/threat-intelligence", json={
            "indicator": ind,
            "indicator_type": "WALLET_ADDRESS",  # Contradicts POOL_DOMAIN!
            "description": "Misclassified indicator",
            "campaign_id": "CAMP-XMR-B",
            "reporter_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
        })
        assert res_conflict.status_code == 201
        data = res_conflict.get_json()
        assert data["status"] == "DISPUTED"
        assert data["conflict_detected"] is True
        assert "Conflict" in data["conflict_details"]

    def test_deliberately_poisoned_synthetic_report_rejection(self, client):
        uid = uuid.uuid4().hex[:8]
        # Submit synthetic poisoned benign indicator
        res = client.post("/threat-intelligence", json={
            "indicator": f"test-benign-dns-{uid}.local",
            "indicator_type": "IP_ADDRESS",
            "description": "Poisoning attempt against benign local resolver",
            "campaign_id": "CAMP-POISON-01",
            "reporter_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
        })
        assert res.status_code == 201
        data = res.get_json()
        assert data["status"] == "REJECTED"
        assert data["confidence_score"] == 0
        assert data["blockchain_tx"] is None

    def test_reviewer_workflow_and_reputation_adjustment(self, client):
        uid = uuid.uuid4().hex[:8]
        ind = f"academic-pool-{uid}.org"
        # 1. Submit report
        res_sub = client.post("/threat-intelligence", json={
            "indicator": ind,
            "indicator_type": "POOL_DOMAIN",
            "description": "Verified research pool indicator",
            "campaign_id": "CAMP-ACADEMIC-01",
            "reporter_address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"
        })
        assert res_sub.status_code == 201
        intel_id = res_sub.get_json()["intel_id"]

        # 2. Reviewer approves
        res_review = client.post(f"/threat-intelligence/{intel_id}/review", json={
            "status": "VERIFIED",
            "reviewer_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "review_notes": "Confirmed against passive DNS logs",
            "confidence_score": 95
        })
        assert res_review.status_code == 200
        review_data = res_review.get_json()
        assert review_data["status"] == "VERIFIED"
        assert review_data["verified"] is True
        assert review_data["confidence_score"] == 95

        # 3. Query with status filter
        res_list = client.get("/threat-intelligence?status=VERIFIED")
        assert res_list.status_code == 200
        verified_items = res_list.get_json()["threat_intelligence"]
        assert any(item["intel_id"] == intel_id for item in verified_items)
