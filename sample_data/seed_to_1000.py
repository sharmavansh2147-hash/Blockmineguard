#!/usr/bin/env python3
"""
Seed BlockMineGuard to 1050+ total incidents with realistic enterprise telemetry,
cryptojacking campaigns, benign workloads, and verification states.
"""

import sys
import os
import time
import random
import sqlite3
from datetime import datetime, timezone, timedelta
import requests

API_URL = "http://127.0.0.1:5001"
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "blockmineguard.db")

MINER_TEMPLATES = [
    # (process_name, network_dest, base_cpu, base_mem, base_runtime, description, campaign)
    ("xmrig-randomx-avx2", "pool.supportxmr.com:3333", 98.4, 88.0, 19200, "Advanced XMRig RandomX fork with AVX2 CPU vectorization", "XMR-GLOBAL-01"),
    ("kdevtmpfsi-redis-worm", "xmr.2miners.com:2222", 96.2, 83.5, 16800, "Kdevtmpfsi payload dropped via unauthenticated Redis server", "REDIS-XMR-BOT"),
    ("kinsing-docker-escape", "194.38.20.12:443", 99.1, 91.0, 24500, "Kinsing botnet daemon leveraging exposed Docker socket", "KINSING-WORM"),
    ("sysrv-hello-spring4shell", "darknet-pool.cc:3333", 95.5, 82.0, 14200, "Sysrv-Hello cross-platform worm spreading via Spring4Shell", "SYSRV-SPRING"),
    ("pwnrig-stealth-thread", "nanopool.org:14444", 97.5, 86.5, 21800, "Pwnrig stealth mining thread with encrypted TLS stratum", "PWNRIG-CLUSTER"),
    ("xmrig-proxy-aggregator", "moneroocean.stream:10128", 98.8, 92.5, 31200, "XMRig Proxy aggregation cluster routing hashes to MoneroOcean", "XMR-OCEAN-NET"),
    ("watchdog-cron-miner", "stratum.nicehash.com:3380", 94.6, 84.0, 18400, "WatchDog cron persistence worker executing NiceHash stratum", "WATCHDOG-SWARM"),
    ("lemonduck-powershell", "pool.minexmr.com:4444", 96.0, 83.0, 21000, "LemonDuck multi-stage cryptojacking worm spreading via SMB", "LEMONDUCK-CORP"),
    ("8220-gang-docker-miner", "8220.pool-operator.xyz:8080", 98.9, 90.0, 26800, "8220 Gang compromised Docker socket miner execution", "8220-GANG-GLOBAL"),
    ("syno-miner-nas-worm", "pool.hashvault.pro:80", 95.0, 81.0, 17200, "Synology NAS brute-forced storage miner process", "NAS-EXPLOIT-01"),
    ("ghostminer-wmi-inject", "ghost.cryptopool.io:3333", 97.8, 88.5, 23400, "GhostMiner fileless WMI memory injection executing cryptonight", "GHOSTMINER-WMI"),
    ("redisscan-xmr-worker", "redis-monero.c3pool.com:13333", 96.2, 85.5, 19800, "Redis replication payload mining Monero on worker node", "REDISSCAN-C3"),
    ("log4j-jndi-miner-v3", "xmr.2miners.com:2222", 99.4, 93.0, 28900, "Log4Shell RCE automated mining bot deployment", "LOG4SHELL-MINER"),
    ("confluence-miner-ognl", "pool.supportxmr.com:80", 97.0, 87.0, 24100, "Confluence OGNL remote code execution miner execution", "CONFLUENCE-OGNL"),
    ("struts-rest-miner", "xmr-eu1.nanopool.org:14444", 95.5, 83.5, 15800, "Apache Struts REST plugin RCE cryptominer drop", "STRUTS-RCE-02"),
    ("ethminer-opencl-worker", "eu1.ethermine.org:4444", 88.5, 76.0, 9200, "Ethminer OpenCL compute daemon on compromised GPU pod", "GPU-HIJACK-ETH"),
    ("nanominer-kawpow-core", "rvn.2miners.com:6060", 87.0, 75.0, 6900, "Nanominer Ravencoin Kawpow GPU/CPU proof-of-work algorithm", "RAVEN-KAWPOW"),
    ("nbminer-stratum-proxy", "xmrpool.eu:9999", 85.5, 73.0, 7600, "NBMiner cross-chain stratum protocol worker thread", "NBMINER-STRATUM"),
    ("t-rex-cuda-hijack", "stratum.nicehash.com:3380", 86.5, 79.5, 10500, "T-Rex CUDA compute wrapper inside research container", "CUDA-RESEARCH-THREAT"),
    ("lolminer-beam-hash", "beam.leafpool.com:3333", 84.8, 72.0, 8300, "Lolminer Beam Equihash proof-of-work algorithm daemon", "BEAM-LEAFPOOL"),
    ("srbminer-kaspa-multi", "kas.woolypooly.com:3112", 87.2, 74.0, 7900, "SRBMiner Heavy Kaspa algorithm execution thread", "SRB-KASPA-WORKER"),
    ("teamredminer-ergo-autolykos", "ergo.herominers.com:1180", 88.1, 75.5, 9300, "TeamRedMiner Autolykos algorithmic workload process", "ERGO-HEROMINERS"),
    ("wildrig-ghostrider-cpu", "ghostrider.raptoreum.zone:3333", 86.8, 73.5, 8500, "WildRig GhostRider CPU cache thrashing miner", "RAPTOREUM-GHOST"),
    ("gminer-equihash-proxy", "beam-pool.leafpool.com:3333", 89.2, 77.5, 9000, "GMiner Equihash algorithm mining daemon", "GMINER-EQUIHASH"),
    ("bminer-heavy-worker", "sparkpool.com:2222", 88.4, 76.8, 9700, "Bminer CryptoNight-Heavy thread executing unauthorized compute", "BMINER-SPARK"),
    ("cryptodredge-lyra-pod", "pool.bsod.pw:2222", 86.2, 74.0, 7200, "CryptoDredge Lyra2REv3 miner execution in test pod", "DREDGE-LYRA-01"),
    ("phoenixminer-ethash-cl", "nanopool.org:9999", 91.5, 80.5, 11200, "PhoenixMiner Ethash execution thread on node", "PHOENIX-ETHASH"),
    ("xmr-stak-rx-enterprise", "crypto-pool.fr:3333", 93.4, 82.5, 13800, "XMR-Stak RandomX algorithm on enterprise server", "XMR-STAK-FR"),
    ("cast-xmr-vega-thread", "supportxmr.com:7777", 89.8, 78.5, 8900, "Cast XMR OpenCL Vega compute process", "CAST-VEGA-POOL"),
    ("nplusminer-profit-switch", "miningpoolhub.com:20585", 88.0, 76.0, 9500, "NplusMiner Auto-profit switching agent process", "NPLUS-PROFIT-SWITCH"),
    ("ccminer-klaust-thread", "pool.rplant.xyz:7022", 88.7, 76.5, 8200, "CCMiner KlausT cryptonight branch worker", "CCMINER-RPLANT"),
    ("claymore-dual-miner", "ethermine.org:4444", 92.4, 81.8, 12800, "Claymore Dual Ethereum Miner process executing covertly", "CLAYMORE-DUAL-ETH"),
    ("onezerominer-dynex-net", "neuropool.net:19330", 89.4, 77.2, 8700, "OneZeroMiner Dynex neuromorphic compute mining thread", "DYNEX-NEUROPOOL"),
    ("rigel-miner-blake-core", "herominers.com:1190", 87.8, 74.5, 8100, "Rigel Miner Blake3 high-intensity thread execution", "RIGEL-BLAKE3-HERO")
]

BENIGN_TEMPLATES = [
    # (process_name, network_dest, base_cpu, base_mem, base_runtime, description)
    ("clang++_llvm_lto", None, 76.5, 68.0, 4100, "Clang LLVM code generation compilation pass with LTO"),
    ("rustc_incremental_build", "crates.io:443", 78.2, 70.0, 4600, "Rustc incremental release build with dependency download"),
    ("gcc_parallel_kernel_build", None, 74.0, 65.0, 3800, "GCC parallel build of Linux kernel headers"),
    ("go_race_detector_eval", "proxy.golang.org:443", 75.8, 67.0, 3900, "Go compiler execution with race condition detector"),
    ("ffmpeg_av1_transcode", "s3.internal-media.org:443", 79.5, 72.0, 5200, "FFmpeg Apple ProRes to AV1 multi-threaded video transcoding"),
    ("blender_cycles_gpu_bake", None, 81.0, 75.0, 6400, "Blender Cycles GPU/CPU lighting and shadow bake"),
    ("postgres_reindex_batch", "db-primary.internal:5432", 72.4, 69.0, 4300, "PostgreSQL REINDEX database maintenance operation"),
    ("es_segment_merger_task", "es-cluster.corp:9200", 69.8, 71.0, 4700, "Elasticsearch Lucene index segment merging and optimization"),
    ("spark_dataframe_join_opt", "hdfs-master.corp:9000", 77.5, 76.0, 5000, "Apache Spark distributed broadcast hash join computation"),
    ("pytorch_model_epoch_train", "s3.ml-models.corp:443", 80.2, 78.0, 5800, "PyTorch model evaluation epoch validation training run"),
    ("zstd_level19_compressor", "nfs-backup.corp:2049", 75.0, 63.0, 4000, "Zstandard compression of daily database forensic dump"),
    ("docker_buildkit_cache", "registry.gitlab.com:443", 76.8, 66.0, 3850, "Buildkit multi-stage container image caching pipeline"),
    ("webpack_terser_minifier", None, 73.5, 64.0, 3700, "Webpack Terser JS production chunk bundle minification"),
    ("kafka_broker_log_compactor", "kafka-broker-02.prod:9092", 68.5, 66.0, 4100, "Kafka topic log compaction cleaner thread processing partitions"),
    ("clickhouse_mergetree_task", "clickhouse.internal:9000", 71.0, 67.5, 4500, "ClickHouse MergeTree part storage consolidation operation"),
    ("vault_key_rotation_batch", "consul-cluster.corp:8500", 64.0, 58.0, 3620, "HashiCorp Vault key rotation batch lifecycle management"),
    ("prometheus_tsdb_compactor", "thanos-storage.corp:10901", 66.0, 64.0, 3900, "Prometheus 2-hour TSDB block compaction and upload"),
    ("nginx_high_concurrency_load", "cdn.internal.org:443", 38.0, 42.0, 110000, "Nginx reverse proxy under sustained high concurrency traffic"),
    ("envoy_mesh_proxy_worker", "service-mesh.k8s:15010", 35.0, 44.0, 98000, "Envoy proxy processing mTLS microservice mesh traffic"),
    ("calico_bgp_route_sync", "calico-typha.k8s:5473", 22.0, 36.0, 160000, "Calico BGP routing mesh synchronization daemon"),
    ("systemd_udevd_hw_scan", None, 14.0, 26.0, 180000, "Linux systemd udevd device manager background scan"),
    ("falco_ebpf_kernel_probe", "falcosidekick.k8s:2801", 16.0, 30.0, 190000, "Falco eBPF kernel event detection engine probe"),
    ("osquery_security_posture", "fleetdm.security.corp:443", 13.5, 29.0, 95000, "Osquery scheduled security posture scanner"),
    ("vector_syslog_aggregator", "clickhouse.internal:9000", 18.0, 32.0, 120000, "Vector pipeline collecting cluster syslog metrics"),
    ("kubelet_pod_reconciler", "k8s-apiserver.infra:6443", 11.0, 22.0, 220000, "Kubelet pod lifecycle status reconciler thread"),
    ("coredns_cache_lookup", "upstream-dns.corp:53", 15.0, 28.0, 230000, "CoreDNS distributed DNS response caching daemon"),
    ("rsync_storage_snapshot", "nas-backup.internal:873", 26.0, 34.0, 3650, "Rsync storage snapshot synchronization task")
]

CONTAINER_NAMES = [
    "k8s-worker-node-alpha", "k8s-worker-node-beta", "prod-redis-cache-01",
    "prod-redis-cache-02", "staging-api-gateway", "edge-ingress-proxy-01",
    "ml-training-gpu-node", "media-processing-pool", "billing-microservice-01",
    "auth-keycloak-pod", "ci-runner-gitlab-05", "ci-runner-gitlab-06",
    "bmg-web-worker-01", "bmg-cryptominer-eval-02", "k8s-ingress-controller",
    "analytics-stream-processor-03"
]

SOC_ANALYSTS = [
    "SOC Lead (0xf39F...2266)",
    "Autonomous Radar Agent",
    "Incident Commander",
    "Senior Threat Hunter",
    "Digital Forensics Lead",
    "Blockchain Validator Node",
    "EBPF Host Sentinel"
]

SOC_NOTE_TEMPLATES = [
    "Identified unauthorized egress connection matching known Stratum protocol. Automated cgroup throttle recommended.",
    "CPU telemetry spike correlated with anomalous process execution. Memory dump archived for volatility analysis.",
    "Evidence digest verified against Hardhat ThreatRegistry contract. Cryptographic hash match confirmed.",
    "Container isolated in controlled sandbox namespace. Incident reviewed and authorized by Incident Commander.",
    "Benign compiler load validated against build system metadata. Threshold dampening applied.",
    "Host telemetry normalized post-containment. Zero residual mining socket connections observed.",
    "Threat indicator matched existing intelligence campaign entry. Reporter reputation reward dispatched."
]

def main():
    print("=" * 70)
    print("  BlockMineGuard: Enterprise Incident Scalability Seeder (1050+ Target)")
    print("=" * 70)

    # 1. Check current stats
    try:
        r = requests.get(f"{API_URL}/stats", timeout=5)
        current_stats = r.json()
        current_total = current_stats.get("total_incidents", 0)
        print(f"📊 Current Total Incidents in DB: {current_total}")
    except Exception as e:
        print(f"❌ Could not connect to API: {e}")
        sys.exit(1)

    target_total = 1050
    needed = max(0, target_total - current_total)
    if needed == 0:
        print(f"✅ Already at or above target {target_total} incidents ({current_total} total).")
        return

    print(f"🎯 Target: {target_total} total incidents.")
    print(f"⚡ Generating {needed} high-fidelity incidents via Flask API & Hardhat Blockchain...")

    # Build pool: 65% miners, 35% benign
    miner_pool = [{"type": "MINER", "item": m} for m in MINER_TEMPLATES]
    benign_pool = [{"type": "BENIGN", "item": b} for b in BENIGN_TEMPLATES]

    created_ids = []
    start_time = time.time()

    # Seed loop
    for idx in range(1, needed + 1):
        # Pick template
        if random.random() < 0.65:
            selection = random.choice(miner_pool)
            is_miner = True
            p_name, net_dest, cpu, mem, rt, desc, campaign = selection["item"]
        else:
            selection = random.choice(benign_pool)
            is_miner = False
            p_name, net_dest, cpu, mem, rt, desc = selection["item"]
            campaign = ""

        # Apply realistic jitter
        cpu_val = round(max(5.0, min(99.8, cpu + random.uniform(-2.5, 2.5))), 1)
        mem_val = round(max(10.0, min(98.5, mem + random.uniform(-3.0, 3.0))), 1)
        rt_val = max(60, int(rt + random.uniform(-1200, 1800)))

        use_container = random.choice([True, False])
        container_name = random.choice(CONTAINER_NAMES) if use_container else None
        env = "CONTAINER" if use_container else "HOST"

        # Unique identifier to ensure distinct evidence hashes
        proc_unique = f"{p_name}_{idx}_{random.randint(1000, 9999)}"

        payload = {
            "cpu_usage": cpu_val,
            "memory_usage": mem_val,
            "process_name": proc_unique,
            "process_runtime_seconds": rt_val,
            "network_destination": net_dest,
            "container_name": container_name,
            "environment": env,
            "threat_intel_ref": campaign if (is_miner and random.random() < 0.6) else "",
            "threshold": 0
        }

        try:
            res = requests.post(f"{API_URL}/incidents", json=payload, timeout=10)
            if res.status_code != 201:
                # If below threshold or duplicate, retry with guaranteed miner
                continue

            data = res.json()
            inc_id = data["incident_id"]
            created_ids.append(inc_id)

            # Verification: ~65% verify, ~10% tamper, ~25% unverified
            v_rand = random.random()
            if v_rand < 0.65:
                # Verify authentic
                requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={}, timeout=5)
            elif v_rand < 0.75:
                # Simulate tamper test
                altered = dict(data["evidence"])
                altered["cpu_usage"] = 14.2
                altered["risk_score"] = 15
                altered["severity"] = "LOW"
                requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={"evidence": altered}, timeout=5)

            # Resolution: ~45% RESOLVED, ~35% IN_PROGRESS, ~20% OPEN
            r_rand = random.random()
            if r_rand < 0.45:
                requests.post(f"{API_URL}/incidents/{inc_id}/resolve", json={"resolution": "RESOLVED"}, timeout=5)
            elif r_rand < 0.80:
                requests.post(f"{API_URL}/incidents/{inc_id}/resolve", json={"resolution": "IN_PROGRESS"}, timeout=5)

            # Add SOC Note for ~30% of incidents
            if random.random() < 0.30:
                requests.post(
                    f"{API_URL}/incidents/{inc_id}/notes",
                    json={
                        "note": f"{desc}. {random.choice(SOC_NOTE_TEMPLATES)}",
                        "author": random.choice(SOC_ANALYSTS)
                    },
                    timeout=5
                )

            # Progress update every 50 items
            if idx % 50 == 0 or idx == needed:
                elapsed = round(time.time() - start_time, 1)
                rate = round(idx / max(elapsed, 0.1), 1)
                print(f"[{idx}/{needed}] 🚀 Seeded: {inc_id} | Total so far: {current_total + len(created_ids)} | Rate: {rate} inc/sec ({elapsed}s)")

        except Exception as e:
            print(f"[{idx}/{needed}] ⚠️ Error on {proc_unique}: {e}")

    elapsed_total = round(time.time() - start_time, 1)
    print(f"\n⚡ Ingest complete: {len(created_ids)} new incidents registered in {elapsed_total}s!")

    # 2. Historical Temporal Distribution:
    # Spread timestamps evenly across the past 45 days in SQLite so timeline charts and filters reflect realistic telemetry
    print("\n⏳ Applying realistic historical temporal distribution across past 45 days...")
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM incidents ORDER BY id ASC")
        all_rows = cursor.fetchall()
        total_rows = len(all_rows)

        now = datetime.now(timezone.utc)
        for rank, row in enumerate(all_rows):
            row_id = row[0]
            # Quadratic skew: older days have steady volume, recent days have higher activity
            skew = (rank / total_rows) ** 1.3
            days_ago = 45.0 * (1.0 - skew)
            offset_seconds = days_ago * 86400 + random.uniform(-1800, 1800)
            hist_time = now - timedelta(seconds=max(0, offset_seconds))
            hist_iso = hist_time.isoformat()

            cursor.execute(
                "UPDATE incidents SET timestamp = ?, created_at = ?, updated_at = ? WHERE id = ?",
                (hist_iso, hist_iso, hist_iso, row_id)
            )

        conn.commit()
        conn.close()
        print(f"✅ Successfully distributed {total_rows} incident timestamps across past 45 days.")
    except Exception as e:
        print(f"⚠️ Timestamp distribution notice: {e}")

    # 3. Final Stats Verification
    try:
        final_stats = requests.get(f"{API_URL}/stats", timeout=5).json()
        print("\n" + "=" * 70)
        print("🎉 Seeding to 1050+ Complete!")
        print(f"   - Total Incidents in DB:    {final_stats.get('total_incidents')}")
        print(f"   - Critical Severity:        {final_stats.get('critical_severity')}")
        print(f"   - High Severity:            {final_stats.get('high_severity')}")
        print(f"   - Medium Severity:          {final_stats.get('medium_severity')}")
        print(f"   - Low Severity:             {final_stats.get('low_severity')}")
        print(f"   - Verified On Blockchain:   {final_stats.get('verified_incidents')}")
        print(f"   - Tampered Tests:           {final_stats.get('tampered_incidents')}")
        print(f"   - Resolved Incidents:       {final_stats.get('resolved_incidents')}")
        print("=" * 70)
    except Exception as e:
        print(f"Error reading final stats: {e}")

if __name__ == "__main__":
    main()
