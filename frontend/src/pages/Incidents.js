import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { incidentsApi, detectionApi, reportsApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Copy,
  Check,
  Eye,
  Sliders,
  Zap,
  X,
  FileText,
  Send,
  AlertOctagon,
  Layers,
  ExternalLink
} from 'lucide-react';

const severityOptions = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const statusOptions = ['ALL', 'VERIFIED', 'TAMPERED', 'UNVERIFIED'];
const resolutionOptions = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE'];

const SIMULATION_PRESETS = [
  {
    name: 'XMRig Monero Burst',
    badge: 'CRITICAL',
    badgeColor: '#dc2626',
    data: {
      cpu_usage: 98.4,
      memory_usage: 88.0,
      process_name: 'xmrig',
      process_runtime_seconds: 14400,
      network_destination: 'pool.supportxmr.com:3333',
      container_name: '',
      environment: 'HOST',
      threat_intel_ref: 'TI-XMR-99'
    }
  },
  {
    name: 'Kinsing Redis Malware',
    badge: 'CRITICAL',
    badgeColor: '#dc2626',
    data: {
      cpu_usage: 99.1,
      memory_usage: 91.0,
      process_name: 'kinsing',
      process_runtime_seconds: 21600,
      network_destination: '194.38.20.12:443',
      container_name: 'redis-cache-pod',
      environment: 'CONTAINER',
      threat_intel_ref: 'TI-KINSING-01'
    }
  },
  {
    name: 'PyTorch Deep Learning',
    badge: 'BENIGN HIGH',
    badgeColor: '#38bdf8',
    data: {
      cpu_usage: 82.5,
      memory_usage: 76.0,
      process_name: 'python3_torch_train',
      process_runtime_seconds: 5400,
      network_destination: 's3.ml-models.internal:443',
      container_name: 'gpu-trainer-01',
      environment: 'CONTAINER',
      threat_intel_ref: ''
    }
  },
  {
    name: 'Clang C++ Release Build',
    badge: 'BENIGN LOAD',
    badgeColor: '#10b981',
    data: {
      cpu_usage: 78.0,
      memory_usage: 64.0,
      process_name: 'clang++_compiler',
      process_runtime_seconds: 3800,
      network_destination: '',
      container_name: 'ci-runner-04',
      environment: 'CONTAINER',
      threat_intel_ref: ''
    }
  },
  {
    name: 'Prometheus Node Baseline',
    badge: 'NOMINAL',
    badgeColor: '#64748b',
    data: {
      cpu_usage: 12.0,
      memory_usage: 24.0,
      process_name: 'node_exporter',
      process_runtime_seconds: 18000,
      network_destination: 'prometheus.monitoring:9100',
      container_name: '',
      environment: 'HOST',
      threat_intel_ref: ''
    }
  }
];

export function Incidents() {
  const { showToast } = useApp();
  const { account } = useWallet();
  const [searchParams, setSearchParams] = useSearchParams();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [filters, setFilters] = useState({
    severity: searchParams.get('severity') || 'ALL',
    verification: searchParams.get('verification') || 'ALL',
    resolution: searchParams.get('resolution') || 'ALL',
    search: searchParams.get('search') || '',
  });

  // Slide-over Quick Drawer State
  const [inspectIncident, setInspectIncident] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerNotes, setDrawerNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Batch Selection State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Simulation Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportForm, setReportForm] = useState({
    cpu_usage: 95.0,
    memory_usage: 82.0,
    process_name: 'xmrig',
    process_runtime_seconds: 7200,
    network_destination: 'pool.supportxmr.com:3333',
    container_name: '',
    environment: 'HOST',
    threat_intel_ref: '',
  });
  const [reporting, setReporting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [livePreviewScore, setLivePreviewScore] = useState(null);

  const loadIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        limit,
        offset: (page - 1) * limit,
      };
      if (filters.severity !== 'ALL') params.severity = filters.severity;
      if (filters.verification !== 'ALL') params.verification = filters.verification;
      if (filters.resolution !== 'ALL') params.resolution = filters.resolution;
      if (filters.search && filters.search.trim()) params.search = filters.search.trim();

      const response = await incidentsApi.getAll(params);
      setIncidents(response.data.incidents || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      showToast('Failed to load incidents', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, showToast]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  // Update query parameters in URL
  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      const newParams = {};
      if (updated.severity !== 'ALL') newParams.severity = updated.severity;
      if (updated.verification !== 'ALL') newParams.verification = updated.verification;
      if (updated.resolution !== 'ALL') newParams.resolution = updated.resolution;
      if (updated.search) newParams.search = updated.search;
      setSearchParams(newParams);
      return updated;
    });
    setPage(1);
    setSelectedIds(new Set());
  };

  // Quick Open Slide Drawer
  const openInspector = async (inc) => {
    setInspectIncident(inc);
    setDrawerLoading(true);
    setCopiedHash(false);
    try {
      const res = await incidentsApi.getById(inc.incident_id);
      setInspectIncident(res.data.incident);
      setDrawerNotes(res.data.notes || []);
    } catch (err) {
      console.error('Failed to load full incident details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // One-Click On-Chain Verification inside Drawer
  const handleDrawerVerify = async () => {
    if (!inspectIncident) return;
    setVerifyingId(inspectIncident.incident_id);
    try {
      const res = await incidentsApi.verify(inspectIncident.incident_id);
      showToast(`Incident verified on blockchain! Status: ${res.data.verification_result}`, 'success');
      setInspectIncident(prev => ({
        ...prev,
        verification_status: res.data.verification_result,
        blockchain_tx_hash: res.data.blockchain_tx?.tx_hash || prev.blockchain_tx_hash
      }));
      loadIncidents();
    } catch (err) {
      showToast('Verification failed: ' + (err.message || 'Error'), 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // One-Click Tamper Simulation Test
  const handleDrawerTamperTest = async () => {
    if (!inspectIncident) return;
    setVerifyingId(inspectIncident.incident_id);
    try {
      const tamperedEvidence = {
        incident_id: inspectIncident.incident_id,
        timestamp: inspectIncident.timestamp,
        cpu_usage: 12.0, // Modified CPU
        memory_usage: inspectIncident.memory_usage,
        process_name: inspectIncident.process_name,
        process_runtime_seconds: inspectIncident.process_runtime_seconds,
        network_destination: inspectIncident.network_destination,
        container_name: inspectIncident.container_name,
        environment: inspectIncident.environment,
        risk_score: 15,
        severity: 'LOW',
        factors: {}
      };

      const res = await incidentsApi.verify(inspectIncident.incident_id, tamperedEvidence);
      showToast(`Tamper detected! Status: ${res.data.verification_result} (Hash mismatch confirmed on contract)`, 'warning');
      setInspectIncident(prev => ({
        ...prev,
        verification_status: res.data.verification_result
      }));
      loadIncidents();
    } catch (err) {
      showToast('Tamper test error: ' + err.message, 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // Add SOC Note inside Drawer
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim() || !inspectIncident) return;
    setAddingNote(true);
    try {
      const author = account ? `${account.slice(0, 6)}... (Analyst)` : 'SOC Analyst (Active)';
      await incidentsApi.addNote(inspectIncident.incident_id, newNoteText.trim(), author);
      setDrawerNotes(prev => [
        {
          id: Date.now(),
          incident_id: inspectIncident.incident_id,
          author,
          note: newNoteText.trim(),
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
      setNewNoteText('');
      showToast('Investigation note recorded', 'success');
    } catch (err) {
      showToast('Failed to append note: ' + err.message, 'error');
    } finally {
      setAddingNote(false);
    }
  };

  // Quick Status Resolver
  const handleDrawerStatusChange = async (newStatus) => {
    if (!inspectIncident) return;
    try {
      await incidentsApi.resolve(inspectIncident.incident_id, newStatus);
      showToast(`Incident marked as ${newStatus}`, 'success');
      setInspectIncident(prev => ({ ...prev, resolution_status: newStatus }));
      loadIncidents();
    } catch (err) {
      showToast('Failed to update resolution: ' + err.message, 'error');
    }
  };

  // Copy Hash Helper
  const copyEvidenceHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
    showToast('Evidence hash copied to clipboard', 'info');
  };

  // Batch Selection Helpers
  const toggleSelectAll = () => {
    if (selectedIds.size === incidents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(incidents.map(i => i.incident_id)));
    }
  };

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Batch Verify
  const handleBatchVerify = async () => {
    if (selectedIds.size === 0) return;
    setBatchActionLoading(true);
    let count = 0;
    for (const id of selectedIds) {
      try {
        await incidentsApi.verify(id);
        count++;
      } catch (e) {
        console.error(`Batch verify failed for ${id}:`, e);
      }
    }
    setBatchActionLoading(false);
    showToast(`Successfully verified ${count} selected incidents on blockchain!`, 'success');
    setSelectedIds(new Set());
    loadIncidents();
  };

  // Batch Export JSON
  const handleBatchExport = () => {
    const selectedData = incidents.filter(i => selectedIds.has(i.incident_id));
    const blob = new Blob([JSON.stringify(selectedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blockmineguard_selected_${selectedIds.size}_incidents.json`;
    a.click();
    showToast(`Exported ${selectedIds.size} incidents to JSON`, 'info');
  };

  // Live Simulation Preset Applier
  const applyPreset = (preset) => {
    setReportForm(preset.data);
    triggerLivePreview(preset.data);
  };

  // Trigger live detection preview
  const triggerLivePreview = async (formData) => {
    try {
      setDetecting(true);
      const res = await detectionApi.detect({
        cpu_usage: parseFloat(formData.cpu_usage) || 0,
        memory_usage: parseFloat(formData.memory_usage) || 0,
        process_name: formData.process_name || '',
        process_runtime_seconds: parseInt(formData.process_runtime_seconds) || 0,
        network_destination: formData.network_destination || null,
        container_name: formData.container_name || null,
        environment: formData.environment,
      });
      setLivePreviewScore(res.data);
    } catch (err) {
      console.error('Live preview error:', err);
    } finally {
      setDetecting(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    try {
      setReporting(true);
      const data = {
        cpu_usage: parseFloat(reportForm.cpu_usage),
        memory_usage: parseFloat(reportForm.memory_usage),
        process_name: reportForm.process_name,
        process_runtime_seconds: parseInt(reportForm.process_runtime_seconds),
        network_destination: reportForm.network_destination || null,
        container_name: reportForm.container_name || null,
        environment: reportForm.environment,
        threat_intel_ref: reportForm.threat_intel_ref || '',
        reporter: account || null,
        threshold: 0
      };

      const res = await incidentsApi.create(data);
      showToast(`Incident ${res.data.incident_id} registered and anchored on blockchain!`, 'success');
      setShowReportModal(false);
      loadIncidents();
    } catch (error) {
      showToast(error.response?.data?.error || error.message, 'error');
    } finally {
      setReporting(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="incidents-page">
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Threat Incidents</h1>
            <span
              className="badge badge-info"
              style={{ fontSize: '0.8rem', padding: '3px 10px', fontWeight: 700 }}
            >
              {total} Total Records
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>
            Multi-stage cryptojacking telemetry, deterministic SHA-256 evidence digests, and smart contract audit trail.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadIncidents()}
            title="Refresh incident list"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>

          <a
            href={reportsApi.exportUrl('csv')}
            className="btn btn-outline"
            target="_blank"
            rel="noopener noreferrer"
            title="Export full database as CSV"
          >
            <Download size={15} /> Export CSV
          </a>

          <a
            href={reportsApi.exportUrl('json')}
            className="btn btn-outline"
            target="_blank"
            rel="noopener noreferrer"
            title="Export full database as JSON"
          >
            <Download size={15} /> Export JSON
          </a>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowReportModal(true);
              triggerLivePreview(reportForm);
            }}
          >
            <Zap size={16} />
            Simulate / Report Threat
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Interactive Filter Control Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginRight: '4px' }}>
              <Filter size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Filters:
            </span>

            <select
              className="input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              value={filters.severity}
              onChange={e => handleFilterChange('severity', e.target.value)}
            >
              <option value="ALL">All Severities</option>
              {severityOptions.filter(s => s !== 'ALL').map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              value={filters.verification}
              onChange={e => handleFilterChange('verification', e.target.value)}
            >
              <option value="ALL">All Verification</option>
              {statusOptions.filter(v => v !== 'ALL').map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>

            <select
              className="input"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
              value={filters.resolution}
              onChange={e => handleFilterChange('resolution', e.target.value)}
            >
              <option value="ALL">All Resolutions</option>
              {resolutionOptions.filter(r => r !== 'ALL').map(r => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search process, hash, ID..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.82rem' }}
            />
          </div>
        </div>

        {/* Incidents Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading incidents from database...</p>
            </div>
          ) : incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <AlertTriangle size={36} style={{ color: '#f59e0b', margin: '0 auto 12px' }} />
              <h4 style={{ color: '#f1f5f9', margin: '0 0 6px 0' }}>No matching incidents found</h4>
              <p style={{ color: '#64748b', fontSize: '0.82rem', margin: 0 }}>
                Try resetting your filters or search criteria.
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.4)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === incidents.length && incidents.length > 0}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', accentColor: '#06b6d4' }}
                      title="Select all on this page"
                    />
                  </th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Incident ID</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Severity</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Risk Score</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Process & Env</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Network Destination</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Verification</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em' }}>Resolution</th>
                  <th style={{ padding: '12px 14px', fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.06em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => {
                  const isSelected = selectedIds.has(inc.incident_id);
                  const isCritical = inc.severity === 'CRITICAL';
                  const isHigh = inc.severity === 'HIGH';
                  const isVerified = inc.verification_status === 'VERIFIED';
                  const isTampered = inc.verification_status === 'TAMPERED';

                  return (
                    <tr
                      key={inc.incident_id}
                      onClick={() => openInspector(inc)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background: isSelected ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      className="incident-table-row"
                    >
                      <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectOne(inc.incident_id, e)}
                          style={{ cursor: 'pointer', accentColor: '#06b6d4' }}
                        />
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '0.82rem' }}>
                            {inc.incident_id}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className={`badge badge-${inc.severity.toLowerCase()}`}>
                          {inc.severity}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 50, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, inc.risk_score)}%`,
                                height: '100%',
                                background: isCritical ? '#dc2626' : isHigh ? '#f97316' : inc.risk_score >= 40 ? '#f59e0b' : '#10b981'
                              }}
                            />
                          </div>
                          <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.85rem', color: isCritical ? '#f87171' : '#f1f5f9' }}>
                            {inc.risk_score}
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', maxWidth: '180px' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, color: '#e2e8f0', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.process_name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                          CPU: {inc.cpu_usage}% · Mem: {inc.memory_usage}% · {inc.environment}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', maxWidth: '170px' }}>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inc.network_destination || <span style={{ color: '#475569' }}>None (Internal)</span>}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className={`badge badge-${inc.verification_status.toLowerCase()}`}
                          style={{
                            background: isVerified ? 'rgba(16, 185, 129, 0.15)' : isTampered ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.15)',
                            color: isVerified ? '#34d399' : isTampered ? '#f87171' : '#94a3b8',
                            border: `1px solid ${isVerified ? 'rgba(16, 185, 129, 0.3)' : isTampered ? 'rgba(239, 68, 68, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`
                          }}
                        >
                          {isVerified ? '● Verified' : isTampered ? '🚨 Tampered' : '○ Pending'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <span className={`badge badge-${inc.resolution_status.toLowerCase().replace('_', '-')}`}>
                          {inc.resolution_status.replace('_', ' ')}
                        </span>
                      </td>

                      <td style={{ padding: '12px 14px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                            onClick={() => openInspector(inc)}
                            title="Quick Inspect"
                          >
                            <Eye size={13} />
                            Inspect
                          </button>
                          <Link
                            to={`/incidents/${inc.incident_id}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                            title="Full Page"
                          >
                            <ExternalLink size={13} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              background: 'rgba(15, 23, 42, 0.4)'
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Showing {((page - 1) * limit) + 1} - {Math.min(total, page * limit)} of {total} incidents
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>

              <span style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Action Toolbar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            borderRadius: '14px',
            padding: '12px 24px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(6, 182, 212, 0.2)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: '#06b6d4' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
              {selectedIds.size} Selected
            </span>
          </div>

          <div style={{ height: '20px', width: '1px', background: 'rgba(255, 255, 255, 0.15)' }} />

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleBatchVerify}
            disabled={batchActionLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Shield size={14} />
            {batchActionLoading ? 'Verifying...' : 'Batch Verify On-Chain'}
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleBatchExport}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={14} />
            Export Selected JSON
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setSelectedIds(new Set())}
            style={{ color: '#94a3b8' }}
          >
            Deselect All
          </button>
        </div>
      )}

      {/* Slide-Over Quick Inspection Drawer */}
      {inspectIncident && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            maxWidth: '520px',
            background: 'rgba(11, 19, 38, 0.98)',
            borderLeft: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(20px)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            animation: 'slideInRight 0.25s ease-out'
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.6)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} style={{ color: '#38bdf8' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc', fontWeight: 700 }}>
                  {inspectIncident.incident_id}
                </h3>
                <span className={`badge badge-${inspectIncident.severity.toLowerCase()}`}>
                  {inspectIncident.severity}
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                {new Date(inspectIncident.timestamp).toLocaleString()}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ padding: '6px', borderRadius: '50%' }}
              onClick={() => setInspectIncident(null)}
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Risk Score Highlight */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.5) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Explainable Risk Score
                </span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: inspectIncident.risk_score >= 85 ? '#f87171' : '#38bdf8' }}>
                  {inspectIncident.risk_score} / 100
                </span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, inspectIncident.risk_score)}%`,
                    height: '100%',
                    background: inspectIncident.risk_score >= 85 ? '#dc2626' : inspectIncident.risk_score >= 70 ? '#f97316' : '#10b981'
                  }}
                />
              </div>
            </div>

            {/* Evidence & Hash Info */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                Deterministic Evidence Digest (SHA-256)
              </div>
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.72rem',
                  color: '#38bdf8',
                  wordBreak: 'break-all',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <span>{inspectIncident.evidence_hash}</span>
                <button
                  type="button"
                  onClick={() => copyEvidenceHash(inspectIncident.evidence_hash)}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 2 }}
                  title="Copy SHA-256 Hash"
                >
                  {copiedHash ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Process Name:</span>{' '}
                  <strong style={{ color: '#f1f5f9' }}>{inspectIncident.process_name}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Environment:</span>{' '}
                  <strong style={{ color: '#f1f5f9' }}>{inspectIncident.environment}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>CPU Usage:</span>{' '}
                  <strong style={{ color: '#f1f5f9' }}>{inspectIncident.cpu_usage}%</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Memory Usage:</span>{' '}
                  <strong style={{ color: '#f1f5f9' }}>{inspectIncident.memory_usage}%</strong>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748b' }}>Destination:</span>{' '}
                  <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                    {inspectIncident.network_destination || 'None (Internal host loop)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Quick Blockchain Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={handleDrawerVerify}
                  disabled={verifyingId === inspectIncident.incident_id}
                >
                  <Shield size={15} />
                  {verifyingId === inspectIncident.incident_id ? 'Verifying On-Chain...' : 'Verify on Smart Contract'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={handleDrawerTamperTest}
                  disabled={verifyingId === inspectIncident.incident_id}
                  title="Simulate altered evidence to test tamper detection"
                >
                  <AlertOctagon size={15} style={{ color: '#f87171' }} />
                  Test Tamper Proof
                </button>
              </div>

              {/* Status Updater */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Resolution:</span>
                {['OPEN', 'IN_PROGRESS', 'RESOLVED'].map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`btn btn-sm ${inspectIncident.resolution_status === st ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    onClick={() => handleDrawerStatusChange(st)}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* SOC Notes Thread */}
            <div
              style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={15} style={{ color: '#38bdf8' }} />
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>
                  SOC Investigation Log ({drawerNotes.length})
                </h4>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Record SOC investigation finding..."
                  value={newNoteText}
                  onChange={e => setNewNoteText(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={addingNote || !newNoteText.trim()}
                  style={{ padding: '0 12px' }}
                >
                  <Send size={14} />
                </button>
              </form>

              {/* Notes List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {drawerNotes.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>No analyst notes recorded yet.</p>
                ) : (
                  drawerNotes.map(n => (
                    <div
                      key={n.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '6px',
                        padding: '8px 10px',
                        fontSize: '0.76rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.68rem', marginBottom: '2px' }}>
                        <span>{n.author}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>{n.note}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Simulation & Report Modal */}
      {showReportModal && (
        <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
          <div
            className="modal"
            style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={20} style={{ color: '#06b6d4' }} />
                  Cryptojacking Telemetry Simulation & Ingest Lab
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                  Simulate attack scenarios, preview real-time scoring, and anchor tamper-proof proof on Ethereum.
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowReportModal(false)}>&times;</button>
            </div>

            <div className="modal-body">
              {/* Presets Quick Selector */}
              <div style={{ marginBottom: '18px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  ⚡ Quick Scenario Presets:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {SIMULATION_PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => applyPreset(preset)}
                      style={{
                        fontSize: '0.74rem',
                        padding: '5px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderColor: reportForm.process_name === preset.data.process_name ? '#06b6d4' : undefined,
                        background: reportForm.process_name === preset.data.process_name ? 'rgba(6, 182, 212, 0.1)' : undefined
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: preset.badgeColor }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Controls */}
              <form onSubmit={handleReportSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="label">
                      CPU Utilization: <strong>{reportForm.cpu_usage}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={reportForm.cpu_usage}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setReportForm(prev => ({ ...prev, cpu_usage: val }));
                        triggerLivePreview({ ...reportForm, cpu_usage: val });
                      }}
                      style={{ width: '100%', accentColor: reportForm.cpu_usage > 75 ? '#ef4444' : '#10b981' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">
                      Memory Utilization: <strong>{reportForm.memory_usage}%</strong>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.5"
                      value={reportForm.memory_usage}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setReportForm(prev => ({ ...prev, memory_usage: val }));
                        triggerLivePreview({ ...reportForm, memory_usage: val });
                      }}
                      style={{ width: '100%', accentColor: reportForm.memory_usage > 70 ? '#f59e0b' : '#38bdf8' }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Process Name</label>
                    <input
                      type="text"
                      className="input"
                      value={reportForm.process_name}
                      onChange={e => {
                        const val = e.target.value;
                        setReportForm(prev => ({ ...prev, process_name: val }));
                        triggerLivePreview({ ...reportForm, process_name: val });
                      }}
                      placeholder="e.g. xmrig, cpuminer, python"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Runtime (Seconds)</label>
                    <input
                      type="number"
                      className="input"
                      value={reportForm.process_runtime_seconds}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setReportForm(prev => ({ ...prev, process_runtime_seconds: val }));
                        triggerLivePreview({ ...reportForm, process_runtime_seconds: val });
                      }}
                      placeholder="e.g. 7200"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Network Destination</label>
                    <input
                      type="text"
                      className="input"
                      value={reportForm.network_destination}
                      onChange={e => {
                        const val = e.target.value;
                        setReportForm(prev => ({ ...prev, network_destination: val }));
                        triggerLivePreview({ ...reportForm, network_destination: val });
                      }}
                      placeholder="e.g. pool.supportxmr.com:3333"
                    />
                  </div>

                  <div className="form-group">
                    <label className="label">Environment</label>
                    <select
                      className="input"
                      value={reportForm.environment}
                      onChange={e => setReportForm(prev => ({ ...prev, environment: e.target.value }))}
                    >
                      <option value="HOST">Host (Bare Metal / VM)</option>
                      <option value="CONTAINER">Container (Docker / Podman)</option>
                      <option value="KUBERNETES">Kubernetes Cluster Pod</option>
                    </select>
                  </div>
                </div>

                {/* Live Real-Time Risk Preview Box */}
                {livePreviewScore && (
                  <div
                    style={{
                      marginTop: '20px',
                      padding: '14px 18px',
                      background: livePreviewScore.suspicious ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${livePreviewScore.suspicious ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      borderRadius: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {livePreviewScore.suspicious ? <AlertTriangle size={18} color="#f87171" /> : <CheckCircle size={18} color="#34d399" />}
                        <strong style={{ color: livePreviewScore.suspicious ? '#fca5a5' : '#6ee7b7' }}>
                          {livePreviewScore.suspicious ? 'SUSPICIOUS CRYPTOJACKING TELEMETRY' : 'NOMINAL WORKLOAD PROFILE'}
                        </strong>
                      </div>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: livePreviewScore.suspicious ? '#f87171' : '#34d399' }}>
                        {livePreviewScore.risk_score?.score ?? 0} / 100 ({livePreviewScore.risk_score?.severity ?? 'LOW'})
                      </span>
                    </div>

                    <div style={{ marginTop: '6px', fontSize: '0.74rem', color: '#94a3b8' }}>
                      Explainable Factors:{' '}
                      {livePreviewScore.reasons?.join('; ') || 'Telemetry within nominal baseline limits'}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowReportModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={reporting}>
                    <Shield size={16} />
                    {reporting ? 'Anchoring On-Chain...' : 'Register Threat & Anchor to Blockchain'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}