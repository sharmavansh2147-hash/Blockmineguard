// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ThreatRegistry is Ownable {
    uint256 private _incidentIds;
    uint256 private _threatIntelIds;

    function _nextIncidentId() internal returns (uint256) {
        _incidentIds++;
        return _incidentIds;
    }

    function _nextThreatIntelId() internal returns (uint256) {
        _threatIntelIds++;
        return _threatIntelIds;
    }

    enum Severity { LOW, MEDIUM, HIGH }
    enum VerificationStatus { UNVERIFIED, VERIFIED, TAMPERED }
    enum ResolutionStatus { OPEN, IN_PROGRESS, RESOLVED, FALSE_POSITIVE }

    struct Incident {
        uint256 incidentId;
        string externalId;
        bytes32 evidenceHash;
        uint256 timestamp;
        Severity severity;
        address reporter;
        VerificationStatus verificationStatus;
        ResolutionStatus resolutionStatus;
        string threatIntelRef;
        bool exists;
    }

    struct ThreatIntelligence {
        uint256 intelId;
        string indicator;
        string indicatorType;
        string description;
        string campaignId;
        uint256 timestamp;
        address reporter;
        bool verified;
        bool exists;
    }

    struct ReporterProfile {
        address reporter;
        uint256 reputationScore;
        uint256 totalReports;
        uint256 verifiedReports;
        uint256 falseReports;
        bool registered;
    }

    mapping(uint256 => Incident) public incidents;
    mapping(uint256 => ThreatIntelligence) public threatIntelligence;
    mapping(address => ReporterProfile) public reporterProfiles;
    mapping(uint256 => address) public incidentToReporter;
    mapping(bytes32 => uint256) public hashToIncidentId;
    mapping(string => uint256) public externalIdToIncidentId;

    event IncidentReported(
        uint256 indexed incidentId,
        string externalId,
        bytes32 evidenceHash,
        uint256 timestamp,
        Severity severity,
        address indexed reporter
    );

    event IncidentVerified(
        uint256 indexed incidentId,
        address indexed verifier,
        VerificationStatus status
    );

    event IncidentResolved(
        uint256 indexed incidentId,
        address indexed resolver,
        ResolutionStatus status
    );

    event ThreatIntelAdded(
        uint256 indexed intelId,
        string indicator,
        string indicatorType,
        address indexed reporter
    );

    event ThreatIntelVerified(
        uint256 indexed intelId,
        address indexed verifier
    );

    event ReporterRegistered(address indexed reporter);
    event ReputationUpdated(address indexed reporter, int256 change, uint256 newScore);

    constructor() Ownable(msg.sender) {
        _registerReporter(msg.sender);
    }

    function _registerReporter(address reporter) internal {
        require(!reporterProfiles[reporter].registered, "Already registered");
        reporterProfiles[reporter] = ReporterProfile({
            reporter: reporter,
            reputationScore: 100,
            totalReports: 0,
            verifiedReports: 0,
            falseReports: 0,
            registered: true
        });
        emit ReporterRegistered(reporter);
    }

    function registerAsReporter() external {
        _registerReporter(msg.sender);
    }

    function reportIncident(
        string calldata externalId,
        bytes32 evidenceHash,
        Severity severity,
        string calldata threatIntelRef
    ) external returns (uint256) {
        require(bytes(externalId).length > 0, "External ID required");
        require(evidenceHash != bytes32(0), "Evidence hash required");
        require(hashToIncidentId[evidenceHash] == 0, "Evidence already registered");
        require(externalIdToIncidentId[externalId] == 0, "External ID already registered");

        if (!reporterProfiles[msg.sender].registered) {
            _registerReporter(msg.sender);
        }

        uint256 incidentId = _nextIncidentId();

        incidents[incidentId] = Incident({
            incidentId: incidentId,
            externalId: externalId,
            evidenceHash: evidenceHash,
            timestamp: block.timestamp,
            severity: severity,
            reporter: msg.sender,
            verificationStatus: VerificationStatus.UNVERIFIED,
            resolutionStatus: ResolutionStatus.OPEN,
            threatIntelRef: threatIntelRef,
            exists: true
        });

        incidentToReporter[incidentId] = msg.sender;
        hashToIncidentId[evidenceHash] = incidentId;
        externalIdToIncidentId[externalId] = incidentId;

        ReporterProfile storage profile = reporterProfiles[msg.sender];
        profile.totalReports += 1;

        emit IncidentReported(incidentId, externalId, evidenceHash, block.timestamp, severity, msg.sender);

        return incidentId;
    }

    function verifyIncident(uint256 incidentId, VerificationStatus status) external {
        require(incidents[incidentId].exists, "Incident not found");
        require(incidents[incidentId].verificationStatus == VerificationStatus.UNVERIFIED, "Already verified");

        incidents[incidentId].verificationStatus = status;

        address reporter = incidentToReporter[incidentId];
        ReporterProfile storage profile = reporterProfiles[reporter];

        if (status == VerificationStatus.VERIFIED) {
            profile.verifiedReports += 1;
            _updateReputation(reporter, 10);
        } else if (status == VerificationStatus.TAMPERED) {
            profile.falseReports += 1;
            _updateReputation(reporter, -20);
        }

        emit IncidentVerified(incidentId, msg.sender, status);
    }

    function resolveIncident(uint256 incidentId, ResolutionStatus status) external {
        require(incidents[incidentId].exists, "Incident not found");
        require(incidents[incidentId].resolutionStatus == ResolutionStatus.OPEN, "Already resolved");
        require(incidents[incidentId].verificationStatus == VerificationStatus.VERIFIED, "Must be verified first");

        incidents[incidentId].resolutionStatus = status;
        emit IncidentResolved(incidentId, msg.sender, status);
    }

    function addThreatIntelligence(
        string calldata indicator,
        string calldata indicatorType,
        string calldata description,
        string calldata campaignId
    ) external returns (uint256) {
        require(bytes(indicator).length > 0, "Indicator required");
        require(bytes(indicatorType).length > 0, "Indicator type required");

        if (!reporterProfiles[msg.sender].registered) {
            _registerReporter(msg.sender);
        }

        uint256 intelId = _nextThreatIntelId();

        threatIntelligence[intelId] = ThreatIntelligence({
            intelId: intelId,
            indicator: indicator,
            indicatorType: indicatorType,
            description: description,
            campaignId: campaignId,
            timestamp: block.timestamp,
            reporter: msg.sender,
            verified: false,
            exists: true
        });

        emit ThreatIntelAdded(intelId, indicator, indicatorType, msg.sender);
        return intelId;
    }

    function verifyThreatIntelligence(uint256 intelId) external {
        require(threatIntelligence[intelId].exists, "Threat intelligence not found");
        require(!threatIntelligence[intelId].verified, "Already verified");

        threatIntelligence[intelId].verified = true;
        _updateReputation(msg.sender, 5);
        emit ThreatIntelVerified(intelId, msg.sender);
    }

    function _updateReputation(address reporter, int256 change) internal {
        ReporterProfile storage profile = reporterProfiles[reporter];
        int256 newScore = int256(profile.reputationScore) + change;
        profile.reputationScore = newScore < 0 ? 0 : uint256(newScore);
        emit ReputationUpdated(reporter, change, profile.reputationScore);
    }

    function getIncident(uint256 incidentId) external view returns (Incident memory) {
        require(incidents[incidentId].exists, "Incident not found");
        return incidents[incidentId];
    }

    function getIncidentCount() external view returns (uint256) {
        return _incidentIds;
    }

    function getThreatIntelligence(uint256 intelId) external view returns (ThreatIntelligence memory) {
        require(threatIntelligence[intelId].exists, "Threat intelligence not found");
        return threatIntelligence[intelId];
    }

    function getThreatIntelCount() external view returns (uint256) {
        return _threatIntelIds;
    }

    function getReporterReputation(address reporter) external view returns (ReporterProfile memory) {
        return reporterProfiles[reporter];
    }

    function getIncidentByHash(bytes32 evidenceHash) external view returns (uint256) {
        return hashToIncidentId[evidenceHash];
    }

    function getIncidentByExternalId(string calldata externalId) external view returns (Incident memory) {
        uint256 id = externalIdToIncidentId[externalId];
        require(id != 0 && incidents[id].exists, "Incident not found");
        return incidents[id];
    }

    function getIncidentsByReporter(address reporter) external view returns (uint256[] memory) {
        uint256 count = 0;
        uint256 total = _incidentIds;
        for (uint256 i = 1; i <= total; i++) {
            if (incidents[i].exists && incidents[i].reporter == reporter) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (incidents[i].exists && incidents[i].reporter == reporter) {
                result[index] = i;
                index++;
            }
        }
        return result;
    }

    function getVerifiedThreatIntelligence() external view returns (ThreatIntelligence[] memory) {
        uint256 count = 0;
        uint256 total = _threatIntelIds;
        for (uint256 i = 1; i <= total; i++) {
            if (threatIntelligence[i].exists && threatIntelligence[i].verified) {
                count++;
            }
        }
        ThreatIntelligence[] memory result = new ThreatIntelligence[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= total; i++) {
            if (threatIntelligence[i].exists && threatIntelligence[i].verified) {
                result[index] = threatIntelligence[i];
                index++;
            }
        }
        return result;
    }

    function getRecentIncidents(uint256 limit) external view returns (Incident[] memory) {
        uint256 total = _incidentIds;
        uint256 start = total > limit ? total - limit + 1 : 1;
        uint256 count = total - start + 1;
        Incident[] memory result = new Incident[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = incidents[start + i];
        }
        return result;
    }
}