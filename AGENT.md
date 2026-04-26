# AGENT.md

## Overview

Hydrigo is a small monorepo with three distinct apps:

- `backend/`: Django-based ingest and local blockchain ledger API for hydroponic lettuce sensor data.
- `frontend/`: Vite dashboard plus a separate Node API, BullMQ worker, Hardhat contracts, and Docker Compose stack.
- `mobile/`: Expo Router mobile app. It is still close to the Expo starter template.

The repository mixes active source code with checked-in generated artifacts and local environment state. Read the layout section before editing.

## Repository Layout

### `backend/`

Primary implementation:

- `config/`: Django settings and root URL config.
- `iot/models.py`: persistent models for readings, ingest transactions, ledger blocks, and on-chain anchors.
- `iot/services.py`: payload validation, transaction creation, ledger hashing, serialization, and chain verification.
- `iot/views.py`: JSON API endpoints.
- `iot/urls.py`: backend routes.
- `manage.py`: Django entrypoint.

Also present:

- `app.py`: separate standalone HTTP server implementation with overlapping business logic.
- `test_app.py`: tests for `app.py`, not for the Django app.
- `eth_anchor.py`, `deploy_contract.py`, `contracts/`: Ethereum anchoring and contract deployment helpers.
- `db.sqlite3`, `hydrigo.db`: local SQLite databases.
- `bin/`, `lib/`, `pyvenv.cfg`: checked-in Python virtualenv content.

Important: the documented backend in `backend/README.md` points to the Django app, but the automated tests currently cover `backend/app.py`. Treat these as two parallel implementations and avoid assuming they stay in sync automatically.

### `frontend/`

Main dashboard:

- `src/`: React/Vite dashboard UI.
- `src/lib/api.js`: API base URL helpers.
- `src/lib/mqttClient.js`: MQTT client lifecycle and topic helpers.

Supporting services under the same folder:

- `api/src/index.js`: Express ingest/dashboard API backed by Redis and PostgreSQL.
- `worker/src/`: BullMQ worker that writes sensor readings to chain and PostgreSQL.
- `contracts/`: Hardhat project for `SensorRegistry`.
- `docker-compose.yml`: local full-stack environment.
- `docker/`: Dockerfiles, Nginx config, Mosquitto config, and PostgreSQL init SQL.

Generated/vendor state checked into the repo:

- `dist/`
- `node_modules/`

### `mobile/`

- `app/`: Expo Router screens.
- `components/`, `hooks/`, `constants/`: Expo starter support modules.
- `assets/`: app icons and images.

This app appears mostly scaffold-level. Validate current product requirements before making large changes here.

Generated/local state checked into the repo:

- `.expo/`
- `node_modules/`

## Verified Commands

These commands were verified in this checkout:

### Backend

Run Django migrations:

```bash
cd backend
./bin/python manage.py migrate
```

Run Django dev server:

```bash
cd backend
./bin/python manage.py runserver
```

Run standalone backend tests:

```bash
cd backend
./bin/python -m unittest test_app.py
```

Status: passes as of April 25, 2026.

### Full Deployment

Repo-level deployment entrypoint:

```bash
./scripts/deploy_full_stack.sh
```

This script:

- deploys Django backend through `scripts/deploy_backend.sh`
- deploys the Dockerized backend, nginx gateway, MQTT broker, and private chain through `docker-compose.deploy.yml`
- assumes PostgreSQL is provided externally, not by this compose stack

Useful toggles:

```bash
DEPLOY_BACKEND=0 ./scripts/deploy_full_stack.sh
DEPLOY_MQTT=0 ./scripts/deploy_full_stack.sh
```

### Frontend

Install dependencies:

```bash
cd frontend
npm install
```

Run Vite dev server:

```bash
cd frontend
npm run dev
```

Lint:

```bash
cd frontend
npm run lint
```

### Mobile

Install dependencies:

```bash
cd mobile
npm install
```

Start Expo:

```bash
cd mobile
npm start
```

Lint:

```bash
cd mobile
npm run lint
```

## Environment Notes

### Backend env

See `backend/.env.example` for Ethereum anchor settings:

- `ETH_RPC_URL`
- `ETH_CHAIN_ID`
- `ETH_PRIVATE_KEY`
- `ETH_WALLET_ADDRESS`
- `ETH_CONTRACT_ADDRESS`

The Django settings currently hardcode:

- `DEBUG = True`
- `ALLOWED_HOSTS = ["*"]`
- SQLite database in `backend/db.sqlite3`

### Frontend env

See `frontend/.env.example`.

Key variables:

- `VITE_API_BASE_URL`
- `VITE_MQTT_BROKER_URL`
- `VITE_MQTT_USERNAME`
- `VITE_MQTT_PASSWORD`
- `VITE_MQTT_CLIENT_ID`
- `BLOCKCHAIN_PRIVATE_KEY`

Default frontend behavior:

- API defaults to `/api`
- MQTT defaults to `/mqtt` on the current host

## Development Guidance

### Preferred edit targets

- For backend API changes, update Django files under `backend/iot/` unless the task is explicitly about the standalone server in `backend/app.py`.
- For dashboard UI changes, edit `frontend/src/`.
- For queue/chain/database pipeline changes in the Docker stack, edit `frontend/api/`, `frontend/worker/`, `frontend/contracts/`, and `frontend/docker/` consistently.
- For mobile work, confirm whether the screen is real product code or leftover scaffold before investing effort.

### Treat these as generated or local state unless the task explicitly requires them

- `backend/bin/`
- `backend/lib/`
- `backend/__pycache__/`
- `frontend/node_modules/`
- `frontend/dist/`
- `mobile/node_modules/`
- `mobile/.expo/`

### Architecture caveats

- There are two backend implementations with overlapping logic: Django in `backend/iot/` and standalone HTTP server logic in `backend/app.py`.
- Frontend README describes a broader Docker architecture than the root repo structure suggests; the full stack is nested inside `frontend/`.
- Tests currently give better coverage to the standalone backend path than the Django path.
- The mobile app README is generic Expo starter documentation and is not a reliable source of project-specific behavior.

## Suggested Verification By Change Type

- Backend standalone server changes: `cd backend && ./bin/python -m unittest test_app.py`
- Django backend changes: run migrations if models changed, then exercise endpoints manually with `manage.py runserver`
- Frontend React changes: `cd frontend && npm run lint`
- Docker stack changes: inspect `frontend/docker-compose.yml`, related Dockerfiles, and service env wiring together
- Mobile changes: `cd mobile && npm run lint`

## Working Style

- Prefer small, scoped edits because multiple subsystems live side by side but are not tightly integrated.
- Do not assume README claims are fully implemented; inspect the actual code path first.
- Preserve user changes in checked-in databases, build outputs, and local env files unless explicitly asked to clean them up.
