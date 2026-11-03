import json
import os
import re
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List, Union
from web3 import Web3
try:
    from web3.middleware import ExtraDataToPOAMiddleware as PoAMiddleware
except ImportError:
    try:
        from web3.middleware import geth_poa_middleware as PoAMiddleware
    except ImportError:
        PoAMiddleware = None
from eth_account import Account


def sanitize_rpc_url(url: Optional[str]) -> str:
    """Mask credentials or API keys in RPC URLs for safe display and logging."""
    if not url:
        return "NOT_CONFIGURED"
    clean = str(url)
    # Alchemy / Infura / QuickNode style /v2/<api_key> or /v3/<api_key>
    clean = re.sub(r'(/v[23]/)[a-zA-Z0-9_-]+', r'\1[REDACTED]', clean)
    # Query parameter style ?key=... or ?apiKey=... or ?token=...
    clean = re.sub(r'([?&](?:apiKey|key|token|auth)=)[^&]+', r'\1[REDACTED]', clean)
    # Basic auth style http://user:pass@host
    clean = re.sub(r'//[^:@]+:[^@]+@', r'//[REDACTED]@', clean)
    return clean


def sanitize_error_message(err: Any) -> str:
    """Sanitize error messages so raw API keys and URLs never appear in logs or responses."""
    msg = str(err)
    msg = re.sub(r'(/v[23]/)[a-zA-Z0-9_-]+', r'\1[REDACTED]', msg)
    msg = re.sub(r'([?&](?:apiKey|key|token|auth)=)[^&]+', r'\1[REDACTED]', msg)
    return msg


class BlockchainService:
    def __init__(self, rpc_url: str = "http://127.0.0.1:8545", contract_address: Optional[str] = None,
                 private_key: Optional[str] = None):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if PoAMiddleware is not None:
            try:
                self.w3.middleware_onion.inject(PoAMiddleware, layer=0)
            except Exception:
                pass

        self.contract_address = contract_address
        self.private_key = private_key
        self.account = None
        self.contract = None

        if private_key:
            self.account = Account.from_key(private_key)

        self._load_contract_abi()

        if contract_address and self.w3.is_connected():
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(contract_address),
                abi=self.contract_abi
            )

    def _load_contract_abi(self):
        abi_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "blockchain", "artifacts",
            "contracts", "ThreatRegistry.sol", "ThreatRegistry.json"
        )
        if os.path.exists(abi_path):
            with open(abi_path, "r") as f:
                artifact = json.load(f)
                self.contract_abi = artifact["abi"]
        else:
            self.contract_abi = self._get_default_abi()

    def _get_default_abi(self) -> list:
        return [
            {
                "inputs": [
                    {"internalType": "string", "name": "externalId", "type": "string"},
                    {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                    {"internalType": "uint8", "name": "severity", "type": "uint8"},
                    {"internalType": "string", "name": "threatIntelRef", "type": "string"}
                ],
                "name": "reportIncident",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"internalType": "uint8", "name": "status", "type": "uint8"}
                ],
                "name": "verifyIncident",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"internalType": "uint8", "name": "status", "type": "uint8"}
                ],
                "name": "resolveIncident",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "incidentId", "type": "uint256"}],
                "name": "getIncident",
                "outputs": [
                    {"internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"internalType": "string", "name": "externalId", "type": "string"},
                    {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "uint8", "name": "severity", "type": "uint8"},
                    {"internalType": "address", "name": "reporter", "type": "address"},
                    {"internalType": "uint8", "name": "verificationStatus", "type": "uint8"},
                    {"internalType": "uint8", "name": "resolutionStatus", "type": "uint8"},
                    {"internalType": "string", "name": "threatIntelRef", "type": "string"},
                    {"internalType": "bool", "name": "exists", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getIncidentCount",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "address", "name": "reporter", "type": "address"}],
                "name": "getReporterReputation",
                "outputs": [
                    {"internalType": "address", "name": "reporter", "type": "address"},
                    {"internalType": "uint256", "name": "reputationScore", "type": "uint256"},
                    {"internalType": "uint256", "name": "totalReports", "type": "uint256"},
                    {"internalType": "uint256", "name": "verifiedReports", "type": "uint256"},
                    {"internalType": "uint256", "name": "falseReports", "type": "uint256"},
                    {"internalType": "bool", "name": "registered", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {"internalType": "string", "name": "indicator", "type": "string"},
                    {"internalType": "string", "name": "indicatorType", "type": "string"},
                    {"internalType": "string", "name": "description", "type": "string"},
                    {"internalType": "string", "name": "campaignId", "type": "string"}
                ],
                "name": "addThreatIntelligence",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "intelId", "type": "uint256"}],
                "name": "verifyThreatIntelligence",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "intelId", "type": "uint256"}],
                "name": "getThreatIntelligence",
                "outputs": [
                    {"internalType": "uint256", "name": "intelId", "type": "uint256"},
                    {"internalType": "string", "name": "indicator", "type": "string"},
                    {"internalType": "string", "name": "indicatorType", "type": "string"},
                    {"internalType": "string", "name": "description", "type": "string"},
                    {"internalType": "string", "name": "campaignId", "type": "string"},
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "address", "name": "reporter", "type": "address"},
                    {"internalType": "bool", "name": "verified", "type": "bool"},
                    {"internalType": "bool", "name": "exists", "type": "bool"}
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getThreatIntelCount",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"}],
                "name": "getIncidentByHash",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "string", "name": "externalId", "type": "string"}],
                "name": "getIncidentByExternalId",
                "outputs": [
                    {
                        "components": [
                            {"internalType": "uint256", "name": "incidentId", "type": "uint256"},
                            {"internalType": "string", "name": "externalId", "type": "string"},
                            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                            {"internalType": "uint8", "name": "severity", "type": "uint8"},
                            {"internalType": "address", "name": "reporter", "type": "address"},
                            {"internalType": "uint8", "name": "verificationStatus", "type": "uint8"},
                            {"internalType": "uint8", "name": "resolutionStatus", "type": "uint8"},
                            {"internalType": "string", "name": "threatIntelRef", "type": "string"},
                            {"internalType": "bool", "name": "exists", "type": "bool"}
                        ],
                        "internalType": "struct ThreatRegistry.Incident",
                        "name": "",
                        "type": "tuple"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "string", "name": "externalId", "type": "string"}],
                "name": "externalIdToIncidentId",
                "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{"internalType": "uint256", "name": "limit", "type": "uint256"}],
                "name": "getRecentIncidents",
                "outputs": [
                    {
                        "components": [
                            {"internalType": "uint256", "name": "incidentId", "type": "uint256"},
                            {"internalType": "string", "name": "externalId", "type": "string"},
                            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                            {"internalType": "uint8", "name": "severity", "type": "uint8"},
                            {"internalType": "address", "name": "reporter", "type": "address"},
                            {"internalType": "uint8", "name": "verificationStatus", "type": "uint8"},
                            {"internalType": "uint8", "name": "resolutionStatus", "type": "uint8"},
                            {"internalType": "string", "name": "threatIntelRef", "type": "string"},
                            {"internalType": "bool", "name": "exists", "type": "bool"}
                        ],
                        "internalType": "struct ThreatRegistry.Incident[]",
                        "name": "",
                        "type": "tuple[]"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"indexed": False, "internalType": "string", "name": "externalId", "type": "string"},
                    {"indexed": False, "internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
                    {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"indexed": False, "internalType": "uint8", "name": "severity", "type": "uint8"},
                    {"indexed": True, "internalType": "address", "name": "reporter", "type": "address"}
                ],
                "name": "IncidentReported",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"indexed": True, "internalType": "address", "name": "verifier", "type": "address"},
                    {"indexed": False, "internalType": "uint8", "name": "status", "type": "uint8"}
                ],
                "name": "IncidentVerified",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "internalType": "uint256", "name": "incidentId", "type": "uint256"},
                    {"indexed": True, "internalType": "address", "name": "resolver", "type": "address"},
                    {"indexed": False, "internalType": "uint8", "name": "status", "type": "uint8"}
                ],
                "name": "IncidentResolved",
                "type": "event"
            }
        ]

    def is_connected(self) -> bool:
        connected = self.w3.is_connected()
        if connected and self.contract_address and not self.contract:
            try:
                self.contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(self.contract_address),
                    abi=self.contract_abi
                )
            except Exception:
                pass
        return connected

    @property
    def chain_id(self) -> Optional[int]:
        try:
            if self.is_connected():
                return int(self.w3.eth.chain_id)
        except Exception:
            pass
        return None

    def set_contract_address(self, address: str):
        self.contract_address = address
        if self.w3.is_connected():
            self.contract = self.w3.eth.contract(
                address=Web3.to_checksum_address(address),
                abi=self.contract_abi
            )

    def get_sanitized_rpc_url(self) -> str:
        endpoint = getattr(getattr(self.w3, "provider", None), "endpoint_uri", None)
        return sanitize_rpc_url(endpoint)

    def switch_network(self, rpc_url: str, contract_address: Optional[str] = None,
                       private_key: Optional[str] = None) -> bool:
        """Switch active RPC endpoint and reinitialize Web3 connection."""
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if PoAMiddleware is not None:
            try:
                self.w3.middleware_onion.inject(PoAMiddleware, layer=0)
            except Exception:
                pass
        self.contract_address = contract_address
        self.private_key = private_key
        self.account = Account.from_key(private_key) if private_key else None
        self.contract = None

        if contract_address and self.is_connected():
            try:
                self.contract = self.w3.eth.contract(
                    address=Web3.to_checksum_address(contract_address),
                    abi=self.contract_abi
                )
            except Exception:
                pass
        return self.is_connected()

    @staticmethod
    def verify_endpoint(rpc_url: str, expected_chain_id: int = 11155111, timeout_seconds: int = 6) -> Dict[str, Any]:
        """
        Safely test an RPC endpoint using eth_chainId and eth_blockNumber.
        Ensures the secret API key is never printed or exposed in errors.
        """
        if not rpc_url or not rpc_url.strip():
            return {
                "success": False,
                "chain_id": None,
                "expected_chain_id": expected_chain_id,
                "sanitized_url": "NOT_CONFIGURED",
                "error": "RPC URL is empty or unconfigured."
            }

        sanitized_url = sanitize_rpc_url(rpc_url)
        payload = json.dumps({
            "jsonrpc": "2.0",
            "method": "eth_chainId",
            "params": [],
            "id": 1
        }).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "BlockMineGuard-Verifier/1.0"
        }

        try:
            req = urllib.request.Request(rpc_url.strip(), data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
                status_code = resp.status
                body = resp.read().decode("utf-8")
                data = json.loads(body)

            if "error" in data:
                err_msg = data["error"].get("message", "Unknown RPC error")
                return {
                    "success": False,
                    "chain_id": None,
                    "expected_chain_id": expected_chain_id,
                    "sanitized_url": sanitized_url,
                    "http_status": status_code,
                    "error": f"RPC Error: {sanitize_error_message(err_msg)}"
                }

            result_hex = data.get("result")
            if not result_hex:
                return {
                    "success": False,
                    "chain_id": None,
                    "expected_chain_id": expected_chain_id,
                    "sanitized_url": sanitized_url,
                    "error": "No chain ID returned in RPC result."
                }

            chain_id = int(result_hex, 16)
            is_match = (chain_id == expected_chain_id)

            # Query block number as well for liveness verification
            block_number = None
            try:
                block_payload = json.dumps({
                    "jsonrpc": "2.0",
                    "method": "eth_blockNumber",
                    "params": [],
                    "id": 2
                }).encode("utf-8")
                b_req = urllib.request.Request(rpc_url.strip(), data=block_payload, headers=headers, method="POST")
                with urllib.request.urlopen(b_req, timeout=timeout_seconds) as b_resp:
                    b_data = json.loads(b_resp.read().decode("utf-8"))
                    if "result" in b_data:
                        block_number = int(b_data["result"], 16)
            except Exception:
                pass

            return {
                "success": is_match,
                "chain_id": chain_id,
                "chain_id_hex": result_hex,
                "expected_chain_id": expected_chain_id,
                "block_number": block_number,
                "sanitized_url": sanitized_url,
                "http_status": status_code,
                "network_name": "Ethereum Sepolia" if chain_id == 11155111 else ("Hardhat Local" if chain_id == 31337 else f"Chain {chain_id}"),
                "message": (
                    f"Successfully verified {sanitized_url} (Chain ID: {chain_id}, Block: #{block_number})"
                    if is_match
                    else f"Chain ID mismatch: expected {expected_chain_id}, but node returned {chain_id} ({result_hex})"
                )
            }

        except urllib.error.HTTPError as http_err:
            return {
                "success": False,
                "chain_id": None,
                "expected_chain_id": expected_chain_id,
                "sanitized_url": sanitized_url,
                "http_status": http_err.code,
                "error": f"HTTP Error {http_err.code}: {http_err.reason}"
            }
        except urllib.error.URLError as url_err:
            return {
                "success": False,
                "chain_id": None,
                "expected_chain_id": expected_chain_id,
                "sanitized_url": sanitized_url,
                "error": f"Network Connection Error: {sanitize_error_message(url_err.reason)}"
            }
        except Exception as e:
            return {
                "success": False,
                "chain_id": None,
                "expected_chain_id": expected_chain_id,
                "sanitized_url": sanitized_url,
                "error": f"Verification failed: {sanitize_error_message(e)}"
            }

    def _send_transaction(self, tx_func) -> Dict[str, Any]:
        if not self.account:
            raise ValueError("Private key not configured")

        nonce = self.w3.eth.get_transaction_count(self.account.address)
        tx = tx_func.build_transaction({
            "from": self.account.address,
            "nonce": nonce,
            "gas": 300000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id
        })

        signed_tx = self.w3.eth.account.sign_transaction(tx, self.private_key)
        raw_tx = getattr(signed_tx, "raw_transaction", None)
        if raw_tx is None:
            raw_tx = getattr(signed_tx, "rawTransaction", None)
        if raw_tx is None:
            raise ValueError("Could not extract raw transaction bytes from signed transaction")

        tx_hash = self.w3.eth.send_raw_transaction(raw_tx)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)
        if not tx_hex.startswith("0x"):
            tx_hex = "0x" + tx_hex

        block_number = receipt.blockNumber if hasattr(receipt, "blockNumber") else receipt.get("blockNumber")
        gas_used = receipt.gasUsed if hasattr(receipt, "gasUsed") else receipt.get("gasUsed")
        status = receipt.status if hasattr(receipt, "status") else receipt.get("status")

        return {
            "tx_hash": tx_hex,
            "block_number": block_number,
            "gas_used": gas_used,
            "status": status
        }

    def report_incident(self, external_id: str, evidence_hash: str, severity: int,
                        threat_intel_ref: str = "") -> Dict[str, Any]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        clean_hash = evidence_hash.strip()
        if not clean_hash.startswith("0x"):
            clean_hash = "0x" + clean_hash

        try:
            evidence_hash_bytes = Web3.to_bytes(hexstr=clean_hash)
        except Exception:
            evidence_hash_bytes = Web3.keccak(text=evidence_hash)

        if len(evidence_hash_bytes) != 32:
            evidence_hash_bytes = Web3.keccak(text=evidence_hash)

        tx_func = self.contract.functions.reportIncident(
            external_id, evidence_hash_bytes, severity, threat_intel_ref
        )
        result = self._send_transaction(tx_func)

        incident_id = self._extract_incident_id_from_receipt(result["tx_hash"])
        result["incident_id"] = incident_id
        return result

    def _extract_incident_id_from_receipt(self, tx_hash: str) -> Optional[int]:
        receipt = self.w3.eth.get_transaction_receipt(tx_hash)
        for log in receipt.logs:
            try:
                parsed = self.contract.events.IncidentReported().process_log(log)
                return parsed.args.incidentId
            except:
                continue
        return None

    def verify_incident(self, incident_id: int, status: int) -> Dict[str, Any]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        tx_func = self.contract.functions.verifyIncident(incident_id, status)
        return self._send_transaction(tx_func)

    def resolve_incident(self, incident_id: int, status: int) -> Dict[str, Any]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        tx_func = self.contract.functions.resolveIncident(incident_id, status)
        return self._send_transaction(tx_func)

    def get_incident(self, incident_id: int) -> Optional[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            result = self.contract.functions.getIncident(incident_id).call()
            if result[-1]:
                return {
                    "incident_id": result[0],
                    "external_id": result[1],
                    "evidence_hash": result[2].hex() if isinstance(result[2], bytes) else result[2],
                    "timestamp": result[3],
                    "severity": result[4],
                    "reporter": result[5],
                    "verification_status": result[6],
                    "resolution_status": result[7],
                    "threat_intel_ref": result[8],
                    "exists": result[9]
                }
        except Exception:
            pass
        return None

    def get_incident_count(self) -> int:
        if not self.contract:
            raise ValueError("Contract not initialized")
        return self.contract.functions.getIncidentCount().call()

    def get_reporter_reputation(self, address: str) -> Optional[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            result = self.contract.functions.getReporterReputation(
                Web3.to_checksum_address(address)
            ).call()
            return {
                "reporter": result[0],
                "reputation_score": result[1],
                "total_reports": result[2],
                "verified_reports": result[3],
                "false_reports": result[4],
                "registered": result[5]
            }
        except Exception:
            return None

    def add_threat_intelligence(self, indicator: str, indicator_type: str,
                                description: str, campaign_id: str) -> Dict[str, Any]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        tx_func = self.contract.functions.addThreatIntelligence(
            indicator, indicator_type, description, campaign_id
        )
        result = self._send_transaction(tx_func)

        intel_id = self._extract_intel_id_from_receipt(result["tx_hash"])
        result["intel_id"] = intel_id
        return result

    def _extract_intel_id_from_receipt(self, tx_hash: str) -> Optional[int]:
        receipt = self.w3.eth.get_transaction_receipt(tx_hash)
        for log in receipt.logs:
            try:
                parsed = self.contract.events.ThreatIntelAdded().process_log(log)
                return parsed.args.intelId
            except:
                continue
        return None

    def verify_threat_intelligence(self, intel_id: int) -> Dict[str, Any]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        tx_func = self.contract.functions.verifyThreatIntelligence(intel_id)
        return self._send_transaction(tx_func)

    def get_threat_intelligence(self, intel_id: int) -> Optional[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            result = self.contract.functions.getThreatIntelligence(intel_id).call()
            if result[-1]:
                return {
                    "intel_id": result[0],
                    "indicator": result[1],
                    "indicator_type": result[2],
                    "description": result[3],
                    "campaign_id": result[4],
                    "timestamp": result[5],
                    "reporter": result[6],
                    "verified": result[7],
                    "exists": result[8]
                }
        except Exception:
            pass
        return None

    def get_threat_intel_count(self) -> int:
        if not self.contract:
            raise ValueError("Contract not initialized")
        return self.contract.functions.getThreatIntelCount().call()

    def get_incident_by_hash(self, evidence_hash: str) -> Optional[int]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        evidence_hash_bytes = Web3.to_bytes(hexstr=evidence_hash)
        if len(evidence_hash_bytes) != 32:
            evidence_hash_bytes = Web3.keccak(text=evidence_hash)

        try:
            return self.contract.functions.getIncidentByHash(evidence_hash_bytes).call()
        except Exception:
            return None

    def get_incident_by_external_id(self, external_id: str) -> Optional[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            result = self.contract.functions.getIncidentByExternalId(external_id).call()
            if result and result[-1]:
                return {
                    "incident_id": result[0],
                    "external_id": result[1],
                    "evidence_hash": result[2].hex() if isinstance(result[2], bytes) else result[2],
                    "timestamp": result[3],
                    "severity": result[4],
                    "reporter": result[5],
                    "verification_status": result[6],
                    "resolution_status": result[7],
                    "threat_intel_ref": result[8],
                    "exists": result[9]
                }
        except Exception:
            pass
        return None

    def get_recent_incidents(self, limit: int = 10) -> List[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            results = self.contract.functions.getRecentIncidents(limit).call()
            return [
                {
                    "incident_id": r[0],
                    "external_id": r[1],
                    "evidence_hash": r[2].hex() if isinstance(r[2], bytes) else r[2],
                    "timestamp": r[3],
                    "severity": r[4],
                    "reporter": r[5],
                    "verification_status": r[6],
                    "resolution_status": r[7],
                    "threat_intel_ref": r[8],
                    "exists": r[9]
                }
                for r in results if r[9]
            ]
        except Exception:
            return []

    def get_verified_threat_intelligence(self) -> List[Dict[str, Any]]:
        if not self.contract:
            raise ValueError("Contract not initialized")

        try:
            results = self.contract.functions.getVerifiedThreatIntelligence().call()
            return [
                {
                    "intel_id": r[0],
                    "indicator": r[1],
                    "indicator_type": r[2],
                    "description": r[3],
                    "campaign_id": r[4],
                    "timestamp": r[5],
                    "reporter": r[6],
                    "verified": r[7],
                    "exists": r[8]
                }
                for r in results if r[8]
            ]
        except Exception:
            return []