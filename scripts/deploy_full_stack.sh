#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_SCRIPT="$SCRIPT_DIR/deploy_backend.sh"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.deploy.yml}"

DEPLOY_BACKEND="${DEPLOY_BACKEND:-1}"
DEPLOY_MQTT="${DEPLOY_MQTT:-1}"

ensure_backend_script() {
  if [[ ! -x "$BACKEND_SCRIPT" ]]; then
    echo "Backend deploy script is missing or not executable: $BACKEND_SCRIPT"
    exit 1
  fi
}

deploy_backend() {
  ensure_backend_script

  echo "Deploying Django backend"
  "$BACKEND_SCRIPT"
}

deploy_mqtt() {
  echo "Deploying MQTT broker and nginx gateway"
  docker compose -f "$COMPOSE_FILE" up -d mosquitto nginx
}

echo "Hydrigo full deployment started"

if [[ "$DEPLOY_BACKEND" == "1" ]]; then
  deploy_backend
fi

if [[ "$DEPLOY_MQTT" == "1" ]]; then
  deploy_mqtt
fi

echo "Hydrigo full deployment finished"
echo "Backend: ${DEPLOY_BACKEND}"
echo "MQTT: ${DEPLOY_MQTT}"
