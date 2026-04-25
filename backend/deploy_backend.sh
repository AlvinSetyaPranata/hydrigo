#!/usr/bin/env bash

set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${VENV_DIR:-$BASE_DIR/.venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
REQUIREMENTS_FILE="${REQUIREMENTS_FILE:-$BASE_DIR/requirements-prod.txt}"
HOST="${HYDRIGO_HOST:-0.0.0.0}"
PORT="${HYDRIGO_PORT:-8000}"
WORKERS="${HYDRIGO_WORKERS:-2}"
TIMEOUT="${HYDRIGO_TIMEOUT:-120}"
LOG_DIR="${HYDRIGO_LOG_DIR:-$BASE_DIR/logs}"
RUN_DIR="${HYDRIGO_RUN_DIR:-$BASE_DIR/run}"
PID_FILE="$RUN_DIR/gunicorn.pid"
ACCESS_LOG="$LOG_DIR/gunicorn-access.log"
ERROR_LOG="$LOG_DIR/gunicorn-error.log"

if [[ -f "$BASE_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$BASE_DIR/.env"
  set +a
fi

mkdir -p "$LOG_DIR" "$RUN_DIR"

if [[ ! -d "$VENV_DIR" ]]; then
  echo "Creating virtualenv at $VENV_DIR"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "source $VENV_DIR/bin/activate"

echo "Upgrading pip"
python -m pip install --upgrade pip

if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo "Requirements file not found: $REQUIREMENTS_FILE"
  exit 1
fi

echo "Installing backend requirements from $REQUIREMENTS_FILE"
pip install -r "$REQUIREMENTS_FILE"

echo "Running Django migrations"
python "$BASE_DIR/manage.py" migrate --noinput

echo "Checking Django configuration"
python "$BASE_DIR/manage.py" check

if [[ -f "$PID_FILE" ]]; then
  OLD_PID="$(cat "$PID_FILE")"
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing gunicorn process $OLD_PID"
    kill "$OLD_PID"
    sleep 2
  fi
  rm -f "$PID_FILE"
fi

echo "Starting gunicorn on ${HOST}:${PORT}"
nohup gunicorn \
  --bind "${HOST}:${PORT}" \
  --workers "$WORKERS" \
  --timeout "$TIMEOUT" \
  --pid "$PID_FILE" \
  --access-logfile "$ACCESS_LOG" \
  --error-logfile "$ERROR_LOG" \
  config.wsgi:application >/dev/null 2>&1 &

sleep 2

if [[ ! -f "$PID_FILE" ]]; then
  echo "Gunicorn failed to start. Check $ERROR_LOG"
  exit 1
fi

echo "Backend deployed"
echo "PID: $(cat "$PID_FILE")"
echo "Access log: $ACCESS_LOG"
echo "Error log: $ERROR_LOG"
