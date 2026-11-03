#!/usr/bin/env python3
"""
Seed BlockMineGuard to 3100+ total incidents with realistic enterprise telemetry,
cryptojacking campaigns, benign workloads, deterministic SHA-256 evidence digests,
and full verification/resolution states.
"""

import sys
import os
import time
import random
import json
import sqlite3
import hashlib
import uuid
from datetime import datetime, timezone, timedelta

# Set up paths to import from backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

from evidence.hasher import EvidenceHasher

DB_PATH = os.path.join(BACKEND_DIR, "blockmineguard.db")

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
    print("  BlockMineGuard: Scaling Incidents to 3,100+ Total")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM incidents")
    current_total = cursor.fetchone()[0]
    print(f"📊 Current Total Incidents in SQLite DB: {current_total}")

    target_total = 3150
    needed = max(0, target_total - current_total)

    if needed == 0:
        print(f"✅ Database already contains {current_total} incidents (target: {target_total}).")
        conn.close()
        return

    print(f"🎯 Target: {target_total} incidents (generating {needed} new records)...")

    now = datetime.now(timezone.utc)
    miner_pool = [{"type": "MINER", "item": m} for m in MINER_TEMPLATES]
    benign_pool = [{"type": "BENIGN", "item": b} for b in BENIGN_TEMPLATES]

    incidents_batch = []
    notes_batch = []
    verif_batch = []

    start_time = time.time()

    for idx in range(1, needed + 1):
        # 60% miner templates, 40% benign
        if random.random() < 0.60:
            selection = random.choice(miner_pool)
            is_miner = True
            p_name, net_dest, base_cpu, base_mem, base_rt, desc, campaign = selection["item"]
        else:
            selection = random.choice(benign_pool)
            is_miner = False
            p_name, net_dest, base_cpu, base_mem, base_rt, desc = selection["item"]
            campaign = ""

        # Jitter
        cpu_val = round(max(5.0, min(99.8, base_cpu + random.uniform(-2.5, 2.5))), 1)
        mem_val = round(max(10.0, min(98.5, base_mem + random.uniform(-3.0, 3.0))), 1)
        rt_val = max(60, int(base_rt + random.uniform(-1200, 1800)))

        use_container = random.choice([True, False])
        container_name = random.choice(CONTAINER_NAMES) if use_container else None
        env = "CONTAINER" if use_container else "HOST"

        # Unique IDs
        inc_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        ext_id = f"EXT-{uuid.uuid4().hex[:10].upper()}"
        proc_unique = f"{p_name}_{idx}_{random.randint(100, 999)}"

        # Realistic Risk Score & Severity
        if is_miner:
            if cpu_val >= 90.0:
                risk_score = random.randint(85, 99)
                severity = "CRITICAL"
            else:
                risk_score = random.randint(70, 84)
                severity = "HIGH"
        else:
            if cpu_val >= 70.0:
                risk_score = random.randint(40, 68)
                severity = "MEDIUM"
            else:
                risk_score = random.randint(10, 38)
                severity = "LOW"

        # Timestamp distribution across past 60 days
        skew = (idx / needed) ** 1.2
        days_ago = 60.0 * (1.0 - skew)
        offset_seconds = days_ago * 86400 + random.uniform(-1800, 1800)
        hist_time = now - timedelta(seconds=max(0, offset_seconds))
        hist_iso = hist_time.isoformat()

        threat_intel_ref = campaign if (is_miner and random.random() < 0.6) else ""

        factors = {
            "cpu_usage": cpu_val,
            "memory_usage": mem_val,
            "runtime_factor": 1.25 if rt_val > 10000 else 1.0,
            "network_anomaly": bool(net_dest),
            "threat_intel_match": bool(threat_intel_ref)
        }
        factors_json = json.dumps(factors)

        # Deterministic Canonical Evidence Dict
        canonical_evidence = {
            "incident_id": inc_id,
            "timestamp": hist_iso,
            "cpu_usage": cpu_val,
            "memory_usage": mem_val,
            "process_name": proc_unique,
            "process_runtime_seconds": rt_val,
            "network_destination": net_dest or "",
            "container_name": container_name or "",
            "environment": env,
            "risk_score": risk_score,
            "severity": severity,
            "factors": factors
        }

        # Deterministic Canonical SHA-256 Hash
        evidence_hash = EvidenceHasher.hash_dict(canonical_evidence)

        # Blockchain Anchor Status (~75% on-chain)
        on_chain = random.random() < 0.75
        if on_chain:
            tx_seed = f"{inc_id}-{idx}-{hist_iso}"
            tx_hash = "0x" + hashlib.sha256(tx_seed.encode()).hexdigest()
            blockchain_inc_id = current_total + idx
        else:
            tx_hash = None
            blockchain_inc_id = None

        # Verification Status (~65% Verified, ~8% Tampered, ~27% Unverified)
        v_rand = random.random()
        if v_rand < 0.65:
            verification_status = "VERIFIED"
        elif v_rand < 0.73:
            verification_status = "TAMPERED"
        else:
            verification_status = "UNVERIFIED"

        # Resolution Status (~48% Resolved, ~32% In Progress, ~20% Open)
        r_rand = random.random()
        if r_rand < 0.48:
            resolution_status = "RESOLVED"
        elif r_rand < 0.80:
            resolution_status = "IN_PROGRESS"
        else:
            resolution_status = "OPEN"

        reporter_address = f"0x{hashlib.sha256(str(idx % 12).encode()).hexdigest()[:40]}"

        incidents_batch.append((
            inc_id, ext_id, evidence_hash, hist_iso,
            cpu_val, mem_val, proc_unique, rt_val,
            net_dest or None, container_name, env,
            risk_score, severity, factors_json,
            tx_hash, blockchain_inc_id,
            verification_status, resolution_status,
            threat_intel_ref or None, reporter_address,
            hist_iso, hist_iso
        ))

        # Verification history record
        if verification_status in ("VERIFIED", "TAMPERED"):
            verif_batch.append((
                inc_id,
                "VERIFIED_MATCH" if verification_status == "VERIFIED" else "TAMPERED_HASH_MISMATCH",
                evidence_hash,
                evidence_hash,
                evidence_hash if verification_status == "VERIFIED" else "0x" + hashlib.sha256(b"altered").hexdigest(),
                reporter_address,
                tx_hash,
                14200000 + idx,
                45000 + random.randint(100, 5000),
                json.dumps({"verified_via": "smart_contract", "auto_attested": True}),
                hist_iso
            ))

        # Add SOC note for ~28% of incidents
        if random.random() < 0.28:
            note_content = f"{desc}. {random.choice(SOC_NOTE_TEMPLATES)}"
            author = random.choice(SOC_ANALYSTS)
            notes_batch.append((inc_id, author, note_content, hist_iso))

    print(f"💾 Inserting {len(incidents_batch)} incidents into database...")
    cursor.executemany("""
        INSERT INTO incidents (
            incident_id, external_id, evidence_hash, timestamp,
            cpu_usage, memory_usage, process_name, process_runtime_seconds,
            network_destination, container_name, environment,
            risk_score, severity, factors,
            blockchain_tx_hash, blockchain_incident_id,
            verification_status, resolution_status,
            threat_intel_ref, reporter_address,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, incidents_batch)

    if verif_batch:
        cursor.executemany("""
            INSERT INTO verification_history (
                incident_id, verification_outcome, computed_hash,
                stored_hash, on_chain_hash, verifier_address,
                blockchain_tx_hash, block_number, gas_used,
                details, verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, verif_batch)

    if notes_batch:
        cursor.executemany("""
            INSERT INTO incident_notes (incident_id, author, note, created_at)
            VALUES (?, ?, ?, ?)
        """, notes_batch)

    conn.commit()

    # Re-query counts
    cursor.execute("SELECT COUNT(*) FROM incidents")
    final_total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE severity = 'CRITICAL'")
    final_critical = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE severity = 'HIGH'")
    final_high = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE severity = 'MEDIUM'")
    final_medium = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE severity = 'LOW'")
    final_low = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE verification_status = 'VERIFIED'")
    final_verified = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE verification_status = 'TAMPERED'")
    final_tampered = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM incidents WHERE resolution_status = 'RESOLVED'")
    final_resolved = cursor.fetchone()[0]

    conn.close()

    elapsed = round(time.time() - start_time, 2)
    print("\n" + "=" * 70)
    print(f"🎉 SUCCESS: Scaled to {final_total:,} Total Incidents in {elapsed}s!")
    print(f"   - Total Incidents:         {final_total:,}")
    print(f"   - Critical Severity:       {final_critical:,}")
    print(f"   - High Severity:           {final_high:,}")
    print(f"   - Medium Severity:         {final_medium:,}")
    print(f"   - Low Severity:            {final_low:,}")
    print(f"   - Verified On-Chain:       {final_verified:,}")
    print(f"   - Tampered Tests:          {final_tampered:,}")
    print(f"   - Resolved Incidents:      {final_resolved:,}")
    print("=" * 70)

if __name__ == "__main__":
    main()
