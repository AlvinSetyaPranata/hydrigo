#!/usr/bin/env sh

set -eu

cd /app

echo "Starting contract deployment"
echo "RPC URL: ${ETH_RPC_URL:-unset}"
echo "Chain ID: ${ETH_CHAIN_ID:-unset}"

until python deploy_contract.py; do
  status="$?"
  echo "Contract deployment failed with exit code ${status}. Retrying in 3 seconds."
  sleep 3
done

mkdir -p /shared/deployments
cp build/HydrigoAnchor.deploy.json /shared/deployments/HydrigoAnchor.deploy.json

echo "Contract deployment artifact copied to shared volume"
