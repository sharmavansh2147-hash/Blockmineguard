import { ethers } from 'ethers';
import deployedAddresses from '../contracts/deployed_addresses.json';

export const THREAT_REGISTRY_ABI = [
  "constructor()",
  "event IncidentReported(uint256 indexed incidentId, string externalId, bytes32 evidenceHash, uint256 timestamp, uint8 severity, address indexed reporter)",
  "event IncidentVerified(uint256 indexed incidentId, address indexed verifier, uint8 status)",
  "event IncidentResolved(uint256 indexed incidentId, address indexed resolver, uint8 status)",
  "event ThreatIntelAdded(uint256 indexed intelId, string indicator, string indicatorType, address indexed reporter)",
  "event ThreatIntelVerified(uint256 indexed intelId, address indexed verifier)",
  "event ReporterRegistered(address indexed reporter)",
  "event ReputationUpdated(address indexed reporter, int256 change, uint256 newScore)",
  "function reportIncident(string calldata externalId, bytes32 evidenceHash, uint8 severity, string calldata threatIntelRef) external returns (uint256)",
  "function verifyIncident(uint256 incidentId, uint8 status) external",
  "function resolveIncident(uint256 incidentId, uint8 status) external",
  "function getIncident(uint256 incidentId) external view returns (tuple(uint256 incidentId, string externalId, bytes32 evidenceHash, uint256 timestamp, uint8 severity, address reporter, uint8 verificationStatus, uint8 resolutionStatus, string threatIntelRef, bool exists))",
  "function getIncidentCount() external view returns (uint256)",
  "function getIncidentByHash(bytes32 evidenceHash) external view returns (uint256)",
  "function getIncidentByExternalId(string calldata externalId) external view returns (tuple(uint256 incidentId, string externalId, bytes32 evidenceHash, uint256 timestamp, uint8 severity, address reporter, uint8 verificationStatus, uint8 resolutionStatus, string threatIntelRef, bool exists))",
  "function externalIdToIncidentId(string calldata externalId) external view returns (uint256)",
  "function addThreatIntelligence(string calldata indicator, string calldata indicatorType, string calldata description, string calldata campaignId) external returns (uint256)",
  "function verifyThreatIntelligence(uint256 intelId) external",
  "function getThreatIntelligence(uint256 intelId) external view returns (tuple(uint256 intelId, string indicator, string indicatorType, string description, string campaignId, uint256 timestamp, address reporter, bool verified, bool exists))",
  "function getThreatIntelCount() external view returns (uint256)",
  "function getReporterReputation(address reporter) external view returns (tuple(address reporter, uint256 reputationScore, uint256 totalReports, uint256 verifiedReports, uint256 falseReports, bool registered))",
  "function registerAsReporter() external"
];

// Fallback known deployment addresses
export const DEFAULT_CONTRACT_ADDRESSES = {
  31337: "0x525C7063E7C20997BaaE9bDa922159152D0e8417",
  11155111: process.env.REACT_APP_SEPOLIA_CONTRACT_ADDRESS || null
};

export const getContractAddress = (chainId) => {
  const normalizedId = String(chainId);
  // Check dynamically loaded manifest first
  if (deployedAddresses && deployedAddresses[normalizedId]) {
    return deployedAddresses[normalizedId];
  }
  if (chainId === 31337 && deployedAddresses && deployedAddresses.localhost) {
    return deployedAddresses.localhost;
  }
  if (chainId === 11155111 && deployedAddresses && deployedAddresses.sepolia) {
    return deployedAddresses.sepolia;
  }
  // Check localStorage if user manually set it in Settings
  const savedAddress = localStorage.getItem(`bmg_contract_${chainId}`);
  if (savedAddress && ethers.isAddress(savedAddress)) {
    return savedAddress;
  }
  return DEFAULT_CONTRACT_ADDRESSES[Number(chainId)] || null;
};

export const isContractAccessible = async (provider, address) => {
  if (!address || !ethers.isAddress(address)) {
    return { accessible: false, reason: "Invalid or unconfigured contract address" };
  }
  if (!provider) {
    return { accessible: false, reason: "No Web3 provider available" };
  }
  try {
    const code = await provider.getCode(address);
    if (!code || code === '0x' || code === '0x0') {
      return {
        accessible: false,
        reason: `No smart contract bytecode deployed at address ${address}`
      };
    }
    return { accessible: true, address };
  } catch (err) {
    return {
      accessible: false,
      reason: `Failed to query contract bytecode: ${err.message || err}`
    };
  }
};

export const getExplorerUrl = (chainId, hashOrAddress, type = 'tx') => {
  if (Number(chainId) === 11155111) {
    return `https://sepolia.etherscan.io/${type}/${hashOrAddress}`;
  }
  return null;
};

export const getThreatRegistryContract = (signerOrProvider, chainId) => {
  const address = getContractAddress(chainId);
  if (!address || !ethers.isAddress(address)) {
    throw new Error(`No valid contract address configured for chain ID ${chainId}`);
  }
  return new ethers.Contract(address, THREAT_REGISTRY_ABI, signerOrProvider);
};

export const formatEvidenceHashToBytes32 = (hash) => {
  let clean = String(hash).trim().toLowerCase().replace(/^0x/, '');
  if (clean.length === 64) {
    return `0x${clean}`;
  }
  // If not exactly 64 hex characters, compute keccak256
  return ethers.keccak256(ethers.toUtf8Bytes(hash));
};

export const severityToCode = (severity) => {
  const s = String(severity).toUpperCase();
  if (s === 'LOW') return 0;
  if (s === 'MEDIUM') return 1;
  if (s === 'HIGH' || s === 'CRITICAL') return 2;
  return 1;
};

/**
 * Record an incident directly on-chain using MetaMask and Ethers v6
 */
export const recordIncidentOnChain = async (signer, externalId, evidenceHash, severity, threatIntelRef = "") => {
  if (!signer) {
    throw new Error("No signer provided. Please connect your MetaMask wallet first.");
  }

  const network = await signer.provider.getNetwork();
  const chainId = Number(network.chainId);
  const contractAddress = getContractAddress(chainId);

  if (!contractAddress) {
    throw new Error(
      `No ThreatRegistry contract address configured for chain ID ${chainId}. ` +
      (chainId === 11155111
        ? "Please deploy ThreatRegistry to Sepolia using 'npm --prefix blockchain run deploy:sepolia' or set REACT_APP_SEPOLIA_CONTRACT_ADDRESS in .env."
        : "Please verify local deployment on chain 31337.")
    );
  }

  // Requirement 7: Verify that the configured contract is accessible at that address before enabling registration
  const access = await isContractAccessible(signer.provider, contractAddress);
  if (!access.accessible) {
    throw new Error(`Contract at ${contractAddress} is not accessible on chain ${chainId}: ${access.reason}`);
  }

  const contract = getThreatRegistryContract(signer, chainId);
  const bytes32Hash = formatEvidenceHashToBytes32(evidenceHash);
  const sevCode = severityToCode(severity);

  // Check if evidence or external ID is already registered on-chain
  try {
    let existingId = await contract.getIncidentByHash(bytes32Hash);
    if (!existingId || Number(existingId) === 0) {
      existingId = await contract.externalIdToIncidentId(externalId);
    }
    if (existingId && Number(existingId) > 0) {
      const onChainRecord = await contract.getIncident(existingId);
      return {
        alreadyRegistered: true,
        incidentId: Number(existingId),
        txHash: null,
        chainId,
        contractAddress,
        onChainRecord: {
          incidentId: Number(onChainRecord.incidentId),
          externalId: onChainRecord.externalId,
          evidenceHash: onChainRecord.evidenceHash,
          timestamp: Number(onChainRecord.timestamp),
          severity: Number(onChainRecord.severity),
          reporter: onChainRecord.reporter,
          verificationStatus: Number(onChainRecord.verificationStatus),
          resolutionStatus: Number(onChainRecord.resolutionStatus),
          threatIntelRef: onChainRecord.threatIntelRef,
          exists: onChainRecord.exists
        }
      };
    }
  } catch (err) {
    // If lookup fails, proceed to report
  }

  const tx = await contract.reportIncident(
    externalId,
    bytes32Hash,
    sevCode,
    threatIntelRef || ""
  );

  const receipt = await tx.wait(1);

  // Extract incident ID from IncidentReported event
  let onChainIncidentId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === 'IncidentReported') {
        onChainIncidentId = Number(parsed.args.incidentId);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!onChainIncidentId) {
    try {
      const fetchedId = await contract.getIncidentByHash(bytes32Hash);
      if (fetchedId && Number(fetchedId) > 0) {
        onChainIncidentId = Number(fetchedId);
      }
    } catch {}
  }

  // Requirement 8: Retrieve the actual on-chain record and compare
  let onChainRecord = null;
  if (onChainIncidentId) {
    try {
      const record = await contract.getIncident(onChainIncidentId);
      onChainRecord = {
        incidentId: Number(record.incidentId),
        externalId: record.externalId,
        evidenceHash: record.evidenceHash,
        timestamp: Number(record.timestamp),
        severity: Number(record.severity),
        reporter: record.reporter,
        verificationStatus: Number(record.verificationStatus),
        resolutionStatus: Number(record.resolutionStatus),
        threatIntelRef: record.threatIntelRef,
        exists: record.exists
      };

      // Read-back verification
      if (onChainRecord.evidenceHash.toLowerCase() !== bytes32Hash.toLowerCase()) {
        throw new Error(
          `On-chain record read-back verification failed: anchored digest ${onChainRecord.evidenceHash} does not match submitted digest ${bytes32Hash}`
        );
      }
    } catch (fetchErr) {
      if (fetchErr.message && fetchErr.message.includes("read-back verification failed")) {
        throw fetchErr;
      }
      console.warn("Could not retrieve on-chain record:", fetchErr);
    }
  }

  const explorerUrl = getExplorerUrl(chainId, tx.hash, 'tx');

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: Number(receipt.gasUsed),
    incidentId: onChainIncidentId,
    contractAddress,
    chainId,
    explorerUrl,
    receipt,
    onChainRecord
  };
};

/**
 * Verify an incident on-chain using MetaMask
 */
export const verifyIncidentOnChain = async (signer, onChainIncidentId, isVerified = true) => {
  if (!signer) {
    throw new Error("No signer provided. Please connect your MetaMask wallet first.");
  }

  const network = await signer.provider.getNetwork();
  const chainId = Number(network.chainId);
  const contract = getThreatRegistryContract(signer, chainId);

  const status = isVerified ? 1 : 2; // 1: VERIFIED, 2: TAMPERED
  const tx = await contract.verifyIncident(onChainIncidentId, status);
  const receipt = await tx.wait();

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: Number(receipt.gasUsed),
    receipt
  };
};

/**
 * Query an incident on-chain
 */
export const getOnChainIncident = async (providerOrSigner, chainId, onChainIncidentId) => {
  const contract = getThreatRegistryContract(providerOrSigner, chainId);
  const record = await contract.getIncident(onChainIncidentId);
  return {
    incidentId: Number(record.incidentId),
    externalId: record.externalId,
    evidenceHash: record.evidenceHash,
    timestamp: Number(record.timestamp),
    severity: Number(record.severity),
    reporter: record.reporter,
    verificationStatus: Number(record.verificationStatus),
    resolutionStatus: Number(record.resolutionStatus),
    threatIntelRef: record.threatIntelRef,
    exists: record.exists
  };
};

export default {
  THREAT_REGISTRY_ABI,
  DEFAULT_CONTRACT_ADDRESSES,
  getContractAddress,
  isContractAccessible,
  getExplorerUrl,
  getThreatRegistryContract,
  formatEvidenceHashToBytes32,
  recordIncidentOnChain,
  verifyIncidentOnChain,
  getOnChainIncident
};
