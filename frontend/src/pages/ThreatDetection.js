import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { detectionApi, incidentsApi } from '../services/api';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../App';
import { useNotifications } from '../context/NotificationContext';
import { TransactionModal } from '../components/TransactionModal';
import contractService from '../services/contractService';
import {
  Server,
  Zap,
  Play,
  FileCode,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  ArrowRight,
  GitCompare
} from 'lucide-react';

const NORMAL_SAMPLE = {
  cpu_usage: 14.2,
  memory_usage: 32.5,
  process_name: 'nginx-webserver',
  process_runtime_seconds: 86400,
  network_destination: 'static.cdn.cloudflare.com:443',
  container_name: 'edge-proxy-01',
  environment: 'CONTAINER'
};

const CRYPTOJACKING_SAMPLE = {
  cpu_usage: 95.8,
  memory_usage: 81.2,
  process_name: 'xmrig-miner',
  process_runtime_seconds: 7200,
  network_destination: 'pool.supportxmr.com:3333',
  container_name: 'batch-worker-prod',
  environment: 'CONTAINER',
  threat_intel_ref: 'TI-XMR-2026-01'
};

export function ThreatDetection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useApp();
  const { addNotification } = useNotifications();
  const { isConnected, signer, chainId, connect } = useWallet();

  // Input state
  const [sampleType, setSampleType] = useState('cryptojacking'); // 'normal' | 'cryptojacking' | 'custom'
  const [telemetry, setTelemetry] = useState(CRYPTOJACKING_SAMPLE);
  const [rawJson, setRawJson] = useState(JSON.stringify(CRYPTOJACKING_SAMPLE, null, 2));
  const [jsonError, setJsonError] = useState(null);

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [showComparison, setShowComparison] = useState(false);

  // Transaction Modal state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalStatus, setTxModalStatus] = useState('idle');
  const [txModalError, setTxModalError] = useState(null);

  // Workflow actions state
  const [createdIncident, setCreatedIncident] = useState(null);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [recordingOnChain, setRecordingOnChain] = useState(false);
  const [blockchainTx, setBlockchainTx] = useState(null);
  const [blockchainError, setBlockchainError] = useState(null);
  const [mitigationState, setMitigationState] = useState(null);
  const [mitigationTimestamp, setMitigationTimestamp] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Copy helpers
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  const isSepolia = chainId === 11155111;

  // Handle URL query parameter changes (e.g. ?sample=normal)
  useEffect(() => {
    const s = searchParams.get('sample');
    if (s === 'normal') {
      handleLoadSample('normal');
    } else if (s === 'cryptojacking') {
      handleLoadSample('cryptojacking');
    }
  }, [searchParams]);

  // Handle preset loading
  const handleLoadSample = (type) => {
    setSampleType(type);
    setJsonError(null);
    setResult(null);
    setCreatedIncident(null);
    setBlockchainTx(null);
    setBlockchainError(null);
    setMitigationState(null);
    setVerificationResult(null);

    const data = type === 'normal' ? NORMAL_SAMPLE : CRYPTOJACKING_SAMPLE;
    setTelemetry({ ...data });
    setRawJson(JSON.stringify(data, null, 2));
  };

  // Handle JSON manual editing
  const handleJsonChange = (e) => {
    const val = e.target.value;
    setRawJson(val);
    setSampleType('custom');
    try {
      const parsed = JSON.parse(val);
      setTelemetry(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  // Run analysis pipeline
  const handleRunAnalysis = async () => {
    if (jsonError) {
      showToast('Please fix JSON syntax before running analysis', 'warning');
      return;
    }

    setAnalyzing(true);
    setResult(null);
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
      setResult(res.data);

      showToast(
        res.data.suspicious
          ? `Analysis complete: High risk cryptojacking workload detected (${res.data.risk_score?.severity})`
          : `Analysis complete: Workload verified within normal limits (LOW)`,
        res.data.suspicious ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('Detection analysis failed:', err);
      showToast('Detection pipeline error: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  // Step 1: Create Incident & Deterministic Hash
  const handleCreateIncident = async () => {
    if (!result) return;
    setCreatingIncident(true);
    try {
      const payload = {
        ...telemetry,
        cpu_usage: parseFloat(telemetry.cpu_usage),
        memory_usage: parseFloat(telemetry.memory_usage),
        process_runtime_seconds: parseInt(telemetry.process_runtime_seconds),
        threat_intel_ref: telemetry.threat_intel_ref || (sampleType === 'cryptojacking' ? 'TI-XMR-001' : '')
      };

      const res = await incidentsApi.create(payload);
      const inc = res.data;
      setCreatedIncident(inc);

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

      showToast(`Incident ${inc.incident_id} registered and hashed`, 'success');
    } catch (err) {
      console.error('Failed to create incident:', err);
      showToast('Incident generation failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setCreatingIncident(false);
    }
  };

  // Step 2: Record on Blockchain via MetaMask
  const handleRecordOnChain = async () => {
    if (!createdIncident) {
      showToast('Please generate incident record before blockchain recording', 'warning');
      return;
    }

    if (!isConnected || !signer) {
      try {
        await connect();
      } catch (e) {
        showToast('Please connect your MetaMask wallet to record on blockchain', 'warning');
        return;
      }
    }

    setRecordingOnChain(true);
    setBlockchainError(null);
    setTxModalOpen(true);
    setTxModalStatus('approving');
    setTxModalError(null);

    try {
      const externalId = createdIncident.incident_id;
      const evidenceHash = createdIncident.evidence_hash;
      const severity = createdIncident.risk_score?.severity || createdIncident.evidence?.severity || 'HIGH';
      const threatIntelRef = createdIncident.evidence?.threat_intel_ref || 'TI-XMR-2026-01';

      showToast('Please approve the transaction in MetaMask...', 'info');

      setTxModalStatus('confirming');

      const receipt = await contractService.recordIncidentOnChain(
        signer,
        externalId,
        evidenceHash,
        severity,
        threatIntelRef
      );

      // Persist to backend SQLite
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
      setTxModalStatus('confirmed');
      addNotification({
        title: 'Incident Anchored on Blockchain',
        message: `Tx ${receipt.txHash.slice(0, 16)}... confirmed in block #${receipt.blockNumber}`,
        type: 'success'
      });
      showToast('Incident anchored on blockchain successfully!', 'success');
    } catch (err) {
      console.error('Blockchain recording failed:', err);
      let userMsg = err.message || 'Transaction failed';
      if (err.code === 4001 || err.action === 'sendTransaction') {
        userMsg = 'Transaction rejected in MetaMask';
      } else if (err.code === 'INSUFFICIENT_FUNDS') {
        userMsg = 'Insufficient testnet ETH for gas';
      }
      setBlockchainError(userMsg);
      setTxModalStatus('error');
      setTxModalError(userMsg);
      showToast(userMsg, 'error');
    } finally {
      setRecordingOnChain(false);
    }
  };

  // Step 3: Verify Integrity
  const handleVerifyIntegrity = async () => {
    if (!createdIncident) return;
    setVerifying(true);
    setVerificationResult(null);

    try {
      const res = await incidentsApi.verify(createdIncident.incident_id);
      setVerificationResult(res.data);
      showToast(
        res.data.verification_result === 'VERIFIED'
          ? 'Evidence verified! Local hash matches on-chain record.'
          : 'Verification result: ' + res.data.verification_result,
        res.data.verification_result === 'VERIFIED' ? 'success' : 'warning'
      );
    } catch (err) {
      showToast('Verification failed: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setVerifying(false);
    }
  };

  // Step 4: Simulate Response
  const handleSimulateResponse = async () => {
    if (!createdIncident) return;
    const now = new Date();
    setMitigationState('ISOLATED_SIMULATED');
    setMitigationTimestamp(now.toLocaleTimeString());

    try {
      await incidentsApi.addNote(
        createdIncident.incident_id,
        `[SIMULATED CONTAINMENT] CFS CPU quota throttled to 10% and process '${telemetry.process_name}' isolated. Non-destructive academic simulation; host processes were not terminated.`,
        'BlockMineGuard Response Engine (Simulated)'
      );
      showToast('Simulated process containment recorded to audit log', 'success');
    } catch (e) {
      console.warn('Failed to append simulation note:', e);
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

  const score = result?.risk_score?.score ?? 0;
  const severity = result?.risk_score?.severity ?? 'LOW';

  return (
    <div className="threat-detection-page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Threat Analysis Workspace</h1>
            <span className="badge badge-info">
              Detection Engine v2.4
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            Multi-stage workload inspection, explainable heuristic risk scoring, and zero-trust blockchain evidence attestation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${showComparison ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowComparison(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Toggle side-by-side comparison of benign vs cryptojacking workloads"
          >
            <GitCompare size={14} />
            {showComparison ? 'Hide Comparison' : 'Side-by-Side Comparison'}
          </button>
          <Link to="/incidents" className="btn btn-outline btn-sm">
            Incident Database
          </Link>
          <Link to="/verify" className="btn btn-outline btn-sm">
            Verification Center
          </Link>
        </div>
      </div>

      {/* Side-by-Side Comparison Panel */}
      {showComparison && (
        <div className="card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitCompare size={18} style={{ color: 'var(--primary)' }} />
              <div>
                <span className="card-title">Side-by-Side Telemetry Comparison</span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Contrasting baseline benign workload against cryptojacking intrusion
                </p>
              </div>
            </div>
            <span className="badge badge-info">Evaluation Diff</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Benign Baseline */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius)', background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.875rem' }}>1. Benign Baseline (normal_workload.json)</span>
                  <span className="badge badge-success">Nominal</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8125rem' }}>
                  <div><strong>Process Name:</strong> <span className="mono">nginx-webserver</span></div>
                  <div><strong>CPU Usage:</strong> <span className="mono" style={{ color: 'var(--success)' }}>14.2% (Steady, idle web server)</span></div>
                  <div><strong>Memory Footprint:</strong> <span className="mono">32.5%</span></div>
                  <div><strong>Network Target:</strong> <span className="mono">static.cdn.cloudflare.com:443 (HTTPS)</span></div>
                  <div><strong>Process Runtime:</strong> <span className="mono">86,400s (Continuous daemon)</span></div>
                  <div><strong>Risk Score:</strong> <span style={{ fontWeight: 700, color: 'var(--success)' }}>15 / 100 (LOW)</span></div>
                </div>
              </div>

              {/* Cryptojacking Attack */}
              <div style={{ padding: '14px', borderRadius: 'var(--radius)', background: 'var(--surface-elevated)', border: '1px solid var(--critical)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--critical)', fontSize: '0.875rem' }}>2. Cryptojacking Attack (cryptojacking_workload.json)</span>
                  <span className="badge badge-critical">Critical</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8125rem' }}>
                  <div><strong>Process Name:</strong> <span className="mono" style={{ color: 'var(--critical)' }}>xmrig-miner</span></div>
                  <div><strong>CPU Usage:</strong> <span className="mono" style={{ color: 'var(--critical)' }}>95.8% (Sustained all-core spike)</span></div>
                  <div><strong>Memory Footprint:</strong> <span className="mono">81.2%</span></div>
                  <div><strong>Network Target:</strong> <span className="mono" style={{ color: 'var(--critical)' }}>pool.supportxmr.com:3333 (Stratum Mining Protocol)</span></div>
                  <div><strong>Process Runtime:</strong> <span className="mono">7,200s (Bursty sustained load)</span></div>
                  <div><strong>Risk Score:</strong> <span style={{ fontWeight: 700, color: 'var(--critical)' }}>95 / 100 (CRITICAL)</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Left Column: Workload Ingest */}
        <div
          className="card"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Workload Telemetry Input</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Select a verified sample fixture or edit raw JSON telemetry
              </p>
            </div>
            <span className={`badge ${sampleType === 'normal' ? 'badge-success' : sampleType === 'cryptojacking' ? 'badge-critical' : 'badge-neutral'}`}>
              {sampleType === 'normal' ? 'Sample: normal_workload.json' : sampleType === 'cryptojacking' ? 'Sample: cryptojacking_workload.json' : 'Custom Workload'}
            </span>
          </div>

          <div className="card-body">
            {/* Sample Selector Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`btn btn-sm ${sampleType === 'normal' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => handleLoadSample('normal')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.78rem'
                }}
              >
                <Server size={14} />
                Load Normal Sample
              </button>

              <button
                type="button"
                className={`btn btn-sm ${sampleType === 'cryptojacking' ? 'btn-danger' : 'btn-outline'}`}
                onClick={() => handleLoadSample('cryptojacking')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.78rem'
                }}
              >
                <Zap size={14} />
                Load Cryptojacking Sample
              </button>
            </div>

            {/* Quick Metrics Preview */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                padding: '10px 12px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginBottom: '14px'
              }}
            >
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Process</span>
                <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {telemetry.process_name || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>CPU Load</span>
                <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: telemetry.cpu_usage > 80 ? 'var(--danger)' : 'var(--success)' }}>
                  {telemetry.cpu_usage}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Memory</span>
                <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {telemetry.memory_usage}%
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Runtime</span>
                <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {telemetry.process_runtime_seconds}s
                </span>
              </div>
            </div>

            {/* JSON Editor Preview */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Payload JSON Representation
                </label>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Editable
                </span>
              </div>
              <textarea
                className="input mono"
                rows={9}
                value={rawJson}
                onChange={handleJsonChange}
                style={{
                  width: '100%',
                  fontSize: '0.76rem',
                  lineHeight: '1.5',
                  background: 'var(--bg-main)',
                  border: jsonError ? '1px solid var(--critical)' : '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)'
                }}
              />
              {jsonError && (
                <span style={{ color: '#f87171', fontSize: '0.7rem', marginTop: '4px', display: 'block' }}>
                  JSON Parse Error: {jsonError}
                </span>
              )}
            </div>

            {/* Execute Button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRunAnalysis}
              disabled={analyzing || Boolean(jsonError)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '0.88rem'
              }}
            >
              {analyzing ? (
                <>
                  <RefreshCw size={16} className="spin" /> Executing Flask Detection Pipeline...
                </>
              ) : (
                <>
                  <Play size={16} /> Run Threat Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Analysis Results & Actions */}
        <div
          className="card"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)'
          }}
        >
          <div className="card-header">
            <div>
              <div className="card-title">Analysis Results</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Evaluated by heuristic and multi-factor rule engine
              </p>
            </div>
            {result && (
              <span
                className={`badge ${result.suspicious ? 'badge-critical' : 'badge-low'}`}
                style={{ fontSize: '0.72rem', fontWeight: 700 }}
              >
                {result.suspicious ? 'CRYPTOJACKING SUSPICION' : 'BENIGN WORKLOAD'}
              </span>
            )}
          </div>

          <div className="card-body">
            {!result ? (
              /* Purposeful Empty State */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '340px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  padding: '32px 16px'
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--radius)',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                    marginBottom: '14px'
                  }}
                >
                  <Cpu size={22} />
                </div>
                <h3 style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '6px' }}>
                  No Active Analysis
                </h3>
                <p style={{ fontSize: '0.8rem', maxWidth: '340px', lineHeight: 1.5, margin: 0 }}>
                  Select either the <strong>Normal</strong> or <strong>Cryptojacking</strong> sample on the left, then click <strong>Run Threat Analysis</strong> to trigger the detection engine.
                </p>
              </div>
            ) : (
              <div>
                {/* Score Gauge & Overview */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '14px',
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    marginBottom: '16px'
                  }}
                >
                  {/* Gauge */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: result.suspicious ? 'rgba(248, 81, 73, 0.1)' : 'rgba(63, 185, 80, 0.1)',
                      border: `2px solid ${result.suspicious ? 'var(--danger)' : 'var(--success)'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <span
                      style={{
                        fontSize: '1.35rem',
                        fontWeight: 700,
                        color: result.suspicious ? 'var(--danger)' : 'var(--success)',
                        lineHeight: 1
                      }}
                    >
                      {score}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      / 100
                    </span>
                  </div>

                  {/* Summary */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Calculated Severity:</span>
                      <strong style={{ fontSize: '0.85rem', color: result.suspicious ? 'var(--danger)' : 'var(--success)' }}>
                        {severity}
                      </strong>
                    </div>

                    {/* Horizontal Meter */}
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', margin: '6px 0' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.max(5, score))}%`,
                          background: result.suspicious ? 'var(--danger)' : 'var(--success)',
                          transition: 'width 0.25s ease'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      <span>0-40 Nominal</span>
                      <span>40-70 Elevated</span>
                      <span>70-100 Critical</span>
                    </div>
                  </div>
                </div>

                {/* Detector Indicators & Contributing Factors */}
                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Detection Engine Findings
                  </span>
                  <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '0.78125rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {result.risk_score?.reasons && result.risk_score.reasons.length > 0 ? (
                      result.risk_score.reasons.map((r, i) => <li key={i}>{r}</li>)
                    ) : (
                      <li>No malicious indicators identified. Telemetry operates within nominal system thresholds.</li>
                    )}
                  </ul>
                </div>

                {/* Recommended Response Notice */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    background: result.suspicious ? 'rgba(248, 81, 73, 0.08)' : 'rgba(63, 185, 80, 0.08)',
                    border: `1px solid ${result.suspicious ? 'rgba(248, 81, 73, 0.25)' : 'rgba(63, 185, 80, 0.25)'}`,
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: result.suspicious ? 'var(--danger)' : 'var(--success)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Recommended Action:
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78125rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                    {result.suspicious
                      ? 'High-confidence cryptojacking pattern detected. Recommend immediate process containment and on-chain evidence attestation to preserve tamper-evident audit trail.'
                      : 'Standard operational workload. No defensive containment required; maintain continuous background telemetry collection.'}
                  </p>
                </div>

                {/* Ordered Workflow Actions */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                      Attestation & Mitigation Workflow
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Target: {isSepolia ? 'Sepolia (11155111)' : 'Local Hardhat (31337)'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {/* Action 1: Create Incident */}
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleCreateIncident}
                      disabled={creatingIncident || Boolean(createdIncident)}
                      style={{ fontSize: '0.76rem' }}
                    >
                      {creatingIncident ? <RefreshCw size={13} className="spin" /> : <FileCode size={13} />}
                      {createdIncident ? `Created: ${createdIncident.incident_id}` : '1. Generate Incident & Hash'}
                    </button>

                    {/* Action 2: Record on Blockchain */}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleRecordOnChain}
                      disabled={!createdIncident || recordingOnChain || Boolean(blockchainTx)}
                      style={{ fontSize: '0.76rem' }}
                    >
                      {recordingOnChain ? (
                        <>
                          <RefreshCw size={13} className="spin" /> Confirming...
                        </>
                      ) : blockchainTx ? (
                        <>
                          <CheckCircle2 size={13} /> On-Chain Anchored
                        </>
                      ) : (
                        <>
                          <Lock size={13} /> 2. Record on {isSepolia ? 'Sepolia' : 'Chain'}
                        </>
                      )}
                    </button>

                    {/* Action 3: Verify Integrity */}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleVerifyIntegrity}
                      disabled={!createdIncident || verifying}
                      style={{ fontSize: '0.76rem' }}
                    >
                      {verifying ? <RefreshCw size={13} className="spin" /> : <ShieldCheck size={13} />}
                      3. Verify Integrity
                    </button>

                    {/* Action 4: Simulate Response */}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={handleSimulateResponse}
                      disabled={!createdIncident || Boolean(mitigationState)}
                      style={{ fontSize: '0.76rem' }}
                    >
                      <ShieldAlert size={13} />
                      {mitigationState ? '● Contained (Sim)' : '4. Simulate Isolation'}
                    </button>
                  </div>

                  {/* Transaction & Verification Feedback Panel */}
                  {(createdIncident || blockchainTx || verificationResult) && (
                    <div
                      style={{
                        marginTop: '14px',
                        padding: '12px',
                        background: 'var(--surface-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.72rem'
                      }}
                    >
                      {createdIncident && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>SHA-256 Digest:</span>
                          <span className="mono" style={{ color: 'var(--primary)' }}>
                            {createdIncident.evidence_hash.slice(0, 16)}...
                            <button
                              type="button"
                              onClick={() => copyToClipboard(createdIncident.evidence_hash, 'hash')}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 6 }}
                              title="Copy full evidence hash"
                            >
                              {copiedHash ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                            </button>
                          </span>
                        </div>
                      )}

                      {blockchainTx && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Block #{blockchainTx.blockNumber}:</span>
                          <span className="mono" style={{ color: 'var(--accent-blockchain)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {blockchainTx.txHash.slice(0, 14)}...
                            {blockchainTx.explorerUrl && (
                              <a
                                href={blockchainTx.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: 'var(--accent-blockchain)' }}
                                title="Open in Sepolia Etherscan"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </span>
                        </div>
                      )}

                      {verificationResult && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Attestation:</span>
                          <span style={{ color: verificationResult.verification_result === 'VERIFIED' ? 'var(--success)' : 'var(--critical)', fontWeight: 600 }}>
                            {verificationResult.verification_result}
                          </span>
                        </div>
                      )}

                      {createdIncident && (
                        <div style={{ marginTop: '8px', textAlign: 'right' }}>
                          <Link
                            to={`/incidents/${createdIncident.incident_id}`}
                            style={{ color: 'var(--primary)', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            Open Detailed Incident Record <ArrowRight size={12} />
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step-by-Step Blockchain Transaction Progress Modal */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        status={txModalStatus}
        txHash={blockchainTx?.txHash}
        blockNumber={blockchainTx?.blockNumber}
        contractAddress={blockchainTx?.contractAddress}
        chainId={chainId || 31337}
        errorMessage={txModalError}
        incidentId={createdIncident?.incident_id}
        onRetry={handleRecordOnChain}
      />
    </div>
  );
}

export default ThreatDetection;
