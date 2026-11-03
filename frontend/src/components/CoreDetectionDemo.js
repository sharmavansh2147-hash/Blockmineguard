import React, { useState, useEffect } from 'react';
import { detectionApi, incidentsApi } from '../services/api';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../App';
import contractService from '../services/contractService';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Server,
  Zap,
  Lock,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  Layers
} from 'lucide-react';

const NORMAL_WORKLOAD_FIXTURE = {
  cpu_usage: 45.0,
  memory_usage: 55.0,
  process_name: 'nginx',
  process_runtime_seconds: 300,
  network_destination: 'api.example.com',
  container_name: null,
  environment: 'HOST'
};

const CRYPTOJACKING_WORKLOAD_FIXTURE = {
  cpu_usage: 94.0,
  memory_usage: 71.0,
  process_name: 'xmrig',
  process_runtime_seconds: 7200,
  network_destination: 'minexmr.com',
  container_name: null,
  environment: 'HOST',
  threat_intel_ref: 'TI-XMR-001'
};

export function CoreDetectionDemo({ onIncidentCreated }) {
  const { showToast } = useApp();
  const { isConnected, signer, chainId, switchNetwork, connect } = useWallet();

  // Selected telemetry payload
  const [activeFixture, setActiveFixture] = useState('cryptojacking');
  const [telemetry, setTelemetry] = useState(CRYPTOJACKING_WORKLOAD_FIXTURE);

  // Detection pipeline states
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);

  // Incident & Blockchain attestation states
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [createdIncident, setCreatedIncident] = useState(null);
  const [recordingOnChain, setRecordingOnChain] = useState(false);
  const [blockchainTx, setBlockchainTx] = useState(null);
  const [blockchainError, setBlockchainError] = useState(null);

  // Simulated mitigation state
  const [mitigationState, setMitigationState] = useState(null); // 'ISOLATED_SIMULATED'
  const [mitigationTimestamp, setMitigationTimestamp] = useState(null);

  // Verification states
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [tamperTesting, setTamperTesting] = useState(false);

  // Copy state
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  // Load preset
  const handleLoadFixture = (type) => {
    setActiveFixture(type);
    const fixture = type === 'normal' ? NORMAL_WORKLOAD_FIXTURE : CRYPTOJACKING_WORKLOAD_FIXTURE;
    setTelemetry({ ...fixture });
    setDetectionResult(null);
    setCreatedIncident(null);
    setBlockchainTx(null);
    setBlockchainError(null);
    setMitigationState(null);
    setVerificationResult(null);
  };

  // Step 1: Run Detection Pipeline through Flask /detect
  const handleRunDetection = async () => {
    setDetecting(true);
    setDetectionResult(null);
    setCreatedIncident(null);
    setBlockchainTx(null);
    setBlockchainError(null);
    setMitigationState(null);
    setVerificationResult(null);

    try {
      const payload = {
        cpu_usage: parseFloat(telemetry.cpu_usage) || 0,
        memory_usage: parseFloat(telemetry.memory_usage) || 0,
        process_name: telemetry.process_name || '',
        process_runtime_seconds: parseInt(telemetry.process_runtime_seconds) || 0,
        network_destination: telemetry.network_destination || null,
        container_name: telemetry.container_name || null,
        environment: telemetry.environment || 'HOST'
      };

      const res = await detectionApi.detect(payload);
      setDetectionResult(res.data);
      showToast(
        res.data.suspicious
          ? `Suspicious activity detected! Score: ${res.data.risk_score.score} (${res.data.risk_score.severity})`
          : `Nominal workload verified. Score: ${res.data.risk_score.score} (LOW)`,
        res.data.suspicious ? 'warning' : 'info'
      );
    } catch (err) {
      console.error('Detection failed:', err);
      showToast('Detection pipeline error: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setDetecting(false);
    }
  };

  // Step 2: Create Incident & Deterministic Hash
  const handleCreateIncident = async () => {
    if (!detectionResult) return;
    setCreatingIncident(true);
    try {
      const payload = {
        ...telemetry,
        cpu_usage: parseFloat(telemetry.cpu_usage),
        memory_usage: parseFloat(telemetry.memory_usage),
        process_runtime_seconds: parseInt(telemetry.process_runtime_seconds),
        threat_intel_ref: telemetry.threat_intel_ref || (activeFixture === 'cryptojacking' ? 'TI-XMR-001' : '')
      };

      const res = await incidentsApi.create(payload);
      const inc = res.data;
      setCreatedIncident(inc);

      // If backend automatically mined a tx (e.g. Hardhat backend auto-signer)
      if (inc.blockchain_tx && inc.blockchain_tx.tx_hash) {
        setBlockchainTx({
          txHash: inc.blockchain_tx.tx_hash,
          blockNumber: inc.blockchain_tx.block_number,
          gasUsed: inc.blockchain_tx.gas_used,
          contractAddress: inc.blockchain_tx.contract_address || contractService.getContractAddress(chainId || 31337),
          chainId: chainId || 31337,
          explorerUrl: contractService.getExplorerUrl(chainId || 31337, inc.blockchain_tx.tx_hash, 'tx')
        });
      }

      showToast(`Incident ${inc.incident_id} created with canonical hash`, 'success');
      if (onIncidentCreated) onIncidentCreated();
    } catch (err) {
      console.error('Failed to create incident:', err);
      showToast('Failed to create incident: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCreatingIncident(false);
    }
  };

  // Step 3: Record on Sepolia / Hardhat Blockchain via MetaMask Ethers v6
  const handleRecordOnChainMetaMask = async () => {
    if (!createdIncident) {
      showToast('Please create the incident record first', 'warning');
      return;
    }

    if (!isConnected || !signer) {
      try {
        await connect();
      } catch (e) {
        showToast('Please connect your MetaMask wallet to record on-chain', 'warning');
        return;
      }
    }

    setRecordingOnChain(true);
    setBlockchainError(null);

    try {
      const externalId = createdIncident.incident_id;
      const evidenceHash = createdIncident.evidence_hash;
      const severity = createdIncident.risk_score?.severity || createdIncident.evidence?.severity || 'HIGH';
      const threatIntelRef = createdIncident.evidence?.threat_intel_ref || 'TI-XMR-001';

      showToast('Prompting MetaMask for transaction approval...', 'info');

      const receipt = await contractService.recordIncidentOnChain(
        signer,
        externalId,
        evidenceHash,
        severity,
        threatIntelRef
      );

      // Save transaction to backend SQLite
      try {
        await incidentsApi.updateBlockchain(externalId, {
          tx_hash: receipt.txHash,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed,
          contract_address: receipt.contractAddress,
          chain_id: receipt.chainId,
          incident_id: receipt.incidentId
        });
      } catch (backendErr) {
        console.warn('Backend sync warning:', backendErr);
      }

      setBlockchainTx(receipt);
      showToast('Transaction confirmed and anchored on blockchain!', 'success');
      if (onIncidentCreated) onIncidentCreated();
    } catch (err) {
      console.error('MetaMask transaction failed:', err);
      let userMsg = err.message || 'Transaction rejected';
      if (err.code === 4001 || err.action === 'sendTransaction') {
        userMsg = 'User rejected transaction in MetaMask';
      } else if (err.code === 'INSUFFICIENT_FUNDS') {
        userMsg = 'Insufficient testnet ETH balance to pay gas';
      }
      setBlockchainError(userMsg);
      showToast(userMsg, 'error');
    } finally {
      setRecordingOnChain(false);
    }
  };

  // Step 4: Simulated Incident Containment
  const handleSimulateMitigation = async () => {
    if (!createdIncident) return;
    const now = new Date();
    setMitigationState('ISOLATED_SIMULATED');
    setMitigationTimestamp(now.toLocaleTimeString());

    try {
      await incidentsApi.addNote(
        createdIncident.incident_id,
        `[SIMULATED CONTAINMENT] Process '${telemetry.process_name}' tagged for cgroups cpu.max throttle (CFS Quota 10%) & SIGSTOP in isolated staging namespace. Host system processes were NOT terminated (safe academic demonstration).`,
        'BlockMineGuard SOC Engine (Simulation)'
      );
      showToast('Simulated process containment logged to incident audit trail', 'success');
    } catch (e) {
      console.warn('Failed to append simulation note:', e);
    }
  };

  // Step 5: Verify Incident (Valid)
  const handleVerifyOriginal = async () => {
    if (!createdIncident) return;
    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await incidentsApi.verify(createdIncident.incident_id);
      setVerificationResult(res.data);
      showToast(
        res.data.verification_result === 'VERIFIED'
          ? 'Evidence verified! Off-chain SHA-256 matches blockchain anchor.'
          : 'Verification result: ' + res.data.verification_result,
        res.data.verification_result === 'VERIFIED' ? 'success' : 'warning'
      );
    } catch (err) {
      showToast('Verification failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setVerifying(false);
    }
  };

  // Step 6: Test Tamper Detection (Modify payload to demonstrate cryptographic non-repudiation)
  const handleTestTamper = async () => {
    if (!createdIncident) return;
    setTamperTesting(true);
    setVerificationResult(null);

    try {
      // Create tampered evidence: alter CPU usage from 94% down to 15% and severity to LOW
      const tamperedEvidence = {
        incident_id: createdIncident.incident_id,
        timestamp: createdIncident.evidence?.timestamp || new Date().toISOString(),
        cpu_usage: 15.0, // FORGED VALUE
        memory_usage: createdIncident.evidence?.memory_usage || 71.0,
        process_name: createdIncident.evidence?.process_name || 'xmrig',
        process_runtime_seconds: createdIncident.evidence?.process_runtime_seconds || 7200,
        network_destination: createdIncident.evidence?.network_destination || 'minexmr.com',
        container_name: null,
        environment: 'HOST',
        risk_score: 15, // FORGED SCORE
        severity: 'LOW', // FORGED SEVERITY
        factors: {}
      };

      const res = await incidentsApi.verify(createdIncident.incident_id, tamperedEvidence);
      setVerificationResult(res.data);
      showToast(
        'Tamper detected! Computed hash differs from on-chain immutable anchor.',
        'warning'
      );
    } catch (err) {
      showToast('Tamper test error: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setTamperTesting(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
    }
    showToast('Copied to clipboard', 'info');
  };

  const isSepolia = chainId === 11155111;

  return (
    <div
      style={{
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '24px',
        position: 'relative'
      }}
    >
      {/* Top Banner & Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid #1e293b',
          paddingBottom: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--success)',
                display: 'inline-block'
              }}
            />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Live Workload Detection & Blockchain Attestation Lab
            </h2>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              Academic Review Demo
            </span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px', margin: 0 }}>
            Inspect real JSON workloads, run the Python Flask detection pipeline, compute deterministic SHA-256 evidence digests, and record immutable attestations on Ethereum Sepolia or Local Hardhat.
          </p>
        </div>

        {/* Fixture Selector Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeFixture === 'normal' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handleLoadFixture('normal')}
            style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Server size={14} />
            1. Normal Workload (Nginx)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeFixture === 'cryptojacking' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => handleLoadFixture('cryptojacking')}
            style={{
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeFixture === 'cryptojacking' ? '#dc2626' : 'transparent',
              borderColor: activeFixture === 'cryptojacking' ? '#dc2626' : '#ef4444',
              color: activeFixture === 'cryptojacking' ? '#ffffff' : '#f87171'
            }}
          >
            <Zap size={14} />
            2. Cryptojacking Workload (XMRig)
          </button>
        </div>
      </div>

      {/* Grid: Telemetry Ingest & Execution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Column 1: Workload Parameters */}
        <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Workload Telemetry Payload ({activeFixture === 'normal' ? 'normal_workload.json' : 'cryptojacking_workload.json'})
            </span>
            <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
              Source: sample_data/
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Process Name</label>
              <input
                type="text"
                className="input input-sm mono"
                value={telemetry.process_name}
                onChange={e => setTelemetry({ ...telemetry, process_name: e.target.value })}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>CPU Utilization (%)</label>
              <input
                type="number"
                className="input input-sm mono"
                value={telemetry.cpu_usage}
                onChange={e => setTelemetry({ ...telemetry, cpu_usage: parseFloat(e.target.value) || 0 })}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Memory Utilization (%)</label>
              <input
                type="number"
                className="input input-sm mono"
                value={telemetry.memory_usage}
                onChange={e => setTelemetry({ ...telemetry, memory_usage: parseFloat(e.target.value) || 0 })}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Runtime (Seconds)</label>
              <input
                type="number"
                className="input input-sm mono"
                value={telemetry.process_runtime_seconds}
                onChange={e => setTelemetry({ ...telemetry, process_runtime_seconds: parseInt(e.target.value) || 0 })}
                style={{ fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Network Destination / Mining Pool</label>
            <input
              type="text"
              className="input input-sm mono"
              value={telemetry.network_destination || ''}
              onChange={e => setTelemetry({ ...telemetry, network_destination: e.target.value })}
              placeholder="e.g. minexmr.com"
              style={{ fontSize: '0.8rem' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunDetection}
            disabled={detecting}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {detecting ? (
              <>
                <RefreshCw size={15} className="spin" /> Analyzing Off-Chain Workload...
              </>
            ) : (
              <>
                <Play size={15} /> Execute Off-Chain Detection Pipeline
              </>
            )}
          </button>
        </div>

        {/* Column 2: Detector Output */}
        <div style={{ background: '#0b1120', border: '1px solid #1e293b', borderRadius: '6px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Real-time Detector Evaluation (Flask Backend /detect)
            </span>
            {detectionResult && (
              <span
                className={`badge ${detectionResult.suspicious ? 'badge-high' : 'badge-low'}`}
                style={{ fontSize: '0.72rem', fontWeight: 700 }}
              >
                {detectionResult.suspicious ? 'CRYPTOJACKING SUSPICION' : 'BENIGN WORKLOAD'}
              </span>
            )}
          </div>

          {!detectionResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '180px', color: '#64748b', textAlign: 'center' }}>
              <Terminal size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
              <p style={{ fontSize: '0.82rem', margin: 0 }}>Select a workload and click <strong>Execute Detection Pipeline</strong> to evaluate.</p>
            </div>
          ) : (
            <div>
              {/* Score bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: '8px',
                    background: detectionResult.suspicious ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${detectionResult.suspicious ? '#ef4444' : '#10b981'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: detectionResult.suspicious ? '#f87171' : '#34d399', lineHeight: 1 }}>
                    {detectionResult.risk_score.score}
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2 }}>/ 100</span>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Severity Rating:</span>
                    <span style={{ fontWeight: 700, color: detectionResult.suspicious ? '#f87171' : '#34d399' }}>
                      {detectionResult.risk_score.severity}
                    </span>
                  </div>
                  <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${detectionResult.risk_score.score}%`,
                        background: detectionResult.suspicious ? '#ef4444' : '#10b981'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 6 }}>
                    Calculation: Multi-factor rule engine evaluating CPU threshold, known miner signature, and mining pool destination.
                  </div>
                </div>
              </div>

              {/* Reasons */}
              <div style={{ marginBottom: '14px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Contributing Indicators:
                </span>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '0.76rem', color: '#cbd5e1' }}>
                  {detectionResult.risk_score.reasons && detectionResult.risk_score.reasons.length > 0 ? (
                    detectionResult.risk_score.reasons.map((r, i) => <li key={i}>{r}</li>)
                  ) : (
                    <li>No malicious indicators detected. Workload operates within standard baseline limits.</li>
                  )}
                </ul>
              </div>

              {/* Recommended Response */}
              <div
                style={{
                  background: detectionResult.suspicious ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${detectionResult.suspicious ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  fontSize: '0.75rem',
                  color: detectionResult.suspicious ? '#fca5a5' : '#86efac'
                }}
              >
                <strong>Recommended Action:</strong>{' '}
                {detectionResult.suspicious
                  ? 'High-confidence mining workload detected. Contain process, calculate deterministic evidence hash, and anchor immutable record on Ethereum smart contract.'
                  : 'Standard operational workload. No mitigation required; continue automated monitoring.'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Threat Registration & Blockchain Attestation Workflow */}
      {detectionResult && detectionResult.suspicious && (
        <div
          style={{
            marginTop: '20px',
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: '6px',
            padding: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Phase 2: Immutable On-Chain Threat Registry Registration
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
              Target: {isSepolia ? 'Ethereum Sepolia (11155111)' : 'Hardhat Local (31337)'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Step A: Create Incident */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                  1
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Generate Incident & Evidence Hash
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '12px' }}>
                Computes canonical SHA-256 digest of normalized telemetry fields (CPU, memory, runtime, process, destination) and records incident in SQLite.
              </p>

              {!createdIncident ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCreateIncident}
                  disabled={creatingIncident}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {creatingIncident ? <RefreshCw size={14} className="spin" /> : <FileText size={14} />}
                  Generate Evidence Digest
                </button>
              ) : (
                <div style={{ background: '#070b13', border: '1px solid #1e293b', borderRadius: '4px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>
                    <span>Incident ID:</span>
                    <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{createdIncident.incident_id}</strong>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      SHA256: {createdIncident.evidence_hash.slice(0, 16)}...
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdIncident.evidence_hash, 'hash')}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                      title="Copy full 64-char SHA-256 hash"
                    >
                      {copiedHash ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step B: MetaMask / Smart Contract Recording */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                  2
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Record on Ethereum ({isSepolia ? 'Sepolia' : 'Hardhat'})
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '12px' }}>
                Calls <code>ThreatRegistry.reportIncident()</code> via MetaMask (Ethers.js v6) to anchor evidence hash on-chain.
              </p>

              {!blockchainTx ? (
                <div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleRecordOnChainMetaMask}
                    disabled={!createdIncident || recordingOnChain}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {recordingOnChain ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Waiting for Blockchain Confirmation...
                      </>
                    ) : (
                      <>
                        <Lock size={14} /> Record on {isSepolia ? 'Sepolia' : 'Blockchain'} (MetaMask)
                      </>
                    )}
                  </button>
                  {blockchainError && (
                    <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#f87171' }}>
                      {blockchainError}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#070b13', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={13} /> On-Chain Confirmed
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Block #{blockchainTx.blockNumber}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: 'monospace' }}>
                      Tx: {blockchainTx.txHash.slice(0, 14)}...
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(blockchainTx.txHash, 'tx')}
                        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: 0 }}
                        title="Copy Tx Hash"
                      >
                        {copiedTx ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      </button>
                      {blockchainTx.explorerUrl && (
                        <a
                          href={blockchainTx.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#38bdf8' }}
                          title="View on Sepolia Etherscan"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step C: Simulated Mitigation */}
            <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '6px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                  3
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9' }}>
                  Simulated Incident Mitigation
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginBottom: '12px' }}>
                Executes simulated process suspension & quota isolation against synthetic incident. Safe simulation (does not touch host OS processes).
              </p>

              {!mitigationState ? (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleSimulateMitigation}
                  disabled={!createdIncident}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Shield size={14} /> Simulate Isolation (SIGSTOP)
                </button>
              ) : (
                <div style={{ background: '#070b13', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '4px', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                      ● ISOLATED (SIMULATION)
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      {mitigationTimestamp}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 3 }}>
                    Appended note to incident audit trail. Host processes untouched.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step D: Verification & Tamper Detection Demonstrator */}
          {createdIncident && (
            <div
              style={{
                marginTop: '16px',
                borderTop: '1px solid #1e293b',
                paddingTop: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                    Tamper-Evident Integrity Demonstration
                  </span>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '2px 0 0' }}>
                    Compare computed SHA-256 hashes against on-chain contract anchor to prove tamper detection.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleVerifyOriginal}
                    disabled={verifying || tamperTesting}
                    style={{ fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {verifying ? <RefreshCw size={13} className="spin" /> : <CheckCircle size={13} color="#10b981" />}
                    Verify Untampered Evidence
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleTestTamper}
                    disabled={verifying || tamperTesting}
                    style={{
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderColor: '#ef4444',
                      color: '#f87171'
                    }}
                  >
                    {tamperTesting ? <RefreshCw size={13} className="spin" /> : <AlertTriangle size={13} />}
                    Test Tamper Detection (Modify CPU: 15%)
                  </button>
                </div>
              </div>

              {verificationResult && (
                <div
                  style={{
                    background: verificationResult.verification_result === 'VERIFIED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: `1px solid ${verificationResult.verification_result === 'VERIFIED' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    borderRadius: '6px',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {verificationResult.verification_result === 'VERIFIED' ? (
                        <CheckCircle2 size={16} color="#10b981" />
                      ) : (
                        <XCircle size={16} color="#ef4444" />
                      )}
                      <strong style={{ fontSize: '0.82rem', color: verificationResult.verification_result === 'VERIFIED' ? '#34d399' : '#f87171' }}>
                        {verificationResult.verification_result === 'VERIFIED'
                          ? 'INTEGRITY VERIFIED: Evidence matches on-chain cryptographic anchor'
                          : 'TAMPER DETECTED: Computed hash does not match stored blockchain record!'}
                      </strong>
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                      {verificationResult.network || 'Hardhat Local / Sepolia'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px', fontSize: '0.72rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Computed SHA-256: </span>
                      {verificationResult.computed_hash || 'N/A'}
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Stored Anchor Hash: </span>
                      {verificationResult.stored_hash || verificationResult.on_chain_hash || 'N/A'}
                    </div>
                  </div>

                  <p style={{ margin: '8px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                    {verificationResult.details}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CoreDetectionDemo;
