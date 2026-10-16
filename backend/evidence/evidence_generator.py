from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from detector import TelemetryData, RiskScore, Severity


@dataclass
class IncidentEvidence:
    incident_id: str
    timestamp: str
    cpu_usage: float
    memory_usage: float
    process_name: str
    process_runtime_seconds: int
    network_destination: Optional[str]
    container_name: Optional[str]
    environment: str
    risk_score: int
    severity: str
    factors: Dict[str, Any]

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json_serializable(self) -> dict:
        data = self.to_dict()
        return data

    @classmethod
    def from_telemetry_and_risk(
        cls,
        telemetry: TelemetryData,
        risk_score: RiskScore,
        incident_id: Optional[str] = None
    ) -> "IncidentEvidence":
        if incident_id is None:
            incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"

        return cls(
            incident_id=incident_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            cpu_usage=telemetry.cpu_usage,
            memory_usage=telemetry.memory_usage,
            process_name=telemetry.process_name,
            process_runtime_seconds=telemetry.process_runtime_seconds,
            network_destination=telemetry.network_destination,
            container_name=telemetry.container_name,
            environment=telemetry.environment,
            risk_score=risk_score.score,
            severity=risk_score.severity.value,
            factors=risk_score.factors
        )


class EvidenceGenerator:
    def __init__(self):
        pass

    def generate(self, telemetry: TelemetryData, risk_score: RiskScore, incident_id: Optional[str] = None) -> IncidentEvidence:
        return IncidentEvidence.from_telemetry_and_risk(telemetry, risk_score, incident_id)

    def generate_from_dict(self, data: dict) -> IncidentEvidence:
        return IncidentEvidence(**data)