import vanshPhoto from '../assets/developers/vansh-sharma.jpg';
import divyanshPhoto from '../assets/developers/divyansh-bhatia.jpg';

export const projectIdentity = {
  name: 'BlockMineGuard',
  fullName: 'Blockchain-Based Tamper-Evident Cryptojacking Detection and Threat Intelligence Sharing Framework',
  category: 'Cybersecurity · Blockchain · Threat Intelligence',
  description: 'An enterprise-grade defensive framework that unifies off-chain statistical cryptojacking heuristics with on-chain cryptographic evidence anchoring on Ethereum, automated non-destructive containment evaluation, container cgroup monitoring, and Sybil-resistant threat intelligence sharing.',
  academicProgram: 'B.Tech Computer Science & Engineering',
  academicYear: '2026',
  version: '1.2.0'
};

export const teamMembers = [
  {
    id: 'vansh-sharma',
    name: 'Vansh Sharma',
    regNo: '25BCE1567',
    role: 'Lead System Architect & Core Researcher',
    focusArea: 'Detection Heuristics & EVM Smart Contracts',
    avatar: vanshPhoto,
    githubUrl: null, // Configurable: specify GitHub URL if available (e.g. 'https://github.com/...')
    linkedinUrl: null, // Configurable: specify LinkedIn URL if available
    contributions: [
      {
        category: 'Backend & Detection Logic',
        description: 'Engineered evasion-resistant sliding-window statistical detection engine that counters square-wave mining duty cycles and suppresses compiler false positives.'
      },
      {
        category: 'Solidity Smart-Contract Development',
        description: 'Authored and tested ThreatRegistry.sol on Ethereum/EVM with role-based access control, reporter reputation scoring, and tamper-resistant attestation.'
      },
      {
        category: 'Blockchain Integration',
        description: 'Implemented canonical deterministic SHA-256 evidence hashing and dual-network Web3 relayer supporting both local Hardhat (31337) and Ethereum Sepolia (11155111).'
      },
      {
        category: 'Containment Guardrails',
        description: 'Designed non-destructive simulated containment workflows and guardrails rejecting arbitrary host process termination.'
      }
    ],
    technicalHighlights: ['Solidity 0.8.24', 'Python Flask', 'Hardhat / EVM', 'Web3.py', 'Sliding Window', 'Ethers.js']
  },
  {
    id: 'divyansh-bhatia',
    name: 'Divyansh Bhatia',
    regNo: '25BCE1414',
    role: 'Lead Security & Full-Stack Systems Engineer',
    focusArea: 'SOC Operations Console & Threat Intelligence',
    avatar: divyanshPhoto,
    githubUrl: null, // Configurable: specify GitHub URL if available
    linkedinUrl: null, // Configurable: specify LinkedIn URL if available
    contributions: [
      {
        category: 'Frontend & UI/UX',
        description: 'Architected the React 18 enterprise SOC security console, live timeline monitoring, theme engine, and interactive forensics workspace.'
      },
      {
        category: 'Testing & Evaluation Lab',
        description: 'Constructed the 100-workload empirical research evaluation benchmark calculating confusion matrices, precision, recall, F1, and FPR metrics.'
      },
      {
        category: 'Container Telemetry',
        description: 'Built read-only cgroup v2 resource telemetry adapters and namespace process mapping for containerized incident attribution.'
      },
      {
        category: 'Threat Intelligence Sharing',
        description: 'Developed peer-review threat intelligence workflows, IoC deduplication, conflict detection, and Sybil-resistant reputation mechanics.'
      }
    ],
    technicalHighlights: ['React 18', 'Threat Intel', 'Chart.js', 'Cgroup v2 Telemetry', 'Research Lab', 'REST APIs']
  }
];

export const projectTechStack = [
  {
    category: 'Frontend & Console',
    items: [
      { name: 'React 18', role: 'Component UI & State Architecture' },
      { name: 'Ethers.js v6', role: 'Injected Web3 & Contract Signer' },
      { name: 'Chart.js', role: 'Telemetry & Time-Series Visualizations' },
      { name: 'Lucide Icons', role: 'Semantic Cybersecurity Iconography' }
    ]
  },
  {
    category: 'Backend & Detection',
    items: [
      { name: 'Python 3', role: 'Core Engine & Statistical Analytics' },
      { name: 'Flask', role: 'RESTful API Services & Telemetry Ingestion' },
      { name: 'Web3.py', role: 'Ethereum Node Integration & Event Sync' },
      { name: 'SQLite', role: 'Off-Chain Private Forensic Telemetry' }
    ]
  },
  {
    category: 'Blockchain & Attestation',
    items: [
      { name: 'Solidity 0.8.24', role: 'ThreatRegistry Smart Contract' },
      { name: 'Hardhat', role: 'Development Environment & Automated Test Suite' },
      { name: 'Ethereum Sepolia', role: 'Public Testnet Immutable Ledger' },
      { name: 'EVM Local Node', role: 'Low-Latency Local Consensus (Chain 31337)' }
    ]
  }
];
