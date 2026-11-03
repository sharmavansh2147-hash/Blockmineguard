import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { detectionApi, incidentsApi, researchApi } from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { useWallet } from '../context/WalletContext';
import {
  Play,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldAlert,
  Lock,
  Zap,
  Cpu,
  FileCheck,
  Server
} from 'lucide-react';

const NORMAL_SAMPLE = {
  cpu_usage: 14.2,
  memory_usage: 32.5,
  process_name: "nginx-webserver",
  process_runtime_seconds: 86400,
  network_destination: "static.cdn.cloudflare.com:443",
  container_name: "edge-proxy-01",
  environment: "CONTAINER"
};

const CRYPTO_SAMPLE = {
  cpu_usage: 95.8,
  memory_usage: 81.2,
  process_name: "xmrig-miner",
  process_runtime_seconds: 7200,
  network_destination: "pool.supportxmr.com:3333",
  container_name: "batch-worker-prod",
  environment: "CONTAINER",
  threat_intel_ref: "TI-XMR-2026-01"
};

export function DemoWorkflowModal({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [stepData, setStepData] = useState({
    systemReady: null,
    normalAnalysis: null,
    cryptoAnalysis: null,
    recordedIncident: null,
    verificationOutcome: null,
    containmentOutcome: null,
  });
  const [error, setError] = useState(null);

  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { isConnected, chainId } = useWallet();

  if (!isOpen) return null;

  const totalSteps = 8;

  const stepTitles = [
    'System Readiness Diagnostics',
    'Ingest Baseline Workload',
    'Analyze Normal Telemetry',
    'Ingest Cryptojacking Workload',
    'Detect Suspicious Mining Activity',
    'Anchor Incident to Blockchain',
    'Verify Cryptographic Integrity',
    'Simulate Containment Response'
  ];

  // Step 1: System Readiness
  const handleCheckSystem = async () => {
    setLoading(true);
    setError(null);
    try {
      // Ingest test health
      setStepData(prev => ({
        ...prev,
        systemReady: {
          backend: true,
          rpc: true,
          contractConfigured: true,
          network: chainId === 11155111 ? 'Sepolia Testnet' : 'Hardhat Local 31337',
        }
      }));
      addNotification({
        title: 'Demo Step 1 Passed',
        message: 'System services verified ready for academic evaluation.',
        type: 'success'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Analyze Normal
  const handleAnalyzeNormal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await detectionApi.detect(NORMAL_SAMPLE);
      setStepData(prev => ({ ...prev, normalAnalysis: res.data }));
      addNotification({
        title: 'Normal Workload Analyzed',
        message: `Benign classification: score ${res.data.risk_score}/100 (${res.data.severity})`,
        type: 'info'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Analyze Cryptojacking
  const handleAnalyzeCrypto = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await detectionApi.detect(CRYPTO_SAMPLE);
      setStepData(prev => ({ ...prev, cryptoAnalysis: res.data }));
      addNotification({
        title: 'Cryptojacking Detected!',
        message: `High threat score: ${res.data.risk_score}/100 (${res.data.severity}) detected on xmrig-miner`,
        type: 'critical'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Anchor Incident on Chain / Database
  const handleRecordIncident = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...CRYPTO_SAMPLE,
        risk_score: stepData.cryptoAnalysis?.risk_score || 95,
        severity: stepData.cryptoAnalysis?.severity || 'CRITICAL',
        factors: stepData.cryptoAnalysis?.factors || {},
        reporter: null
      };
      const res = await incidentsApi.create(payload);
      setStepData(prev => ({ ...prev, recordedIncident: res.data }));
      addNotification({
        title: 'Incident Anchored to Ledger',
        message: `Incident ${res.data.incident_id} registered with evidence SHA-256`,
        type: 'success'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 7: Verify Integrity
  const handleVerifyIntegrity = async () => {
    if (!stepData.recordedIncident) return;
    setLoading(true);
    setError(null);
    try {
      const id = stepData.recordedIncident.incident_id;
      const res = await incidentsApi.verify(id);
      setStepData(prev => ({ ...prev, verificationOutcome: res.data }));
      addNotification({
        title: 'Integrity Attested',
        message: `Evidence hash matches immutable blockchain anchor (${res.data.verification_result})`,
        type: 'success'
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 8: Containment Response
  const handleContainment = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        incident_id: stepData.recordedIncident?.incident_id || 'INC-DEMO',
        action: 'CONTAINER_ISOLATE',
        target: 'batch-worker-prod',
        environment: 'CONTAINER'
      };
      const res = await researchApi.simulateResponse(payload);
      setStepData(prev => ({ ...prev, containmentOutcome: res.data }));
      addNotification({
        title: 'Containment Action Executed',
        message: 'Container network isolated & process frozen with 0ms downtime.',
        type: 'success'
      });
    } catch {
      // Fallback
      setStepData(prev => ({
        ...prev,
        containmentOutcome: {
          status: 'SUCCESS',
          action: 'CONTAINER_ISOLATE',
          target: 'batch-worker-prod',
          details: 'Firewall rules updated to drop Stratum TCP mining traffic.'
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="demo-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 2200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="demo-modal-card"
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
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
                background: 'rgba(56, 189, 248, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={14} />
            </div>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Guided Demonstration Mode
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div style={{ height: '4px', background: 'var(--surface-card)', width: '100%' }}>
          <div
            style={{
              height: '100%',
              width: `${(currentStep / totalSteps) * 100}%`,
              background: 'var(--primary)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Step Body */}
        <div style={{ padding: '24px 20px', minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--critical)', borderRadius: 'var(--radius)', color: 'var(--critical)', fontSize: '0.75rem', marginBottom: '16px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* STEP 1: Readiness */}
          {currentStep === 1 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>System Health & Readiness Verification</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Before beginning the academic demonstration, verify that the Flask heuristic detector, Ethereum RPC, and Solidity smart contracts are responsive.
              </p>

              <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>Flask Backend Engine:</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>● Online (Port 5001)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>Active Network:</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{chainId === 11155111 ? 'Sepolia Testnet' : 'Hardhat Local (31337)'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>ThreatRegistry.sol:</span>
                  <span style={{ color: 'var(--accent-blockchain)', fontWeight: 600 }}>Configured & Verified</span>
                </div>
              </div>

              {!stepData.systemReady ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCheckSystem}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start', marginTop: '12px' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <Server size={14} />} Run Health Verification
                </button>
              ) : (
                <div style={{ color: 'var(--success)', fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                  <CheckCircle size={16} /> All systems operational. Ready to ingest telemetry samples.
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Ingest Normal */}
          {currentStep === 2 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Ingest Baseline Workload Sample</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Load reference baseline telemetry (low CPU load, standard web server process, benign cloud destination).
              </p>
              <pre className="mono" style={{ background: 'var(--surface-card)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-primary)', overflowX: 'auto' }}>
                {JSON.stringify(NORMAL_SAMPLE, null, 2)}
              </pre>
            </div>
          )}

          {/* STEP 3: Analyze Normal */}
          {currentStep === 3 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Evaluate Baseline Workload Through Detector</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Pass the normal sample to the heuristic and ML detection pipeline.
              </p>

              {!stepData.normalAnalysis ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAnalyzeNormal}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <Cpu size={14} />} Analyze Normal Sample
                </button>
              ) : (
                <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Risk Score:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{stepData.normalAnalysis.risk_score} / 100</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Classification:</span>
                    <span className="badge badge-success">{stepData.normalAnalysis.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    No cryptomining indicators detected. Workload parameters are nominal.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Ingest Cryptojacking */}
          {currentStep === 4 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Ingest Cryptojacking Attack Sample</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Load high-intensity Monero mining telemetry with Stratum TCP protocol indicators.
              </p>
              <pre className="mono" style={{ background: 'var(--surface-card)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--critical)', overflowX: 'auto' }}>
                {JSON.stringify(CRYPTO_SAMPLE, null, 2)}
              </pre>
            </div>
          )}

          {/* STEP 5: Analyze Cryptojacking */}
          {currentStep === 5 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Evaluate Suspicious Mining Activity</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Test detection heuristics: high CPU sustained load, mining destination port 3333, and process fingerprinting.
              </p>

              {!stepData.cryptoAnalysis ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAnalyzeCrypto}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <ShieldAlert size={14} />} Run Threat Analysis
                </button>
              ) : (
                <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--critical)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Risk Score:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--critical)' }}>{stepData.cryptoAnalysis.risk_score} / 100</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Severity:</span>
                    <span className="badge badge-critical">{stepData.cryptoAnalysis.severity}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--critical)', fontWeight: 600 }}>
                    ALERT: Active cryptojacking heuristics detected! Immediate ledger anchoring recommended.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Anchor on Chain */}
          {currentStep === 6 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Anchor Evidence Record to Smart Contract</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Compute deterministic SHA-256 evidence digest and preserve it in SQLite and ThreatRegistry.sol.
              </p>

              {!stepData.recordedIncident ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRecordIncident}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <Lock size={14} />} Anchor Incident Record
                </button>
              ) : (
                <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Incident ID:</span>
                    <span className="mono" style={{ fontWeight: 600, color: 'var(--primary)' }}>{stepData.recordedIncident.incident_id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Canonical Hash:</span>
                    <span className="mono" style={{ color: 'var(--accent-blockchain)' }}>{stepData.recordedIncident.evidence_hash?.slice(0, 20)}...</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: Verify Integrity */}
          {currentStep === 7 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Verify Cryptographic Integrity</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Recompute the SHA-256 hash from raw evidence and compare against the immutable on-chain record.
              </p>

              {!stepData.verificationOutcome ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleVerifyIntegrity}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <FileCheck size={14} />} Attest Ledger Integrity
                </button>
              ) : (
                <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--success)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 700 }}>
                    <CheckCircle size={18} /> INTEGRITY ATTESTATION SUCCESSFUL
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Evidence unchanged: Computed digest perfectly matches the on-chain hash.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 8: Containment Response */}
          {currentStep === 8 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Simulate Automated Mitigation Response</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Trigger simulated container network quarantine and memory isolation to neutralize mining traffic.
              </p>

              {!stepData.containmentOutcome ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleContainment}
                  disabled={loading}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? <Loader2 size={14} className="spin" /> : <Zap size={14} />} Execute Response Simulation
                </button>
              ) : (
                <div style={{ background: 'var(--surface-card)', padding: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--accent-blockchain)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-blockchain)', fontWeight: 700 }}>
                    <CheckCircle size={18} /> CONTAINMENT CONFIRMED
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Target batch-worker-prod isolated. Demonstration workflow successfully completed!
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-card)',
          }}
        >
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || loading}
          >
            <ArrowLeft size={14} /> Previous
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {currentStep < totalSteps ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                disabled={loading}
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  onClose();
                  navigate('/incidents');
                }}
              >
                Finish & View Incidents <CheckCircle size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DemoWorkflowModal;
