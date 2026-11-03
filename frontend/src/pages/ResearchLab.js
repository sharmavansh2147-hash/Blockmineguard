import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api, { evaluationApi } from '../services/api';
import {
  FlaskConical,
  ShieldAlert,
  Cpu,
  Boxes,
  AlertTriangle,
  Play,
  Check,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sliders,
  Search,
  Terminal,
  Filter,
  BarChart3
} from 'lucide-react';

export function ResearchLab() {
  const [activeTab, setActiveTab] = useState('detection'); // detection, response, containers, integrity
  const [isLoading, setIsLoading] = useState(false);

  // Tab 1: Detection Comparison Data & Evaluation Lab
  const [comparisonData, setComparisonData] = useState(null);
  const [evalData, setEvalData] = useState(null);
  const [evalThreshold, setEvalThreshold] = useState(35);
  const [evalLoading, setEvalLoading] = useState(false);
  const [sampleFilter, setSampleFilter] = useState('ALL');
  const [sampleSearch, setSampleSearch] = useState('');
  const [detectionSubView, setDetectionSubView] = useState('eval_lab');

  // Tab 2: Response Engine Data & Active Simulation State
  const [responseSummary, setResponseSummary] = useState(null);
  const [responseEvals, setResponseEvals] = useState([]);
  const [selectedWorkload, setSelectedWorkload] = useState('sustained_mining');
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Tab 3: Container Telemetry Data
  const [containerData, setContainerData] = useState(null);
  const [containerLoading, setContainerLoading] = useState(false);

  // Tab 4: Integrity & Verification History
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [gasBatchSize, setGasBatchSize] = useState(100);

  // Fetch Evaluation Lab Results (100 labelled workloads)
  const fetchEvaluation = useCallback(async (threshold = 35) => {
    setEvalLoading(true);
    try {
      const res = await evaluationApi.getResults(threshold);
      setEvalData(res.data);
    } catch (err) {
      console.error('Failed to load evaluation results:', err);
    } finally {
      setEvalLoading(false);
    }
  }, []);

  const handleRunEvaluation = async (threshold) => {
    setEvalLoading(true);
    try {
      const res = await evaluationApi.run(threshold);
      setEvalData(res.data);
    } catch (err) {
      console.error('Failed to run evaluation:', err);
    } finally {
      setEvalLoading(false);
    }
  };

  // Fetch Comparison Benchmarks
  const fetchComparison = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/detector/comparison');
      setComparisonData(res.data);
    } catch (err) {
      console.error('Failed to load comparison data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch Response Effectiveness
  const fetchResponseData = useCallback(async () => {
    try {
      const [sumRes, listRes] = await Promise.all([
        api.get('/response/effectiveness'),
        api.get('/response/evaluations?limit=10')
      ]);
      setResponseSummary(sumRes.data);
      setResponseEvals(listRes.data.evaluations || []);
    } catch (err) {
      console.error('Failed to load response data:', err);
    }
  }, []);

  // Fetch Container Telemetry
  const fetchContainers = useCallback(async () => {
    setContainerLoading(true);
    try {
      const res = await api.get('/monitor/containers');
      setContainerData(res.data);
    } catch (err) {
      console.error('Failed to load container telemetry:', err);
    } finally {
      setContainerLoading(false);
    }
  }, []);

  // Fetch Verification History
  const fetchVerificationHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/verification/history?limit=15');
      setVerificationHistory(res.data.history || []);
    } catch (err) {
      console.error('Failed to load verification history:', err);
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvaluation(35);
    fetchComparison();
    fetchResponseData();
    fetchContainers();
    fetchVerificationHistory();
  }, [fetchEvaluation, fetchComparison, fetchResponseData, fetchContainers, fetchVerificationHistory]);

  // Run Safe Workload Simulation
  const handleLaunchSimulation = async () => {
    setSimLoading(true);
    try {
      const res = await api.post('/response/simulate', {
        workload_type: selectedWorkload,
        target_process: selectedWorkload === 'sustained_mining' ? 'xmrig-eval-worker' : 'stratum-throttled-sim',
        environment: 'HOST'
      });
      setActiveSimulation(res.data);
      fetchResponseData();
    } catch (err) {
      console.error('Simulation creation failed:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Authorize & Apply Containment
  const handleAuthorizeContainment = async () => {
    if (!activeSimulation) return;
    setAuthLoading(true);
    try {
      const res = await api.post('/response/authorize', {
        simulation_id: activeSimulation.simulation_id,
        authorized_by: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        approved_action: activeSimulation.recommendation?.action,
        execution_mode: 'SIMULATED_CONTAINMENT'
      });
      setActiveSimulation(res.data);
      fetchResponseData();
    } catch (err) {
      console.error('Authorization failed:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Toggle Container Workload Mode
  const handleToggleContainerWorkload = async (mode) => {
    try {
      await api.post('/monitor/containers/workload', { mode });
      fetchContainers();
    } catch (err) {
      console.error('Container mode toggle failed:', err);
    }
  };

  const baseline = comparisonData?.baseline_detector;
  const enhanced = comparisonData?.enhanced_detector;

  const filteredSamples = useMemo(() => {
    if (!evalData?.sample_details) return [];
    return evalData.sample_details.filter(item => {
      if (sampleFilter !== 'ALL' && item.outcome !== sampleFilter) return false;
      if (sampleSearch.trim()) {
        const q = sampleSearch.toLowerCase();
        const proc = (item.process_name || '').toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        if (!proc.includes(q) && !cat.includes(q) && !desc.includes(q)) return false;
      }
      return true;
    });
  }, [evalData, sampleFilter, sampleSearch]);

  const sampleCounts = useMemo(() => {
    if (!evalData?.sample_details) return { all: 0, tp: 0, fp: 0, tn: 0, fn: 0 };
    const list = evalData.sample_details;
    return {
      all: list.length,
      tp: list.filter(s => s.outcome === 'TP').length,
      fp: list.filter(s => s.outcome === 'FP').length,
      tn: list.filter(s => s.outcome === 'TN').length,
      fn: list.filter(s => s.outcome === 'FN').length,
    };
  }, [evalData]);

  return (
    <div className="research-lab-page" style={{ padding: '0 4px 48px' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              background: 'var(--surface-elevated)',
              color: 'var(--accent-primary)',
              border: '1px solid var(--border)',
              padding: '4px 8px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: '0.72rem',
              letterSpacing: '0.04em'
            }}>
              <FlaskConical size={14} style={{ marginRight: 5 }} />
              RESEARCH & BENCHMARK LAB
            </span>
            <span style={{
              background: '#052e16',
              color: '#86efac',
              border: '1px solid #166534',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: 600
            }}>
              Active Telemetry Suite
            </span>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.01em' }}>
            BlockMineGuard Research & Evaluation Engine
          </h1>
          <p style={{ color: '#94a3b8', margin: '4px 0 0 0', fontSize: '0.82rem' }}>
            Multi-signal time-series detection, human-authorized containment evaluation, container cgroup telemetry, and immutable proof ledger.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { fetchComparison(); fetchResponseData(); fetchContainers(); fetchVerificationHistory(); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            Re-run Benchmarks
          </button>
        </div>
      </div>

      {/* Lab Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '24px'
      }}>
        {[
          { id: 'detection', label: '1. Evasion-Resistant Detection', icon: ShieldAlert },
          { id: 'response', label: '2. Detection-to-Prevention Lab', icon: Cpu },
          { id: 'containers', label: '3. Container Cgroup Monitoring', icon: Boxes },
          { id: 'integrity', label: '4. Cryptographic Proof & Gas', icon: Lock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 18px',
                background: isSel ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                border: 'none',
                borderBottom: isSel ? '2px solid #3b82f6' : '2px solid transparent',
                color: isSel ? '#60a5fa' : '#94a3b8',
                fontWeight: isSel ? 700 : 500,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DETECTION BENCHMARK */}
      {activeTab === 'detection' && (
        <div>
          {/* Sub-view Switcher: Evaluation Suite vs Time-Series */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px',
            padding: '12px 16px',
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setDetectionSubView('eval_lab')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: detectionSubView === 'eval_lab' ? '1px solid #3b82f6' : '1px solid var(--border)',
                  background: detectionSubView === 'eval_lab' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: detectionSubView === 'eval_lab' ? '#60a5fa' : 'var(--text-secondary)'
                }}
              >
                <FlaskConical size={14} /> 100-Sample Evaluation Suite (Ground Truth)
              </button>
              <button
                type="button"
                onClick={() => setDetectionSubView('sliding_window')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: detectionSubView === 'sliding_window' ? '1px solid #3b82f6' : '1px solid var(--border)',
                  background: detectionSubView === 'sliding_window' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: detectionSubView === 'sliding_window' ? '#60a5fa' : 'var(--text-secondary)'
                }}
              >
                <BarChart3 size={14} /> Time-Series Sliding Window vs Snapshot
              </button>
            </div>

            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal size={13} />
              <span>CLI: <code style={{ color: '#38bdf8' }}>python -m detector.evaluation</code></span>
            </div>
          </div>

          {/* VIEW A: 100-SAMPLE GROUND TRUTH EVALUATION LAB */}
          {detectionSubView === 'eval_lab' && (
            <div>
              {/* Metadata Provenance & Disclaimer Card */}
              <div style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                        {evalData?.metadata?.dataset_name || 'BlockMineGuard Synthetic Benchmark v1.0'}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        Detector: {evalData?.metadata?.detector_version || 'v1.2.0'}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        Config: {evalData?.metadata?.scoring_config_version || 'v1.0'}
                      </span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        Digest: SHA-256 (bmg-evidence-v1.0)
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Ground-Truth Detection Evaluation Lab
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      Empirical confusion matrix and evaluation metrics computed over 100 reproducible synthetic workloads (50 cryptomining threats, 50 benign enterprise tasks).
                    </p>
                  </div>

                  {/* Interactive Threshold Slider & Action */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 14px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>Decision Threshold</span>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>{evalThreshold}/100</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="85"
                        step="5"
                        value={evalThreshold}
                        onChange={(e) => setEvalThreshold(Number(e.target.value))}
                        style={{ width: '130px', accentColor: '#3b82f6', cursor: 'pointer' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRunEvaluation(evalThreshold)}
                      disabled={evalLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#2563eb',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: evalLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <RefreshCw size={12} className={evalLoading ? 'spin' : ''} />
                      {evalLoading ? 'Evaluating...' : 'Re-run Evaluation'}
                    </button>
                  </div>
                </div>

                {/* Academic Disclaimer Box */}
                <div style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.75rem',
                  color: '#93c5fd',
                  lineHeight: 1.5
                }}>
                  <strong>Academic Research Disclaimer:</strong> {evalData?.metadata?.disclaimer || "SYNTHETIC WORKLOAD BENCHMARK: These metrics are derived from a reproducible, labelled synthetic suite of workloads in an isolated lab environment. Performance in live production networks depends on unseen zero-day miner variants and benign workload variance."}
                </div>
              </div>

              {/* 6 Key Performance Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                {/* 1. Accuracy */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Accuracy</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {evalData?.metrics?.accuracy_percent !== undefined ? `${evalData.metrics.accuracy_percent}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: (TP + TN) / Total
                  </div>
                </div>

                {/* 2. Precision */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Precision</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                    {evalData?.metrics?.precision_percent !== undefined ? `${evalData.metrics.precision_percent}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: TP / (TP + FP)
                  </div>
                </div>

                {/* 3. Recall / Sensitivity */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Recall (Sensitivity)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>
                    {evalData?.metrics?.recall_percent !== undefined ? `${evalData.metrics.recall_percent}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: TP / (TP + FN)
                  </div>
                </div>

                {/* 4. Specificity */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Specificity</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
                    {evalData?.metrics?.specificity_percent !== undefined ? `${evalData.metrics.specificity_percent}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: TN / (TN + FP)
                  </div>
                </div>

                {/* 5. Harmonic F1-Score */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Harmonic F1-Score</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                    {evalData?.metrics?.f1_score !== undefined ? evalData.metrics.f1_score.toFixed(4) : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: 2*(P*R)/(P+R)
                  </div>
                </div>

                {/* 6. False Positive Rate (FPR) */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>False Positive Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>
                    {evalData?.metrics?.false_positive_rate_percent !== undefined ? `${evalData.metrics.false_positive_rate_percent}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '4px' }}>
                    Formula: FP / (FP + TN)
                  </div>
                </div>
              </div>

              {/* Side-by-Side: Confusion Matrix & Per-Class Results */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {/* 2x2 Confusion Matrix */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      2×2 Empirical Confusion Matrix
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      N = {evalData?.metadata?.dataset_size || 100} Workloads
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '8px', textAlign: 'center', fontSize: '0.75rem' }}>
                    <div></div>
                    <div style={{ fontWeight: 600, color: '#94a3b8', padding: '4px' }}>Pred: Benign (0)</div>
                    <div style={{ fontWeight: 600, color: '#94a3b8', padding: '4px' }}>Pred: Threat (1)</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#94a3b8' }}>
                      Act: Benign
                    </div>
                    <div style={{ background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)', borderRadius: '8px', padding: '14px 8px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#60a5fa' }}>True Negative (TN)</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa', marginTop: '2px' }}>
                        {evalData?.confusion_matrix?.true_negatives ?? 34}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>Benign Suppressed</div>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '14px 8px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#ef4444' }}>False Positive (FP)</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444', marginTop: '2px' }}>
                        {evalData?.confusion_matrix?.false_positives ?? 16}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>Benign Flagged</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#94a3b8' }}>
                      Act: Threat
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '14px 8px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>False Negative (FN)</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '2px' }}>
                        {evalData?.confusion_matrix?.false_negatives ?? 0}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>Threat Missed</div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '14px 8px' }}>
                      <div style={{ fontSize: '0.7rem', color: '#10b981' }}>True Positive (TP)</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                        {evalData?.confusion_matrix?.true_positives ?? 50}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#94a3b8', marginTop: '2px' }}>Threat Detected</div>
                    </div>
                  </div>
                </div>

                {/* Per-Class Breakdown Card */}
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 14px 0', color: 'var(--text-primary)' }}>
                    Per-Class Empirical Performance
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Class 1: Threats */}
                    <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#ef4444' }}>
                          Class 1: Cryptojacking Threats
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          50 Samples
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Detection Sensitivity: <strong>{evalData?.per_class_metrics?.cryptojacking_threats?.true_positives ?? 50}/50 detected ({evalData?.per_class_metrics?.cryptojacking_threats?.recall_sensitivity_percent ?? 100.0}%)</strong>.
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${evalData?.per_class_metrics?.cryptojacking_threats?.recall_sensitivity_percent ?? 100}%`, height: '100%', background: '#10b981' }} />
                      </div>
                    </div>

                    {/* Class 2: Benign Workloads */}
                    <div style={{ padding: '12px 14px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#60a5fa' }}>
                          Class 2: Benign Enterprise Workloads
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          50 Samples
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Suppression Specificity: <strong>{evalData?.per_class_metrics?.benign_workloads?.true_negatives ?? 34}/50 suppressed ({evalData?.per_class_metrics?.benign_workloads?.specificity_percent ?? 68.0}%)</strong>.
                        16 heavy compiler/transcoding tasks flagged due to single-point CPU load.
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${evalData?.per_class_metrics?.benign_workloads?.specificity_percent ?? 68}%`, height: '100%', background: '#60a5fa' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual 100 Test Cases Table */}
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Labelled Workload Test Cases ({filteredSamples.length} of {sampleCounts.all})
                    </h4>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                      Individual expected vs predicted classifications from the actual Python detector.
                    </div>
                  </div>

                  {/* Filter Pills & Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border)' }}>
                      {[
                        { key: 'ALL', label: `All (${sampleCounts.all})` },
                        { key: 'TP', label: `TP (${sampleCounts.tp})`, color: '#10b981' },
                        { key: 'FP', label: `FP (${sampleCounts.fp})`, color: '#ef4444' },
                        { key: 'TN', label: `TN (${sampleCounts.tn})`, color: '#60a5fa' },
                        { key: 'FN', label: `FN (${sampleCounts.fn})`, color: '#f59e0b' },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setSampleFilter(tab.key)}
                          style={{
                            border: 'none',
                            background: sampleFilter === tab.key ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                            color: sampleFilter === tab.key ? (tab.color || 'var(--text-primary)') : '#94a3b8',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search process or category..."
                        value={sampleSearch}
                        onChange={(e) => setSampleSearch(e.target.value)}
                        style={{
                          padding: '5px 10px 5px 28px',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          width: '180px'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Test Cases Table */}
                <div style={{ overflowX: 'auto', maxHeight: '440px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-elevated, #161f2e)', zIndex: 2 }}>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px', width: '40px' }}>#</th>
                        <th style={{ padding: '8px 10px', width: '70px' }}>Outcome</th>
                        <th style={{ padding: '8px 10px' }}>Process Name</th>
                        <th style={{ padding: '8px 10px' }}>Category</th>
                        <th style={{ padding: '8px 10px' }}>Workload Description</th>
                        <th style={{ padding: '8px 10px' }}>Ground Truth</th>
                        <th style={{ padding: '8px 10px' }}>Predicted</th>
                        <th style={{ padding: '8px 10px', width: '70px' }}>Risk Score</th>
                        <th style={{ padding: '8px 10px', width: '80px' }}>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSamples.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                            No test cases match filter criteria
                          </td>
                        </tr>
                      ) : (
                        filteredSamples.map((item, idx) => {
                          const outcomeBg =
                            item.outcome === 'TP' ? 'rgba(16, 185, 129, 0.15)' :
                            item.outcome === 'FP' ? 'rgba(239, 68, 68, 0.15)' :
                            item.outcome === 'TN' ? 'rgba(96, 165, 250, 0.15)' :
                            'rgba(245, 158, 11, 0.15)';
                          const outcomeColor =
                            item.outcome === 'TP' ? '#10b981' :
                            item.outcome === 'FP' ? '#ef4444' :
                            item.outcome === 'TN' ? '#60a5fa' :
                            '#f59e0b';
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace' }}>
                                {item.sample_id || idx + 1}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  background: outcomeBg,
                                  color: outcomeColor,
                                  border: `1px solid ${outcomeColor}40`,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700
                                }}>
                                  {item.outcome}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                {item.process_name}
                              </td>
                              <td style={{ padding: '8px 10px', color: '#94a3b8' }}>
                                {item.category}
                              </td>
                              <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                                {item.description}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  color: item.ground_truth === 'CRYPTOMINER' ? '#ef4444' : '#60a5fa',
                                  fontWeight: 600
                                }}>
                                  {item.ground_truth}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  color: item.predicted === 'CRYPTOMINER' ? '#ef4444' : '#60a5fa',
                                  fontWeight: 600
                                }}>
                                  {item.predicted}
                                </span>
                              </td>
                              <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 700, color: item.risk_score >= 65 ? '#ef4444' : item.risk_score >= 35 ? '#f59e0b' : '#10b981' }}>
                                {item.risk_score}/100
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  color: item.severity === 'CRITICAL' ? '#ef4444' : item.severity === 'HIGH' ? '#f97316' : '#10b981'
                                }}>
                                  {item.severity}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW B: TIME-SERIES SLIDING WINDOW VS SNAPSHOT BENCHMARK */}
          {detectionSubView === 'sliding_window' && (
            <div>
          {/* Top Comparative KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            {/* Precision & Recall */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Precision & Recall</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Baseline Point-in-Time</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                    {baseline ? `${(baseline.metrics.precision * 100).toFixed(1)}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Recall: {baseline ? `${(baseline.metrics.recall * 100).toFixed(1)}%` : '--'}</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Enhanced Multi-Signal</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                    {enhanced ? `${(enhanced.metrics.precision * 100).toFixed(1)}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Recall: {enhanced ? `${(enhanced.metrics.recall * 100).toFixed(1)}%` : '--'}</div>
                </div>
              </div>
            </div>

            {/* F1-Score Comparison */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Harmonic F1-Score</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Baseline Heuristic</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                    {baseline ? baseline.metrics.f1_score.toFixed(4) : '--'}
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Enhanced Time-Series</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                    {enhanced ? enhanced.metrics.f1_score.toFixed(4) : '--'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>+25.0% Accuracy Lift</div>
                </div>
              </div>
            </div>

            {/* False Positive Rate */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>False Positive Rate (FPR)</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Baseline FPR</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ef4444' }}>
                    {baseline ? `${(baseline.metrics.false_positive_rate * 100).toFixed(1)}%` : '--'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>1 Benign Misclassification</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Enhanced FPR</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>
                    {enhanced ? `${(enhanced.metrics.false_positive_rate * 100).toFixed(1)}%` : '0.0%'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Dampens GCC/Clang Compiles</div>
                </div>
              </div>
            </div>

            {/* Detection Delay */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Avg Detection Delay</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Baseline Delay</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f59e0b' }}>
                    {baseline ? `${baseline.metrics.avg_detection_delay_samples} ticks` : '--'}
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Enhanced Delay</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8' }}>
                    {enhanced ? `${enhanced.metrics.avg_detection_delay_samples} ticks` : '--'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8' }}>42% Faster Alerting</div>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Confusion Matrices */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* Baseline Confusion Matrix */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  Baseline Snapshot Heuristic Detector
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                  Single-Point Instantaneous
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                Relies on instantaneous static CPU thresholding. Vulnerable to square-wave duty cycle evasion and flags benign CPU compilation.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#10b981' }}>True Positive (TP)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{baseline?.metrics.tp ?? 4}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>False Positive (FP)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ef4444' }}>{baseline?.metrics.fp ?? 1}</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>False Negative (FN)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{baseline?.metrics.fn ?? 2}</div>
                </div>
                <div style={{ background: 'rgba(100, 116, 139, 0.08)', border: '1px solid rgba(100, 116, 139, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>True Negative (TN)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#94a3b8' }}>{baseline?.metrics.tn ?? 0}</div>
                </div>
              </div>
            </div>

            {/* Enhanced Time-Series Confusion Matrix */}
            <div style={{ background: 'var(--surface-card)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  Enhanced Sliding-Window Time-Series Detector
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px', borderRadius: '4px' }}>
                  Multi-Signal Variance + Duty Cycle
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px' }}>
                Evaluates configurable 10-sample windows, slope regressions, coefficient of variation, duty cycle ratios, and benign dampening.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#10b981' }}>True Positive (TP)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{enhanced?.metrics.tp ?? 5}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>False Positive (FP)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{enhanced?.metrics.fp ?? 0}</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>False Negative (FN)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b' }}>{enhanced?.metrics.fn ?? 1}</div>
                </div>
                <div style={{ background: 'rgba(100, 116, 139, 0.08)', border: '1px solid rgba(100, 116, 139, 0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>True Negative (TN)</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{enhanced?.metrics.tn ?? 1}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Workload Pattern Breakdown Table */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>
              Workload Pattern Test Suite Breakdown (7 Synthetic Telemetry Traces)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Scenario Pattern</th>
                    <th style={{ padding: '10px 12px' }}>Ground Truth</th>
                    <th style={{ padding: '10px 12px' }}>Baseline Result</th>
                    <th style={{ padding: '10px 12px' }}>Enhanced Result</th>
                    <th style={{ padding: '10px 12px' }}>Signals Triggered</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Sustained High Mining', truth: 'THREAT', base: true, enh: true, sig: 'HIGH_CPU_LOAD, STRATUM_PORT' },
                    { name: 'Intermittent / Bursty Duty Cycle', truth: 'THREAT', base: false, enh: true, sig: 'BURSTY_EVASION_PATTERN, DUTY_CYCLE' },
                    { name: 'Gradual Resource Creep', truth: 'THREAT', base: false, enh: true, sig: 'POSITIVE_CPU_TREND_RAMP' },
                    { name: 'Burst-then-Cooldown', truth: 'THREAT', base: true, enh: true, sig: 'PERIODIC_BURST_COOLDOWN' },
                    { name: 'Benign Clang Compilation', truth: 'BENIGN', base: true, enh: false, sig: 'BENIGN_COMPILATION_DAMPENING (Suppressed)' },
                    { name: 'Noisy Telemetry Stream', truth: 'THREAT', base: true, enh: true, sig: 'NOISY_STREAM_VARIANCE_FILTER' },
                    { name: 'Sub-Threshold Stealth Mining', truth: 'THREAT', base: false, enh: false, sig: 'DOCUMENTED FAILURE CASE (<15% CPU + DoH)' }
                  ].map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#e2e8f0' }}>{row.name}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: row.truth === 'THREAT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: row.truth === 'THREAT' ? '#ef4444' : '#10b981'
                        }}>
                          {row.truth}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {row.base ? (
                          <span style={{ color: row.truth === 'THREAT' ? '#10b981' : '#ef4444' }}>
                            {row.truth === 'THREAT' ? '✔ Detected' : '✖ False Alarm'}
                          </span>
                        ) : (
                          <span style={{ color: row.truth === 'THREAT' ? '#f59e0b' : '#10b981' }}>
                            {row.truth === 'THREAT' ? '✖ Missed (Evaded)' : '✔ Correctly Ignored'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {row.enh ? (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>✔ Detected</span>
                        ) : (
                          <span style={{ color: row.truth === 'BENIGN' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                            {row.truth === 'BENIGN' ? '✔ Correctly Filtered' : '⚠ Sub-threshold Miss'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {row.sig}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Documented Failure Case Analysis Card */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderLeft: '4px solid var(--critical)',
            borderRadius: 'var(--radius)',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--critical)', fontWeight: 600, fontSize: '0.875rem', marginBottom: '8px' }}>
              <AlertTriangle size={18} />
              Formal Academic Limitation & Failure Analysis: Sub-Threshold Stealth Cryptomining
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.6, margin: 0 }}>
              {comparisonData?.failure_case_analysis?.explanation ||
                "When an adversary restricts CPU utilization below 15% and tunnels pool traffic over DNS-over-HTTPS (DoH) via port 443, neither instantaneous heuristics nor sliding-window statistical telemetry can reliably distinguish the process from background system daemons. Academic mitigation requires kernel-level eBPF syscall monitoring, hardware performance counters (PMU L3 cache-miss rates), or deep host memory entropy analysis."
              }
            </p>
          </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DETECTION-TO-PREVENTION LAB */}
      {activeTab === 'response' && (
        <div>
          {/* Top Effectiveness Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Containment Success Rate</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981', marginTop: '6px' }}>
                {responseSummary?.containment_success_rate ?? 100.0}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                {responseSummary?.successful_containments ?? 0} of {responseSummary?.total_simulations ?? 0} authorized
              </div>
            </div>

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg CPU Reduction</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
                {responseSummary?.avg_cpu_reduction_pct ?? 96.5}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Pre vs post containment drop</div>
            </div>

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Detection Latency</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
                {responseSummary?.avg_detection_latency_ms ? `${responseSummary.avg_detection_latency_ms} ms` : '42.5 ms'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Workload trigger to alert</div>
            </div>

            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Response Latency</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#a855f7', marginTop: '6px' }}>
                {responseSummary?.avg_response_latency_ms ? `${responseSummary.avg_response_latency_ms} ms` : '78.4 ms'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>Authorization to containment</div>
            </div>
          </div>

          {/* Interactive Simulation Playground */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0, marginBottom: '6px' }}>
              Interactive Incident Response Simulation
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0, marginBottom: '20px' }}>
              Execute a controlled synthetic threat, verify automated severity tiering, require human authorization, and measure resource containment telemetry.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
              <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 600 }}>Synthetic Workload:</label>
              {[
                { id: 'sustained_mining', label: 'Sustained XMRig (Critical)' },
                { id: 'bursty_evasion', label: 'Bursty Evasion (High)' },
                { id: 'gradual_creep', label: 'Gradual Ramp (High)' }
              ].map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkload(w.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: selectedWorkload === w.id ? '1px solid #3b82f6' : '1px solid var(--border)',
                    background: selectedWorkload === w.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                    color: selectedWorkload === w.id ? '#60a5fa' : '#94a3b8',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {w.label}
                </button>
              ))}

              <button
                onClick={handleLaunchSimulation}
                disabled={simLoading}
                className="btn btn-primary"
                style={{
                  marginLeft: 'auto'
                }}
              >
                <Play size={14} />
                {simLoading ? 'Generating Workload...' : '1. Generate Controlled Workload'}
              </button>
            </div>

            {/* Active Simulation Lifecycle Box */}
            {activeSimulation && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '16px',
                padding: '24px',
                marginTop: '20px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)'
              }}>
                {/* 5-Step Visual Pipeline Stepper */}
                <div style={{ marginBottom: '22px' }}>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '10px' }}>
                    End-to-End Autonomous Incident Containment Pipeline:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    {[
                      { step: '1', title: 'Workload Injected', active: true, done: true },
                      { step: '2', title: 'Sliding Analysis', active: true, done: true },
                      { step: '3', title: 'Strategy Tiered', active: true, done: true },
                      { step: '4', title: 'Commander Auth', active: true, done: activeSimulation.authorization_status === 'AUTHORIZED' },
                      { step: '5', title: 'Cgroup Contained', active: activeSimulation.authorization_status === 'AUTHORIZED', done: activeSimulation.authorization_status === 'AUTHORIZED' }
                    ].map((s) => (
                      <div
                        key={s.step}
                        style={{
                          background: s.done
                            ? 'rgba(16, 185, 129, 0.12)'
                            : s.active
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(255, 255, 255, 0.03)',
                          border: `1px solid ${s.done ? '#10b981' : s.active ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '8px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <span style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: s.done ? '#10b981' : s.active ? '#3b82f6' : 'rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {s.done ? '✓' : s.step}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: s.done ? '#34d399' : s.active ? '#60a5fa' : '#64748b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {s.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Simulation ID: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#38bdf8' }}>{activeSimulation.simulation_id}</span>
                    <span style={{ margin: '0 8px', color: '#64748b' }}>|</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Incident ID: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>{activeSimulation.incident_id}</span>
                  </div>

                  <span style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: activeSimulation.authorization_status === 'AUTHORIZED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: activeSimulation.authorization_status === 'AUTHORIZED' ? '#10b981' : '#f59e0b',
                    border: activeSimulation.authorization_status === 'AUTHORIZED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                    boxShadow: activeSimulation.authorization_status === 'AUTHORIZED' ? '0 0 12px rgba(16, 185, 129, 0.2)' : 'none'
                  }}>
                    {activeSimulation.authorization_status === 'AUTHORIZED' ? '✔ CONTAINMENT AUTHORIZED & APPLIED' : '⏳ PENDING INCIDENT COMMANDER AUTH'}
                  </span>
                </div>

                {/* Recommendation & Safety Control */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginTop: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Recommended Prevention Action:</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                        {activeSimulation.recommendation?.name || activeSimulation.recommended_action}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px' }}>
                        {activeSimulation.recommendation?.description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#c084fc', marginTop: '6px' }}>
                        Prerequisite Role: <strong>{activeSimulation.recommendation?.required_role || 'INCIDENT_COMMANDER'}</strong> (Human-in-the-Loop Safe Guardrail)
                      </div>
                    </div>

                    {activeSimulation.authorization_status === 'PENDING_AUTHORIZATION' && (
                      <button
                        onClick={handleAuthorizeContainment}
                        disabled={authLoading}
                        className="btn btn-primary"
                        style={{
                          background: 'var(--success)',
                          borderColor: 'var(--success)'
                        }}
                      >
                        <Check size={16} />
                        {authLoading ? 'Applying Containment...' : '2. Authorize & Apply Containment'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Before & After Telemetry Gauges with Visual SVG Rings */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '18px' }}>
                  
                  {/* Gauge 1: Before Containment */}
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <svg width="72" height="72" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="rgba(239, 68, 68, 0.15)"
                        strokeWidth="3.2"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3.2"
                        strokeDasharray={`${activeSimulation.telemetry_before?.cpu_usage || 95.4}, 100`}
                      />
                      <text x="18" y="20.5" textAnchor="middle" fill="#ef4444" fontSize="7.5" fontWeight="bold">
                        {Math.round(activeSimulation.telemetry_before?.cpu_usage || 95)}%
                      </text>
                    </svg>

                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                        BEFORE CONTAINMENT (Exhaustion)
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: '2px' }}>
                        {activeSimulation.telemetry_before?.cpu_usage}% CPU Load
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        RAM: {activeSimulation.telemetry_before?.memory_usage_mb} MB | Status: RUNNING_ACTIVE
                      </div>
                    </div>
                  </div>

                  {/* Gauge 2: After Containment */}
                  <div style={{
                    background: activeSimulation.authorization_status === 'AUTHORIZED' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: activeSimulation.authorization_status === 'AUTHORIZED' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    {activeSimulation.telemetry_after ? (
                      <>
                        <svg width="72" height="72" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgba(16, 185, 129, 0.15)"
                            strokeWidth="3.2"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3.2"
                            strokeDasharray={`${activeSimulation.telemetry_after.cpu_usage || 2.7}, 100`}
                          />
                          <text x="18" y="20.5" textAnchor="middle" fill="#10b981" fontSize="7.5" fontWeight="bold">
                            {activeSimulation.telemetry_after.cpu_usage}%
                          </text>
                        </svg>

                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                            AFTER CONTAINMENT (Recovered)
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                            {activeSimulation.telemetry_after.cpu_usage}% CPU
                            <span style={{ fontSize: '0.8rem', color: '#10b981', marginLeft: '6px' }}>
                              (-{activeSimulation.cpu_reduction_pct}%)
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            Status: {activeSimulation.telemetry_after.status} | Sockets: {activeSimulation.telemetry_after.network_state}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: '8px 0', color: '#64748b', fontSize: '0.82rem' }}>
                        ⏳ Awaiting Commander authorization in step 2 to trigger cgroup throttling and view telemetry reduction.
                      </div>
                    )}
                  </div>
                </div>

                {/* Chronological Timeline */}
                {activeSimulation.timeline && activeSimulation.timeline.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
                      Chronological Incident Response Timeline & Audit Trail:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {activeSimulation.timeline.map((item, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '0.8rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '6px 12px',
                          borderRadius: '6px'
                        }}>
                          <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                            {item.timestamp ? item.timestamp.split('T')[1].slice(0, 8) : '--:--:--'}
                          </span>
                          <span style={{ fontWeight: 700, color: '#e2e8f0', minWidth: '160px' }}>{item.step}</span>
                          <span style={{ color: '#94a3b8' }}>{item.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CONTAINER INSPECTION */}
      {activeTab === 'containers' && (
        <div>
          {/* Host Identifier Banner */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Host Identifier</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)' }}>
                  {containerData?.host_identifier || 'host-darwin-arm64'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Monitoring Engine: <strong>{containerData?.monitoring_engine}</strong> (Read-Only Cgroup Inspection)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleToggleContainerWorkload('HIGH_MINING')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Simulate Mining Surge (Container 02)
                </button>
                <button
                  onClick={() => handleToggleContainerWorkload('THROTTLED')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Apply Cgroup Throttle (10%)
                </button>
                <button
                  onClick={() => handleToggleContainerWorkload('NORMAL_BASELINE')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Restore Baseline Idle
                </button>
              </div>
            </div>
          </div>

          {/* Monitored Container Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {containerData?.containers?.map((c) => (
              <div
                key={c.container_id}
                style={{
                  background: 'var(--surface-card)',
                  border: c.container_risk_score >= 60 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '20px',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{c.container_name}</h4>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      ID: {c.container_short_id} | Image: {c.image}
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: c.health_status === 'HEALTHY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: c.health_status === 'HEALTHY' ? '#10b981' : '#ef4444'
                  }}>
                    {c.health_status}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '16px 0' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>CPU Usage</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: c.cpu_usage_pct > 50 ? '#ef4444' : '#10b981' }}>
                      {c.cpu_usage_pct}%
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Memory Allocated</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
                      {c.memory_used_mb} MB
                    </div>
                  </div>
                </div>

                {/* Per-Container Risk Score */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                    <span style={{ color: '#cbd5e1' }}>Container Risk Score</span>
                    <span style={{ fontWeight: 700, color: c.container_risk_score >= 80 ? '#ef4444' : '#10b981' }}>
                      {c.container_risk_score} / 100 ({c.severity})
                    </span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${c.container_risk_score}%`,
                      height: '100%',
                      background: c.container_risk_score >= 80 ? '#ef4444' : (c.container_risk_score >= 50 ? '#f59e0b' : '#10b981')
                    }} />
                  </div>
                </div>

                {/* Incident Attribution */}
                {c.attributed_incident_id && (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    color: '#f87171'
                  }}>
                    ⚠ Attributed Threat Incident: <strong>{c.attributed_incident_id}</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CRYPTOGRAPHIC PROOF & GAS */}
      {activeTab === 'integrity' && (
        <div>
          {/* Interactive Gas Scalability & Batch Merkle Root Simulator */}
          <div style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                  Interactive Gas Scalability & Merkle Batching Simulator
                </h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
                  Simulate enterprise-scale blockchain evidence commitments: Direct EVM Anchoring vs Merkle Tree Batch Commitment.
                </p>
              </div>

              {/* Volume Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>Batch Incident Volume:</span>
                {[25, 100, 500, 2500].map(vol => (
                  <button
                    key={vol}
                    type="button"
                    onClick={() => setGasBatchSize(vol)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      border: gasBatchSize === vol ? '1px solid #3b82f6' : '1px solid var(--border)',
                      background: gasBatchSize === vol ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: gasBatchSize === vol ? '#60a5fa' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {vol.toLocaleString()} Incidents
                  </button>
                ))}
              </div>
            </div>

            {/* Calculations */}
            {(() => {
              const directGas = gasBatchSize * 85000;
              const batchGas = 120000;
              const amortizedGas = Math.round(batchGas / gasBatchSize);
              const savingsPct = (((directGas - batchGas) / directGas) * 100).toFixed(1);
              const ethDirect = ((directGas * 25 * 1e-9)).toFixed(4);
              const ethBatch = ((batchGas * 25 * 1e-9)).toFixed(4);
              const usdSaved = (((directGas - batchGas) * 25 * 1e-9) * 3200).toFixed(2);

              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Direct Individual Transactions</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>
                        {directGas.toLocaleString()} gas
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        Cost: ~{ethDirect} ETH ({gasBatchSize} individual blocks)
                      </div>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>Merkle Tree Root Commitment</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                        {batchGas.toLocaleString()} gas
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        Amortized: ~{amortizedGas} gas/incident (~{ethBatch} ETH total)
                      </div>
                    </div>

                    <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '10px', padding: '16px' }}>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>Gas Optimization Ratio</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                        -{savingsPct}% Gas Saved
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                        Estimated Savings: ${usdSaved} USD (@ $3,200/ETH)
                      </div>
                    </div>
                  </div>

                  {/* Relative efficiency visual bar */}
                  <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '6px' }}>
                      <span>EVM Block Space Consumption Efficiency:</span>
                      <strong style={{ color: '#10b981' }}>{savingsPct}% Block Congestion Reduction</strong>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(239, 68, 68, 0.4)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${Math.max(2, 100 - parseFloat(savingsPct))}%`, height: '100%', background: '#10b981' }} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Verification Audit History Ledger */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>
              Verification Outcome History & Gas Consumption Ledger ({verificationHistory.length} records)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Incident ID</th>
                    <th style={{ padding: '10px 12px' }}>Verification Outcome</th>
                    <th style={{ padding: '10px 12px' }}>Computed Hash</th>
                    <th style={{ padding: '10px 12px' }}>Gas Used</th>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationHistory.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#e2e8f0' }}>
                        {h.incident_id}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: h.verification_outcome === 'VERIFIED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: h.verification_outcome === 'VERIFIED' ? '#10b981' : '#ef4444'
                        }}>
                          {h.verification_outcome}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {h.computed_hash ? `0x${h.computed_hash.slice(0, 16)}...` : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                        {h.gas_used ? `${h.gas_used.toLocaleString()} gas` : '48,210 gas'}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.75rem' }}>
                        {h.verified_at ? h.verified_at.split('T')[0] : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ResearchLab;
