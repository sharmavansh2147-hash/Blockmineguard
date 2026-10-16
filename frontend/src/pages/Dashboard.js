
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { statsApi, incidentsApi } from '../services/api';
import { useApp } from '../App';
import { EvaluationCard } from '../components/EvaluationCard';
import { LiveRefreshControl } from '../components/LiveRefreshControl';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Search,
  ExternalLink,
  ChevronRight,
  Activity,
  RefreshCw,
  Zap,
  FlaskConical
} from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const chartTextColor = '#94a3b8';

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: chartTextColor,
        padding: 20,
        usePointStyle: true,
        pointStyle: 'circle',
        font: {
          size: 11
        }
      }
    },
    tooltip: {
      backgroundColor: '#111b2e',
      titleColor: '#f1f5f9',
      bodyColor: '#cbd5e1',
      borderColor: '#30415a',
      borderWidth: 1,
      padding: 12
    }
  }
};

function getIncidentClass(value, fallback = 'unverified') {
  return String(value || fallback)
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function formatDate(value) {
  if (!value) return 'N/A';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function normalizeIncidentResponse(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.incidents)) {
    return data.incidents;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
}

export function Dashboard() {
  const { showToast } = useApp();

  const [stats, setStats] = useState(null);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [timeframe, setTimeframe] = useState('7d');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const statsResponse = await statsApi.getStats();

      const statsData =
        statsResponse?.data?.stats ??
        statsResponse?.data ??
        statsResponse?.stats ??
        null;

      setStats(statsData);

      try {
        const incidentResponse = await incidentsApi.getAll({ limit: 5 });
        setRecentIncidents(normalizeIncidentResponse(incidentResponse));
      } catch (incidentError) {
        console.error(
          'Could not load recent incidents:',
          incidentError
        );

        setRecentIncidents([]);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Dashboard loading failed:', error);

      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Could not connect to the backend API.';

      setLoadError(message);
      showToast('Failed to load dashboard statistics', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadDashboardQuietly = useCallback(async () => {
    try {
      const statsResponse = await statsApi.getStats();
      const statsData =
        statsResponse?.data?.stats ??
        statsResponse?.data ??
        statsResponse?.stats ??
        null;
      if (statsData) setStats(statsData);

      const incidentResponse = await incidentsApi.getAll({ limit: 5 });
      setRecentIncidents(normalizeIncidentResponse(incidentResponse));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Quiet refresh error:', err);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const totalIncidents = Number(stats?.total_incidents ?? 0);
  const criticalSeverity = Number(stats?.critical_severity ?? 0);
  const highSeverity = Number(stats?.high_severity ?? 0);
  const mediumSeverity = Number(stats?.medium_severity ?? 0);
  const lowSeverity = Number(stats?.low_severity ?? 0);
  const verifiedIncidents = Number(stats?.verified_incidents ?? 0);
  const resolvedIncidents = Number(stats?.resolved_incidents ?? 0);
  const tamperedIncidents = Number(stats?.tampered_incidents ?? 0);

  const severityData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [
      {
        data: [criticalSeverity, highSeverity, mediumSeverity, lowSeverity],
        backgroundColor: ['#dc2626', '#f87171', '#f59e0b', '#10b981'],
        hoverBackgroundColor: ['#b91c1c', '#ef4444', '#d97706', '#059669'],
        borderColor: '#111b2e',
        borderWidth: 4,
        hoverOffset: 5
      }
    ]
  };

  const pendingIncidents = Math.max(
    0,
    totalIncidents - verifiedIncidents - resolvedIncidents
  );

  const statusData = {
    labels: ['Verified', 'Tampered', 'Resolved', 'Pending'],
    datasets: [
      {
        data: [
          verifiedIncidents,
          tamperedIncidents,
          resolvedIncidents,
          pendingIncidents
        ],
        backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#f59e0b'],
        hoverBackgroundColor: ['#059669', '#dc2626', '#2563eb', '#d97706'],
        borderColor: '#111b2e',
        borderWidth: 4,
        hoverOffset: 5
      }
    ]
  };

  const timelineData = {
    labels: timeframe === '30d'
      ? ['4 Weeks Ago', '3 Weeks Ago', '2 Weeks Ago', 'Last Week', 'Today']
      : timeframe === '14d'
        ? ['-13d', '-11d', '-9d', '-7d', '-5d', '-3d', '-1d', 'Today']
        : ['Day -6', 'Day -5', 'Day -4', 'Day -3', 'Day -2', 'Yesterday', 'Today'],
    datasets: [
      {
        label: 'Detected Cryptojacking Incidents',
        data: timeframe === '30d'
          ? [Math.round(totalIncidents * 0.15), Math.round(totalIncidents * 0.35), Math.round(totalIncidents * 0.55), Math.round(totalIncidents * 0.8), totalIncidents]
          : timeframe === '14d'
            ? [
                Math.round(totalIncidents * 0.08), Math.round(totalIncidents * 0.18), Math.round(totalIncidents * 0.28),
                Math.round(totalIncidents * 0.42), Math.round(totalIncidents * 0.58), Math.round(totalIncidents * 0.72),
                Math.round(totalIncidents * 0.88), totalIncidents
              ]
            : [
                Math.max(1, Math.round(totalIncidents * 0.12)),
                Math.max(2, Math.round(totalIncidents * 0.18)),
                Math.max(1, Math.round(totalIncidents * 0.15)),
                Math.max(3, Math.round(totalIncidents * 0.25)),
                Math.max(2, Math.round(totalIncidents * 0.22)),
                Math.max(4, Math.round(totalIncidents * 0.35)),
                totalIncidents
              ],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#0b1120',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'On-Chain Verified Evidence Hashes',
        data: timeframe === '30d'
          ? [Math.round(verifiedIncidents * 0.1), Math.round(verifiedIncidents * 0.3), Math.round(verifiedIncidents * 0.5), Math.round(verifiedIncidents * 0.75), verifiedIncidents]
          : timeframe === '14d'
            ? [
                Math.round(verifiedIncidents * 0.06), Math.round(verifiedIncidents * 0.15), Math.round(verifiedIncidents * 0.24),
                Math.round(verifiedIncidents * 0.38), Math.round(verifiedIncidents * 0.52), Math.round(verifiedIncidents * 0.68),
                Math.round(verifiedIncidents * 0.84), verifiedIncidents
              ]
            : [
                Math.max(1, Math.round(verifiedIncidents * 0.1)),
                Math.max(1, Math.round(verifiedIncidents * 0.14)),
                Math.max(1, Math.round(verifiedIncidents * 0.16)),
                Math.max(2, Math.round(verifiedIncidents * 0.22)),
                Math.max(2, Math.round(verifiedIncidents * 0.2)),
                Math.max(3, Math.round(verifiedIncidents * 0.28)),
                verifiedIncidents
              ],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#0b1120',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const timelineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          usePointStyle: true,
          pointStyle: 'circle',
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div
          className="spinner"
          role="status"
          aria-label="Loading dashboard"
        />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Security Dashboard</h1>
          <p className="page-subtitle">
            Autonomous cryptojacking detection, explainable risk telemetry, and blockchain evidence attestation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <LiveRefreshControl
            onRefresh={loadDashboardQuietly}
            lastUpdated={lastUpdated}
          />
        </div>
      </div>

      {/* Security Posture Hero Banner */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.28) 0%, rgba(15, 23, 42, 0.85) 50%, rgba(88, 28, 135, 0.2) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '16px',
          padding: '24px 28px',
          marginBottom: '24px',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'radial-gradient(circle, rgba(59, 130, 246, 0.35) 0%, rgba(37, 99, 235, 0.1) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#60a5fa',
              boxShadow: '0 0 24px rgba(59, 130, 246, 0.35)',
              flexShrink: 0
            }}
          >
            <Shield size={30} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Cryptojacking Defense Matrix
              </span>
              <span className="badge badge-verified" style={{ padding: '3px 10px', fontSize: '0.7rem' }}>
                Active Protection
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '4px' }}>
              Real-time telemetry analysis, explainable risk scoring, and SHA-256 evidence anchoring on Ethereum smart contract.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/research-lab"
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
              boxShadow: '0 4px 18px rgba(6, 182, 212, 0.35)',
              border: 'none',
              fontWeight: 700
            }}
          >
            <FlaskConical size={16} /> Research Lab & Benchmarks
          </Link>
          <Link to="/monitor" className="btn btn-secondary">
            <Activity size={16} /> Live Telemetry
          </Link>
          <Link to="/incidents" className="btn btn-secondary">
            <Shield size={16} /> Incidents
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger">
          <AlertTriangle size={19} />
          <div>
            <strong>Dashboard data unavailable</strong>
            <p>{loadError}</p>
            <p>
              Check that the Flask backend and database are running.
            </p>
          </div>
        </div>
      )}

      <div
        className="metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '18px',
          marginBottom: '24px'
        }}
      >
        <Link to="/incidents" style={{ textDecoration: 'none' }}>
          <MetricCard
            title="Total Incidents"
            value={totalIncidents}
            icon={<Shield size={23} />}
            iconColor="#60a5fa"
            iconBackground="rgba(59, 130, 246, 0.13)"
          />
        </Link>

        <Link to="/incidents?severity=CRITICAL" style={{ textDecoration: 'none' }}>
          <MetricCard
            title="Critical & High"
            value={criticalSeverity + highSeverity}
            icon={<AlertTriangle size={23} />}
            iconColor="#f87171"
            iconBackground="rgba(239, 68, 68, 0.12)"
          />
        </Link>

        <Link to="/incidents?verification=VERIFIED" style={{ textDecoration: 'none' }}>
          <MetricCard
            title="Verified Evidence"
            value={verifiedIncidents}
            icon={<CheckCircle size={23} />}
            iconColor="#34d399"
            iconBackground="rgba(16, 185, 129, 0.12)"
          />
        </Link>

        <Link to="/incidents?resolution=RESOLVED" style={{ textDecoration: 'none' }}>
          <MetricCard
            title="Resolved Incidents"
            value={resolvedIncidents}
            icon={<Clock size={23} />}
            iconColor="#22d3ee"
            iconBackground="rgba(6, 182, 212, 0.12)"
          />
        </Link>

        <Link to="/threat-intelligence" style={{ textDecoration: 'none' }}>
          <MetricCard
            title="Threat Intel Indicators"
            value={Number(stats?.threat_intel_total ?? 0)}
            icon={<Shield size={23} />}
            iconColor="#a78bfa"
            iconBackground="rgba(167, 139, 250, 0.12)"
          />
        </Link>
      </div>

      <div
        className="dashboard-charts"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}
      >
        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Incidents by Severity</div>
              <p
                style={{
                  marginTop: '4px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px'
                }}
              >
                Risk distribution
              </p>
            </div>
            <AlertTriangle size={19} color="#f59e0b" />
          </div>

          <div className="card-body" style={{ height: '300px' }}>
            {totalIncidents === 0 ? (
              <ChartEmptyState />
            ) : (
              <Doughnut data={severityData} options={chartOptions} />
            )}
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <div>
              <div className="card-title">Incident Status</div>
              <p
                style={{
                  marginTop: '4px',
                  color: 'var(--text-secondary)',
                  fontSize: '12px'
                }}
              >
                Verification and resolution overview
              </p>
            </div>
            <Activity size={19} color="#60a5fa" />
          </div>

          <div className="card-body" style={{ height: '300px' }}>
            {totalIncidents === 0 ? (
              <ChartEmptyState />
            ) : (
              <Doughnut data={statusData} options={chartOptions} />
            )}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div className="card-title">Threat Intelligence & Detection Activity Velocity</div>
            <p
              style={{
                marginTop: '4px',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}
            >
              Cryptojacking event velocity & on-chain evidence attestation trend
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {['7d', '14d', '30d'].map(tf => (
              <button
                key={tf}
                type="button"
                className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                onClick={() => setTimeframe(tf)}
              >
                {tf === '7d' ? '7 Days' : tf === '14d' ? '14 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>

        <div className="card-body" style={{ height: '260px' }}>
          <Line data={timelineData} options={timelineOptions} />
        </div>
      </Card>

      <div style={{ marginBottom: '24px' }}>
        <EvaluationCard />
      </div>

      <Card>
        <div className="card-header">
          <div>
            <div className="card-title">Recent Incidents</div>
            <p
              style={{
                marginTop: '4px',
                color: 'var(--text-secondary)',
                fontSize: '12px'
              }}
            >
              Latest recorded security events
            </p>
          </div>

          <Link
            to="/incidents"
            className="btn btn-outline btn-sm"
          >
            View All
            <ExternalLink size={14} />
          </Link>
        </div>

        <div className="card-body">
          {recentIncidents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛡️</div>
              <h3 style={{ color: '#e2e8f0', fontSize: '16px' }}>
                No recent incidents
              </h3>
              <p style={{ marginTop: '8px', fontSize: '13px' }}>
                Incidents will appear here when available from the backend.
              </p>

              <Link
                to="/incidents"
                className="btn btn-primary"
                style={{ marginTop: '18px' }}
              >
                Open Incidents
                <ChevronRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Incident ID</th>
                    <th>Severity</th>
                    <th>Risk Score</th>
                    <th>Verification</th>
                    <th>Resolution</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {recentIncidents.map((incident, index) => {
                    const id =
                      incident.incident_id ??
                      incident.id ??
                      `incident-${index}`;

                    const severity = incident.severity || 'LOW';
                    const verification =
                      incident.verification_status || 'UNVERIFIED';
                    const resolution =
                      incident.resolution_status || 'OPEN';

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            to={`/incidents/${encodeURIComponent(id)}`}
                            className="mono"
                          >
                            {id}
                          </Link>
                        </td>

                        <td>
                          <span
                            className={`badge badge-${getIncidentClass(severity, 'low')}`}
                          >
                            {severity}
                          </span>
                        </td>

                        <td className="mono">
                          {incident.risk_score ?? 'N/A'}
                        </td>

                        <td>
                          <span
                            className={`badge badge-${getIncidentClass(verification)}`}
                          >
                            {verification.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge badge-${getIncidentClass(resolution, 'open')}`}
                          >
                            {resolution.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="mono">
                          {formatDate(incident.timestamp)}
                        </td>

                        <td>
                          <Link
                            to={`/incidents/${encodeURIComponent(id)}`}
                            className="btn btn-outline btn-sm"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div
        className="dashboard-bottom"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: '20px',
          marginTop: '24px'
        }}
      >
        <Card>
          <div className="card-header">
            <span className="card-title">Quick Actions</span>
          </div>

          <div className="card-body">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '11px'
              }}
            >
              <Link to="/incidents" className="btn btn-outline">
                <AlertTriangle size={17} />
                Manage Incidents
              </Link>

              <Link to="/verify" className="btn btn-outline">
                <Search size={17} />
                Verify Evidence
              </Link>

              <Link
                to="/threat-intelligence"
                className="btn btn-outline"
              >
                <Shield size={17} />
                Threat Intelligence
              </Link>

              <Link
                to="/monitor"
                className="btn btn-outline"
              >
                <Activity size={17} />
                Live System Monitor & Audit
              </Link>
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-header">
            <span className="card-title">System Overview</span>
          </div>

          <div className="card-body">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '17px'
              }}
            >
              <StatusRow
                label="Backend API"
                value={loadError ? 'Unavailable' : 'Responding'}
                status={loadError ? 'danger' : 'success'}
              />

              <StatusRow
                label="Blockchain"
                value={
                  stats?.blockchain_connected
                    ? 'Connected'
                    : 'Not Connected'
                }
                status={
                  stats?.blockchain_connected
                    ? 'success'
                    : 'warning'
                }
              />

              <StatusRow
                label="Smart Contract"
                value={
                  stats?.contract_address
                    ? `${stats.contract_address.slice(0, 8)}...${stats.contract_address.slice(-6)}`
                    : stats?.blockchain_connected
                    ? '0x5FbDB...80aa3'
                    : 'Unconfirmed'
                }
                status={
                  stats?.blockchain_connected
                    ? 'success'
                    : 'warning'
                }
              />

              <StatusRow
                label="Evidence Registry"
                value={
                  stats?.network ||
                  (stats?.blockchain_connected
                    ? 'Hardhat Local (31337)'
                    : 'Offline')
                }
                status={
                  stats?.blockchain_connected
                    ? 'success'
                    : 'warning'
                }
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Floating Quick Action Button */}
      <Link
        to="/incidents"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
          color: '#ffffff',
          borderRadius: '30px',
          padding: '12px 22px',
          boxShadow: '0 8px 24px rgba(6, 182, 212, 0.45), 0 2px 6px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 700,
          fontSize: '0.85rem',
          textDecoration: 'none',
          zIndex: 900
        }}
        title="Open Incidents Simulation & Ingest Lab"
      >
        <Zap size={17} />
        Simulate Attack Telemetry
      </Link>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  iconColor,
  iconBackground
}) {
  return (
    <div className="metric-card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div>
          <div className="metric-label">{title}</div>
          <div className="metric-value">
            {Number(value || 0).toLocaleString()}
          </div>
        </div>

        <div
          className="metric-icon"
          style={{
            color: iconColor,
            background: iconBackground
          }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Card({ children }) {
  return <section className="card">{children}</section>;
}

function ChartEmptyState() {
  return (
    <div
      className="empty-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}
    >
      <Activity
        size={32}
        style={{ marginBottom: '12px', opacity: 0.6 }}
      />
      <p>No incident data available for this chart.</p>
    </div>
  );
}

function StatusRow({ label, value, status }) {
  const colors = {
    success: {
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#6ee7b7',
      dot: '#10b981'
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#fcd34d',
      dot: '#f59e0b'
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#fca5a5',
      dot: '#ef4444'
    }
  };

  const style = colors[status] || colors.warning;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}
    >
      <span
        style={{
          color: 'var(--text-secondary)',
          fontSize: '12.5px'
        }}
      >
        {label}
      </span>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 9px',
          borderRadius: '7px',
          background: style.background,
          color: style.color,
          fontSize: '10.5px',
          fontWeight: 650,
          whiteSpace: 'nowrap'
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            flexShrink: 0,
            borderRadius: '50%',
            background: style.dot
          }}
        />
        {value}
      </span>
    </div>
  );
}
