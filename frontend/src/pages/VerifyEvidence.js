import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../App';
import { useWallet } from '../context/WalletContext';
import { incidentsApi, verificationApi, sampleDataApi, detectionApi } from '../services/api';
import { recordIncidentOnChain } from '../services/contractService';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  Lock,
  RefreshCw,
  Database,
  History,
  FileCheck2,
  Info,
  KeyRound,
  ExternalLink,
  Search,
  X,
  FlaskConical,
  FileText,
  Zap,
  ShieldAlert,
  Save,
  Filter
} from 'lucide-react';

export function arePayloadsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  try {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (typeof a[key] === 'object' && a[key] !== null) {
        if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
      } else if (String(a[key]) !== String(b[key])) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely format an audit or verification timestamp.
 * Never outputs 'Invalid Date'.
 */
export function formatAuditTimestamp(timestampStr) {
  if (!timestampStr) return '—';
  try {
    const d = new Date(timestampStr);
    if (isNaN(d.getTime())) {
      return 'Time unavailable';
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return 'Time unavailable';
  }
}

/**
 * Authoritative verification outcome model evaluator.
 * Centralized mapping for styling, labels, and messages.
 */
export function getAuthoritativeOutcomeModel(result) {
  if (!result) return null;
  const outcome = result.outcome || result.verification_result;

  if (outcome === 'VERIFIED') {
    return {
      status: 'VERIFIED',
      isVerified: true,
      isTampered: false,
      isUnregistered: false,
      isError: false,
      color: '#3FB950',
      border: '#238636',
      bgSurface: 'rgba(35, 134, 54, 0.12)',
      cardBg: 'rgba(35, 134, 54, 0.03)',
      badgeClass: 'badge-verified',
      badgeText: 'INTEGRITY VERIFIED',
      title: 'INTEGRITY VERIFIED',
      message:
        'The incident hash matches the registered on-chain commitment. No modification was detected in the data that was checked.'
    };
  }

  if (
    outcome === 'TAMPERED' ||
    outcome === 'TAMPERED_HASH_MISMATCH' ||
    outcome === 'ON_CHAIN_MISMATCH'
  ) {
    return {
      status: 'TAMPERED',
      isVerified: false,
      isTampered: true,
      isUnregistered: false,
      isError: false,
      color: '#F85149',
      border: '#DA3633',
      bgSurface: 'rgba(218, 54, 51, 0.12)',
      cardBg: 'rgba(218, 54, 51, 0.03)',
      badgeClass: 'badge-tampered',
      badgeText: 'TAMPERING DETECTED',
      title: 'TAMPERING DETECTED',
      message:
        'The current incident data does not match the original on-chain commitment. One or more fields may have been modified.'
    };
  }

  if (outcome === 'UNREGISTERED_ON_CHAIN') {
    return {
      status: 'UNREGISTERED_ON_CHAIN',
      isVerified: false,
      isTampered: false,
      isUnregistered: true,
      isError: false,
      color: '#D29922',
      border: '#9E6A03',
      bgSurface: 'rgba(210, 153, 34, 0.12)',
      cardBg: 'rgba(210, 153, 34, 0.03)',
      badgeClass: 'badge-warning',
      badgeText: 'UNREGISTERED',
      title: 'UNREGISTERED ON BLOCKCHAIN',
      message:
        'Local cryptographic hash is authentic, but incident has not yet been registered on Ethereum.'
    };
  }

  if (outcome === 'BLOCKCHAIN_OUTAGE' || outcome === 'NETWORK_ERROR') {
    return {
      status: 'NETWORK_ERROR',
      isVerified: false,
      isTampered: false,
      isUnregistered: false,
      isError: true,
      color: '#8B949E',
      border: '#30363D',
      bgSurface: 'rgba(139, 148, 158, 0.12)',
      cardBg: 'transparent',
      badgeClass: 'badge-secondary',
      badgeText: 'NETWORK ERROR',
      title: 'RPC NODE UNREACHABLE',
      message:
        'Blockchain verification could not be completed because the Ethereum RPC node is unreachable.'
    };
  }

  if (outcome === 'CONTRACT_ERROR') {
    return {
      status: 'CONTRACT_ERROR',
      isVerified: false,
      isTampered: false,
      isUnregistered: false,
      isError: true,
      color: '#8B949E',
      border: '#30363D',
      bgSurface: 'rgba(139, 148, 158, 0.12)',
      cardBg: 'transparent',
      badgeClass: 'badge-secondary',
      badgeText: 'CONTRACT ERROR',
      title: 'SMART CONTRACT ERROR',
      message:
        'Smart contract execution reverted or encountered an error during verification.'
    };
  }

  if (outcome === 'NOT_FOUND') {
    return {
      status: 'NOT_FOUND',
      isVerified: false,
      isTampered: false,
      isUnregistered: false,
      isError: true,
      color: '#8B949E',
      border: '#30363D',
      bgSurface: 'rgba(139, 148, 158, 0.12)',
      cardBg: 'transparent',
      badgeClass: 'badge-secondary',
      badgeText: 'NOT FOUND',
      title: 'INCIDENT NOT FOUND',
      message: 'The requested incident does not exist in the database or registry.'
    };
  }

  return {
    status: outcome || 'UNKNOWN',
    isVerified: false,
    isTampered: false,
    isUnregistered: false,
    isError: false,
    color: '#8B949E',
    border: '#30363D',
    bgSurface: 'rgba(139, 148, 158, 0.12)',
    cardBg: 'transparent',
    badgeClass: 'badge-secondary',
    badgeText: outcome || 'EVALUATED',
    title: 'VERIFICATION EVALUATED',
    message: result.details || 'Verification query processed.'
  };
}

export function VerifyEvidence() {
  const { showToast } = useApp();
  const { chainId, isConnected, signer, account, connect } = useWallet();
  const activeChainId = chainId || 31337;
  const isSepolia = activeChainId === 11155111;

  const [evidenceInput, setEvidenceInput] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [isDraftModified, setIsDraftModified] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [workingHash, setWorkingHash] = useState('');
  const [originalHash, setOriginalHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  // Incident Selector State
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [loadingIncidents, setLoadingIncidents] = useState(false);

  // Canonical copy for diff comparison & reset baseline
  const [canonicalEvidence, setCanonicalEvidence] = useState(null);
  const [originalPayload, setOriginalPayload] = useState(null);
  const [tamperedField, setTamperedField] = useState(null);

  // Verification History
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Accessible custom tooltip for Reload action
  const [showReloadTooltip, setShowReloadTooltip] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [totalIncidentsCount, setTotalIncidentsCount] = useState(0);

  // Sample Dataset State
  const [activeSample, setActiveSample] = useState(null);
  const [sampleDetection, setSampleDetection] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [savingSampleIncident, setSavingSampleIncident] = useState(false);
  const [showThreatIntelModal, setShowThreatIntelModal] = useState(false);

  // Stable references for preventing race conditions & unexpected selection overwrites
  const activeRequestIdRef = useRef(0);
  const selectedIncidentIdRef = useRef('');
  const selectionSeqRef = useRef(0);
  const recentIncidentsRef = useRef([]);

  // Fetch verification history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await verificationApi.getHistory(20);
      setHistory(res.data?.history || []);
    } catch (err) {
      console.error('Failed to load verification history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Authoritative verification executor
  const executeVerification = useCallback(
    async (evidencePayload) => {
      if (!evidencePayload) return;
      const id = evidencePayload.incident_id || evidencePayload.incidentId || selectedIncidentIdRef.current;
      if (!id) {
        showToast('Evidence must specify an incident_id', 'error', { category: 'verification' });
        return;
      }

      const reqId = ++activeRequestIdRef.current;
      setVerifying(true);

      try {
        const response = await incidentsApi.verify(id, evidencePayload);
        if (reqId !== activeRequestIdRef.current) return; // Discard stale response

        const data = response.data;
        setResult(data);
        setIsStale(false);
        if (data?.computed_hash) {
          setWorkingHash(data.computed_hash);
        }

        const outcome = data?.outcome || data?.verification_result;
        if (outcome === 'VERIFIED') {
          showToast('Integrity verification completed successfully.', 'success', {
            category: 'verification'
          });
        } else if (
          outcome === 'TAMPERED' ||
          outcome === 'TAMPERED_HASH_MISMATCH' ||
          outcome === 'ON_CHAIN_MISMATCH'
        ) {
          showToast('Tampering detected: hashes do not match.', 'error', {
            category: 'verification'
          });
        } else if (outcome === 'UNREGISTERED_ON_CHAIN') {
          showToast('This incident has not been registered on-chain.', 'warning', {
            category: 'verification'
          });
        } else if (outcome === 'BLOCKCHAIN_OUTAGE' || outcome === 'NETWORK_ERROR') {
          showToast('Blockchain verification could not be completed.', 'error', {
            category: 'verification'
          });
        } else {
          showToast('Verification completed.', 'info', { category: 'verification' });
        }

        loadHistory();
      } catch (error) {
        if (reqId !== activeRequestIdRef.current) return;
        if (error.response?.data) {
          setResult(error.response.data);
        } else {
          setResult({
            incident_id: id,
            outcome: 'NETWORK_ERROR',
            verification_result: 'NETWORK_ERROR',
            evidence_match: false,
            details: error.message || 'Connection error contacting verification service'
          });
        }
        showToast(
          error.response?.data?.details || error.response?.data?.error || error.message || 'Blockchain verification could not be completed.',
          'error',
          { category: 'verification' }
        );
      } finally {
        if (reqId === activeRequestIdRef.current) {
          setVerifying(false);
        }
      }
    },
    [showToast, loadHistory]
  );

  // Authoritative incident selector: loads distinct payload, cancels in-flight superseded calls, clears old hashes
  const handleSelectIncident = useCallback(
    async (id, overrideList = null) => {
      if (!id) return;

      const seq = ++selectionSeqRef.current;
      setSelectedIncidentId(id);
      selectedIncidentIdRef.current = id;

      // Clear sample mode
      setActiveSample(null);
      setSampleDetection(null);

      // Reset previous incident verification results so previous hash doesn't linger
      setResult(null);
      setWorkingHash('');
      setOriginalHash('');
      setTamperedField(null);
      setJsonError(null);
      setIsDraftModified(false);
      setIsStale(false);

      const list = overrideList || recentIncidentsRef.current;
      const found = list.find((i) => i.incident_id === id);

      let payload = null;
      try {
        const detailRes = await incidentsApi.getById(id);
        if (seq !== selectionSeqRef.current) return; // Discard superseded selection
        if (detailRes.data?.canonical_evidence) {
          payload = detailRes.data.canonical_evidence;
        }
      } catch (fetchErr) {
        if (seq !== selectionSeqRef.current) return;
        console.warn('Could not fetch canonical evidence detail, falling back to list record:', fetchErr);
      }

      if (seq !== selectionSeqRef.current) return;

      if (!payload && found) {
        let rawEvidence = {};
        if (found.evidence_data) {
          try {
            rawEvidence =
              typeof found.evidence_data === 'string'
                ? JSON.parse(found.evidence_data)
                : found.evidence_data;
          } catch (e) {
            rawEvidence = {};
          }
        }

        let parsedFactors = null;
        if (found.factors) {
          try {
            parsedFactors =
              typeof found.factors === 'string' ? JSON.parse(found.factors) : found.factors;
          } catch (e) {
            parsedFactors = null;
          }
        } else if (rawEvidence.factors) {
          parsedFactors = rawEvidence.factors;
        }

        payload = {
          incident_id: found.incident_id,
          timestamp: found.timestamp || new Date().toISOString(),
          cpu_usage: Number(
            found.cpu_usage !== undefined ? found.cpu_usage : (rawEvidence.cpu_usage || 0)
          ),
          memory_usage: Number(
            found.memory_usage !== undefined ? found.memory_usage : (rawEvidence.memory_usage || 0)
          ),
          process_name: found.process_name || rawEvidence.process_name || 'process',
          process_runtime_seconds: Number(
            found.process_runtime_seconds !== undefined
              ? found.process_runtime_seconds
              : (rawEvidence.process_runtime_seconds || 0)
          ),
          network_destination:
            found.network_destination !== undefined
              ? found.network_destination
              : (rawEvidence.network_destination || null),
          container_name:
            found.container_name !== undefined ? found.container_name : (rawEvidence.container_name || null),
          environment: found.environment || rawEvidence.environment || 'HOST',
          risk_score: Number(
            found.risk_score !== undefined ? found.risk_score : (rawEvidence.risk_score || 0)
          ),
          severity: found.severity || rawEvidence.severity || 'LOW',
          factors: parsedFactors || []
        };
      }

      if (!payload) {
        showToast(`Could not load evidence payload for incident ${id}`, 'error', {
          category: 'verification'
        });
        return;
      }

      const baselineCopy = JSON.parse(JSON.stringify(payload));
      setCanonicalEvidence(baselineCopy);
      setOriginalPayload(baselineCopy);
      setEvidenceInput(JSON.stringify(payload, null, 2));

      // Calculate initial authoritative canonical digest
      try {
        const hashRes = await incidentsApi.computeHash(payload);
        if (seq !== selectionSeqRef.current) return;
        if (hashRes.data?.hash) {
          setOriginalHash(hashRes.data.hash);
          setWorkingHash(hashRes.data.hash);
        }
      } catch (e) {
        if (seq !== selectionSeqRef.current) return;
        if (found?.evidence_hash) {
          setOriginalHash(found.evidence_hash);
          setWorkingHash(found.evidence_hash);
        }
      }

      if (seq !== selectionSeqRef.current) return;

      // Trigger authoritative verification check for newly selected incident
      executeVerification(payload);
    },
    [executeVerification, showToast]
  );

  // Fetch incidents to populate dropdown based on active filters
  const loadIncidents = useCallback(
    async (params = {}) => {
      setLoadingIncidents(true);
      try {
        const queryParams = {
          limit: 100,
          ...params
        };
        if (queryParams.severity === 'ALL') delete queryParams.severity;
        if (queryParams.verification === 'ALL') delete queryParams.verification;
        if (!queryParams.search?.trim()) delete queryParams.search;

        const res = await incidentsApi.getAll(queryParams);
        const incList = Array.isArray(res.data) ? res.data : (res.data?.incidents || []);
        const total = res.data?.total !== undefined ? res.data.total : incList.length;

        setRecentIncidents(incList);
        recentIncidentsRef.current = incList;
        setTotalIncidentsCount(total);

        // If no incident is currently selected, pick default from list
        if (!selectedIncidentIdRef.current && incList.length > 0) {
          const defaultInc =
            incList.find((i) => i.verification_status !== 'TAMPERED' && i.evidence_hash) || incList[0];
          if (defaultInc) {
            handleSelectIncident(defaultInc.incident_id, incList);
          }
        }
      } catch (err) {
        console.error('Failed to load incidents for verification selector:', err);
      } finally {
        setLoadingIncidents(false);
      }
    },
    [handleSelectIncident]
  );

  // Initial load on mount
  useEffect(() => {
    loadIncidents();
    loadHistory();
  }, [loadIncidents, loadHistory]);

  // Debounced search and filter watcher
  useEffect(() => {
    const timer = setTimeout(() => {
      loadIncidents({
        search: searchQuery,
        severity: filterSeverity,
        verification: filterStatus
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, filterSeverity, filterStatus, loadIncidents]);

  // Load sample dataset from sample_data/ directory
  const handleLoadSample = async (sampleId) => {
    setLoadingSample(true);
    try {
      const res = await sampleDataApi.get(sampleId);
      const sampleItem = res.data;
      const data = sampleItem.data;
      const filename = sampleItem.filename || `${sampleId}.json`;

      setSelectedIncidentId('');
      selectedIncidentIdRef.current = '';
      setResult(null);
      setOriginalHash('');
      setWorkingHash('');
      setTamperedField(null);
      setJsonError(null);
      setIsDraftModified(false);
      setIsStale(false);

      if (sampleId === 'threat_intelligence') {
        setActiveSample({
          id: sampleId,
          filename,
          name: 'Threat Intelligence Feed (10 IOCs)',
          type: 'threat_intel',
          data
        });
        setShowThreatIntelModal(true);
        setEvidenceInput(JSON.stringify(data, null, 2));
        showToast('Loaded sample threat intelligence dataset (10 indicators)', 'info', {
          category: 'verification'
        });
      } else {
        const isCrypto = sampleId === 'cryptojacking_workload';
        setActiveSample({
          id: sampleId,
          filename,
          name: isCrypto ? 'Cryptojacking Workload (XMRig)' : 'Normal Workload (Nginx)',
          type: 'workload',
          data
        });
        setShowThreatIntelModal(false);
        setEvidenceInput(JSON.stringify(data, null, 2));
        setCanonicalEvidence(JSON.parse(JSON.stringify(data)));
        setOriginalPayload(JSON.parse(JSON.stringify(data)));

        // Compute working hash
        try {
          const hashRes = await incidentsApi.computeHash(data);
          if (hashRes.data?.hash) {
            setWorkingHash(hashRes.data.hash);
            setOriginalHash(hashRes.data.hash);
          }
        } catch (e) {
          console.warn('Could not compute sample hash:', e);
        }

        // Run real detector on the raw workload sample
        try {
          const detectRes = await detectionApi.detect(data);
          setSampleDetection(detectRes.data);
          showToast(
            `Loaded ${filename}: Detector scored ${detectRes.data?.risk_score?.score ?? 'N/A'}/100 (${detectRes.data?.risk_score?.severity ?? 'LOW'})`,
            detectRes.data?.suspicious ? 'warning' : 'success',
            { category: 'verification' }
          );
        } catch (detErr) {
          console.warn('Detector run failed:', detErr);
          setSampleDetection(null);
        }
      }
    } catch (err) {
      console.error('Failed to load sample dataset:', err);
      showToast(`Failed to load sample dataset: ${err.message}`, 'error', {
        category: 'verification'
      });
    } finally {
      setLoadingSample(false);
    }
  };

  // Convert raw sample into a genuine database incident & prepare for blockchain anchoring
  const handleSaveSampleAsIncident = async () => {
    if (!activeSample || activeSample.type !== 'workload') return;
    setSavingSampleIncident(true);

    try {
      const payloadToSave = {
        ...activeSample.data,
        threshold: activeSample.id === 'normal_workload' ? 10 : 35
      };

      const res = await incidentsApi.create(payloadToSave);
      const newIncidentId = res.data?.incident_id || res.data?.incident?.incident_id;
      if (!newIncidentId) {
        throw new Error('Server did not return a valid incident record');
      }

      showToast(`Created authentic incident ${newIncidentId} from sample. Loading into workbench...`, 'success', {
        category: 'verification'
      });

      setActiveSample(null);
      setSampleDetection(null);

      await loadIncidents();
      await handleSelectIncident(newIncidentId);
    } catch (err) {
      console.error('Failed to save sample as incident:', err);
      showToast(
        err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to save sample as incident',
        'error',
        { category: 'verification' }
      );
    } finally {
      setSavingSampleIncident(false);
    }
  };

  const handleEvidenceInputChange = (text) => {
    setEvidenceInput(text);
    setIsStale(true);

    if (!text.trim()) {
      setJsonError('Evidence JSON payload cannot be empty');
      return;
    }

    try {
      const parsed = JSON.parse(text);
      setJsonError(null);

      // Check if working draft differs from original canonical baseline
      if (canonicalEvidence) {
        const isDiff = !arePayloadsEqual(parsed, canonicalEvidence);
        setIsDraftModified(isDiff);
      }

      // Live recompute canonical SHA-256 digest
      incidentsApi.computeHash(parsed)
        .then((res) => {
          if (res.data?.hash) {
            setWorkingHash(res.data.hash);
          }
        })
        .catch(() => {});
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleVerify = () => {
    if (!evidenceInput.trim()) {
      showToast('Please provide evidence JSON payload', 'warning', { category: 'verification' });
      return;
    }

    let evidence;
    try {
      evidence = JSON.parse(evidenceInput);
    } catch (error) {
      showToast('Invalid JSON syntax: ' + error.message, 'error', { category: 'verification' });
      return;
    }

    setIsStale(false);
    executeVerification(evidence);
  };

  const tamperSample = () => {
    if (!evidenceInput.trim() || verifying) return;

    // Step 5 prerequisite: the incident must already have a real on-chain commitment.
    const selectedInc = recentIncidents.find((i) => i.incident_id === selectedIncidentId);
    const hasOnChainCommitment = Boolean(
      selectedInc?.blockchain_incident_id ||
      result?.on_chain_hash ||
      (result?.outcome === 'VERIFIED')
    );
    if (!hasOnChainCommitment) {
      showToast(
        'Tampering verification requires an existing on-chain commitment. Please register the incident on the blockchain first.',
        'warning',
        { category: 'verification' }
      );
      return;
    }

    try {
      const evidence = JSON.parse(evidenceInput);
      const oldCpu =
        evidence.cpu_usage !== undefined ? evidence.cpu_usage : (evidence.cpuUsage || 95.4);
      const oldRisk =
        evidence.risk_score !== undefined ? evidence.risk_score : (evidence.riskScore || 90);

      const newCpu = Number(oldCpu) > 50 ? 14.5 : 98.4;
      const newRisk = Number(oldRisk) > 50 ? 15 : 95;

      evidence.cpu_usage = newCpu;
      if (evidence.cpuUsage !== undefined) delete evidence.cpuUsage;
      evidence.risk_score = newRisk;
      if (evidence.riskScore !== undefined) delete evidence.riskScore;
      if (evidence.severity) {
        evidence.severity =
          evidence.severity === 'CRITICAL' || evidence.severity === 'HIGH' ? 'LOW' : 'CRITICAL';
      }

      setTamperedField({
        originalCpu: oldCpu,
        tamperedCpu: newCpu,
        originalRisk: oldRisk,
        tamperedRisk: newRisk
      });

      const jsonStr = JSON.stringify(evidence, null, 2);
      setEvidenceInput(jsonStr);
      setIsDraftModified(true);
      setJsonError(null);
      setIsStale(false);

      incidentsApi.computeHash(evidence)
        .then((res) => {
          if (res.data?.hash) {
            setWorkingHash(res.data.hash);
          }
        })
        .catch(() => {});

      showToast('Simulated tamper applied. Evaluating cryptographic check...', 'warning', {
        category: 'verification'
      });

      // Immediately run real verification comparison logic on the modified controlled test copy
      executeVerification(evidence);
    } catch (e) {
      showToast('Failed to parse evidence for tampering: ' + e.message, 'error', {
        category: 'verification'
      });
    }
  };

  const restoreCanonical = () => {
    if (!canonicalEvidence || verifying) return;
    const cleanCopy = JSON.parse(JSON.stringify(canonicalEvidence));
    setEvidenceInput(JSON.stringify(cleanCopy, null, 2));
    setTamperedField(null);
    setJsonError(null);
    setIsDraftModified(false);
    setIsStale(false);

    if (originalHash) {
      setWorkingHash(originalHash);
    } else {
      incidentsApi.computeHash(cleanCopy)
        .then((res) => {
          if (res.data?.hash) setWorkingHash(res.data.hash);
        })
        .catch(() => {});
    }

    showToast('Authentic baseline evidence restored. Re-evaluating on-chain verification...', 'info', {
      category: 'verification'
    });

    // Recompute digest and verify against original commitment
    executeVerification(cleanCopy);
  };

  const handleRegisterOnChain = async () => {
    if (!selectedIncidentId) {
      showToast('No incident selected for on-chain anchoring.', 'warning', {
        category: 'verification'
      });
      return;
    }
    if (jsonError) {
      showToast('Cannot register invalid JSON: ' + jsonError, 'error', {
        category: 'verification'
      });
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(evidenceInput);
    } catch (e) {
      showToast('Invalid JSON syntax: cannot register malformed payload.', 'error', {
        category: 'verification'
      });
      return;
    }

    let activeSigner = signer;
    if (!isConnected || !activeSigner) {
      showToast('Connecting wallet for on-chain anchoring...', 'info', {
        category: 'verification'
      });
      try {
        const walletRes = await connect();
        activeSigner = walletRes?.signer;
      } catch (err) {
        showToast(err.message || 'Please connect your MetaMask wallet to anchor this incident.', 'warning', {
          category: 'verification'
        });
        return;
      }
    }

    try {
      setRegistering(true);
      showToast('Please approve the registration transaction in MetaMask...', 'info', {
        category: 'verification'
      });

      // Calculate authoritative canonical digest for the submitted payload
      let hashToRegister = workingHash;
      try {
        const hashRes = await incidentsApi.computeHash(parsedPayload);
        if (hashRes.data?.hash) {
          hashToRegister = hashRes.data.hash;
          setWorkingHash(hashRes.data.hash);
        }
      } catch {}

      const selectedInc = recentIncidents.find((i) => i.incident_id === selectedIncidentId);
      const evidenceHash = hashToRegister || result?.computed_hash || canonicalEvidence?.evidence_hash || selectedInc?.evidence_hash;
      const severity = parsedPayload?.severity || canonicalEvidence?.severity || selectedInc?.severity || 'HIGH';
      const threatIntelRef = selectedInc?.threat_intel_ref || '';

      const receipt = await recordIncidentOnChain(
        activeSigner,
        selectedIncidentId,
        evidenceHash,
        severity,
        threatIntelRef
      );

      // Persist to backend database
      try {
        await incidentsApi.updateBlockchain(selectedIncidentId, {
          tx_hash: receipt.txHash,
          blockchain_incident_id: receipt.incidentId,
          block_number: receipt.blockNumber,
          gas_used: receipt.gasUsed,
          contract_address: receipt.contractAddress,
          chain_id: receipt.chainId,
          reporter_address: account
        });
      } catch (backendErr) {
        console.warn('Backend SQLite sync notice:', backendErr);
      }

      showToast(
        receipt.alreadyRegistered
          ? `Record already anchored on-chain at index #${receipt.incidentId}. Re-evaluating...`
          : `Proof anchored on-chain in block #${receipt.blockNumber}! Re-evaluating...`,
        'success',
        { category: 'verification' }
      );

      await loadIncidents();
      await loadHistory();

      // Trigger authoritative verification check for newly anchored payload
      executeVerification(parsedPayload);
    } catch (err) {
      console.error('On-chain registration failed:', err);
      let msg = err.message || 'Registration transaction failed';
      if (err.code === 4001 || err.action === 'sendTransaction') {
        msg = 'Transaction rejected in MetaMask';
      }
      showToast(msg, 'error', { category: 'verification' });
    } finally {
      setRegistering(false);
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
      showToast('Attestation receipt copied to clipboard', 'success');
    }
  };

  const copyTxHash = (hash) => {
    if (hash) {
      navigator.clipboard.writeText(hash);
      setCopiedTx(true);
      setTimeout(() => setCopiedTx(false), 2000);
      showToast('Transaction hash copied', 'success');
    }
  };

  const outcomeModel = getAuthoritativeOutcomeModel(result);

  return (
    <div className="verify-page" style={{ padding: '0 4px 48px' }}>
      {/* Enterprise Header Bar */}
      <div
        style={{
          background: outcomeModel?.isVerified
            ? 'linear-gradient(180deg, rgba(35, 134, 54, 0.08) 0%, var(--surface-card) 100%)'
            : outcomeModel?.isTampered
            ? 'linear-gradient(180deg, rgba(218, 54, 51, 0.08) 0%, var(--surface-card) 100%)'
            : 'var(--surface-card)',
          border: `1px solid ${outcomeModel ? outcomeModel.border : 'var(--border)'}`,
          borderRadius: '8px',
          padding: '20px 24px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          transition: 'border-color 0.2s ease, background 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              background: outcomeModel ? outcomeModel.bgSurface : 'var(--surface-elevated)',
              border: `1px solid ${outcomeModel ? outcomeModel.border : 'var(--border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: outcomeModel ? outcomeModel.color : 'var(--accent-primary)',
              flexShrink: 0,
              transition: 'all 0.2s ease'
            }}
          >
            {outcomeModel?.isVerified ? (
              <CheckCircle size={24} />
            ) : outcomeModel?.isTampered ? (
              <AlertTriangle size={24} />
            ) : (
              <KeyRound size={22} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: outcomeModel?.isVerified
                    ? '#3FB950'
                    : outcomeModel?.isTampered
                    ? '#F85149'
                    : 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.01em'
                }}
              >
                Verification Center
              </h1>
              <span
                style={{
                  background: 'var(--surface-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                SHA-256 / RFC-8785
              </span>
              {outcomeModel && (
                <span
                  className={`badge ${outcomeModel.badgeClass}`}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em'
                  }}
                >
                  {outcomeModel.badgeText}
                </span>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: '0.82rem' }}>
              Verify tamper-evident digital forensic integrity against the ThreatRegistry smart contract.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isSepolia ? '#818cf8' : '#34d399'
              }}
            />
            <span>{isSepolia ? 'Sepolia (Chain 11155111)' : 'Hardhat Local (Chain 31337)'}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              loadIncidents();
              loadHistory();
            }}
            disabled={loadingIncidents || verifying}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} className={loadingIncidents || verifying ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Visual Verification Pipeline Process Flow */}
      <div
        className="card"
        style={{
          background: 'var(--surface-card)',
          border: `1px solid ${outcomeModel ? outcomeModel.border : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '16px 20px',
          marginBottom: '20px',
          transition: 'border-color 0.2s ease'
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px'
          }}
        >
          Cryptographic Verification Pipeline
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
          >
            <div style={{ fontSize: '0.64rem', color: '#38bdf8', fontWeight: 700 }}>STEP 1</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Incident Data
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Off-chain telemetry</div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
          >
            <div style={{ fontSize: '0.64rem', color: '#38bdf8', fontWeight: 700 }}>STEP 2</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Canonical Hash
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RFC-8785 SHA-256</div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
          >
            <div style={{ fontSize: '0.64rem', color: '#818cf8', fontWeight: 700 }}>STEP 3</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              On-Chain Record
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>ThreatRegistry.sol</div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)'
            }}
          >
            <div style={{ fontSize: '0.64rem', color: '#38bdf8', fontWeight: 700 }}>STEP 4</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Hash Compare
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Byte-for-byte check</div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              background: outcomeModel ? outcomeModel.bgSurface : 'var(--surface-elevated)',
              border: `1px solid ${outcomeModel ? outcomeModel.border : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              transition: 'all 0.2s ease'
            }}
          >
            <div
              style={{
                fontSize: '0.64rem',
                color: outcomeModel ? outcomeModel.color : 'var(--text-muted)',
                fontWeight: 700
              }}
            >
              STEP 5
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: outcomeModel ? outcomeModel.color : 'var(--text-primary)'
              }}
            >
              {outcomeModel ? outcomeModel.badgeText : 'Awaiting Check'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {outcomeModel?.isVerified
                ? 'Match Confirmed'
                : outcomeModel?.isTampered
                ? 'Tamper Detected'
                : outcomeModel?.isUnregistered
                ? 'Not Anchored'
                : 'Result Status'}
            </div>
          </div>
        </div>
      </div>

      {/* Academic Integrity Notice */}
      <div
        style={{
          background: 'var(--surface-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          marginBottom: '20px',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          display: 'flex',
          gap: '10px',
          alignItems: 'start'
        }}
      >
        <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Academic Integrity Notice:</strong> A successful cryptographic hash comparison
          establishes consistency between the checked telemetry and the immutable blockchain anchor.
          It mathematically proves non-repudiation and detects post-incident alteration; it does not
          claim to certify the objective physical truth of the initial telemetry sensors.
        </span>
      </div>

      {/* Main Forensic Grid: 2 Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}
      >
        {/* Left Column: Forensic Evidence Workbench */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="card-title">1. Incident Selection & Canonical Payload</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>RFC-8785 Canonical JSON</span>
          </div>

          <div
            className="card-body"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}
          >
            {/* Sample Datasets Fixture Selector */}
            <div
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius, 6px)',
                padding: '10px 12px',
                marginBottom: '4px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FlaskConical size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Sample Datasets (from sample_data/)
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Synthetic Test Fixtures
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="btn-sample-normal"
                  className={`btn btn-sm ${activeSample?.id === 'normal_workload' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => handleLoadSample('normal_workload')}
                  disabled={loadingSample || verifying}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <FileText size={12} />
                  1. Normal Workload (Nginx)
                </button>

                <button
                  type="button"
                  id="btn-sample-crypto"
                  className={`btn btn-sm ${activeSample?.id === 'cryptojacking_workload' ? 'btn-danger' : 'btn-outline'}`}
                  onClick={() => handleLoadSample('cryptojacking_workload')}
                  disabled={loadingSample || verifying}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Zap size={12} />
                  2. Cryptojacking (XMRig)
                </button>

                <button
                  type="button"
                  id="btn-sample-threat-intel"
                  className={`btn btn-sm ${activeSample?.id === 'threat_intelligence' ? 'btn-secondary' : 'btn-outline'}`}
                  onClick={() => handleLoadSample('threat_intelligence')}
                  disabled={loadingSample || verifying}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <ShieldAlert size={12} />
                  3. Threat Intel Feed (10 IOCs)
                </button>

                {activeSample && (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setActiveSample(null);
                      setSampleDetection(null);
                      if (selectedIncidentIdRef.current) {
                        handleSelectIncident(selectedIncidentIdRef.current);
                      }
                    }}
                    style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}
                  >
                    Return to Database Incident
                  </button>
                )}
              </div>
            </div>

            {/* Active Sample Context Banner */}
            {activeSample && (
              <div
                style={{
                  background:
                    activeSample.id === 'cryptojacking_workload'
                      ? 'rgba(248, 81, 73, 0.12)'
                      : activeSample.id === 'normal_workload'
                      ? 'rgba(63, 185, 80, 0.12)'
                      : 'rgba(56, 139, 253, 0.12)',
                  border: `1px solid ${
                    activeSample.id === 'cryptojacking_workload'
                      ? '#DA3633'
                      : activeSample.id === 'normal_workload'
                      ? '#238636'
                      : '#388BFD'
                  }`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                    <FlaskConical
                      size={18}
                      style={{
                        color:
                          activeSample.id === 'cryptojacking_workload'
                            ? '#F85149'
                            : activeSample.id === 'normal_workload'
                            ? '#3FB950'
                            : '#58A6FF',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Sample Loaded: {activeSample.name} ({activeSample.filename})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {activeSample.type === 'workload' ? (
                          sampleDetection ? (
                            <span>
                              <strong>Real Detector Verdict:</strong>{' '}
                              <strong style={{ color: sampleDetection.suspicious ? '#F85149' : '#3FB950' }}>
                                {sampleDetection.suspicious ? '🚨 CRYPTOJACKING DETECTED' : '🛡️ BENIGN WORKLOAD'}
                              </strong>{' '}
                              (Score: {sampleDetection.risk_score?.score ?? 'N/A'}/100, {sampleDetection.risk_score?.severity ?? 'LOW'}).
                            </span>
                          ) : (
                            'Evaluating telemetry through core detector...'
                          )
                        ) : (
                          '10 Threat Intelligence indicators loaded from synthetic test feed.'
                        )}
                      </div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        <em>Raw fixture: uncommitted to database and unanchored on-chain until saved.</em>
                      </div>
                    </div>
                  </div>

                  {activeSample.type === 'workload' && (
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={handleSaveSampleAsIncident}
                      disabled={savingSampleIncident}
                      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {savingSampleIncident ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                      Save as Incident & Anchor
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Incident Search and Filter Controls */}
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 180px' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)'
                    }}
                  />
                  <input
                    type="text"
                    id="input-incident-search"
                    className="input"
                    placeholder="Search incident ID, process..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '28px',
                      paddingRight: searchQuery ? '26px' : '10px',
                      fontSize: '0.76rem',
                      height: '32px',
                      background: 'var(--surface-elevated)',
                      borderColor: 'var(--border)'
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  id="select-filter-severity"
                  className="input"
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  style={{
                    flex: '0 1 125px',
                    fontSize: '0.76rem',
                    height: '32px',
                    background: 'var(--surface-elevated)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  id="select-filter-status"
                  className="input"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{
                    flex: '0 1 135px',
                    fontSize: '0.76rem',
                    height: '32px',
                    background: 'var(--surface-elevated)',
                    borderColor: 'var(--border)'
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="TAMPERED">Tampered</option>
                  <option value="UNVERIFIED">Unverified</option>
                </select>

                {(searchQuery || filterSeverity !== 'ALL' || filterStatus !== 'ALL') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterSeverity('ALL');
                      setFilterStatus('ALL');
                    }}
                    style={{ fontSize: '0.74rem', height: '32px', padding: '0 8px' }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Quick Selector Dropdown */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label
                  htmlFor="incident-selector"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}
                >
                  Select Incident from Database ({recentIncidents.length} shown of {totalIncidentsCount || recentIncidents.length} total):
                </label>
                {loadingIncidents && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Loader2 size={11} className="spin" /> Updating...
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  id="incident-selector"
                  className="input"
                  style={{
                    flex: 1,
                    background: 'var(--surface-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem'
                  }}
                  value={selectedIncidentId}
                  onChange={(e) => handleSelectIncident(e.target.value)}
                  disabled={loadingIncidents || verifying}
                >
                  {/* Keep active selection in options if filter excluded it */}
                  {selectedIncidentId && !recentIncidents.some((i) => i.incident_id === selectedIncidentId) && (
                    <option value={selectedIncidentId}>
                      [ACTIVE] {selectedIncidentId} (Current Selection)
                    </option>
                  )}
                  {recentIncidents.length === 0 ? (
                    <option value="" disabled>
                      No matching incidents found in database
                    </option>
                  ) : (
                    recentIncidents.map((inc) => {
                      const statusTag =
                        inc.verification_status === 'VERIFIED'
                          ? '🛡️ VERIFIED'
                          : inc.verification_status === 'TAMPERED'
                          ? '🚨 TAMPERED'
                          : '⏳ UNVERIFIED';
                      return (
                        <option key={inc.incident_id} value={inc.incident_id}>
                          [{statusTag}] {inc.incident_id} — {inc.process_name || 'process'} (CPU:{' '}
                          {inc.cpu_usage || 0}%, {inc.severity})
                        </option>
                      );
                    })
                  )}
                </select>
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    type="button"
                    id="btn-reload-incident"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectIncident(selectedIncidentId)}
                    disabled={loadingIncidents || verifying || !selectedIncidentId}
                    aria-label="Reload this incident's clean payload"
                    aria-describedby={showReloadTooltip ? 'reload-btn-tooltip' : undefined}
                    onMouseEnter={() => setShowReloadTooltip(true)}
                    onMouseLeave={() => setShowReloadTooltip(false)}
                    onFocus={() => setShowReloadTooltip(true)}
                    onBlur={() => setShowReloadTooltip(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setShowReloadTooltip(false);
                    }}
                  >
                    Reload
                  </button>

                  {showReloadTooltip && (
                    <div
                      id="reload-btn-tooltip"
                      role="tooltip"
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 20,
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius, 6px)',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 500,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.45))',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    >
                      Reload this incident's clean payload
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tampering Simulation Banner */}
            {tamperedField && (
              <div
                style={{
                  background: 'rgba(248, 81, 73, 0.12)',
                  border: '1px solid #DA3633',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={18} style={{ color: '#F85149', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: '#F85149', lineHeight: 1.4 }}>
                    <strong>Simulated Tamper Active:</strong> CPU modified ({tamperedField.originalCpu}% →{' '}
                    {tamperedField.tamperedCpu}%), Risk modified ({tamperedField.originalRisk} →{' '}
                    {tamperedField.tamperedRisk}).
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={restoreCanonical}
                  disabled={verifying}
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontSize: '0.72rem',
                    padding: '3px 10px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Restore Baseline
                </button>
              </div>
            )}

            {/* Working Draft Hash & Indicators Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                fontSize: '0.74rem',
                gap: '8px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Evidence Telemetry (JSON):</span>
                {isDraftModified && (
                  <span
                    id="badge-modified-draft"
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'rgba(210, 153, 34, 0.15)',
                      color: '#d29922',
                      border: '1px solid rgba(210, 153, 34, 0.3)',
                      fontWeight: 600
                    }}
                  >
                    Modified Draft
                  </span>
                )}
                {isStale && (
                  <span
                    id="badge-verification-stale"
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'rgba(139, 148, 158, 0.15)',
                      color: '#8b949e',
                      border: '1px solid rgba(139, 148, 158, 0.3)',
                      fontWeight: 600
                    }}
                  >
                    Verification Stale
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--text-muted)' }}>SHA-256:</span>
                <span style={{ color: jsonError ? '#F85149' : isDraftModified ? '#D29922' : 'var(--text-primary)', wordBreak: 'break-all' }}>
                  {jsonError ? 'Syntax Error' : workingHash ? `0x${workingHash.replace(/^0x/, '')}` : 'Computing...'}
                </span>
              </div>
            </div>

            {/* Monospace JSON Editor */}
            <div style={{ position: 'relative', flex: 1 }}>
              <textarea
                id="evidence-json-editor"
                className="input"
                style={{
                  width: '100%',
                  height: '310px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  lineHeight: '1.45',
                  background: 'var(--surface-elevated)',
                  borderColor: jsonError ? '#F85149' : (tamperedField || isDraftModified) ? '#D29922' : 'var(--border)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                  borderRadius: '6px',
                  padding: '12px'
                }}
                value={evidenceInput}
                onChange={(e) => handleEvidenceInputChange(e.target.value)}
                placeholder='{"incident_id": "INC-...", "cpu_usage": 94, ...}'
                disabled={verifying}
              />
            </div>

            {/* JSON Validation Error Banner */}
            {jsonError && (
              <div
                id="json-validation-error"
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(248, 81, 73, 0.1)',
                  border: '1px solid #f85149',
                  color: '#f85149',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={15} />
                <span>JSON Syntax Error: {jsonError}</span>
              </div>
            )}

            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  id="btn-verify-blockchain"
                  className="btn btn-primary"
                  onClick={handleVerify}
                  disabled={verifying || Boolean(jsonError) || !evidenceInput.trim()}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {verifying ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      Querying Smart Contract...
                    </>
                  ) : (
                    <>
                      <Lock size={15} />
                      Verify On Blockchain
                    </>
                  )}
                </button>

                <button
                  type="button"
                  id="btn-simulate-tampering"
                  className="btn btn-secondary"
                  onClick={tamperSample}
                  disabled={verifying || Boolean(jsonError) || !evidenceInput.trim()}
                  aria-label="Simulate data tampering attack to test cryptographic integrity check"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                  Simulate Tampering
                </button>

                <button
                  type="button"
                  id="btn-register-blockchain"
                  className="btn btn-warning"
                  onClick={handleRegisterOnChain}
                  disabled={registering || verifying || Boolean(jsonError) || !evidenceInput.trim() || !selectedIncidentId}
                  aria-label="Anchor incident SHA-256 evidence digest to Ethereum ThreatRegistry smart contract"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {registering ? <Loader2 size={15} className="spin" /> : <Lock size={15} />}
                  {registering ? 'Anchoring...' : 'Register on Blockchain'}
                </button>
              </div>

              <button
                type="button"
                id="btn-reset-clean"
                className="btn btn-outline btn-sm"
                onClick={restoreCanonical}
                disabled={verifying || !canonicalEvidence}
                aria-label="Restore authentic baseline evidence payload"
              >
                Reset Clean
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Cryptographic Proof Attestation */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${outcomeModel ? outcomeModel.border : 'var(--border)'}`,
            background: outcomeModel ? outcomeModel.cardBg : 'var(--surface-card)',
            transition: 'border-color 0.2s ease, background 0.2s ease'
          }}
        >
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck2
                size={16}
                style={{ color: outcomeModel ? outcomeModel.color : 'var(--text-muted)' }}
              />
              <span className="card-title">2. Cryptographic Proof Attestation</span>
            </div>
            {outcomeModel && (
              <span
                className={`badge ${outcomeModel.badgeClass}`}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em'
                }}
              >
                {outcomeModel.badgeText}
              </span>
            )}
          </div>

          <div
            className="card-body"
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}
          >
            {result ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Result Status Banner */}
                <div
                  style={{
                    background: outcomeModel.bgSurface,
                    border: `1px solid ${outcomeModel.border}`,
                    borderRadius: '6px',
                    padding: '16px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: '8px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: outcomeModel.color,
                      flexShrink: 0
                    }}
                  >
                    {outcomeModel.isVerified ? (
                      <CheckCircle size={26} />
                    ) : outcomeModel.isTampered ? (
                      <AlertTriangle size={26} />
                    ) : (
                      <AlertCircle size={26} />
                    )}
                  </div>

                  <div>
                    <h3
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: outcomeModel.color,
                        margin: 0,
                        letterSpacing: '-0.01em'
                      }}
                    >
                      {outcomeModel.title}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {outcomeModel.message}
                    </p>
                  </div>
                </div>

                {/* Tampering Forensic Breakdown (when tampered) */}
                {outcomeModel.isTampered && (
                  <div
                    style={{
                      background: 'rgba(218, 54, 51, 0.08)',
                      border: '1px solid #DA3633',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#F85149' }}>
                      Forensic Discrepancy Details:
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}>
                      <strong>Incident ID:</strong> {result.incident_id}
                    </div>
                    {result.details && (
                      <div style={{ color: 'var(--text-primary)' }}>
                        <strong>Diagnostic Reason:</strong> {result.details}
                      </div>
                    )}
                    {tamperedField && (
                      <div style={{ color: '#F85149' }}>
                        <strong>Altered Telemetry:</strong> CPU {tamperedField.originalCpu}% →{' '}
                        {tamperedField.tamperedCpu}%, Risk Score {tamperedField.originalRisk} →{' '}
                        {tamperedField.tamperedRisk}
                      </div>
                    )}
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.73rem', marginTop: '2px' }}>
                      Notice: The original on-chain commitment remains immutable and unchanged on the Ethereum blockchain ledger.
                    </div>
                  </div>
                )}

                {/* Unregistered Callout with Register Action */}
                {outcomeModel.isUnregistered && (
                  <div
                    style={{
                      background: 'rgba(210, 153, 34, 0.08)',
                      border: '1px solid #9E6A03',
                      borderRadius: '6px',
                      padding: '12px 14px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: '#D29922' }}>
                        Cryptographic Proof Pending Registration
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', marginTop: '2px' }}>
                        Calculated SHA-256 digest is valid. Anchor this incident on Ethereum ThreatRegistry to establish non-repudiation.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-warning btn-sm"
                      onClick={handleRegisterOnChain}
                      disabled={registering || verifying}
                      style={{
                        fontSize: '0.78rem',
                        padding: '6px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700
                      }}
                    >
                      {registering ? <Loader2 size={14} className="spin" /> : <Lock size={14} />}
                      {registering ? 'Submitting to Blockchain...' : 'Register on Blockchain'}
                    </button>
                  </div>
                )}

                {/* SHA-256 Digest Comparison Box */}
                <div
                  style={{
                    background: 'var(--surface-elevated)',
                    border: `1px solid ${outcomeModel.border}`,
                    borderRadius: '6px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'border-color 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase'
                        }}
                      >
                        Computed SHA-256 Digest (Client):
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Canonical JSON</span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        background: 'var(--surface-card)',
                        padding: '8px 10px',
                        borderRadius: '4px',
                        color: outcomeModel.isVerified
                          ? '#3FB950'
                          : outcomeModel.isTampered
                          ? '#F85149'
                          : 'var(--text-primary)',
                        wordBreak: 'break-all',
                        border: `1px solid ${
                          outcomeModel.isVerified
                            ? '#238636'
                            : outcomeModel.isTampered
                            ? '#DA3633'
                            : 'var(--border)'
                        }`
                      }}
                    >
                      {result.computed_hash || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          textTransform: 'uppercase'
                        }}
                      >
                        Anchored On-Chain Digest (Smart Contract):
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ThreatRegistry.sol</span>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        background: 'var(--surface-card)',
                        padding: '8px 10px',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        border: `1px solid ${
                          outcomeModel.isVerified
                            ? '#238636'
                            : outcomeModel.isTampered
                            ? '#DA3633'
                            : outcomeModel.isUnregistered
                            ? '#9E6A03'
                            : 'var(--border)'
                        }`
                      }}
                    >
                      {result.on_chain_hash ? (
                        <span style={{ color: outcomeModel.isVerified ? '#3FB950' : 'var(--text-primary)' }}>
                          {result.on_chain_hash}
                        </span>
                      ) : outcomeModel.isUnregistered ? (
                        <span style={{ color: '#D29922', fontStyle: 'italic' }}>
                          No on-chain commitment found
                        </span>
                      ) : outcomeModel.isError ? (
                        <span style={{ color: '#8B949E', fontStyle: 'italic' }}>
                          Could not retrieve on-chain commitment
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No on-chain commitment found
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technical Attestation Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      Forensic Taxonomy
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: outcomeModel.color,
                        marginTop: '2px'
                      }}
                    >
                      {outcomeModel.status}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      Smart Contract
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-mono)',
                        marginTop: '2px'
                      }}
                    >
                      {result.contract_address
                        ? `${result.contract_address.slice(0, 10)}...${result.contract_address.slice(-6)}`
                        : 'Not configured'}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      Gas Consumed
                    </div>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-primary)',
                        marginTop: '2px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {result.gas_used ? `${result.gas_used.toLocaleString()} gas` : '—'}
                      {result.blockchain_tx?.block_number ? ` (Block #${result.blockchain_tx.block_number})` : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      Attested Timestamp
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {formatAuditTimestamp(result.verification_timestamp)}
                    </div>
                  </div>
                </div>

                {/* Transaction Hash (rendered strictly when real tx exists) */}
                {result.blockchain_tx?.tx_hash && (
                  <div
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase',
                          fontWeight: 600
                        }}
                      >
                        On-Chain Transaction Hash:
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--accent-primary)',
                          fontFamily: 'var(--font-mono)',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {result.blockchain_tx.tx_hash}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => copyTxHash(result.blockchain_tx.tx_hash)}
                      style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                    >
                      {copiedTx ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
                      {copiedTx ? 'Copied' : 'Copy Tx'}
                    </button>
                  </div>
                )}

                {/* Technical Note / Blockchain Error */}
                {result.blockchain_error && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      fontSize: '0.75rem',
                      color: 'var(--danger)'
                    }}
                  >
                    <strong>Technical Note:</strong> {result.blockchain_error}
                  </div>
                )}

                {/* Copy Receipt Action */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={copyResult}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {copiedHash ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                    {copiedHash ? 'Receipt Copied' : 'Copy Attestation Proof JSON'}
                  </button>
                </div>
              </div>
            ) : activeSample ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--surface-elevated)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border)'
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '10px',
                    background:
                      activeSample.id === 'cryptojacking_workload'
                        ? 'rgba(248, 81, 73, 0.15)'
                        : 'rgba(56, 139, 253, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: activeSample.id === 'cryptojacking_workload' ? '#F85149' : 'var(--primary)'
                  }}
                >
                  <FlaskConical size={26} />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                  Sample Dataset Active: {activeSample.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 16px', lineHeight: 1.5 }}>
                  This telemetry fixture was loaded directly from <code>sample_data/{activeSample.filename}</code>.
                  It is currently an unsaved test fixture with no on-chain commitment.
                </p>
                {sampleDetection && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '0.8rem',
                      marginBottom: '18px'
                    }}
                  >
                    <span>Detector Verdict:</span>
                    <strong style={{ color: sampleDetection.suspicious ? '#F85149' : '#3FB950' }}>
                      {sampleDetection.suspicious ? '🚨 SUSPICIOUS (CRYPTOJACKING)' : '🛡️ BENIGN (NORMAL)'}
                    </strong>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Risk Score: {sampleDetection.risk_score?.score ?? 'N/A'}/100
                    </span>
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveSampleAsIncident}
                    disabled={savingSampleIncident}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 auto' }}
                  >
                    {savingSampleIncident ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
                    {savingSampleIncident ? 'Saving & Generating Evidence...' : 'Save as Incident & Prepare for Blockchain'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '8px',
                    background: 'var(--surface-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <Shield size={24} />
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Awaiting Verification Query
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '340px', margin: '6px auto 16px' }}>
                  Select an incident on the left or customize forensic parameters, then execute smart contract verification.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleVerify}
                  disabled={!evidenceInput.trim() || verifying}
                >
                  Verify Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Cryptographic Audit Trail */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} style={{ color: 'var(--text-muted)' }} />
            <span className="card-title">Live Cryptographic Audit Trail (Verification History)</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadHistory}
            disabled={loadingHistory}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={12} className={loadingHistory ? 'spin' : ''} />
            Refresh Trail
          </button>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {history.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No verification queries recorded yet in this session. Execute a check above to populate the ledger.
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Incident ID</th>
                    <th>Forensic Outcome</th>
                    <th>Computed Hash (Client)</th>
                    <th>Anchored Hash (Contract)</th>
                    <th>Channel / Verifier</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => {
                    const outcome = h.outcome || h.verification_outcome;
                    const isSuccess = outcome === 'VERIFIED';
                    const isTampered =
                      outcome === 'TAMPERED' ||
                      outcome === 'TAMPERED_HASH_MISMATCH' ||
                      outcome === 'ON_CHAIN_MISMATCH';
                    const isUnreg = outcome === 'UNREGISTERED_ON_CHAIN';

                    let badgeClass = 'badge-secondary';
                    let badgeLabel = outcome || 'UNKNOWN';
                    let rowBg = 'transparent';
                    let hashColor = 'var(--text-muted)';

                    if (isSuccess) {
                      badgeClass = 'badge-verified';
                      badgeLabel = 'VERIFIED';
                      rowBg = 'rgba(35, 134, 54, 0.05)';
                      hashColor = '#3FB950';
                    } else if (isTampered) {
                      badgeClass = 'badge-tampered';
                      badgeLabel = 'TAMPERED';
                      rowBg = 'rgba(218, 54, 51, 0.05)';
                      hashColor = '#F85149';
                    } else if (isUnreg) {
                      badgeClass = 'badge-warning';
                      badgeLabel = 'UNREGISTERED';
                      hashColor = '#D29922';
                    }

                    return (
                      <tr key={h.id || h.history_id || idx} style={{ background: rowBg }}>
                        <td
                          style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {formatAuditTimestamp(h.timestamp || h.verified_at)}
                        </td>
                        <td>
                          <span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {h.incident_id}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem' }}>
                            {badgeLabel}
                          </span>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: '0.72rem', color: hashColor }}>
                            {h.computed_hash ? `${h.computed_hash.slice(0, 16)}...` : 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="mono"
                            style={{
                              fontSize: '0.72rem',
                              color: h.on_chain_hash ? 'var(--accent-primary)' : 'var(--text-muted)'
                            }}
                          >
                            {h.on_chain_hash
                              ? `${h.on_chain_hash.slice(0, 16)}...`
                              : isUnreg
                              ? 'Unregistered'
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {h.verified_by || h.verifier_address || 'REST API / SOC'}
                          </span>
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

      {/* Forensic Architecture & Standards */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Forensic Attestation Standards & Guarantees</span>
        </div>
        <div className="card-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px'
            }}
          >
            <div
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    background: '#2563eb',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  1
                </span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  RFC-8785 Canonicalization
                </strong>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Telemetry properties are deterministically sorted and normalized, ensuring reproducible hashes regardless of whitespace or serialization order.
              </p>
            </div>

            <div
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    background: '#0284c7',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  2
                </span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  SHA-256 Digest Anchoring
                </strong>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                A 32-byte cryptographic digest is anchored directly to the ThreatRegistry smart contract via an Ethereum transaction with non-repudiation.
              </p>
            </div>

            <div
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    background: '#6366f1',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  3
                </span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Immutable Proof of State
                </strong>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Once confirmed in a block, off-chain modifications produce immediate hash divergence, preventing unauthorized alteration or suppression of forensic records.
              </p>
            </div>

            <div
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '4px',
                    background: '#059669',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.72rem'
                  }}
                >
                  4
                </span>
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Privacy-Preserving Off-Chain Storage
                </strong>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Sensitive telemetry (host IPs, container identifiers, process paths) remains in private SQLite storage; only 32-byte cryptographic proofs are public on-chain.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Intelligence Feed Sample Modal */}
      {showThreatIntelModal && activeSample?.id === 'threat_intelligence' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowThreatIntelModal(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--primary)' }} />
                <span className="card-title">Sample Dataset: {activeSample.filename} (10 IOCs)</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setShowThreatIntelModal(false)}
                style={{ padding: '2px 8px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="card-body" style={{ overflowY: 'auto', padding: '16px' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                Curated Indicators of Compromise (IOCs) from <code>sample_data/threat_intelligence.json</code>.
                These indicators match real-world mining pools, multi-threaded CPU miner executables, and Ethereum stratum endpoints.
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ fontSize: '0.75rem', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Indicator</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Campaign ID</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(activeSample.data) &&
                      activeSample.data.map((ioc, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)', padding: '8px' }}>
                            {ioc.indicator}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                              {ioc.indicator_type}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', padding: '8px', color: 'var(--text-muted)' }}>
                            {ioc.campaign_id}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                            {ioc.description}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowThreatIntelModal(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyEvidence;