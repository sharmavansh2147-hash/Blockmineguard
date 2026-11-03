"""
Evaluation pipeline for BlockMineGuard cryptojacking detection engine.
Uses labelled, safe synthetic workloads to calculate:
- Accuracy, Precision, Recall, F1-Score, False Positive Rate (FPR)
- Confusion Matrix (TP, FP, TN, FN)
- Configurable thresholds and dataset metadata
- Academic disclaimer distinguishing synthetic lab workloads from production networks.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detector.detection_engine import DetectionEngine, TelemetryData


@dataclass
class LabelledWorkload:
    telemetry: TelemetryData
    is_cryptojacking: bool  # Ground truth label: True = Malicious cryptojacking, False = Benign workload
    description: str
    category: str


def get_default_synthetic_dataset() -> List[LabelledWorkload]:
    """
    Returns a reproducible, safe labelled synthetic benchmark of 100 workloads:
    - 50 True Cryptojacking threats (various miners, evasion attempts, stratum pools, high CPU/mem)
    - 50 Benign enterprise workloads (compilers, databases, video transcoders, cron, microservices)
    """
    workloads: List[LabelledWorkload] = []

    # =========================================================================
    # CLASS 1: CRYPTOJACKING THREATS (50 samples, Ground Truth = True)
    # =========================================================================
    
    # 1.1 Classic High-Intensity CPU Miners
    high_intensity_miners = [
        ("xmrig", 98.5, 88.0, 18000, "pool.supportxmr.com:3333", "Monero XMRig High Intensity", "Direct Miner"),
        ("xmrig", 94.0, 82.5, 12000, "xmr.2miners.com:2222", "XMRig Multi-core Thread", "Direct Miner"),
        ("cpuminer-multi", 91.0, 78.0, 7200, "stratum+tcp://minexmr.com:4444", "Cpuminer Multi Stratum", "Direct Miner"),
        ("cpuminer-opt", 89.5, 75.0, 8400, "pool.minexmr.com:5555", "Cpuminer Optimized AVX", "Direct Miner"),
        ("minerd", 96.0, 85.0, 14400, "stratum.monerohash.com:3333", "Legacy Minerd Process", "Direct Miner"),
        ("ethminer", 88.0, 76.0, 9000, "eu1.ethermine.org:4444", "Ethminer GPU/CPU Fallback", "Direct Miner"),
        ("nanominer", 87.5, 74.0, 6800, "rvn.2miners.com:6060", "Nanominer Kawpow Worker", "Direct Miner"),
        ("nbminer", 85.0, 72.0, 7500, "xmrpool.eu:9999", "NBMiner Cross-Coin Mining", "Direct Miner"),
        ("t-rex", 86.0, 79.0, 10200, "stratum.nicehash.com:3380", "T-Rex CUDA Wrapper Miner", "Direct Miner"),
        ("lolminer", 84.5, 71.0, 8100, "beam.leafpool.com:3333", "Lolminer Beam Equihash", "Direct Miner"),
    ]
    for p, cpu, mem, rt, net, desc, cat in high_intensity_miners:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="HOST"),
            is_cryptojacking=True, description=desc, category=cat
        ))

    # 1.2 Container-Infiltrated & Worm-Spread Miners
    container_miners = [
        ("kinsing", 99.0, 89.0, 24000, "194.38.20.12:443", "Kinsing Redis Infiltration", "Container Malware"),
        ("kdevtmpfsi", 97.0, 83.0, 21000, "pool.supportxmr.com:5555", "Kdevtmpfsi PHP Web Shell Drop", "Container Malware"),
        ("sysrv-hello", 95.5, 81.0, 15000, "darknet-pool.cc:3333", "Sysrv-Hello Multi-Arch Worm", "Container Malware"),
        ("pwnrig", 98.0, 86.5, 26000, "nanopool.org:14444", "Pwnrig Stealth Binary", "Container Malware"),
        ("xmrig-proxy", 97.5, 90.0, 31000, "moneroocean.stream:10128", "XMRig Proxy Aggregator", "Container Malware"),
        ("watchdog-miner", 94.8, 84.0, 18500, "stratum.nicehash.com:3380", "WatchDog Swarm Hijacker", "Container Malware"),
        ("lemonduck_core", 96.2, 82.0, 23000, "pool.minexmr.com:4444", "LemonDuck SMB Spreader", "Container Malware"),
        ("8220_tsunami", 98.8, 91.0, 29000, "8220.pool-operator.xyz:8080", "8220 Gang Botnet Miner", "Container Malware"),
        ("nanominer-k8s", 93.0, 80.0, 12000, "stratum.hiveon.net:8888", "Kubernetes Compromised Pod Miner", "Container Malware"),
        ("syno-miner", 95.0, 79.0, 19000, "pool.hashvault.pro:80", "Synology NAS Cryptominer", "Container Malware"),
    ]
    for p, cpu, mem, rt, net, desc, cat in container_miners:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, container_name="victim-pod", environment="CONTAINER"),
            is_cryptojacking=True, description=desc, category=cat
        ))

    # 1.3 Stealth & Masqueraded Mining Processes (mining names hidden, dialing mining pools)
    stealth_miners = [
        ("systemd-worker", 96.0, 87.0, 16000, "pool.supportxmr.com:3333", "Masqueraded systemd worker dialing XMR pool", "Stealth Miner"),
        ("kworker_0", 94.5, 85.0, 22000, "xmr.2miners.com:2222", "Fake kernel worker process with Stratum connection", "Stealth Miner"),
        ("auditd_daemon", 92.0, 81.0, 14000, "minexmr.com:4444", "Masqueraded security audit binary dialing pool", "Stealth Miner"),
        ("cron_task", 89.0, 78.0, 11000, "nanopool.org:14444", "Cron wrapper launching stealth miner", "Stealth Miner"),
        ("apache2_core", 93.5, 83.0, 19500, "moneroocean.stream:10128", "Apache thread hollowing with cryptonight hash", "Stealth Miner"),
        ("dockerd_agent", 95.0, 88.0, 28000, "f2pool.com:5780", "Rogue Docker child process mining", "Stealth Miner"),
        ("nginx_ssl_helper", 91.5, 79.5, 13000, "c3pool.com:13333", "Nginx helper masquerade mining Monero", "Stealth Miner"),
        ("python_analyzer", 88.5, 76.0, 9500, "stratum.antpool.com:443", "Python script connecting to Antpool stratum", "Stealth Miner"),
        ("node_microservice", 87.0, 74.5, 8900, "stratum+tcp://ethermine.org:4444", "Node backend hijacked for in-process mining", "Stealth Miner"),
        ("java_spring_svc", 92.5, 82.0, 17500, "stratum.nicehash.com:3380", "Compromised Java Spring service mining", "Stealth Miner"),
    ]
    for p, cpu, mem, rt, net, desc, cat in stealth_miners:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="HOST"),
            is_cryptojacking=True, description=desc, category=cat
        ))

    # 1.4 WebAssembly & Browser In-Memory Mining
    wasm_miners = [
        ("headless_chrome_wasm", 95.0, 86.0, 11500, "cointraffic-ws.proxy.me:8443", "Chromium WebAssembly CryptoNight Worker", "Browser Miner"),
        ("puppeteer_render", 93.0, 84.0, 9800, "stratum.monerohash.com:3333", "Puppeteer worker rendering mining script", "Browser Miner"),
        ("electron_app_child", 94.0, 85.0, 13400, "pool.hashvault.pro:80", "Electron application hidden mining thread", "Browser Miner"),
        ("firefox_content", 92.0, 81.0, 8600, "minexmr.com:4444", "Browser tab running CoinHive clone script", "Browser Miner"),
        ("node_wasm_eval", 96.5, 88.0, 14200, "supportxmr.com:3333", "Node.js WebAssembly compiled miner", "Browser Miner"),
    ]
    for p, cpu, mem, rt, net, desc, cat in wasm_miners:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="CONTAINER"),
            is_cryptojacking=True, description=desc, category=cat
        ))

    # 1.5 Multi-Algo & Alt-Coin Mining Workers
    alt_miners = [
        ("teamredminer", 88.0, 75.0, 9200, "ergo.herominers.com:1180", "TeamRedMiner Autolykos worker", "Alt-Coin Miner"),
        ("wildrig-multi", 86.5, 73.0, 8400, "ghostrider.raptoreum.zone:3333", "WildRig GhostRider algorithm", "Alt-Coin Miner"),
        ("srbminer-worker", 87.0, 74.5, 7800, "kas.woolypooly.com:3112", "SRBMiner Heavy Kaspa mining", "Alt-Coin Miner"),
        ("gminer_core", 89.0, 77.0, 8900, "beam-pool.leafpool.com:3333", "GMiner Equihash algorithm", "Alt-Coin Miner"),
        ("bminer-bin", 88.2, 76.5, 9600, "sparkpool.com:2222", "Bminer CryptoNight-Heavy", "Alt-Coin Miner"),
        ("cryptodredge_bin", 86.0, 73.5, 7100, "pool.bsod.pw:2222", "CryptoDredge Lyra2REv3 miner", "Alt-Coin Miner"),
        ("phoenixminer_core", 91.0, 80.0, 11000, "nanopool.org:9999", "PhoenixMiner Ethash execution", "Alt-Coin Miner"),
        ("xmr-stak-rx", 93.0, 82.0, 13500, "crypto-pool.fr:3333", "XMR-Stak RandomX algorithm", "Alt-Coin Miner"),
        ("cast_xmr_daemon", 89.5, 78.0, 8800, "supportxmr.com:7777", "Cast XMR OpenCL daemon", "Alt-Coin Miner"),
        ("nplusminer_agent", 87.8, 75.5, 9400, "miningpoolhub.com:20585", "NplusMiner Auto-profit switcher", "Alt-Coin Miner"),
        ("ccminer_klaust", 88.4, 76.2, 8100, "pool.rplant.xyz:7022", "CCMiner KlausT cryptonight fork", "Alt-Coin Miner"),
        ("finminer_release", 90.0, 79.0, 10500, "nanopool.org:9999", "FinMiner dual mining task", "Alt-Coin Miner"),
        ("claymore_miner", 92.0, 81.5, 12600, "ethermine.org:4444", "Claymore Dual Ethereum Miner", "Alt-Coin Miner"),
        ("onezerominer", 89.0, 77.0, 8500, "neuropool.net:19330", "OneZeroMiner Dynex neuromorphic compute", "Alt-Coin Miner"),
        ("rigel-miner", 87.5, 74.0, 7900, "herominers.com:1190", "Rigel Miner Blake3 execution", "Alt-Coin Miner"),
    ]
    for p, cpu, mem, rt, net, desc, cat in alt_miners:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="HOST"),
            is_cryptojacking=True, description=desc, category=cat
        ))

    # =========================================================================
    # CLASS 2: BENIGN WORKLOADS (50 samples, Ground Truth = False)
    # =========================================================================

    # 2.1 Heavy Compute But Legitimate Tasks (Compilers, Encoders, Databases, ML)
    heavy_benign = [
        ("clang++", 94.0, 68.0, 4200, None, "C++ release compilation multi-core build", "Compilation"),
        ("gcc", 92.5, 65.0, 3900, None, "GCC kernel compilation pass", "Compilation"),
        ("rustc_llvm", 95.0, 72.0, 4800, "crates.io:443", "Rust compiler with Link-Time Optimization", "Compilation"),
        ("go_build", 89.0, 62.0, 3700, "proxy.golang.org:443", "Go compiler building 60 microservices", "Compilation"),
        ("javac", 88.0, 75.0, 3650, None, "Java enterprise compilation unit", "Compilation"),
        ("ffmpeg_transcode", 96.0, 70.0, 5600, "s3.internal-media.org:443", "H.265 4K video transcoding job", "Media Processing"),
        ("blender_render", 98.0, 82.0, 7200, None, "3D rendering offline batch processing", "Media Processing"),
        ("postgres_vacuum", 76.0, 68.0, 4500, "db-primary.internal:5432", "PostgreSQL VACUUM FULL maintenance", "Database Maintenance"),
        ("es_rebalance", 72.0, 74.0, 4800, "es-cluster.corp:9200", "Elasticsearch shard cluster rebalancing", "Database Maintenance"),
        ("redis_bgsave", 68.0, 69.0, 3800, None, "Redis RDB disk snapshot generation", "Database Maintenance"),
        ("spark_mllib", 86.0, 78.0, 5200, "hdfs-master.corp:9000", "Apache Spark ML distributed training", "Data Science"),
        ("python3_torch", 91.0, 79.0, 5900, "s3.ml-models.corp:443", "PyTorch LLM model fine-tuning step", "Data Science"),
        ("zstd_archiver", 85.0, 64.0, 4100, "nfs-backup.corp:2049", "Zstandard multi-threaded disk backup", "System Maintenance"),
        ("docker_buildkit", 88.0, 66.0, 3950, "registry.gitlab.com:443", "Container image compression build", "Build Pipeline"),
        ("webpack_terser", 78.0, 65.0, 3750, None, "Production Webpack JS code minification", "Build Pipeline"),
    ]
    for p, cpu, mem, rt, net, desc, cat in heavy_benign:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="HOST"),
            is_cryptojacking=False, description=desc, category=cat
        ))

    # 2.2 Moderate Workload Microservices & Data Pipelines
    moderate_benign = [
        ("node_api_server", 48.0, 58.0, 72000, "external-api.stripe.com:443", "Node.js payment processing API gateway", "Web Service"),
        ("python_fastapi", 44.0, 52.0, 86400, "internal-db.corp:5432", "FastAPI microservice backend", "Web Service"),
        ("nginx_ingress", 38.0, 42.0, 120000, "cdn.internal.org:443", "Nginx ingress proxy serving live web requests", "Web Service"),
        ("envoy_proxy", 35.0, 45.0, 96000, "service-mesh.k8s:15010", "Envoy mesh sidecar proxy routing mTLS", "Web Service"),
        ("kafka_consumer", 52.0, 61.0, 64000, "kafka-broker-01.prod:9092", "Kafka event stream consumer", "Event Stream"),
        ("rabbitmq_server", 42.0, 55.0, 88000, "amqp.internal:5672", "RabbitMQ message broker cluster node", "Event Stream"),
        ("airflow_scheduler", 46.0, 58.0, 54000, "snowflake-sync.corp:443", "Apache Airflow workflow scheduler", "Data Pipeline"),
        ("grafana_server", 32.0, 48.0, 43200, "db.metrics.internal:9090", "Grafana enterprise dashboard server", "Monitoring"),
        ("prometheus_server", 54.0, 67.0, 98000, "cluster.metrics:9090", "Prometheus time-series scraper", "Monitoring"),
        ("thanos_compact", 58.0, 63.0, 18000, "thanos-storage.corp:10901", "Thanos long-term block downsampler", "Monitoring"),
        ("elasticsearch_node", 56.0, 71.0, 110000, "es-cluster.corp:9200", "Elasticsearch search index worker", "Database"),
        ("mongodb_mongod", 49.0, 65.0, 94000, "mongo-replica.corp:27017", "MongoDB document database primary", "Database"),
        ("cassandra_daemon", 53.0, 72.0, 82000, "cassandra-ring.corp:9042", "Cassandra distributed database node", "Database"),
        ("clickhouse_server", 57.0, 68.0, 75000, "clickhouse.internal:9000", "ClickHouse analytics query engine", "Database"),
        ("vault_agent", 28.0, 40.0, 64000, "consul-cluster.corp:8500", "HashiCorp Vault secret token manager", "Security"),
    ]
    for p, cpu, mem, rt, net, desc, cat in moderate_benign:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="CONTAINER"),
            is_cryptojacking=False, description=desc, category=cat
        ))

    # 2.3 Low-Resource Normal Background Services & OS Daemons
    low_benign = [
        ("systemd-journald", 14.0, 28.0, 144000, None, "Linux systemd journal log collector", "OS Daemon"),
        ("cron_sync_worker", 15.0, 32.0, 3600, "internal-repo.corp:443", "Periodic background sync job", "OS Daemon"),
        ("logrotate_daemon", 22.0, 35.0, 1800, None, "Scheduled log rotation task", "OS Daemon"),
        ("kubelet", 10.5, 21.0, 200000, "k8s-apiserver.infra:6443", "Kubernetes node kubelet agent", "Infrastructure"),
        ("node_exporter", 8.0, 18.0, 250000, "prometheus.corp:9100", "Prometheus host node metrics exporter", "Infrastructure"),
        ("falco_ebpf", 12.0, 26.0, 180000, "falcosidekick.k8s:2801", "Falco eBPF security runtime monitor", "Security"),
        ("osqueryd", 11.5, 29.0, 90000, "fleetdm.security.corp:443", "Osquery endpoint posture sensor", "Security"),
        ("auditd", 9.0, 19.5, 300000, None, "Linux kernel audit subsystem daemon", "Security"),
        ("vector_agent", 16.0, 31.0, 110000, "clickhouse.internal:9000", "Vector log pipeline aggregator", "Infrastructure"),
        ("fluent_bit", 10.0, 22.0, 130000, "opensearch.infra:9200", "Fluentbit lightweight container logger", "Infrastructure"),
        ("sshd_session", 6.5, 15.0, 7200, "bastion.corp:22", "OpenSSH authenticated management session", "Administration"),
        ("rsync_mirror", 24.0, 33.0, 3600, "nas-backup.internal:873", "Periodic rsync static file mirror", "Storage"),
        ("chronyd", 3.5, 11.0, 400000, "time.cloudflare.com:123", "Chrony NTP sub-millisecond clock sync", "OS Daemon"),
        ("coredns", 14.5, 27.0, 220000, "upstream-dns.corp:53", "CoreDNS cluster service discovery", "Infrastructure"),
        ("certbot_renew", 11.0, 24.0, 1200, "acme-v02.api.letsencrypt.org:443", "Let's Encrypt automated TLS renewal", "Security"),
        ("dbus-daemon", 4.0, 12.0, 500000, None, "D-Bus system message bus daemon", "OS Daemon"),
        ("containerd", 18.0, 34.0, 310000, None, "Containerd container runtime manager", "Infrastructure"),
        ("rsyslogd", 8.5, 17.0, 280000, "syslog-collector.corp:514", "Rsyslog central event forwarder", "OS Daemon"),
        ("etcd_member", 25.0, 44.0, 190000, "etcd-peer-02.infra:2380", "Etcd distributed key-value store member", "Infrastructure"),
        ("calico_node", 17.5, 36.0, 170000, "calico-typha.k8s:5473", "Calico container networking & BGP agent", "Infrastructure"),
    ]
    for p, cpu, mem, rt, net, desc, cat in low_benign:
        workloads.append(LabelledWorkload(
            telemetry=TelemetryData(cpu_usage=cpu, memory_usage=mem, process_name=p, process_runtime_seconds=rt, network_destination=net, environment="HOST"),
            is_cryptojacking=False, description=desc, category=cat
        ))

    return workloads


class EvaluationPipeline:
    """
    Evaluation Pipeline for assessing threat detection performance against ground truth.
    Calculates Accuracy, Precision, Recall, F1-Score, False Positive Rate (FPR),
    and Confusion Matrix.
    """

    def __init__(self, dataset: Optional[List[LabelledWorkload]] = None):
        self.dataset = dataset if dataset is not None else get_default_synthetic_dataset()

    def evaluate(
        self,
        engine: Optional[DetectionEngine] = None,
        threshold: int = 35
    ) -> Dict[str, Any]:
        """
        Executes evaluation on the dataset with the given DetectionEngine and decision threshold.
        Returns full metrics dictionary and confusion matrix.
        """
        if engine is None:
            engine = DetectionEngine(medium_threshold=threshold)

        true_positives = 0
        false_positives = 0
        true_negatives = 0
        false_negatives = 0

        detailed_results = []

        for item in self.dataset:
            risk = engine.analyze(item.telemetry)
            predicted_positive = (risk.score >= threshold)
            actual_positive = item.is_cryptojacking

            if actual_positive and predicted_positive:
                outcome = "TP"
                true_positives += 1
            elif not actual_positive and predicted_positive:
                outcome = "FP"
                false_positives += 1
            elif not actual_positive and not predicted_positive:
                outcome = "TN"
                true_negatives += 1
            else:
                outcome = "FN"
                false_negatives += 1

            detailed_results.append({
                "process_name": item.telemetry.process_name,
                "category": item.category,
                "description": item.description,
                "ground_truth": "CRYPTOMINER" if actual_positive else "BENIGN",
                "predicted": "CRYPTOMINER" if predicted_positive else "BENIGN",
                "risk_score": risk.score,
                "severity": risk.severity.value,
                "outcome": outcome
            })

        total = len(self.dataset)
        actual_positives = true_positives + false_negatives
        actual_negatives = true_negatives + false_positives

        # Metrics calculation with safe zero division protection
        accuracy = (true_positives + true_negatives) / total if total > 0 else 0.0
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / actual_positives if actual_positives > 0 else 0.0
        f1_score = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        fpr = false_positives / actual_negatives if actual_negatives > 0 else 0.0
        specificity = true_negatives / actual_negatives if actual_negatives > 0 else 0.0

        per_class_metrics = {
            "cryptojacking_threats": {
                "sample_count": actual_positives,
                "true_positives": true_positives,
                "false_negatives": false_negatives,
                "recall_sensitivity": round(recall, 4),
                "recall_sensitivity_percent": round(recall * 100, 2)
            },
            "benign_workloads": {
                "sample_count": actual_negatives,
                "true_negatives": true_negatives,
                "false_positives": false_positives,
                "specificity": round(specificity, 4),
                "specificity_percent": round(specificity * 100, 2)
            }
        }

        # Add 1-indexed ID to sample details
        for idx, item in enumerate(detailed_results, 1):
            item["sample_id"] = idx

        return {
            "metadata": {
                "dataset_name": "BlockMineGuard Synthetic Benchmark v1.0",
                "dataset_version": "v1.0",
                "detector_version": "v1.2.0",
                "scoring_config_version": "v1.0",
                "schema_version": "bmg-evidence-v1.0",
                "dataset_size": total,
                "class_distribution": {
                    "cryptojacking_count": actual_positives,
                    "benign_count": actual_negatives,
                    "balance_ratio": round(actual_positives / total, 2) if total > 0 else 0.0
                },
                "evaluated_threshold": threshold,
                "threshold_range": "0 - 100",
                "reproduction_command": "python -m detector.evaluation",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "benchmark_mode": "SYNTHETIC_LAB_ISOLATED",
                "disclaimer": "SYNTHETIC WORKLOAD BENCHMARK: These metrics are derived from a reproducible, labelled synthetic suite of workloads in an isolated lab environment. Performance in live production networks depends on unseen zero-day miner variants and benign workload variance."
            },
            "metrics": {
                "accuracy": round(accuracy, 4),
                "accuracy_percent": round(accuracy * 100, 2),
                "precision": round(precision, 4),
                "precision_percent": round(precision * 100, 2),
                "recall": round(recall, 4),
                "recall_percent": round(recall * 100, 2),
                "f1_score": round(f1_score, 4),
                "f1_score_percent": round(f1_score * 100, 2),
                "false_positive_rate": round(fpr, 4),
                "false_positive_rate_percent": round(fpr * 100, 2),
                "specificity": round(specificity, 4),
                "specificity_percent": round(specificity * 100, 2)
            },
            "per_class_metrics": per_class_metrics,
            "confusion_matrix": {
                "true_positives": true_positives,
                "false_positives": false_positives,
                "true_negatives": true_negatives,
                "false_negatives": false_negatives,
                "matrix_2x2": [
                    [true_negatives, false_positives],
                    [false_negatives, true_positives]
                ],
                "row_labels": ["Actual Benign (0)", "Actual Threat (1)"],
                "column_labels": ["Predicted Benign (0)", "Predicted Threat (1)"]
            },
            "sample_details": detailed_results,
            "sample_count": len(detailed_results)
        }


# Global pipeline instance
evaluation_pipeline = EvaluationPipeline()


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("BLOCKMINEGUARD DETECTION EVALUATION LAB — SYNTHETIC BENCHMARK")
    print("=" * 70)
    
    results = evaluation_pipeline.evaluate(threshold=35)
    meta = results["metadata"]
    metrics = results["metrics"]
    cm = results["confusion_matrix"]
    pcm = results["per_class_metrics"]

    print(f"Dataset:            {meta['dataset_name']} ({meta['dataset_version']})")
    print(f"Detector Version:   {meta['detector_version']} (Config: {meta['scoring_config_version']})")
    print(f"Total Workloads:    {meta['dataset_size']} samples (50 Threats, 50 Benign)")
    print(f"Decision Threshold: {meta['evaluated_threshold']}/100")
    print("-" * 70)
    print("CONFUSION MATRIX:")
    print(f"  Actual Benign  [TN: {cm['true_negatives']:2d}]  [FP: {cm['false_positives']:2d}]")
    print(f"  Actual Threat  [FN: {cm['false_negatives']:2d}]  [TP: {cm['true_positives']:2d}]")
    print("-" * 70)
    print("PERFORMANCE METRICS:")
    print(f"  Accuracy:            {metrics['accuracy_percent']:6.2f}%")
    print(f"  Precision:           {metrics['precision_percent']:6.2f}%")
    print(f"  Recall (Sensitivity):{metrics['recall_percent']:6.2f}%")
    print(f"  Specificity:         {metrics['specificity_percent']:6.2f}%")
    print(f"  Harmonic F1-Score:   {metrics['f1_score']:6.4f} ({metrics['f1_score_percent']}%)")
    print(f"  False Positive Rate: {metrics['false_positive_rate_percent']:6.2f}%")
    print("-" * 70)
    print("PER-CLASS EVALUATION:")
    print(f"  Cryptojacking Threats: {pcm['cryptojacking_threats']['true_positives']}/{pcm['cryptojacking_threats']['sample_count']} detected (Recall: {pcm['cryptojacking_threats']['recall_sensitivity_percent']}%)")
    print(f"  Benign Workloads:      {pcm['benign_workloads']['true_negatives']}/{pcm['benign_workloads']['sample_count']} suppressed (Specificity: {pcm['benign_workloads']['specificity_percent']}%)")
    print("-" * 70)
    print(f"Disclaimer: {meta['disclaimer']}")
    print("=" * 70 + "\n")

