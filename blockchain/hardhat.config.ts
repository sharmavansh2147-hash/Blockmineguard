import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from blockchain/.env or root .env
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const HARDHAT_DEFAULT_KEY = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const rawDeployerKey =
  process.env.DEPLOYER_PRIVATE_KEY ||
  process.env.SEPOLIA_PRIVATE_KEY ||
  "";

// Clean private key, ensure 64 hex chars, and strictly reject default Hardhat dev key
const isValidSepoliaKey = (key: string): boolean => {
  const clean = key.trim().replace(/^0x/, "").toLowerCase();
  if (!clean || clean === HARDHAT_DEFAULT_KEY) {
    return false;
  }
  return /^[0-9a-fA-F]{64}$/.test(clean);
};

const sepoliaAccounts = isValidSepoliaKey(rawDeployerKey)
  ? [rawDeployerKey.startsWith("0x") ? rawDeployerKey : `0x${rawDeployerKey}`]
  : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL && process.env.SEPOLIA_RPC_URL.trim() ? process.env.SEPOLIA_RPC_URL.trim() : "https://eth-sepolia.placeholder",
      accounts: sepoliaAccounts,
      chainId: 11155111,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  ignition: {
    requiredConfirmations: 1,
  },
};

export default config;