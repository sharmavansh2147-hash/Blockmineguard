import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ThreatRegistryModule = buildModule("ThreatRegistryModule", (m) => {
    const threatRegistry = m.contract("ThreatRegistry", []);
    return { threatRegistry };
});

export default ThreatRegistryModule;