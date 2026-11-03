import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { incidentsApi, researchApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import { getContractAddress, getExplorerUrl, recordIncidentOnChain } from '../services/contractService';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  Hash,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Database,
  FileCheck,
  Lock,
  Zap,
  Printer,
  Download,
  FileText
} from 'lucide-react';

const severityBadgeClass = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

const verificationBadgeClass = {
  VERIFIED: 'badge-verified',
  TAMPERED: 'badge-tampered',
  UNVERIFIED: 'badge-unverified',
};

const resolutionBadgeClass = {
  OPEN: 'badge-open',
  IN_PROGRESS: 'badge-in-progress',
  RESOLVED: 'badge-resolved',
  FALSE_POSITIVE: 'badge-false-positive',
};

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const { chainId, isConnected, signer, account, connect } = useWallet();

  const [incident, setIncident] = useState(null);
  const [blockchainData, setBlockchainData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [simulatingResponse, setSimulatingResponse] = useState(false);
  const [simulatedResponseResult, setSimulatedResponseResult] = useState(null);
  const [verifyEvidence, setVerifyEvidence] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const activeChainId = chainId || 31337;
  const contractAddress = getContractAddress(activeChainId);

  useEffect(() => {
    loadIncident();
  }, [id]);

  const loadIncident = async () => {
    try {
      setLoading(true);
      const response = await incidentsApi.getById(id);
      const inc = response.data.incident;
      setIncident(inc);
      setBlockchainData(response.data.blockchain);
      setNotes(response.data.notes || []);

      // Pre-fill verify evidence with current canonical payload
      if (inc) {
        const canonical = {
          incidentId: inc.incident_id,
          timestamp: inc.timestamp,
          cpuUsage: inc.cpu_usage,
          memoryUsage: inc.memory_usage,
          processName: inc.process_name,
          processRuntimeSeconds: inc.process_runtime_seconds,
          networkDestination: inc.network_destination || '',
          containerName: inc.container_name || '',
          environment: inc.environment || 'HOST',
          riskScore: inc.risk_score,
          severity: inc.severity,
          factors: typeof inc.factors === 'string' ? JSON.parse(inc.factors || '{}') : (inc.factors || {})
        };
        setVerifyEvidence(JSON.stringify(canonical, null, 2));
      }
    } catch (error) {
      showToast('Failed to load incident details: ' + error.message, 'error');
      navigate('/incidents');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleVerify = async (tampered = false) => {
    try {
      setVerifying(true);
      let payload;
      if (tampered) {
        // Tamper simulation: deliberately alter CPU usage
        payload = {
          incidentId: incident.incident_id,
          timestamp: incident.timestamp,
          cpuUsage: 12.0, // Modified from high load to low
          memoryUsage: incident.memory_usage,
          processName: incident.process_name,
          processRuntimeSeconds: incident.process_runtime_seconds,
          networkDestination: incident.network_destination,
          containerName: incident.container_name,
          environment: incident.environment,
          riskScore: 10,
          severity: 'LOW',
          factors: {}
        };
        setVerifyEvidence(JSON.stringify(payload, null, 2));
      } else {
        if (!verifyEvidence.trim()) {
          showToast('Evidence JSON is required for verification', 'warning');
          return;
        }
        payload = JSON.parse(verifyEvidence);
      }

      const response = await incidentsApi.verify(id, payload);
      setVerifyResult(response.data);

      if (response.data.verification_result === 'VERIFIED') {
        showToast('Integrity verified: Evidence hash perfectly matches on-chain anchor!', 'success');
      } else {
        showToast('TAMPER DETECTED: Computed hash deviates from blockchain record!', 'error');
      }
      await loadIncident();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegisterOnChain = async () => {
    if (!incident) return;
    let activeSigner = signer;
    if (!isConnected || !activeSigner) {
      showToast('Connecting wallet for on-chain anchoring...', 'info');
      try {
        const walletRes = await connect();
        activeSigner = walletRes?.signer;
      } catch (err) {
        showToast(err.message || 'Please connect your MetaMask wallet to anchor this incident.', 'warning');
        return;
      }
    }

    try {
      setRegistering(true);
      showToast('Please approve the registration transaction in MetaMask...', 'info');

      const evidenceHash = incident.evidence_hash;
      const externalId = incident.incident_id;
      const severity = incident.severity || 'HIGH';
      const threatIntelRef = incident.threat_intel_ref || '';

      const receipt = await recordIncidentOnChain(
        activeSigner,
        externalId,
        evidenceHash,
        severity,
        threatIntelRef
      );

      // Persist to backend database
      try {
        await incidentsApi.updateBlockchain(incident.incident_id, {
          tx_hash: receipt.txHash,
          blockchain_incident_id: receipt.incidentId,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed,
          contract_address: receipt.contractAddress,
          chain_id: receipt.chainId,
          reporter_address: account
        });
      } catch (backendErr) {
        console.warn('Backend SQLite sync notice:', backendErr);
      }

      showToast(
        receipt.alreadyRegistered
          ? `Record was already registered on-chain at index #${receipt.incidentId}`
          : `Incident registered on-chain in block #${receipt.blockNumber}!`,
        'success'
      );
      await loadIncident();
    } catch (err) {
      console.error('On-chain registration failed:', err);
      let msg = err.message || 'Transaction failed';
      if (err.code === 4001 || err.action === 'sendTransaction') {
        msg = 'Transaction rejected in MetaMask';
      }
      showToast(msg, 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleSimulateResponse = async () => {
    try {
      setSimulatingResponse(true);
      const payload = {
        incident_id: incident.incident_id,
        action: incident.container_name ? 'CONTAINER_ISOLATE' : 'PROCESS_KILL',
        target: incident.container_name || incident.process_name,
        environment: incident.environment
      };
      const res = await researchApi.simulateResponse(payload);
      setSimulatedResponseResult(res.data);
      showToast(`Response simulated: ${payload.action} executed with zero latency`, 'success');
    } catch (err) {
      // Fallback local simulation if backend researchApi is optional
      setSimulatedResponseResult({
        status: 'SUCCESS',
        action: incident.container_name ? 'CONTAINER_QUARANTINE' : 'SIGTERM_PROCESS',
        target: incident.container_name || incident.process_name,
        timestamp: new Date().toISOString(),
        details: 'Simulated container network isolation and memory freeze.'
      });
      showToast('Simulated mitigation response logged successfully', 'success');
    } finally {
      setSimulatingResponse(false);
    }
  };

  const handleResolve = async (resolution) => {
    try {
      setResolving(true);
      await incidentsApi.resolve(id, resolution, `Resolution updated by SOC Analyst`);
      showToast(`Incident status updated to ${resolution}`, 'success');
      await loadIncident();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setAddingNote(true);
      await incidentsApi.addNote(id, newNote.trim(), 'SOC Analyst');
      showToast('Investigation log entry appended', 'success');
      setNewNote('');
      await loadIncident();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handleExportJson = () => {
    if (!incident) return;

    let parsedFactors = {};
    try {
      parsedFactors = typeof incident.factors === 'string' ? JSON.parse(incident.factors || '{}') : (incident.factors || {});
    } catch (e) {
      parsedFactors = {};
    }

    const report = {
      report_type: 'BlockMineGuard Incident Forensic Dossier',
      exported_at: new Date().toISOString(),
      schema_version: 'bmg-evidence-v1.0',
      system_metadata: {
        product: 'BlockMineGuard Cryptojacking Detection Framework',
        detector_version: 'v1.2.0',
        scoring_config_version: 'v1.0',
        hashing_algorithm: 'SHA-256'
      },
      incident_identity: {
        incident_id: incident.incident_id,
        external_id: incident.external_id || null,
        ingested_at: incident.timestamp || null,
        created_at: incident.created_at || null
      },
      workload_source: {
        environment: incident.environment || 'HOST',
        process_name: incident.process_name || null,
        container_name: incident.container_name || null,
        network_destination: incident.network_destination || null
      },
      telemetry: {
        cpu_usage_pct: incident.cpu_usage !== undefined ? Number(incident.cpu_usage) : null,
        memory_usage_mb: incident.memory_usage !== undefined ? Number(incident.memory_usage) : null,
        process_runtime_seconds: incident.process_runtime_seconds !== undefined ? Number(incident.process_runtime_seconds) : null,
        environment: incident.environment || 'HOST'
      },
      detection_result: {
        risk_score: incident.risk_score !== undefined ? Number(incident.risk_score) : null,
        severity: incident.severity || null,
        contributing_factors: parsedFactors,
        is_suspicious: (incident.risk_score || 0) >= 35
      },
      evidence_integrity: {
        canonical_digest: incident.evidence_hash || null,
        hash_algorithm: 'SHA-256',
        schema_version: 'bmg-evidence-v1.0',
        verification_status: incident.verification_status || 'UNVERIFIED',
        latest_verification_outcome: verifyResult?.outcome || (incident.verification_status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED'),
        evidence_match: verifyResult?.evidence_match !== undefined ? verifyResult.evidence_match : (incident.verification_status === 'VERIFIED' ? true : null)
      },
      blockchain_anchoring: {
        registered_on_chain: Boolean(incident.blockchain_tx_hash || incident.blockchain_incident_id),
        chain_id: activeChainId,
        network_name: isSepolia ? 'Ethereum Sepolia Testnet' : 'Hardhat Localhost (Chain 31337)',
        contract_address: contractAddress || null,
        blockchain_incident_id: incident.blockchain_incident_id || null,
        transaction_hash: incident.blockchain_tx_hash || null,
        block_number: blockchainData?.block_number || null,
        explorer_url: explorerTxUrl || null
      },
      containment_response: {
        resolution_status: incident.resolution_status || 'OPEN',
        simulated: simulatedResponseResult ? true : false,
        recommended_action: simulatedResponseResult?.recommendation?.action || (incident.resolution_status === 'RESOLVED' ? 'KILL_PROCESS' : 'NONE'),
        threat_intel_ref: incident.threat_intel_ref || null
      },
      security_notice: 'Forensic evidence export strictly excludes private keys, mnemonic seeds, and confidential node credentials. Matching hashes verify record non-repudiation; they do not certify objective ground-truth of original host telemetry.'
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(report, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `BMG_Evidence_${incident.incident_id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Forensic evidence JSON exported successfully', 'success');
  };

  const handleExportCsv = () => {
    if (!incident) return;

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'Incident_ID',
      'External_ID',
      'Ingested_At',
      'Environment',
      'Process_Name',
      'Container_Name',
      'Network_Destination',
      'CPU_Usage_Pct',
      'Memory_Usage_MB',
      'Runtime_Seconds',
      'Risk_Score',
      'Severity',
      'Canonical_Digest_SHA256',
      'Schema_Version',
      'Detector_Version',
      'Verification_Status',
      'Blockchain_Network',
      'Contract_Address',
      'Blockchain_Tx_Hash',
      'Block_Number',
      'Resolution_Status',
      'Simulated_Response'
    ];

    const row = [
      escapeCsv(incident.incident_id),
      escapeCsv(incident.external_id || ''),
      escapeCsv(incident.timestamp || ''),
      escapeCsv(incident.environment || 'HOST'),
      escapeCsv(incident.process_name || ''),
      escapeCsv(incident.container_name || ''),
      escapeCsv(incident.network_destination || ''),
      escapeCsv(incident.cpu_usage),
      escapeCsv(incident.memory_usage),
      escapeCsv(incident.process_runtime_seconds),
      escapeCsv(incident.risk_score),
      escapeCsv(incident.severity),
      escapeCsv(incident.evidence_hash),
      escapeCsv('bmg-evidence-v1.0'),
      escapeCsv('v1.2.0'),
      escapeCsv(incident.verification_status),
      escapeCsv(isSepolia ? 'Ethereum Sepolia' : 'Hardhat Localhost (31337)'),
      escapeCsv(contractAddress || ''),
      escapeCsv(incident.blockchain_tx_hash || ''),
      escapeCsv(blockchainData?.block_number || ''),
      escapeCsv(incident.resolution_status),
      escapeCsv(simulatedResponseResult ? 'SIMULATED' : 'NONE')
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), row.join(',')].join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `BMG_Incident_${incident.incident_id}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    showToast('Incident CSV audit summary exported successfully', 'success');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '450px', gap: '1rem' }}>
        <Loader2 size={36} className="spin" style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Loading cryptojacking incident records...</span>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: 'var(--warning)', margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Incident Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          The requested incident record does not exist or has been archived.
        </p>
        <Link to="/incidents" className="btn btn-primary">
          <ArrowLeft size={16} /> Back to Incidents
        </Link>
      </div>
    );
  }

  const txHash = incident.blockchain_tx_hash;
  const explorerTxUrl = txHash ? getExplorerUrl(activeChainId, txHash, 'tx') : null;
  const explorerContractUrl = contractAddress ? getExplorerUrl(activeChainId, contractAddress, 'address') : null;

  // Contributing factors parser
  let factorsObj = {};
  try {
    factorsObj = typeof incident.factors === 'string' ? JSON.parse(incident.factors || '{}') : (incident.factors || {});
  } catch (e) {
    factorsObj = {};
  }

  // Response Timeline States
  const timelineSteps = [
    {
      title: 'Workload Detected',
      desc: 'Telemetry ingested and classified by cryptojacking heuristic detector',
      status: 'confirmed',
      timestamp: incident.timestamp ? new Date(incident.timestamp).toLocaleString() : 'Recorded'
    },
    {
      title: 'Database Ledger Stored',
      desc: `Canonical SHA-256 evidence record persisted to SQLite with unique ID ${incident.incident_id}`,
      status: 'confirmed',
      timestamp: incident.created_at ? new Date(incident.created_at).toLocaleString() : 'Stored'
    },
    {
      title: 'Blockchain Broadcast',
      desc: incident.blockchain_tx_hash 
        ? `Transaction signed and submitted to ${activeChainId === 11155111 ? 'Ethereum Sepolia' : 'Hardhat Local'}`
        : 'Pending transaction submission to smart contract',
      status: incident.blockchain_tx_hash ? 'confirmed' : 'pending',
      timestamp: incident.blockchain_tx_hash ? 'Broadcasted' : 'Unsubmitted'
    },
    {
      title: 'On-Chain Anchor Confirmed',
      desc: blockchainData 
        ? `Recorded in ThreatRegistry.sol at index #${blockchainData.incident_id || '0'}` 
        : incident.blockchain_tx_hash 
          ? 'Transaction recorded on-chain' 
          : 'Awaiting ledger inclusion',
      status: (blockchainData || incident.blockchain_tx_hash) ? 'confirmed' : 'pending',
      timestamp: blockchainData?.timestamp ? new Date(Number(blockchainData.timestamp) * 1000).toLocaleString() : (incident.blockchain_tx_hash ? 'Confirmed' : 'Pending')
    },
    {
      title: 'Integrity Verification',
      desc: incident.verification_status === 'VERIFIED'
        ? 'Evidence hash verified identical against immutable smart contract anchor'
        : incident.verification_status === 'TAMPERED'
          ? 'CRITICAL MISMATCH: Cryptographic hash deviates from blockchain record'
          : 'Awaiting independent hash verification check',
      status: incident.verification_status === 'VERIFIED' ? 'verified' : incident.verification_status === 'TAMPERED' ? 'failed' : 'pending',
      timestamp: incident.verification_status
    },
    {
      title: 'Incident Containment / Response',
      desc: simulatedResponseResult 
        ? `${simulatedResponseResult.action} executed: ${simulatedResponseResult.target}`
        : incident.resolution_status === 'RESOLVED'
          ? 'Threat contained and marked resolved by SOC team'
          : 'Pending response authorization',
      status: (simulatedResponseResult || incident.resolution_status === 'RESOLVED') ? 'simulated' : 'pending',
      timestamp: simulatedResponseResult ? 'Simulated' : incident.resolution_status.replace('_', ' ')
    }
  ];

  return (
    <div className="incident-detail-page">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => navigate('/incidents')}
            style={{ marginBottom: '0.75rem' }}
          >
            <ArrowLeft size={14} /> Back to Incidents
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ fontSize: '1.5rem', margin: 0 }}>{incident.incident_id}</h1>
            <span className={`badge ${severityBadgeClass[incident.severity] || 'badge-neutral'}`}>
              {incident.severity}
            </span>
            <span className={`badge ${verificationBadgeClass[incident.verification_status] || 'badge-neutral'}`}>
              {incident.verification_status}
            </span>
            <span className={`badge ${resolutionBadgeClass[incident.resolution_status] || 'badge-neutral'}`}>
              {incident.resolution_status.replace('_', ' ')}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.375rem' }}>
            External ID: <span className="mono" style={{ color: 'var(--text-primary)' }}>{incident.external_id || 'N/A'}</span> • Ingested: {new Date(incident.timestamp).toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print Dossier
          </button>
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={handleExportJson}
            title="Export forensic evidence dossier as JSON"
          >
            <Download size={14} /> Export JSON
          </button>
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={handleExportCsv}
            title="Export incident audit summary as CSV"
          >
            <FileText size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleVerify(false)}
            disabled={verifying}
          >
            {verifying ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
            Verify Integrity
          </button>
          {(!incident.blockchain_tx_hash && !incident.blockchain_incident_id) && (
            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={handleRegisterOnChain}
              disabled={registering}
              title="Anchor incident SHA-256 evidence digest to Ethereum ThreatRegistry smart contract"
            >
              {registering ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
              {registering ? 'Anchoring...' : 'Register on Blockchain'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSimulateResponse}
            disabled={simulatingResponse}
          >
            {simulatingResponse ? <Loader2 size={14} className="spin" /> : <Zap size={14} />}
            Simulate Containment
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Left Column: Workload Telemetry & Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Card: Risk & Score Summary */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Detection Score & Metrics</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Scale: 0 - 100</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg-elevated)',
                  border: `3px solid ${incident.risk_score >= 70 ? 'var(--critical)' : incident.risk_score >= 40 ? 'var(--warning)' : 'var(--success)'}`,
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {incident.risk_score}
                  </span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '2px' }}>
                    Score
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Threat Classification</span>
                    <span style={{ fontWeight: 600, color: incident.risk_score >= 70 ? 'var(--critical)' : incident.risk_score >= 40 ? 'var(--warning)' : 'var(--success)' }}>
                      {incident.severity} SEVERITY
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${incident.risk_score}%`,
                      height: '100%',
                      background: incident.risk_score >= 70 ? 'var(--critical)' : incident.risk_score >= 40 ? 'var(--warning)' : 'var(--success)',
                      transition: 'width 0.4s ease'
                    }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {incident.risk_score >= 70 
                      ? 'Telemetry exhibits high-intensity cryptomining heuristics and mining pool network activity.'
                      : incident.risk_score >= 40
                        ? 'Moderate workload anomalies detected. Continuous observation recommended.'
                        : 'Workload parameters are within standard baseline thresholds.'}
                  </p>
                </div>
              </div>

              {/* Workload Spec Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'var(--bg-elevated)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Process Name</span>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {incident.process_name || 'unknown'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>CPU Load</span>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: incident.cpu_usage >= 80 ? 'var(--critical)' : 'var(--text-primary)', marginTop: '2px' }}>
                    {incident.cpu_usage}%
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Memory Footprint</span>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {incident.memory_usage}%
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Process Runtime</span>
                  <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {Math.floor(incident.process_runtime_seconds / 60)}m ({incident.process_runtime_seconds}s)
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Network Destination</span>
                  <div className="mono" style={{ fontSize: '0.8125rem', color: incident.network_destination ? 'var(--primary)' : 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                    {incident.network_destination || 'None'}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Environment / Container</span>
                  <div className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {incident.environment || 'HOST'} {incident.container_name ? `(${incident.container_name})` : ''}
                  </div>
                </div>
              </div>

              {/* Factors list if available */}
              {Object.keys(factorsObj).length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Contributing Risk Factors</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                    {Object.entries(factorsObj).map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.375rem 0.5rem', background: 'var(--bg-main)', borderRadius: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{key}</span>
                        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Response Simulation Banner if triggered */}
          {simulatedResponseResult && (
            <div className="card" style={{ borderLeft: '4px solid var(--accent-blockchain)' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-blockchain)' }}>
                  <Zap size={16} /> Automated Containment Action Executed
                </span>
                <span className="badge badge-blockchain">SIMULATED</span>
              </div>
              <div className="card-body" style={{ fontSize: '0.8125rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Action Type</span>
                    <div className="mono" style={{ fontWeight: 600 }}>{simulatedResponseResult.action}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Target Subject</span>
                    <div className="mono" style={{ fontWeight: 600 }}>{simulatedResponseResult.target}</div>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                  {simulatedResponseResult.details || 'Process execution suspended. Network isolation firewall rules applied.'}
                </p>
              </div>
            </div>
          )}

          {/* Card: Investigation Notes & Audit Log */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Investigation Notes ({notes.length})</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddNote} style={{ marginBottom: '1rem' }}>
                <textarea
                  className="input"
                  style={{ minHeight: '70px', resize: 'vertical', fontSize: '0.8125rem', marginBottom: '0.5rem' }}
                  placeholder="Record SOC analyst observation, remediation details, or root cause findings..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary btn-sm"
                  disabled={addingNote || !newNote.trim()}
                >
                  {addingNote ? <Loader2 size={14} className="spin" /> : 'Log Analyst Note'}
                </button>
              </form>

              {notes.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontStyle: 'italic' }}>
                  No investigation notes recorded for this incident yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {notes.map(n => (
                    <div key={n.id || n.created_at} style={{ padding: '0.625rem 0.75rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{n.author}</span>
                        <span>{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.8125rem', margin: 0 }}>{n.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Cryptographic Integrity & Response Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Card: Cryptographic Integrity Ledger */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={16} style={{ color: 'var(--accent-blockchain)' }} />
                Blockchain Integrity Anchor
              </span>
              <span className="badge badge-blockchain">
                {activeChainId === 11155111 ? 'SEPOLIA (11155111)' : 'HARDHAT (31337)'}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Canonical Incident Hash */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Canonical SHA-256 Hash</span>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ padding: '2px 6px', height: 'auto', fontSize: '0.6875rem' }}
                      onClick={() => copyToClipboard(incident.evidence_hash, 'hash')}
                    >
                      {copiedKey === 'hash' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      {copiedKey === 'hash' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', background: 'var(--bg-main)', padding: '0.5rem 0.625rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {incident.evidence_hash || 'None'}
                  </div>
                </div>

                {/* Blockchain Transaction Hash */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Blockchain Tx Hash</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {txHash && (
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 6px', height: 'auto', fontSize: '0.6875rem' }}
                          onClick={() => copyToClipboard(txHash, 'tx')}
                        >
                          {copiedKey === 'tx' ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                        </button>
                      )}
                      {explorerTxUrl && (
                        <a
                          href={explorerTxUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="btn btn-outline btn-sm"
                          style={{ padding: '2px 6px', height: 'auto', fontSize: '0.6875rem' }}
                        >
                          <ExternalLink size={12} /> Etherscan
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: '0.75rem', wordBreak: 'break-all', background: 'var(--bg-main)', padding: '0.5rem 0.625rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                    {txHash || 'Not yet anchored on-chain'}
                  </div>
                  {(!txHash && !incident.blockchain_incident_id) && (
                    <div style={{ background: 'rgba(210, 153, 34, 0.1)', border: '1px solid #9E6A03', borderRadius: '6px', padding: '10px 12px', marginTop: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D29922' }}>
                            Unanchored Record
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Commit SHA-256 evidence digest to smart contract.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-warning btn-sm"
                          onClick={handleRegisterOnChain}
                          disabled={registering}
                          style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          {registering ? <Loader2 size={12} className="spin" /> : <Lock size={12} />}
                          {registering ? 'Submitting...' : 'Register on Blockchain'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Smart Contract & Reporter */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Smart Contract</span>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent-blockchain)', marginTop: '2px', wordBreak: 'break-all' }}>
                      {contractAddress ? `${contractAddress.slice(0, 10)}...${contractAddress.slice(-8)}` : 'Not configured'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Reporter Address</span>
                    <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginTop: '2px', wordBreak: 'break-all' }}>
                      {incident.reporter_address ? `${incident.reporter_address.slice(0, 10)}...` : 'Automated Agent'}
                    </div>
                  </div>
                </div>

                {/* Blockchain Data details if available */}
                {blockchainData && (
                  <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>On-Chain Index</span>
                      <span className="mono" style={{ fontWeight: 600 }}>#{blockchainData.incident_id}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Contract Timestamp</span>
                      <span>{new Date(Number(blockchainData.timestamp) * 1000).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Verification State</span>
                      <span className={`badge ${verificationBadgeClass[['UNVERIFIED', 'VERIFIED', 'TAMPERED'][blockchainData.verification_status]] || 'badge-neutral'}`}>
                        {['UNVERIFIED', 'VERIFIED', 'TAMPERED'][blockchainData.verification_status]}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card: Response Timeline (Section 5 Requirement) */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Response Lifecycle Timeline</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Audit Trail</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
                {timelineSteps.map((step, idx) => {
                  const isDone = step.status === 'confirmed' || step.status === 'verified' || step.status === 'simulated';
                  const isFailed = step.status === 'failed';
                  const isPending = step.status === 'pending';

                  let dotColor = 'var(--text-secondary)';
                  if (isDone) dotColor = 'var(--success)';
                  if (isFailed) dotColor = 'var(--critical)';
                  if (step.status === 'simulated') dotColor = 'var(--accent-blockchain)';

                  return (
                    <div key={idx} style={{ display: 'flex', gap: '0.875rem', position: 'relative' }}>
                      {/* Vertical line connecting steps */}
                      {idx < timelineSteps.length - 1 && (
                        <div style={{
                          position: 'absolute',
                          top: '20px',
                          left: '9px',
                          width: '2px',
                          height: 'calc(100% + 4px)',
                          background: isDone ? 'rgba(52, 211, 153, 0.3)' : 'var(--border)'
                        }} />
                      )}

                      {/* Dot icon */}
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'var(--bg-main)',
                        border: `2px solid ${dotColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        zIndex: 2,
                        marginTop: '2px'
                      }}>
                        {isDone && <Check size={10} style={{ color: dotColor }} />}
                        {isFailed && <AlertTriangle size={10} style={{ color: dotColor }} />}
                        {isPending && <Clock size={10} style={{ color: dotColor }} />}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {step.title}
                          </span>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                            {step.timestamp}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card: Verification & Tamper Simulation Testing */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Integrity Verification Test Bench</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>ACADEMIC DEMO</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Demonstrate tamper-evidence by comparing the recorded on-chain SHA-256 hash against evidence payload.
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleVerify(false)}
                  disabled={verifying}
                >
                  {verifying ? <Loader2 size={14} className="spin" /> : <FileCheck size={14} />}
                  Verify Authentic Payload
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => handleVerify(true)}
                  disabled={verifying}
                  style={{ borderColor: 'var(--critical)', color: 'var(--critical)' }}
                >
                  <AlertTriangle size={14} /> Simulate Tamper Attack
                </button>
              </div>

              {verifyResult && (
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius)',
                  background: verifyResult.verification_result === 'VERIFIED' ? 'rgba(52, 211, 153, 0.08)' : 'rgba(248, 113, 113, 0.08)',
                  border: `1px solid ${verifyResult.verification_result === 'VERIFIED' ? 'var(--success)' : 'var(--critical)'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {verifyResult.verification_result === 'VERIFIED' ? (
                      <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <AlertTriangle size={16} style={{ color: 'var(--critical)' }} />
                    )}
                    <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: verifyResult.verification_result === 'VERIFIED' ? 'var(--success)' : 'var(--critical)' }}>
                      {verifyResult.verification_result === 'VERIFIED' ? 'VERIFIED: HASH MATCH' : 'TAMPER DETECTED: HASH MISMATCH'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {verifyResult.verification_result === 'VERIFIED'
                      ? 'Local canonical SHA-256 hash matches the immutable blockchain record exactly.'
                      : 'Computed hash differs from the anchored blockchain record. Data modification detected!'}
                  </p>
                </div>
              )}

              {/* Status Resolution Actions */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.875rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Update Case Resolution
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleResolve('RESOLVED')}
                    disabled={resolving || incident.resolution_status === 'RESOLVED'}
                    style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                  >
                    Mark Resolved
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleResolve('FALSE_POSITIVE')}
                    disabled={resolving || incident.resolution_status === 'FALSE_POSITIVE'}
                    style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
                  >
                    False Positive
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleResolve('IN_PROGRESS')}
                    disabled={resolving || incident.resolution_status === 'IN_PROGRESS'}
                  >
                    In Progress
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
export default IncidentDetail;