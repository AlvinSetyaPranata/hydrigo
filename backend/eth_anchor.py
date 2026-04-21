from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from eth_account import Account
from web3 import HTTPProvider, Web3


BASE_DIR = Path(__file__).resolve().parent
ABI_PATH = BASE_DIR / "contracts" / "HydrigoAnchor.abi.json"


class AnchorConfigurationError(Exception):
    pass


class AnchorExecutionError(Exception):
    pass


@dataclass
class AnchorSettings:
    rpc_url: str
    chain_id: int
    contract_address: str
    private_key: str
    wallet_address: str
    gas: int


def load_anchor_settings() -> AnchorSettings:
    rpc_url = os.environ.get("ETH_RPC_URL", "").strip()
    contract_address = os.environ.get("ETH_CONTRACT_ADDRESS", "").strip()
    private_key = os.environ.get("ETH_PRIVATE_KEY", "").strip()

    if not rpc_url:
        raise AnchorConfigurationError("ETH_RPC_URL belum diatur")
    if not contract_address:
        raise AnchorConfigurationError("ETH_CONTRACT_ADDRESS belum diatur")
    if not private_key:
        raise AnchorConfigurationError("ETH_PRIVATE_KEY belum diatur")

    try:
        chain_id = int(os.environ.get("ETH_CHAIN_ID", "11155111"))
    except ValueError as exc:
        raise AnchorConfigurationError("ETH_CHAIN_ID harus integer") from exc

    try:
        gas = int(os.environ.get("ETH_GAS_LIMIT", "300000"))
    except ValueError as exc:
        raise AnchorConfigurationError("ETH_GAS_LIMIT harus integer") from exc

    account = Account.from_key(private_key)
    wallet_address = os.environ.get("ETH_WALLET_ADDRESS", account.address).strip() or account.address

    return AnchorSettings(
        rpc_url=rpc_url,
        chain_id=chain_id,
        contract_address=Web3.to_checksum_address(contract_address),
        private_key=private_key,
        wallet_address=Web3.to_checksum_address(wallet_address),
        gas=gas,
    )


def load_contract_abi() -> list[dict[str, Any]]:
    return json.loads(ABI_PATH.read_text(encoding="utf-8"))


def anchor_block_record(settings: AnchorSettings, block: dict[str, Any]) -> str:
    web3 = Web3(HTTPProvider(settings.rpc_url))
    if not web3.is_connected():
        raise AnchorExecutionError("gagal terhubung ke Ethereum RPC")

    contract = web3.eth.contract(address=settings.contract_address, abi=load_contract_abi())

    try:
        nonce = web3.eth.get_transaction_count(settings.wallet_address)
        gas_price = web3.eth.gas_price
        transaction = contract.functions.anchorReading(
            int(block["block_index"]),
            int(block["reading_id"]),
            bytes.fromhex(block["payload_hash"]),
            bytes.fromhex(block["block_hash"]),
            str(block["device_id"]),
            str(block["lettuce_bed_id"]),
            str(block["recorded_at"]),
        ).build_transaction(
            {
                "chainId": settings.chain_id,
                "from": settings.wallet_address,
                "nonce": nonce,
                "gas": settings.gas,
                "gasPrice": gas_price,
            }
        )
        signed = Account.sign_transaction(transaction, private_key=settings.private_key)
        tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    except Exception as exc:
        raise AnchorExecutionError(f"gagal mengirim transaksi anchor: {exc}") from exc

    if receipt.status != 1:
        raise AnchorExecutionError("transaksi anchor gagal di chain")

    return receipt.transactionHash.hex()
