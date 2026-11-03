# BlockMineGuard — 5-Minute Faculty Review Demonstration Script

**Project Title:** Blockchain-Based Tamper-Evident Cryptojacking Detection and Threat Intelligence Sharing Framework  
**Demo Duration:** 5 Minutes  
**Target Audience:** Academic Review Committee / Faculty Panel

---

## Prerequisites Before Demonstration (1 Minute Setup)
1. Verify terminal processes are running:
   - Terminal 1: Hardhat Node (`npm run blockchain` or `http://127.0.0.1:8545`)
   - Terminal 2: Backend API (`npm run backend` or `http://localhost:5001/health`)
   - Terminal 3: React Frontend (`npm run dev` or `http://localhost:3000`)
2. Open Chrome/Brave at `http://localhost:3000`.
3. Open MetaMask and connect to **Hardhat Local (Chain 31337)** or **Ethereum Sepolia (Chain 11155111)**.

---

## 5-Minute Live Click Sequence

### Minute 1: Problem Statement & Security Dashboard Overview
- **Action:**
  1. Point out the top header: Dark Slate SOC Console, dynamic Smart Contract address, and active Network indicator.
  2. Scroll across the metric tiles: Total Incidents, Critical & High Threats, Verified On-Chain Evidence Hashes, and Threat Intelligence Indicators.
- **Narrative to Faculty:**
  > *"BlockMineGuard tackles the critical threat of cryptojacking in enterprise and cloud environments. Adversaries throttle CPU usage to evade static thresholds and tamper with local forensic logs to avoid attribution. BlockMineGuard couples off-chain multi-factor detection with on-chain cryptographic proof on Ethereum."*

---

### Minute 2: Off-Chain Detection Demonstration (Normal vs Malicious)
- **Action:**
  1. In the **Live Workload Detection & Blockchain Attestation Lab**, click:
     **`1. Normal Workload (Nginx)`**
  2. Point to the pre-filled fields: CPU 45%, Memory 55%, Process `nginx`, Destination `api.example.com`.
  3. Click **`Execute Off-Chain Detection Pipeline`**.
  4. **Observe:**
     - Risk Score: **`10 / 100`**
     - Severity: **`LOW`**
     - Classification: **`BENIGN WORKLOAD`**
     - Recommended Response: *"Standard operational workload. No mitigation required."*
  5. Next, click:
     **`2. Cryptojacking Workload (XMRig)`**
  6. Point to the pre-filled fields: CPU 94%, Memory 71%, Process `xmrig`, Destination `minexmr.com`, Runtime 7200s.
  7. Click **`Execute Off-Chain Detection Pipeline`**.
  8. **Observe:**
     - Risk Score: **`100 / 100`**
     - Severity: **`CRITICAL`**
     - Classification: **`CRYPTOJACKING SUSPICION`**
     - Multi-factor breakdown: CPU utilization (>90%), Process signature matching `xmrig`, Stratum mining destination matching `minexmr.com`, Long continuous execution (>1h).
- **Narrative to Faculty:**
  > *"Both normal and suspicious workloads run through the exact same Python Flask detection engine. Notice the explainable contributing factors rather than an unverified black-box probability."*

---

### Minute 3: Deterministic Evidence Hashing & Blockchain Attestation
- **Action:**
  1. Under Phase 2, click:
     **`Generate Evidence Digest`**
  2. **Observe:**
     - Incident ID generated (e.g., `INC-EDA4FE61`).
     - Deterministic 64-character SHA-256 evidence hash generated (e.g., `4c34c7b0d847...`).
  3. Click:
     **`Record on Blockchain (MetaMask)`** (or **`Record on Sepolia`**)
  4. MetaMask prompts for transaction approval. Click **Confirm** in MetaMask.
  5. **Observe:**
     - Status updates to **On-Chain Confirmed**.
     - Displays Mined Block Number (e.g., `#51`) and Gas Used (~241,383 gas).
     - Working transaction hash and explorer link.
- **Narrative to Faculty:**
  > *"Notice our privacy-by-design architecture: sensitive system telemetry (hostnames, container IDs, internal IPs) strictly remains off-chain in private storage. Only the 32-byte cryptographic SHA-256 evidence digest is anchored to the Ethereum smart contract, establishing an immutable timestamped attestation."*

---

### Minute 4: Simulated Containment & Zero-Trust Tamper Detection
- **Action:**
  1. Under Step 3, click:
     **`Simulate Isolation (SIGSTOP)`**
  2. **Observe:**
     - Status changes to **`● ISOLATED (SIMULATION)`**.
     - Incident audit trail logs simulated CFS quota throttling and process suspension without endangering host system stability.
  3. Under Tamper-Evident Integrity Demonstration, click:
     **`Verify Untampered Evidence`**
  4. **Observe:**
     - Status: **`INTEGRITY VERIFIED`** (Green Check).
     - Local SHA-256 matches the smart contract record byte-for-byte.
  5. Now click:
     **`Test Tamper Detection (Modify CPU: 15%)`**
  6. **Observe:**
     - Status: **`TAMPER DETECTED: Computed hash does not match stored blockchain record!`** (Red Alert).
     - Shows exact hash mismatch: Stored `0x4c34c7b0...` vs Altered `0x5e963a42...`.
- **Narrative to Faculty:**
  > *"This proves the core tamper-evident property of the framework. Even if an insider or compromised administrator maliciously modifies the CPU record from 94% down to 15% to conceal the attack, the smart contract immediately flags a cryptographic mismatch."*

---

### Minute 5: Collaborative Threat Intelligence & Automated Test Proof
- **Action:**
  1. In the left navigation, click **`Threat Intelligence`** (`/threat-intelligence`).
  2. Highlight the decentralized IoC feed: mining pool URLs, malicious IPs, and known miner binaries.
  3. Show the **Reporter Reputation** mechanics: verified IoCs earn `+5 reputation`, while false or duplicate reports receive a `-15 reputation` penalty.
  4. (Optional) Show the terminal with all 90 automated tests passing (`npm test`):
     - 24 Hardhat Solidity smart contract unit tests.
     - 66 Backend Python Pytest unit and integration tests.
- **Concluding Statement to Faculty:**
  > *"In summary, BlockMineGuard provides end-to-end defense: evasion-resistant off-chain detection, privacy-preserving on-chain proof on Ethereum, zero-trust evidence verification, and community threat intelligence sharing."*

---

## Quick Reference Cards for Review Questions

| Faculty Question | Technical Answer |
| :--- | :--- |
| *Why not store all telemetry directly on-chain?* | Gas efficiency and privacy. Storing raw telemetry on-chain would cost thousands of dollars in gas and leak sensitive internal network topology. Storing a 32-byte SHA-256 digest provides mathematical non-repudiation at a fraction of the cost (~48,000 to 240,000 gas). |
| *Does the blockchain prove the telemetry is true?* | No. Blockchain provides **integrity** and **non-repudiation** (proving the data was not altered after submission). Physical truth depends on the host sensor; this distinction is strictly maintained in our academic model. |
| *How are duplicate attacks prevented on-chain?* | `ThreatRegistry.sol` enforces `require(!evidenceHashes[evidenceHash], "Evidence already registered")` using an internal Solidity mapping. |
| *Does the mitigation kill real processes?* | No. In accordance with cybersecurity safety guidelines, the incident response engine executes in safe simulation mode against the synthetic workload without terminating real host processes. |
