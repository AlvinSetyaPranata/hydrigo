#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.deploy.yml}"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-$ROOT_DIR/backend/.env}"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE"
  exit 1
fi

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "Missing backend env file: $BACKEND_ENV_FILE"
  echo "Create it from backend/.env.example first."
  exit 1
fi

echo "Deploying Dockerized backend"
docker compose -f "$COMPOSE_FILE" up -d --build chain contract-deployer backend

echo "Backend container deployed"
docker compose -f "$COMPOSE_FILE" ps chain contract-deployer backend
