#!/usr/bin/env sh

set -eu

cd /app

echo "Starting contract deployment"
echo "RPC URL: ${ETH_RPC_URL:-unset}"
echo "Chain ID: ${ETH_CHAIN_ID:-unset}"

python - <<'PY'
import json
import os
import sys
import time

import requests

rpc_url = os.environ.get("ETH_RPC_URL", "").strip()
deadline = time.time() + 120
payload = {
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1,
}

if not rpc_url:
    print("ETH_RPC_URL is not set", file=sys.stderr)
    sys.exit(1)

while time.time() < deadline:
    try:
        response = requests.post(rpc_url, json=payload, timeout=3)
        response.raise_for_status()
        data = response.json()
        if "result" in data:
            print(f"Ethereum RPC ready at {rpc_url} with block {data['result']}")
            sys.exit(0)
    except Exception as exc:
        print(f"Waiting for Ethereum RPC at {rpc_url}: {exc}")

    time.sleep(3)

print(f"Ethereum RPC did not become ready within 120 seconds: {rpc_url}", file=sys.stderr)
sys.exit(1)
PY

until python deploy_contract.py; do
  status="$?"
  echo "Contract deployment failed with exit code ${status}. Retrying in 3 seconds."
  sleep 3
done

mkdir -p /shared/deployments
cp build/HydrigoAnchor.deploy.json /shared/deployments/HydrigoAnchor.deploy.json

echo "Contract deployment artifact copied to shared volume"
