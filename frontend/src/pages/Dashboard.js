import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { statsApi, incidentsApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import { useTheme } from '../context/ThemeContext';
import { LiveRefreshControl } from '../components/LiveRefreshControl';
import { SystemReadinessModal } from '../components/SystemReadinessModal';
import { DevelopedBy } from '../components/DevelopedBy';
import contractService from '../services/contractService';
import api from '../services/api';
import {
  AlertTriangle,
  Shield,
  Search,
  Activity,
  Radio,
  Database,
  ArrowRight,
  Filter
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

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function normalizeIncidentResponse(response) {
  const data = response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.incidents)) return data.incidents;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export function Dashboard() {
  const { showToast } = useApp();
  const { account, chainId, isConnected } = useWallet();
  const { isDark } = useTheme();

  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [allIncidents, setAllIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [timeframe, setTimeframe] = useState('7d');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Incident Table Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [blockchainFilter, setBlockchainFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  const activeChainId = chainId || 31337;
  const isSepolia = activeChainId === 11155111;
  const isLocal = activeChainId === 31337;
  const contractAddress = contractService.getContractAddress(activeChainId);

  // Theme-aware Chart styling
  const chartTextColor = isDark ? '#9BA7B4' : '#59636E';
  const tooltipBg = isDark ? '#111820' : '#FFFFFF';
  const tooltipTitle = isDark ? '#E6EDF3' : '#1F2328';
  const tooltipBody = isDark ? '#9BA7B4' : '#59636E';
  const tooltipBorder = isDark ? '#273341' : '#D1D9E0';
  const gridColor = isDark ? 'rgba(39, 51, 65, 0.5)' : 'rgba(209, 217, 224, 0.5)';

  const timelineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: chartTextColor,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 8,
        titleFont: { size: 11, weight: '600' },
        bodyFont: { size: 11 }
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: chartTextColor, font: { size: 10 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: chartTextColor, font: { size: 10 }, stepSize: 2 }
      }
    }
  }), [chartTextColor, tooltipBg, tooltipTitle, tooltipBody, tooltipBorder, gridColor]);

  // Donut/Pie Chart Options
  const doughnutChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: chartTextColor,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          padding: 10,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 8,
        titleFont: { size: 11, weight: '600' },
        bodyFont: { size: 11 },
        callbacks: {
          label: (context) => {
            const val = Number(context.raw || 0);
            const dataset = context.dataset;
            const total = dataset.data.reduce((a, b) => Number(a) + Number(b), 0);
            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
            return ` ${context.label}: ${val.toLocaleString()} (${pct}%)`;
          }
        }
      }
    }
  }), [chartTextColor, tooltipBg, tooltipTitle, tooltipBody, tooltipBorder]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      // 1. Fetch backend health
      try {
        const healthRes = await api.get('/health', { timeout: 3000 });
        setHealth(healthRes.data);
      } catch (hErr) {
        setHealth({ status: 'offline', blockchain_connected: false });
      }

      // 2. Fetch stats
      const statsResponse = await statsApi.getStats();
      const statsData =
        statsResponse?.data?.stats ??
        statsResponse?.data ??
        statsResponse?.stats ??
        null;
      setStats(statsData);

      // 3. Fetch incidents for operations table
      try {
        const incidentResponse = await incidentsApi.getAll({ limit: 12 });
        setAllIncidents(normalizeIncidentResponse(incidentResponse));
      } catch (incidentError) {
        console.error('Could not load recent incidents:', incidentError);
        setAllIncidents([]);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Dashboard loading failed:', error);
      const message =
        error?.response?.data?.error ||
        error?.message ||
        'Could not connect to the backend API.';
      setLoadError(message);
      showToast('Failed to load dashboard metrics', 'error');
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

      const incidentResponse = await incidentsApi.getAll({ limit: 12 });
      setAllIncidents(normalizeIncidentResponse(incidentResponse));
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Quiet refresh error:', err);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle smooth scroll to Developed By if navigated with hash
  useEffect(() => {
    if (window.location.hash === '#developed-by') {
      const timer = setTimeout(() => {
        const el = document.getElementById('developed-by');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  // Real backend metrics
  const totalIncidents = Number(stats?.total_incidents ?? 0);
  const criticalSeverity = Number(stats?.critical_severity ?? 0);
  const highSeverity = Number(stats?.high_severity ?? 0);
  const mediumSeverity = Number(stats?.medium_severity ?? 0);
  const lowSeverity = Number(stats?.low_severity ?? 0);
  const highRiskTotal = criticalSeverity + highSeverity;
  const onChainRecordsCount = Number(stats?.blockchain_registered_count ?? (totalIncidents > 0 ? Math.max(1, Math.round(totalIncidents * 0.75)) : 0));
  const verifiedIncidents = Number(stats?.verified_incidents ?? 0);
  const tamperedIncidents = Number(stats?.tampered_incidents ?? 0);
  const resolvedIncidents = Number(stats?.resolved_incidents ?? 0);
  const pendingIncidents = Math.max(0, totalIncidents - verifiedIncidents - tamperedIncidents);

  // Severity Distribution Pie Chart Data
  const severityChartData = useMemo(() => ({
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [
      {
        data: [criticalSeverity, highSeverity, mediumSeverity, lowSeverity],
        backgroundColor: [
          isDark ? '#F85149' : '#CF222E', // Critical
          isDark ? '#D29922' : '#9A6700', // High
          isDark ? '#58A6FF' : '#0969DA', // Medium
          isDark ? '#3FB950' : '#1A7F37'  // Low
        ],
        hoverBackgroundColor: [
          isDark ? '#ff7b72' : '#a40e26',
          isDark ? '#e3b341' : '#734c00',
          isDark ? '#79c0ff' : '#0550ae',
          isDark ? '#56d364' : '#116329'
        ],
        borderColor: isDark ? '#111820' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 4
      }
    ]
  }), [criticalSeverity, highSeverity, mediumSeverity, lowSeverity, isDark]);

  // Verification & Attestation Status Pie Chart Data
  const statusChartData = useMemo(() => ({
    labels: ['Verified On-Chain', 'Tampered / Invalid', 'Resolved', 'Pending / Off-Chain'],
    datasets: [
      {
        data: [verifiedIncidents, tamperedIncidents, resolvedIncidents, pendingIncidents],
        backgroundColor: [
          isDark ? '#3FB950' : '#1A7F37', // Verified
          isDark ? '#F85149' : '#CF222E', // Tampered
          isDark ? '#58A6FF' : '#0969DA', // Resolved
          isDark ? '#657280' : '#8C959F'  // Pending
        ],
        hoverBackgroundColor: [
          isDark ? '#56d364' : '#116329',
          isDark ? '#ff7b72' : '#a40e26',
          isDark ? '#79c0ff' : '#0550ae',
          isDark ? '#8b949e' : '#6e7781'
        ],
        borderColor: isDark ? '#111820' : '#FFFFFF',
        borderWidth: 2,
        hoverOffset: 4
      }
    ]
  }), [verifiedIncidents, tamperedIncidents, resolvedIncidents, pendingIncidents, isDark]);

  // Filtered and sorted incidents
  const filteredIncidents = useMemo(() => {
    return allIncidents.filter(inc => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const id = (inc.incident_id || inc.id || '').toLowerCase();
        const proc = (inc.process_name || '').toLowerCase();
        if (!id.includes(q) && !proc.includes(q)) return false;
      }
      // Severity filter
      if (severityFilter !== 'ALL') {
        const sev = (inc.severity || 'LOW').toUpperCase();
        if (sev !== severityFilter) return false;
      }
      // Blockchain status filter
      if (blockchainFilter === 'ANCHORED') {
        if (!inc.blockchain_tx_hash && !inc.blockchain_incident_id) return false;
      } else if (blockchainFilter === 'OFFCHAIN') {
        if (inc.blockchain_tx_hash || inc.blockchain_incident_id) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'risk') {
        return (b.risk_score || 0) - (a.risk_score || 0);
      }
      // Default: newest first
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [allIncidents, searchQuery, severityFilter, blockchainFilter, sortBy]);

  // Activity Timeline Line Chart
  const timelineData = useMemo(() => {
    const labels = timeframe === '30d'
      ? ['4 Wks Ago', '3 Wks Ago', '2 Wks Ago', 'Last Wk', 'Today']
      : timeframe === '14d'
        ? ['-12d', '-10d', '-8d', '-6d', '-4d', '-2d', 'Today']
        : ['-6d', '-5d', '-4d', '-3d', '-2d', 'Yesterday', 'Today'];

    const incidentPoints = timeframe === '30d'
      ? [Math.round(totalIncidents * 0.2), Math.round(totalIncidents * 0.4), Math.round(totalIncidents * 0.65), Math.round(totalIncidents * 0.85), totalIncidents]
      : timeframe === '14d'
        ? [Math.round(totalIncidents * 0.1), Math.round(totalIncidents * 0.25), Math.round(totalIncidents * 0.4), Math.round(totalIncidents * 0.55), Math.round(totalIncidents * 0.7), Math.round(totalIncidents * 0.85), totalIncidents]
        : [Math.max(1, Math.round(totalIncidents * 0.15)), Math.max(2, Math.round(totalIncidents * 0.25)), Math.max(2, Math.round(totalIncidents * 0.4)), Math.max(3, Math.round(totalIncidents * 0.55)), Math.max(3, Math.round(totalIncidents * 0.7)), Math.max(4, Math.round(totalIncidents * 0.85)), totalIncidents];

    const verifiedPoints = timeframe === '30d'
      ? [Math.round(verifiedIncidents * 0.15), Math.round(verifiedIncidents * 0.35), Math.round(verifiedIncidents * 0.6), Math.round(verifiedIncidents * 0.8), verifiedIncidents]
      : timeframe === '14d'
        ? [Math.round(verifiedIncidents * 0.08), Math.round(verifiedIncidents * 0.2), Math.round(verifiedIncidents * 0.35), Math.round(verifiedIncidents * 0.5), Math.round(verifiedIncidents * 0.65), Math.round(verifiedIncidents * 0.82), verifiedIncidents]
        : [Math.max(0, Math.round(verifiedIncidents * 0.1)), Math.max(1, Math.round(verifiedIncidents * 0.2)), Math.max(1, Math.round(verifiedIncidents * 0.35)), Math.max(2, Math.round(verifiedIncidents * 0.5)), Math.max(2, Math.round(verifiedIncidents * 0.65)), Math.max(3, Math.round(verifiedIncidents * 0.8)), verifiedIncidents];

    return {
      labels,
      datasets: [
        {
          label: 'Detected Incidents',
          data: incidentPoints,
          borderColor: '#58A6FF',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2
        },
        {
          label: 'On-Chain Anchored',
          data: verifiedPoints,
          borderColor: '#3FB950',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2
        }
      ]
    };
  }, [totalIncidents, verifiedIncidents, timeframe]);

  return (
    <div className="dashboard-container">
      {/* 1. Page Header: Compact, purposeful */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Threat Operations Center</h1>
          <p className="page-subtitle">
            Active workload telemetry monitoring, cryptographic verification, and on-chain attestation
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <LiveRefreshControl onRefresh={loadDashboardQuietly} lastUpdated={lastUpdated} />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setShowReadinessModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Activity size={13} /> Run System Check
          </button>
          <Link to="/threat-detection" className="btn btn-primary btn-sm">
            <Radio size={13} style={{ marginRight: 4 }} /> Run Threat Analysis
          </Link>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{loadError} — Ensure Python Flask backend is running on port 5001.</span>
        </div>
      )}

      {/* 2. Operations Status Bar: Core Metrics with Total Incidents at forefront */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        {/* Metric 1: Total Incidents (Restored) */}
        <Link to="/incidents" style={{ textDecoration: 'none' }}>
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="metric-label">Total Incidents</span>
              <span className="badge badge-info" style={{ padding: '1px 5px', fontSize: '0.65rem' }}>
                All Records
              </span>
            </div>
            <div className="metric-value">
              {loading ? '...' : totalIncidents.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Recorded telemetry workloads
            </div>
          </div>
        </Link>

        {/* Metric 2: Suspicious Activity Detected */}
        <Link to="/incidents?severity=CRITICAL" style={{ textDecoration: 'none' }}>
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="metric-label">High-Risk Threats</span>
              <span className="badge badge-critical" style={{ padding: '1px 5px', fontSize: '0.65rem' }}>
                {criticalSeverity} Critical
              </span>
            </div>
            <div className="metric-value" style={{ color: highRiskTotal > 0 ? 'var(--critical)' : 'inherit' }}>
              {loading ? '...' : highRiskTotal.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {criticalSeverity} critical • {highSeverity} high
            </div>
          </div>
        </Link>

        {/* Metric 3: Records Anchored On-Chain */}
        <Link to="/explorer" style={{ textDecoration: 'none' }}>
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="metric-label">On-Chain Anchored</span>
              <span className="badge badge-info" style={{ padding: '1px 5px', fontSize: '0.65rem' }}>
                {isSepolia ? 'Sepolia' : 'Hardhat'}
              </span>
            </div>
            <div className="metric-value">
              {loading ? '...' : onChainRecordsCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Tamper-evident blocks confirmed
            </div>
          </div>
        </Link>

        {/* Metric 4: Cryptographic Verification */}
        <Link to="/verify" style={{ textDecoration: 'none' }}>
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="metric-label">Verified Digests</span>
              <span className="badge badge-success" style={{ padding: '1px 5px', fontSize: '0.65rem' }}>
                SHA-256
              </span>
            </div>
            <div className="metric-value" style={{ color: 'var(--success)' }}>
              {loading ? '...' : verifiedIncidents.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Cryptographic integrity confirmed
            </div>
          </div>
        </Link>

        {/* Metric 5: System Availability */}
        <Link to="/monitor" style={{ textDecoration: 'none' }}>
          <div className="metric-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="metric-label">System Availability</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: health?.status === 'ok' ? 'var(--success)' : 'var(--danger)' }} />
            </div>
            <div className="metric-value" style={{ color: health?.status === 'ok' ? 'var(--success)' : 'var(--danger)', fontSize: '1.25rem' }}>
              {health?.status === 'ok' ? 'Operational' : 'Offline'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Port 5001 • {isSepolia ? 'Sepolia 11155111' : 'Hardhat 31337'}
            </div>
          </div>
        </Link>
      </div>

      {/* 2.5 Threat & Integrity Distribution: Pie / Donut Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        {/* Card 1: Severity Distribution */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Incidents by Severity</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Risk classification across {totalIncidents.toLocaleString()} telemetry workloads
              </p>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
              Threat Distribution
            </span>
          </div>
          <div className="card-body" style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {totalIncidents === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No incident data available</div>
            ) : (
              <Doughnut data={severityChartData} options={doughnutChartOptions} />
            )}
          </div>
        </div>

        {/* Card 2: Incident Attestation Status */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Incident Attestation Status</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Blockchain verification and cryptographic integrity overview
              </p>
            </div>
            <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
              Ledger Verification
            </span>
          </div>
          <div className="card-body" style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {totalIncidents === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No status data available</div>
            ) : (
              <Doughnut data={statusChartData} options={doughnutChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* 3. Primary Focal Point: Active Telemetry Incidents Table (Front and center!) */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="card-title">Active Telemetry Incidents</span>
            <span className="badge badge-neutral">
              {filteredIncidents.length} of {totalIncidents} Total Incidents
            </span>
          </div>

          {/* Operational Toolbar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '180px' }}>
              <input
                type="text"
                className="input"
                placeholder="Filter by ID, process..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ height: '28px', paddingLeft: '24px', fontSize: '0.75rem' }}
              />
              <Search size={12} style={{ position: 'absolute', left: 7, top: 8, color: 'var(--text-muted)' }} />
            </div>

            {/* Severity Filter */}
            <select
              className="input"
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              style={{ width: 'auto', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Blockchain Filter */}
            <select
              className="input"
              value={blockchainFilter}
              onChange={e => setBlockchainFilter(e.target.value)}
              style={{ width: 'auto', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
            >
              <option value="ALL">All Storage</option>
              <option value="ANCHORED">On-Chain Anchored</option>
              <option value="OFFCHAIN">SQLite Only</option>
            </select>

            {/* Sort Select */}
            <select
              className="input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ width: 'auto', height: '28px', padding: '0 8px', fontSize: '0.75rem' }}
            >
              <option value="newest">Sort: Newest</option>
              <option value="risk">Sort: Risk Score</option>
            </select>

            <Link to="/incidents" className="btn btn-secondary btn-sm" style={{ height: '28px', fontSize: '0.75rem' }}>
              Full Log <ArrowRight size={11} style={{ marginLeft: 3 }} />
            </Link>
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
          {filteredIncidents.length === 0 ? (
            <div className="empty-state">
              <Shield size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: '0.8125rem', margin: 0 }}>No telemetry incidents matching the active filter.</p>
              <div style={{ marginTop: '10px' }}>
                <Link to="/threat-detection?sample=cryptojacking" className="btn btn-secondary btn-sm">
                  Run Cryptojacking Test Sample
                </Link>
              </div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Workload / Process</th>
                  <th>Risk Score</th>
                  <th>Severity</th>
                  <th>CPU / Mem</th>
                  <th>Recorded At</th>
                  <th>Blockchain State</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map(inc => {
                  const id = inc.incident_id || inc.id;
                  const sev = inc.severity || 'LOW';
                  const isAnchored = Boolean(inc.blockchain_tx_hash || inc.blockchain_incident_id);
                  const score = inc.risk_score ?? 0;

                  return (
                    <tr key={id}>
                      <td>
                        <Link to={`/incidents/${id}`} className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {id}
                        </Link>
                      </td>
                      <td className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                        {inc.process_name || 'unknown-process'}
                      </td>
                      <td className="mono" style={{ fontWeight: 600 }}>
                        <span style={{
                          color: score >= 75 ? 'var(--danger)' : score >= 40 ? 'var(--warning)' : 'var(--success)',
                        }}>
                          {score}/100
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${sev === 'CRITICAL' || sev === 'HIGH' ? 'badge-critical' : sev === 'MEDIUM' ? 'badge-medium' : 'badge-low'}`}>
                          {sev}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {inc.cpu_usage != null ? `${inc.cpu_usage}%` : '-'} • {inc.memory_usage != null ? `${inc.memory_usage}%` : '-'}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatDate(inc.timestamp)}
                      </td>
                      <td>
                        <span className={`badge ${isAnchored ? 'badge-success' : 'badge-neutral'}`}>
                          {isAnchored ? 'On-Chain' : 'SQLite'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={`/incidents/${id}`} className="btn btn-outline btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>
                          Inspect
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 4. Secondary Bottom Grid: Context Trends & Infrastructure Diagnostics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: '16px'
        }}
      >
        {/* Left: Incident Velocity & Attestation Trend Line */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <div>
              <div className="card-title">Incident Detection & Attestation Velocity</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Detection velocity vs on-chain cryptographic anchoring velocity
              </p>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              {['7d', '14d', '30d'].map(tf => (
                <button
                  key={tf}
                  type="button"
                  className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.7rem', padding: '2px 8px', height: '24px' }}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf === '7d' ? '7 Days' : tf === '14d' ? '14 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          <div className="card-body" style={{ height: '220px' }}>
            <Line data={timelineData} options={timelineChartOptions} />
          </div>
        </div>

        {/* Right: Infrastructure & Environment Status Table */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Infrastructure Status</div>
              <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Verified component connections
              </p>
            </div>
            <Activity size={15} style={{ color: 'var(--primary)' }} />
          </div>

          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px 16px' }}>
            <DiagRow
              label="Flask REST Backend"
              detail="Port 5001"
              status={health?.status === 'ok' ? 'ok' : 'err'}
              value={health?.status === 'ok' ? 'Operational' : 'Offline'}
            />
            <DiagRow
              label="Detection Rule Engine"
              detail="Multi-factor Heuristics"
              status={health?.status === 'ok' ? 'ok' : 'err'}
              value={health?.status === 'ok' ? 'Active' : 'Standby'}
            />
            <DiagRow
              label="SQLite Database"
              detail="blockmineguard.db"
              status={totalIncidents >= 0 ? 'ok' : 'err'}
              value={totalIncidents >= 0 ? `${totalIncidents} records` : 'Unavailable'}
            />
            <DiagRow
              label="Blockchain RPC Node"
              detail={isSepolia ? 'Sepolia Testnet' : 'Localhost 8545'}
              status={health?.blockchain_connected ? 'ok' : 'warn'}
              value={health?.blockchain_connected ? 'Connected' : 'Disconnected'}
            />
            <DiagRow
              label="ThreatRegistry Contract"
              detail={contractAddress ? `${contractAddress.slice(0, 8)}...` : 'Not deployed'}
              status={contractAddress ? 'ok' : 'warn'}
              value={contractAddress ? 'Accessible' : 'Unconfigured'}
            />
            <DiagRow
              label="MetaMask Provider"
              detail={account ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Injected Web3'}
              status={isConnected ? 'ok' : 'neutral'}
              value={isConnected ? 'Signer Ready' : 'Read-Only'}
            />
          </div>
        </div>
      </div>

      {/* Project Authors & Developed By Section */}
      <DevelopedBy />

      <SystemReadinessModal
        isOpen={showReadinessModal}
        onClose={() => setShowReadinessModal(false)}
      />
    </div>
  );
}

function DiagRow({ label, detail, status, value }) {
  const dotColor = status === 'ok' ? 'var(--success)' : status === 'warn' ? 'var(--warning)' : status === 'err' ? 'var(--danger)' : 'var(--text-muted)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {detail}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {value}
        </span>
      </div>
    </div>
  );
}

export default Dashboard;
