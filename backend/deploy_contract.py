from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from eth_account import Account
from solcx import compile_standard, get_installed_solc_versions, install_solc, set_solc_version
from web3 import HTTPProvider, Web3


BASE_DIR = Path(__file__).resolve().parent
CONTRACTS_DIR = BASE_DIR / "contracts"
BUILD_DIR = BASE_DIR / "build"
SOLIDITY_VERSION = "0.8.24"
CONTRACT_FILE = CONTRACTS_DIR / "HydrigoAnchor.sol"
CONTRACT_NAME = "HydrigoAnchor"


class DeployConfigurationError(Exception):
    pass


def ensure_solc(version: str = SOLIDITY_VERSION) -> None:
    installed = {str(item) for item in get_installed_solc_versions()}
    if version not in installed:
        install_solc(version)
    set_solc_version(version)


def compile_contract() -> tuple[list[dict[str, Any]], str]:
    ensure_solc()
    source = CONTRACT_FILE.read_text(encoding="utf-8")
    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": {
                CONTRACT_FILE.name: {
                    "content": source,
                }
            },
            "settings": {
                "outputSelection": {
                    "*": {
                        "*": ["abi", "evm.bytecode.object"],
                    }
                }
            },
        }
    )

    contract = compiled["contracts"][CONTRACT_FILE.name][CONTRACT_NAME]
    abi = contract["abi"]
    bytecode = contract["evm"]["bytecode"]["object"]
    return abi, bytecode


def load_deploy_settings() -> dict[str, Any]:
    rpc_url = os.environ.get("ETH_RPC_URL", "").strip()
    private_key = os.environ.get("ETH_PRIVATE_KEY", "").strip()
    wallet_address = os.environ.get("ETH_WALLET_ADDRESS", "").strip()

    if not rpc_url:
        raise DeployConfigurationError("ETH_RPC_URL belum diatur")
    if not private_key:
        raise DeployConfigurationError("ETH_PRIVATE_KEY belum diatur")

    account = Account.from_key(private_key)
    if not wallet_address:
        wallet_address = account.address

    try:
        chain_id = int(os.environ.get("ETH_CHAIN_ID", "11155111"))
    except ValueError as exc:
        raise DeployConfigurationError("ETH_CHAIN_ID harus integer") from exc

    try:
        gas_limit = int(os.environ.get("ETH_DEPLOY_GAS_LIMIT", "1200000"))
    except ValueError as exc:
        raise DeployConfigurationError("ETH_DEPLOY_GAS_LIMIT harus integer") from exc

    return {
        "rpc_url": rpc_url,
        "private_key": private_key,
        "wallet_address": Web3.to_checksum_address(wallet_address),
        "chain_id": chain_id,
        "gas_limit": gas_limit,
    }


def deploy_contract() -> dict[str, Any]:
    settings = load_deploy_settings()
    abi, bytecode = compile_contract()

    web3 = Web3(HTTPProvider(settings["rpc_url"]))
    if not web3.is_connected():
        raise RuntimeError("gagal terhubung ke Ethereum RPC")

    contract = web3.eth.contract(abi=abi, bytecode=bytecode)
    nonce = web3.eth.get_transaction_count(settings["wallet_address"])
    gas_price = web3.eth.gas_price
    tx = contract.constructor().build_transaction(
        {
            "chainId": settings["chain_id"],
            "from": settings["wallet_address"],
            "nonce": nonce,
            "gas": settings["gas_limit"],
            "gasPrice": gas_price,
        }
    )

    signed = Account.sign_transaction(tx, private_key=settings["private_key"])
    tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    if receipt.status != 1:
        raise RuntimeError("deploy contract gagal di chain")

    contract_address = receipt.contractAddress
    BUILD_DIR.mkdir(exist_ok=True)

    artifact = {
        "contract_name": CONTRACT_NAME,
        "solidity_version": SOLIDITY_VERSION,
        "chain_id": settings["chain_id"],
        "rpc_url": settings["rpc_url"],
        "wallet_address": settings["wallet_address"],
        "transaction_hash": receipt.transactionHash.hex(),
        "contract_address": contract_address,
        "abi": abi,
    }

    (BUILD_DIR / "HydrigoAnchor.deploy.json").write_text(
        json.dumps(artifact, indent=2),
        encoding="utf-8",
    )
    (CONTRACTS_DIR / "HydrigoAnchor.abi.json").write_text(json.dumps(abi, indent=2), encoding="utf-8")

    return artifact


def main() -> None:
    artifact = deploy_contract()
    print(json.dumps(artifact, indent=2))


if __name__ == "__main__":
    main()
