import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from detector import DetectionEngine, TelemetryData, Severity
from detector.rules import MiningIndicators, RuleEngine
from evidence import EvidenceGenerator, EvidenceHasher, IncidentEvidence


class TestMiningIndicators:
    def test_suspicious_process_detection(self):
        assert MiningIndicators.is_suspicious_process("xmrig") is True
        assert MiningIndicators.is_suspicious_process("XMRig") is True
        assert MiningIndicators.is_suspicious_process("cpuminer") is True
        assert MiningIndicators.is_suspicious_process("nginx") is False
        assert MiningIndicators.is_suspicious_process("python") is False

    def test_suspicious_destination_detection(self):
        assert MiningIndicators.is_suspicious_destination("minexmr.com") is True
        assert MiningIndicators.is_suspicious_destination("supportxmr.com") is True
        assert MiningIndicators.is_suspicious_destination("google.com") is False
        assert MiningIndicators.is_suspicious_destination(None) is False
        assert MiningIndicators.is_suspicious_destination("") is False


class TestRuleEngine:
    def setup_method(self):
        self.engine = RuleEngine()
        self.indicators = MiningIndicators()

    def test_cpu_usage_scoring(self):
        score, factors = self.engine.check_cpu_usage(95)
        assert score == 30
        assert factors["cpu_high"] is True

        score, factors = self.engine.check_cpu_usage(80)
        assert score == 15
        assert factors["cpu_elevated"] is True

        score, factors = self.engine.check_cpu_usage(60)
        assert score == 5
        assert factors["cpu_moderate"] is True

        score, factors = self.engine.check_cpu_usage(30)
        assert score == 0
        assert factors["cpu_normal"] is True

    def test_process_name_scoring(self):
        score, factors = self.engine.check_process_name("xmrig", self.indicators)
        assert score == 25
        assert factors["suspicious_process"] is True

        score, factors = self.engine.check_process_name("nginx", self.indicators)
        assert score == 0
        assert factors["suspicious_process"] is False

    def test_network_destination_scoring(self):
        score, factors = self.engine.check_network_destination("minexmr.com", self.indicators)
        assert score == 25
        assert factors["suspicious_network"] is True

        score, factors = self.engine.check_network_destination("google.com", self.indicators)
        assert score == 0
        assert factors["suspicious_network"] is False

    def test_process_runtime_scoring(self):
        score, factors = self.engine.check_process_runtime(7200)
        assert score == 20
        assert factors["long_running"] is True

        score, factors = self.engine.check_process_runtime(2000)
        assert score == 10
        assert factors["moderate_running"] is True

        score, factors = self.engine.check_process_runtime(100)
        assert score == 0
        assert factors["short_running"] is True


class TestDetectionEngine:
    def setup_method(self):
        self.engine = DetectionEngine()

    def test_normal_workload(self):
        telemetry = TelemetryData(
            cpu_usage=45,
            memory_usage=55,
            process_name="nginx",
            process_runtime_seconds=300,
            network_destination="api.example.com"
        )
        result = self.engine.analyze(telemetry)
        assert result.score < 35
        assert result.severity == Severity.LOW
        assert self.engine.is_suspicious(telemetry) is False

    def test_cryptojacking_workload(self):
        telemetry = TelemetryData(
            cpu_usage=94,
            memory_usage=71,
            process_name="xmrig",
            process_runtime_seconds=7200,
            network_destination="minexmr.com"
        )
        result = self.engine.analyze(telemetry)
        assert result.score >= 85
        assert result.severity in (Severity.HIGH, Severity.CRITICAL)
        assert self.engine.is_suspicious(telemetry) is True
        assert len(result.reasons) >= 3

    def test_medium_risk(self):
        telemetry = TelemetryData(
            cpu_usage=85,
            memory_usage=75,
            process_name="unknown_process",
            process_runtime_seconds=2000,
            network_destination="example.com"
        )
        result = self.engine.analyze(telemetry)
        assert 35 <= result.score <= 65
        assert result.severity == Severity.MEDIUM

    def test_severity_boundaries(self):
        # LOW
        low = TelemetryData(cpu_usage=20, memory_usage=30, process_name="bash", process_runtime_seconds=60)
        assert self.engine.analyze(low).severity == Severity.LOW

        # CRITICAL
        crit = TelemetryData(cpu_usage=95, memory_usage=88, process_name="xmrig", process_runtime_seconds=7200, network_destination="minexmr.com")
        res = self.engine.analyze(crit)
        assert res.score >= 85
        assert res.severity == Severity.CRITICAL


class TestEvidenceGenerator:
    def setup_method(self):
        self.generator = EvidenceGenerator()
        self.engine = DetectionEngine()

    def test_generate_evidence(self):
        telemetry = TelemetryData(
            cpu_usage=94,
            memory_usage=71,
            process_name="xmrig",
            process_runtime_seconds=7200,
            network_destination="minexmr.com"
        )
        risk_score = self.engine.analyze(telemetry)
        evidence = self.generator.generate(telemetry, risk_score)

        assert evidence.incident_id.startswith("INC-")
        assert evidence.cpu_usage == 94
        assert evidence.memory_usage == 71
        assert evidence.process_name == "xmrig"
        assert evidence.risk_score >= 85
        assert evidence.severity in ("HIGH", "CRITICAL")
        assert "cpu_high" in evidence.factors
        assert "suspicious_process" in evidence.factors

    def test_evidence_to_dict(self):
        telemetry = TelemetryData(
            cpu_usage=45,
            memory_usage=55,
            process_name="nginx",
            process_runtime_seconds=300
        )
        risk_score = self.engine.analyze(telemetry)
        evidence = self.generator.generate(telemetry, risk_score)
        data = evidence.to_dict()

        assert isinstance(data, dict)
        assert data["incident_id"] == evidence.incident_id
        assert data["cpu_usage"] == 45


class TestEvidenceHasher:
    def setup_method(self):
        self.hasher = EvidenceHasher()
        self.generator = EvidenceGenerator()
        self.engine = DetectionEngine()

    def test_hash_consistency(self):
        telemetry = TelemetryData(
            cpu_usage=94,
            memory_usage=71,
            process_name="xmrig",
            process_runtime_seconds=7200,
            network_destination="minexmr.com"
        )
        risk_score = self.engine.analyze(telemetry)
        evidence = self.generator.generate(telemetry, risk_score)

        hash1 = self.hasher.hash_evidence(evidence)
        hash2 = self.hasher.hash_evidence(evidence)
        assert hash1 == hash2
        assert len(hash1) == 64

    def test_hash_verification(self):
        telemetry = TelemetryData(
            cpu_usage=94,
            memory_usage=71,
            process_name="xmrig",
            process_runtime_seconds=7200,
            network_destination="minexmr.com"
        )
        risk_score = self.engine.analyze(telemetry)
        evidence = self.generator.generate(telemetry, risk_score)

        evidence_hash = self.hasher.hash_evidence(evidence)
        assert self.hasher.verify(evidence, evidence_hash) is True

        tampered_evidence = IncidentEvidence(
            incident_id=evidence.incident_id,
            timestamp=evidence.timestamp,
            cpu_usage=50,
            memory_usage=evidence.memory_usage,
            process_name=evidence.process_name,
            process_runtime_seconds=evidence.process_runtime_seconds,
            network_destination=evidence.network_destination,
            container_name=evidence.container_name,
            environment=evidence.environment,
            risk_score=evidence.risk_score,
            severity=evidence.severity,
            factors=evidence.factors
        )
        assert self.hasher.verify(tampered_evidence, evidence_hash) is False

    def test_dict_hashing(self):
        data = {"key": "value", "number": 42}
        hash1 = self.hasher.hash_dict(data)
        hash2 = self.hasher.hash_dict(data)
        assert hash1 == hash2
        assert self.hasher.verify_dict(data, hash1) is True

        tampered = {"key": "value", "number": 43}
        assert self.hasher.verify_dict(tampered, hash1) is False


    def test_camelcase_and_snakecase_hash_equivalence(self):
        camel_data = {
            "incidentId": "INC-TEST-99",
            "timestamp": "2024-01-01T00:00:00Z",
            "cpuUsage": 94,
            "memoryUsage": 71,
            "processName": "xmrig",
            "processRuntimeSeconds": 7200,
            "networkDestination": "minexmr.com",
            "containerName": None,
            "environment": "HOST",
            "riskScore": 100,
            "severity": "CRITICAL",
            "factors": {"cpu_high": True}
        }
        snake_data = {
            "incident_id": "INC-TEST-99",
            "timestamp": "2024-01-01T00:00:00Z",
            "cpu_usage": 94,
            "memory_usage": 71,
            "process_name": "xmrig",
            "process_runtime_seconds": 7200,
            "network_destination": "minexmr.com",
            "container_name": None,
            "environment": "HOST",
            "risk_score": 100,
            "severity": "CRITICAL",
            "factors": {"cpu_high": True}
        }
        hash_camel = self.hasher.hash_dict(camel_data)
        hash_snake = self.hasher.hash_dict(snake_data)
        assert hash_camel == hash_snake
        assert self.hasher.verify_dict(camel_data, hash_snake) is True


class TestDatabase:
    def setup_method(self):
        from database import Database
        self.db = Database(":memory:")

    def test_create_and_get_incident(self):
        from database.models import IncidentRecord
        incident = IncidentRecord(
            incident_id="INC-TEST-001",
            external_id="INC-TEST-001",
            evidence_hash="a" * 64,
            timestamp="2024-01-01T00:00:00Z",
            cpu_usage=94,
            memory_usage=71,
            process_name="xmrig",
            process_runtime_seconds=7200,
            network_destination="minexmr.com",
            container_name=None,
            environment="HOST",
            risk_score=92,
            severity="HIGH",
            factors='{"cpu_high": true}'
        )
        self.db.create_incident(incident)

        retrieved = self.db.get_incident_by_id("INC-TEST-001")
        assert retrieved is not None
        assert retrieved.incident_id == "INC-TEST-001"
        assert retrieved.risk_score == 92

    def test_get_incident_by_hash(self):
        from database.models import IncidentRecord
        incident = IncidentRecord(
            incident_id="INC-TEST-002",
            external_id="INC-TEST-002",
            evidence_hash="b" * 64,
            timestamp="2024-01-01T00:00:00Z",
            cpu_usage=45,
            memory_usage=55,
            process_name="nginx",
            process_runtime_seconds=300,
            environment="HOST",
            risk_score=10,
            severity="LOW",
            factors='{}'
        )
        self.db.create_incident(incident)

        retrieved = self.db.get_incident_by_hash("b" * 64)
        assert retrieved is not None
        assert retrieved.incident_id == "INC-TEST-002"

    def test_incident_count(self):
        assert self.db.get_incidents_count() == 0

        from database.models import IncidentRecord
        for i in range(3):
            incident = IncidentRecord(
                incident_id=f"INC-TEST-{i:03d}",
                external_id=f"INC-TEST-{i:03d}",
                evidence_hash=f"{i}" * 64,
                timestamp="2024-01-01T00:00:00Z",
                cpu_usage=50,
                memory_usage=50,
                process_name="test",
                process_runtime_seconds=100,
                environment="HOST",
                risk_score=10,
                severity="LOW",
                factors='{}'
            )
            self.db.create_incident(incident)

        assert self.db.get_incidents_count() == 3

    def test_notes_and_audit_logging(self):
        note_id = self.db.add_incident_note("INC-TEST-001", "Analyst-1", "Suspicious miner traffic confirmed")
        assert note_id > 0
        notes = self.db.get_incident_notes("INC-TEST-001")
        assert len(notes) == 1
        assert notes[0].note == "Suspicious miner traffic confirmed"

        audit_id = self.db.log_audit("TEST_ACTION", "INC-TEST-001", "Admin", "SUCCESS", {"key": "val"})
        assert audit_id > 0
        logs = self.db.get_audit_logs(limit=10)
        assert len(logs) >= 1
        assert logs[0].action == "TEST_ACTION"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])