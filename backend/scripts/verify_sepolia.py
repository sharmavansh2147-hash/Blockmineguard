#!/usr/bin/env python3
"""
BlockMineGuard - Ethereum Sepolia & Localhost Environment Verification Utility
Safely tests Sepolia RPC connectivity via eth_chainId (0xaa36a7 = 11155111).
NEVER prints or leaks API keys, private keys, or full secret URLs.
"""

import os
import sys
from pathlib import Path
from decimal import Decimal
from dotenv import load_dotenv

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Load .env from backend/.env or root .env
root_env = backend_dir.parent / ".env"
backend_env = backend_dir / ".env"

if root_env.exists():
    load_dotenv(dotenv_path=root_env)
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env, override=False)

from api.blockchain_service import BlockchainService, sanitize_rpc_url, sanitize_error_message
from web3 import Web3
from eth_account import Account


def main():
    print("=" * 65)
    print("🛡️  BLOCKMINEGUARD — NETWORK CONFIGURATION & CONNECTIVITY AUDIT")
    print("=" * 65)

    # 1. Audit Environment Variables
    sepolia_rpc = os.getenv("SEPOLIA_RPC_URL", "").strip()
    sepolia_contract = os.getenv("SEPOLIA_CONTRACT_ADDRESS", "").strip()
    raw_deployer_key = (os.getenv("DEPLOYER_PRIVATE_KEY") or os.getenv("SEPOLIA_PRIVATE_KEY") or "").strip()
    local_rpc = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:8545").strip()
    local_contract = os.getenv("CONTRACT_ADDRESS", "0x525C7063E7C20997BaaE9bDa922159152D0e8417").strip()
    active_network = os.getenv("BLOCKCHAIN_NETWORK", os.getenv("ACTIVE_NETWORK", "localhost")).strip().lower()

    print(f"\n[1] ACTIVE ENVIRONMENT MODE")
    print(f"    • Configured Mode:       {active_network.upper()} (Options: localhost | sepolia)")
    print(f"    • Hardhat Local Node:    {sanitize_rpc_url(local_rpc)}")
    print(f"    • Hardhat Contract:      {local_contract}")

    # 2. Hardhat Local Audit
    print(f"\n[2] HARDHAT LOCAL (Chain 31337) STATUS")
    local_result = BlockchainService.verify_endpoint(local_rpc, expected_chain_id=31337, timeout_seconds=2)
    if local_result.get("success"):
        print(f"    ✅ Hardhat Local:        CONNECTED")
        print(f"    • Chain ID:              {local_result.get('chain_id')} ({local_result.get('chain_id_hex')})")
        print(f"    • Latest Block:          #{local_result.get('block_number')}")
    else:
        print(f"    ⚠️ Hardhat Local:        NOT RUNNING ({local_result.get('error', 'Connection refused')})")
        print(f"      (To start local node: npx hardhat node)")

    # 3. Sepolia Endpoint Audit
    print(f"\n[3] ETHEREUM SEPOLIA (Chain 11155111) RPC STATUS")
    if not sepolia_rpc:
        print("    ❌ SEPOLIA_RPC_URL:       NOT CONFIGURED")
        print("    • Action Required:       Set SEPOLIA_RPC_URL in your .env file with your")
        print("                             Alchemy Sepolia HTTPS endpoint:")
        print("                             https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY")
        print("\n" + "=" * 65)
        print("⚠️  AUDIT SUMMARY: Sepolia RPC endpoint is not yet configured.")
        print("=" * 65)
        return 1

    sanitized = sanitize_rpc_url(sepolia_rpc)
    print(f"    • Target Endpoint:       {sanitized}")

    sepolia_result = BlockchainService.verify_endpoint(sepolia_rpc, expected_chain_id=11155111, timeout_seconds=8)

    if not sepolia_result.get("success"):
        print(f"    ❌ Connectivity:          FAILED")
        print(f"    • Error Details:         {sepolia_result.get('error')}")
        if sepolia_result.get("chain_id"):
            print(f"    • Returned Chain ID:     {sepolia_result.get('chain_id')} (Expected: 11155111)")
        print("\n" + "=" * 65)
        print("❌ AUDIT SUMMARY: Sepolia endpoint failed connectivity or chain ID check.")
        print("=" * 65)
        return 2

    print(f"    ✅ Connectivity:          SUCCESS (HTTP {sepolia_result.get('http_status', 200)})")
    print(f"    • Verified Chain ID:     {sepolia_result.get('chain_id')} (Hex: {sepolia_result.get('chain_id_hex')}) == 11155111")
    print(f"    • Network:               {sepolia_result.get('network_name')}")
    print(f"    • Latest Sepolia Block:  #{sepolia_result.get('block_number')}")

    # 4. Deployer Account Audit (if key configured)
    print(f"\n[4] SEPOLIA DEPLOYER ACCOUNT AUDIT")
    if not raw_deployer_key:
        print("    ℹ️  DEPLOYER_PRIVATE_KEY: NOT CONFIGURED")
        print("       (Only required when deploying contracts or sending on-chain txs from backend)")
    else:
        try:
            clean_key = raw_deployer_key.strip()
            if not clean_key.startswith("0x"):
                clean_key = "0x" + clean_key
            account = Account.from_key(clean_key)
            deployer_addr = account.address
            print(f"    • Account Address:       {deployer_addr}")

            # Check balance via Web3
            w3_sepolia = Web3(Web3.HTTPProvider(sepolia_rpc))
            balance_wei = w3_sepolia.eth.get_balance(deployer_addr)
            balance_eth = Decimal(balance_wei) / Decimal(10**18)
            print(f"    • Sepolia ETH Balance:   {balance_eth:.6f} ETH ({balance_wei:,} Wei)")

            min_req = Decimal("0.005")
            if balance_eth < min_req:
                print(f"    ⚠️  Low Balance:          < {min_req} ETH needed for deployment gas")
                print(f"       Obtain free testnet ETH at: https://sepoliafaucet.com or https://cloud.google.com/application/web3/faucet/ethereum/sepolia")
            else:
                print(f"    ✅ Balance Sufficient:   Ready for deployment transactions")
        except Exception as e:
            print(f"    ❌ Deployer Key Error:    {sanitize_error_message(e)}")

    # 5. Sepolia Contract Status
    print(f"\n[5] SEPOLIA SMART CONTRACT STATUS")
    if not sepolia_contract:
        print("    ℹ️  SEPOLIA_CONTRACT_ADDRESS: NOT YET DEPLOYED / CONFIGURED")
        print("       (ThreatRegistry.sol has not yet been deployed to Sepolia)")
    else:
        print(f"    • Contract Address:      {sepolia_contract}")
        try:
            w3_sepolia = Web3(Web3.HTTPProvider(sepolia_rpc))
            code = w3_sepolia.eth.get_code(Web3.to_checksum_address(sepolia_contract))
            if code and code != b"" and code != b"\x00":
                print(f"    ✅ Contract Bytecode:     ACTIVE on Sepolia ({len(code)} bytes)")
            else:
                print(f"    ❌ Contract Bytecode:     NOT FOUND at address on Sepolia")
        except Exception as e:
            print(f"    ❌ Contract Query Error:  {sanitize_error_message(e)}")

    print("\n" + "=" * 65)
    print("✅ AUDIT SUMMARY: Sepolia RPC endpoint verified successfully (Chain ID 11155111).")
    print("=" * 65)
    return 0


if __name__ == "__main__":
    sys.exit(main())
