# BlockMineGuard — Formal Threat Model & Security Analysis

**Academic Capstone & Cybersecurity Research Project**  
**Framework:** STRIDE Methodology & Off-Chain/On-Chain Threat Taxonomy  
**Author:** Vansh Sharma  

---

## 1. System Assets & Trust Boundaries

### 1.1 Critical Assets

| Asset ID | Asset Description | Security Objective | Impact of Compromise |
| :--- | :--- | :--- | :--- |
| **A-1** | **Host / Container Compute Cycles** | Availability & Cost Integrity | Financial exhaustion from cloud compute bills; resource starvation of legitimate workloads |
| **A-2** | **Forensic Evidence & Audit Logs** | Integrity & Non-Repudiation | Adversary modifies or deletes logs to conceal intrusion; undetected persistent mining |
| **A-3** | **Smart Contract Ledger State** | Tamper-Evidence & Immutability | False or manipulated attestation of incident validity; poisoning of historical records |
| **A-4** | **Threat Intelligence Repository (IoCs)** | Authenticity & Trustworthiness | False positive alert fatigue; blacklisting of legitimate infrastructure (e.g. Google DNS) |
| **A-5** | **Deployer & Reporter Private Keys** | Confidentiality & Authorization | Unauthorized submission of fraudulent incidents; depletion of testnet/mainnet gas funds |

### 1.2 Trust Boundaries

```
[ UNTRUSTED INTERNET ]
        |
        | Boundary 1: Ingest & API Gateway (CORS, Payload Validation, Rate Limiting)
        v
[ PYTHON FLASK OPERATIONAL BACKEND ]
        |
        | Boundary 2: Host System Boundary (Non-root Cgroup Adapter, Isolated Synthetic Probes)
        v
[ LOCAL HOST & CONTAINER RUNTIME ]
        |
        | Boundary 3: Off-Chain / On-Chain Boundary (Canonical Hasher, MetaMask Signer)
        v
[ EVM BLOCKCHAIN NETWORK (Local Hardhat / Sepolia) ]
```

---

## 2. Threat Analysis via STRIDE

### 2.1 Spoofing (S)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-S1** | Adversary renames `xmrig` binary to `systemd` or `nginx` to fool process name inspection. | The detection engine uses multi-factor analysis: high sustained CPU ($\ge 90\%$) and Stratum mining pool destinations trigger alerts regardless of process name. | In-memory thread injection without modifying process name or communicating over unencrypted Stratum protocol. |
| **T-S2** | Attacker impersonates legitimate reporter to submit fabricated threat indicators. | Smart contract enforces `msg.sender` cryptographic authentication via Ethereum ECDSA signatures. | Private key theft on analyst endpoint. |

### 2.2 Tampering (T)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-T1** | Adversary gains root access to host and edits SQLite `blockmineguard.db` to alter CPU readings. | **Primary Contribution of BlockMineGuard**: When `verifyIncident` is called, the recalculated SHA-256 hash of the modified record will diverge from the immutable on-chain digest, raising an immediate `TAMPERED_HASH_MISMATCH` alert. | None for detection of tampering; the on-chain hash remains permanent proof of the original state. |
| **T-T2** | Tampering with smart contract state or rewriting historical blocks. | Deployed to Ethereum EVM; historical transactions are protected by Proof-of-Stake consensus. | Reorgs on testnet (mitigated by requiring confirmations). |

### 2.3 Repudiation (R)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-R1** | System administrator denies that a cryptojacking incident occurred on their cluster. | Canonical SHA-256 evidence digest anchored on-chain with immutable timestamp and reporter address provides mathematical non-repudiation. | Stored evidence lost completely if local database is wiped without backups. |

### 2.4 Information Disclosure (I)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-I1** | Sensitive host details (internal IPs, usernames, container names) leaked onto public blockchain. | **Privacy-Preserving Off-Chain Storage**: Only 32-byte cryptographic hashes (`bytes32 evidenceHash`) and high-level severity enums are anchored on-chain. All raw telemetry remains in private SQLite. | Telemetry exposed if Flask backend API is publicly exposed without authentication. |
| **T-I2** | Private keys exposed in client-side React code or repository. | Enforced `.gitignore` rules; MetaMask signer manages private keys in browser extension; zero private keys bundled in frontend. | User exporting key insecurely. |

### 2.5 Denial of Service (DoS)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-D1** | Flooding backend with millions of fake telemetry reports. | Rate limiting, indexed SQLite queries, and non-blocking asynchronous processing. | Heavy SQLite write locking under extreme load. |
| **T-D2** | Sybil attack flooding smart contract with spam incident reports. | Ethereum gas fees create an economic cost per transaction; smart contract enforces reputation decay (`-15`) on false reports. | Sepolia testnet faucets permit free gas accumulation. |

### 2.6 Elevation of Privilege (E)

| Threat ID | Scenario | System Mitigation | Residual Risk |
| :--- | :--- | :--- | :--- |
| **T-E1** | Ingestion of malicious JSON payload leading to Remote Code Execution (RCE). | Strict JSON schema parsing with dataclass type coercion in Python; zero `eval()` or unvalidated shell execution. | Zero-day vulnerability in Python `json` parser. |
| **T-E2** | Unauthorized user attempting to execute automated host process containment. | Containment engine requires `INCIDENT_COMMANDER` role and runs exclusively in simulated non-destructive mode. | None in demo mode. |

---

## 3. Blockchain-Specific Risks & RPC Mitigations

### 3.1 RPC Node Downtime & Censorship
- **Vulnerability**: If public Sepolia RPC endpoint (`https://ethereum-sepolia-rpc.publicnode.com`) experiences rate limiting or downtime, transactions fail.
- **Mitigation**: Dual-network architecture. The system provides immediate fallback to local Hardhat node (`http://127.0.0.1:8545`). Flask API returns structured `BLOCKCHAIN_OUTAGE` status codes rather than crashing.

### 3.2 Gas Price Spikes & Transaction Stalling
- **Vulnerability**: High base fees (EIP-1559) on Sepolia can stall transactions in the mempool.
- **Mitigation**: Hardhat deployment scripts use optimized Solidity 0.8.24 with 200 optimizer runs, reducing `reportIncident()` gas consumption to ~48,210 gas.

---

## 4. Remaining Security Limitations & Future Research

1. **Kernel-Level Evasion**: User-space detection via `psutil` can be bypassed by kernel rootkits (e.g. hooking `sys_getdents` to hide mining processes). Future work should integrate eBPF kernel probes.
2. **Encrypted Mining Protocols (Stratum over TLS / DoH)**: When adversaries use TLS-encrypted Stratum or DNS-over-HTTPS, network payload inspection fails. In such cases, statistical CPU variance and entropy analysis remain the primary detection vectors.
3. **Formal Verification of Smart Contracts**: `ThreatRegistry.sol` has 100% test coverage via Hardhat unit tests, but has not undergone formal mathematical verification (e.g. via Certora or Slither static analysis).
