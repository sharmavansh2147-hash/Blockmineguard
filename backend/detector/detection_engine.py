from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime, timezone
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detector.rules import RuleEngine, MiningIndicators


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class TelemetryData:
    cpu_usage: float
    memory_usage: float
    process_name: str
    process_runtime_seconds: int
    network_destination: Optional[str] = None
    container_name: Optional[str] = None
    environment: str = "HOST"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RiskScore:
    score: int
    severity: Severity
    factors: dict
    reasons: List[str]
    timestamp: str

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "severity": self.severity.value,
            "factors": self.factors,
            "reasons": self.reasons,
            "timestamp": self.timestamp
        }


class DetectionEngine:
    def __init__(
        self,
        medium_threshold: int = 35,
        high_threshold: int = 65,
        critical_threshold: int = 85
    ):
        self.rule_engine = RuleEngine()
        self.mining_indicators = MiningIndicators()
        self.medium_threshold = medium_threshold
        self.high_threshold = high_threshold
        self.critical_threshold = critical_threshold

    def analyze(self, telemetry: TelemetryData) -> RiskScore:
        factors = {}
        score = 0

        cpu_score, cpu_factors = self.rule_engine.check_cpu_usage(telemetry.cpu_usage)
        score += cpu_score
        factors.update(cpu_factors)

        mem_score, mem_factors = self.rule_engine.check_memory_usage(telemetry.memory_usage)
        score += mem_score
        factors.update(mem_factors)

        process_score, process_factors = self.rule_engine.check_process_name(
            telemetry.process_name, self.mining_indicators
        )
        score += process_score
        factors.update(process_factors)

        network_score, network_factors = self.rule_engine.check_network_destination(
            telemetry.network_destination, self.mining_indicators
        )
        score += network_score
        factors.update(network_factors)

        runtime_score, runtime_factors = self.rule_engine.check_process_runtime(
            telemetry.process_runtime_seconds
        )
        score += runtime_score
        factors.update(runtime_factors)

        score = min(score, 100)

        if score >= self.critical_threshold:
            severity = Severity.CRITICAL
        elif score >= self.high_threshold:
            severity = Severity.HIGH
        elif score >= self.medium_threshold:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        reasons = self.rule_engine.explain_factors(factors)
        timestamp = datetime.now(timezone.utc).isoformat()

        return RiskScore(
            score=score,
            severity=severity,
            factors=factors,
            reasons=reasons,
            timestamp=timestamp
        )

    def is_suspicious(self, telemetry: TelemetryData, threshold: Optional[int] = None) -> bool:
        eval_threshold = threshold if threshold is not None else self.medium_threshold
        result = self.analyze(telemetry)
        return result.score >= eval_threshold