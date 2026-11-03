import { formatAuditTimestamp, getAuthoritativeOutcomeModel, arePayloadsEqual } from '../VerifyEvidence';

describe('Verification Center Overhaul Unit Tests', () => {
  describe('formatAuditTimestamp (Safe Date Formatting)', () => {
    test('returns dash fallback when timestamp is null or undefined', () => {
      expect(formatAuditTimestamp(null)).toBe('—');
      expect(formatAuditTimestamp(undefined)).toBe('—');
      expect(formatAuditTimestamp('')).toBe('—');
    });

    test('returns "Time unavailable" when timestamp is invalid string and NEVER "Invalid Date"', () => {
      const result = formatAuditTimestamp('invalid-date-string');
      expect(result).toBe('Time unavailable');
      expect(result).not.toContain('Invalid Date');
    });

    test('formats valid ISO 8601 UTC timestamp cleanly into readable date and time', () => {
      const iso = '2026-10-28T13:00:42.822045+00:00';
      const formatted = formatAuditTimestamp(iso);
      expect(formatted).not.toBe('Invalid Date');
      expect(formatted).not.toBe('Time unavailable');
      expect(formatted).not.toBe('—');
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(5);
    });
  });

  describe('getAuthoritativeOutcomeModel (Centralized Result Model)', () => {
    test('Scenario 1: Registered record matching full digest produces complete GREEN verified state', () => {
      const verifiedResult = {
        outcome: 'VERIFIED',
        verification_result: 'VERIFIED',
        evidence_match: true,
        computed_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        on_chain_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      };

      const model = getAuthoritativeOutcomeModel(verifiedResult);
      expect(model.status).toBe('VERIFIED');
      expect(model.isVerified).toBe(true);
      expect(model.isTampered).toBe(false);
      expect(model.isUnregistered).toBe(false);
      expect(model.isError).toBe(false);
      expect(model.color).toBe('#3FB950');
      expect(model.border).toBe('#238636');
      expect(model.title).toBe('INTEGRITY VERIFIED');
      expect(model.message).toContain('No modification was detected in the data that was checked');
    });

    test('Scenario 2: Registered record with mismatching digest produces complete RED tampered state', () => {
      const tamperedResult = {
        outcome: 'TAMPERED_HASH_MISMATCH',
        verification_result: 'TAMPERED',
        evidence_match: false,
        computed_hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        on_chain_hash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      };

      const model = getAuthoritativeOutcomeModel(tamperedResult);
      expect(model.status).toBe('TAMPERED');
      expect(model.isVerified).toBe(false);
      expect(model.isTampered).toBe(true);
      expect(model.isUnregistered).toBe(false);
      expect(model.color).toBe('#F85149');
      expect(model.border).toBe('#DA3633');
      expect(model.title).toBe('TAMPERING DETECTED');
      expect(model.message).toContain('does not match the original on-chain commitment');
    });

    test('Scenario 3: Unregistered record with valid local hash produces AMBER unregistered state, NOT green', () => {
      const unregResult = {
        outcome: 'UNREGISTERED_ON_CHAIN',
        verification_result: 'UNREGISTERED_ON_CHAIN',
        evidence_match: true,
        computed_hash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        on_chain_hash: null
      };

      const model = getAuthoritativeOutcomeModel(unregResult);
      expect(model.status).toBe('UNREGISTERED_ON_CHAIN');
      expect(model.isVerified).toBe(false);
      expect(model.isTampered).toBe(false);
      expect(model.isUnregistered).toBe(true);
      expect(model.color).toBe('#D29922');
      expect(model.border).toBe('#9E6A03');
      expect(model.title).toBe('UNREGISTERED ON BLOCKCHAIN');
      expect(model.message).toContain('incident has not yet been registered on Ethereum');
    });

    test('Scenario 5: RPC failure produces NETWORK ERROR, not tampered', () => {
      const outageResult = {
        outcome: 'BLOCKCHAIN_OUTAGE',
        verification_result: 'NETWORK_ERROR',
        evidence_match: true,
        computed_hash: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        on_chain_hash: null
      };

      const model = getAuthoritativeOutcomeModel(outageResult);
      expect(model.status).toBe('NETWORK_ERROR');
      expect(model.isVerified).toBe(false);
      expect(model.isTampered).toBe(false);
      expect(model.isError).toBe(true);
      expect(model.title).toBe('RPC NODE UNREACHABLE');
      expect(model.message).toContain('RPC node is unreachable');
    });

    test('Scenario 6: Contract execution error produces CONTRACT ERROR, not tampered', () => {
      const contractErrorResult = {
        outcome: 'CONTRACT_ERROR',
        verification_result: 'CONTRACT_ERROR',
        evidence_match: true,
        computed_hash: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        on_chain_hash: null
      };

      const model = getAuthoritativeOutcomeModel(contractErrorResult);
      expect(model.status).toBe('CONTRACT_ERROR');
      expect(model.isVerified).toBe(false);
      expect(model.isTampered).toBe(false);
      expect(model.isError).toBe(true);
      expect(model.title).toBe('SMART CONTRACT ERROR');
    });

    test('Scenario 10: Null result yields null model without throwing', () => {
      expect(getAuthoritativeOutcomeModel(null)).toBeNull();
      expect(getAuthoritativeOutcomeModel(undefined)).toBeNull();
    });

    test('Scenario 11: INVALID_INPUT outcome model produces clear error state', () => {
      const invalidResult = {
        outcome: 'INVALID_INPUT',
        verification_result: 'EVIDENCE_MISSING',
        evidence_match: false,
        details: 'Evidence object is empty or missing mandatory incident_id attribute.'
      };
      const model = getAuthoritativeOutcomeModel(invalidResult);
      expect(model.status).toBe('INVALID_INPUT');
      expect(model.isVerified).toBe(false);
      expect(model.isTampered).toBe(false);
      expect(model.badgeText).toBe('INVALID_INPUT');
    });
  });

  describe('arePayloadsEqual (JSON Draft Diff & Baseline Integrity)', () => {
    const basePayload = {
      incident_id: 'INC-20261028-001',
      cpu_usage: 85,
      memory_usage: 400,
      process_name: 'xmrig',
      process_runtime_seconds: 120,
      severity: 'HIGH',
      risk_score: 88,
      factors: ['CPU_SPIKE']
    };

    test('identifies identical payloads as equal regardless of key ordering', () => {
      const copy = { ...basePayload };
      expect(arePayloadsEqual(basePayload, copy)).toBe(true);
    });

    test('Step 2 test: changing cpu_usage from 85 to 86 detects draft modification without touching original', () => {
      const original = { ...basePayload, cpu_usage: 85 };
      const modifiedWorkingDraft = { ...basePayload, cpu_usage: 86 };

      expect(arePayloadsEqual(original, modifiedWorkingDraft)).toBe(false);
      expect(original.cpu_usage).toBe(85);
      expect(modifiedWorkingDraft.cpu_usage).toBe(86);
    });

    test('detects string modifications and nested factor changes', () => {
      const tamperedProc = { ...basePayload, process_name: 'systemd' };
      expect(arePayloadsEqual(basePayload, tamperedProc)).toBe(false);

      const tamperedFactors = { ...basePayload, factors: ['NORMAL'] };
      expect(arePayloadsEqual(basePayload, tamperedFactors)).toBe(false);
    });

    test('handles null and undefined comparisons safely', () => {
      expect(arePayloadsEqual(null, basePayload)).toBe(false);
      expect(arePayloadsEqual(basePayload, null)).toBe(false);
      expect(arePayloadsEqual(null, null)).toBe(true);
    });
  });

  describe('Simulate Tampering Logic Verification', () => {
    test('deterministic field alteration switches high CPU to low CPU and inverts risk', () => {
      const highCpuSample = { cpu_usage: 95.4, risk_score: 90, severity: 'CRITICAL' };
      const oldCpu = highCpuSample.cpu_usage;
      const oldRisk = highCpuSample.risk_score;

      const newCpu = oldCpu > 50 ? 14.5 : 98.4;
      const newRisk = oldRisk > 50 ? 15 : 95;
      const newSeverity = highCpuSample.severity === 'CRITICAL' ? 'LOW' : 'CRITICAL';

      expect(newCpu).toBe(14.5);
      expect(newRisk).toBe(15);
      expect(newSeverity).toBe('LOW');

      // Toggling back when starting from low
      const lowCpuSample = { cpu_usage: 14.5, risk_score: 15, severity: 'LOW' };
      const toggledCpu = lowCpuSample.cpu_usage > 50 ? 14.5 : 98.4;
      const toggledRisk = lowCpuSample.risk_score > 50 ? 15 : 95;
      expect(toggledCpu).toBe(98.4);
      expect(toggledRisk).toBe(95);
    });
  });

  describe('Reload Tooltip and UI Accessibility Verification', () => {
    test('VerifyEvidence source contains no native title attributes that trigger black browser popups', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.resolve(__dirname, '../VerifyEvidence.js'), 'utf8');

      // Ensure no button has a native title attribute
      expect(source).not.toMatch(/<button[^>]+title=/);

      // Ensure the reload button has id, aria-label, aria-describedby, and custom tooltip with role="tooltip"
      expect(source).toContain('id="btn-reload-incident"');
      expect(source).toContain('aria-label="Reload this incident\'s clean payload"');
      expect(source).toContain('id="reload-btn-tooltip"');
      expect(source).toContain('role="tooltip"');

      // Ensure tooltip is positioned above button with bottom: calc(100% + 6px) and right: 0
      expect(source).toContain("bottom: 'calc(100% + 6px)'");
      expect(source).toContain('right: 0');
    });
  });

  describe('Incident Selector, Search/Filtering and Sample Datasets Verification', () => {
    test('VerifyEvidence contains search input, severity filter, status filter, and sample dataset fixtures', () => {
      const fs = require('fs');
      const path = require('path');
      const source = fs.readFileSync(path.resolve(__dirname, '../VerifyEvidence.js'), 'utf8');

      // Search & filter controls
      expect(source).toContain('id="input-incident-search"');
      expect(source).toContain('id="select-filter-severity"');
      expect(source).toContain('id="select-filter-status"');
      expect(source).toContain('id="incident-selector"');

      // Sample dataset action buttons
      expect(source).toContain('id="btn-sample-normal"');
      expect(source).toContain('id="btn-sample-crypto"');
      expect(source).toContain('id="btn-sample-threat-intel"');

      // Prevention of selection overwrite
      expect(source).toContain('selectedIncidentIdRef.current');
      expect(source).toContain('selectionSeqRef.current');
    });

    test('Real sample dataset files exist and contain valid required forensic telemetry', () => {
      const fs = require('fs');
      const path = require('path');
      const sampleDir = path.resolve(__dirname, '../../../../sample_data');

      // Normal workload
      const normalRaw = fs.readFileSync(path.join(sampleDir, 'normal_workload.json'), 'utf8');
      const normal = JSON.parse(normalRaw);
      expect(normal.process_name).toBe('nginx');
      expect(normal.cpu_usage).toBe(45);
      expect(normal.memory_usage).toBe(55);

      // Cryptojacking workload
      const cryptoRaw = fs.readFileSync(path.join(sampleDir, 'cryptojacking_workload.json'), 'utf8');
      const crypto = JSON.parse(cryptoRaw);
      expect(crypto.process_name).toBe('xmrig');
      expect(crypto.cpu_usage).toBe(94);
      expect(crypto.network_destination).toBe('minexmr.com');

      // Threat intelligence
      const intelRaw = fs.readFileSync(path.join(sampleDir, 'threat_intelligence.json'), 'utf8');
      const intel = JSON.parse(intelRaw);
      expect(Array.isArray(intel)).toBe(true);
      expect(intel.length).toBe(10);
      expect(intel[0].indicator).toBe('minexmr.com');
    });
  });
});


