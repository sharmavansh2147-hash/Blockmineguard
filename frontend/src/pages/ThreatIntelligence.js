import React, { useState, useEffect, useCallback } from 'react';
import { threatIntelApi, reportersApi } from '../services/api';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import { getContractAddress, getExplorerUrl } from '../services/contractService';
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
  Award,
  Vote,
  XCircle,
  RefreshCw,
  Eye,
  Database,
  Lock,
  X
} from 'lucide-react';

const indicatorTypes = [
  { value: 'mining_pool', label: 'Mining Pool', icon: Shield },
  { value: 'ip', label: 'IP Address', icon: Server },
  { value: 'domain', label: 'Domain', icon: Globe },
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
  const { isConnected, account, chainId } = useWallet();

  const [intelligence, setIntelligence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, VERIFIED, PENDING, DISPUTED
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [storageFilter, setStorageFilter] = useState('ALL'); // ALL, ONCHAIN, LOCAL
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Inspector detail modal
  const [detailItem, setDetailItem] = useState(null);

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

  const activeChainId = chainId || 31337;
  const contractAddress = getContractAddress(activeChainId);

  const loadIntelligence = useCallback(async () => {
    setLoading(true);
    try {
      const response = await threatIntelApi.getAll(false);
      setIntelligence(response.data.threat_intelligence || []);
    } catch (error) {
      showToast('Failed to load threat intelligence feed: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.indicator.trim()) {
      showToast('Please enter an indicator value', 'warning');
      return;
    }

    try {
      setAdding(true);
      await threatIntelApi.create(formData);
      showToast('Threat indicator anchored to intelligence repository!', 'success');
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
        notes: reviewNotes || `Consensus validation by ${reviewer.slice(0, 8)}`
      });

      showToast(
        `Consensus review recorded: ${reviewAction}. Reporter reputation updated.`,
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
      showToast('Could not fetch reporter reputation profile', 'error');
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

  // Filter intelligence based on Tab, Type, Storage, and Search query
  const filteredIntel = intelligence.filter((item) => {
    // Status tab filter
    if (activeTab === 'VERIFIED' && item.status !== 'VERIFIED') return false;
    if (activeTab === 'PENDING' && (item.status === 'VERIFIED' || item.status === 'REJECTED')) return false;
    if (activeTab === 'DISPUTED' && item.status !== 'DISPUTED' && !item.conflict_detected) return false;

    // Type filter
    if (typeFilter !== 'ALL' && item.indicator_type !== typeFilter) return false;

    // Storage filter (distinguish local vs onchain)
    const hasOnChain = Boolean(item.on_chain_tx || item.blockchain_tx_hash || item.on_chain_id);
    if (storageFilter === 'ONCHAIN' && !hasOnChain) return false;
    if (storageFilter === 'LOCAL' && hasOnChain) return false;

    // Search query
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        String(item.indicator || '').toLowerCase().includes(term) ||
        String(item.description || '').toLowerCase().includes(term) ||
        String(item.campaign_id || '').toLowerCase().includes(term) ||
        String(item.reporter_address || '').toLowerCase().includes(term) ||
        String(item.intel_id || '').toLowerCase().includes(term)
      );
    }

    return true;
  });

  return (
    <div className="threat-intelligence-page">
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Threat Intelligence Feed</h1>
            <span className="badge badge-blockchain">PEER CONSENSUS</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Structured indicators of compromise (IOCs) with cryptographic provenance, multi-party consensus, and Sybil-resistant reputation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadIntelligence}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} /> Submit Indicator
          </button>
        </div>
      </div>

      {/* Consensus & Provenance Informational Banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '0.875rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius)',
            background: 'rgba(129, 140, 248, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-blockchain)',
            flexShrink: 0
          }}>
            <Shield size={16} />
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Decentralized Validation:</strong> Indicators are classified as <span style={{ color: 'var(--accent-blockchain)', fontWeight: 600 }}>Blockchain-Anchored</span> or <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Local Database</span>. Authentic consensus grants <strong style={{ color: 'var(--success)' }}>+5 Rep</strong>; confirmed false flags incur a <strong style={{ color: 'var(--critical)' }}>-15 Rep penalty</strong>.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <span>Total IOCs: <strong style={{ color: 'var(--text-primary)' }}>{intelligence.length}</strong></span>
          <span>Verified: <strong style={{ color: 'var(--success)' }}>{intelligence.filter(i => i.status === 'VERIFIED').length}</strong></span>
          <span>Pending: <strong style={{ color: 'var(--warning)' }}>{intelligence.filter(i => i.status !== 'VERIFIED' && i.status !== 'REJECTED').length}</strong></span>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.75rem 1rem' }}>
          
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All Indicators' },
              { id: 'VERIFIED', label: 'Verified Consensus' },
              { id: 'PENDING', label: 'Pending Review' },
              { id: 'DISPUTED', label: 'Disputed' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters & Search Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, maxWidth: '520px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {/* Storage Filter */}
            <select
              className="input"
              value={storageFilter}
              onChange={(e) => setStorageFilter(e.target.value)}
              style={{ width: '130px', fontSize: '0.75rem', padding: '4px 8px' }}
            >
              <option value="ALL">All Storage</option>
              <option value="ONCHAIN">On-Chain</option>
              <option value="LOCAL">Local Only</option>
            </select>

            {/* Type Filter */}
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: '130px', fontSize: '0.75rem', padding: '4px 8px' }}
            >
              <option value="ALL">All Types</option>
              {indicatorTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="input"
                placeholder="Search IOC, IP, pool, hash..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '30px', fontSize: '0.75rem' }}
              />
            </div>
          </div>
        </div>

        {/* Intelligence Table */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="spin" style={{ margin: '0 auto', color: 'var(--primary)' }} />
              <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Loading intelligence ledger...</p>
            </div>
          ) : filteredIntel.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <Shield size={36} style={{ color: 'var(--text-secondary)', margin: '0 auto 0.75rem' }} />
              <h3 style={{ color: 'var(--text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}>No Threat Indicators Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                No indicators match the selected filters or search query.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddModal(true)}
                style={{ marginTop: '1rem' }}
              >
                Submit First Indicator
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
                    <th>Storage Provenance</th>
                    <th>Status</th>
                    <th>Recorded At</th>
                    <th>Reporter</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIntel.map((item) => {
                    const isVerified = item.status === 'VERIFIED';
                    const isRejected = item.status === 'REJECTED';
                    const isDisputed = item.status === 'DISPUTED' || item.conflict_detected;
                    const confPercent = Math.round((item.confidence_score ?? 0.8) * 100);
                    const hasOnChain = Boolean(item.on_chain_tx || item.blockchain_tx_hash || item.on_chain_id);
                    const timestampStr = item.created_at || item.timestamp;

                    return (
                      <tr key={item.intel_id || item.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8125rem' }}>
                              {item.indicator}
                            </span>
                            {item.campaign_id && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                Campaign: <span style={{ color: 'var(--primary)' }}>{item.campaign_id}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.6875rem' }}>
                            {item.indicator_type || 'Domain'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 44, height: 6, borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                              <div style={{
                                width: `${confPercent}%`,
                                height: '100%',
                                background: confPercent > 80 ? 'var(--success)' : confPercent > 50 ? 'var(--warning)' : 'var(--critical)'
                              }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {confPercent}%
                            </span>
                          </div>
                        </td>

                        <td>
                          {hasOnChain ? (
                            <span className="badge badge-blockchain" style={{ fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Lock size={10} /> ON-CHAIN
                            </span>
                          ) : (
                            <span className="badge badge-neutral" style={{ fontSize: '0.6875rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Database size={10} /> LOCAL DB
                            </span>
                          )}
                        </td>

                        <td>
                          <span className={`badge ${isVerified ? 'badge-verified' : isRejected ? 'badge-tampered' : isDisputed ? 'badge-high' : 'badge-unverified'}`} style={{ fontSize: '0.6875rem' }}>
                            {item.status || 'SUBMITTED'}
                          </span>
                        </td>

                        <td>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {timestampStr ? new Date(timestampStr).toLocaleDateString() : 'N/A'}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={() => handleViewReporter(item.reporter_address)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline'
                            }}
                            title="Click to view reporter Sybil reputation profile"
                          >
                            {item.reporter_address ? `${item.reporter_address.slice(0, 6)}...${item.reporter_address.slice(-4)}` : 'System'}
                          </button>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.375rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setDetailItem(item)}
                              style={{ padding: '3px 8px', fontSize: '0.6875rem' }}
                              title="Inspect details"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleOpenReview(item)}
                              style={{ padding: '3px 8px', fontSize: '0.6875rem', borderColor: 'var(--accent-blockchain)', color: 'var(--accent-blockchain)' }}
                              title="Cast peer consensus vote"
                            >
                              <Vote size={12} /> Vote
                            </button>
                          </div>
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

      {/* Detail Drawer Modal */}
      {detailItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '580px', width: '100%', padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} style={{ color: 'var(--accent-blockchain)' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Threat Indicator Dossier</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Indicator Value</span>
                <div className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--bg-main)', padding: '0.5rem', borderRadius: '4px', wordBreak: 'break-all', marginTop: '2px' }}>
                  {detailItem.indicator}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', background: 'var(--bg-elevated)', padding: '0.875rem', borderRadius: 'var(--radius)' }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Type</span>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginTop: '2px' }}>{detailItem.indicator_type}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Campaign ID</span>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginTop: '2px' }}>{detailItem.campaign_id || 'GENERAL'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Status</span>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`badge ${detailItem.status === 'VERIFIED' ? 'badge-verified' : 'badge-unverified'}`}>
                      {detailItem.status || 'SUBMITTED'}
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Confidence</span>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginTop: '2px' }}>
                    {Math.round((detailItem.confidence_score ?? 0.8) * 100)}%
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Description & Forensic Context</span>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                  {detailItem.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Storage Provenance</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                  {Boolean(detailItem.on_chain_tx || detailItem.blockchain_tx_hash) ? (
                    <span style={{ color: 'var(--accent-blockchain)', fontWeight: 600 }}>Anchored on Blockchain</span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>Stored in Local SQLite Database</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setDetailItem(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consensus Review Modal */}
      {reviewItem && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Vote size={18} style={{ color: 'var(--accent-blockchain)' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                  Peer Consensus Review
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewItem(null)}
                style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target Indicator</div>
              <div className="mono" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary)', marginTop: '2px', wordBreak: 'break-all' }}>
                {reviewItem.indicator}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Type: {reviewItem.indicator_type} • Campaign: {reviewItem.campaign_id || 'GENERAL'}
              </div>
            </div>

            {/* Voting Options */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Select Consensus Vote:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setReviewAction('VERIFY')}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${reviewAction === 'VERIFY' ? 'var(--success)' : 'var(--border)'}`,
                    background: reviewAction === 'VERIFY' ? 'rgba(52, 211, 153, 0.12)' : 'var(--bg-elevated)',
                    color: reviewAction === 'VERIFY' ? 'var(--success)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  <CheckCircle size={14} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Verify (+5 Rep)
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('DISPUTE')}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${reviewAction === 'DISPUTE' ? 'var(--warning)' : 'var(--border)'}`,
                    background: reviewAction === 'DISPUTE' ? 'rgba(251, 191, 36, 0.12)' : 'var(--bg-elevated)',
                    color: reviewAction === 'DISPUTE' ? 'var(--warning)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  <AlertTriangle size={14} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Dispute
                </button>

                <button
                  type="button"
                  onClick={() => setReviewAction('REJECT')}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${reviewAction === 'REJECT' ? 'var(--critical)' : 'var(--border)'}`,
                    background: reviewAction === 'REJECT' ? 'rgba(248, 113, 113, 0.12)' : 'var(--bg-elevated)',
                    color: reviewAction === 'REJECT' ? 'var(--critical)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                >
                  <XCircle size={14} style={{ display: 'block', margin: '0 auto 4px' }} />
                  Reject (-15 Rep)
                </button>
              </div>
            </div>

            {/* Confidence Slider */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Confidence Score:
                </label>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>
                  {reviewConfidence}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={reviewConfidence}
                onChange={(e) => setReviewConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                Review Justification / Context:
              </label>
              <textarea
                className="input"
                style={{ width: '100%', height: '65px', fontSize: '0.8125rem', resize: 'vertical' }}
                placeholder="Observed in stratum telemetry, cross-referenced with internal logs..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
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
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '560px', width: '100%', padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                  Publish Threat Intelligence Indicator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Load Reference Threat Presets:
              </span>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                {PRESET_INDICATORS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => applyPreset(p)}
                    style={{ fontSize: '0.6875rem', padding: '2px 8px' }}
                  >
                    {p.type}: {p.campaign}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Type
                  </label>
                  <select
                    className="input"
                    value={formData.indicator_type}
                    onChange={(e) => setFormData({ ...formData, indicator_type: e.target.value })}
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  >
                    {indicatorTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Indicator (IP, Pool URL, Domain, Process)
                  </label>
                  <input
                    type="text"
                    className="input mono"
                    placeholder="stratum+tcp://pool.supportxmr.com:3333"
                    value={formData.indicator}
                    onChange={(e) => setFormData({ ...formData, indicator: e.target.value })}
                    required
                    style={{ width: '100%', fontSize: '0.8125rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Campaign Identifier
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="XMR-CAMPAIGN-2026"
                  value={formData.campaign_id}
                  onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                  style={{ width: '100%', fontSize: '0.8125rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                  Forensic Description & Context
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', height: '65px', fontSize: '0.8125rem', resize: 'vertical' }}
                  placeholder="Cryptomining command-and-control server distributing malicious payloads..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '1.5rem', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                  Reporter Sybil Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReporter(null)}
                style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Ethereum Account Address</div>
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--primary)', wordBreak: 'break-all', marginTop: '2px' }}>
                {selectedReporter}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Reputation Score</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>
                  {reporterReputation.reputation ?? 100}
                </div>
              </div>

              <div style={{ background: 'var(--bg-elevated)', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>Verified Submissions</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  {reporterReputation.verified_count ?? 1}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
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
