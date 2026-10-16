import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { incidentsApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertTriangle,
  Clock,
  Hash,
  User,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

const severityColors = { CRITICAL: 'badge-high', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
const verificationColors = { VERIFIED: 'badge-verified', TAMPERED: 'badge-tampered', UNVERIFIED: 'badge-unverified' };
const resolutionColors = { OPEN: 'badge-open', IN_PROGRESS: 'badge-in-progress', RESOLVED: 'badge-resolved', FALSE_POSITIVE: 'badge-false-positive' };

export function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();
  const { isConnected, signer } = useWallet();
  const [incident, setIncident] = useState(null);
  const [blockchainData, setBlockchainData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [verifyEvidence, setVerifyEvidence] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadIncident();
  }, [id]);

  const loadIncident = async () => {
    try {
      setLoading(true);
      const response = await incidentsApi.getById(id);
      setIncident(response.data.incident);
      setBlockchainData(response.data.blockchain);
      setNotes(response.data.notes || []);
    } catch (error) {
      showToast('Failed to load incident', 'error');
      navigate('/incidents');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setAddingNote(true);
      await incidentsApi.addNote(id, newNote.trim(), 'Security Analyst');
      showToast('Investigation note logged', 'success');
      setNewNote('');
      loadIncident();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddingNote(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (!verifyEvidence.trim()) {
      showToast('Please paste the evidence JSON to verify', 'warning');
      return;
    }

    try {
      setVerifying(true);
      const evidence = JSON.parse(verifyEvidence);
      const response = await incidentsApi.verify(id, evidence);
      setVerifyResult(response.data);
      showToast(response.data.verification_result === 'VERIFIED' ? 'Evidence verified successfully' : 'TAMPER DETECTED - Evidence does not match', response.data.verification_result === 'VERIFIED' ? 'success' : 'error');
      loadIncident();
    } catch (error) {
      if (error instanceof SyntaxError) {
        showToast('Invalid JSON format', 'error');
      } else {
        showToast(error.message, 'error');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResolve = async (resolution) => {
    try {
      setResolving(true);
      await incidentsApi.resolve(id, resolution);
      showToast(`Incident marked as ${resolution}`, 'success');
      loadIncident();
    } catch (error) {
      showToast(error.response?.data?.error || error.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div className="spinner" style={{ width: 48, height: 48 }} />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">⚠️</div>
        <p>Incident not found</p>
        <Link to="/incidents" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Incidents
        </Link>
      </div>
    );
  }

  const details = [
    { label: 'Incident ID', value: incident.incident_id, mono: true },
    { label: 'External ID', value: incident.external_id, mono: true },
    { label: 'Risk Score', value: `${incident.risk_score}/100` },
    { label: 'Severity', value: incident.severity, badge: severityColors[incident.severity] },
    { label: 'Timestamp', value: new Date(incident.timestamp).toLocaleString() },
    { label: 'Process Name', value: incident.process_name, mono: true },
    { label: 'CPU Usage', value: `${incident.cpu_usage}%` },
    { label: 'Memory Usage', value: `${incident.memory_usage}%` },
    { label: 'Process Runtime', value: `${Math.floor(incident.process_runtime_seconds / 60)} minutes (${incident.process_runtime_seconds}s)` },
    { label: 'Network Destination', value: incident.network_destination || 'N/A', mono: true },
    { label: 'Container Name', value: incident.container_name || 'N/A', mono: true },
    { label: 'Environment', value: incident.environment },
    { label: 'Evidence Hash', value: incident.evidence_hash, mono: true, copyable: true },
    { label: 'Reporter', value: incident.reporter_address || 'N/A', mono: true },
    { label: 'Blockchain TX', value: incident.blockchain_tx_hash || 'N/A', mono: true, copyable: true },
    { label: 'Verification Status', value: incident.verification_status, badge: verificationColors[incident.verification_status] },
    { label: 'Resolution Status', value: incident.resolution_status.replace('_', ' '), badge: resolutionColors[incident.resolution_status] },
    { label: 'Threat Intel Ref', value: incident.threat_intel_ref || 'N/A', mono: true },
  ];

  return (
    <div className="incident-detail">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={() => navigate('/incidents')}>
            <ArrowLeft size={18} />
            Back
          </button>
          <div>
            <h1 className="page-title">Incident Details</h1>
            <p className="page-subtitle">{incident.incident_id}</p>
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={handlePrint}>
          Print Incident Report
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <Card>
          <div className="card-header">
            <span className="card-title">Summary</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              {details.slice(0, 8).map((detail, idx) => (
                <DetailItem key={idx} {...detail} onCopy={copyToClipboard} copied={copied} />
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <span className="card-title">Blockchain & Verification</span>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              {details.slice(8).map((detail, idx) => (
                <DetailItem key={idx} {...detail} onCopy={copyToClipboard} copied={copied} />
              ))}
            </div>

            {blockchainData && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>On-Chain Data</h4>
                <div className="detail-grid">
                  <DetailItem label="Blockchain Incident ID" value={blockchainData.incident_id} mono={true} />
                  <DetailItem label="On-Chain Hash" value={blockchainData.evidence_hash} mono={true} copyable={true} />
                  <DetailItem label="Reporter" value={blockchainData.reporter} mono={true} copyable={true} />
                  <DetailItem label="On-Chain Severity" value={['LOW', 'MEDIUM', 'HIGH'][blockchainData.severity]} badge={severityColors[['LOW', 'MEDIUM', 'HIGH'][blockchainData.severity]]} />
                  <DetailItem label="Verification" value={['UNVERIFIED', 'VERIFIED', 'TAMPERED'][blockchainData.verification_status]} badge={verificationColors[['UNVERIFIED', 'VERIFIED', 'TAMPERED'][blockchainData.verification_status]]} />
                  <DetailItem label="Resolution" value={['OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE'][blockchainData.resolution_status]} badge={resolutionColors[['OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE'][blockchainData.resolution_status]]} />
                  <DetailItem label="Timestamp" value={new Date(Number(blockchainData.timestamp) * 1000).toLocaleString()} />
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-header">
          <span className="card-title">Evidence Verification</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Paste the original incident evidence JSON to verify its integrity against the blockchain record.
          </p>

          <FormGroup label="Evidence JSON">
            <textarea
              className="input"
              style={{ minHeight: '200px', fontFamily: 'monospace', fontSize: '0.75rem', resize: 'vertical' }}
              value={verifyEvidence}
              onChange={e => setVerifyEvidence(e.target.value)}
              placeholder='{"incidentId": "INC-...", "timestamp": "...", "cpuUsage": 94, ...}'
            />
          </FormGroup>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleVerify}
              disabled={verifying || !verifyEvidence.trim()}
            >
              {verifying ? <Loader2 size={18} className="spin" /> : <>Verify <Shield size={16} /></>}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => {
                if (incident) {
                  const evidence = {
                    incidentId: incident.incident_id,
                    timestamp: incident.timestamp,
                    cpuUsage: incident.cpu_usage,
                    memoryUsage: incident.memory_usage,
                    processName: incident.process_name,
                    processRuntimeSeconds: incident.process_runtime_seconds,
                    networkDestination: incident.network_destination,
                    containerName: incident.container_name,
                    environment: incident.environment,
                    riskScore: incident.risk_score,
                    severity: incident.severity,
                    factors: JSON.parse(incident.factors || '{}'),
                  };
                  setVerifyEvidence(JSON.stringify(evidence, null, 2));
                }
              }}
            >
              Load Current Evidence
            </button>
          </div>

          {verifyResult && (
            <div className={`alert alert-${verifyResult.verification_result === 'VERIFIED' ? 'success' : 'danger'}`} style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {verifyResult.verification_result === 'VERIFIED' ? (
                  <CheckCircle size={24} style={{ color: 'var(--success)' }} />
                ) : (
                  <AlertTriangle size={24} style={{ color: 'var(--danger)' }} />
                )}
                <div>
                  <strong>{verifyResult.verification_result === 'VERIFIED' ? 'VERIFIED' : 'TAMPER DETECTED'}</strong>
                  <p style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    {verifyResult.verification_result === 'VERIFIED'
                      ? 'Evidence unchanged - hash matches blockchain record'
                      : 'Evidence does not match blockchain record - data has been modified'}
                  </p>
                  {verifyResult.evidence_match !== undefined && (
                    <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      Computed hash: {verifyResult.evidence_match ? 'matches' : 'does not match'} stored hash
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {incident.verification_status === 'VERIFIED' && incident.resolution_status !== 'RESOLVED' && (
        <Card>
          <div className="card-header">
            <span className="card-title">Resolve Incident</span>
          </div>
          <div className="card-body">
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Mark this verified incident as resolved or a false positive. This action will be recorded on-chain.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                onClick={() => handleResolve('RESOLVED')}
                disabled={resolving}
              >
                {resolving ? <Loader2 size={18} className="spin" /> : <>Mark Resolved <CheckCircle size={16} /></>}
              </button>
              <button
                className="btn btn-warning"
                onClick={() => handleResolve('FALSE_POSITIVE')}
                disabled={resolving}
              >
                {resolving ? <Loader2 size={18} className="spin" /> : <>False Positive <AlertTriangle size={16} /></>}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleResolve('IN_PROGRESS')}
                disabled={resolving}
              >
                {resolving ? <Loader2 size={18} className="spin" /> : <>In Progress <Clock size={16} /></>}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title">Investigation Notes & Logs ({notes.length})</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleAddNote} style={{ marginBottom: '1.5rem' }}>
            <FormGroup label="Add Investigation Note">
              <textarea
                className="input"
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Log observation, root cause analysis, or isolation steps..."
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
              />
            </FormGroup>
            <button type="submit" className="btn btn-primary btn-sm" disabled={addingNote || !newNote.trim()} style={{ marginTop: '0.5rem' }}>
              {addingNote ? 'Saving...' : 'Add Note'}
            </button>
          </form>

          {notes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No investigation notes logged yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notes.map(n => (
                <div key={n.id || n.created_at} style={{ padding: '0.75rem 1rem', background: 'var(--background)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{n.author}</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem' }}>{n.note}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Card({ children }) {
  return <div className="card">{children}</div>;
}

function FormGroup({ label, children }) {
  return (
    <div className="form-group">
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function DetailItem({ label, value, mono = false, badge, copyable = false, onCopy, copied }) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>
      <div className={`detail-value ${mono ? 'mono' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        {badge ? <span className={`badge ${badge}`}>{value}</span> : <span>{value}</span>}
        {copyable && value !== 'N/A' && (
          <button
            className="btn btn-outline btn-sm"
            style={{ padding: '0.25rem', height: 'auto' }}
            onClick={() => onCopy(value)}
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}