FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements-prod.txt /tmp/requirements-prod.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements-prod.txt

COPY backend /app
COPY scripts/backend_container_entrypoint.sh /entrypoint.sh
COPY scripts/contract_deployer_entrypoint.sh /contract-deployer-entrypoint.sh

RUN chmod +x /entrypoint.sh /contract-deployer-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
