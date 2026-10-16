from typing import Optional, Tuple, Dict, List


class MiningIndicators:
    SUSPICIOUS_PROCESS_NAMES = [
        "xmrig", "cpuminer", "minergate", "cgminer", "bfgminer",
        "ethminer", "phoenixminer", "t-rex", "lolminer", "nbminer",
        "teamredminer", "gminer", "xmr-stak", "xmr-stak-cpu",
        "cryptonight", "monero", "stratum", "mining", "coinminer",
        "ccminer", "sgminer", "vertminer", "claymore", "ewbf",
        "dstm", "bminer", "zm", "optiminer", "equihash"
    ]

    SUSPICIOUS_DOMAINS = [
        "xmr.pool", "monero.pool", "minexmr.com", "supportxmr.com",
        "xmrpool.eu", "monerohash.com", "moneroocean.stream",
        "c3pool.com", "nanopool.org", "ethermine.org", "f2pool.com",
        "antpool.com", "btc.com", "slushpool.com", "viaBTC.com",
        "poolin.com", "huobi.pool", "okex.pool", "binance.pool",
        "miningpoolhub.com", "zpool.ca", "hashrefinery.com",
        "nicehash.com", "miningrigrentals.com", "stratum+tcp"
    ]

    SUSPICIOUS_IPS = [
        "185.199.108.153", "185.199.109.153", "185.199.110.153",
        "185.199.111.153"
    ]

    @classmethod
    def is_suspicious_process(cls, process_name: str) -> bool:
        process_lower = process_name.lower()
        return any(indicator in process_lower for indicator in cls.SUSPICIOUS_PROCESS_NAMES)

    @classmethod
    def is_suspicious_destination(cls, destination: Optional[str]) -> bool:
        if not destination:
            return False
        dest_lower = destination.lower()
        return any(indicator in dest_lower for indicator in cls.SUSPICIOUS_DOMAINS) or \
               destination in cls.SUSPICIOUS_IPS


class RuleEngine:
    def check_cpu_usage(self, cpu_usage: float) -> Tuple[int, Dict[str, any]]:
        factors = {"cpu_usage": cpu_usage}
        if cpu_usage > 90:
            return 30, {**factors, "cpu_high": True, "cpu_score": 30}
        elif cpu_usage > 75:
            return 15, {**factors, "cpu_elevated": True, "cpu_score": 15}
        elif cpu_usage > 50:
            return 5, {**factors, "cpu_moderate": True, "cpu_score": 5}
        return 0, {**factors, "cpu_normal": True, "cpu_score": 0}

    def check_process_name(self, process_name: str, indicators: MiningIndicators) -> Tuple[int, Dict[str, any]]:
        factors = {"process_name": process_name}
        if indicators.is_suspicious_process(process_name):
            return 25, {**factors, "suspicious_process": True, "process_score": 25}
        return 0, {**factors, "suspicious_process": False, "process_score": 0}

    def check_network_destination(self, destination: Optional[str], indicators: MiningIndicators) -> Tuple[int, Dict[str, any]]:
        factors = {"network_destination": destination}
        if indicators.is_suspicious_destination(destination):
            return 25, {**factors, "suspicious_network": True, "network_score": 25}
        return 0, {**factors, "suspicious_network": False, "network_score": 0}

    def check_memory_usage(self, memory_usage: float) -> Tuple[int, Dict[str, any]]:
        factors = {"memory_usage": memory_usage}
        if memory_usage > 85:
            return 15, {**factors, "memory_high": True, "memory_score": 15}
        elif memory_usage > 70:
            return 10, {**factors, "memory_elevated": True, "memory_score": 10}
        elif memory_usage > 50:
            return 5, {**factors, "memory_moderate": True, "memory_score": 5}
        return 0, {**factors, "memory_normal": True, "memory_score": 0}

    def check_process_runtime(self, runtime_seconds: int) -> Tuple[int, Dict[str, any]]:
        factors = {"process_runtime_seconds": runtime_seconds}
        if runtime_seconds > 3600:
            return 20, {**factors, "long_running": True, "runtime_score": 20}
        elif runtime_seconds > 1800:
            return 10, {**factors, "moderate_running": True, "runtime_score": 10}
        return 0, {**factors, "short_running": True, "runtime_score": 0}

    def explain_factors(self, factors: Dict[str, any]) -> List[str]:
        reasons = []
        if factors.get("cpu_high"):
            reasons.append(f"Critical CPU utilization ({factors.get('cpu_usage')}%) exceeding 90% threshold")
        elif factors.get("cpu_elevated"):
            reasons.append(f"Elevated CPU utilization ({factors.get('cpu_usage')}%) exceeding 75% threshold")
        elif factors.get("cpu_moderate"):
            reasons.append(f"Moderate CPU utilization ({factors.get('cpu_usage')}%) exceeding 50% threshold")

        if factors.get("memory_high"):
            reasons.append(f"High memory utilization ({factors.get('memory_usage')}%) exceeding 85% threshold")
        elif factors.get("memory_elevated"):
            reasons.append(f"Elevated memory utilization ({factors.get('memory_usage')}%) exceeding 70% threshold")

        if factors.get("suspicious_process"):
            reasons.append(f"Process binary name '{factors.get('process_name')}' matches known mining software signature")

        if factors.get("suspicious_network"):
            reasons.append(f"Network destination '{factors.get('network_destination')}' matches known mining pool or stratum protocol")

        if factors.get("long_running"):
            reasons.append(f"Process running continuously for {factors.get('process_runtime_seconds')}s (> 1 hour)")
        elif factors.get("moderate_running"):
            reasons.append(f"Process runtime {factors.get('process_runtime_seconds')}s exceeds 30 minutes")

        if not reasons:
            reasons.append("Workload telemetry falls within baseline parameters")

        return reasons