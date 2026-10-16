from dataclasses import dataclass, asdict, field
from typing import Optional
from datetime import datetime, timezone


@dataclass
class IncidentRecord:
    id: Optional[int] = None
    incident_id: str = ""
    external_id: str = ""
    evidence_hash: str = ""
    timestamp: str = ""
    cpu_usage: float = 0.0
    memory_usage: float = 0.0
    process_name: str = ""
    process_runtime_seconds: int = 0
    network_destination: Optional[str] = None
    container_name: Optional[str] = None
    environment: str = "HOST"
    risk_score: int = 0
    severity: str = "LOW"
    factors: str = ""
    blockchain_tx_hash: Optional[str] = None
    blockchain_incident_id: Optional[int] = None
    verification_status: str = "UNVERIFIED"
    resolution_status: str = "OPEN"
    threat_intel_ref: Optional[str] = None
    reporter_address: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ThreatIntelRecord:
    id: Optional[int] = None
    intel_id: str = ""
    indicator: str = ""
    indicator_type: str = ""
    description: str = ""
    campaign_id: str = ""
    timestamp: str = ""
    reporter_address: Optional[str] = None
    verified: bool = False
    blockchain_intel_id: Optional[int] = None
    status: str = "SUBMITTED"  # SUBMITTED, REVIEWED, VERIFIED, REJECTED, DISPUTED
    confidence_score: int = 50
    source: str = "COMMUNITY_REPORT"
    reviewer_address: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_at: Optional[str] = None
    conflict_detected: bool = False
    conflict_details: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ReporterRecord:
    id: Optional[int] = None
    address: str = ""
    reputation_score: int = 100
    total_reports: int = 0
    verified_reports: int = 0
    false_reports: int = 0
    registered: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class IncidentNoteRecord:
    id: Optional[int] = None
    incident_id: str = ""
    author: str = "Analyst"
    note: str = ""
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class AuditLogRecord:
    id: Optional[int] = None
    action: str = ""
    target_id: Optional[str] = None
    actor: str = "System"
    outcome: str = "SUCCESS"
    details: str = "{}"
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class VerificationHistoryRecord:
    id: Optional[int] = None
    incident_id: str = ""
    verification_outcome: str = ""  # VERIFIED, TAMPERED_HASH_MISMATCH, EVIDENCE_MISSING, ON_CHAIN_MISMATCH, BLOCKCHAIN_OUTAGE, UNREGISTERED_ON_CHAIN
    computed_hash: str = ""
    stored_hash: str = ""
    on_chain_hash: Optional[str] = None
    verifier_address: Optional[str] = None
    blockchain_tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    gas_used: Optional[int] = None
    details: str = "{}"
    verified_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)