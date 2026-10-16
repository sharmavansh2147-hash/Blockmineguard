"""
Unit and Integration Tests for Phase 2: Detection-to-Prevention Evaluation.
"""

import pytest
import json
from prevention import ResponseEngine, ResponseTier
from database import Database
from app import app


@pytest.fixture
def test_db():
    db = Database(":memory:")
    yield db
    db.close()


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestResponseEngine:
    def test_tiered_recommendation_logic(self):
        # Critical severity (>=80 risk) -> suspend
        crit_rec = ResponseEngine.recommend("CRITICAL", 95)
        assert crit_rec["action"] == ResponseTier.CONTAIN_PROCESS_SUSPEND
        assert crit_rec["required_role"] == "INCIDENT_COMMANDER"
        assert crit_rec["authorization_required"] is True

        # High severity (60-79 risk) -> cgroup throttling
        high_rec = ResponseEngine.recommend("HIGH", 72)
        assert high_rec["action"] == ResponseTier.THROTTLE_CGRP_BANDWIDTH
        assert high_rec["required_role"] == "SOC_ANALYST"
        assert high_rec["authorization_required"] is True

        # Medium severity (35-59 risk) -> forensic telemetry probe
        med_rec = ResponseEngine.recommend("MEDIUM", 45)
        assert med_rec["action"] == ResponseTier.ENHANCED_TELEMETRY_WATCH

        # Low severity -> log and monitor
        low_rec = ResponseEngine.recommend("LOW", 15)
        assert low_rec["action"] == ResponseTier.LOG_AND_MONITOR
        assert low_rec["authorization_required"] is False

    def test_simulation_workflow_pending_authorization(self):
        sim = ResponseEngine.run_simulation(
            workload_type="sustained_mining",
            target_process="xmrig-test-worker",
            environment="HOST"
        )

        assert sim["simulation_id"].startswith("SIM-")
        assert sim["authorization_status"] == "PENDING_AUTHORIZATION"
        assert sim["telemetry_before"]["cpu_usage"] > 90.0
        assert sim["detection_latency_ms"] > 0
        assert len(sim["evidence_hash"]) == 64
        assert len(sim["timeline"]) >= 4

    def test_authorization_and_containment_measurement(self):
        sim = ResponseEngine.run_simulation(
            workload_type="sustained_mining",
            target_process="xmrig-test-worker"
        )

        finalized = ResponseEngine.authorize_and_apply(
            simulation_data=sim,
            authorized_by="0xTestCommanderAddress",
            approved_action=ResponseTier.CONTAIN_PROCESS_SUSPEND,
            execution_mode="SIMULATED_CONTAINMENT"
        )

        assert finalized["authorization_status"] == "AUTHORIZED"
        assert finalized["authorized_by"] == "0xTestCommanderAddress"
        assert finalized["containment_outcome"] == "SUCCESS"
        assert finalized["cpu_reduction_pct"] > 85.0
        assert finalized["telemetry_after"]["cpu_usage"] < 10.0
        assert finalized["telemetry_after"]["network_state"] == "SEVERED_DISCONNECTED"
        assert finalized["response_latency_ms"] > 0

        # Timeline completeness
        steps = [step["step"] for step in finalized["timeline"]]
        assert "WORKLOAD_GENERATION" in steps
        assert "ANOMALY_DETECTION" in steps
        assert "RESPONSE_RECOMMENDATION" in steps
        assert "EVIDENCE_PRESERVED" in steps
        assert "AUTHORIZATION_GRANTED" in steps
        assert "CONTAINMENT_APPLIED" in steps
        assert "POST_CONTAINMENT_VERIFICATION" in steps

    def test_unauthorized_execution_mode_guardrail(self):
        sim = ResponseEngine.run_simulation()
        with pytest.raises(ValueError, match="Unauthorized execution mode"):
            ResponseEngine.authorize_and_apply(
                simulation_data=sim,
                authorized_by="attacker",
                execution_mode="DESTRUCTIVE_RAW_KILL"
            )


class TestResponseDatabaseIntegration:
    def test_db_persistence_and_metrics(self, test_db):
        sim = ResponseEngine.run_simulation(workload_type="bursty_evasion")
        test_db.save_response_evaluation(sim)

        stored = test_db.get_response_evaluation(sim["simulation_id"])
        assert stored is not None
        assert stored["simulation_id"] == sim["simulation_id"]
        assert stored["authorization_status"] == "PENDING_AUTHORIZATION"

        # Apply containment
        finalized = ResponseEngine.authorize_and_apply(
            sim,
            authorized_by="SOC-Lead",
            execution_mode="SIMULATED_CONTAINMENT"
        )
        test_db.update_response_evaluation(sim["simulation_id"], finalized)

        updated = test_db.get_response_evaluation(sim["simulation_id"])
        assert updated["authorization_status"] == "AUTHORIZED"
        assert updated["containment_outcome"] == "SUCCESS"
        assert updated["cpu_reduction_pct"] > 0

        summary = test_db.get_response_effectiveness_summary()
        assert summary["total_simulations"] == 1
        assert summary["authorized_count"] == 1
        assert summary["containment_success_rate"] == 100.0


class TestResponseApiEndpoints:
    def test_api_simulation_and_authorization_lifecycle(self, client):
        # 1. Initiate simulation
        sim_res = client.post("/response/simulate", json={
            "workload_type": "sustained_mining",
            "target_process": "synthetic-crypto-worker",
            "environment": "HOST"
        })
        assert sim_res.status_code == 201
        sim_data = sim_res.get_json()
        sim_id = sim_data["simulation_id"]
        assert sim_data["authorization_status"] == "PENDING_AUTHORIZATION"

        # 2. Authorize and apply containment
        auth_res = client.post("/response/authorize", json={
            "simulation_id": sim_id,
            "authorized_by": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "approved_action": "CONTAIN_PROCESS_SUSPEND",
            "execution_mode": "SIMULATED_CONTAINMENT"
        })
        assert auth_res.status_code == 200
        auth_data = auth_res.get_json()
        assert auth_data["authorization_status"] == "AUTHORIZED"
        assert auth_data["containment_outcome"] == "SUCCESS"
        assert auth_data["cpu_reduction_pct"] > 85.0

        # 3. Query list
        list_res = client.get("/response/evaluations")
        assert list_res.status_code == 200
        items = list_res.get_json()["evaluations"]
        assert any(item["simulation_id"] == sim_id for item in items)

        # 4. Query effectiveness summary
        eff_res = client.get("/response/effectiveness")
        assert eff_res.status_code == 200
        eff_data = eff_res.get_json()
        assert eff_data["total_simulations"] >= 1
