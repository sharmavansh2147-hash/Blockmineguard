#!/usr/bin/env python3
"""
Seed 45 additional realistic incidents to bring total incidents past 85+ (aiming for 95).
Ensures:
- threshold: 0 on all payloads
- accurate tamper payload structure ({"evidence": altered})
- balanced distribution across Low, Medium, High, and Critical
- varied resolutions: OPEN, IN_PROGRESS, RESOLVED, FALSE_POSITIVE
"""

import sys
import time
import requests

API_URL = "http://127.0.0.1:5001"

ADDITIONAL_INCIDENTS = [
    # --- CRITICAL (5 incidents) ---
    {
        "name": "GhostMiner Fileless Memory Injection",
        "payload": {
            "cpu_usage": 98.7, "memory_usage": 90.1, "process_name": "ghostminer_injected",
            "process_runtime_seconds": 22000, "network_destination": "ghost.cryptopool.io:3333",
            "environment": "HOST", "threat_intel_ref": "TI-GH-01", "threshold": 0
        },
        "verify": True, "resolution": "OPEN",
        "notes": ["WMI persistence and memory-only execution detected via sysmon."]
    },
    {
        "name": "Redisscan Cryptomining Exploit",
        "payload": {
            "cpu_usage": 96.5, "memory_usage": 88.0, "process_name": "redisscan_xmr",
            "process_runtime_seconds": 19000, "network_destination": "redis-monero.c3pool.com:13333",
            "environment": "CONTAINER", "container_name": "cache-redis-worker-09", "threshold": 0
        },
        "verify": True, "resolution": "IN_PROGRESS",
        "notes": ["Unauthorized slaveof replication configuration exploited."]
    },
    {
        "name": "Log4j JNDI Remote Miner Drop",
        "payload": {
            "cpu_usage": 99.1, "memory_usage": 92.5, "process_name": "jndi_xmrig_payload",
            "process_runtime_seconds": 31000, "network_destination": "xmr.2miners.com:2222",
            "environment": "CONTAINER", "container_name": "log-indexer-es-node-03", "threshold": 0
        },
        "verify": True, "resolution": "OPEN",
        "notes": ["CVE-2021-44228 exploit attempt triggered remote payload download."]
    },
    {
        "name": "Confluence OGNL Cryptominer Ingress",
        "payload": {
            "cpu_usage": 97.4, "memory_usage": 86.8, "process_name": "atlassian_miner_sub",
            "process_runtime_seconds": 27000, "network_destination": "pool.supportxmr.com:80",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Atlassian Confluence server patched; miner process terminated."]
    },
    {
        "name": "Apache Struts High CPU Miner Hive",
        "payload": {
            "cpu_usage": 95.8, "memory_usage": 84.3, "process_name": "struts_xmr_miner",
            "process_runtime_seconds": 16400, "network_destination": "xmr-eu1.nanopool.org:14444",
            "environment": "CONTAINER", "container_name": "legacy-struts-customer-portal", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Incoming critical threat alert pending blockchain anchoring."]
    },

    # --- TAMPER TEST INCIDENTS (4 incidents) ---
    {
        "name": "Tamper Evidence Audit #1: Audit Trail Scrambling",
        "payload": {
            "cpu_usage": 94.0, "memory_usage": 83.0, "process_name": "shadow_miner_audit1",
            "process_runtime_seconds": 8900, "network_destination": "tamper.cryptomine.cc:4444",
            "environment": "HOST", "threshold": 0
        },
        "tamper": True, "resolution": "OPEN",
        "notes": ["Evidence altered post-registration: CPU usage reduced in local database.", "Cryptographic hash mismatch verified on smart contract."]
    },
    {
        "name": "Tamper Evidence Audit #2: Container Identity Falsification",
        "payload": {
            "cpu_usage": 92.4, "memory_usage": 80.6, "process_name": "spoofed_k8s_worker",
            "process_runtime_seconds": 9500, "network_destination": "mining-eu.pool.org:3333",
            "environment": "CONTAINER", "container_name": "fake-kube-proxy-pod", "threshold": 0
        },
        "tamper": True, "resolution": "OPEN",
        "notes": ["Attacker modified container identifier to bypass detection rule.", "Hardhat smart contract successfully rejected verification."]
    },
    {
        "name": "Tamper Evidence Audit #3: Memory Allocation Forgery",
        "payload": {
            "cpu_usage": 89.0, "memory_usage": 87.2, "process_name": "stealth_mem_mask",
            "process_runtime_seconds": 7400, "network_destination": "pool.minexmr.com:5555",
            "environment": "HOST", "threshold": 0
        },
        "tamper": True, "resolution": "OPEN",
        "notes": ["Attacker modified memory metrics in local disk cache.", "Smart contract proved evidence tampering."]
    },
    {
        "name": "Tamper Evidence Audit #4: Timestamp Rewind Simulation",
        "payload": {
            "cpu_usage": 91.5, "memory_usage": 82.1, "process_name": "anti_forensics_miner",
            "process_runtime_seconds": 8200, "network_destination": "stratum.solopool.org:8008",
            "environment": "CONTAINER", "container_name": "sandbox-tamper-tester", "threshold": 0
        },
        "tamper": True, "resolution": "OPEN",
        "notes": ["Synthetic forensic tampering test executed successfully."]
    },

    # --- HIGH RISK (12 incidents) ---
    {
        "name": "XMR-Stak CPU Multi-Thread Compilation",
        "payload": {
            "cpu_usage": 88.0, "memory_usage": 77.0, "process_name": "xmr-stak-rx",
            "process_runtime_seconds": 9200, "network_destination": "monero.crypto-pool.fr:3333",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "IN_PROGRESS",
        "notes": ["RandomX benchmark configuration detected running as root."]
    },
    {
        "name": "Cast XMR Vega OpenCL Pipeline",
        "payload": {
            "cpu_usage": 86.5, "memory_usage": 74.0, "process_name": "cast_xmr_daemon",
            "process_runtime_seconds": 8300, "network_destination": "pool.supportxmr.com:7777",
            "environment": "CONTAINER", "container_name": "gpu-worker-compute-02", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["GPU compute pod terminated and credential keys invalidated."]
    },
    {
        "name": "CryptoDredge Lyra2REv3 Process",
        "payload": {
            "cpu_usage": 87.2, "memory_usage": 75.8, "process_name": "cryptodredge_bin",
            "process_runtime_seconds": 6800, "network_destination": "lyra.pool.bsod.pw:2222",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "OPEN",
        "notes": ["Lyra2REv3 algorithmic hash stream logged by network TAP."]
    },
    {
        "name": "PhoenixMiner Ethash Emulation",
        "payload": {
            "cpu_usage": 85.9, "memory_usage": 73.2, "process_name": "phoenixminer_core",
            "process_runtime_seconds": 7900, "network_destination": "eth-eu2.nanopool.org:9999",
            "environment": "CONTAINER", "container_name": "k8s-pod-transcode-08", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Unauthorized mining binary purged from base Docker image."]
    },
    {
        "name": "TeamBlackMiner Verthash Algorithm",
        "payload": {
            "cpu_usage": 84.1, "memory_usage": 71.9, "process_name": "teamblackminer",
            "process_runtime_seconds": 6100, "network_destination": "vtc.suprnova.cc:5678",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "IN_PROGRESS",
        "notes": ["SOC investigation in progress on host 192.168.10.84."]
    },
    {
        "name": "NplusMiner Multi-Pool Auto-Switch",
        "payload": {
            "cpu_usage": 86.8, "memory_usage": 76.4, "process_name": "nplusminer_agent",
            "process_runtime_seconds": 9400, "network_destination": "stratum.miningpoolhub.com:20585",
            "environment": "CONTAINER", "container_name": "dev-build-node-14", "threshold": 0
        },
        "verify": True, "resolution": "OPEN",
        "notes": ["Auto-profit switching script discovered in /tmp/.hidden_dir."]
    },
    {
        "name": "CudaMiner Legacy Compute Thread",
        "payload": {
            "cpu_usage": 83.2, "memory_usage": 70.1, "process_name": "cudaminer_x86",
            "process_runtime_seconds": 5700, "network_destination": "scrypt.pool-miners.eu:3333",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Awaiting blockchain record creation."]
    },
    {
        "name": "AwesomeMiner Remote Agent Ingress",
        "payload": {
            "cpu_usage": 85.0, "memory_usage": 72.5, "process_name": "awesomeminer_srv",
            "process_runtime_seconds": 7100, "network_destination": "remote-api.awesomeminer.com:443",
            "environment": "CONTAINER", "container_name": "management-gateway-agent", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Management console connection attempt blocked by edge firewall."]
    },
    {
        "name": "Sgminer-GM Equihash Multithreading",
        "payload": {
            "cpu_usage": 84.6, "memory_usage": 71.3, "process_name": "sgminer_gm_x64",
            "process_runtime_seconds": 6300, "network_destination": "zec.2miners.com:2020",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Zcash mining pool traffic detected."]
    },
    {
        "name": "Ccminer KlausT Cryptonight Branch",
        "payload": {
            "cpu_usage": 85.4, "memory_usage": 73.0, "process_name": "ccminer_klaust",
            "process_runtime_seconds": 6600, "network_destination": "pool.rplant.xyz:7022",
            "environment": "CONTAINER", "container_name": "qa-testing-box-03", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["RPlant pool mining identified on QA testing environment."]
    },
    {
        "name": "HavuMiner Ravencoin Algorithmic Runner",
        "payload": {
            "cpu_usage": 86.1, "memory_usage": 74.5, "process_name": "havuminer_app",
            "process_runtime_seconds": 7700, "network_destination": "rvn.minerpool.org:8888",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Under triage by incident response lead."]
    },
    {
        "name": "FinMiner Dual Eth/Pascal Hash Task",
        "payload": {
            "cpu_usage": 87.5, "memory_usage": 75.9, "process_name": "finminer_release",
            "process_runtime_seconds": 8100, "network_destination": "eth-eu1.nanopool.org:9999",
            "environment": "CONTAINER", "container_name": "staging-render-pod", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Dual-mining algorithm identified on GPU container."]
    },

    # --- MEDIUM RISK (12 incidents) ---
    {
        "name": "Redis In-Memory Persistence Sync #2",
        "payload": {
            "cpu_usage": 64.8, "memory_usage": 67.2, "process_name": "redis_bgsave_v2",
            "process_runtime_seconds": 3800, "network_destination": None,
            "environment": "CONTAINER", "container_name": "session-store-cache-v2", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Background RDB snapshot creation completed without errors."]
    },
    {
        "name": "Airflow DAG Dynamic ETL Execution #2",
        "payload": {
            "cpu_usage": 71.3, "memory_usage": 66.0, "process_name": "airflow_task_runner_v2",
            "process_runtime_seconds": 4200, "network_destination": "snowflake-sync.corp:443",
            "environment": "CONTAINER", "container_name": "airflow-worker-celery-02", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Daily financial reconciliation ETL task verified by data engineering lead."]
    },
    {
        "name": "Prometheus Metric Compaction Daemon #2",
        "payload": {
            "cpu_usage": 66.2, "memory_usage": 69.1, "process_name": "prometheus_thanos_compact_v2",
            "process_runtime_seconds": 4100, "network_destination": "thanos-store.internal:10901",
            "environment": "CONTAINER", "container_name": "monitoring-thanos-compact-v2", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Long-term telemetry block downsampling and compaction completed."]
    },
    {
        "name": "Kafka Stream Processing Rebalancing #2",
        "payload": {
            "cpu_usage": 70.5, "memory_usage": 68.9, "process_name": "kafka_streams_worker_v2",
            "process_runtime_seconds": 3950, "network_destination": "kafka-broker-03.prod:9092",
            "environment": "CONTAINER", "container_name": "order-event-consumer-07", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Consumer group rebalance caused temporary thread saturation."]
    },
    {
        "name": "Webpack Production Bundle Minification #2",
        "payload": {
            "cpu_usage": 73.0, "memory_usage": 63.8, "process_name": "terser_webpack_plugin_v2",
            "process_runtime_seconds": 3650, "network_destination": None,
            "environment": "CONTAINER", "container_name": "frontend-ci-builder-02", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Terser JS minification in progress for release build v2.4.0."]
    },
    {
        "name": "Grafana Image Renderer Spurt Load #2",
        "payload": {
            "cpu_usage": 68.0, "memory_usage": 61.5, "process_name": "grafana_renderer_plugin_v2",
            "process_runtime_seconds": 3620, "network_destination": "internal-report-gen:80",
            "environment": "CONTAINER", "container_name": "grafana-enterprise-dashboard-v2", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Automated executive PDF dashboard generation for weekly SOC review."]
    },
    {
        "name": "HashiCorp Vault Rekeying Compute Cycle #2",
        "payload": {
            "cpu_usage": 65.5, "memory_usage": 59.0, "process_name": "vault_core_seal_v2",
            "process_runtime_seconds": 3610, "network_destination": "consul-cluster.corp:8500",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Shamir key shard rotation across security officers completed."]
    },
    {
        "name": "PyTorch Gradient Checkpointing Pass",
        "payload": {
            "cpu_usage": 74.8, "memory_usage": 72.1, "process_name": "python3_torch_train",
            "process_runtime_seconds": 4900, "network_destination": "s3.ml-models.corp:443",
            "environment": "CONTAINER", "container_name": "llm-fine-tuning-pod", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Internal LLM fine-tuning job confirmed with AI engineering team."]
    },
    {
        "name": "Elasticsearch Index Snapshot Serialization",
        "payload": {
            "cpu_usage": 67.4, "memory_usage": 64.9, "process_name": "es_snapshot_worker",
            "process_runtime_seconds": 4300, "network_destination": "es-backup.s3.internal:443",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Daily snapshot repository upload in progress."]
    },
    {
        "name": "Go Compiler Heavy Inlining Pass",
        "payload": {
            "cpu_usage": 76.5, "memory_usage": 65.0, "process_name": "go_build_compiler",
            "process_runtime_seconds": 3750, "network_destination": "proxy.golang.org:443",
            "environment": "CONTAINER", "container_name": "golang-ci-builder-04", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Microservice compilation with race detector enabled."]
    },
    {
        "name": "Postgres Analytics Query Execution",
        "payload": {
            "cpu_usage": 72.1, "memory_usage": 70.5, "process_name": "postgres_worker_query",
            "process_runtime_seconds": 4600, "network_destination": "bi-metabase.corp:3000",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Long-running BI query investigating customer churn cohort."]
    },
    {
        "name": "Node.js Serverless Function Bundling",
        "payload": {
            "cpu_usage": 69.8, "memory_usage": 62.3, "process_name": "esbuild_lambda_pack",
            "process_runtime_seconds": 3610, "network_destination": None,
            "environment": "CONTAINER", "container_name": "serverless-deployer", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["ESBuild packaging 48 microservices for AWS Lambda deployment."]
    },

    # --- LOW RISK (12 incidents) ---
    {
        "name": "Systemd Journald Log Compaction #2",
        "payload": {
            "cpu_usage": 18.2, "memory_usage": 34.0, "process_name": "systemd_journald_v2",
            "process_runtime_seconds": 7200, "network_destination": None,
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Standard Linux system log indexing. Zero anomalies detected."]
    },
    {
        "name": "Prometheus Node Exporter Scrape Routine #2",
        "payload": {
            "cpu_usage": 12.5, "memory_usage": 22.1, "process_name": "node_exporter_v2",
            "process_runtime_seconds": 14400, "network_destination": "prometheus.monitoring:9100",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Host metrics export daemon nominal operation."]
    },
    {
        "name": "Falco Runtime Security Sensor Baseline #2",
        "payload": {
            "cpu_usage": 15.0, "memory_usage": 28.6, "process_name": "falco_ebpf_probe_v2",
            "process_runtime_seconds": 28800, "network_destination": "falcosidekick.k8s:2801",
            "environment": "CONTAINER", "container_name": "falco-daemonset-system-v2", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["eBPF kernel probe active monitoring syscall events."]
    },
    {
        "name": "Osqueryd Security Telemetry Daemon #2",
        "payload": {
            "cpu_usage": 14.1, "memory_usage": 31.4, "process_name": "osqueryd_v2",
            "process_runtime_seconds": 18000, "network_destination": "fleetdm.security.corp:443",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Periodic endpoint security health query. Baseline profile normal."]
    },
    {
        "name": "Vector Telemetry Forwarder Streaming #2",
        "payload": {
            "cpu_usage": 21.0, "memory_usage": 36.5, "process_name": "vector_agent_v2",
            "process_runtime_seconds": 12000, "network_destination": "clickhouse.internal:9000",
            "environment": "CONTAINER", "container_name": "vector-log-aggregator-v2", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Log pipeline forwarder processing 50,000 events/sec smoothly."]
    },
    {
        "name": "Kubelet Node Heartbeat Routine #2",
        "payload": {
            "cpu_usage": 9.8, "memory_usage": 19.4, "process_name": "kubelet_v2",
            "process_runtime_seconds": 36000, "network_destination": "k8s-apiserver.infra:6443",
            "environment": "HOST", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Kubernetes worker node control plane heartbeat. Normal status."]
    },
    {
        "name": "Nginx Keepalive Worker Nominal Load #2",
        "payload": {
            "cpu_usage": 16.7, "memory_usage": 25.0, "process_name": "nginx_worker_v2",
            "process_runtime_seconds": 10800, "network_destination": "gateway.prod.corp:443",
            "environment": "CONTAINER", "container_name": "edge-proxy-02", "threshold": 0
        },
        "verify": True, "resolution": "RESOLVED",
        "notes": ["Ingress HTTP reverse proxy serving nominal traffic volume."]
    },
    {
        "name": "OpenSSH Client Secure Session #2",
        "payload": {
            "cpu_usage": 8.3, "memory_usage": 16.0, "process_name": "sshd_session_v2",
            "process_runtime_seconds": 5400, "network_destination": "bastion.corp:22",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Authorized administrator bastion connection from corporate VPN."]
    },
    {
        "name": "Fluentbit Micro-Log Agent #2",
        "payload": {
            "cpu_usage": 11.2, "memory_usage": 24.5, "process_name": "fluent_bit_v2",
            "process_runtime_seconds": 15000, "network_destination": "opensearch.infra:9200",
            "environment": "CONTAINER", "container_name": "fluentbit-sidecar-collector-v2", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Lightweight pod sidecar streaming container stdout logs."]
    },
    {
        "name": "CoreDNS Cluster Domain Resolution #2",
        "payload": {
            "cpu_usage": 17.5, "memory_usage": 29.8, "process_name": "coredns_v2",
            "process_runtime_seconds": 24000, "network_destination": "upstream-dns.corp:53",
            "environment": "CONTAINER", "container_name": "kube-system-coredns-02", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Cluster internal service discovery operating within nominal SLA."]
    },
    {
        "name": "Chronyd NTP Clock Synchronization #2",
        "payload": {
            "cpu_usage": 4.5, "memory_usage": 12.0, "process_name": "chronyd_v2",
            "process_runtime_seconds": 43200, "network_destination": "time.cloudflare.com:123",
            "environment": "HOST", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["Sub-millisecond high precision time sync baseline."]
    },
    {
        "name": "Envoy Service Mesh Sidecar Proxy #2",
        "payload": {
            "cpu_usage": 22.0, "memory_usage": 37.4, "process_name": "envoy_sidecar_v2",
            "process_runtime_seconds": 16000, "network_destination": "istio-pilot.k8s:15010",
            "environment": "CONTAINER", "container_name": "envoy-sidecar-proxy-v2", "threshold": 0
        },
        "verify": False, "resolution": "OPEN",
        "notes": ["mTLS mutual authentication proxy handling microservice requests."]
    }
]

def main():
    print("=" * 65)
    print("  BlockMineGuard: Seeding Additional Enterprise Incidents (45 Items)")
    print("=" * 65)

    created = 0
    verified = 0
    tampered = 0

    for idx, item in enumerate(ADDITIONAL_INCIDENTS, start=1):
        name = item["name"]
        payload = item["payload"]

        try:
            res = requests.post(f"{API_URL}/incidents", json=payload, timeout=10)
            if res.status_code != 201:
                print(f"[{idx}/{len(ADDITIONAL_INCIDENTS)}] ⚠️ Skip ({name}): {res.text[:60]}")
                continue

            data = res.json()
            inc_id = data["incident_id"]
            score = data["risk_score"]["score"]
            severity = data["risk_score"]["severity"]
            created += 1

            # Notes
            for note in item.get("notes", []):
                requests.post(
                    f"{API_URL}/incidents/{inc_id}/notes",
                    json={"note": note, "author": "Security Operations Center"},
                    timeout=5
                )

            # Verification / Tampering
            if item.get("verify"):
                v_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={}, timeout=10)
                if v_res.status_code == 200:
                    verified += 1
            elif item.get("tamper"):
                # Pass structured altered evidence
                altered = dict(data["evidence"])
                altered["cpu_usage"] = 12.0
                altered["risk_score"] = 10
                altered["severity"] = "LOW"
                t_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={"evidence": altered}, timeout=10)
                if t_res.status_code == 200 and t_res.json().get("verification_result") == "TAMPERED":
                    tampered += 1

            # Resolution
            resolution = item.get("resolution", "OPEN")
            if resolution != "OPEN" and item.get("verify"):
                requests.post(f"{API_URL}/incidents/{inc_id}/resolve", json={"resolution": resolution}, timeout=10)

            print(f"[{idx}/{len(ADDITIONAL_INCIDENTS)}] ✅ {inc_id} | {severity:8} ({score:2}/100) | {name[:36]}")
        except Exception as e:
            print(f"[{idx}/{len(ADDITIONAL_INCIDENTS)}] ❌ Error: {e}")

        time.sleep(0.05)

    # Fetch final count
    try:
        final_r = requests.get(f"{API_URL}/incidents?page_size=200", timeout=5)
        total_in_db = len(final_r.json().get("incidents", []))
    except Exception:
        total_in_db = "Unknown"

    print("\n" + "=" * 65)
    print(f"🎉 Seeding Complete!")
    print(f"   - Created:          {created}")
    print(f"   - Verified On-Chain:{verified}")
    print(f"   - Tampered Tests:   {tampered}")
    print(f"   - Total DB Incidents: {total_in_db}")
    print("=" * 65)

if __name__ == "__main__":
    main()
