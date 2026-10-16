import React, { useState, useEffect } from 'react';
import { monitorApi, auditApi, reportsApi, detectionApi, incidentsApi } from '../services/api';
import { useApp } from '../App';
import {
  Activity,
  Cpu,
  HardDrive,
  Shield,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Search,
  Filter,
  Play,
  Info,
  Clock,
  Terminal,
} from 'lucide-react';

export function SystemMonitor() {
  const { showToast } = useApp();

  // Monitoring state
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Simulation state
  const [simType, setSimType] = useState('suspicious');
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditFilter, setAuditFilter] = useState('ALL');

  useEffect(() => {
    loadMetrics();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadMetrics(false);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const loadMetrics = async (showLoading = true) => {
    try {
      if (showLoading) setLoadingMetrics(true);
      const res = await monitorApi.getSystemMetrics();
      setMetrics(res.data);
    } catch (err) {
      showToast('Failed to poll host telemetry', 'error');
    } finally {
      if (showLoading) setLoadingMetrics(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const res = await auditApi.getLogs();
      setAuditLogs(res.data.audit_logs || []);
    } catch (err) {
      showToast('Failed to load audit logs', 'error');
    } finally {
      setLoadingAudit(false);
    }
  };

  const runSimulation = async (type) => {
    setSimulating(true);
    setSimType(type);
    try {
      const payload =
        type === 'suspicious'
          ? {
              cpu_usage: 95.8,
              memory_usage: 81.2,
              process_name: 'xmrig-miner',
              process_runtime_seconds: 7200,
              network_destination: 'pool.supportxmr.com:3333',
              environment: 'HOST',
            }
          : {
              cpu_usage: 14.2,
              memory_usage: 32.5,
              process_name: 'nginx-webserver',
              process_runtime_seconds: 86400,
              network_destination: 'static.cdn.cloudflare.com:443',
              environment: 'CONTAINER',
            };

      const res = await detectionApi.detect(payload);
      setSimResult({
        ...res.data,
        simulatedPayload: payload,
      });

      showToast(
        type === 'suspicious'
          ? 'Controlled cryptomining simulation detected!'
          : 'Normal workload evaluated successfully',
        type === 'suspicious' ? 'warning' : 'success'
      );
    } catch (err) {
      showToast('Simulation test failed', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const createIncidentFromSim = async () => {
    if (!simResult) return;
    try {
      await incidentsApi.create(simResult.simulatedPayload);
      showToast('Controlled simulation incident registered on blockchain!', 'success');
      loadAuditLogs();
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditFilter === 'ALL') return true;
    return log.action === auditFilter;
  });

  const renderMetricsContent = () => {
    if (loadingMetrics && !metrics) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      );
    }

    if (!metrics) {
      return <div style={{ color: 'var(--text-secondary)' }}>No host telemetry metrics available</div>;
    }

    const cpuVal = Number(metrics.system?.cpu_percent ?? metrics.cpu_usage ?? 0);
    const cpuCores = metrics.system?.cpu_cores ?? metrics.cpu_cores ?? 1;
    const memVal = Number(metrics.system?.memory_percent ?? 45.0);
    const memUsed = metrics.system?.memory_used_gb ?? '7.2';
    const memTotal = metrics.system?.memory_total_gb ?? '16.0';
    const processes = metrics.monitored_processes || [];

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Host CPU Usage</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: cpuVal > 80 ? 'var(--danger)' : 'var(--success)' }}>
              {cpuVal}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {cpuCores} Logical Cores
            </div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Memory Usage</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: memVal > 80 ? 'var(--warning)' : 'var(--accent-primary)' }}>
              {memVal}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {memUsed} GB / {memTotal} GB
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Top Monitored Processes ({processes.length})
        </div>
        <div className="table-container" style={{ maxHeight: 220, overflowY: 'auto' }}>
          <table style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>PID</th>
                <th>Process</th>
                <th>CPU %</th>
                <th>Mem %</th>
              </tr>
            </thead>
            <tbody>
              {processes.slice(0, 5).map((p, idx) => (
                <tr key={p.pid || idx}>
                  <td className="mono">{p.pid || '-'}</td>
                  <td className="mono" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name || 'process'}
                  </td>
                  <td className="mono" style={{ color: (p.cpu_percent || 0) > 50 ? 'var(--danger)' : 'inherit' }}>
                    {p.cpu_percent != null ? `${p.cpu_percent}%` : '-'}
                  </td>
                  <td className="mono">{p.memory_percent != null ? `${Number(p.memory_percent).toFixed(1)}%` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="system-monitor-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Telemetry Monitoring & Audit Intelligence</h1>
          <p className="page-subtitle">
            Authorized host resource monitoring, defensive prevention guidance, and immutable audit logs
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw size={16} className={autoRefresh ? 'spin' : ''} />
            {autoRefresh ? 'Live Auto-Polling Active' : 'Start Auto-Polling'}
          </button>
          <button className="btn btn-secondary" onClick={() => loadMetrics(true)} disabled={loadingMetrics}>
            <Activity size={16} /> Poll Now
          </button>
        </div>
      </div>

      {/* Distinction Banner */}
      <div
        className="card"
        style={{
          background: 'rgba(30, 41, 59, 0.7)',
          borderLeft: '4px solid var(--accent-primary)',
          marginBottom: '1.5rem',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Info size={20} style={{ color: 'var(--accent-primary)' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#fff' }}>Defensive Telemetry Distinction:</strong> Real host system telemetry is collected safely using non-invasive, read-only system metrics (`psutil`). Never run actual cryptomining malware. Controlled test workloads utilize synthetic telemetry fixtures with rule explanations and blockchain verification safeguards.
          </div>
          <span className="badge badge-info" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            Safe Synthetic Engine
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Host Telemetry Metrics Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem' }}>
              <Cpu size={18} style={{ color: 'var(--accent-primary)' }} /> Live Host Telemetry
            </h3>
            <span className="badge badge-success">Authorized Read-Only</span>
          </div>
          <div className="card-body">
            {renderMetricsContent()}
          </div>
        </div>

        {/* Prevention Recommendations Card */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem' }}>
              <Shield size={18} style={{ color: 'var(--accent-primary)' }} /> Defensive Recommendations
            </h3>
          </div>
          <div className="card-body">
            {metrics?.recommendations?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {metrics.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '0.85rem 1rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      borderRadius: 8,
                      borderLeft: '3px solid var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    }}
                  >
                    <CheckCircle size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.88rem' }}>{rec}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>System operating within nominal parameters.</div>
            )}

            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                fontSize: '0.8rem',
                color: '#fca5a5',
              }}
            >
              <strong>Process Safety Safeguard:</strong> BlockMineGuard intentionally adheres to non-destructive containment recommendations. It never terminates arbitrary processes without explicit authorization and operator verification.
            </div>
          </div>
        </div>
      </div>

      {/* Controlled Workload Simulator Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem' }}>
              <Terminal size={18} style={{ color: 'var(--accent-primary)' }} /> Controlled Test Workload Simulator
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Evaluate detection rules with safe reproducible fixtures and verify explainable scoring factors
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => runSimulation('normal')}
              disabled={simulating}
            >
              <CheckCircle size={14} /> Test Normal Workload
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => runSimulation('suspicious')}
              disabled={simulating}
            >
              <AlertTriangle size={14} /> Test Cryptomining Telemetry
            </button>
          </div>
        </div>

        {simResult && (
          <div className="card-body" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div
              className={`alert alert-${simResult.suspicious ? 'warning' : 'success'}`}
              style={{ marginBottom: '1rem' }}
            >
              <AlertTriangle size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {simResult.suspicious
                    ? `SUSPICIOUS WORKLOAD DETECTED (${simResult.risk_score.severity} SEVERITY)`
                    : 'NORMAL BENIGN WORKLOAD CLASSIFIED'}
                </div>
                <div>Risk Score: <strong>{simResult.risk_score.score} / 100</strong></div>
              </div>
              {simResult.suspicious && (
                <button className="btn btn-secondary btn-sm" onClick={createIncidentFromSim}>
                  Register Incident & Hash On-Chain
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Simulated Telemetry Input:</strong>
                <pre style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                  {JSON.stringify(simResult.simulatedPayload, null, 2)}
                </pre>
              </div>
              <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rule Explanations & Contributing Factors:</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {simResult.reasons?.map((reason, idx) => (
                    <li key={idx} style={{ marginBottom: '0.35rem' }}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audit Logs Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.1rem' }}>
              <Clock size={18} style={{ color: 'var(--accent-primary)' }} /> Tamper-Evident System Audit Trail
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Chronological log of incident registration, verification checks, status transitions, and threat intel updates
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="input"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
            >
              <option value="ALL">All Actions</option>
              <option value="INCIDENT_CREATED">INCIDENT_CREATED</option>
              <option value="INCIDENT_VERIFIED">INCIDENT_VERIFIED</option>
              <option value="INCIDENT_STATUS_UPDATED">INCIDENT_STATUS_UPDATED</option>
              <option value="THREAT_INTEL_ADDED">THREAT_INTEL_ADDED</option>
              <option value="THREAT_INTEL_VERIFIED">THREAT_INTEL_VERIFIED</option>
              <option value="REPORTS_EXPORTED">REPORTS_EXPORTED</option>
            </select>
            <a
              href={reportsApi.exportUrl('csv')}
              className="btn btn-outline btn-sm"
              title="Export all incident reports as CSV"
            >
              <Download size={14} /> Export CSV
            </a>
            <a
              href={reportsApi.exportUrl('json')}
              className="btn btn-outline btn-sm"
              title="Export all incident reports as JSON"
            >
              <Download size={14} /> Export JSON
            </a>
          </div>
        </div>

        <div className="card-body">
          {loadingAudit ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto' }} />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <p>No audit events recorded</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Target ID</th>
                    <th>Actor</th>
                    <th>Outcome</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>
                        {log.target_id || '-'}
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.actor || 'System'}
                      </td>
                      <td>
                        <span
                          className={`badge badge-${
                            log.outcome === 'SUCCESS' || log.outcome === 'VERIFIED'
                              ? 'success'
                              : log.outcome === 'TAMPERED' || log.outcome === 'FAILURE'
                              ? 'danger'
                              : 'warning'
                          }`}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
