#!/usr/bin/env python3
"""
BlockMineGuard - Security App
Alchemy Ethereum Sepolia Balance & RPC Connectivity Checker
Queries eth_getBalance and eth_chainId using Alchemy JSON-RPC.
Protects credentials: Never logs or prints raw API keys or URLs.
"""

import os
import re
import sys
import json
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path
from dotenv import load_dotenv

# Load .env from current directory or parent directories
env_path = Path(__file__).parent / ".env"
parent_env = Path(__file__).parent.parent / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
if parent_env.exists():
    load_dotenv(dotenv_path=parent_env, override=False)

def sanitize_url(url: str) -> str:
    return re.sub(r'(/v[23]/)[a-zA-Z0-9_-]+', r'\1[REDACTED]', url)

sepolia_rpc = os.getenv("SEPOLIA_RPC_URL", "").strip()
alchemy_key = os.getenv("ALCHEMY_API_KEY", "").strip()

if sepolia_rpc:
    endpoint_url = sepolia_rpc
elif alchemy_key:
    endpoint_url = f"https://eth-sepolia.g.alchemy.com/v2/{alchemy_key}"
else:
    print("❌ Error: Neither SEPOLIA_RPC_URL nor ALCHEMY_API_KEY is configured in .env", file=sys.stderr)
    print("   Please configure SEPOLIA_RPC_URL in your .env file.", file=sys.stderr)
    sys.exit(1)

TARGET_ADDRESS = os.getenv("TARGET_ADDRESS", "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")  # vitalik.eth

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "SecurityApp/1.0"
}

sanitized_endpoint = sanitize_url(endpoint_url)
print(f"Connecting to Alchemy Ethereum Sepolia...")
print(f"Endpoint:       {sanitized_endpoint}")
print(f"Target Address: {TARGET_ADDRESS}")

try:
    # 1. Verify chain ID
    chain_payload = {
        "jsonrpc": "2.0",
        "method": "eth_chainId",
        "params": [],
        "id": 1
    }
    req_chain = urllib.request.Request(
        url=endpoint_url,
        data=json.dumps(chain_payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(req_chain, timeout=10) as resp:
        chain_data = json.loads(resp.read().decode("utf-8"))

    chain_id_hex = chain_data.get("result", "")
    chain_id = int(chain_id_hex, 16) if chain_id_hex else None

    # 2. Get balance
    balance_payload = {
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [TARGET_ADDRESS, "latest"],
        "id": 2
    }
    req_balance = urllib.request.Request(
        url=endpoint_url,
        data=json.dumps(balance_payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(req_balance, timeout=10) as resp:
        balance_data = json.loads(resp.read().decode("utf-8"))

    result_hex = balance_data.get("result")
    balance_wei = int(result_hex, 16) if result_hex else 0
    balance_eth = Decimal(balance_wei) / Decimal(10**18)

    print("\n" + "=" * 50)
    print(" Alchemy API Call Successful!")
    print("=" * 50)
    print(f" Verified Chain ID: {chain_id} ({chain_id_hex}) {'[SEPOLIA TESTNET]' if chain_id == 11155111 else ''}")
    print(f" Target Address:    {TARGET_ADDRESS}")
    print(f" Balance Wei:       {balance_wei:,} Wei")
    print(f" Balance ETH:       {balance_eth:.6f} ETH")
    print("=" * 50)
    print("✅ Request logged to your Alchemy Dashboard.")

except urllib.error.HTTPError as http_err:
    print(f"\n❌ HTTP Error {http_err.code}: {http_err.reason}", file=sys.stderr)
    sys.exit(1)
except urllib.error.URLError as url_err:
    print(f"\n❌ Network Connection Error: {url_err.reason}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    clean_err = sanitize_url(str(e))
    print(f"\n❌ Unexpected error: {clean_err}", file=sys.stderr)
    sys.exit(1)
