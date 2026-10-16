import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from detector.time_series_detector import (
    EnhancedDetector,
    TelemetrySample,
    SyntheticWorkloadHarness,
    ComparativeBenchmark
)
from app import app


class TestEnhancedDetectorPatterns:
    def setup_method(self):
        self.detector = EnhancedDetector(window_size=10, decision_threshold=40)
        self.harness = SyntheticWorkloadHarness()

    def test_sustained_mining_detection(self):
        samples = self.harness.generate_sustained_mining()
        result = self.detector.analyze_window(samples)
        assert result.is_threat is True
        assert result.pattern_type == "SUSTAINED_HIGH"
        assert result.score >= 70
        assert result.signals["sustained_high_ratio"] >= 0.8
        assert any("Sustained compute load" in r for r in result.reasons)

    def test_intermittent_bursty_duty_cycle_detection(self):
        samples = self.harness.generate_intermittent_bursty_mining()
        result = self.detector.analyze_window(samples)
        assert result.is_threat is True
        assert result.pattern_type == "INTERMITTENT_BURST"
        assert result.signals["has_alternating_duty_cycle"] is True
        assert any("duty-cycle" in r.lower() for r in result.reasons)

    def test_gradual_creep_mining_detection(self):
        samples = self.harness.generate_gradual_creep_mining()
        result = self.detector.analyze_window(samples)
        assert result.is_threat is True
        assert result.pattern_type == "GRADUAL_CREEP"
        assert result.signals["trend_slope"] > 2.0
        assert any("ramp-up" in r.lower() for r in result.reasons)

    def test_burst_then_cooldown_detection(self):
        samples = self.harness.generate_burst_then_cooldown()
        result = self.detector.analyze_window(samples)
        # Even though process throttled at the end, the early burst + known signature triggers alert
        assert result.is_threat is True
        assert result.score >= self.detector.decision_threshold

    def test_normal_heavy_workload_dampening(self):
        # Clang compilation has high CPU but is benign with no stratum dials
        samples = self.harness.generate_normal_heavy_workload()
        result = self.detector.analyze_window(samples)
        # Should NOT be classified as threat due to false-positive dampener
        assert result.is_threat is False
        assert result.signals["is_known_benign"] is True
        assert any("Benign workload damping" in r for r in result.reasons)

    def test_noisy_incomplete_telemetry_resilience(self):
        samples = self.harness.generate_noisy_incomplete_telemetry()
        # Should not crash on None network destination or fluctuating metrics
        result = self.detector.analyze_window(samples)
        assert result.score > 0
        assert isinstance(result.signals["mean_cpu"], float)

    def test_documented_failure_case_sub_threshold(self):
        # Sub-threshold 12% miner masked under systemd-resolve without known mining pools
        samples = self.harness.generate_sub_threshold_stealth_miner()
        result = self.detector.analyze_window(samples)
        # Expected failure boundary: detector cannot classify sub-threshold DoH miner without kernel eBPF
        assert result.is_threat is False
        assert result.score < self.detector.decision_threshold


class TestComparativeBenchmark:
    def test_benchmark_execution(self):
        comp = ComparativeBenchmark.run_comparison()
        assert "baseline_detector" in comp
        assert "enhanced_detector" in comp
        assert "failure_case_analysis" in comp

        base_metrics = comp["baseline_detector"]["metrics"]
        enh_metrics = comp["enhanced_detector"]["metrics"]

        # Enhanced detector achieves higher or equal recall
        assert enh_metrics["recall"] >= base_metrics["recall"]
        # Enhanced detector detects bursty mining that baseline might miss during low tick
        assert enh_metrics["f1_score"] >= base_metrics["f1_score"]

    def test_api_comparison_endpoint(self):
        client = app.test_client()
        res = client.get("/detector/comparison")
        assert res.status_code == 200
        data = res.get_json()
        assert "baseline_detector" in data
        assert "enhanced_detector" in data

    def test_api_analyze_window_endpoint(self):
        client = app.test_client()
        payload = {
            "samples": [
                {"cpu_usage": 95.0, "memory_usage": 80.0, "process_name": "xmrig", "process_runtime_seconds": 3600, "network_destination": "pool.supportxmr.com:3333"},
                {"cpu_usage": 96.0, "memory_usage": 81.0, "process_name": "xmrig", "process_runtime_seconds": 3660, "network_destination": "pool.supportxmr.com:3333"},
                {"cpu_usage": 97.0, "memory_usage": 82.0, "process_name": "xmrig", "process_runtime_seconds": 3720, "network_destination": "pool.supportxmr.com:3333"}
            ]
        }
        res = client.post("/detector/analyze-window", json=payload)
        assert res.status_code == 200
        data = res.get_json()
        assert data["is_threat"] is True
        assert data["score"] >= 65
