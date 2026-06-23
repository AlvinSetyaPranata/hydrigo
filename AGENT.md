# AGENT.md

## Overview

Hydrigo is a small monorepo centered on a shared Django backend with multiple API domains behind one deployment:

- `backend/`: primary Django backend. It now contains two apps:
  - `iot`: hydroponics ingest plus local blockchain ledger and Ethereum anchor flow
  - `drip`: drip-irrigation API for schedules, farm summary, history, and profile
- `frontend/`: Vite dashboard plus a separate Node API, BullMQ worker, Hardhat contracts, and Docker Compose stack for an alternate/local architecture
- `mobile/`: Expo Router mobile app
- `mfarm/`: Expo app for the drip system UI. Treat it as client-side/product reference; the deployed drip backend now lives inside `backend/drip/`, not under `mfarm/`.

The repository mixes active source code with checked-in generated artifacts and local environment state. Read the layout section before editing.

## Repository Layout

### `backend/`

Primary implementation:

- `config/`: Django settings and root URL config.
- `iot/models.py`: hydroponics persistent models for readings, ingest transactions, ledger blocks, and on-chain anchors.
- `iot/services.py`: hydroponics payload validation, transaction creation, ledger hashing, serialization, and chain verification.
- `iot/views.py`: hydroponics JSON API endpoints.
- `iot/urls.py`: hydroponics routes.
- `drip/models.py`: drip schedule and profile models.
- `drip/views.py`: drip JSON API endpoints.
- `drip/urls.py`: drip routes.
- `manage.py`: Django entrypoint.

Current route split inside Django:

- `/api/hydroponics/...` -> `iot` app
- `/api/drip/...` -> `drip` app

Legacy compatibility note:

- `config/urls.py` still also mounts `iot.urls` at root, so old hydroponics endpoints such as `/api/v1/...` still resolve. New work should prefer the namespaced `/api/hydroponics/...` paths unless the task is explicitly about backwards compatibility.

Also present:

- `app.py`: separate standalone HTTP server implementation with overlapping business logic.
- `test_app.py`: tests for `app.py`, not for the Django app.
- `eth_anchor.py`, `deploy_contract.py`, `contracts/`: Ethereum anchoring and contract deployment helpers.
- `db.sqlite3`, `hydrigo.db`: local SQLite databases.
- `bin/`, `lib/`, `pyvenv.cfg`: checked-in Python virtualenv content.

Important:

- The deployed/shared backend is the Django app.
- `backend/app.py` is still present as a separate standalone implementation with overlapping hydroponics logic. Treat it as parallel code, not the primary deployment target.
- Django tests now cover both `iot` and `drip`, while standalone tests still cover `backend/app.py`.

### `frontend/`

Main dashboard:

- `src/`: React/Vite dashboard UI.
- `src/lib/api.js`: API base URL helpers.
- `src/lib/mqttClient.js`: MQTT client lifecycle and topic helpers.

Supporting services under the same folder:

- `api/src/index.js`: Express ingest/dashboard API backed by Redis and PostgreSQL, and now also acts as an MQTT-to-API forwarder for device telemetry.
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

### `mfarm/`

- Expo client for the drip system.
- Its API expectations are useful reference when editing `backend/drip/`.
- Do not place deployed backend logic here; that backend has been merged into Django.

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

Run Django tests for both apps:

```bash
cd backend
./bin/python manage.py test iot drip
```

Run standalone backend tests:

```bash
cd backend
./bin/python -m unittest test_app.py
```

Status: Django `iot` and `drip` tests plus standalone `test_app.py` passed in this checkout as of April 29, 2026.

### Full Deployment

Repo-level deployment entrypoint:

```bash
./scripts/deploy_full_stack.sh
```

This script:

- deploys Django backend through `scripts/deploy_backend.sh`
- deploys one shared Dockerized backend service, nginx gateway, MQTT broker, and private chain through `docker-compose.deploy.yml`
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

Backend deployment/runtime notes:

- `docker-compose.deploy.yml` runs a single app container named `backend`.
- Nginx forwards HTTP traffic to that one backend service.
- Route separation between hydroponics and drip happens inside Django, not by separate backend containers.
- Current VPS host/IP for deployed access is `109.110.188.181:9000`.

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

- API defaults to `/api/hydroponics`
- MQTT defaults to `/mqtt` on the current host

### Mobile runtime defaults

- Mobile should use VPS host `http://109.110.188.181:9000` as the default base host unless the task explicitly changes environments.
- Hydroponics mobile API requests should target `http://109.110.188.181:9000/api/hydroponics/...`.
- When deriving MQTT from the API base host, prefer the same VPS host unless an explicit broker URL overrides it.

### IoT device runtime defaults

- ESP32/device telemetry is MQTT-first, not direct-to-API.
- Default broker host/IP is `109.110.188.181` on MQTT TCP port `1883`.
- Default device publish topic is `hydrigo/lettuce/sensor`.
- Device control fetch still uses HTTP endpoints under `http://109.110.188.181:9000/api/hydroponics/...` unless the task explicitly changes that design.
- The server-side bridge in `frontend/api/src/index.js` is responsible for forwarding MQTT sensor payloads into the Hydrigo ingest API.

### Current device data flow

- `ESP32 -> MQTT broker topic hydrigo/lettuce/sensor`
- `frontend/api` subscribes to that topic and forwards payloads to `http://109.110.188.181:9000/api/hydroponics/api/v1/iot/readings`
- Django persists the forwarded ingest payload
- Mobile/web clients read state from backend and may also use MQTT separately for UI sync

### Integration reference

Current hydroponics endpoints on the Django backend:

- `GET http://109.110.188.181/api/hydroponics/health`
- `POST http://109.110.188.181/api/hydroponics/api/v1/iot/readings`
- `GET http://109.110.188.181/api/hydroponics/api/v1/readings?limit=20`
- `GET http://109.110.188.181/api/hydroponics/api/v1/blockchain/chain?page=1&limit=10`
- `GET http://109.110.188.181/api/hydroponics/api/v1/controls/manual`
- `POST http://109.110.188.181/api/hydroponics/api/v1/controls/manual`
- `GET http://109.110.188.181/api/hydroponics/api/v1/controls/mode`
- `POST http://109.110.188.181/api/hydroponics/api/v1/controls/mode`

Current MQTT topics:

- Device telemetry publish: `hydrigo/lettuce/sensor`
- UI/device control publish: `hydrigo/lettuce/control`
- Shared status broadcast: `hydrigo/lettuce/status`

Flow scheme:

1. ESP32 builds one telemetry payload containing sensor values, control mode, pump state, and device phase.
2. ESP32 publishes that payload to MQTT topic `hydrigo/lettuce/sensor`.
3. `frontend/api/src/index.js` subscribes to that topic and forwards the same JSON to `POST /api/hydroponics/api/v1/iot/readings`.
4. Django validates and stores the reading, then creates ingest transaction and ledger block records.
5. Mobile/web clients fetch latest readings from the Django API.
6. Mobile/web clients update control state through HTTP control endpoints and may also publish MQTT control/status messages for UI sync.

ESP32 telemetry payload example:

```json
{
  "device_id": "esp32-selada-01",
  "bed_id": "bed-a1",
  "suhu": 30.10,
  "kelembapan": 81.20,
  "suhuAir": 28.90,
  "phValue": 6.42,
  "tdsValue": 812.30,
  "jarak": 4.20,
  "persenAir": 76,
  "statusAir": "NORMAL",
  "controlMode": 1,
  "mode": "MANUAL",
  "manualPumpCommand": true,
  "pump_status": true,
  "pumpState": "ON",
  "pompaStatus": true,
  "perintahPompa": true,
  "devicePhase": "Manual aktif - pompa menyala",
  "prediksiRelay": 1
}
```

MQTT bridge forwarding target:

- Source topic: `hydrigo/lettuce/sensor`
- Forward target: `POST http://109.110.188.181/api/hydroponics/api/v1/iot/readings`

Hydroponics ingest success response example:

```json
{
  "message": "transaksi ingest berhasil disimpan",
  "transaction": {
    "transaction_id": "txn-1234567890abcdef",
    "device_id": "esp32-selada-01",
    "lettuce_bed_id": "bed-a1",
    "status": "stored"
  },
  "reading": {
    "device_id": "esp32-selada-01",
    "lettuce_bed_id": "bed-a1",
    "temperature_c": 28.9,
    "humidity_pct": 81.2,
    "ph": 6.42,
    "tds_ppm": 812.3,
    "pump_status": true,
    "device_phase": "Manual aktif - pompa menyala"
  },
  "ledger": {
    "block_index": 42,
    "device_id": "esp32-selada-01",
    "lettuce_bed_id": "bed-a1"
  }
}
```

Manual control request example:

```json
{
  "controlId": "water-pump",
  "status": true
}
```

Manual control response example:

```json
{
  "data": [
    {
      "id": "water-pump",
      "name": "Pompa Air",
      "description": "Kontrol manual pompa air utama untuk sirkulasi nutrisi.",
      "status": true
    }
  ]
}
```

Control mode request example:

```json
{
  "mode": "manual"
}
```

Control mode response example:

```json
{
  "data": {
    "mode": "manual",
    "selectedMode": "manual",
    "controlMode": 1
  },
  "mode": "manual",
  "selectedMode": "manual",
  "controlMode": 1
}
```

Latest readings response example:

```json
{
  "data": [
    {
      "device_id": "esp32-selada-01",
      "lettuce_bed_id": "bed-a1",
      "temperature_c": 28.9,
      "humidity_pct": 81.2,
      "ph": 6.42,
      "tds_ppm": 812.3,
      "pump_status": true,
      "device_phase": "Auto - mixing nutrisi"
    }
  ],
  "limit": 20,
  "page": 1,
  "total": 1,
  "total_pages": 1
}
```

## Development Guidance

### Preferred edit targets

- For hydroponics backend API changes, update Django files under `backend/iot/` unless the task is explicitly about the standalone server in `backend/app.py`.
- For drip backend API changes, update Django files under `backend/drip/`.
- For dashboard UI changes, edit `frontend/src/`.
- For queue/chain/database pipeline changes in the Docker stack, edit `frontend/api/`, `frontend/worker/`, `frontend/contracts/`, and `frontend/docker/` consistently.
- For mobile work, confirm whether the target is `mobile/` or `mfarm/` before editing. `mfarm/` is the drip client; `mobile/` is a separate Expo app.

### Treat these as generated or local state unless the task explicitly requires them

- `backend/bin/`
- `backend/lib/`
- `backend/__pycache__/`
- `frontend/node_modules/`
- `frontend/dist/`
- `mobile/node_modules/`
- `mobile/.expo/`

### Architecture caveats

- There are two backend implementations with overlapping hydroponics logic: Django in `backend/iot/` and standalone HTTP server logic in `backend/app.py`.
- The drip backend is not a separate service anymore; it is a Django app under `backend/drip/`.
- Hydroponics uses blockchain/ledger logic; drip currently does not use blockchain.
- Frontend README describes a broader Docker architecture than the root repo structure suggests; the full stack is nested inside `frontend/`.
- The mobile app README is generic Expo starter documentation and is not a reliable source of project-specific behavior.
- `mfarm/README.md` historically referred to a backend in `backend/app.py`; that is no longer the deployed drip backend architecture.

## Suggested Verification By Change Type

- Backend standalone server changes: `cd backend && ./bin/python -m unittest test_app.py`
- Django hydroponics or drip changes: `cd backend && ./bin/python manage.py test iot drip`
- Django model changes: run migrations if models changed, then exercise endpoints manually with `manage.py runserver`
- Route/deployment changes: inspect `backend/config/urls.py`, `docker-compose.deploy.yml`, and `docker/nginx/research.conf` together
- Frontend React changes: `cd frontend && npm run lint`
- Docker stack changes: inspect `frontend/docker-compose.yml`, related Dockerfiles, and service env wiring together
- Mobile changes: `cd mobile && npm run lint`
- MFarm client changes: `cd mfarm && npm run lint`

## Working Style

- Prefer small, scoped edits because multiple subsystems live side by side but are not tightly integrated.
- Do not assume README claims are fully implemented; inspect the actual code path first.
- Preserve user changes in checked-in databases, build outputs, and local env files unless explicitly asked to clean them up.
