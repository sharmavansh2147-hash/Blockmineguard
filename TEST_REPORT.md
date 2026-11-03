# BlockMineGuard — Formal Test Execution & Evaluation Report

**Academic Capstone & Cybersecurity Research Project**  
**Date of Execution:** October 25, 2026  
**Environment:** macOS (Darwin 24.3.0) • Python 3.15.0 • Node.js v20+ • Solidity 0.8.24  
**Author:** Vansh Sharma  

---

## 1. Executive Test Summary

BlockMineGuard enforces rigorous quality assurance across three distinct operational layers:
1. **Python Flask Backend & Detection Engine**: Unit, integration, cryptographic hashing, and outage resiliency tests.
2. **Solidity Smart Contract (`ThreatRegistry.sol`)**: Hardhat EVM unit tests verifying state transitions, events, reputation penalties, and access control.
3. **React 18 Frontend & Ethers.js**: Production compilation, type validation, theme persistence, and API contract conformance.

### Global Test Outcome Matrix

| Test Suite | Framework / Tool | Test Files | Total Tests | Passed | Failed | Execution Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Backend Suite** | `pytest` 7.4.0 (`pytest-cov`) | 9 files | 66 | 66 | 0 | 0.83s |
| **Smart Contract Suite**| Hardhat Toolbox / Mocha | 1 file | 24 | 24 | 0 | 0.25s |
| **Frontend Production** | Webpack 5 / React Scripts | 1 app | Build Pass | Pass | 0 | 5.3s |
| **Total Automated** | — | **10 suites** | **90 / 90** | **90** | **0** | **< 7s total** |

---

## 2. Python Backend Test Execution (`pytest`)

**Command:**
```bash
cd backend && .venv/bin/pytest -v
```

### 2.1 Test Module Breakdown

#### A. Multi-Factor Detection Engine (`test_detector.py`) — 20 Tests Passed
- `test_normal_workload_classification`: Verifies `normal_workload.json` produces `LOW` severity and risk score $< 35$.
- `test_cryptojacking_workload_classification`: Verifies `cryptojacking_workload.json` produces `CRITICAL` severity and risk score $\ge 80$.
- `test_cpu_intensity_thresholds`: Validates 50%, 70%, and 90% CPU boundaries.
- `test_miner_process_signatures`: Tests detection of `xmrig`, `cpuminer`, `ethminer`, `kinsing`.
- `test_mining_pool_detection`: Tests network destination regex against stratum pools and standard ports (`3333`, `4444`, `5555`).
- `test_input_validation_missing_fields`: Gracefully handles missing CPU or process name without 500 error.
- `test_input_validation_invalid_types`: Rejects strings where numeric telemetry expected.
- `test_deterministic_scoring`: Confirms identical telemetry yields identical numeric risk scores.

#### B. Time-Series Evasion Detector (`test_time_series_detector.py`) — 10 Tests Passed
- `test_duty_cycle_throttling_detection`: Validates sliding-window detection against square-wave duty cycle mining (e.g. 90% for 3s, 15% for 5s).
- `test_benign_workload_dampening`: Verifies compiler spikes (`clang`, `gcc`, `make`) are not misclassified as cryptojackers.
- `test_variance_and_slope_regression`: Validates statistical metric calculation across 10-sample windows.

#### C. Cryptographic Evidence Integrity (`test_evidence_integrity.py`) — 4 Tests Passed
- `test_canonical_json_sorting`: Asserts dictionary key order independence in SHA-256 generation.
- `test_float_normalization`: Verifies `98.0` and `98.000` yield identical hashes.
- `test_tamper_detection_mismatch`: Asserts modifying 1 byte of telemetry produces a completely divergent SHA-256 hash.
- `test_bytes32_formatting`: Confirms output matches Solidity `bytes32` requirements.

#### D. Threat Intelligence & Sybil Trust (`test_threat_intel_trust.py`) — 4 Tests Passed
- `test_indicator_deduplication`: Rejects duplicate IoCs with HTTP 409.
- `test_poisoned_report_detection`: Automatically flags synthetic poisoned submissions (e.g., Google DNS `8.8.8.8`) as `REJECTED`.
- `test_reputation_penalties`: Asserts `-15` penalty on rejected false reports.
- `test_disputed_indicator_consensus`: Flags contradictory indicator classifications as `DISPUTED`.

#### E. Incident Response Engine (`test_response_engine.py`) — 6 Tests Passed
- `test_severity_tiered_mitigation`: Checks `CRITICAL` -> `SIGSTOP`, `HIGH` -> Cgroup CFS 10% Quota, `MEDIUM` -> eBPF Probe, `LOW` -> Audit.
- `test_safe_execution_guardrails`: Asserts that arbitrary host process termination is strictly blocked.
- `test_containment_audit_history`: Confirms simulated mitigation actions are logged to SQLite.

#### F. Container Cgroup Monitor (`test_container_monitor.py`) — 6 Tests Passed
- `test_cgroup_v2_read_only_adapter`: Tests non-root extraction of `memory.current` and `cpu.stat`.
- `test_dual_container_attribution`: Correctly attributes high CPU to test container `bmg-cryptominer-eval-02` while `bmg-web-worker-01` remains healthy.

#### G. API Integration & Outage Resiliency (`test_api_integration.py`, `test_outages_and_reliability.py`) — 9 Tests Passed
- `test_health_endpoint`: HTTP 200 with status `ok` and chain ID.
- `test_stats_endpoint_aggregation`: Confirms database count queries return in $<5$ms for 3,162 records.
- `test_rpc_outage_graceful_degradation`: Asserts backend returns `BLOCKCHAIN_OUTAGE` without crashing when RPC is offline.

#### H. Synthetic Benchmark Evaluation (`test_evaluation.py`) — 7 Tests Passed
- Validates the 100-workload synthetic evaluation pipeline and confusion matrix metrics.

---

## 3. Synthetic Benchmark Evaluation Results

To evaluate the detection engine rigorously without executing live malware, BlockMineGuard implements an isolated evaluation benchmark ([`backend/detector/evaluation.py`](file:///Users/vanshsharma/blockmineguard/backend/detector/evaluation.py)) comprising **100 safely labelled synthetic workloads**:
- **50 Ground-Truth Cryptojacking Workloads**: Direct miners (`xmrig`, `cpuminer`, `ethminer`), container malware (`kinsing`, `kdevtmpfsi`), duty-cycle throttled miners, and custom port miners.
- **50 Ground-Truth Benign Workloads**: Web servers (`nginx`), databases (`postgres`, `redis`), compilers (`gcc`, `rustc`), video encoders (`ffmpeg`), and system daemons.

### 3.1 Benchmark Metrics Table

| Metric | Measured Value | Formula | Interpretation |
| :--- | :--- | :--- | :--- |
| **Accuracy** | **84.0%** | $\frac{TP + TN}{TP + TN + FP + FN}$ | Overall classification correctness across the 100-sample test set |
| **Recall / Sensitivity** | **100.0%** | $\frac{TP}{TP + FN}$ | Zero cryptojacking workloads evaded detection ($FN = 0$) |
| **Precision** | **75.76%** | $\frac{TP}{TP + FP}$ | Proportion of flagged alerts that were genuine miners |
| **F1 Score** | **86.21%** | $2 \cdot \frac{\text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}}$ | Harmonic mean of precision and recall |
| **False Positive Rate (FPR)** | **32.0%** | $\frac{FP}{FP + TN}$ | Intensive compile/transcode workloads triggering high CPU threshold |
| **Specificity** | **68.0%** | $\frac{TN}{TN + FP}$ | True negative rate on intensive benign workloads |

### 3.2 Confusion Matrix (2x2)

```
                       PREDICTED BENIGN (0)    PREDICTED THREAT (1)
ACTUAL BENIGN (0)              34 (TN)                 16 (FP)
ACTUAL THREAT (1)               0 (FN)                 50 (TP)
```

> [!NOTE]
> **Academic Transparency Disclaimer**: These evaluation metrics reflect performance against an isolated 100-sample synthetic test fixture. In real enterprise production networks, benign high-compute tasks (such as distributed data pipelines and AI model inference) require longer sliding-window baseline profiling to reduce the 32% false-positive rate.

---

## 4. Smart Contract Hardhat Test Execution

**Command:**
```bash
cd blockchain && npx hardhat test
```

**Results:**
```
  ThreatRegistry
    Deployment
      ✔ Should set the right owner (212ms)
      ✔ Should register owner as reporter
    Reporter Registration
      ✔ Should allow new reporter to register
      ✔ Should not allow double registration
    Incident Reporting
      ✔ Should report an incident
      ✔ Should not allow duplicate evidence hash
      ✔ Should reject empty external ID
      ✔ Should auto-register reporter on first report
    Incident Verification
      ✔ Should verify incident as VERIFIED
      ✔ Should verify incident as TAMPERED
      ✔ Should update reputation on verification
      ✔ Should decrease reputation on tampered verification
      ✔ Should not allow double verification
    Incident Resolution
      ✔ Should resolve verified incident
      ✔ Should not resolve unverified incident
    Threat Intelligence
      ✔ Should add threat intelligence
      ✔ Should verify threat intelligence
      ✔ Should increase reputation on threat intel verification
    Query Functions
      ✔ Should return incident count
      ✔ Should get incident by hash
      ✔ Should get incidents by reporter
      ✔ Should get verified threat intelligence
      ✔ Should get recent incidents
    Severity Enum
      ✔ Should handle all severity levels

  24 passing (255ms)
```

---

## 5. Frontend Production Build & Code Quality

**Command:**
```bash
npm --prefix frontend run build
```

**Output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:
  297.64 kB  build/static/js/main.d00b01ef.js
  3.78 kB    build/static/css/main.57491924.css
```
- **0 errors, 0 warnings**.
- CSS bundle size reduced from bloated 21 kB to 3.78 kB via centralized tokens.
- All 10 routes verified with Fast Refresh on `http://localhost:3000`.

---

## 6. Known Limitations & Research Boundaries

1. **Synthetic Telemetry vs. In-Kernel eBPF**: The current implementation ingests user-space telemetry from JSON and `psutil`. In a commercial SOC, telemetry would be captured via eBPF probes in the Linux kernel to prevent ring-0 evasion.
2. **Sepolia Gas & Finality**: Public Sepolia testnet transactions require 12–15 seconds for block confirmation. During a 5-minute academic presentation, Localhost Hardhat (`8545`) provides instantaneous sub-second confirmation while Sepolia demonstrates public testnet interoperability.
3. **Sybil Resistance**: Reputation penalties (-15) disincentivize bad actors, but formal Sybil resistance on a public permissionless network would require staking (Proof-of-Stake) or identity attestation (e.g. Gitcoin Passport / Soulbound tokens).
