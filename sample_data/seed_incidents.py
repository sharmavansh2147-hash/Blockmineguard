#!/usr/bin/env python3
"""
Seed realistic cryptojacking and system telemetry incidents into BlockMineGuard.
Covers diverse risk scores (Low, Medium, High, Critical) and verification/resolution statuses:
- Pending (Unverified)
- Verified
- Tampered
- Open, In Progress, Resolved, False Positive
"""

import sys
import time
import requests

API_URL = "http://127.0.0.1:5001"

SEED_INCIDENTS = [
    # 1. Low Risk - Pending (Unverified), OPEN
    {
        "name": "Cron Job Background Sync (Low Risk)",
        "payload": {
            "cpu_usage": 15.0,
            "memory_usage": 32.0,
            "process_name": "cron_sync_worker",
            "process_runtime_seconds": 3600,
            "network_destination": "internal-repo.corp:443",
            "environment": "HOST",
            "threat_intel_ref": "",
            "threshold": 0
        },
        "verify": False,
        "resolution": "OPEN",
        "notes": ["Background periodic synchronization. Low risk telemetry."]
    },
    # 2. Low Risk - Verified, OPEN
    {
        "name": "Nginx Ingress Proxy Continuous Load",
        "payload": {
            "cpu_usage": 24.0,
            "memory_usage": 38.0,
            "process_name": "nginx_ingress",
            "process_runtime_seconds": 7200,
            "network_destination": "cdn.internal.org:443",
            "environment": "CONTAINER",
            "container_name": "ingress-prod-node",
            "threat_intel_ref": "",
            "threshold": 0
        },
        "verify": True,
        "resolution": "OPEN",
        "notes": ["Ingress telemetry verified against blockchain record. Nominal baseline."]
    },
    # 3. Low Risk - Verified, RESOLVED
    {
        "name": "Log Rotation Worker Scheduled Run",
        "payload": {
            "cpu_usage": 28.0,
            "memory_usage": 45.0,
            "process_name": "logrotate_daemon",
            "process_runtime_seconds": 3600,
            "network_destination": None,
            "environment": "HOST",
            "threshold": 0
        },
        "verify": True,
        "resolution": "RESOLVED",
        "notes": [
            "Investigated scheduled log cleanup.",
            "Marked resolved: Confirmed legitimate system maintenance."
        ]
    },
    # 4. Medium Risk - Pending (Unverified), OPEN
    {
        "name": "Unusual Node.js Server Spike (Medium Risk)",
        "payload": {
            "cpu_usage": 72.0,
            "memory_usage": 65.0,
            "process_name": "node_api_server",
            "process_runtime_seconds": 4000,
            "network_destination": "external-gateway.net:8080",
            "environment": "CONTAINER",
            "container_name": "api-service-prod",
            "threshold": 0
        },
        "verify": False,
        "resolution": "OPEN",
        "notes": ["Pending analyst triage for sustained moderate compute load."]
    },
    # 5. Medium Risk - Verified, IN_PROGRESS
    {
        "name": "Python Data Processing Pipeline",
        "payload": {
            "cpu_usage": 68.0,
            "memory_usage": 72.0,
            "process_name": "pandas_etl_job",
            "process_runtime_seconds": 7200,
            "network_destination": "data-warehouse.cloud:5432",
            "environment": "HOST",
            "threshold": 0
        },
        "verify": True,
        "resolution": "IN_PROGRESS",
        "notes": [
            "Elevated compute profile verified on blockchain.",
            "Investigation in progress with data analytics team."
        ]
    },
    # 6. Medium Risk - Verified, RESOLVED
    {
        "name": "Compiler Build Task with Extended Runtime",
        "payload": {
            "cpu_usage": 75.0,
            "memory_usage": 60.0,
            "process_name": "clang_build_worker",
            "process_runtime_seconds": 3800,
            "network_destination": None,
            "environment": "CONTAINER",
            "container_name": "ci-builder-02",
            "threshold": 0
        },
        "verify": True,
        "resolution": "RESOLVED",
        "notes": [
            "Compilation profile verified on blockchain.",
            "Resolved: verified release build completed successfully."
        ]
    },
    # 7. High Risk - Pending (Unverified), OPEN
    {
        "name": "Suspicious Process with External Stratum Dial",
        "payload": {
            "cpu_usage": 84.0,
            "memory_usage": 76.0,
            "process_name": "kworker_fake_miner",
            "process_runtime_seconds": 4800,
            "network_destination": "mining-stratum.pool-direct.cc:3333",
            "environment": "HOST",
            "threat_intel_ref": "TI-REF-902",
            "threshold": 0
        },
        "verify": False,
        "resolution": "OPEN",
        "notes": ["Pending operator verification. Matched external stratum mining destination."]
    },
    # 8. High Risk - Verified, IN_PROGRESS
    {
        "name": "Ethminer Signature on Kubernetes Worker",
        "payload": {
            "cpu_usage": 86.0,
            "memory_usage": 74.0,
            "process_name": "ethminer",
            "process_runtime_seconds": 5400,
            "network_destination": "pool.ethermine.org:4444",
            "environment": "CONTAINER",
            "container_name": "k8s-pod-quarantine",
            "threshold": 0
        },
        "verify": True,
        "resolution": "IN_PROGRESS",
        "notes": [
            "Incident hash recorded on Hardhat ThreatRegistry.",
            "Container quarantined from network. Remediation in progress."
        ]
    },
    # 9. High Risk - Verified, RESOLVED
    {
        "name": "Controlled Monero Mining Benchmark Test",
        "payload": {
            "cpu_usage": 82.0,
            "memory_usage": 68.0,
            "process_name": "minerd",
            "process_runtime_seconds": 3600,
            "network_destination": "testnet-xmr.eu:5555",
            "environment": "HOST",
            "threshold": 0
        },
        "verify": True,
        "resolution": "RESOLVED",
        "notes": [
            "Authorized cybersecurity lab test workload.",
            "Resolved and decommissioned after detection evaluation."
        ]
    },
    # 10. Critical Risk - Verified, OPEN
    {
        "name": "High-Intensity XMRig Mining Process Active",
        "payload": {
            "cpu_usage": 98.0,
            "memory_usage": 88.0,
            "process_name": "xmrig",
            "process_runtime_seconds": 18000,
            "network_destination": "pool.supportxmr.com:3333",
            "environment": "HOST",
            "threat_intel_ref": "TI-XMR-77",
            "threshold": 0
        },
        "verify": True,
        "resolution": "OPEN",
        "notes": [
            "CRITICAL Severity: 98% CPU continuous for 5 hours.",
            "Evidence hash anchored to blockchain.",
            "Immediate containment recommended."
        ]
    },
    # 11. Critical Risk - Pending (Unverified), OPEN
    {
        "name": "Nanominer Distributed Hive Worker Active",
        "payload": {
            "cpu_usage": 96.0,
            "memory_usage": 84.0,
            "process_name": "nanominer",
            "process_runtime_seconds": 12600,
            "network_destination": "stratum.hiveon.net:8888",
            "environment": "CONTAINER",
            "container_name": "sandbox-unauth-01",
            "threshold": 0
        },
        "verify": False,
        "resolution": "OPEN",
        "notes": ["Incoming Critical detection awaiting blockchain verification run."]
    },
    # 12. High Risk - Tampered Evidence Detection Demonstration
    {
        "name": "Suspected Tampered Log Injection Event",
        "payload": {
            "cpu_usage": 91.0,
            "memory_usage": 77.0,
            "process_name": "cpuminer-multi",
            "process_runtime_seconds": 6400,
            "network_destination": "mining-us.prohashing.com:3333",
            "environment": "HOST",
            "threshold": 0
        },
        "tamper": True,
        "resolution": "OPEN",
        "notes": [
            "Demonstration of blockchain evidence integrity failure.",
            "Attacker modified offline evidence CPU usage from 91% to 12%."
        ]
    }
]

def main():
    print("=" * 60)
    print("  BlockMineGuard: Seeding Diverse Telemetry Incidents")
    print("=" * 60)

    try:
        r = requests.get(f"{API_URL}/health", timeout=5)
        if r.status_code != 200:
            print(f"❌ Backend not healthy: {r.text}")
            sys.exit(1)
        health = r.json()
        print(f"✅ Backend Connected (Blockchain: {health.get('blockchain_connected')}, Contract: {health.get('contract_address')})")
    except Exception as e:
        print(f"❌ Could not connect to {API_URL}: {e}")
        sys.exit(1)

    created_count = 0
    for idx, item in enumerate(SEED_INCIDENTS, start=1):
        name = item["name"]
        payload = item["payload"]
        print(f"\n[{idx}/{len(SEED_INCIDENTS)}] Creating: {name} ...")

        # 1. Create Incident
        res = requests.post(f"{API_URL}/incidents", json=payload, timeout=10)
        if res.status_code != 201:
            print(f"  ❌ Failed to create incident: {res.text}")
            continue

        data = res.json()
        inc_id = data["incident_id"]
        score = data["risk_score"]["score"]
        severity = data["risk_score"]["severity"]
        print(f"  ✅ Created {inc_id} -> Score: {score}/100 ({severity})")

        # 2. Add Investigation Notes
        for note in item.get("notes", []):
            requests.post(
                f"{API_URL}/incidents/{inc_id}/notes",
                json={"note": note, "author": "Security Operations Center"},
                timeout=5
            )

        # 3. Handle Verification
        if item.get("verify"):
            v_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={}, timeout=10)
            if v_res.status_code == 200:
                print(f"  🛡️ Verified on blockchain -> Status: VERIFIED")
            else:
                print(f"  ⚠️ Verification warning: {v_res.text}")
        elif item.get("tamper"):
            # Provide altered evidence to simulate and prove tamper detection
            altered = dict(data["evidence"])
            altered["cpu_usage"] = 12.0
            altered["risk_score"] = 15
            altered["severity"] = "LOW"
            t_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json=altered, timeout=10)
            if t_res.status_code == 200 and t_res.json().get("verification_result") == "TAMPERED":
                print(f"  🚨 Tamper Test Executed -> Status: TAMPERED (Hash mismatch successfully detected!)")

        # 4. Handle Resolution
        resolution = item.get("resolution", "OPEN")
        if resolution != "OPEN" and item.get("verify"):
            r_res = requests.post(f"{API_URL}/incidents/{inc_id}/resolve", json={"resolution": resolution}, timeout=10)
            if r_res.status_code == 200:
                print(f"  📋 Status updated to: {resolution}")

        created_count += 1
        time.sleep(0.1)

    print("\n" + "=" * 60)
    print(f"🎉 Successfully seeded {created_count} diverse incidents!")
    print("=" * 60)

if __name__ == "__main__":
    main()
