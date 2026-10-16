"""
Enhanced Evasion-Resistant Cryptojacking Detection Engine for BlockMineGuard.
Evaluates time-window sequences rather than single instantaneous CPU readings.
Detects:
- Sustained high CPU utilization
- Intermittent and bursty CPU evasion (periodic throttling / square wave mining)
- Gradually increasing resource consumption (creep / stealth ramp-up)
- Cooldown and duty-cycle evasion
- Normal CPU-intensive workloads (compilers, encoders) with false-positive dampening
- Tolerant of noisy or incomplete telemetry data
"""

from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import math

from detector.detection_engine import DetectionEngine, TelemetryData, RiskScore, Severity
from detector.rules import MiningIndicators, RuleEngine


@dataclass
class TelemetrySample:
    cpu_usage: float
    memory_usage: float
    process_name: str
    process_runtime_seconds: int
    network_destination: Optional[str] = None
    container_name: Optional[str] = None
    environment: str = "HOST"
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_telemetry_data(self) -> TelemetryData:
        return TelemetryData(
            cpu_usage=self.cpu_usage,
            memory_usage=self.memory_usage,
            process_name=self.process_name,
            process_runtime_seconds=self.process_runtime_seconds,
            network_destination=self.network_destination,
            container_name=self.container_name,
            environment=self.environment
        )


@dataclass
class WindowAnalysisResult:
    score: int
    severity: Severity
    is_threat: bool
    detection_delay_samples: int  # Samples needed to trigger detection
    pattern_type: str  # SUSTAINED, INTERMITTENT_BURST, GRADUAL_CREEP, BENIGN_COMPUTE, NOISY_BASELINE
    signals: Dict[str, Any]
    reasons: List[str]
    timestamp: str

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "severity": self.severity.value,
            "is_threat": self.is_threat,
            "detection_delay_samples": self.detection_delay_samples,
            "pattern_type": self.pattern_type,
            "signals": self.signals,
            "reasons": self.reasons,
            "timestamp": self.timestamp
        }


class EnhancedDetector:
    """
    Time-window aware evasion-resistant detection engine.
    Analyzes temporal patterns across a sliding sequence of telemetry samples.
    """

    KNOWN_BENIGN_PROCESSES = [
        "clang", "gcc", "rustc", "go_build", "javac", "ffmpeg",
        "blender", "postgres", "redis", "spark", "python3_torch",
        "node_exporter", "falco", "osquery", "kubelet", "rsync",
        "vector", "fluent", "systemd"
    ]

    def __init__(
        self,
        window_size: int = 10,
        decision_threshold: int = 40,
        sustained_cpu_thresh: float = 75.0,
        burst_high_thresh: float = 70.0,
        burst_low_thresh: float = 25.0
    ):
        self.window_size = window_size
        self.decision_threshold = decision_threshold
        self.sustained_cpu_thresh = sustained_cpu_thresh
        self.burst_high_thresh = burst_high_thresh
        self.burst_low_thresh = burst_low_thresh
        self.mining_indicators = MiningIndicators()

    def analyze_window(self, samples: List[TelemetrySample]) -> WindowAnalysisResult:
        """
        Analyzes a sequence of time-window telemetry samples.
        """
        if not samples:
            return WindowAnalysisResult(
                score=0,
                severity=Severity.LOW,
                is_threat=False,
                detection_delay_samples=0,
                pattern_type="EMPTY_WINDOW",
                signals={"error": "No samples provided"},
                reasons=["Empty telemetry window provided"],
                timestamp=datetime.now(timezone.utc).isoformat()
            )

        # 1. Clean & normalize readings (tolerant to noise/None values)
        valid_cpu = [s.cpu_usage for s in samples if s.cpu_usage is not None and not math.isnan(s.cpu_usage)]
        valid_mem = [s.memory_usage for s in samples if s.memory_usage is not None and not math.isnan(s.memory_usage)]
        
        if not valid_cpu:
            valid_cpu = [0.0]
        if not valid_mem:
            valid_mem = [0.0]

        n = len(valid_cpu)
        mean_cpu = sum(valid_cpu) / n
        max_cpu = max(valid_cpu)
        min_cpu = min(valid_cpu)

        # Standard deviation & Coefficient of variation (burstiness)
        variance = sum((x - mean_cpu) ** 2 for x in valid_cpu) / n if n > 1 else 0.0
        std_dev = math.sqrt(variance)
        coef_variation = (std_dev / mean_cpu) if mean_cpu > 0 else 0.0

        # Linear trend slope (detects gradual creep / ramp-up)
        if n >= 3:
            x_vals = list(range(n))
            x_mean = (n - 1) / 2.0
            num = sum((x - x_mean) * (y - mean_cpu) for x, y in zip(x_vals, valid_cpu))
            denom = sum((x - x_mean) ** 2 for x in x_vals)
            slope = (num / denom) if denom > 0 else 0.0
        else:
            slope = 0.0

        # Duty cycle / intermittent pattern analysis (alternating high and low)
        high_readings = sum(1 for c in valid_cpu if c >= self.burst_high_thresh)
        low_readings = sum(1 for c in valid_cpu if c <= self.burst_low_thresh)
        has_alternating_duty_cycle = (
            high_readings >= 2 and low_readings >= 2 and (high_readings + low_readings) >= (n * 0.7)
        )

        sustained_ratio = sum(1 for c in valid_cpu if c >= self.sustained_cpu_thresh) / n

        # Check process and network across all samples in window
        latest_sample = samples[-1]
        process_names = set(s.process_name.lower() for s in samples if s.process_name)
        network_dests = set(s.network_destination.lower() for s in samples if s.network_destination)

        suspicious_process_match = any(
            self.mining_indicators.is_suspicious_process(p) for p in process_names
        )
        suspicious_network_match = any(
            self.mining_indicators.is_suspicious_destination(dest) for dest in network_dests
        )

        is_known_benign = any(
            any(ben in p for ben in self.KNOWN_BENIGN_PROCESSES) for p in process_names
        )

        # 2. Multi-Signal Scoring Engine
        score = 0
        reasons = []
        pattern_type = "BASELINE"

        # Signal A: Sustained High Compute
        if sustained_ratio >= 0.8:
            score += 35
            reasons.append(f"Sustained compute load: {round(sustained_ratio*100)}% of time window >= {self.sustained_cpu_thresh}% CPU")
            pattern_type = "SUSTAINED_HIGH"
        elif sustained_ratio >= 0.5:
            score += 20
            reasons.append(f"Frequent elevated compute: {round(sustained_ratio*100)}% of window above {self.sustained_cpu_thresh}% CPU")

        # Signal B: Intermittent / Bursty Evasion Detection
        if has_alternating_duty_cycle:
            score += 30
            reasons.append(f"Intermittent mining duty-cycle detected: alternating high ({high_readings}) and throttled ({low_readings}) bursts (CoV: {round(coef_variation, 2)})")
            pattern_type = "INTERMITTENT_BURST"
        elif coef_variation > 0.45 and max_cpu >= 80.0:
            score += 15
            reasons.append(f"Bursty computation profile observed (Coefficient of Variation: {round(coef_variation, 2)})")

        # Signal C: Gradual Load Creep (Stealth Ramp-Up)
        if slope >= 2.5 and max_cpu >= 70.0:
            score += 25
            reasons.append(f"Gradual stealth ramp-up detected: resource consumption increasing with slope +{round(slope, 2)}%/sample")
            pattern_type = "GRADUAL_CREEP"

        # Signal D: Threat Intelligence & Process Signatures
        if suspicious_network_match:
            score += 35
            matched_dests = [d for d in network_dests if self.mining_indicators.is_suspicious_destination(d)]
            reasons.append(f"Cryptomining pool / stratum protocol destination confirmed: {', '.join(matched_dests)}")

        if suspicious_process_match:
            score += 25
            matched_procs = [p for p in process_names if self.mining_indicators.is_suspicious_process(p)]
            reasons.append(f"Known cryptomining binary signature matched: {', '.join(matched_procs)}")

        # Signal E: Runtime Persistence
        max_runtime = max((s.process_runtime_seconds for s in samples if s.process_runtime_seconds is not None), default=0)
        if max_runtime > 3600:
            score += 15
            reasons.append(f"Persistent execution duration: {max_runtime}s (> 1 hour runtime)")
        elif max_runtime > 1800:
            score += 10
            reasons.append(f"Elevated execution duration: {max_runtime}s (> 30 minutes runtime)")

        # Signal F: Memory Saturation Profile
        mean_mem = sum(valid_mem) / len(valid_mem)
        if mean_mem > 85.0:
            score += 10
            reasons.append(f"High memory saturation: {round(mean_mem, 1)}% average across window")

        # Signal G: False Positive Dampener for Known Benign Tools without Mining Dials
        if is_known_benign and not suspicious_network_match and not suspicious_process_match:
            score = max(0, score - 25)
            reasons.append(f"Benign workload damping applied: process identified as legitimate development/system daemon ('{latest_sample.process_name}') with no stratum traffic")
            if pattern_type == "SUSTAINED_HIGH":
                pattern_type = "BENIGN_COMPUTE"

        # Calculate Detection Delay (sample index where score would have crossed threshold)
        detection_delay_samples = len(samples)
        running_samples = []
        for idx, s in enumerate(samples, start=1):
            running_samples.append(s)
            if idx >= 3:
                # Fast check on running prefix
                prefix_cpu = [x.cpu_usage for x in running_samples if x.cpu_usage is not None]
                if prefix_cpu:
                    p_mean = sum(prefix_cpu) / len(prefix_cpu)
                    has_net = any(self.mining_indicators.is_suspicious_destination(x.network_destination) for x in running_samples)
                    has_proc = any(self.mining_indicators.is_suspicious_process(x.process_name) for x in running_samples)
                    if (has_net and p_mean > 50) or (has_proc and p_mean > 60) or (p_mean > 85 and idx >= 4):
                        detection_delay_samples = idx
                        break

        # Final score clamping and severity grading
        score = max(0, min(100, score))

        if score >= 85:
            severity = Severity.CRITICAL
        elif score >= 65:
            severity = Severity.HIGH
        elif score >= self.decision_threshold:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        is_threat = (score >= self.decision_threshold)

        signals_dict = {
            "window_size": len(samples),
            "mean_cpu": round(mean_cpu, 2),
            "max_cpu": round(max_cpu, 2),
            "min_cpu": round(min_cpu, 2),
            "cpu_std_dev": round(std_dev, 2),
            "coef_variation": round(coef_variation, 2),
            "trend_slope": round(slope, 2),
            "sustained_high_ratio": round(sustained_ratio, 2),
            "has_alternating_duty_cycle": has_alternating_duty_cycle,
            "suspicious_network_match": suspicious_network_match,
            "suspicious_process_match": suspicious_process_match,
            "is_known_benign": is_known_benign,
            "max_runtime_seconds": max_runtime,
            "mean_memory": round(mean_mem, 2)
        }

        if not reasons:
            reasons.append("Workload time-window demonstrates nominal operating metrics")

        return WindowAnalysisResult(
            score=score,
            severity=severity,
            is_threat=is_threat,
            detection_delay_samples=detection_delay_samples,
            pattern_type=pattern_type,
            signals=signals_dict,
            reasons=reasons,
            timestamp=datetime.now(timezone.utc).isoformat()
        )


# =============================================================================
# SYNTHETIC WORKLOAD PATTERN GENERATORS FOR EXPERIMENTAL EVALUATION
# =============================================================================

class SyntheticWorkloadHarness:
    """
    Generates controlled, reproducible synthetic workload patterns to evaluate
    and compare baseline single-snapshot detection vs enhanced time-series detection.
    """

    @staticmethod
    def generate_sustained_mining(length: int = 10) -> List[TelemetrySample]:
        """Pattern 1: Sustained continuous high-intensity mining (XMRig)"""
        return [
            TelemetrySample(
                cpu_usage=round(94.0 + (i % 3) * 1.5, 1),
                memory_usage=82.0,
                process_name="xmrig",
                process_runtime_seconds=7200 + i * 60,
                network_destination="pool.supportxmr.com:3333",
                environment="HOST"
            )
            for i in range(length)
        ]

    @staticmethod
    def generate_intermittent_bursty_mining(length: int = 10) -> List[TelemetrySample]:
        """Pattern 2: Bursty / throttled evasive miner (pulsing 92% then 15% duty cycle)"""
        samples = []
        for i in range(length):
            # Alternating pulse: high for 2 ticks, low for 2 ticks
            is_pulse = ((i // 2) % 2 == 0)
            cpu = 92.0 if is_pulse else 14.0
            samples.append(TelemetrySample(
                cpu_usage=cpu,
                memory_usage=76.0,
                process_name="kworker_stealth",
                process_runtime_seconds=5400 + i * 30,
                network_destination="stratum+tcp://minexmr.com:4444",
                environment="HOST"
            ))
        return samples

    @staticmethod
    def generate_gradual_creep_mining(length: int = 10) -> List[TelemetrySample]:
        """Pattern 3: Stealth ramp-up creep (increasing from 15% to 88% over window)"""
        samples = []
        for i in range(length):
            cpu = round(15.0 + (i / max(1, length - 1)) * 73.0, 1)
            samples.append(TelemetrySample(
                cpu_usage=cpu,
                memory_usage=65.0 + i * 1.5,
                process_name="sysrv-worm",
                process_runtime_seconds=3600 + i * 120,
                network_destination="xmr.2miners.com:2222",
                environment="CONTAINER",
                container_name="app-sandbox-01"
            ))
        return samples

    @staticmethod
    def generate_burst_then_cooldown(length: int = 10) -> List[TelemetrySample]:
        """Pattern 4: Spiked mining burst followed by sudden evasion cooldown"""
        samples = []
        for i in range(length):
            if i < 3:
                cpu = 95.0
                net = "stratum.monerohash.com:3333"
            else:
                cpu = 12.0
                net = None  # Drops stratum connection to hide
            samples.append(TelemetrySample(
                cpu_usage=cpu,
                memory_usage=70.0,
                process_name="cpuminer-opt",
                process_runtime_seconds=4200 + i * 60,
                network_destination=net,
                environment="HOST"
            ))
        return samples

    @staticmethod
    def generate_normal_heavy_workload(length: int = 10) -> List[TelemetrySample]:
        """Pattern 5: Benign high-compute workload (C++ compiler / video transcoder)"""
        return [
            TelemetrySample(
                cpu_usage=round(88.0 + (i % 4) * 2.0, 1),
                memory_usage=72.0,
                process_name="clang++_compiler",
                process_runtime_seconds=3800 + i * 30,
                network_destination=None,  # No mining pool dials
                environment="CONTAINER",
                container_name="ci-runner-build-09"
            )
            for i in range(length)
        ]

    @staticmethod
    def generate_noisy_incomplete_telemetry(length: int = 10) -> List[TelemetrySample]:
        """Pattern 6: Fluctuating / noisy telemetry with missing network fields"""
        samples = []
        for i in range(length):
            cpu = 20.0 if i % 2 == 0 else 85.0
            net = "pool.hashvault.pro:80" if i % 3 == 0 else None
            samples.append(TelemetrySample(
                cpu_usage=cpu,
                memory_usage=55.0,
                process_name="syno-miner",
                process_runtime_seconds=1800 + i * 40,
                network_destination=net,
                environment="HOST"
            ))
        return samples

    @staticmethod
    def generate_sub_threshold_stealth_miner(length: int = 10) -> List[TelemetrySample]:
        """
        Pattern 7 (Documented Failure Case / Evasion Boundary):
        Sub-threshold stealth miner that limits CPU to 12%, uses a generic masqueraded name,
        and uses DNS-over-HTTPS or Tor proxy so destination looks like regular port 443.
        Both baseline and enhanced heuristic detectors fail here without kernel eBPF / deeper inspection.
        """
        return [
            TelemetrySample(
                cpu_usage=12.5,
                memory_usage=30.0,
                process_name="systemd-resolve",
                process_runtime_seconds=7200 + i * 60,
                network_destination="cloudflare-dns.com:443",
                environment="HOST"
            )
            for i in range(length)
        ]


class ComparativeBenchmark:
    """
    Executes side-by-side comparative evaluation of Baseline Detector (single snapshot)
    versus Enhanced Detector (time-series window).
    """

    @staticmethod
    def run_comparison() -> Dict[str, Any]:
        baseline = DetectionEngine(medium_threshold=35)
        enhanced = EnhancedDetector(window_size=10, decision_threshold=40)
        harness = SyntheticWorkloadHarness()

        test_cases = [
            ("Sustained High Mining", harness.generate_sustained_mining(), True, "Direct sustained mining"),
            ("Intermittent/Bursty Evasive Mining", harness.generate_intermittent_bursty_mining(), True, "Periodic throttling duty cycle"),
            ("Gradual Load Creep Mining", harness.generate_gradual_creep_mining(), True, "Slow ramp-up evasion"),
            ("Burst Then Cooldown", harness.generate_burst_then_cooldown(), True, "Short burst then hibernation"),
            ("Benign Clang Compilation", harness.generate_normal_heavy_workload(), False, "High CPU legitimate compiler"),
            ("Noisy Incomplete Telemetry", harness.generate_noisy_incomplete_telemetry(), True, "Fluctuating miner telemetry"),
            ("Sub-Threshold Stealth (Failure Case)", harness.generate_sub_threshold_stealth_miner(), True, "Ultra-low 12% throttle miner with DoH")
        ]

        baseline_results = []
        enhanced_results = []

        baseline_tp, baseline_fp, baseline_tn, baseline_fn = 0, 0, 0, 0
        enhanced_tp, enhanced_fp, enhanced_tn, enhanced_fn = 0, 0, 0, 0

        baseline_delays = []
        enhanced_delays = []

        for name, samples, is_threat, desc in test_cases:
            # 1. Baseline: evaluate on latest snapshot sample[-1]
            last_sample = samples[-1]
            base_score = baseline.analyze(last_sample.to_telemetry_data())
            base_pred = (base_score.score >= baseline.medium_threshold)

            if is_threat and base_pred:
                baseline_tp += 1
                baseline_delays.append(len(samples))  # snapshot only catches at end
            elif not is_threat and base_pred:
                baseline_fp += 1
            elif not is_threat and not base_pred:
                baseline_tn += 1
            else:
                baseline_fn += 1

            baseline_results.append({
                "name": name,
                "description": desc,
                "ground_truth": "THREAT" if is_threat else "BENIGN",
                "predicted": "THREAT" if base_pred else "BENIGN",
                "score": base_score.score,
                "severity": base_score.severity.value,
                "detected": base_pred
            })

            # 2. Enhanced: evaluate full window
            enh_res = enhanced.analyze_window(samples)
            enh_pred = enh_res.is_threat

            if is_threat and enh_pred:
                enhanced_tp += 1
                enhanced_delays.append(enh_res.detection_delay_samples)
            elif not is_threat and enh_pred:
                enhanced_fp += 1
            elif not is_threat and not enh_pred:
                enhanced_tn += 1
            else:
                enhanced_fn += 1

            enhanced_results.append({
                "name": name,
                "description": desc,
                "ground_truth": "THREAT" if is_threat else "BENIGN",
                "predicted": "THREAT" if enh_pred else "BENIGN",
                "score": enh_res.score,
                "severity": enh_res.severity.value,
                "detected": enh_pred,
                "pattern_type": enh_res.pattern_type,
                "detection_delay_samples": enh_res.detection_delay_samples,
                "reasons": enh_res.reasons[:2]
            })

        # Calculate comparative metrics
        def calc_metrics(tp, fp, tn, fn, delays):
            total = tp + fp + tn + fn
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
            avg_delay = (sum(delays) / len(delays)) if delays else 0.0
            return {
                "tp": tp, "fp": fp, "tn": tn, "fn": fn,
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "f1_score": round(f1, 4),
                "false_positive_rate": round(fpr, 4),
                "avg_detection_delay_samples": round(avg_delay, 1)
            }

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "baseline_detector": {
                "name": "Point-in-Time Heuristic Snapshot Detector",
                "metrics": calc_metrics(baseline_tp, baseline_fp, baseline_tn, baseline_fn, baseline_delays),
                "test_outcomes": baseline_results
            },
            "enhanced_detector": {
                "name": "Sliding Time-Window Pattern & Duty-Cycle Detector",
                "metrics": calc_metrics(enhanced_tp, enhanced_fp, enhanced_tn, enhanced_fn, enhanced_delays),
                "test_outcomes": enhanced_results
            },
            "failure_case_analysis": {
                "scenario": "Sub-Threshold Stealth Mining with DNS-over-HTTPS (DoH)",
                "explanation": "When an adversary deliberately restricts CPU usage below 15% and masks pool traffic via standard HTTPS / encrypted DNS, neither instantaneous CPU thresholds nor sliding window variance can distinguish it from normal OS daemons. Remediation requires kernel-level eBPF syscall tracing, hardware performance counters (PMU cache misses), or host memory entropy analysis."
            }
        }
