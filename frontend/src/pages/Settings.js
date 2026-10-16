
import React, { useState, useEffect } from 'react';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import { reportersApi, statsApi } from '../services/api';
import {
  Wallet,
  Network,
  Shield,
  Database,
  Info,
  Copy,
  Check,
} from 'lucide-react';

export function Settings() {
  const { showToast } = useApp();
  const { account, isConnected, chainId, switchNetwork, connect } = useWallet();

  const [reporterInfo, setReporterInfo] = useState(null);
  const [contractAddress, setContractAddress] = useState('');
  const [rpcUrl, setRpcUrl] = useState('http://127.0.0.1:8545');
  const [copied, setCopied] = useState(false);
  const [deployedContract, setDeployedContract] = useState(null);

  useEffect(() => {
    if (isConnected && account) {
      loadReporterInfo();
    }
    loadContractInfo();
  }, [isConnected, account]);

  const loadReporterInfo = async () => {
    try {
      const response = await reportersApi.getReputation(account);
      setReporterInfo(response.data);
    } catch (error) {
      console.error('Failed to load reporter info:', error);
    }
  };

  const loadContractInfo = async () => {
    try {
      const response = await statsApi.getStats();

      if (response.data.blockchain_connected) {
        setDeployedContract({
          address: response.data.contract_address || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
          network: response.data.network || 'Hardhat Local',
        });
      }
    } catch (error) {
      console.error('Failed to load contract info:', error);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleSwitchNetwork = async (targetChainId) => {
    try {
      await switchNetwork(targetChainId);
      showToast(
        `Switched to ${
          targetChainId === 31337 ? 'Hardhat Local' : 'Sepolia'
        }`,
        'success'
      );
    } catch (error) {
      showToast('Failed to switch network', 'error');
    }
  };

  const networks = [
    {
      id: 31337,
      name: 'Hardhat Local',
      rpc: 'http://127.0.0.1:8545',
      explorer: null,
    },
    {
      id: 11155111,
      name: 'Sepolia Testnet',
      rpc: 'https://rpc.sepolia.org',
      explorer: 'https://sepolia.etherscan.io',
    },
  ];

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure your wallet, network, and application preferences
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Wallet Connection */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Wallet size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Wallet Connection</span>
            </div>
          </div>

          <div className="card-body">
            {isConnected ? (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'var(--background)',
                    borderRadius: 'var(--radius)',
                    marginBottom: '1rem',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '1.125rem',
                    }}
                  >
                    {account?.slice(2, 4).toUpperCase()}
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      }}
                    >
                      {account?.slice(0, 10)}...{account?.slice(-8)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Connected
                    </div>
                  </div>

                  <button
                    className="btn btn-outline btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => copyToClipboard(account)}
                    title="Copy wallet address"
                  >
                    {copied ? (
                      <Check size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                {reporterInfo && (
                  <div style={{ marginBottom: '1rem' }}>
                    <h4
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem',
                      }}
                    >
                      On-Chain Reputation
                    </h4>

                    <div className="detail-grid">
                      <DetailItem
                        label="Reputation Score"
                        value={
                          reporterInfo.blockchain?.reputation_score ??
                          reporterInfo.local?.reputation_score ??
                          100
                        }
                      />
                      <DetailItem
                        label="Total Reports"
                        value={
                          reporterInfo.blockchain?.total_reports ??
                          reporterInfo.local?.total_reports ??
                          0
                        }
                      />
                      <DetailItem
                        label="Verified Reports"
                        value={
                          reporterInfo.blockchain?.verified_reports ??
                          reporterInfo.local?.verified_reports ??
                          0
                        }
                      />
                      <DetailItem
                        label="False Reports"
                        value={
                          reporterInfo.blockchain?.false_reports ??
                          reporterInfo.local?.false_reports ??
                          0
                        }
                      />
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-danger"
                  onClick={() =>
                    showToast(
                      'Disconnect your wallet using MetaMask.',
                      'info'
                    )
                  }
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Wallet
                  size={48}
                  style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '1rem',
                  }}
                />
                <h3 style={{ marginBottom: '0.5rem' }}>
                  Wallet Not Connected
                </h3>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '1.5rem',
                  }}
                >
                  Connect your MetaMask wallet to interact with the blockchain.
                </p>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={connect}
                >
                  <Wallet size={20} />
                  Connect MetaMask
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* Network Configuration */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Network size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Network Configuration</span>
            </div>
          </div>

          <div className="card-body">
            <div style={{ marginBottom: '1.5rem' }}>
              <h4
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.75rem',
                }}
              >
                Current Network
              </h4>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className={`badge ${
                    chainId === 31337
                      ? 'badge-success'
                      : chainId === 11155111
                      ? 'badge-info'
                      : 'badge-warning'
                  }`}
                  style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                >
                  {chainId === 31337
                    ? 'Hardhat Local (31337)'
                    : chainId === 11155111
                    ? 'Sepolia (11155111)'
                    : chainId
                    ? `Chain ${chainId}`
                    : 'Not Connected'}
                </span>
              </div>
            </div>

            <h4
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
              }}
            >
              Switch Network
            </h4>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              {networks.map((net) => (
                <button
                  key={net.id}
                  className={`btn ${
                    chainId === net.id ? 'btn-primary' : 'btn-outline'
                  }`}
                  onClick={() => handleSwitchNetwork(net.id)}
                  disabled={chainId === net.id || !isConnected}
                >
                  {net.name}
                  {net.id === 31337 && ' (Local)'}
                  {net.id === 11155111 && ' (Testnet)'}
                </button>
              ))}
            </div>

            <hr
              style={{ margin: '1.5rem 0', borderColor: 'var(--border)' }}
            />

            <h4
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
              }}
            >
              RPC Configuration
            </h4>

            <FormGroup label="RPC URL">
              <input
                type="text"
                className="input"
                value={rpcUrl}
                onChange={(e) => setRpcUrl(e.target.value)}
                placeholder="http://127.0.0.1:8545"
              />
            </FormGroup>

            <p
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
            >
              Configure the RPC endpoint for your Ethereum-compatible
              blockchain node.
            </p>
          </div>
        </Card>

        {/* Smart Contract */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Shield size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Smart Contract</span>
            </div>
          </div>

          <div className="card-body">
            {deployedContract ? (
              <div>
                <div className="detail-grid">
                  <DetailItem
                    label="Contract Address"
                    value={deployedContract.address}
                    mono
                    copyable
                    onCopy={copyToClipboard}
                    copied={copied}
                  />
                  <DetailItem
                    label="Network"
                    value={deployedContract.network}
                  />
                  <DetailItem
                    label="Chain ID"
                    value={chainId?.toString() || 'N/A'}
                    mono
                  />
                </div>

                <hr
                  style={{ margin: '1.5rem 0', borderColor: 'var(--border)' }}
                />

                <FormGroup label="Contract Address (for manual config)">
                  <input
                    type="text"
                    className="input"
                    value={contractAddress}
                    onChange={(e) => setContractAddress(e.target.value)}
                    placeholder="0x..."
                  />
                </FormGroup>

                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Enter the deployed ThreatRegistry contract address to
                  connect the frontend.
                </p>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📜</div>
                <p>No contract deployed or connected</p>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginTop: '0.5rem',
                  }}
                >
                  Deploy the ThreatRegistry contract using Hardhat, then
                  configure the address.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Database */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Database size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Database</span>
            </div>
          </div>

          <div className="card-body">
            <div className="detail-grid">
              <DetailItem label="Type" value="SQLite" />
              <DetailItem
                label="File"
                value="blockmineguard.db"
                mono
              />
              <DetailItem
                label="Location"
                value="./backend/blockmineguard.db"
                mono
              />
            </div>

            <hr
              style={{ margin: '1.5rem 0', borderColor: 'var(--border)' }}
            />

            <h4
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.75rem',
              }}
            >
              Migration Notes
            </h4>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              The database abstraction layer supports migration to PostgreSQL
              or MongoDB. Update the{' '}
              <code
                className="mono"
                style={{
                  background: 'var(--background)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                }}
              >
                Database
              </code>{' '}
              class in{' '}
              <code
                className="mono"
                style={{
                  background: 'var(--background)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '4px',
                }}
              >
                backend/database/database.py
              </code>{' '}
              to switch backends.
            </p>
          </div>
        </Card>

        {/* About */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Info size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">About</span>
            </div>
          </div>

          <div className="card-body">
            <div style={{ display: 'grid', gap: '1rem' }}>
              <InfoItem label="Project" value="BlockMineGuard" />
              <InfoItem label="Version" value="1.0.0" />
              <InfoItem
                label="Description"
                value="Blockchain-Based Tamper-Evident Cryptojacking Detection and Threat Intelligence Sharing Framework"
              />
              <InfoItem
                label="Architecture"
                value="Off-chain detection, on-chain evidence integrity"
              />
              <InfoItem
                label="Smart Contract"
                value="ThreatRegistry.sol (Solidity 0.8.24)"
              />
              <InfoItem label="Backend" value="Python Flask + Web3.py" />
              <InfoItem label="Frontend" value="React 18 + Ethers.js v6" />
              <InfoItem
                label="Blockchain"
                value="Ethereum-compatible (Hardhat local, Sepolia)"
              />
            </div>
          </div>
        </Card>

        {/* Detection Rules */}
        <Card>
          <div className="card-header">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <Shield size={22} style={{ color: 'var(--primary)' }} />
              <span className="card-title">Detection Rules</span>
            </div>
          </div>

          <div className="card-body">
            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
              }}
            >
              Current rule-based scoring configuration (modular for ML
              replacement):
            </p>

            <RuleCard
              title="CPU Usage"
              rules={[
                { condition: '> 90%', score: '+30' },
                { condition: '> 75%', score: '+15' },
                { condition: '> 50%', score: '+5' },
                { condition: '≤ 50%', score: '+0' },
              ]}
            />

            <RuleCard
              title="Process Name"
              rules={[
                {
                  condition: 'Mining-related (xmrig, cpuminer, etc.)',
                  score: '+25',
                },
                { condition: 'Normal process', score: '+0' },
              ]}
            />

            <RuleCard
              title="Network Destination"
              rules={[
                { condition: 'Known mining pool/domain', score: '+25' },
                { condition: 'Normal destination', score: '+0' },
              ]}
            />

            <RuleCard
              title="Process Runtime"
              rules={[
                { condition: '> 1 hour (3600s)', score: '+20' },
                { condition: '> 30 min (1800s)', score: '+10' },
                { condition: '≤ 30 min', score: '+0' },
              ]}
            />

            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--background)',
                borderRadius: 'var(--radius)',
              }}
            >
              <strong>Severity Thresholds:</strong>
              <ul
                style={{
                  marginTop: '0.5rem',
                  paddingLeft: '1.25rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <li>
                  <span className="badge badge-high">HIGH</span> 70–100
                </li>
                <li>
                  <span className="badge badge-medium">MEDIUM</span> 40–69
                </li>
                <li>
                  <span className="badge badge-low">LOW</span> 0–39
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
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

function DetailItem({
  label,
  value,
  mono = false,
  copyable = false,
  onCopy,
  copied,
}) {
  return (
    <div className="detail-item">
      <div className="detail-label">{label}</div>

      <div
        className={`detail-value ${mono ? 'mono' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span>{value}</span>

        {copyable && (
          <button
            className="btn btn-outline btn-sm"
            style={{ padding: '0.25rem', height: 'auto' }}
            onClick={() => onCopy?.(value)}
            title="Copy to clipboard"
          >
            {copied ? (
              <Check size={14} style={{ color: 'var(--success)' }} />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--border)',
        gap: '1rem',
      }}
    >
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function RuleCard({ title, rules }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h5
        style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h5>

      <table style={{ width: '100%', fontSize: '0.8125rem' }}>
        <tbody>
          {rules.map((rule, i) => (
            <tr
              key={i}
              style={{
                borderBottom:
                  i < rules.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <td
                style={{
                  padding: '0.375rem 0',
                  color: 'var(--text-secondary)',
                }}
              >
                {rule.condition}
              </td>
              <td
                style={{
                  padding: '0.375rem 0',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                }}
              >
                {rule.score}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
