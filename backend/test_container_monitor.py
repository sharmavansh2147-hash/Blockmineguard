"""
Unit and Integration Tests for Phase 3: Container-Aware Monitoring.
"""

import pytest
from monitor import ContainerMonitorService
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestContainerMonitorService:
    def test_service_initialization_and_host_identifier(self):
        service = ContainerMonitorService()
        telemetry = service.get_containers_telemetry()

        assert "host_identifier" in telemetry
        assert telemetry["host_identifier"].startswith("host-")
        assert telemetry["containers_monitored"] == 2
        assert telemetry["read_only_mode"] is True
        assert telemetry["requires_root"] is False

    def test_container_attribution_and_metrics(self):
        service = ContainerMonitorService()
        telemetry = service.get_containers_telemetry()
        containers = telemetry["containers"]

        # Container 1: normal web worker
        normal = next(c for c in containers if c["container_name"] == "bmg-web-worker-01")
        assert normal["health_status"] == "HEALTHY"
        assert normal["cpu_usage_pct"] < 10.0
        assert normal["container_risk_score"] < 20
        assert normal["attributed_incident_id"] is None

        # Container 2: high mining test container
        miner = next(c for c in containers if c["container_name"] == "bmg-cryptominer-eval-02")
        assert miner["health_status"] == "CRITICAL_ANOMALY"
        assert miner["cpu_usage_pct"] > 80.0
        assert miner["container_risk_score"] > 80
        assert miner["attributed_incident_id"] is not None
        assert "CONTAINER_CPU_SPIKE" in miner["factors"]

    def test_toggle_workload_mode(self):
        service = ContainerMonitorService()
        service.set_test_workload_mode("THROTTLED")
        telemetry = service.get_containers_telemetry()
        miner = next(c for c in telemetry["containers"] if c["container_name"] == "bmg-cryptominer-eval-02")
        assert miner["health_status"] == "THROTTLED"
        assert miner["cpu_usage_pct"] <= 10.0
        assert miner["container_risk_score"] < 50

        # Back to normal baseline
        service.set_test_workload_mode("NORMAL_BASELINE")
        telemetry2 = service.get_containers_telemetry()
        miner2 = next(c for c in telemetry2["containers"] if c["container_name"] == "bmg-cryptominer-eval-02")
        assert miner2["health_status"] == "HEALTHY"
        assert miner2["attributed_incident_id"] is None


class TestContainerApiEndpoints:
    def test_get_containers_api(self, client):
        res = client.get("/monitor/containers")
        assert res.status_code == 200
        data = res.get_json()
        assert data["containers_monitored"] == 2
        assert len(data["containers"]) == 2

    def test_toggle_container_workload_api(self, client):
        post_res = client.post("/monitor/containers/workload", json={"mode": "HIGH_MINING"})
        assert post_res.status_code == 200
        assert post_res.get_json()["current_mode"] == "HIGH_MINING"

    def test_get_single_container_by_id(self, client):
        res = client.get("/monitor/containers/bmg-web-worker-01")
        assert res.status_code == 200
        container = res.get_json()
        assert container["container_name"] == "bmg-web-worker-01"

        res_404 = client.get("/monitor/containers/nonexistent-container")
        assert res_404.status_code == 404
