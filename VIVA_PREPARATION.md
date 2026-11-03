# BlockMineGuard — Academic Defense & Viva Voce Preparation Guide

**Academic Project Defense (BTech CSE / Capstone Review)**  
**Project Developers:**  
- **Vansh Sharma** (Reg. No: 25BCE1567)  
- **Divyansh Bhatia** (Reg. No: 25BCE1414)  

---

## 1. Core Architecture & Motivation Questions

### Q1: What problem does BlockMineGuard solve that conventional antivirus or SIEM systems cannot?
**Answer:**
Conventional SIEM and host-based intrusion detection systems store forensic telemetry in local disk logs or centralized syslog servers. If an adversary achieves root privileges, they can alter timestamps, delete log entries, or modify process metrics to hide unauthorized mining activity. Furthermore, organizations lack a trusted, decentralized medium to share threat intelligence without single-point-of-failure vulnerabilities.  
BlockMineGuard solves this by combining **multi-factor cryptojacking heuristic detection** with **tamper-evident cryptographic anchoring on an Ethereum-compatible blockchain**. Any subsequent alteration of local telemetry causes a mathematical hash mismatch against the immutable on-chain record.

### Q2: Why use both an SQLite database and a blockchain? Isn't blockchain alone sufficient?
**Answer:**
No, storing high-frequency raw telemetry directly on a public blockchain is an architectural anti-pattern for three reasons:
1. **Cost & Scalability**: Storing kilobytes of metrics per second on Ethereum would incur prohibitive gas fees ($>\$10$ per write) and overwhelm block capacity.
2. **Privacy & Compliance**: Raw host metrics contain internal IP addresses, user process trees, and container IDs. Putting this on a public ledger violates privacy standards (like GDPR).
3. **Query Latency**: Indexing, filtering, and sorting 3,162+ incidents in SQLite takes $<5$ms, whereas querying an EVM ledger takes seconds.  
Therefore, SQLite stores the raw telemetry off-chain, while `ThreatRegistry.sol` stores only a 32-byte canonical SHA-256 evidence hash (`bytes32 evidenceHash`).

---

## 2. Detection & Heuristic Pipeline Questions

### Q3: What specific algorithms and factors does your detection engine use?
**Answer:**
The detection engine calculates a bounded risk score $R \in [0, 100]$ using four orthogonal factors:
1. **CPU Sustained Intensity (0–50 pts)**: Penalizes sustained usage $\ge 90\%$ (50 pts), $70–89\%$ (35 pts), and $50–69\%$ (20 pts).
2. **Process Signature Matching (0–30 pts)**: Matches known miner binaries (`xmrig`, `cpuminer`, `ethminer`, `kinsing`, `kdevtmpfsi`).
3. **Stratum Mining Pool Destinations (0–20 pts)**: Inspects destination ports (`3333`, `4444`, `5555`) and mining pool domain patterns.
4. **Memory Footprint & Runtime Profile (0–10 pts)**: Identifies long-running processes with sustained memory usage.  
Workloads scoring $\ge 80$ are classified as `CRITICAL`, $60–79$ as `HIGH`, $35–59$ as `MEDIUM`, and $<35$ as `LOW`.

### Q4: How do you prevent false positives on legitimate high-CPU tasks like video encoding or code compilation?
**Answer:**
We implement **benign workload dampening**:
- In the time-series detector, we calculate the coefficient of variation and slope regression over a sliding window. Compilers like `gcc` or `clang` exhibit high burstiness with frequent I/O drops, whereas mining algorithms (like Monero RandomX) maintain a flat, near-zero-variance plateau.
- In our synthetic benchmark of 100 workloads (50 miners, 50 benign), our evaluation yields an F1 score of **86.21%** and a recall of **100.0%**, though intensive long-running non-bursty tasks currently produce a 32% false-positive rate that would be further mitigated in production via container baseline profiling.

---

## 3. Cryptography & Evidence Integrity Questions

### Q5: How do you guarantee that calculating the hash of an incident is deterministic?
**Answer:**
We created a dedicated `EvidenceHasher` class in `backend/evidence/hasher.py`. Standard Python dictionaries have arbitrary key order, and float serialization can vary between platforms. `EvidenceHasher` performs:
1. **Key Canonicalization**: Sorts all JSON keys alphabetically.
2. **Type Normalization**: Normalizes floats (e.g. `98.0` is consistently formatted), trims whitespace, and ignores ephemeral client-side metadata.
3. **SHA-256 Digest Generation**: Outputs an exact 64-character hex string prefixed with `0x`, perfectly conforming to Solidity's `bytes32` type.

### Q6: Walk me through the exact steps of the Tamper-Evidence demonstration.
**Answer:**
1. We load an anchored incident from SQLite with confirmed transaction hash and block number.
2. The user initiates verification. The system recalculates $\text{SHA-256}(\text{evidence})$ and queries `getIncidentByHash()` on the smart contract via Web3.py. Both hashes match (`VERIFIED`).
3. In the demonstration lab, we simulate malicious tampering by modifying one field in the telemetry (e.g. changing CPU from 98.5% to 12.0%).
4. When verification is executed again, the new hash is completely different. The smart contract query fails to match, raising a `TAMPERED_HASH_MISMATCH` alert and highlighting the altered fields.

---

## 4. Smart Contract & Blockchain Questions

### Q7: What are the main methods in `ThreatRegistry.sol`?
**Answer:**
- `reportIncident(string externalId, bytes32 evidenceHash, uint8 severity, string threatIntelRef)`: Anchors a new incident. Auto-registers the reporter on first call, verifies evidence hash uniqueness, stores the incident struct, and emits `IncidentReported`.
- `verifyIncident(uint256 incidentId, uint8 status)`: Allows authorized verifiers to mark an incident as `VERIFIED` or `TAMPERED`. Updates reporter reputation accordingly.
- `resolveIncident(uint256 incidentId, uint8 status)`: Marks verified incidents as resolved.
- `addThreatIntelligence(...)` & `verifyThreatIntelligence(...)`: Enables sharing of IoCs with community reputation incentives.
- `getIncidentByHash(bytes32 evidenceHash)`: Look up an on-chain record by its cryptographic digest.

### Q8: How does your reporter reputation system work?
**Answer:**
Reputation scores start at a baseline of 100:
- When a reported incident or threat indicator is verified: **+5 reputation** (capped at 200).
- When a report is found to be false or tampered: **-15 reputation** (floored at 0).
- This creates an asymmetric economic and reputation penalty: submitting malicious reports rapidly drops reputation, preventing spam and Sybil manipulation.

### Q9: How do you handle network differences between Local Hardhat and Sepolia?
**Answer:**
In `frontend/src/services/contractService.js` and `blockchain/hardhat.config.ts`:
- **Local Hardhat (Chain 31337)**: Fast local EVM on port `8545` for instantaneous unit testing and offline presentations.
- **Ethereum Sepolia (Chain 11155111)**: Public testnet for live Web3 verification via MetaMask and Etherscan block explorer links.
- The UI dynamically detects `chainId` from MetaMask, shows explicit visual indicators (`Hardhat Local` vs. `Ethereum Sepolia`), and prompts the user to switch networks if they connect to an unsupported chain.

---

## 5. Security, Ethics, and Limitations Questions

### Q10: Does BlockMineGuard execute real malware or terminate actual host processes?
**Answer:**
No. For safety, compliance, and academic demonstration ethics:
- We use deterministic **synthetic workload fixtures** (`sample_data/cryptojacking_workload.json`).
- Prevention actions operate in **simulated mode**: recommendations like `SIGSTOP` or CFS cgroup throttling are recorded to the forensic audit log without terminating legitimate OS processes.

### Q11: What are the current limitations of the project and directions for future work?
**Answer:**
1. **Kernel-level detection**: Current telemetry is gathered in user space via `psutil`. A stealth rootkit could hook system calls to conceal its CPU consumption. Future work involves implementing Linux **eBPF probes** at ring-0.
2. **Encrypted mining pools**: Cryptojackers increasingly tunnel Stratum traffic over TLS or DNS-over-HTTPS. Network payload regex will miss these; advanced statistical packet entropy analysis would be required.
3. **Decentralized Storage (IPFS)**: While raw telemetry is currently stored in SQLite, future enterprise iterations could store encrypted raw telemetry chunks on IPFS/Filecoin with access control via smart contract NFT keys.
