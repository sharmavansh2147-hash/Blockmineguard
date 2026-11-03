import pytest
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from database.models import IncidentRecord


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert "blockchain_connected" in data


def test_detect_endpoint_normal(client):
    payload = {
        "cpu_usage": 35.0,
        "memory_usage": 40.0,
        "process_name": "node",
        "process_runtime_seconds": 120,
        "network_destination": "api.github.com"
    }
    response = client.post("/detect", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["suspicious"] is False
    assert data["risk_score"]["severity"] == "LOW"
    assert len(data["reasons"]) > 0


def test_detect_endpoint_suspicious(client):
    payload = {
        "cpu_usage": 96.0,
        "memory_usage": 80.0,
        "process_name": "xmrig",
        "process_runtime_seconds": 7200,
        "network_destination": "minexmr.com"
    }
    response = client.post("/detect", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["suspicious"] is True
    assert data["risk_score"]["severity"] in ("HIGH", "CRITICAL")
    assert data["risk_score"]["score"] >= 85


def test_incident_lifecycle_and_tamper_detection(client):
    # 1. Create incident with high risk telemetry
    payload = {
        "cpu_usage": 95.0,
        "memory_usage": 75.0,
        "process_name": "xmrig",
        "process_runtime_seconds": 5400,
        "network_destination": "xmrpool.eu",
        "threat_intel_ref": "TI-TEST-01"
    }
    create_resp = client.post("/incidents", json=payload)
    assert create_resp.status_code == 201
    created = create_resp.get_json()
    incident_id = created["incident_id"]
    evidence_hash = created["evidence_hash"]
    evidence = created["evidence"]

    assert incident_id.startswith("INC-")
    assert len(evidence_hash) == 64

    # 2. Get incident details
    get_resp = client.get(f"/incidents/{incident_id}")
    assert get_resp.status_code == 200
    inc_data = get_resp.get_json()["incident"]
    assert inc_data["incident_id"] == incident_id
    assert inc_data["verification_status"] == "UNVERIFIED"

    # 3. Add investigation note
    note_resp = client.post(f"/incidents/{incident_id}/notes", json={
        "note": "Telemetry confirms cryptojacking pattern matching xmrig binary",
        "author": "Analyst Alice"
    })
    assert note_resp.status_code == 201

    notes_resp = client.get(f"/incidents/{incident_id}/notes")
    assert notes_resp.status_code == 200
    notes = notes_resp.get_json()["notes"]
    assert len(notes) >= 1
    assert notes[0]["author"] == "Analyst Alice"

    # 4. Successful verification with original evidence (camelCase or snake_case)
    verify_resp = client.post(f"/incidents/{incident_id}/verify", json={"evidence": evidence})
    assert verify_resp.status_code == 200
    verify_data = verify_resp.get_json()
    assert verify_data["verification_result"] in ("VERIFIED", "UNREGISTERED_ON_CHAIN")
    assert verify_data["evidence_match"] is True

    # 5. Controlled Tamper Test: alter evidence (e.g. modify CPU from 95 to 20)
    tampered_evidence = dict(evidence)
    tampered_evidence["cpu_usage"] = 20.0
    tampered_resp = client.post(f"/incidents/{incident_id}/verify", json={"evidence": tampered_evidence})
    assert tampered_resp.status_code == 200
    tampered_data = tampered_resp.get_json()
    assert tampered_data["verification_result"] == "TAMPERED"
    assert tampered_data["evidence_match"] is False

    # 6. Re-verify with true evidence to restore VERIFIED status for resolution
    client.post(f"/incidents/{incident_id}/verify", json={"evidence": evidence})

    # 7. Resolve incident
    resolve_resp = client.post(f"/incidents/{incident_id}/resolve", json={
        "resolution": "RESOLVED",
        "notes": "Process isolated and network rule blocked pool domain"
    })
    assert resolve_resp.status_code == 200
    assert resolve_resp.get_json()["resolution_status"] == "RESOLVED"


def test_threat_intelligence_deduplication(client):
    ti_payload = {
        "indicator": "test-unique-miner-pool.org",
        "indicator_type": "domain",
        "description": "Controlled test mining pool",
        "campaign_id": "CAMP-TEST-001"
    }
    resp1 = client.post("/threat-intelligence", json=ti_payload)
    assert resp1.status_code in (201, 409)

    # Second submission must be detected as duplicate
    resp2 = client.post("/threat-intelligence", json=ti_payload)
    assert resp2.status_code == 409
    assert "already registered" in resp2.get_json()["error"]


def test_system_metrics_monitoring(client):
    resp = client.get("/monitor/system-metrics")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["is_simulated"] is False
    assert "cpu_usage" in data
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0


def test_export_reports(client):
    resp_json = client.get("/reports/export?format=json")
    assert resp_json.status_code == 200
    data = resp_json.get_json()
    assert "incidents" in data
    assert "total_records" in data

    resp_csv = client.get("/reports/export?format=csv")
    assert resp_csv.status_code == 200
    assert "incident_id,external_id" in resp_csv.data.decode()
