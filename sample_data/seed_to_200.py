#!/usr/bin/env python3
"""
Seed 100+ additional enterprise cryptojacking and infrastructure telemetry incidents
to bring the total incidents in BlockMineGuard over 215+.
Covers:
- Risk tiers: Critical, High, Medium, Low
- All states: Verified on Hardhat, Unverified, Tampered, Resolved, In Progress, Open
- Diverse container names, processes, ports, algorithms, and host environments
"""

import sys
import time
import random
import requests

API_URL = "http://127.0.0.1:5001"

MINER_NAMES = [
    ("xmrig-advanced", "pool.supportxmr.com:3333", 98.2, 89.0, 19000, "Advanced XMRig RandomX fork with AVX2 optimizations"),
    ("kdevtmpfsi-v2", "xmr.2miners.com:2222", 96.5, 84.0, 16000, "Kdevtmpfsi payload variant active under web server"),
    ("kinsing-docker", "194.38.20.12:443", 99.1, 91.5, 25000, "Kinsing botnet container escape payload"),
    ("sysrv-hello-x64", "darknet-pool.cc:3333", 95.0, 82.0, 14000, "Sysrv-Hello cross-platform worm spreading via Spring4Shell"),
    ("pwnrig-crypto", "nanopool.org:14444", 97.4, 87.0, 22000, "Pwnrig stealth mining thread with encrypted telemetry"),
    ("xmrig-proxy-agg", "moneroocean.stream:10128", 98.6, 92.0, 31000, "XMRig Proxy aggregation cluster routing hashes"),
    ("watchdog-monero-v2", "stratum.nicehash.com:3380", 94.8, 85.0, 18000, "WatchDog swarm cryptomining service"),
    ("lemonduck-core-v2", "pool.minexmr.com:4444", 96.0, 83.0, 21000, "LemonDuck PowerShell payload spreading via SMB"),
    ("8220-gang-ocean", "8220.pool-operator.xyz:8080", 98.9, 90.0, 27000, "8220 Gang compromised Docker socket miner"),
    ("syno-miner-pro", "pool.hashvault.pro:80", 95.2, 81.0, 17500, "Synology NAS brute-forced storage miner"),
    ("ghostminer-injected-v2", "ghost.cryptopool.io:3333", 97.8, 88.5, 23000, "GhostMiner fileless WMI memory injection"),
    ("redisscan-xmr-worker", "redis-monero.c3pool.com:13333", 96.2, 86.0, 19500, "Redis unauthenticated replication miner drop"),
    ("log4j-jndi-miner-v2", "xmr.2miners.com:2222", 99.4, 93.0, 29000, "Log4Shell RCE automated mining bot deployment"),
    ("confluence-miner-v2", "pool.supportxmr.com:80", 96.9, 87.5, 24000, "Confluence OGNL remote code execution miner"),
    ("struts-miner-v2", "xmr-eu1.nanopool.org:14444", 95.5, 83.5, 16000, "Apache Struts REST plugin RCE cryptominer"),
    ("ethminer-cl", "eu1.ethermine.org:4444", 88.5, 76.0, 9200, "Ethminer OpenCL fallback compute daemon"),
    ("nanominer-kawpow", "rvn.2miners.com:6060", 87.0, 75.0, 6900, "Nanominer Ravencoin GPU/CPU worker"),
    ("nbminer-stratum", "xmrpool.eu:9999", 85.5, 73.0, 7600, "NBMiner cross-chain stratum protocol worker"),
    ("t-rex-cuda-v2", "stratum.nicehash.com:3380", 86.4, 79.5, 10500, "T-Rex CUDA compute wrapper in research pod"),
    ("lolminer-beam-v2", "beam.leafpool.com:3333", 84.8, 72.0, 8300, "Lolminer Beam Equihash proof-of-work algorithm"),
    ("srbminer-kaspa-v2", "kas.woolypooly.com:3112", 87.2, 74.0, 7900, "SRBMiner Heavy Kaspa algorithm execution"),
    ("teamredminer-ergo", "ergo.herominers.com:1180", 88.1, 75.5, 9300, "TeamRedMiner Autolykos algorithmic workload"),
    ("wildrig-multi-v2", "ghostrider.raptoreum.zone:3333", 86.8, 73.5, 8500, "WildRig GhostRider CPU cache thrashing miner"),
    ("gminer-equihash", "beam-pool.leafpool.com:3333", 89.2, 77.5, 9000, "GMiner Equihash algorithm daemon"),
    ("bminer-heavy", "sparkpool.com:2222", 88.4, 76.8, 9700, "Bminer CryptoNight-Heavy thread"),
    ("cryptodredge-lyra", "pool.bsod.pw:2222", 86.2, 74.0, 7200, "CryptoDredge Lyra2REv3 miner execution"),
    ("phoenixminer-ethash", "nanopool.org:9999", 91.5, 80.5, 11200, "PhoenixMiner Ethash execution thread"),
    ("xmr-stak-rx-v2", "crypto-pool.fr:3333", 93.4, 82.5, 13800, "XMR-Stak RandomX algorithm on enterprise node"),
    ("cast-xmr-vega", "supportxmr.com:7777", 89.8, 78.5, 8900, "Cast XMR OpenCL Vega compute process"),
    ("nplusminer-hub", "miningpoolhub.com:20585", 88.0, 76.0, 9500, "NplusMiner Auto-profit switching agent"),
    ("ccminer-klaust-v2", "pool.rplant.xyz:7022", 88.7, 76.5, 8200, "CCMiner KlausT cryptonight branch"),
    ("finminer-dual", "nanopool.org:9999", 90.2, 79.5, 10700, "FinMiner dual ethash mining task"),
    ("claymore-dual-v2", "ethermine.org:4444", 92.4, 81.8, 12800, "Claymore Dual Ethereum Miner process"),
    ("onezerominer-dnx", "neuropool.net:19330", 89.4, 77.2, 8700, "OneZeroMiner Dynex neuromorphic compute"),
    ("rigel-miner-blake", "herominers.com:1190", 87.8, 74.5, 8100, "Rigel Miner Blake3 high-intensity thread")
]

BENIGN_NAMES = [
    ("clang-llvm-worker", None, 76.5, 68.0, 4100, "Clang LLVM code generation compilation pass"),
    ("rustc-incremental", "crates.io:443", 78.2, 70.0, 4600, "Rustc incremental release build with LTO"),
    ("gcc-parallel-build", None, 74.0, 65.0, 3800, "GCC parallel build of Linux kernel headers"),
    ("go-race-detector", "proxy.golang.org:443", 75.8, 67.0, 3900, "Go compiler execution with race condition detector"),
    ("ffmpeg-prores-transcode", "s3.internal-media.org:443", 79.5, 72.0, 5200, "FFmpeg Apple ProRes to AV1 video transcoding"),
    ("blender-cycles-bake", None, 81.0, 75.0, 6400, "Blender Cycles GPU/CPU lighting bake"),
    ("postgres-reindex-all", "db-primary.internal:5432", 72.4, 69.0, 4300, "PostgreSQL REINDEX database maintenance operation"),
    ("es-segment-merger", "es-cluster.corp:9200", 69.8, 71.0, 4700, "Elasticsearch Lucene index segment merging"),
    ("spark-dataframe-join", "hdfs-master.corp:9000", 77.5, 76.0, 5000, "Apache Spark distributed broadcast hash join"),
    ("pytorch-eval-epoch", "s3.ml-models.corp:443", 80.2, 78.0, 5800, "PyTorch model evaluation epoch validation"),
    ("zstd-level19-pack", "nfs-backup.corp:2049", 75.0, 63.0, 4000, "Zstandard compression of daily database dump"),
    ("docker-buildkit-pack", "registry.gitlab.com:443", 76.8, 66.0, 3850, "Buildkit multi-stage container image caching"),
    ("webpack-terser-min", None, 73.5, 64.0, 3700, "Webpack Terser JS production chunk minification"),
    ("kafka-broker-cleaner", "kafka-broker-02.prod:9092", 68.5, 66.0, 4100, "Kafka topic log compaction cleaner thread"),
    ("clickhouse-merge-tree", "clickhouse.internal:9000", 71.0, 67.5, 4500, "ClickHouse MergeTree part storage consolidation"),
    ("vault-key-rotator", "consul-cluster.corp:8500", 64.0, 58.0, 3620, "HashiCorp Vault key rotation batch lifecycle"),
    ("prometheus-storage-comp", "thanos-storage.corp:10901", 66.0, 64.0, 3900, "Prometheus 2-hour TSDB block compaction"),
    ("nginx-high-concurrency", "cdn.internal.org:443", 38.0, 42.0, 110000, "Nginx reverse proxy under sustained high concurrency"),
    ("envoy-mesh-router", "service-mesh.k8s:15010", 35.0, 44.0, 98000, "Envoy proxy processing mTLS microservice traffic"),
    ("calico-bgp-mesh", "calico-typha.k8s:5473", 22.0, 36.0, 160000, "Calico BGP routing mesh synchronization"),
    ("systemd-udevd-scan", None, 14.0, 26.0, 180000, "Linux systemd udevd device manager scan"),
    ("falco-kernel-monitor", "falcosidekick.k8s:2801", 16.0, 30.0, 190000, "Falco eBPF kernel event detection engine"),
    ("osquery-security-cron", "fleetdm.security.corp:443", 13.5, 29.0, 95000, "Osquery scheduled security posture scanner"),
    ("vector-syslog-sink", "clickhouse.internal:9000", 18.0, 32.0, 120000, "Vector pipeline collecting cluster syslog metrics"),
    ("kubelet-pod-sync", "k8s-apiserver.infra:6443", 11.0, 22.0, 220000, "Kubelet pod lifecycle status reconciler"),
    ("coredns-cache-worker", "upstream-dns.corp:53", 15.0, 28.0, 230000, "CoreDNS distributed DNS response caching"),
    ("rsync-snapshot-sync", "nas-backup.internal:873", 26.0, 34.0, 3650, "Rsync storage snapshot synchronization")
]

CONTAINERS = [
    "k8s-worker-node-alpha", "k8s-worker-node-beta", "prod-redis-cache-01",
    "prod-redis-cache-02", "staging-api-gateway", "edge-ingress-proxy-01",
    "ml-training-gpu-node", "media-processing-pool", "billing-microservice-01",
    "auth-keycloak-pod", "ci-runner-gitlab-05", "ci-runner-gitlab-06"
]

def main():
    print("=" * 65)
    print("  BlockMineGuard: Seeding to 215+ Incidents")
    print("=" * 65)

    try:
        r = requests.get(f"{API_URL}/stats", timeout=5)
        current_stats = r.json()
        current_total = current_stats.get("total_incidents", 0)
        print(f"📊 Current Total Incidents in DB: {current_total}")
    except Exception as e:
        print(f"❌ Could not connect to API: {e}")
        sys.exit(1)

    target_total = 215
    needed = max(0, target_total - current_total)
    if needed == 0:
        needed = 20  # seed extra anyway
    print(f"🎯 Target: {target_total} (Generating at least {needed} new incidents)...")

    created = 0
    verified = 0
    tampered = 0

    # Combine pools to generate diverse items
    pool = []
    # Add all miners
    for m in MINER_NAMES:
        pool.append({"type": "MINER", "data": m})
    # Add benign
    for b in BENIGN_NAMES:
        pool.append({"type": "BENIGN", "data": b})

    # Shuffle and repeat if needed to create enough
    random.seed(42)
    selected_items = []
    while len(selected_items) < needed + 5:
        shuffled = list(pool)
        random.shuffle(shuffled)
        selected_items.extend(shuffled)
    selected_items = selected_items[:needed + 5]

    for idx, item in enumerate(selected_items, start=1):
        is_miner = (item["type"] == "MINER")
        p_name, net_dest, cpu, mem, rt, desc = item["data"]

        # Add unique jitter to ensure completely unique evidence hashes
        jitter_cpu = round(max(5.0, min(99.9, cpu + random.uniform(-1.5, 1.5))), 1)
        jitter_mem = round(max(10.0, min(98.0, mem + random.uniform(-2.0, 2.0))), 1)
        jitter_rt = rt + random.randint(10, 500)
        
        # Decide container vs host
        use_container = random.choice([True, False])
        container_name = random.choice(CONTAINERS) if use_container else None
        env = "CONTAINER" if use_container else "HOST"

        # Unique process suffix to guarantee unique process & evidence hash
        proc_identifier = f"{p_name}_{idx}_{random.randint(100, 999)}"

        payload = {
            "cpu_usage": jitter_cpu,
            "memory_usage": jitter_mem,
            "process_name": proc_identifier,
            "process_runtime_seconds": jitter_rt,
            "network_destination": net_dest,
            "container_name": container_name,
            "environment": env,
            "threat_intel_ref": f"TI-AUTO-{random.randint(100, 999)}" if is_miner and random.random() > 0.5 else "",
            "threshold": 0
        }

        try:
            res = requests.post(f"{API_URL}/incidents", json=payload, timeout=10)
            if res.status_code != 201:
                print(f"[{idx}/{len(selected_items)}] ⚠️ Skip: {res.text[:50]}")
                continue

            data = res.json()
            inc_id = data["incident_id"]
            score = data["risk_score"]["score"]
            severity = data["risk_score"]["severity"]
            created += 1

            # Add SOC note
            requests.post(
                f"{API_URL}/incidents/{inc_id}/notes",
                json={
                    "note": f"Automated SOC ingest: {desc}. Observed on {env} ({container_name or 'bare-metal host'}).",
                    "author": "Security Orchestrator"
                },
                timeout=5
            )

            # Verification logic
            rand_action = random.random()
            if rand_action < 0.65:
                # 65% get verified on chain
                v_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={}, timeout=10)
                if v_res.status_code == 200:
                    verified += 1
            elif rand_action < 0.75:
                # 10% tamper test
                altered = dict(data["evidence"])
                altered["cpu_usage"] = 12.0
                altered["risk_score"] = 15
                altered["severity"] = "LOW"
                t_res = requests.post(f"{API_URL}/incidents/{inc_id}/verify", json={"evidence": altered}, timeout=10)
                if t_res.status_code == 200:
                    tampered += 1

            # Resolution status
            if is_miner:
                res_choice = random.choice(["OPEN", "IN_PROGRESS", "RESOLVED"])
            else:
                res_choice = random.choice(["RESOLVED", "RESOLVED", "OPEN"])
            
            if res_choice != "OPEN":
                requests.post(f"{API_URL}/incidents/{inc_id}/resolve", json={"resolution": res_choice}, timeout=10)

            if idx % 5 == 0 or idx == len(selected_items):
                print(f"[{idx}/{len(selected_items)}] ✅ {inc_id} | {severity:8} ({score:2}/100) | Total now: {current_total + created}")
        except Exception as e:
            print(f"[{idx}/{len(selected_items)}] ❌ Error: {e}")

        time.sleep(0.04)

    # Check final stats
    try:
        final_stats = requests.get(f"{API_URL}/stats", timeout=5).json()
        print("\n" + "=" * 65)
        print("🎉 Seeding Complete!")
        print(f"   - Total Incidents in DB: {final_stats.get('total_incidents')}")
        print(f"   - Critical Severity:    {final_stats.get('critical_severity')}")
        print(f"   - High Severity:        {final_stats.get('high_severity')}")
        print(f"   - Medium Severity:      {final_stats.get('medium_severity')}")
        print(f"   - Low Severity:         {final_stats.get('low_severity')}")
        print(f"   - Verified On Chain:    {final_stats.get('verified_incidents')}")
        print(f"   - Tampered Tests:       {final_stats.get('tampered_incidents')}")
        print(f"   - Resolved Incidents:   {final_stats.get('resolved_incidents')}")
        print("=" * 65)
    except Exception as e:
        print(f"Error fetching final stats: {e}")

if __name__ == "__main__":
    main()
