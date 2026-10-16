import React, { useState, useEffect, useCallback } from 'react';
import { threatIntelApi, reportersApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import {
  Plus,
  Search,
  Filter,
  Shield,
  CheckCircle,
  AlertTriangle,
  Globe,
  Hash,
  Server,
  FileText,
  ExternalLink,
  Loader2,
  Check,
  Award,
  Vote,
  XCircle,
  HelpCircle,
  TrendingUp,
  RefreshCw,
  Sparkles
} from 'lucide-react';

const indicatorTypes = [
  { value: 'domain', label: 'Domain', icon: Globe },
  { value: 'ip', label: 'IP Address', icon: Server },
  { value: 'mining_pool', label: 'Mining Pool', icon: Shield },
  { value: 'process', label: 'Process Name', icon: FileText },
  { value: 'url', label: 'URL', icon: ExternalLink },
  { value: 'hash', label: 'File Hash', icon: Hash },
];

const PRESET_INDICATORS = [
  {
    type: 'mining_pool',
    indicator: 'stratum+tcp://pool.supportxmr.com:3333',
    description: 'High-volume Monero mining pool endpoint frequently targeted by cryptojacking worms',
    campaign: 'XMR-GLOBAL-01'
  },
  {
    type: 'ip',
    indicator: '194.38.20.12:443',
    description: 'Kinsing worm C2 server orchestrating Redis & Docker daemon exploitation',
    campaign: 'KINSING-MALWARE'
  },
  {
    type: 'domain',
    indicator: 'mine.xmrpool.net',
    description: 'Cryptonight / RandomX mining pool domain used in unauthorized cloud compute hijacking',
    campaign: 'CLOUD-JACK-99'
  },
  {
    type: 'process',
    indicator: 'xmrig-cuda-proxy',
    description: 'Stealthy GPU-accelerated XMRig miner masquerading as NVIDIA CUDA daemon',
    campaign: 'STEALTH-GPU-02'
  }
];

export function ThreatIntelligence() {
  const { showToast } = useApp();
  const { isConnected, account } = useWallet();

  const [intelligence, setIntelligence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, VERIFIED, PENDING, DISPUTED
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Add Indicator Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formData, setFormData] = useState({
    indicator: '',
    indicator_type: 'mining_pool',
    description: '',
    campaign_id: '',
    confidence_score: 85
  });

  // Review & Consensus Modal
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewAction, setReviewAction] = useState('VERIFY'); // VERIFY, REJECT, DISPUTE
  const [reviewConfidence, setReviewConfidence] = useState(90);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);

  // Reputation modal
  const [selectedReporter, setSelectedReporter] = useState(null);
  const [reporterReputation, setReporterReputation] = useState(null);

  const loadIntelligence = useCallback(async () => {
    setLoading(true);
    try {
      const response = await threatIntelApi.getAll(false);
      setIntelligence(response.data.threat_intelligence || []);
    } catch (error) {
      console.error('Failed to load threat intelligence:', error);
      showToast('Failed to load threat intelligence feed', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.indicator.trim()) {
      showToast('Please enter an indicator value', 'warning');
      return;
    }

    try {
      setAdding(true);
      await threatIntelApi.create(formData);
      showToast('Threat indicator anchored to intelligence feed!', 'success');
      setShowAddModal(false);
      setFormData({
        indicator: '',
        indicator_type: 'mining_pool',
        description: '',
        campaign_id: '',
        confidence_score: 85
      });
      await loadIntelligence();
    } catch (error) {
      showToast(
        error.response?.data?.error || error.message || 'Failed to submit intelligence indicator',
        'error'
      );
    } finally {
      setAdding(false);
    }
  };

  const handleOpenReview = (item) => {
    setReviewItem(item);
    setReviewAction(item.status === 'VERIFIED' ? 'VERIFY' : 'VERIFY');
    setReviewConfidence(item.confidence_score ? Math.round(item.confidence_score * 100) : 90);
    setReviewNotes('');
  };

  const handleSubmitReview = async () => {
    if (!reviewItem) return;
    setReviewing(true);
    try {
      const reviewer = account || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
      await threatIntelApi.review(reviewItem.intel_id, {
        reviewer_address: reviewer,
        action: reviewAction,
        confidence_score: reviewConfidence / 100,
        notes: reviewNotes || `Peer validation consensus by ${reviewer.slice(0, 8)}`
      });

      showToast(
        `Consensus review recorded: ${reviewAction}! Reporter reputation adjusted.`,
        reviewAction === 'VERIFY' ? 'success' : reviewAction === 'REJECT' ? 'error' : 'warning'
      );
      setReviewItem(null);
      await loadIntelligence();
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Review submission failed', 'error');
    } finally {
      setReviewing(false);
    }
  };

  const handleViewReporter = async (address) => {
    if (!address) return;
    try {
      const res = await reportersApi.getReputation(address);
      setReporterReputation(res.data);
      setSelectedReporter(address);
    } catch (err) {
      showToast('Could not fetch reporter reputation', 'error');
    }
  };

  const applyPreset = (preset) => {
    setFormData({
      indicator: preset.indicator,
      indicator_type: preset.type,
      description: preset.description,
      campaign_id: preset.campaign,
      confidence_score: 90
    });
  };

  // Filter intelligence based on Tab, Type, and Search query
  const filteredIntel = intelligence.filter((item) => {
    // Status tab filter
    if (activeTab === 'VERIFIED' && item.status !== 'VERIFIED') return false;
    if (activeTab === 'PENDING' && (item.status === 'VERIFIED' || item.status === 'REJECTED')) return false;
    if (activeTab === 'DISPUTED' && item.status !== 'DISPUTED' && !item.conflict_detected) return false;

    // Type filter
    if (typeFilter !== 'ALL' && item.indicator_type !== typeFilter) return false;

    // Search query
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        String(item.indicator || '').toLowerCase().includes(term) ||
        String(item.description || '').toLowerCase().includes(term) ||
        String(item.campaign_id || '').toLowerCase().includes(term) ||
        String(item.reporter_address || '').toLowerCase().includes(term)
      );
    }

    return true;
  });

  return (
    <div className="threat-intel-page" style={{ padding: '0 8px 48px' }}>
      
      {/* Page Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '14px',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, rgba(109, 40, 217, 0.1) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#c084fc',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.35)',
            flexShrink: 0
          }}>
            <Shield size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                Decentralized Threat Intelligence
              </h1>
              <span className="badge badge-info" style={{ padding: '3px 8px', fontSize: '0.72rem' }}>
                Sybil-Resistant Consensus
              </span>
            </div>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '0.88rem' }}>
              Collaborative indicators of compromise (IOCs) with on-chain reputation rewards and multi-party peer review.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              fontWeight: 700,
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus size={16} />
            Publish Indicator
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadIntelligence}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sybil-Resistance Reputation Mechanism Explainer Bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        borderRadius: '12px',
        padding: '14px 20px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Award size={20} style={{ color: '#10b981', flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
            <strong style={{ color: '#34d399' }}>Reputation-Weighted Feed:</strong> Peer-reviewed authentic indicators reward reporters with <strong>+5 Reputation</strong>. False flags incur a <strong>-15 Reputation Penalty</strong>. Duplicate spam is auto-detected.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.76rem', color: '#94a3b8' }}>
          <span>Feed Count: <strong style={{ color: '#f1f5f9' }}>{intelligence.length}</strong></span>
          <span>Verified: <strong style={{ color: '#10b981' }}>{intelligence.filter(i => i.status === 'VERIFIED').length}</strong></span>
          <span>Pending: <strong style={{ color: '#f59e0b' }}>{intelligence.filter(i => i.status !== 'VERIFIED' && i.status !== 'REJECTED').length}</strong></span>
        </div>
      </div>

      {/* Filter Tabs & Controls */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '14px 20px' }}>
          
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { id: 'ALL', label: 'All Indicators' },
              { id: 'VERIFIED', label: 'Verified Consensus' },
              { id: 'PENDING', label: 'Pending Review' },
              { id: 'DISPUTED', label: 'Disputed / Conflicts' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{
                  fontSize: '0.78rem',
                  padding: '5px 12px',
                  borderRadius: '8px'
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type Filter & Search Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, maxWidth: '480px', justifyContent: 'flex-end' }}>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                width: '140px',
                padding: '6px 10px',
                fontSize: '0.8rem',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#f8fafc'
              }}
            >
              <option value="ALL">All Types</option>
              {indicatorTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="input"
                placeholder="Search IOC, IP, pool, hash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 32px',
                  fontSize: '0.8rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc'
                }}
              />
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>
          </div>

        </div>

        {/* Intelligence Table */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <Loader2 size={32} className="spin" style={{ margin: '0 auto', color: '#8b5cf6' }} />
              <p style={{ marginTop: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>Loading intelligence ledger...</p>
            </div>
          ) : filteredIntel.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🛡️</div>
              <h3 style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: 700 }}>No threat indicators found</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '4px' }}>
                No indicators match the selected criteria or search term.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
                style={{ marginTop: '16px' }}
              >
                Publish First Indicator
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Indicator / IOC</th>
                    <th>Type</th>
                    <th>Confidence</th>
                    <th>Status</th>
                    <th>Campaign</th>
                    <th>Reporter</th>
                    <th style={{ textAlign: 'right' }}>Consensus Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntel.map((item) => {
                    const isVerified = item.status === 'VERIFIED';
                    const isRejected = item.status === 'REJECTED';
                    const isDisputed = item.status === 'DISPUTED' || item.conflict_detected;
                    const confPercent = Math.round((item.confidence_score ?? 0.8) * 100);

                    return (
                      <tr key={item.intel_id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="mono" style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.82rem' }}>
                              {item.indicator}
                            </span>
                            {item.description && (
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', maxWidth: '320px' }}>
                                {item.description}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                            {item.indicator_type || 'Domain'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: 50,
                              height: 6,
                              borderRadius: '3px',
                              background: 'rgba(255, 255, 255, 0.1)',
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${confPercent}%`,
                                height: '100%',
                                background: confPercent > 80 ? '#10b981' : confPercent > 50 ? '#f59e0b' : '#ef4444'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1' }}>
                              {confPercent}%
                            </span>
                          </div>
                        </td>

                        <td>
                          <span className={`badge ${isVerified ? 'badge-verified' : isRejected ? 'badge-tampered' : isDisputed ? 'badge-high' : 'badge-unverified'}`} style={{ fontSize: '0.7rem' }}>
                            {item.status || 'SUBMITTED'}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                            {item.campaign_id || 'GENERAL'}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() => handleViewReporter(item.reporter_address)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#60a5fa',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                            title="Click to view reporter reputation score"
                          >
                            {item.reporter_address ? `${item.reporter_address.slice(0, 6)}...${item.reporter_address.slice(-4)}` : 'System'}
                          </button>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleOpenReview(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.72rem',
                              padding: '4px 10px',
                              borderColor: 'rgba(139, 92, 246, 0.4)',
                              color: '#c084fc'
                            }}
                          >
                            <Vote size={13} />
                            Review & Vote
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Consensus Review Modal */}
      {reviewItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0f192e 0%, #0b1224 100%)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Vote size={20} style={{ color: '#c084fc' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Peer Consensus Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewItem(null)}
                style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '18px'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Target Indicator</div>
              <div className="mono" style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
                {reviewItem.indicator}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '4px' }}>
                Type: {reviewItem.indicator_type} | Campaign: {reviewItem.campaign_id || 'GENERAL'}
              </div>
            </div>

            {/* Voting Options */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '8px' }}>
                Select Consensus Decision:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setReviewAction('VERIFY')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${reviewAction === 'VERIFY' ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                    background: reviewAction === 'VERIFY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: reviewAction === 'VERIFY' ? '#34d399' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  <CheckCircle size={16} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Verify (+5 Rep)
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('DISPUTE')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${reviewAction === 'DISPUTE' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)'}`,
                    background: reviewAction === 'DISPUTE' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: reviewAction === 'DISPUTE' ? '#fbbf24' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  <AlertTriangle size={16} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Dispute
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('REJECT')}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: `1px solid ${reviewAction === 'REJECT' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                    background: reviewAction === 'REJECT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: reviewAction === 'REJECT' ? '#f87171' : '#94a3b8',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.78rem'
                  }}
                >
                  <XCircle size={16} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Reject (-15 Rep)
                </button>
              </div>
            </div>

            {/* Confidence Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>
                  Confidence Score:
                </label>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8' }}>
                  {reviewConfidence}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={reviewConfidence}
                onChange={(e) => setReviewConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#8b5cf6' }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                Peer Review Justification / Threat Notes:
              </label>
              <textarea
                className="input"
                style={{ width: '100%', height: '70px', fontSize: '0.8rem', resize: 'none' }}
                placeholder="Observed in active stratum telemetry, verified with external AbuseIPDB/VirusTotal..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setReviewItem(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSubmitReview}
                disabled={reviewing}
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
                  fontWeight: 700
                }}
              >
                {reviewing ? <Loader2 size={14} className="spin" /> : 'Cast Consensus Vote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Indicator Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0f192e 0%, #0b1224 100%)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={20} style={{ color: '#38bdf8' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Publish Threat Intelligence Indicator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Load Verified Threat Presets:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                {PRESET_INDICATORS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => applyPreset(p)}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    {p.type}: {p.campaign}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Type:
                  </label>
                  <select
                    className="input"
                    value={formData.indicator_type}
                    onChange={(e) => setFormData({ ...formData, indicator_type: e.target.value })}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  >
                    {indicatorTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Indicator (URL, IP, Domain, Process):
                  </label>
                  <input
                    type="text"
                    className="input mono"
                    placeholder="stratum+tcp://pool.supportxmr.com:3333"
                    value={formData.indicator}
                    onChange={(e) => setFormData({ ...formData, indicator: e.target.value })}
                    required
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Threat Campaign ID:
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="XMR-CAMPAIGN-2026"
                  value={formData.campaign_id}
                  onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                  Description & Forensic Context:
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', height: '70px', fontSize: '0.8rem', resize: 'none' }}
                  placeholder="Cryptomining command and control server distributing XMRig binaries..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={adding}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                    fontWeight: 700
                  }}
                >
                  {adding ? <Loader2 size={14} className="spin" /> : 'Anchor Indicator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reporter Reputation Detail Modal */}
      {selectedReporter && reporterReputation && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #0f192e 0%, #0b1224 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Award size={22} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                  Reporter Sybil Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReporter(null)}
                style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Ethereum Account Address:</div>
              <div className="mono" style={{ fontSize: '0.78rem', color: '#38bdf8', wordBreak: 'break-all', marginTop: '2px' }}>
                {selectedReporter}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Reputation Score</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                  {reporterReputation.reputation ?? 100}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Verified Submissions</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>
                  {reporterReputation.verified_count ?? 1}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedReporter(null)}
              style={{ width: '100%' }}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default ThreatIntelligence;
