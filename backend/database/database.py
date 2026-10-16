import sqlite3
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from datetime import datetime, timezone
from database.models import (
    IncidentRecord,
    ThreatIntelRecord,
    ReporterRecord,
    IncidentNoteRecord,
    AuditLogRecord,
    VerificationHistoryRecord,
)


class Database:
    def __init__(self, db_path: str = "blockmineguard.db"):
        self.db_path = db_path
        self._memory_conn = None
        if self.db_path == ":memory:":
            self._memory_conn = sqlite3.connect(":memory:")
            self._memory_conn.row_factory = sqlite3.Row
        self._init_db()

    @contextmanager
    def _get_connection(self):
        if self._memory_conn is not None:
            yield self._memory_conn
        else:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
            finally:
                conn.close()

    def close(self):
        if self._memory_conn is not None:
            self._memory_conn.close()
            self._memory_conn = None

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_id TEXT UNIQUE NOT NULL,
                    external_id TEXT NOT NULL,
                    evidence_hash TEXT UNIQUE NOT NULL,
                    timestamp TEXT NOT NULL,
                    cpu_usage REAL NOT NULL,
                    memory_usage REAL NOT NULL,
                    process_name TEXT NOT NULL,
                    process_runtime_seconds INTEGER NOT NULL,
                    network_destination TEXT,
                    container_name TEXT,
                    environment TEXT NOT NULL DEFAULT 'HOST',
                    risk_score INTEGER NOT NULL,
                    severity TEXT NOT NULL,
                    factors TEXT NOT NULL,
                    blockchain_tx_hash TEXT,
                    blockchain_incident_id INTEGER,
                    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
                    resolution_status TEXT NOT NULL DEFAULT 'OPEN',
                    threat_intel_ref TEXT,
                    reporter_address TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS threat_intelligence (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    intel_id TEXT UNIQUE NOT NULL,
                    indicator TEXT NOT NULL,
                    indicator_type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    campaign_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    reporter_address TEXT,
                    verified INTEGER NOT NULL DEFAULT 0,
                    blockchain_intel_id INTEGER,
                    created_at TEXT NOT NULL
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reporters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    address TEXT UNIQUE NOT NULL,
                    reputation_score INTEGER NOT NULL DEFAULT 100,
                    total_reports INTEGER NOT NULL DEFAULT 0,
                    verified_reports INTEGER NOT NULL DEFAULT 0,
                    false_reports INTEGER NOT NULL DEFAULT 0,
                    registered INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS incident_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    note TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (incident_id) REFERENCES incidents (incident_id)
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action TEXT NOT NULL,
                    target_id TEXT,
                    actor TEXT NOT NULL DEFAULT 'System',
                    outcome TEXT NOT NULL DEFAULT 'SUCCESS',
                    details TEXT NOT NULL DEFAULT '{}',
                    timestamp TEXT NOT NULL
                )
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_incidents_external_id ON incidents(external_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_incidents_hash ON incidents(evidence_hash)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_threat_intel_indicator ON threat_intelligence(indicator)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_reporters_address ON reporters(address)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_incident_notes_id ON incident_notes(incident_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS response_evaluations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    simulation_id TEXT UNIQUE NOT NULL,
                    incident_id TEXT,
                    workload_type TEXT,
                    process_name TEXT,
                    severity TEXT,
                    risk_score INTEGER,
                    recommended_action TEXT,
                    executed_action TEXT,
                    authorization_status TEXT NOT NULL DEFAULT 'PENDING_AUTHORIZATION',
                    authorized_by TEXT,
                    execution_mode TEXT NOT NULL DEFAULT 'SIMULATED_CONTAINMENT',
                    containment_outcome TEXT,
                    detection_latency_ms REAL,
                    response_latency_ms REAL,
                    cpu_before REAL,
                    cpu_after REAL,
                    memory_before REAL,
                    memory_after REAL,
                    cpu_reduction_pct REAL,
                    evidence_hash TEXT,
                    timeline TEXT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_response_evals_sim_id ON response_evaluations(simulation_id)
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS verification_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    incident_id TEXT NOT NULL,
                    verification_outcome TEXT NOT NULL,
                    computed_hash TEXT,
                    stored_hash TEXT,
                    on_chain_hash TEXT,
                    verifier_address TEXT,
                    blockchain_tx_hash TEXT,
                    block_number INTEGER,
                    gas_used INTEGER,
                    details TEXT DEFAULT '{}',
                    verified_at TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_verif_hist_incident ON verification_history(incident_id)
            """)

            # Safe migrations for threat_intelligence columns
            try:
                cursor.execute("PRAGMA table_info(threat_intelligence)")
                columns = [col["name"] for col in cursor.fetchall()]
                if "status" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN status TEXT NOT NULL DEFAULT 'SUBMITTED'")
                if "confidence_score" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN confidence_score INTEGER NOT NULL DEFAULT 50")
                if "source" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN source TEXT NOT NULL DEFAULT 'COMMUNITY_REPORT'")
                if "reviewer_address" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN reviewer_address TEXT")
                if "review_notes" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN review_notes TEXT")
                if "reviewed_at" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN reviewed_at TEXT")
                if "conflict_detected" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN conflict_detected INTEGER NOT NULL DEFAULT 0")
                if "conflict_details" not in columns:
                    cursor.execute("ALTER TABLE threat_intelligence ADD COLUMN conflict_details TEXT")
            except Exception:
                pass

            conn.commit()

    def create_incident(self, incident: IncidentRecord) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
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
            """, (
                incident.incident_id, incident.external_id, incident.evidence_hash,
                incident.timestamp, incident.cpu_usage, incident.memory_usage,
                incident.process_name, incident.process_runtime_seconds,
                incident.network_destination, incident.container_name,
                incident.environment, incident.risk_score, incident.severity,
                incident.factors, incident.blockchain_tx_hash,
                incident.blockchain_incident_id, incident.verification_status,
                incident.resolution_status, incident.threat_intel_ref,
                incident.reporter_address, incident.created_at, incident.updated_at
            ))
            conn.commit()
            return cursor.lastrowid

    def get_incident_by_id(self, incident_id: str) -> Optional[IncidentRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_incident(row)
            return None

    def get_incident_by_hash(self, evidence_hash: str) -> Optional[IncidentRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incidents WHERE evidence_hash = ?", (evidence_hash,))
            row = cursor.fetchone()
            if row:
                return self._row_to_incident(row)
            return None

    def get_all_incidents(
        self,
        limit: int = 100,
        offset: int = 0,
        severity: Optional[str] = None,
        verification_status: Optional[str] = None,
        resolution_status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[IncidentRecord]:
        query = "SELECT * FROM incidents WHERE 1=1"
        params: List[Any] = []

        if severity and severity.upper() != "ALL":
            query += " AND UPPER(severity) = ?"
            params.append(severity.upper())

        if verification_status and verification_status.upper() != "ALL":
            query += " AND UPPER(verification_status) = ?"
            params.append(verification_status.upper())

        if resolution_status and resolution_status.upper() != "ALL":
            query += " AND UPPER(resolution_status) = ?"
            params.append(resolution_status.upper())

        if search:
            query += " AND (incident_id LIKE ? OR process_name LIKE ? OR network_destination LIKE ? OR external_id LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return [self._row_to_incident(row) for row in cursor.fetchall()]

    def get_incidents_count(
        self,
        severity: Optional[str] = None,
        verification_status: Optional[str] = None,
        resolution_status: Optional[str] = None,
        search: Optional[str] = None
    ) -> int:
        query = "SELECT COUNT(*) FROM incidents WHERE 1=1"
        params: List[Any] = []

        if severity and severity.upper() != "ALL":
            query += " AND UPPER(severity) = ?"
            params.append(severity.upper())

        if verification_status and verification_status.upper() != "ALL":
            query += " AND UPPER(verification_status) = ?"
            params.append(verification_status.upper())

        if resolution_status and resolution_status.upper() != "ALL":
            query += " AND UPPER(resolution_status) = ?"
            params.append(resolution_status.upper())

        if search:
            query += " AND (incident_id LIKE ? OR process_name LIKE ? OR network_destination LIKE ? OR external_id LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            return cursor.fetchone()[0]

    def get_incidents_by_severity(self, severity: str) -> List[IncidentRecord]:
        return self.get_all_incidents(limit=1000, severity=severity)

    def update_incident_verification(self, incident_id: str, status: str, tx_hash: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if tx_hash:
                cursor.execute(
                    "UPDATE incidents SET verification_status = ?, blockchain_tx_hash = ?, updated_at = ? WHERE incident_id = ?",
                    (status, tx_hash, datetime.now(timezone.utc).isoformat(), incident_id)
                )
            else:
                cursor.execute(
                    "UPDATE incidents SET verification_status = ?, updated_at = ? WHERE incident_id = ?",
                    (status, datetime.now(timezone.utc).isoformat(), incident_id)
                )
            conn.commit()

    def update_incident_resolution(self, incident_id: str, status: str, tx_hash: Optional[str] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if tx_hash:
                cursor.execute(
                    "UPDATE incidents SET resolution_status = ?, blockchain_tx_hash = ?, updated_at = ? WHERE incident_id = ?",
                    (status, tx_hash, datetime.now(timezone.utc).isoformat(), incident_id)
                )
            else:
                cursor.execute(
                    "UPDATE incidents SET resolution_status = ?, updated_at = ? WHERE incident_id = ?",
                    (status, datetime.now(timezone.utc).isoformat(), incident_id)
                )
            conn.commit()

    def update_incident_blockchain_id(self, incident_id: str, blockchain_id: int, tx_hash: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE incidents SET blockchain_incident_id = ?, blockchain_tx_hash = ?, updated_at = ? WHERE incident_id = ?",
                (blockchain_id, tx_hash, datetime.now(timezone.utc).isoformat(), incident_id)
            )
            conn.commit()

    def create_threat_intel(self, intel: ThreatIntelRecord) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO threat_intelligence (
                    intel_id, indicator, indicator_type, description,
                    campaign_id, timestamp, reporter_address,
                    verified, blockchain_intel_id, status,
                    confidence_score, source, reviewer_address,
                    review_notes, reviewed_at, conflict_detected,
                    conflict_details, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                intel.intel_id, intel.indicator, intel.indicator_type,
                intel.description, intel.campaign_id, intel.timestamp,
                intel.reporter_address, int(intel.verified),
                intel.blockchain_intel_id, intel.status or "SUBMITTED",
                intel.confidence_score if intel.confidence_score is not None else 50,
                intel.source or "COMMUNITY_REPORT",
                intel.reviewer_address, intel.review_notes, intel.reviewed_at,
                int(intel.conflict_detected), intel.conflict_details, intel.created_at
            ))
            conn.commit()
            return cursor.lastrowid

    def get_threat_intel(self, intel_id: str) -> Optional[ThreatIntelRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM threat_intelligence WHERE intel_id = ?", (intel_id,))
            row = cursor.fetchone()
            if row:
                return self._row_to_threat_intel(row)
            return None

    def get_all_threat_intel(self, verified_only: bool = False) -> List[ThreatIntelRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if verified_only:
                cursor.execute("SELECT * FROM threat_intelligence WHERE verified = 1 ORDER BY created_at DESC")
            else:
                cursor.execute("SELECT * FROM threat_intelligence ORDER BY created_at DESC")
            return [self._row_to_threat_intel(row) for row in cursor.fetchall()]

    def update_threat_intel_verification(self, intel_id: str, verified: bool, blockchain_id: Optional[int] = None):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if blockchain_id:
                cursor.execute(
                    "UPDATE threat_intelligence SET verified = ?, blockchain_intel_id = ? WHERE intel_id = ?",
                    (int(verified), blockchain_id, intel_id)
                )
            else:
                cursor.execute(
                    "UPDATE threat_intelligence SET verified = ? WHERE intel_id = ?",
                    (int(verified), intel_id)
                )
            conn.commit()

    def create_reporter(self, reporter: ReporterRecord) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR IGNORE INTO reporters (
                    address, reputation_score, total_reports,
                    verified_reports, false_reports, registered,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                reporter.address, reporter.reputation_score,
                reporter.total_reports, reporter.verified_reports,
                reporter.false_reports, int(reporter.registered),
                reporter.created_at, reporter.updated_at
            ))
            conn.commit()
            return cursor.lastrowid

    def get_reporter(self, address: str) -> Optional[ReporterRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM reporters WHERE address = ?", (address.lower(),))
            row = cursor.fetchone()
            if row:
                return self._row_to_reporter(row)
            return None

    def update_reporter_stats(self, address: str, reputation_change: int = 0,
                              total_reports_change: int = 0, verified_change: int = 0, false_change: int = 0):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE reporters SET
                    reputation_score = reputation_score + ?,
                    total_reports = total_reports + ?,
                    verified_reports = verified_reports + ?,
                    false_reports = false_reports + ?,
                    updated_at = ?
                WHERE address = ?
            """, (reputation_change, total_reports_change, verified_change, false_change,
                  datetime.now(timezone.utc).isoformat(), address.lower()))
            conn.commit()

    def _row_to_incident(self, row: sqlite3.Row) -> IncidentRecord:
        return IncidentRecord(
            id=row["id"],
            incident_id=row["incident_id"],
            external_id=row["external_id"],
            evidence_hash=row["evidence_hash"],
            timestamp=row["timestamp"],
            cpu_usage=row["cpu_usage"],
            memory_usage=row["memory_usage"],
            process_name=row["process_name"],
            process_runtime_seconds=row["process_runtime_seconds"],
            network_destination=row["network_destination"],
            container_name=row["container_name"],
            environment=row["environment"],
            risk_score=row["risk_score"],
            severity=row["severity"],
            factors=row["factors"],
            blockchain_tx_hash=row["blockchain_tx_hash"],
            blockchain_incident_id=row["blockchain_incident_id"],
            verification_status=row["verification_status"],
            resolution_status=row["resolution_status"],
            threat_intel_ref=row["threat_intel_ref"],
            reporter_address=row["reporter_address"],
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )

    def _row_to_threat_intel(self, row: sqlite3.Row) -> ThreatIntelRecord:
        row_dict = dict(row)
        return ThreatIntelRecord(
            id=row_dict.get("id"),
            intel_id=row_dict.get("intel_id", ""),
            indicator=row_dict.get("indicator", ""),
            indicator_type=row_dict.get("indicator_type", ""),
            description=row_dict.get("description", ""),
            campaign_id=row_dict.get("campaign_id", ""),
            timestamp=row_dict.get("timestamp", ""),
            reporter_address=row_dict.get("reporter_address"),
            verified=bool(row_dict.get("verified", 0)),
            blockchain_intel_id=row_dict.get("blockchain_intel_id"),
            status=row_dict.get("status", "SUBMITTED"),
            confidence_score=row_dict.get("confidence_score", 50),
            source=row_dict.get("source", "COMMUNITY_REPORT"),
            reviewer_address=row_dict.get("reviewer_address"),
            review_notes=row_dict.get("review_notes"),
            reviewed_at=row_dict.get("reviewed_at"),
            conflict_detected=bool(row_dict.get("conflict_detected", 0)),
            conflict_details=row_dict.get("conflict_details"),
            created_at=row_dict.get("created_at", "")
        )

    def _row_to_reporter(self, row: sqlite3.Row) -> ReporterRecord:
        return ReporterRecord(
            id=row["id"],
            address=row["address"],
            reputation_score=row["reputation_score"],
            total_reports=row["total_reports"],
            verified_reports=row["verified_reports"],
            false_reports=row["false_reports"],
            registered=bool(row["registered"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"]
        )

    def add_incident_note(self, incident_id: str, author: str, note: str) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO incident_notes (incident_id, author, note, created_at)
                VALUES (?, ?, ?, ?)
            """, (incident_id, author, note, datetime.now(timezone.utc).isoformat()))
            conn.commit()
            return cursor.lastrowid

    def get_incident_notes(self, incident_id: str) -> List[IncidentNoteRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM incident_notes WHERE incident_id = ? ORDER BY created_at ASC",
                (incident_id,)
            )
            return [
                IncidentNoteRecord(
                    id=row["id"],
                    incident_id=row["incident_id"],
                    author=row["author"],
                    note=row["note"],
                    created_at=row["created_at"]
                )
                for row in cursor.fetchall()
            ]

    def log_audit(self, action: str, target_id: Optional[str] = None, actor: str = "System",
                  outcome: str = "SUCCESS", details: Optional[Dict[str, Any]] = None) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            details_json = json.dumps(details or {})
            cursor.execute("""
                INSERT INTO audit_logs (action, target_id, actor, outcome, details, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (action, target_id, actor, outcome, details_json, datetime.now(timezone.utc).isoformat()))
            conn.commit()
            return cursor.lastrowid

    def get_audit_logs(self, limit: int = 50, offset: int = 0) -> List[AuditLogRecord]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                (limit, offset)
            )
            return [
                AuditLogRecord(
                    id=row["id"],
                    action=row["action"],
                    target_id=row["target_id"],
                    actor=row["actor"],
                    outcome=row["outcome"],
                    details=row["details"],
                    timestamp=row["timestamp"]
                )
                for row in cursor.fetchall()
            ]

    def save_response_evaluation(self, eval_data: Dict[str, Any]) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            timeline_str = json.dumps(eval_data.get("timeline", []))
            cursor.execute("""
                INSERT INTO response_evaluations (
                    simulation_id, incident_id, workload_type, process_name, severity, risk_score,
                    recommended_action, executed_action, authorization_status, authorized_by,
                    execution_mode, containment_outcome, detection_latency_ms, response_latency_ms,
                    cpu_before, cpu_after, memory_before, memory_after, cpu_reduction_pct,
                    evidence_hash, timeline, created_at, completed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                eval_data.get("simulation_id"),
                eval_data.get("incident_id"),
                eval_data.get("workload_type"),
                eval_data.get("target_process"),
                eval_data.get("severity"),
                eval_data.get("risk_score"),
                eval_data.get("recommendation", {}).get("action") if isinstance(eval_data.get("recommendation"), dict) else eval_data.get("recommended_action"),
                eval_data.get("executed_action"),
                eval_data.get("authorization_status", "PENDING_AUTHORIZATION"),
                eval_data.get("authorized_by"),
                eval_data.get("execution_mode", "SIMULATED_CONTAINMENT"),
                eval_data.get("containment_outcome"),
                eval_data.get("detection_latency_ms"),
                eval_data.get("response_latency_ms"),
                eval_data.get("telemetry_before", {}).get("cpu_usage", eval_data.get("cpu_before")),
                eval_data.get("telemetry_after", {}).get("cpu_usage", eval_data.get("cpu_after")),
                eval_data.get("telemetry_before", {}).get("memory_usage_mb", eval_data.get("memory_before")),
                eval_data.get("telemetry_after", {}).get("memory_usage_mb", eval_data.get("memory_after")),
                eval_data.get("cpu_reduction_pct"),
                eval_data.get("evidence_hash"),
                timeline_str,
                eval_data.get("created_at"),
                eval_data.get("completed_at")
            ))
            conn.commit()
            return cursor.lastrowid

    def update_response_evaluation(self, simulation_id: str, update_data: Dict[str, Any]) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            timeline_str = json.dumps(update_data.get("timeline", []))
            cursor.execute("""
                UPDATE response_evaluations
                SET executed_action = ?,
                    authorization_status = ?,
                    authorized_by = ?,
                    execution_mode = ?,
                    containment_outcome = ?,
                    response_latency_ms = ?,
                    cpu_before = ?,
                    cpu_after = ?,
                    memory_before = ?,
                    memory_after = ?,
                    cpu_reduction_pct = ?,
                    timeline = ?,
                    completed_at = ?
                WHERE simulation_id = ?
            """, (
                update_data.get("executed_action"),
                update_data.get("authorization_status", "AUTHORIZED"),
                update_data.get("authorized_by"),
                update_data.get("execution_mode", "SIMULATED_CONTAINMENT"),
                update_data.get("containment_outcome"),
                update_data.get("response_latency_ms"),
                update_data.get("telemetry_before", {}).get("cpu_usage", update_data.get("cpu_before")),
                update_data.get("telemetry_after", {}).get("cpu_usage", update_data.get("cpu_after")),
                update_data.get("telemetry_before", {}).get("memory_usage_mb", update_data.get("memory_before")),
                update_data.get("telemetry_after", {}).get("memory_usage_mb", update_data.get("memory_after")),
                update_data.get("cpu_reduction_pct"),
                timeline_str,
                update_data.get("completed_at"),
                simulation_id
            ))
            conn.commit()
            return cursor.rowcount > 0

    def get_response_evaluation(self, simulation_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM response_evaluations WHERE simulation_id = ?", (simulation_id,))
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            try:
                res["timeline"] = json.loads(res.get("timeline") or "[]")
            except Exception:
                pass
            return res

    def get_all_response_evaluations(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM response_evaluations ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            result = []
            for r in rows:
                item = dict(r)
                try:
                    item["timeline"] = json.loads(item.get("timeline") or "[]")
                except Exception:
                    pass
                result.append(item)
            return result

    def get_response_effectiveness_summary(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_simulations,
                    SUM(CASE WHEN authorization_status = 'AUTHORIZED' THEN 1 ELSE 0 END) as authorized_count,
                    SUM(CASE WHEN containment_outcome = 'SUCCESS' THEN 1 ELSE 0 END) as successful_containments,
                    AVG(detection_latency_ms) as avg_detection_latency_ms,
                    AVG(response_latency_ms) as avg_response_latency_ms,
                    AVG(cpu_reduction_pct) as avg_cpu_reduction_pct
                FROM response_evaluations
            """)
            row = cursor.fetchone()
            if not row or row["total_simulations"] == 0:
                return {
                    "total_simulations": 0,
                    "authorized_count": 0,
                    "successful_containments": 0,
                    "containment_success_rate": 0.0,
                    "avg_detection_latency_ms": 0.0,
                    "avg_response_latency_ms": 0.0,
                    "avg_cpu_reduction_pct": 0.0
                }
            tot = row["total_simulations"] or 0
            succ = row["successful_containments"] or 0
            return {
                "total_simulations": tot,
                "authorized_count": row["authorized_count"] or 0,
                "successful_containments": succ,
                "containment_success_rate": round((succ / tot) * 100, 2) if tot > 0 else 0.0,
                "avg_detection_latency_ms": round(row["avg_detection_latency_ms"] or 0.0, 2),
                "avg_response_latency_ms": round(row["avg_response_latency_ms"] or 0.0, 2),
                "avg_cpu_reduction_pct": round(row["avg_cpu_reduction_pct"] or 0.0, 2)
            }

    def update_threat_intel_review(
        self,
        intel_id: str,
        status: str,
        reviewer_address: str,
        review_notes: Optional[str] = None,
        confidence_score: Optional[int] = None
    ) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            verified_val = 1 if status.upper() == "VERIFIED" else 0
            now_iso = datetime.now(timezone.utc).isoformat()
            if confidence_score is not None:
                cursor.execute("""
                    UPDATE threat_intelligence
                    SET status = ?, verified = ?, reviewer_address = ?, review_notes = ?, reviewed_at = ?, confidence_score = ?
                    WHERE intel_id = ?
                """, (status.upper(), verified_val, reviewer_address, review_notes, now_iso, confidence_score, intel_id))
            else:
                cursor.execute("""
                    UPDATE threat_intelligence
                    SET status = ?, verified = ?, reviewer_address = ?, review_notes = ?, reviewed_at = ?
                    WHERE intel_id = ?
                """, (status.upper(), verified_val, reviewer_address, review_notes, now_iso, intel_id))
            conn.commit()
            return cursor.rowcount > 0

    def check_threat_intel_conflicts(self, indicator: str, indicator_type: str, campaign_id: str) -> tuple[bool, Optional[str]]:
        """
        Check if an indicator has conflicting classification or attributes in the DB.
        Returns: (is_conflict: bool, conflict_details: str)
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM threat_intelligence WHERE LOWER(indicator) = ?", (indicator.lower().strip(),))
            rows = cursor.fetchall()
            for r in rows:
                existing_type = r["indicator_type"]
                existing_campaign = r["campaign_id"]
                if existing_type.lower() != indicator_type.lower():
                    return True, f"Conflict: Indicator '{indicator}' already classified as '{existing_type}', but newly submitted as '{indicator_type}' (ref {r['intel_id']})"
                if existing_campaign and campaign_id and existing_campaign.lower() != campaign_id.lower():
                    return True, f"Attribution discrepancy: Associated with campaign '{existing_campaign}' vs '{campaign_id}' (ref {r['intel_id']})"
            return False, None

    def update_reporter_stats_with_antigaming(self, address: str, action: str) -> Dict[str, Any]:
        """
        Transparent reputation rules with anti-gaming protections:
        - 'VERIFIED_REPORT': +5 reputation (capped at 200)
        - 'REJECTED_REPORT': -15 reputation (floored at 0)
        - 'RAPID_DUPLICATE_SPAM': -5 reputation penalty (anti-gaming against rapid repeated submissions)
        """
        clean_addr = address.lower()
        rep = self.get_reporter(clean_addr)
        if not rep:
            self.create_reporter(ReporterRecord(address=clean_addr))
            rep = self.get_reporter(clean_addr)

        current_score = rep.reputation_score if rep else 100
        rep_change = 0
        total_chg = 0
        verif_chg = 0
        false_chg = 0

        if action == "VERIFIED_REPORT":
            rep_change = 5
            total_chg = 1
            verif_chg = 1
        elif action == "REJECTED_REPORT":
            rep_change = -15
            total_chg = 1
            false_chg = 1
        elif action == "RAPID_DUPLICATE_SPAM":
            rep_change = -5

        new_score = max(0, min(200, current_score + rep_change))
        actual_change = new_score - current_score

        self.update_reporter_stats(
            address=clean_addr,
            reputation_change=actual_change,
            total_reports_change=total_chg,
            verified_change=verif_chg,
            false_change=false_chg
        )

        return {
            "address": clean_addr,
            "previous_reputation": current_score,
            "new_reputation": new_score,
            "change": actual_change,
            "action_evaluated": action
        }

    def save_verification_history(self, record: VerificationHistoryRecord) -> int:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO verification_history (
                    incident_id, verification_outcome, computed_hash, stored_hash,
                    on_chain_hash, verifier_address, blockchain_tx_hash,
                    block_number, gas_used, details, verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.incident_id, record.verification_outcome, record.computed_hash,
                record.stored_hash, record.on_chain_hash, record.verifier_address,
                record.blockchain_tx_hash, record.block_number, record.gas_used,
                record.details if isinstance(record.details, str) else json.dumps(record.details),
                record.verified_at
            ))
            conn.commit()
            return cursor.lastrowid

    def get_verification_history(self, incident_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if incident_id:
                cursor.execute(
                    "SELECT * FROM verification_history WHERE incident_id = ? ORDER BY id DESC LIMIT ?",
                    (incident_id, limit)
                )
            else:
                cursor.execute(
                    "SELECT * FROM verification_history ORDER BY id DESC LIMIT ?",
                    (limit,)
                )
            rows = cursor.fetchall()
            return [dict(r) for r in rows]