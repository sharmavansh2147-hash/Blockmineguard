import React, { useState, useEffect, useCallback } from 'react';
import { incidentsApi, statsApi } from '../services/api';
import { useWallet } from '../context/WalletContext';
import { useApp } from '../App';
import contractService from '../services/contractService';
import api from '../services/api';
import {
  Boxes,
  Copy,
  Check,
  RefreshCw,
  Search,
  Server,
  ArrowUpRight
} from 'lucide-react';

export function BlockchainExplorer() {
  const { showToast } = useApp();
  const { chainId, isConnected } = useWallet();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [health, setHealth] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedTx, setCopiedTx] = useState(null);

  const activeChainId = chainId || 31337;
  const isSepolia = activeChainId === 11155111;
  const isLocal = activeChainId === 31337;

  const contractAddress = contractService.getContractAddress(activeChainId);
  const isContractConfigured = Boolean(contractAddress && contractAddress !== '0x5FbDB2315678afecb367f032d93F642f64180aa3');
  const contractExplorerUrl = contractService.getExplorerUrl(activeChainId, contractAddress, 'address');

  const loadExplorerData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch health
      try {
        const healthRes = await api.get('/health');
        setHealth(healthRes.data);
      } catch (hErr) {
        setHealth({ status: 'unreachable', blockchain_connected: false });
      }

      // 2. Fetch stats
      try {
        const statsRes = await statsApi.getStats();
        setStats(statsRes.data?.stats || statsRes.data || null);
      } catch (sErr) {
        setStats(null);
      }

      // 3. Fetch incidents to populate transaction ledger
      try {
        const incRes = await incidentsApi.getAll({ limit: 100 });
        const incList = incRes.data?.incidents || incRes.data || [];
        // Filter those with blockchain transaction hashes or verification
        const onChainList = incList.filter(i => Boolean(i.blockchain_tx_hash || i.blockchain_incident_id));
        setTransactions(onChainList);
      } catch (iErr) {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Failed to load explorer data:', err);
      showToast('Failed to load blockchain explorer records', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadExplorerData();
  }, [loadExplorerData]);

  const copyToClipboard = (text, type = 'contract') => {
    navigator.clipboard.writeText(text);
    if (type === 'contract') {
      setCopiedContract(true);
      setTimeout(() => setCopiedContract(false), 2000);
    } else {
      setCopiedTx(text);
      setTimeout(() => setCopiedTx(null), 2000);
    }
    showToast('Copied to clipboard', 'info');
  };

  const filteredTxs = transactions.filter(tx => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      (tx.incident_id && tx.incident_id.toLowerCase().includes(query)) ||
      (tx.blockchain_tx_hash && tx.blockchain_tx_hash.toLowerCase().includes(query)) ||
      (tx.evidence_hash && tx.evidence_hash.toLowerCase().includes(query))
    );
  });

  const totalRecorded = stats?.total_incidents ?? transactions.length;
  const verifiedCount = stats?.verified_incidents ?? transactions.filter(t => t.verification_status === 'VERIFIED').length;
  const latestTx = transactions.length > 0 ? transactions[0].blockchain_tx_hash : null;

  return (
    <div className="blockchain-explorer-page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Blockchain Explorer</h1>
            <span className={isSepolia ? 'badge badge-info' : 'badge badge-neutral'}>
              {isSepolia ? 'Ethereum Sepolia (11155111)' : isLocal ? 'Hardhat Local (31337)' : `Chain ${activeChainId}`}
            </span>
          </div>
          <p className="page-subtitle" style={{ margin: '4px 0 0' }}>
            On-chain threat registry status, transaction ledger, and cryptographic attestation audit history.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={loadExplorerData}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Ledger
        </button>
      </div>

      {/* Network & Contract Overview Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Card 1: Target Chain */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active Network
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: health?.blockchain_connected ? 'var(--success)' : 'var(--danger)',
                display: 'inline-block'
              }}
            />
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isSepolia ? 'Ethereum Sepolia' : isLocal ? 'Hardhat Node' : `Chain ID ${activeChainId}`}
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Chain ID: <span className="mono" style={{ color: 'var(--primary)' }}>{activeChainId}</span> • EIP-1559 Compatible
          </div>
        </div>

        {/* Card 2: RPC Status */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            RPC Connection
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <Server size={18} color="var(--primary)" />
            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: health?.blockchain_connected ? 'var(--success)' : 'var(--danger)' }}>
              {health?.blockchain_connected ? 'Connected' : 'Unreachable'}
            </span>
          </div>
          <div className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {health?.rpc_url || (isSepolia ? 'https://ethereum-sepolia-rpc.publicnode.com' : 'http://127.0.0.1:8545')}
          </div>
        </div>

        {/* Card 3: Recorded Records */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            On-Chain Incidents
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
            {totalRecorded}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--success)', marginTop: '2px' }}>
            {verifiedCount} Integrity-Verified Records
          </div>
        </div>

        {/* Card 4: Latest Confirmed Block */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Smart Contract Status
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: isContractConfigured ? 'var(--primary)' : 'var(--warning)', marginTop: '8px' }}>
            {isContractConfigured ? 'ThreatRegistry.sol' : 'Contract Configured'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Solidity 0.8.24 • EIP-1559 Optimized
          </div>
        </div>
      </div>

      {/* Contract Detail Panel */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ThreatRegistry Contract Address
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span className="mono" style={{ fontSize: '0.92rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {contractAddress || 'Contract not configured'}
              </span>
              {contractAddress && (
                <button
                  type="button"
                  onClick={() => copyToClipboard(contractAddress, 'contract')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '2px' }}
                  title="Copy contract address"
                >
                  {copiedContract ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {contractExplorerUrl ? (
              <a
                href={contractExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                View on Sepolia Etherscan <ArrowUpRight size={14} />
              </a>
            ) : (
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                Local Hardhat EVM (31337)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Table Section */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="card-title">On-Chain Transaction & Attestation Ledger</div>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Cryptographic hashes, block confirmations, and smart contract audit log
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input input-sm"
                placeholder="Filter by ID or Tx Hash..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '220px', fontSize: '0.75rem' }}
              />
            </div>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {filteredTxs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <Boxes size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '4px' }}>No Transactions Found</h4>
              <p style={{ fontSize: '0.78125rem', maxWidth: '360px', margin: '0 auto' }}>
                {searchQuery
                  ? 'No on-chain records match your search filter.'
                  : 'Incidents anchored to the blockchain via MetaMask or automated relay will appear in this ledger.'}
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Incident ID</th>
                    <th>Method / Action</th>
                    <th>Evidence SHA-256 Digest</th>
                    <th>Transaction Hash</th>
                    <th>Block Number</th>
                    <th>Verification</th>
                    <th>Explorer</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.map((tx, idx) => {
                    const txHash = tx.blockchain_tx_hash || 'Pending On-Chain';
                    const hasRealTx = Boolean(tx.blockchain_tx_hash);
                    const explorerUrl = hasRealTx ? contractService.getExplorerUrl(activeChainId, txHash, 'tx') : null;

                    return (
                      <tr key={tx.incident_id || idx}>
                        <td>
                          <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            {tx.incident_id}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>
                            reportIncident()
                          </span>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {tx.evidence_hash ? `${tx.evidence_hash.slice(0, 16)}...` : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="mono" style={{ fontSize: '0.75rem', color: hasRealTx ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {hasRealTx ? `${txHash.slice(0, 14)}...` : 'Unconfirmed'}
                            </span>
                            {hasRealTx && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(txHash, 'tx')}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                title="Copy full transaction hash"
                              >
                                {copiedTx === txHash ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>
                          {tx.blockchain_block_number ? `#${tx.blockchain_block_number}` : 'Mined (Local)'}
                        </td>
                        <td>
                          <span
                            className={`badge ${tx.verification_status === 'VERIFIED' ? 'badge-verified' : 'badge-tampered'}`}
                            style={{ fontSize: '0.68rem' }}
                          >
                            {tx.verification_status || 'UNVERIFIED'}
                          </span>
                        </td>
                        <td>
                          {explorerUrl ? (
                            <a
                              href={explorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              Sepolia <ArrowUpRight size={12} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Localhost
                            </span>
                          )}
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
    </div>
  );
}

export default BlockchainExplorer;
