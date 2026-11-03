import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const networkName = network.name;

  if (networkName === "sepolia") {
    const rpc = (process.env.SEPOLIA_RPC_URL || "").trim();
    if (!rpc || rpc.includes(".placeholder")) {
      throw new Error(
        "\n❌ MISSING SEPOLIA_RPC_URL IN .env:\n" +
        "   Please configure your Alchemy Sepolia HTTPS endpoint in /Users/vanshsharma/blockmineguard/.env:\n" +
        "   SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY\n"
      );
    }
  }

  const signers = await ethers.getSigners();

  if (!signers || signers.length === 0) {
    throw new Error(
      `❌ No valid deployer account found for network '${networkName}'!\n` +
      `   Please set DEPLOYER_PRIVATE_KEY in your .env file with a 64-character hex private key.\n` +
      `   Example: DEPLOYER_PRIVATE_KEY=0x1234567890abcdef...`
    );
  }

  const deployer = signers[0];
  const chainId = (await ethers.provider.getNetwork()).chainId;

  if (networkName === "sepolia" && Number(chainId) !== 11155111) {
    throw new Error(
      `❌ Chain ID mismatch for network '${networkName}'!\n` +
      `   Expected Chain ID: 11155111\n` +
      `   Connected Node ID: ${chainId}\n` +
      `   Please verify that SEPOLIA_RPC_URL points to an Ethereum Sepolia endpoint.`
    );
  }

  console.log("----------------------------------------------------");
  console.log(`🚀 Deploying ThreatRegistry to ${networkName} (Chain ID: ${chainId})`);
  console.log(`👤 Deployer Address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  const minRequiredBalance = ethers.parseEther("0.005");
  if (balance < minRequiredBalance && networkName !== "localhost" && networkName !== "hardhat") {
    throw new Error(
      `\n❌ INSUFFICIENT SEPOLIA TESTNET ETH:\n` +
      `   Deployer Account: ${deployer.address}\n` +
      `   Current Balance:  ${ethers.formatEther(balance)} ETH\n` +
      `   Required Gas:     ~0.005 Sepolia ETH\n\n` +
      `   HOW TO FUND BEFORE DEPLOYMENT:\n` +
      `   1. Visit a free faucet and paste address ${deployer.address}:\n` +
      `      • Google Cloud Web3 Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia\n` +
      `      • Alchemy Sepolia Faucet:   https://sepoliafaucet.com\n` +
      `      • PoW Sepolia Faucet:       https://sepolia-faucet.pk910.de\n` +
      `   2. Alternatively, set your own funded account private key in .env:\n` +
      `      DEPLOYER_PRIVATE_KEY=0x<your_funded_private_key>\n` +
      `   3. Re-run: npm run deploy:sepolia\n`
    );
  }

  console.log("⏳ Deploying ThreatRegistry smart contract...");
  const ThreatRegistryFactory = await ethers.getContractFactory("ThreatRegistry");
  const threatRegistry = await ThreatRegistryFactory.deploy();
  await threatRegistry.waitForDeployment();

  const contractAddress = await threatRegistry.getAddress();
  const deployTx = threatRegistry.deploymentTransaction();
  const txHash = deployTx ? deployTx.hash : "N/A";
  const receipt = deployTx ? await deployTx.wait() : null;
  const blockNumber = receipt ? receipt.blockNumber : "N/A";

  console.log("✅ ThreatRegistry deployed successfully!");
  console.log(`📍 Contract Address: ${contractAddress}`);
  console.log(`📜 Transaction Hash: ${txHash}`);
  console.log(`🧱 Block Number: ${blockNumber}`);

  if (Number(chainId) === 11155111) {
    console.log(`🔍 Etherscan Link: https://sepolia.etherscan.io/address/${contractAddress}`);
  }

  // Save deployment manifest
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const manifest = {
    network: networkName,
    chainId: Number(chainId),
    contractAddress,
    deployer: deployer.address,
    transactionHash: txHash,
    blockNumber: Number(blockNumber),
    deployedAt: new Date().toISOString(),
    explorerUrl: Number(chainId) === 11155111 ? `https://sepolia.etherscan.io/address/${contractAddress}` : null,
  };

  const manifestPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`💾 Saved deployment manifest to: ${manifestPath}`);

  // Also sync to frontend
  const frontendContractsDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  const frontendManifestPath = path.join(frontendContractsDir, "deployed_addresses.json");
  let currentAddresses: Record<string, string> = {};
  if (fs.existsSync(frontendManifestPath)) {
    try {
      currentAddresses = JSON.parse(fs.readFileSync(frontendManifestPath, "utf-8"));
    } catch {}
  }

  currentAddresses[networkName] = contractAddress;
  currentAddresses[String(chainId)] = contractAddress;
  fs.writeFileSync(frontendManifestPath, JSON.stringify(currentAddresses, null, 2));
  console.log(`💾 Synced to frontend: ${frontendManifestPath}`);

  // Copy compiled artifact to frontend for exact ABI alignment
  const artifactSrc = path.join(__dirname, "..", "artifacts", "contracts", "ThreatRegistry.sol", "ThreatRegistry.json");
  const artifactDest = path.join(frontendContractsDir, "ThreatRegistry.json");
  if (fs.existsSync(artifactSrc)) {
    fs.copyFileSync(artifactSrc, artifactDest);
    console.log(`💾 Synced ABI artifact to frontend: ${artifactDest}`);
  }

  // Update .env files with deployed contract address
  const rootEnvPath = path.join(__dirname, "..", "..", ".env");
  const backendEnvPath = path.join(__dirname, "..", "..", "backend", ".env");
  const frontendEnvPath = path.join(__dirname, "..", "..", "frontend", ".env");

  const varName = Number(chainId) === 11155111 ? "SEPOLIA_CONTRACT_ADDRESS" : "CONTRACT_ADDRESS";

  for (const envFile of [rootEnvPath, backendEnvPath]) {
    if (fs.existsSync(envFile)) {
      let content = fs.readFileSync(envFile, "utf-8");
      if (content.includes(`${varName}=`)) {
        content = content.replace(new RegExp(`^${varName}=.*$`, "m"), `${varName}=${contractAddress}`);
      } else {
        content += `\n${varName}=${contractAddress}\n`;
      }
      fs.writeFileSync(envFile, content);
      console.log(`💾 Updated ${varName} in: ${envFile}`);
    }
  }

  // Frontend .env with REACT_APP_SEPOLIA_CONTRACT_ADDRESS
  if (Number(chainId) === 11155111) {
    let frontendEnvContent = "";
    if (fs.existsSync(frontendEnvPath)) {
      frontendEnvContent = fs.readFileSync(frontendEnvPath, "utf-8");
    }
    if (frontendEnvContent.includes("REACT_APP_SEPOLIA_CONTRACT_ADDRESS=")) {
      frontendEnvContent = frontendEnvContent.replace(/^REACT_APP_SEPOLIA_CONTRACT_ADDRESS=.*$/m, `REACT_APP_SEPOLIA_CONTRACT_ADDRESS=${contractAddress}`);
    } else {
      frontendEnvContent += `\nREACT_APP_SEPOLIA_CONTRACT_ADDRESS=${contractAddress}\n`;
    }
    fs.writeFileSync(frontendEnvPath, frontendEnvContent);
    console.log(`💾 Updated REACT_APP_SEPOLIA_CONTRACT_ADDRESS in: ${frontendEnvPath}`);
  }

  // Live contract read test
  try {
    const incidentCount = await threatRegistry.getIncidentCount();
    console.log(`📡 Live Read Test Passed: getIncidentCount() = ${incidentCount.toString()}`);
  } catch (readErr: any) {
    console.warn(`⚠️ Warning: Live contract read test encountered: ${readErr.message || readErr}`);
  }

  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
