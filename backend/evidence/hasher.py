import hashlib
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from typing import Dict, Any
from evidence.evidence_generator import IncidentEvidence


class EvidenceHasher:
    SCHEMA_VERSION = "bmg-evidence-v1.0"
    DETECTOR_VERSION = "v1.2.0"
    SCORING_CONFIG_VERSION = "v1.0"
    HASH_ALGORITHM = "SHA-256"

    @staticmethod
    def normalize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize dictionary keys (supporting both camelCase and snake_case)
        and standardize field types for deterministic canonical JSON.
        Preserves schema and detector versioning if provided.
        """
        if not isinstance(data, dict):
            raise ValueError(f"Expected dictionary for evidence normalization, got {type(data).__name__}")

        key_map = {
            "incidentid": "incident_id",
            "incident_id": "incident_id",
            "timestamp": "timestamp",
            "cpuusage": "cpu_usage",
            "cpu_usage": "cpu_usage",
            "memoryusage": "memory_usage",
            "memory_usage": "memory_usage",
            "processname": "process_name",
            "process_name": "process_name",
            "processruntimeseconds": "process_runtime_seconds",
            "process_runtime_seconds": "process_runtime_seconds",
            "networkdestination": "network_destination",
            "network_destination": "network_destination",
            "containername": "container_name",
            "container_name": "container_name",
            "environment": "environment",
            "riskscore": "risk_score",
            "risk_score": "risk_score",
            "severity": "severity",
            "factors": "factors",
            "schemaversion": "schema_version",
            "schema_version": "schema_version",
            "detectorversion": "detector_version",
            "detector_version": "detector_version",
            "scoringconfigversion": "scoring_config_version",
            "scoring_config_version": "scoring_config_version",
            "hashalgorithm": "hash_algorithm",
            "hash_algorithm": "hash_algorithm"
        }

        normalized = {}
        for k, v in data.items():
            clean_k = key_map.get(str(k).lower(), str(k))
            if clean_k in ("schema_version", "detector_version", "scoring_config_version", "hash_algorithm"):
                normalized[clean_k] = str(v) if v is not None else None
                continue
            if clean_k in ("cpu_usage", "memory_usage") and v is not None:
                try:
                    v = float(v)
                except (ValueError, TypeError):
                    pass
            elif clean_k in ("risk_score", "process_runtime_seconds") and v is not None:
                try:
                    v = int(v)
                except (ValueError, TypeError):
                    pass
            elif clean_k == "severity" and isinstance(v, str):
                v = v.upper()
            elif clean_k == "factors" and isinstance(v, dict):
                norm_factors = {}
                for fk, fv in v.items():
                    if fk in ("cpu_usage", "memory_usage") and fv is not None:
                        try:
                            fv = float(fv)
                        except (ValueError, TypeError):
                            pass
                    elif fk in ("cpu_score", "memory_score", "process_score", "network_score", "runtime_score", "process_runtime_seconds") and fv is not None:
                        try:
                            fv = int(fv)
                        except (ValueError, TypeError):
                            pass
                    norm_factors[fk] = fv
                v = norm_factors
            normalized[clean_k] = v

        return normalized

    @staticmethod
    def hash_evidence(evidence: IncidentEvidence) -> str:
        normalized = EvidenceHasher.normalize_dict(evidence.to_json_serializable())
        canonical = EvidenceHasher._canonicalize(normalized)
        return hashlib.sha256(canonical.encode()).hexdigest()

    @staticmethod
    def hash_dict(data: Dict[str, Any]) -> str:
        normalized = EvidenceHasher.normalize_dict(data)
        canonical = EvidenceHasher._canonicalize(normalized)
        return hashlib.sha256(canonical.encode()).hexdigest()

    @staticmethod
    def _canonicalize(data: Dict[str, Any]) -> str:
        return json.dumps(data, sort_keys=True, separators=(",", ":"))

    @staticmethod
    def build_versioned_evidence(
        data: Dict[str, Any],
        schema_version: str = SCHEMA_VERSION,
        detector_version: str = DETECTOR_VERSION,
        scoring_config_version: str = SCORING_CONFIG_VERSION
    ) -> Dict[str, Any]:
        """
        Creates a versioned canonical evidence dictionary including schema,
        detector version, scoring config version, and SHA-256 algorithm indicator.
        """
        base = EvidenceHasher.normalize_dict(data)
        base["schema_version"] = schema_version
        base["detector_version"] = detector_version
        base["scoring_config_version"] = scoring_config_version
        base["hash_algorithm"] = EvidenceHasher.HASH_ALGORITHM
        return base

    @staticmethod
    def clean_hex(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, bytes):
            return val.hex().lower().replace("0x", "")
        return str(val).strip().lower().replace("0x", "")

    @staticmethod
    def verify(evidence: IncidentEvidence, stored_hash: str) -> bool:
        return EvidenceHasher.clean_hex(EvidenceHasher.hash_evidence(evidence)) == EvidenceHasher.clean_hex(stored_hash)

    @staticmethod
    def verify_dict(data: Dict[str, Any], stored_hash: str) -> bool:
        return EvidenceHasher.clean_hex(EvidenceHasher.hash_dict(data)) == EvidenceHasher.clean_hex(stored_hash)