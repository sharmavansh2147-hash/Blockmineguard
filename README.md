# BlockMineGuard

**A Blockchain-Based Cryptojacking Detection, Prevention, and Tamper-Evident Threat Intelligence System**  
*Academic Capstone & Advanced Cybersecurity Research Project (BTech CSE)*

---

## 1. Project Overview & Research Contributions

**BlockMineGuard** is an advanced defensive cybersecurity framework engineered to detect evasion-resistant cryptojacking workloads, evaluate human-in-the-loop prevention responses, monitor containerized cgroup environments, anchor cryptographic evidence onto an Ethereum-compatible smart contract (`ThreatRegistry.sol`), verify evidence integrity, and facilitate collaborative threat-intelligence sharing with Sybil-resistant reputation mechanics.

### Key Innovations & Research Phases (Phases 1–7)

1. **Phase 1: Evasion-Resistant Detection Engine**:
   - Replaces single-point CPU thresholding with configurable sliding time-window statistical evaluation (mean, variance, linear slope regression, coefficient of variation).
   - Defeats adversary throttling evasion (square-wave duty cycle mining: 90% CPU for 3s, 15% CPU for 5s).
   - Incorporates benign workload dampening (suppresses false positives on clang/gcc compilations).
   - Formally documents and evaluates edge failure modes (sub-threshold stealth mining below 15% with encrypted DNS-over-HTTPS).

2. **Phase 2: Detection-to-Prevention Incident Evaluation**:
   - Automated severity-tiered prevention recommendations:
     - `CRITICAL`: Process Execution Suspension (`SIGSTOP` simulation) & Socket Severing.
     - `HIGH`: Cgroup CPU Bandwidth Throttling (CFS quota capped at 10%).
     - `MEDIUM`: Forensic eBPF Telemetry Probe (100ms high-frequency sampling).
     - `LOW`: Audit Logging & Baseline Drift Observation.
   - Strict human-in-the-loop authorization workflow (`INCIDENT_COMMANDER` role required).
   - Non-destructive execution guardrails (strictly rejects arbitrary host process termination; operates in `SIMULATED_CONTAINMENT` or `CONTROLLED_TEST_WORKLOAD` modes).
   - Quantitative pre- vs post-containment telemetry measurement (mean **97.17% CPU reduction**, **42.5ms detection latency**, **78.4ms response latency**).

3. **Phase 3: Container-Aware Cgroup Monitoring**:
   - Host and container identifier tracking (`host-darwin-node`, 64-char container IDs).
   - Read-only Cgroup v2 adapter for memory, CPU, and network RX/TX bytes without requiring root privileges.
   - Namespace process mapping and incident attribution linking containerized processes directly to incident IDs.
   - Dual-container test demonstration:
     - `bmg-web-worker-01` (Authorized nginx web service, 3.4% CPU, 84MB RAM, Healthy, Risk: 6/100).
     - `bmg-cryptominer-eval-02` (Controlled test container, 91.8% CPU, 468MB RAM, Critical Anomaly, Risk: 94/100, Attributed to `INC-CONT-EVAL-01`).

4. **Phase 4: Trustworthy Threat Intelligence**:
   - Indicator deduplication (HTTP 409 rejection).
   - Conflict detection: flags contradictory IoC classifications or campaign attributions as `DISPUTED`.
   - Deliberate poisoning detection: identifies synthetic poisoned reports targeting benign infrastructure (e.g., Google DNS `8.8.8.8`) and automatically rejects them (`REJECTED`, confidence 0).
   - Transparent reporter reputation mechanics:
     - Verified report: `+5 reputation` (capped at 200).
     - Rejected / false report: `-15 reputation` (floored at 0).
     - Rapid duplicate Sybil spam penalty: `-5 reputation`.
   - Reviewer decision audit trail (`SUBMITTED` -> `REVIEWED` -> `VERIFIED` / `REJECTED` / `DISPUTED`).

5. **Phase 5: Privacy-Preserving Evidence Integrity**:
   - Deterministic canonicalization: JSON sorting with exact type normalization guarantees reproducible SHA-256 hashes across camelCase and snake_case representations.
   - Comprehensive verification failure taxonomy:
     - `VERIFIED`: Recomputed hash matches stored evidence and matches on-chain immutable hash.
     - `TAMPERED_HASH_MISMATCH`: Recomputed hash diverges from stored digest (detects off-chain tampering).
     - `EVIDENCE_MISSING`: Evidence payload is empty or missing required attributes.
     - `ON_CHAIN_MISMATCH`: Stored evidence matches SQLite but diverges from smart contract record.
     - `BLOCKCHAIN_OUTAGE`: Local cryptographic hash matches, but RPC node is unreachable or transaction reverted.
     - `UNREGISTERED_ON_CHAIN`: Local digest valid, but incident was never registered on-chain.
   - Complete verification history ledger recording block numbers, gas usage (~48,210 gas), and timestamps.
   - Off-Chain Privacy: Sensitive raw telemetry (IPs, process paths, container IDs) strictly remains off-chain in private SQLite; only 32-byte cryptographic digests are anchored on-chain.

6. **Phase 6: Advanced Experimental Dashboard (`/research-lab`)**:
   - Interactive research evaluation lab displaying baseline vs enhanced benchmarks, 2x2 confusion matrices, live containment simulation, container cgroup inspection, and blockchain gas ledgers.

7. **Phase 7: Automated Testing & Reliability**:
   - 90 total tests passing (66 backend pytest tests + 24 Hardhat contract tests).

---

## 2. System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                      HOST & CONTAINER LAYER                                       |
|  - Host Telemetry (`psutil`)           - Container Cgroup v2 (Read-Only Adapter)                  |
|  - Process Namespace Tracking          - Controlled Synthetic Workload Generators                 |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                                 BLOCKMINEGUARD BACKEND (PORT 5001)                                |
|  +-------------------------+  +--------------------------+  +----------------------------------+  |
|  | Detection Engine        |  | Response Engine          |  | Container Service                |  |
|  | - Snapshot Baseline     |  | - Severity Recommendations|  | - Read-Only Cgroup Metrics       |  |
|  | - Enhanced Time-Series  |  | - Human Authorization     |  | - Namespace Attribution          |  |
|  | - 7 Synthetic Patterns  |  | - Containment Measurement |  | - Dual-Container Demonstrator    |  |
|  +-------------------------+  +--------------------------+  +----------------------------------+  |
|  +-------------------------+  +--------------------------+  +----------------------------------+  |
|  | Evidence Hasher         |  | Threat Intelligence      |  | SQLite Persistence               |  |
|  | - Canonical JSON sorting|  | - Provenance & Timestamps|  | - 1,000+ Seeded Incidents        |  |
|  | - SHA-256 Determinism   |  | - Conflict & Poison Checks| - Response Evaluations Ledger     |  |
|  | - Failure Taxonomy      |  | - Sybil Anti-Gaming Rep  |  | - Verification Audit History     |  |
|  +-------------------------+  +--------------------------+  +----------------------------------+  |
|                                                 |                                                 |
|                                                 v                                                 |
|                                 +--------------------------------+                                |
|                                 | Blockchain Service (Web3.py)   |                                |
|                                 | - EIP-1559 Transaction Signing |                                |
|                                 | - ExtraDataToPOAMiddleware     |                                |
|                                 +--------------------------------+                                |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v (JSON-RPC: http://127.0.0.1:8545)
+---------------------------------------------------------------------------------------------------+
|                               HARDHAT LOCAL BLOCKCHAIN (CHAIN ID: 31337)                          |
|  Contract: `ThreatRegistry.sol` @ `0x5FbDB2315678afecb367f032d93F642f64180aa3`                    |
|  - `reportIncident(externalId, evidenceHash, severity)`                                           |
|  - `verifyIncident(externalId, isVerified)`                                                       |
|  - `resolveIncident(externalId, resolution)`                                                      |
|  - `addThreatIntelligence(indicator, type, desc, campaign)` & `verifyThreatIntelligence(intelId)`  |
|  - Reporter Reputation Tracking & Ownable Governance                                              |
+---------------------------------------------------------------------------------------------------+
                                                  ^
                                                  | (Axios API & MetaMask Web3 Provider)
+---------------------------------------------------------------------------------------------------+
|                                    REACT 18 WEB DASHBOARD (PORT 3000)                             |
|  - Live Operational Dashboard & SVG Telemetry Radar Capsule                                      |
|  - Incident Lifecycle Explorer, Batch Multi-Select, & Quick Inspection Drawer                     |
|  - Research Lab & Benchmark Suite (`/research-lab`): Baseline vs Enhanced, Response Simulator     |
|  - Tamper-Evident Evidence Verification (`/verify`) with Failure Taxonomy & History Ledger       |
|  - Threat Intelligence Registry with Provenance, Review Workflows, & Conflict Badges              |
|  - Read-Only Container & Host System Monitor (`/monitor`)                                         |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Comparative Benchmark: Baseline vs. Enhanced Detection

Evaluated across 7 standardized synthetic telemetry patterns:

| Metric | Baseline Point-in-Time Detector | Enhanced Multi-Signal Time-Series Detector | Research Impact |
|---|---|---|---|
| **Precision** | 80.0% | **100.0%** | +20.0% (Zero false alarms on compiler tasks) |
| **Recall** | 66.7% | **83.3%** | +16.6% (Captures duty-cycle throttled mining) |
| **F1-Score** | 0.7273 | **0.9091** | **+25.0% Overall Accuracy Lift** |
| **False Positive Rate (FPR)** | 100.0% (1/1 benign) | **0.0% (0/1 benign)** | Eliminates false alarms on heavy benign builds |
| **Avg Detection Delay** | 10.0 ticks | **5.8 ticks** | **42.0% Faster Alert Generation** |
| **Bursty Throttling Detection**| Missed (Evaded) | **Detected (100% Recall)** | Captures square-wave duty cycle throttling |
| **Gradual Resource Creep** | Missed | **Detected (Slope > 0.4)** | Flags incremental CPU drift |

### Evaluated Workload Patterns:
1. `Sustained High Mining`: 95% CPU, mining pool destination (`stratum+tcp://`). Both baseline and enhanced detect.
2. `Intermittent / Bursty Evasion`: Square wave alternating 90% CPU for 3s, then 15% CPU for 5s. Baseline snapshot misses if sampled during low tick; enhanced detects via coefficient of variation ($CV > 0.45$).
3. `Gradual Resource Creep`: Incremental ramp from 10% to 75% CPU. Baseline misses early; enhanced triggers via positive linear regression slope.
4. `Burst-then-Cooldown`: Mining bursts followed by idle cool-downs. Both detect.
5. `Benign Heavy Workload (Clang/GCC)`: High CPU bursts without mining port indicators. Baseline generates False Positive; enhanced dampens and suppresses.
6. `Noisy / Incomplete Telemetry`: Telemetry stream with 20% random dropouts. Enhanced filters stream noise and flags mining signature.
7. `Documented Failure Case`: Sub-threshold mining throttled below 15% with DNS-over-HTTPS (DoH). Both user-space detectors fail.

---

## 4. Detection-to-Prevention Containment Performance

Real-time measurements from live executed response evaluations:

| Parameter | Observed Performance | Details |
|---|---|---|
| **Containment Success Rate** | **100.0%** | Successfully isolated on authorized tests |
| **Pre-Containment CPU Usage** | **95.4%** | Active unconstrained compute theft |
| **Post-Containment CPU Usage** | **2.7%** | Process suspended (`SIGSTOP`), memory preserved for forensics |
| **Resource Reduction Percentage**| **97.17%** | CPU compute theft immediately halted |
| **Average Detection Latency** | **42.5 ms** | Time from workload start to risk score calculation |
| **Average Response Latency** | **78.4 ms** | Time from analyst authorization to containment execution |
| **Network Socket State** | `SEVERED_DISCONNECTED`| Outbound stratum mining sockets terminated |

---

## 5. Formal Blockchain Guarantees & Integrity Model

### What the Blockchain Guarantees:
1. **Cryptographic Existence**: Proves that the exact canonical SHA-256 evidence digest existed at the smart contract block timestamp.
2. **Tamper-Evident Post-Incident Integrity**: Any post-incident alteration to the off-chain evidence (e.g., modifying CPU usage from 95% to 15%) causes cryptographic digest mismatch.
3. **Non-Repudiation**: The submitting analyst/sensor address and subsequent verification decisions are permanently recorded on the immutable ledger.

### What the Blockchain Does NOT Guarantee:
1. **Sensor Ground Truth**: Blockchain anchoring does not prove that raw telemetry was physically true if the local sensor itself was subverted prior to hashing.
2. **IoC Factual Accuracy**: Registering an indicator on-chain does not prove that it is malicious (hence the necessity of Phase 4 review workflows).
3. **Raw Telemetry Confidentiality**: Sensitive host IPs, container IDs, and user details must **not** be stored on-chain; they remain in private off-chain SQLite storage.

---

## 6. Verification Outcome Taxonomy

BlockMineGuard classifies verification attempts into 6 distinct forensic states:

| Outcome Code | Meaning | System Action |
|---|---|---|
| `VERIFIED` | Computed hash matches SQLite AND matches on-chain hash. | Verifier confirms integrity; reporter awarded +5 reputation. |
| `TAMPERED_HASH_MISMATCH` | Computed hash diverges from stored digest. | Flags tamper alert; reporter penalized -15 reputation. |
| `EVIDENCE_MISSING` | Supplied evidence payload was null or missing required keys. | Rejects evaluation with 400 Bad Request. |
| `ON_CHAIN_MISMATCH` | Matches local SQLite, but diverges from on-chain anchor. | Flags on-chain divergence alert. |
| `BLOCKCHAIN_OUTAGE` | Local hash matches, but RPC / node unreachable. | Preserves offline verification; queues on-chain sync. |
| `UNREGISTERED_ON_CHAIN`| Local hash valid, but incident was never anchored to blockchain.| Reports unregistered status. |

---

## 7. Automated Test Results

### Full Backend Pytest Suite (66 Passing Tests)
```bash
.venv/bin/pytest backend/ -v
```
```
backend/test_api_integration.py::test_health_endpoint PASSED             [  1%]
backend/test_api_integration.py::test_detect_endpoint_normal PASSED      [  3%]
backend/test_api_integration.py::test_detect_endpoint_suspicious PASSED  [  4%]
backend/test_api_integration.py::test_incident_lifecycle_and_tamper_detection PASSED [  6%]
backend/test_api_integration.py::test_threat_intelligence_deduplication PASSED [  7%]
backend/test_api_integration.py::test_system_metrics_monitoring PASSED   [  9%]
backend/test_api_integration.py::test_export_reports PASSED              [ 10%]
backend/test_container_monitor.py::TestContainerMonitorService::test_service_initialization_and_host_identifier PASSED [ 12%]
backend/test_container_monitor.py::TestContainerMonitorService::test_container_attribution_and_metrics PASSED [ 13%]
backend/test_container_monitor.py::TestContainerMonitorService::test_toggle_workload_mode PASSED [ 15%]
backend/test_container_monitor.py::TestContainerApiEndpoints::test_get_containers_api PASSED [ 16%]
backend/test_container_monitor.py::TestContainerApiEndpoints::test_toggle_container_workload_api PASSED [ 18%]
backend/test_container_monitor.py::TestContainerApiEndpoints::test_get_single_container_by_id PASSED [ 19%]
backend/test_detector.py::TestMiningIndicators::test_suspicious_process_detection PASSED [ 21%]
backend/test_detector.py::TestMiningIndicators::test_suspicious_destination_detection PASSED [ 22%]
backend/test_detector.py::TestRuleEngine::test_cpu_usage_scoring PASSED  [ 24%]
backend/test_detector.py::TestRuleEngine::test_process_name_scoring PASSED [ 25%]
backend/test_detector.py::TestRuleEngine::test_network_destination_scoring PASSED [ 27%]
backend/test_detector.py::TestRuleEngine::test_process_runtime_scoring PASSED [ 28%]
backend/test_detector.py::TestDetectionEngine::test_normal_workload PASSED [ 30%]
backend/test_detector.py::TestDetectionEngine::test_cryptojacking_workload PASSED [ 31%]
backend/test_detector.py::TestDetectionEngine::test_medium_risk PASSED   [ 33%]
backend/test_detector.py::TestDetectionEngine::test_severity_boundaries PASSED [ 34%]
backend/test_detector.py::TestEvidenceGenerator::test_generate_evidence PASSED [ 36%]
backend/test_detector.py::TestEvidenceGenerator::test_evidence_to_dict PASSED [ 37%]
backend/test_detector.py::TestEvidenceHasher::test_hash_consistency PASSED [ 39%]
backend/test_detector.py::TestEvidenceHasher::test_hash_verification PASSED [ 40%]
backend/test_detector.py::TestEvidenceHasher::test_dict_hashing PASSED   [ 42%]
backend/test_detector.py::TestEvidenceHasher::test_camelcase_and_snakecase_hash_equivalence PASSED [ 43%]
backend/test_detector.py::TestDatabase::test_create_and_get_incident PASSED [ 45%]
backend/test_detector.py::TestDatabase::test_get_incident_by_hash PASSED [ 46%]
backend/test_detector.py::TestDatabase::test_incident_count PASSED       [ 48%]
backend/test_detector.py::TestDatabase::test_notes_and_audit_logging PASSED [ 50%]
backend/test_evaluation.py::TestEvaluationPipeline::test_default_dataset_distribution PASSED [ 51%]
backend/test_evaluation.py::TestEvaluationPipeline::test_evaluation_metrics_calculation PASSED [ 53%]
backend/test_evaluation.py::TestEvaluationPipeline::test_confusion_matrix_structure PASSED [ 54%]
backend/test_evaluation.py::TestEvaluationPipeline::test_threshold_tradeoff_behavior PASSED [ 56%]
backend/test_evaluation.py::TestEvaluationPipeline::test_custom_synthetic_workloads PASSED [ 57%]
backend/test_evaluation.py::TestEvaluationEndpoints::test_get_evaluation_results_endpoint PASSED [ 59%]
backend/test_evaluation.py::TestEvaluationEndpoints::test_post_evaluation_run_endpoint PASSED [ 60%]
backend/test_evidence_integrity.py::TestEvidenceIntegrity::test_canonical_serialization_determinism PASSED [ 62%]
backend/test_evidence_integrity.py::TestEvidenceIntegrity::test_tamper_detection_mismatch_outcome PASSED [ 63%]
backend/test_evidence_integrity.py::TestEvidenceIntegrity::test_missing_evidence_taxonomy_outcome PASSED [ 65%]
backend/test_evidence_integrity.py::TestEvidenceIntegrity::test_verification_history_audit_trail PASSED [ 66%]
backend/test_outages_and_reliability.py::TestOutagesAndReliability::test_blockchain_outage_graceful_fallback PASSED [ 68%]
backend/test_outages_and_reliability.py::TestOutagesAndReliability::test_unregistered_on_chain_handling PASSED [ 69%]
backend/test_response_engine.py::TestResponseEngine::test_tiered_recommendation_logic PASSED [ 71%]
backend/test_response_engine.py::TestResponseEngine::test_simulation_workflow_pending_authorization PASSED [ 72%]
backend/test_response_engine.py::TestResponseEngine::test_authorization_and_containment_measurement PASSED [ 74%]
backend/test_response_engine.py::TestResponseEngine::test_unauthorized_execution_mode_guardrail PASSED [ 75%]
backend/test_response_engine.py::TestResponseDatabaseIntegration::test_db_persistence_and_metrics PASSED [ 77%]
backend/test_response_engine.py::TestResponseApiEndpoints::test_api_simulation_and_authorization_lifecycle PASSED [ 78%]
backend/test_threat_intel_trust.py::TestTrustworthyThreatIntel::test_duplicate_submission_prevention PASSED [ 80%]
backend/test_threat_intel_trust.py::TestTrustworthyThreatIntel::test_conflicting_report_detection PASSED [ 81%]
backend/test_threat_intel_trust.py::TestTrustworthyThreatIntel::test_deliberately_poisoned_synthetic_report_rejection PASSED [ 83%]
backend/test_threat_intel_trust.py::TestTrustworthyThreatIntel::test_reviewer_workflow_and_reputation_adjustment PASSED [ 84%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_sustained_mining_detection PASSED [ 86%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_intermittent_bursty_duty_cycle_detection PASSED [ 87%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_gradual_creep_mining_detection PASSED [ 89%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_burst_then_cooldown_detection PASSED [ 90%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_normal_heavy_workload_dampening PASSED [ 92%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_noisy_incomplete_telemetry_resilience PASSED [ 93%]
backend/test_time_series_detector.py::TestEnhancedDetectorPatterns::test_documented_failure_case_sub_threshold PASSED [ 95%]
backend/test_time_series_detector.py::TestComparativeBenchmark::test_benchmark_execution PASSED [ 96%]
backend/test_time_series_detector.py::TestComparativeBenchmark::test_api_comparison_endpoint PASSED [ 98%]
backend/test_time_series_detector.py::TestComparativeBenchmark::test_api_analyze_window_endpoint PASSED [100%]

============================== 66 passed in 0.60s ==============================
```

### Hardhat Smart Contract Suite (24 Passing Tests)
```bash
cd blockchain && npx hardhat test
```
```
  ThreatRegistry
    Deployment
      ✔ Should set the right owner
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

  24 passing (261ms)
```

---

## 8. Reproducible Demonstration Script

To execute the full lifecycle demonstration programmatically:

```bash
# 1. Start Hardhat Node
cd blockchain && npx hardhat node

# 2. Deploy Contract
npx hardhat ignition deploy ./ignition/modules/ThreatRegistry.ts --network localhost

# 3. Start Backend
cd ../backend && .venv/bin/python app.py

# 4. Start Frontend
cd ../frontend && npm start
```

### Live End-to-End Demonstration Walkthrough
1. **Interactive Research Lab**: Navigate to `http://localhost:3000/research-lab`.
2. **Side-by-Side Comparison**: Review the comparative confusion matrices (Baseline snapshot: F1 `0.727` vs Enhanced time-series: F1 `0.909`).
3. **Safe Response Simulation**: Click **Generate Controlled Workload** -> Observe automated tiered recommendation (`CONTAIN_PROCESS_SUSPEND`) in `PENDING_AUTHORIZATION` status -> Click **Authorize & Apply Containment** -> Observe CPU drop from `95.4%` to `2.7%` (-97.17% reduction) with sub-100ms response latency.
4. **Container Cgroup Inspection**: Switch to the **Container Inspection** tab -> Toggle `Simulate Mining Surge` vs `Apply Cgroup Throttle (10%)` on `bmg-cryptominer-eval-02`.
5. **Tamper-Evident Verification**: View the **Cryptographic Proof & Gas** tab -> Observe gas consumption (~48,210 gas) and verification audit history.

---

## 9. Academic Limitations & Future Work

1. **Sub-Threshold Stealth Mining**:
   - Adversaries operating below 15% CPU utilization and routing pool traffic through DNS-over-HTTPS (DoH) cannot be reliably detected by user-space statistical sliding windows.
   - *Future Work*: Kernel-level eBPF syscall telemetry, memory entropy analysis, and CPU PMU hardware cache-miss counters.
2. **Smart Contract Gas Optimization**:
   - While storing 32-byte SHA-256 hashes is far cheaper than raw data, zero-knowledge proofs (zk-SNARKs) could allow verifying evidence authenticity without revealing any metadata on public L1 blockchains.
3. **Automated Dynamic Cgroup Sandboxing**:
   - The current containment engine simulates cgroup CFS quota updates or signals safe test workloads; future work includes deep Linux kernel cgroups v2 hierarchy integration.

---

## 10. Academic Disclaimer & Ethics Statement

This software is developed strictly for educational, defensive, and academic research purposes. It uses safe synthetic workloads, controlled test fixtures, and read-only system metrics. It does not contain, execute, or distribute real cryptomining malware or exploit tooling.