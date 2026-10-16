import React, { useState, useEffect, useCallback } from 'react';
import { evaluationApi } from '../services/api';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Info,
  Sliders,
  HelpCircle,
  BarChart3
} from 'lucide-react';

export function EvaluationCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(35);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const fetchResults = useCallback(async (evalThreshold) => {
    try {
      setError('');
      const res = await evaluationApi.getResults(evalThreshold);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load evaluation metrics:', err);
      setError('Unable to load evaluation benchmark metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(threshold);
  }, [fetchResults, threshold]);

  const handleRunEvaluation = async () => {
    setRunning(true);
    setError('');
    try {
      const res = await evaluationApi.run(Number(threshold));
      setData(res.data);
    } catch (err) {
      console.error('Evaluation run failed:', err);
      setError('Evaluation benchmark execution failed.');
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
        <RefreshCw className="spin" size={24} style={{ color: '#06b6d4', margin: '0 auto 12px' }} />
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading detection evaluation benchmark...</p>
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const cm = data?.confusion_matrix || {};
  const meta = data?.metadata || {};

  return (
    <div className="card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      {/* Header with Title and Mode Badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Activity size={20} style={{ color: '#06b6d4' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Detection Engine Evaluation Benchmark
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
            Reproducible validation pipeline evaluated against 100 labelled synthetic workloads.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge badge-info"
            style={{
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              color: '#38bdf8',
              fontSize: '0.72rem',
              padding: '4px 10px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Info size={13} />
            Academic Lab Benchmark (Safe Synthetic)
          </span>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleRunEvaluation}
            disabled={running}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={running ? 'spin' : ''} />
            {running ? 'Evaluating...' : 'Re-run Benchmark'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.8rem', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Threshold Selector Control */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(51, 65, 85, 0.4)',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sliders size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Decision Threshold:</span>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#06b6d4',
              background: 'rgba(6, 182, 212, 0.1)',
              padding: '2px 8px',
              borderRadius: '6px'
            }}
          >
            {threshold} / 100
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, maxWidth: '350px' }}>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#06b6d4', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
            {threshold < 30 ? 'High Sensitivity' : threshold > 50 ? 'Strict Precision' : 'Balanced Default'}
          </span>
        </div>
      </div>

      {/* Metric Stat Badges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#6ee7b7', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Accuracy</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>{metrics.accuracy_percent ?? 0}%</div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Overall correct</div>
        </div>

        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#7dd3fc', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Precision</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{metrics.precision_percent ?? 0}%</div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>TP / (TP + FP)</div>
        </div>

        <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#d8b4fe', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>Recall</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7', marginTop: '2px' }}>{metrics.recall_percent ?? 0}%</div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Sensitivity (TP / Actual)</div>
        </div>

        <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#fde047', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>F1-Score</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#eab308', marginTop: '2px' }}>{metrics.f1_score_percent ?? 0}%</div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Harmonic mean</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', color: '#fca5a5', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>False Positive Rate</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>{metrics.false_positive_rate_percent ?? 0}%</div>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>FP / (FP + TN)</div>
        </div>
      </div>

      {/* Confusion Matrix and Dataset Configuration Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Confusion Matrix Box */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <BarChart3 size={16} style={{ color: '#06b6d4' }} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>
              2×2 Confusion Matrix
            </h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* True Negative */}
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase' }}>True Negatives (TN)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{cm.true_negatives ?? 0}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Benign Correctly Classified</div>
            </div>

            {/* False Positive */}
            <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase' }}>False Positives (FP)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{cm.false_positives ?? 0}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Benign Flagged as Threat</div>
            </div>

            {/* False Negative */}
            <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#fcd34d', fontWeight: 700, textTransform: 'uppercase' }}>False Negatives (FN)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{cm.false_negatives ?? 0}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Threats Missed</div>
            </div>

            {/* True Positive */}
            <div style={{ background: 'rgba(6, 182, 212, 0.12)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: '#67e8f9', fontWeight: 700, textTransform: 'uppercase' }}>True Positives (TP)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#06b6d4', marginTop: '4px' }}>{cm.true_positives ?? 0}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px' }}>Cryptominers Detected</div>
            </div>
          </div>
        </div>

        {/* Dataset Configuration & Class Distribution */}
        <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#f1f5f9', fontWeight: 600 }}>
              Benchmark Dataset Metadata
            </h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
              <span style={{ color: '#94a3b8' }}>Dataset Size:</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{meta.dataset_size ?? 100} Workloads</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
              <span style={{ color: '#94a3b8' }}>Class Distribution:</span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                {meta.class_distribution?.cryptojacking_count ?? 50} Threat / {meta.class_distribution?.benign_count ?? 50} Benign (50:50)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
              <span style={{ color: '#94a3b8' }}>Evaluation Mode:</span>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>Safe Isolated Synthetic Sandbox</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: '#94a3b8' }}>Last Run Timestamp:</span>
              <span style={{ color: '#64748b', fontFamily: 'monospace' }}>
                {meta.timestamp ? new Date(meta.timestamp).toLocaleTimeString() : 'Recent'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mandatory Academic Disclaimer Box */}
      <div
        style={{
          background: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px'
        }}
      >
        <AlertTriangle size={18} style={{ color: '#eab308', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.74rem', color: '#fef08a', lineHeight: 1.5 }}>
          <strong>Research Note — Distinguishing Synthetic Lab Evaluation vs Real-World Deployment:</strong>{' '}
          {meta.disclaimer || 'These metrics are derived from safe labelled synthetic workloads in an isolated test harness. Real-world networks experience diverse benign workloads and zero-day evasions requiring continuous indicator updates.'}
        </div>
      </div>
    </div>
  );
}
