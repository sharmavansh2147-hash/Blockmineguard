# BlockMineGuard — Final Review & Sepolia Integration Guide

**Academic Capstone & Cybersecurity Research Project**  
*Title: Blockchain-Based Tamper-Evident Cryptojacking Detection and Threat Intelligence Sharing Framework*

---

## 1. Project Problem Statement & Objectives

Cryptojacking is the unauthorized hijacking of computing infrastructure (cloud instances, Kubernetes containers, enterprise workstations) to mine cryptocurrencies (predominantly Monero via RandomX / Cryptonight). Traditional host and network monitoring systems face critical challenges:
1. **Evaded Detection**: Adversaries use throttling, duty cycles, and process masquerading (`xmrig` renamed to benign system daemons) to fly under naive static CPU alerts.
2. **Post-Incident Evidence Tampering**: Malicious actors or compromised system administrators can alter or delete local syslog / forensic records to conceal unauthorized mining.
3. **Siloed Threat Intelligence**: Organizations lack a trusted, decentralized, tamper-evident mechanism to share indicators of compromise (IoCs) with verifiable provenance and reputation protection.

### Core Objectives
- **Detection**: Run multi-factor off-chain detection using resource utilization (CPU, memory, runtime) and known signature/pool indicators without modifying host OS processes.
- **Tamper-Evident Integrity**: Generate canonical deterministic SHA-256 evidence digests and anchor them on an Ethereum-compatible smart contract (`ThreatRegistry.sol`).
- **Cryptographic Verification**: Provide mathematical proof of evidence non-repudiation and detect when stored or supplied evidence has been tampered with (`TAMPERED_HASH_MISMATCH`).
- **Decentralized Threat Sharing**: Facilitate community IoC submissions with peer-review consensus and Sybil-resistant reporter reputation scoring.
- **Dual-Network Architecture**: Seamlessly support both Local Hardhat development (Chain ID `31337`) and public Ethereum Sepolia Testnet (Chain ID `11155111`).

---

## 2. Architecture & Data Flow

```
                      +------------------------------------------+
                      |         Workload Telemetry Ingest        |
                      |  - sample_data/normal_workload.json      |
                      |  - sample_data/cryptojacking_workload.json|
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |     Flask Backend (Port 5001 /detect)    |
                      |  - Multi-factor Heuristic Risk Engine    |
                      |  - Risk Score (0-100) & Severity Rating  |
                      |  - Plain-English Contributing Factors    |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |    Canonical Evidence Hasher (SQLite)    |
                      |  - Deterministic JSON Field Sorting      |
                      |  - Canonical SHA-256 Evidence Digest     |
                      |  - Non-Destructive Simulated Mitigation  |
                      +------------------------------------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
                     v                                           v
    +---------------------------------+         +---------------------------------+
    |   MetaMask Frontend Signer      |         |   Backend Automated Relayer     |
    |   (Ethers.js v6 Injected)       |         |   (Web3.py Local Hardhat Node)  |
    +---------------------------------+         +---------------------------------+
                     |                                           |
                     v                                           v
    +-----------------------------------------------------------------------------+
    |                    Ethereum Smart Contract (ThreatRegistry.sol)             |
    |  - Chain 31337: Localhost (0x5FbDB2315678afecb367f032d93F642f64180aa3)     |
    |  - Chain 11155111: Sepolia Testnet (Deploys via npm run deploy:sepolia)     |
    +-----------------------------------------------------------------------------+
                     |
                     v
    +-----------------------------------------------------------------------------+
    |                      Tamper-Evident Verification Layer                      |
    |  - Hash Recalculation: SHA256(canonical(evidence))                          |
    |  - Contract Accessibility Check: isContractAccessible(provider, address)   |
    |  - Smart Contract Query: getIncident(incidentId)                            |
    |  - Non-Repudiation Assertion:                                               |
    |      * Hash == On-Chain Hash && Record Exists --> VERIFIED (GREEN)          |
    |      * Hash != On-Chain Hash                  --> TAMPERED (RED)            |
    |      * Local Hash Valid && No On-Chain Record --> UNREGISTERED (AMBER)      |
    +-----------------------------------------------------------------------------+
```

---

## 3. Technology Stack & Prerequisites

| Layer | Technology | Version | Location / Port |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 18, React Router v6, Ethers.js | `18.2.0`, `6.11.1` | `http://localhost:3000` |
| **Backend** | Python Flask, Web3.py, SQLite | Python `3.10+`, Web3 `6.x` | `http://localhost:5001` |
| **Smart Contract** | Solidity (`ThreatRegistry.sol`) | `0.8.24` | `blockchain/contracts/` |
| **Local Blockchain**| Hardhat Local Node | `2.22.x` | `http://127.0.0.1:8545` (Chain ID `31337`) |
| **Testnet** | Ethereum Sepolia | EIP-1559 | Chain ID `11155111` |
| **Database** | SQLite `blockmineguard.db` | v3 | `backend/blockmineguard.db` |

### Prerequisites
- Node.js `v18+` or `v20+` and `npm`.
- Python `3.10+` with a virtual environment (`.venv`).
- MetaMask browser extension installed in Chrome, Brave, or Edge.

---

## 4. Environment Setup

### Root `.env` Configuration
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```

Verify your `.env` contains the required keys:
```ini
# Blockchain Configuration
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Sepolia Testnet Configuration
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
SEPOLIA_CHAIN_ID=11155111
DEPLOYER_PRIVATE_KEY=your_funded_sepolia_private_key_here
SEPOLIA_CONTRACT_ADDRESS=

# Backend Configuration
DB_PATH=blockmineguard.db
PORT=5001
FLASK_ENV=development

# Frontend Configuration
REACT_APP_API_URL=http://localhost:5001
```

> [!WARNING]
> Never commit real private keys or `.env` files to git. `.gitignore` strictly ignores all `.env` files while preserving `.env.example`.

---

## 5. Starting the Complete Application

Run each component in separate terminal windows, or use the root `package.json` scripts:

### Step 1: Start Local Hardhat Blockchain
```bash
npm run blockchain
# Or: cd blockchain && npx hardhat node
```
*Listens on `http://127.0.0.1:8545` (Chain ID: 31337). 20 pre-funded test accounts generated.*

### Step 2: Deploy Contract to Localhost
```bash
npm run deploy:local
# Or: cd blockchain && npx hardhat run scripts/deploy.ts --network localhost
```
*Compiles Solidity 0.8.24, deploys `ThreatRegistry.sol`, outputs deployed address, and automatically updates `frontend/src/contracts/deployed_addresses.json`.*

### Step 3: Start Flask Backend
```bash
npm run backend
# Or: cd backend && source ../.venv/bin/activate && python app.py
```
*Backend initializes SQLite database tables and listens on `http://localhost:5001`.*

### Step 4: Start React Frontend
```bash
npm run dev
# Or: cd frontend && npm start
```
*Opens the Dark Slate SOC Security Dashboard at `http://localhost:3000`.*

---

## 6. Ethereum Sepolia Deployment

### Obtaining Sepolia Testnet ETH
To deploy on Sepolia, your deployer address must have at least `0.005 Sepolia ETH` for gas:
1. Copy your MetaMask Sepolia wallet address.
2. Request free test ETH from any of the following faucets:
   - **Google Cloud Web3 Faucet**: [https://cloud.google.com/application/web3/faucet/ethereum/sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) (instant 0.05 ETH)
   - **Alchemy Sepolia Faucet**: [https://sepoliafaucet.com](https://sepoliafaucet.com)
   - **PoW Sepolia Faucet**: [https://sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de)

### Configuring Deployer Key
In `.env`, set your funded testnet private key:
```ini
DEPLOYER_PRIVATE_KEY=0x<your_64_character_hex_private_key>
```

### Executing Sepolia Deployment
Run the Hardhat Sepolia deployment script:
```bash
npm run deploy:sepolia
# Or: cd blockchain && npx hardhat run scripts/deploy.ts --network sepolia
```

**Expected Successful Output:**
```
----------------------------------------------------
🚀 Deploying ThreatRegistry to sepolia (Chain ID: 11155111)
👤 Deployer Address: 0x...
💰 Deployer Balance: 0.05 ETH
⏳ Deploying ThreatRegistry smart contract...
✅ ThreatRegistry deployed successfully!
📍 Contract Address: 0x<Real_Sepolia_Contract_Address>
📜 Transaction Hash: 0x<Real_Sepolia_Deployment_Tx>
🧱 Block Number: 11985280
🔍 Etherscan Link: https://sepolia.etherscan.io/address/0x<Real_Sepolia_Contract_Address>
💾 Saved deployment manifest to: blockchain/deployments/sepolia.json
💾 Synced to frontend: frontend/src/contracts/deployed_addresses.json
----------------------------------------------------
```

---

## 7. Demonstration Workflows

### Demonstration A: Real Off-Chain Workload Detection
1. Navigate to `http://localhost:3000`.
2. In the **Live Workload Detection & Blockchain Attestation Lab**:
   - Click **`1. Normal Workload (Nginx)`**: Loads `sample_data/normal_workload.json` (CPU: 45%, Mem: 55%, Process: `nginx`, Runtime: 300s).
   - Click **`Execute Off-Chain Detection Pipeline`**:
     - Status: `BENIGN WORKLOAD`
     - Score: `10 / 100` (Severity: `LOW`)
     - Recommendation: Routine operational logging; no mitigation required.
   - Click **`2. Cryptojacking Workload (XMRig)`**: Loads `sample_data/cryptojacking_workload.json` (CPU: 94%, Mem: 71%, Process: `xmrig`, Runtime: 7200s, Pool: `minexmr.com`).
   - Click **`Execute Off-Chain Detection Pipeline`**:
     - Status: `CRYPTOJACKING SUSPICION`
     - Score: `100 / 100` (Severity: `CRITICAL`)
     - Factor breakdown: High CPU (+30), Elevated Memory (+10), Miner signature matching `xmrig` (+25), Stratum destination matching `minexmr.com` (+25), Long runtime (+20).
     - Recommendation: Contain workload, compute canonical evidence digest, and anchor on Ethereum registry.

### Demonstration B: Incident Creation & On-Chain Attestation
1. With the Cryptojacking workload evaluated, click **`Generate Evidence Digest`**:
   - Creates incident ID (e.g. `INC-XXXX`) in SQLite.
   - Computes deterministic 64-char SHA-256 evidence hash (e.g., `4c34c7b0d847...`).
2. Click **`Record on Sepolia (MetaMask)`** or **`Record on Blockchain`**:
   - MetaMask pops up asking to approve `ThreatRegistry.reportIncident()`.
   - Once confirmed in a block, the transaction receipt appears with:
     - Real Block Number and Gas Used (~241,383 gas).
     - Working Sepolia Etherscan Link (`https://sepolia.etherscan.io/tx/...`).
     - Real-time persistence to backend SQLite.

### Demonstration C: Non-Destructive Simulated Mitigation
1. Click **`Simulate Isolation (SIGSTOP)`**:
   - Tags the incident as `ISOLATED_SIMULATED`.
   - Records an immutable audit log entry in SQLite:
     *"[SIMULATED CONTAINMENT] Process 'xmrig' tagged for cgroups cpu.max throttle (CFS Quota 10%) & SIGSTOP in isolated staging namespace. Host system processes were NOT terminated (safe academic demonstration)."*

### Demonstration D: Complete Integrity & Tamper Lifecycle (Verification Center at `/verify`)
1. **Step 1 — Unregistered State Evaluation**:
   - Navigate to `/verify` and select an unanchored incident record.
   - The authoritative status accurately displays **`UNREGISTERED ON BLOCKCHAIN`** (honest Amber state `#D29922`).
   - The on-chain hash box displays *"No on-chain commitment found"* rather than fabricating a local hash.
2. **Step 2 — Register on Blockchain**:
   - Click the prominent **`Register on Blockchain`** button inside the Unregistered banner.
   - MetaMask prompts to approve the `reportIncident(externalId, evidenceHash, severity, threatIntelRef)` contract transaction.
   - The application awaits 1 block confirmation, updates the SQLite ledger, and retrieves the actual on-chain record (`contract.getIncident()`).
3. **Step 3 — Successful Integrity Verification (Green State)**:
   - The verification engine automatically re-evaluates the canonical SHA-256 evidence against the newly minted smart contract anchor.
   - The UI transitions to **COMPLETELY GREEN** (`#3FB950` border, green surface gradient, and **`INTEGRITY VERIFIED`** badge).
4. **Step 4 — Simulated Telemetry Tampering (Red State)**:
   - Click **`Simulate Tampering`**.
   - The client modifies CPU telemetry from high load to 14.5% and reduces the risk score to 15.
   - The recomputed local SHA-256 hash immediately deviates from the immutable on-chain anchor.
   - The UI transitions to **COMPLETELY RED** (`#F85149`, red warning banner, and **`TAMPERING DETECTED`** badge).
5. **Step 5 — Diagnostic Mismatch Detection**:
   - The red forensic discrepancy box explicitly highlights:
     * Stored On-Chain Digest vs Altered Local Digest.
     * Diagnostic divergence reasoning and altered parameters.
6. **Step 6 — Restore Canonical Baseline Evidence**:
   - Click **`Reset Clean`** (Restore Authentic Baseline).
   - Reloads original unadulterated forensic telemetry into the workbench editor.
7. **Step 7 — Reverification Return**:
   - Verification re-executes automatically.
   - The recomputed digest realigns with the immutable smart contract anchor.
   - The UI returns to **COMPLETELY GREEN** (`INTEGRITY VERIFIED`).

### Demonstration E: Detection Evaluation Lab (100-Sample Benchmark)
1. Navigate to **Research Lab** (`http://localhost:3000/research-lab`).
2. Select the **`100-Sample Evaluation Suite (Ground Truth)`** sub-view.
3. Review the confusion matrix (50 threats, 50 benign workloads), 6 real-time KPI metric cards (Accuracy, Precision, Recall, Specificity, F1-Score, False Positive Rate), and per-class breakdown.
4. Adjust the **Decision Threshold Slider** (e.g. from 35 down to 20 or up to 60) to observe dynamic sensitivity vs. specificity trade-offs.
5. Filter individual test cases using filter pills (`ALL`, `TP`, `FP`, `TN`, `FN`) or search by process name (`xmrig`, `nginx`, `gcc`, etc.).
6. Or run the reproducible CLI command in your terminal:
   ```bash
   .venv/bin/python backend/detector/evaluation.py
   ```

### Demonstration F: System Readiness Checker
1. Navigate to **Dashboard** (`http://localhost:3000/`).
2. In the top action bar, click **`Run System Check`**.
3. The diagnostic modal performs non-intrusive read-only probes with latency metrics:
   - **Flask Application Core**: Response latency (~0.1ms).
   - **SQLite Threat Database**: Verifies connectivity and stored incident count (3,168+ records, ~0.3ms).
   - **Cryptojacking Detection Engine**: Heuristic execution probe and version check (`v1.2.0`, ~0.05ms).
   - **Ethereum RPC Node**: Query block number and chain ID (`31337` / `11155111`, ~3ms).
   - **ThreatRegistry Smart Contract**: Bytecode presence and on-chain incident count query (~5ms).
   - **Browser Wallet Integration**: Independent client-side check of MetaMask provider, connected address, and active network.
4. Click **`Retry Diagnostic`** to refresh real-time subsystem latencies.

### Demonstration G: Exportable Forensic Evidence Reports
1. Navigate to **Incident Lifecycle Explorer** (`http://localhost:3000/incidents`).
2. Click any incident to open **Incident Details** (`/incidents/:id`).
3. In the top action header, click:
   - **`Export JSON Report`**: Downloads `BMG_Evidence_<id>.json` containing full forensic telemetry, version metadata (`bmg-evidence-v1.0`, `v1.2.0`), canonical SHA-256 digest, blockchain anchor (tx hash, block number, Etherscan link), integrity status, and simulated mitigation state.
   - **`Export CSV Report`**: Downloads `BMG_Incident_<id>.csv` formatted for spreadsheet audit.

---

## 8. Detection Evaluation Lab & Performance Metrics

### Evaluation Methodology
The Detection Evaluation Lab runs the identical heuristic scoring pipeline utilized in live production ingestion against a balanced 100-workload ground-truth dataset (50 synthetic cryptojacking threats and 50 benign server workloads).

### Metric Formulas
All classification metrics are computed directly from the 2x2 confusion matrix:
- **True Positives (TP)**: Cryptojacking workloads correctly flagged as threats ($\text{Risk Score} \ge \text{Threshold}$).
- **False Positives (FP)**: Benign server workloads incorrectly flagged as threats.
- **True Negatives (TN)**: Benign server workloads correctly suppressed ($\text{Risk Score} < \text{Threshold}$).
- **False Negatives (FN)**: Cryptojacking workloads that evaded detection.

$$\text{Accuracy} = \frac{TP + TN}{TP + TN + FP + FN}$$

$$\text{Precision} = \frac{TP}{TP + FP}$$

$$\text{Recall (Sensitivity)} = \frac{TP}{TP + FN}$$

$$\text{Specificity} = \frac{TN}{TN + FP}$$

$$\text{F1-Score} = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}}$$

$$\text{False Positive Rate (FPR)} = \frac{FP}{FP + TN} = 1 - \text{Specificity}$$

### Zero-Division & Edge-Case Protection
If an evaluation contains no positive predictions ($TP + FP = 0$) or an empty dataset, the calculation logic safely falls back to $0.0$ or `"N/A"` rather than raising a runtime exception or fabricating synthetic numbers.

### Reproducibility CLI Command
```bash
# From repository root:
.venv/bin/python backend/detector/evaluation.py

# Or within the backend directory:
cd backend && python -m detector.evaluation
```

### Dataset Limitations & Academic Notice
> [!IMPORTANT]
> **Synthetic Benchmark Notice**: The evaluation dataset is composed of 100 synthetic, labelled workloads designed to systematically assess rule sensitivity across known miner patterns (`xmrig`, `ethminer`, `ccminer`, Stratum protocols, CPU duty-cycling) and heavy benign workloads (`clang`, `gcc`, `nginx`, `redis`, `postgres`). Performance in live enterprise networks will depend on zero-day miner evasion techniques (e.g. sub-threshold CPU throttling with encrypted DNS-over-HTTPS) and baseline environmental variance.

---

## 9. Versioned Incident Evidence & Hash Architecture

### Schema Version: `bmg-evidence-v1.0`
To guarantee long-term auditability and prevent hash drift between software versions, all incident evidence adheres to canonical versioning:
- `schema_version`: `"bmg-evidence-v1.0"`
- `detector_version`: `"v1.2.0"`
- `scoring_config_version`: `"v1.0"`
- `hash_algorithm`: `"SHA-256"`

### Deterministic Serialization
The hash generator (`backend/evidence/hasher.py`) ensures that identical incident data always yields the exact same cryptographic digest across platforms:
1. **Key Sorting**: All JSON keys are ordered alphabetically.
2. **Float Normalization**: Floating-point numbers are rounded to 2 decimal places to avoid IEEE 754 precision mismatches.
3. **Compact Delimiters**: Formatted with zero whitespace (`separators=(',', ':')`).
4. **Digest Calculation**: Hex-encoded SHA-256 hash (`hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()`).

### Off-Chain Privacy & On-Chain Integrity
- **Off-Chain Storage**: Full telemetry payloads (command-line arguments, process names, local IPs, container IDs, internal logs) remain exclusively in the private SQLite database (`blockmineguard.db`).
- **On-Chain Commitment**: Only the 32-byte canonical SHA-256 evidence hash is registered onto `ThreatRegistry.sol`.
- **Integrity Guarantee**: Storing the hash on-chain mathematically proves that the off-chain evidence has not been modified since the timestamp of block inclusion. It does not certify that the host sensor was truthful when capturing the initial telemetry (the Oracle boundary).

---

## 10. Test Suites & Verification

### Running All Automated Tests
From the project root:
```bash
npm test
```
*Runs all 24 Hardhat smart contract tests and all 95 backend pytest tests.*

### Running Test Suites Separately
- **Blockchain Contract Tests (Hardhat)**:
  ```bash
  npm run test:blockchain
  ```
  *Output: 24 passing tests (255ms) covering reporter registration, incident reporting, duplicate hash prevention, tamper status transitions, reputation updates, and threat intel.*
- **Backend API & Detection Tests (Pytest)**:
  ```bash
  npm run test:backend
  # Or: .venv/bin/pytest backend/ -v
  ```
  *Output: 95 passing tests (0.87s) across 11 test modules:*
  - `test_detector.py` (20 tests): Heuristic scoring, threshold boundaries, factor weights.
  - `test_outages_and_reliability.py` (17 tests): Input validation, out-of-range rejection, duplicate submission idempotency, readiness checker, RPC outages, contract reverts.
  - `test_time_series_detector.py` (10 tests): Sliding window, variance, linear slope regression, duty-cycle evasion.
  - `test_evidence_integrity.py` (9 tests): Deterministic canonical hashing, altered field/timestamp divergence, invalid inputs, tamper verification.
  - `test_evaluation.py` (9 tests): 100-workload ground-truth evaluation, confusion matrix, metric calculations, empty dataset handling.
  - `test_api_integration.py` (7 tests): Flask REST endpoints, payload parsing, incident creation.
  - `test_container_monitor.py` (6 tests): Read-only cgroup v2 parsing, namespace mapping.
  - `test_response_engine.py` (6 tests): Mitigation tiers, simulated containment, authorization checks.
  - `test_verification_overhaul.py` (6 tests): Authoritative outcome model, unregistered state honesty, history deduplication, outage handling.
  - `test_threat_intel_trust.py` (4 tests): IoC deduplication, conflict detection, poisoning rejection, Sybil penalties.
  - `test_e2e_blockchain_flow.py` (1 test): Complete end-to-end lifecycle from unanchored -> registered -> verified green -> tampered red -> restored -> reverified green.
- **Frontend Unit Tests (Jest)**:
  ```bash
  npm --prefix frontend test -- --watchAll=false
  ```
  *Output: 9 passing tests (0.92s) verifying safe audit timestamp formatting and authoritative outcome taxonomy (green/red/amber).*
- **Frontend Production Build**:
  ```bash
  npm --prefix frontend run build
  ```
  *Output: Clean production build (315 kB main JS bundle, 0 errors, 0 warnings).*
- **End-to-End Command-Line Demo**:
  ```bash
  .venv/bin/python sample_data/demo.py
  ```
  *Executes full 7-step automated terminal verification from detection through on-chain resolution.*

---

## 11. Common Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| **MetaMask "Wrong Network"** | Active chain is not Hardhat (31337) or Sepolia (11155111). | Click **"Switch to Sepolia (11155111)"** or **"Switch to Local (31337)"** in the top navigation bar. |
| **MetaMask "Nonce too high"** | Local Hardhat node was restarted. | In MetaMask: Settings > Advanced > Clear activity tab data. |
| **Deployer "Insufficient Funds"** | Account balance is below 0.005 Sepolia ETH. | Request free testnet ETH from [https://sepoliafaucet.com](https://sepoliafaucet.com) or specify a funded key in `.env`. |
| **Backend "Contract ID Revert"** | Contract state reset after Hardhat restart. | Handled automatically by the updated backend verification pipeline; auto-anchors untampered incident before verification. |
| **CORS / API 404** | Flask backend is not running on port 5001. | Verify backend status with `curl http://localhost:5001/system/readiness`. |

---

## 12. Academic Limitations & Security Considerations

1. **Academic Simulation Guardrails**:
   - The system strictly uses synthetic test telemetry and simulation signals (`SIGSTOP` simulation). It does not execute live malware, join external mining pools, or kill host OS processes.
2. **Oracle & Ground Truth Boundary**:
   - Blockchain attestation provides mathematical non-repudiation and proves the telemetry was anchored at block time; it does not independently verify the objective physical truth of the sensor before submission.
3. **Privacy by Design**:
   - Raw host telemetry (hostnames, container IDs, internal IP addresses) is stored exclusively off-chain in private SQLite. Only 32-byte SHA-256 cryptographic digests are broadcast to the public Ethereum ledger.
4. **Stealth Mining Sub-Threshold Bound**:
   - Mining malware that throttles CPU utilization below 15% and tunnels traffic over encrypted DoH/Tor requires low-level kernel eBPF monitoring (MSR instructions, hardware performance counters) beyond user-space heuristics.

