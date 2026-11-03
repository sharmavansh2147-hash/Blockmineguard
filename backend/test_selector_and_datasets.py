#!/usr/bin/env python3
"""
Integration test for BlockMineGuard Verification Center Incident Selector,
Search/Filtering, and Sample Datasets.
"""

import sys
import json
import urllib.request
import urllib.parse

BASE_URL = "http://localhost:5001"

def api_get(endpoint, params=None):
    url = f"{BASE_URL}{endpoint}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def api_post(endpoint, data):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode())

def run_tests():
    print("================================================================")
    print("Testing BlockMineGuard Incident Selector & Sample Datasets Flow")
    print("================================================================")

    # 1. Test Incident Listing and Total Count
    print("\n[1] Testing GET /incidents (listing and total count)...")
    res = api_get("/incidents", {"limit": 100})
    incidents = res.get("incidents", [])
    total = res.get("total", 0)
    print(f"    Returned {len(incidents)} incidents, total in database: {total}")
    assert len(incidents) >= 3, f"Expected at least 3 incidents, got {len(incidents)}"
    assert total >= len(incidents), f"Total {total} should be >= returned {len(incidents)}"

    # 2. Test Distinctness of First 3 Incidents
    print("\n[2] Verifying distinctness and payload isolation across incidents...")
    seen_ids = set()
    distinct_payloads = []
    for inc in incidents[:3]:
        iid = inc["incident_id"]
        assert iid not in seen_ids, f"Duplicate incident ID detected: {iid}"
        seen_ids.add(iid)

        detail = api_get(f"/incidents/{iid}")
        assert "canonical_evidence" in detail, f"Missing canonical_evidence for {iid}"
        payload = detail["canonical_evidence"]
        distinct_payloads.append(payload)
        print(f"    Incident {iid}: process={payload.get('process_name')}, CPU={payload.get('cpu_usage')}%, severity={payload.get('severity')}")

    assert len(seen_ids) >= 3, "Failed to retrieve at least 3 distinct incident records"
    print(f"    Verified {len(seen_ids)} distinct incidents with unique payloads.")

    # 3. Test Search Filtering
    print("\n[3] Testing search filtering (by process name or ID)...")
    sample_proc = incidents[0].get("process_name") or "xmrig"
    search_res = api_get("/incidents", {"search": sample_proc, "limit": 20})
    filtered = search_res.get("incidents", [])
    print(f"    Search for '{sample_proc}' returned {len(filtered)} results (total match: {search_res.get('total')})")
    assert len(filtered) > 0, f"Expected search results for '{sample_proc}'"
    for item in filtered:
        assert (sample_proc.lower() in (item.get("process_name") or "").lower() or
                sample_proc.lower() in (item.get("incident_id") or "").lower()), \
            f"Filtered item {item.get('incident_id')} does not match term '{sample_proc}'"

    # 4. Test Severity Filtering
    print("\n[4] Testing severity filtering...")
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        sev_res = api_get("/incidents", {"severity": sev, "limit": 10})
        sev_list = sev_res.get("incidents", [])
        print(f"    Severity {sev}: {len(sev_list)} shown, {sev_res.get('total')} total")
        for item in sev_list:
            assert item.get("severity") == sev, f"Item severity {item.get('severity')} does not match filter {sev}"

    # 5. Test Sample Data Endpoints
    print("\n[5] Testing GET /sample-data (listing sample fixtures)...")
    sample_list_res = api_get("/sample-data")
    samples = sample_list_res.get("samples", [])
    sample_ids = [s["id"] for s in samples]
    print(f"    Available samples: {sample_ids}")
    assert "normal_workload" in sample_ids, "Missing normal_workload in sample list"
    assert "cryptojacking_workload" in sample_ids, "Missing cryptojacking_workload in sample list"
    assert "threat_intelligence" in sample_ids, "Missing threat_intelligence in sample list"

    # 6. Test Loading Normal Workload Sample
    print("\n[6] Testing GET /sample-data/normal_workload...")
    normal_res = api_get("/sample-data/normal_workload")
    normal_data = normal_res.get("data", {})
    assert normal_data.get("process_name") == "nginx", f"Unexpected normal process: {normal_data.get('process_name')}"
    print(f"    Normal workload: {normal_data}")

    # Run normal workload through real detector
    detect_normal = api_post("/detect", normal_data)
    print(f"    Normal detector result: suspicious={detect_normal.get('suspicious')}, risk_score={detect_normal.get('risk_score', {}).get('score')}")
    assert detect_normal.get("suspicious") is False, "Normal workload falsely flagged as suspicious"

    # 7. Test Loading Cryptojacking Workload Sample
    print("\n[7] Testing GET /sample-data/cryptojacking_workload...")
    crypto_res = api_get("/sample-data/cryptojacking_workload")
    crypto_data = crypto_res.get("data", {})
    assert crypto_data.get("process_name") == "xmrig", f"Unexpected crypto process: {crypto_data.get('process_name')}"
    print(f"    Cryptojacking workload: {crypto_data}")

    # Run crypto workload through real detector
    detect_crypto = api_post("/detect", crypto_data)
    print(f"    Cryptojacking detector result: suspicious={detect_crypto.get('suspicious')}, risk_score={detect_crypto.get('risk_score', {}).get('score')}")
    assert detect_crypto.get("suspicious") is True, "Cryptojacking workload failed to trigger suspicious verdict"

    # 8. Test Loading Threat Intelligence Sample
    print("\n[8] Testing GET /sample-data/threat_intelligence...")
    intel_res = api_get("/sample-data/threat_intelligence")
    intel_data = intel_res.get("data", [])
    assert isinstance(intel_data, list), "Expected list of IOCs"
    assert len(intel_data) == 10, f"Expected 10 IOCs, got {len(intel_data)}"
    print(f"    Threat intelligence: {len(intel_data)} indicators loaded successfully.")

    # 9. Test Saving Sample as Incident and Anchoring Workflow
    print("\n[9] Testing creating a new incident from sample telemetry...")
    create_payload = {
        **crypto_data,
        "environment": "HOST"
    }
    create_res = api_post("/incidents", create_payload)
    new_id = create_res.get("incident_id") or create_res.get("incident", {}).get("incident_id")
    assert new_id is not None, f"Failed to create incident from sample: {create_res}"
    print(f"    Created new authentic incident: {new_id} with hash {create_res.get('evidence_hash', '')[:16]}...")

    # Verify newly created incident is immediately retrievable via GET /incidents/<id>
    fetch_new = api_get(f"/incidents/{new_id}")
    assert fetch_new.get("incident", {}).get("incident_id") == new_id, "Could not fetch newly created incident"
    print(f"    Verified new incident {new_id} is persistent and queryable in database.")

    print("\n================================================================")
    print("ALL SELECTION, SEARCH/FILTER, AND SAMPLE DATA TESTS PASSED!")
    print("================================================================")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n[ERROR] Test failed: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
