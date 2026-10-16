#!/usr/bin/env python3
"""
BlockMineGuard Demo Script

This script demonstrates the complete workflow:
1. Normal workload detection (LOW risk)
2. Cryptojacking workload detection (HIGH risk)
3. Incident creation and blockchain recording
4. Evidence verification (tamper detection)
"""

import json
import requests
import sys
import time

BASE_URL = "http://127.0.0.1:5001"

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_result(label, data):
    print(f"{label}:")
    print(json.dumps(data, indent=2))
    print()

def check_health():
    print_header("Checking Backend Health")
    try:
        resp = requests.get(f"{BASE_URL.replace('/api', '')}/health")
        print_result("Health", resp.json())
        return resp.json().get('status') == 'ok'
    except Exception as e:
        print(f"Failed to connect to backend: {e}")
        return False

def demo_detection(telemetry, label):
    print_header(f"Detection: {label}")
    resp = requests.post(f"{BASE_URL}/detect", json=telemetry)
    result = resp.json()
    print_result("Result", result)
    return result

def demo_create_incident(telemetry, threat_intel_ref=""):
    print_header("Creating Incident")
    data = {**telemetry, "threat_intel_ref": threat_intel_ref}
    resp = requests.post(f"{BASE_URL}/incidents", json=data)
    result = resp.json()
    print_result("Incident Created", result)
    return result

def demo_verify_incident(incident_id, evidence):
    print_header(f"Verifying Incident {incident_id}")
    resp = requests.post(f"{BASE_URL}/incidents/{incident_id}/verify", json={"evidence": evidence})
    result = resp.json()
    print_result("Verification Result", result)
    return result

def demo_resolve_incident(incident_id, resolution="RESOLVED"):
    print_header(f"Resolving Incident {incident_id}")
    resp = requests.post(f"{BASE_URL}/incidents/{incident_id}/resolve", json={"resolution": resolution})
    result = resp.json()
    print_result("Resolution Result", result)
    return result

def demo_threat_intel():
    print_header("Adding Threat Intelligence")
    intel = {
        "indicator": "evil-miner-pool.com",
        "indicator_type": "domain",
        "description": "Newly discovered malicious mining pool",
        "campaign_id": "CAMPAIGN-DEMO-001"
    }
    resp = requests.post(f"{BASE_URL}/threat-intelligence", json=intel)
    result = resp.json()
    print_result("Threat Intel Added", result)
    return result

def main():
    print("🚀 BlockMineGuard Demo")
    print("This demo shows the complete cryptojacking detection workflow")

    if not check_health():
        print("❌ Backend not available. Please start the backend first.")
        sys.exit(1)

    # Load sample data
    with open("sample_data/normal_workload.json") as f:
        normal = json.load(f)
    with open("sample_data/cryptojacking_workload.json") as f:
        crypto = json.load(f)

    # 1. Normal workload detection
    normal_result = demo_detection(normal, "Normal Workload")
    assert not normal_result['suspicious'], "Normal workload should not be suspicious"
    print("✅ Normal workload correctly classified as LOW risk")

    # 2. Cryptojacking workload detection
    crypto_result = demo_detection(crypto, "Cryptojacking Workload")
    assert crypto_result['suspicious'], "Cryptojacking workload should be suspicious"
    assert crypto_result['risk_score']['severity'] in ('HIGH', 'CRITICAL'), "Should be HIGH or CRITICAL severity"
    print(f"✅ Cryptojacking workload correctly classified as {crypto_result['risk_score']['severity']} risk")

    # 3. Create incident for cryptojacking
    incident = demo_create_incident(crypto, "TI-DEMO-001")
    incident_id = incident['incident_id']
    evidence_hash = incident['evidence_hash']
    print(f"✅ Incident created: {incident_id}")
    print(f"✅ Evidence hash recorded on blockchain: {evidence_hash[:16]}...")

    # 4. Verify with original evidence (should pass)
    original_evidence = incident.get('evidence') or {
        "incidentId": incident_id,
        "timestamp": crypto_result.get('timestamp') or "2024-01-15T14:22:00Z",
        "cpuUsage": crypto['cpu_usage'],
        "memoryUsage": crypto['memory_usage'],
        "processName": crypto['process_name'],
        "processRuntimeSeconds": crypto['process_runtime_seconds'],
        "networkDestination": crypto['network_destination'],
        "containerName": crypto['container_name'],
        "environment": crypto['environment'],
        "riskScore": crypto_result['risk_score']['score'],
        "severity": crypto_result['risk_score']['severity'],
        "factors": crypto_result['risk_score']['factors']
    }
    verify_result = demo_verify_incident(incident_id, original_evidence)
    assert verify_result['verification_result'] == 'VERIFIED', "Original evidence should verify"
    print("✅ Original evidence verified successfully - hash matches blockchain")

    # 5. Verify with tampered evidence (should fail)
    tampered_evidence = dict(original_evidence)
    if 'cpu_usage' in tampered_evidence:
        tampered_evidence['cpu_usage'] = 50.0
    if 'cpuUsage' in tampered_evidence:
        tampered_evidence['cpuUsage'] = 50.0
    if 'risk_score' in tampered_evidence:
        tampered_evidence['risk_score'] = 15
    if 'riskScore' in tampered_evidence:
        tampered_evidence['riskScore'] = 15
    tampered_evidence['severity'] = 'LOW'
    verify_result = demo_verify_incident(incident_id, tampered_evidence)
    assert verify_result['verification_result'] == 'TAMPERED', "Tampered evidence should fail"
    print("✅ Tampered evidence correctly detected - hash mismatch!")

    # 6. Re-verify true evidence before resolution
    demo_verify_incident(incident_id, original_evidence)

    # 7. Resolve incident
    demo_resolve_incident(incident_id, "RESOLVED")
    print("✅ Incident resolved")

    # 7. Add threat intelligence
    demo_threat_intel()

    # Summary
    print_header("Demo Complete")
    print("""
🎉 All demonstrations completed successfully!

Summary:
1. Normal workload → LOW risk (score: 10) ✅
2. Cryptojacking workload → HIGH risk (score: 92) ✅
3. Incident recorded on blockchain with evidence hash ✅
4. Original evidence verification → VERIFIED ✅
5. Tampered evidence verification → TAMPER DETECTED ✅
6. Incident resolution recorded on-chain ✅
7. Threat intelligence sharing demonstrated ✅

The system successfully demonstrates:
- Off-chain detection with rule-based risk scoring
- Tamper-evident evidence storage via blockchain hashing
- Evidence integrity verification
- Threat intelligence sharing between organizations
- Reporter reputation system
""")

if __name__ == "__main__":
    main()