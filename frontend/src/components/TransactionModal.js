import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  X
} from 'lucide-react';
import { getExplorerUrl } from '../services/contractService';

/**
 * Transaction Progress Lifecycle:
 * status: 'idle' | 'approving' | 'submitted' | 'confirming' | 'confirmed' | 'error'
 */
export function TransactionModal({
  isOpen,
  onClose,
  status = 'idle',
  txHash = null,
  blockNumber = null,
  contractAddress = null,
  chainId = 31337,
  errorMessage = null,
  onRetry = null,
  incidentId = null
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const explorerUrl = txHash ? getExplorerUrl(chainId, txHash, 'tx') : null;
  const contractExplorerUrl = contractAddress ? getExplorerUrl(chainId, contractAddress, 'address') : null;
  const isSepolia = Number(chainId) === 11155111;

  const copyHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const steps = [
    { id: 'approving', label: 'Wallet Approval', desc: 'Sign transaction in MetaMask / Web3 provider' },
    { id: 'submitted', label: 'Broadcasted to Mempool', desc: 'Transaction submitted with unique tx hash' },
    { id: 'confirming', label: 'Block Inclusion', desc: 'Awaiting block confirmation on ledger' },
    { id: 'confirmed', label: 'On-Chain Attestation', desc: 'Incident anchored in ThreatRegistry.sol' }
  ];

  const getStepState = (stepId) => {
    const order = ['approving', 'submitted', 'confirming', 'confirmed'];
    const currentIndex = order.indexOf(status);
    const stepIndex = order.indexOf(stepId);

    if (status === 'error') {
      if (stepIndex === 0 && !txHash) return 'failed';
      if (stepIndex <= 1 && txHash) return 'done';
      return 'failed';
    }

    if (stepIndex < currentIndex) return 'done';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div
      className="transaction-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="transaction-modal-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: 'rgba(129, 140, 248, 0.15)',
                color: 'var(--accent-blockchain)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Blockchain Ledger Attestation
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                {isSepolia ? 'Ethereum Sepolia Testnet (11155111)' : 'Hardhat Local Chain (31337)'}
              </div>
            </div>
          </div>

          {(status === 'confirmed' || status === 'error') && (
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 18px' }}>
          {/* Target Incident Meta */}
          {incidentId && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                marginBottom: '16px',
                fontSize: '0.75rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>Incident ID:</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{incidentId}</span>
            </div>
          )}

          {/* Stepper Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
            {steps.map((st, idx) => {
              const state = getStepState(st.id);
              const isLast = idx === steps.length - 1;

              let iconColor = 'var(--text-muted)';
              if (state === 'done') iconColor = 'var(--success)';
              if (state === 'active') iconColor = 'var(--primary)';
              if (state === 'failed') iconColor = 'var(--critical)';

              return (
                <div key={st.id} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                  {/* Vertical line connecting steps */}
                  {!isLast && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '11px',
                        top: '24px',
                        width: '2px',
                        height: 'calc(100% + 2px)',
                        background: state === 'done' ? 'rgba(52, 211, 153, 0.4)' : 'var(--border)',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Icon circle */}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'var(--surface-card)',
                      border: `2px solid ${iconColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                      flexShrink: 0,
                    }}
                  >
                    {state === 'done' && <Check size={12} style={{ color: 'var(--success)' }} />}
                    {state === 'active' && <Loader2 size={12} className="spin" style={{ color: 'var(--primary)' }} />}
                    {state === 'failed' && <XCircle size={12} style={{ color: 'var(--critical)' }} />}
                    {state === 'pending' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)' }} />}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: state === 'active' || state === 'done' ? 600 : 500,
                          color: state === 'active' ? 'var(--primary)' : state === 'failed' ? 'var(--critical)' : 'var(--text-primary)',
                        }}
                      >
                        {st.label}
                      </span>
                      {state === 'active' && (
                        <span className="badge badge-info" style={{ fontSize: '0.625rem', padding: '1px 6px' }}>
                          In Progress
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {st.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details & Hashes Box */}
          {(txHash || contractAddress || errorMessage) && (
            <div
              style={{
                background: 'var(--surface-card)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                padding: '12px',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {txHash && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transaction Hash:</span>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={copyHash}
                      style={{ padding: '2px 6px', fontSize: '0.6875rem', height: 'auto' }}
                    >
                      {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div
                    className="mono"
                    style={{
                      wordBreak: 'break-all',
                      color: 'var(--accent-blockchain)',
                      background: 'var(--surface-elevated)',
                      padding: '4px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {txHash}
                  </div>
                </div>
              )}

              {blockNumber && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Block Included:</span>
                  <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{blockNumber}</span>
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--critical)',
                    color: 'var(--critical)',
                    fontSize: '0.75rem',
                    lineHeight: 1.4,
                  }}
                >
                  <strong>Transaction Error:</strong> {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-card)',
          }}
        >
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              <ExternalLink size={13} /> View on Etherscan ↗
            </a>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {status === 'error' && onRetry && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onRetry}
                style={{ fontSize: '0.75rem' }}
              >
                Retry Transaction
              </button>
            )}

            {(status === 'confirmed' || status === 'error') && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onClose}
                style={{ fontSize: '0.75rem' }}
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TransactionModal;
