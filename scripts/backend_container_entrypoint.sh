#!/usr/bin/env sh

set -eu

cd /app

if [ "${ETH_CONTRACT_ADDRESS:-}" = "0xYOUR_CONTRACT_ADDRESS" ]; then
  unset ETH_CONTRACT_ADDRESS
fi

if [ -z "${ETH_CONTRACT_ADDRESS:-}" ] && [ -n "${CONTRACT_DEPLOYMENT_FILE:-}" ]; then
  WAIT_SECONDS="${CONTRACT_DEPLOYMENT_WAIT_SECONDS:-90}"
  i=0

  while [ "$i" -lt "$WAIT_SECONDS" ]; do
    if [ -f "$CONTRACT_DEPLOYMENT_FILE" ]; then
      CONTRACT_ADDRESS="$(python - <<'PY'
import json
import os

path = os.environ["CONTRACT_DEPLOYMENT_FILE"]
with open(path, "r", encoding="utf-8") as fh:
    data = json.load(fh)
print(data.get("contract_address", ""))
PY
)"

      if [ -n "$CONTRACT_ADDRESS" ]; then
        export ETH_CONTRACT_ADDRESS="$CONTRACT_ADDRESS"
        break
      fi
    fi

    i=$((i + 1))
    sleep 1
  done
fi

python manage.py migrate --noinput
python manage.py check

exec gunicorn \
  --bind "0.0.0.0:${HYDRIGO_PORT:-8000}" \
  --workers "${HYDRIGO_WORKERS:-2}" \
  --timeout "${HYDRIGO_TIMEOUT:-120}" \
  config.wsgi:application
