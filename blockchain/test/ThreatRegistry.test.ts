import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ThreatRegistry } from "../typechain-types";

describe("ThreatRegistry", function () {
    async function deployFixture() {
        const [owner, reporter1, reporter2, verifier] = await ethers.getSigners();
        const ThreatRegistry = await ethers.getContractFactory("ThreatRegistry");
        const contract = await ThreatRegistry.deploy();
        return { contract, owner, reporter1, reporter2, verifier };
    }

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            const { contract, owner } = await loadFixture(deployFixture);
            expect(await contract.owner()).to.equal(owner.address);
        });

        it("Should register owner as reporter", async function () {
            const { contract, owner } = await loadFixture(deployFixture);
            const profile = await contract.getReporterReputation(owner.address);
            expect(profile.registered).to.be.true;
            expect(profile.reputationScore).to.equal(100);
        });
    });

    describe("Reporter Registration", function () {
        it("Should allow new reporter to register", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            await contract.connect(reporter1).registerAsReporter();
            const profile = await contract.getReporterReputation(reporter1.address);
            expect(profile.registered).to.be.true;
            expect(profile.reputationScore).to.equal(100);
        });

        it("Should not allow double registration", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            await contract.connect(reporter1).registerAsReporter();
            await expect(contract.connect(reporter1).registerAsReporter()).to.be.revertedWith("Already registered");
        });
    });

    describe("Incident Reporting", function () {
        it("Should report an incident", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            const tx = await contract.connect(reporter1).reportIncident(
                "INC-1001",
                evidenceHash,
                2, // HIGH
                "TI-REF-001"
            );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    return contract.interface.parseLog(log)?.name === "IncidentReported";
                } catch {
                    return false;
                }
            });
            expect(event).to.not.be.undefined;
        });

        it("Should not allow duplicate evidence hash", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await expect(
                contract.connect(reporter1).reportIncident("INC-1002", evidenceHash, 1, "TI-REF-002")
            ).to.be.revertedWith("Evidence already registered");
        });

        it("Should reject empty external ID", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await expect(
                contract.connect(reporter1).reportIncident("", evidenceHash, 2, "TI-REF-001")
            ).to.be.revertedWith("External ID required");
        });

        it("Should auto-register reporter on first report", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            const profile = await contract.getReporterReputation(reporter1.address);
            expect(profile.registered).to.be.true;
            expect(profile.totalReports).to.equal(1);
        });
    });

    describe("Incident Verification", function () {
        it("Should verify incident as VERIFIED", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await contract.connect(verifier).verifyIncident(1, 1); // VERIFIED
            const incident = await contract.getIncident(1);
            expect(incident.verificationStatus).to.equal(1); // VERIFIED
        });

        it("Should verify incident as TAMPERED", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await contract.connect(verifier).verifyIncident(1, 2); // TAMPERED
            const incident = await contract.getIncident(1);
            expect(incident.verificationStatus).to.equal(2); // TAMPERED
        });

        it("Should update reputation on verification", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            const profileBefore = await contract.getReporterReputation(reporter1.address);
            await contract.connect(verifier).verifyIncident(1, 1); // VERIFIED
            const profileAfter = await contract.getReporterReputation(reporter1.address);
            expect(profileAfter.reputationScore).to.equal(profileBefore.reputationScore + 10n);
        });

        it("Should decrease reputation on tampered verification", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            const profileBefore = await contract.getReporterReputation(reporter1.address);
            await contract.connect(verifier).verifyIncident(1, 2); // TAMPERED
            const profileAfter = await contract.getReporterReputation(reporter1.address);
            expect(profileAfter.reputationScore).to.equal(profileBefore.reputationScore - 20n);
        });

        it("Should not allow double verification", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await contract.connect(verifier).verifyIncident(1, 1);
            await expect(contract.connect(verifier).verifyIncident(1, 1)).to.be.revertedWith("Already verified");
        });
    });

    describe("Incident Resolution", function () {
        it("Should resolve verified incident", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await contract.connect(verifier).verifyIncident(1, 1);
            await contract.connect(verifier).resolveIncident(1, 2); // RESOLVED
            const incident = await contract.getIncident(1);
            expect(incident.resolutionStatus).to.equal(2); // RESOLVED
        });

        it("Should not resolve unverified incident", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            await expect(contract.connect(verifier).resolveIncident(1, 2)).to.be.revertedWith("Must be verified first");
        });
    });

    describe("Threat Intelligence", function () {
        it("Should add threat intelligence", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            await contract.connect(reporter1).addThreatIntelligence(
                "malicious-pool.com",
                "domain",
                "Known mining pool",
                "CAMPAIGN-001"
            );
            const intel = await contract.getThreatIntelligence(1);
            expect(intel.indicator).to.equal("malicious-pool.com");
            expect(intel.indicatorType).to.equal("domain");
            expect(intel.campaignId).to.equal("CAMPAIGN-001");
            expect(intel.verified).to.be.false;
        });

        it("Should verify threat intelligence", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            await contract.connect(reporter1).addThreatIntelligence(
                "malicious-pool.com",
                "domain",
                "Known mining pool",
                "CAMPAIGN-001"
            );
            await contract.connect(verifier).verifyThreatIntelligence(1);
            const intel = await contract.getThreatIntelligence(1);
            expect(intel.verified).to.be.true;
        });

        it("Should increase reputation on threat intel verification", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            await contract.connect(reporter1).addThreatIntelligence(
                "malicious-pool.com",
                "domain",
                "Known mining pool",
                "CAMPAIGN-001"
            );
            const profileBefore = await contract.getReporterReputation(verifier.address);
            await contract.connect(verifier).verifyThreatIntelligence(1);
            const profileAfter = await contract.getReporterReputation(verifier.address);
            expect(profileAfter.reputationScore).to.equal(profileBefore.reputationScore + 5n);
        });
    });

    describe("Query Functions", function () {
        it("Should return incident count", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            expect(await contract.getIncidentCount()).to.equal(0);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            expect(await contract.getIncidentCount()).to.equal(1);
        });

        it("Should get incident by hash", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash, 2, "TI-REF-001");
            const incidentId = await contract.getIncidentByHash(evidenceHash);
            expect(incidentId).to.equal(1);
        });

        it("Should get incident by external ID", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes("test-evidence"));
            await contract.connect(reporter1).reportIncident("INC-EXT-1001", evidenceHash, 2, "TI-REF-001");
            const inc = await contract.getIncidentByExternalId("INC-EXT-1001");
            expect(inc.incidentId).to.equal(1);
            expect(inc.externalId).to.equal("INC-EXT-1001");
            expect(inc.evidenceHash).to.equal(evidenceHash);
        });

        it("Should reject duplicate external ID", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("test-evidence-1"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("test-evidence-2"));
            await contract.connect(reporter1).reportIncident("INC-DUP-01", hash1, 2, "TI-REF-001");
            await expect(
                contract.connect(reporter1).reportIncident("INC-DUP-01", hash2, 1, "TI-REF-002")
            ).to.be.revertedWith("External ID already registered");
        });

        it("Should get incidents by reporter", async function () {
            const { contract, reporter1, reporter2 } = await loadFixture(deployFixture);
            const evidenceHash1 = ethers.keccak256(ethers.toUtf8Bytes("test-evidence-1"));
            const evidenceHash2 = ethers.keccak256(ethers.toUtf8Bytes("test-evidence-2"));
            const evidenceHash3 = ethers.keccak256(ethers.toUtf8Bytes("test-evidence-3"));
            await contract.connect(reporter1).reportIncident("INC-1001", evidenceHash1, 2, "TI-REF-001");
            await contract.connect(reporter1).reportIncident("INC-1002", evidenceHash2, 1, "TI-REF-002");
            await contract.connect(reporter2).reportIncident("INC-2001", evidenceHash3, 2, "TI-REF-003");
            const reporter1Incidents = await contract.getIncidentsByReporter(reporter1.address);
            expect(reporter1Incidents.length).to.equal(2);
        });

        it("Should get verified threat intelligence", async function () {
            const { contract, reporter1, verifier } = await loadFixture(deployFixture);
            await contract.connect(reporter1).addThreatIntelligence("pool1.com", "domain", "desc", "CAMPAIGN-001");
            await contract.connect(reporter1).addThreatIntelligence("pool2.com", "domain", "desc", "CAMPAIGN-002");
            await contract.connect(verifier).verifyThreatIntelligence(1);
            const verified = await contract.getVerifiedThreatIntelligence();
            expect(verified.length).to.equal(1);
            expect(verified[0].indicator).to.equal("pool1.com");
        });

        it("Should get recent incidents", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            for (let i = 1; i <= 5; i++) {
                const hash = ethers.keccak256(ethers.toUtf8Bytes(`evidence-${i}`));
                await contract.connect(reporter1).reportIncident(`INC-${i}`, hash, 2, `TI-${i}`);
            }
            const recent = await contract.getRecentIncidents(3);
            expect(recent.length).to.equal(3);
            expect(recent[0].externalId).to.equal("INC-3");
            expect(recent[2].externalId).to.equal("INC-5");
        });
    });

    describe("Severity Enum", function () {
        it("Should handle all severity levels", async function () {
            const { contract, reporter1 } = await loadFixture(deployFixture);
            const hash1 = ethers.keccak256(ethers.toUtf8Bytes("low"));
            const hash2 = ethers.keccak256(ethers.toUtf8Bytes("medium"));
            const hash3 = ethers.keccak256(ethers.toUtf8Bytes("high"));
            await contract.connect(reporter1).reportIncident("INC-LOW", hash1, 0, "TI-1"); // LOW
            await contract.connect(reporter1).reportIncident("INC-MED", hash2, 1, "TI-2"); // MEDIUM
            await contract.connect(reporter1).reportIncident("INC-HIGH", hash3, 2, "TI-3"); // HIGH
            expect((await contract.getIncident(1)).severity).to.equal(0);
            expect((await contract.getIncident(2)).severity).to.equal(1);
            expect((await contract.getIncident(3)).severity).to.equal(2);
        });
    });
});