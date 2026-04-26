#!/usr/bin/env sh

set -eu

cd /app

python manage.py migrate --noinput
python manage.py check

exec gunicorn \
  --bind "0.0.0.0:${HYDRIGO_PORT:-8000}" \
  --workers "${HYDRIGO_WORKERS:-2}" \
  --timeout "${HYDRIGO_TIMEOUT:-120}" \
  config.wsgi:application
