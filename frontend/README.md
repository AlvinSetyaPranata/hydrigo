# Hydrigo

Dashboard monitoring dan kontrol manual untuk budidaya selada hidroponik dengan arsitektur:

`IoT MQTT -> Broker -> API Forwarder -> Backend API`

## Local Development

```bash
npm install
npm run dev
```

Frontend akan memakai broker MQTT dari `VITE_MQTT_BROKER_URL`. Jika tidak diisi, default-nya memakai endpoint yang sama host, yaitu `/mqtt`.
Frontend akan memakai backend API dari `VITE_API_BASE_URL`. Jika tidak diisi, default-nya memakai endpoint yang sama host, yaitu `/api`.

## System Flow

1. IoT device publish payload ke topic MQTT `hydrigo/lettuce/sensor`
2. Service `api` subscribe topic tersebut dan forward JSON ke backend API
3. Backend API memproses ingest sensor
4. Frontend tetap bisa memakai MQTT untuk kontrol manual realtime

## Docker Deployment

Stack ini cocok untuk baseline deploy:

- `frontend`: React build static + Nginx
- `api`: HTTP ingest service untuk device IoT
- `redis`: queue broker
- `chain`: local EVM node via Hardhat
- `contracts-deployer`: deploy smart contract ke local chain
- `worker`: consumer queue + relayer ke blockchain + writer ke database
- `postgres`: penyimpanan hasil transaksi smart contract
- `postgres`: penyimpanan hasil transaksi smart contract dan fixture dashboard
- `mosquitto`: self-hosted MQTT broker

Browser tidak konek langsung ke port WebSocket Mosquitto. Nginx mem-proxy `/mqtt` ke Mosquitto WebSocket listener, jadi frontend cukup memakai:

Biarkan `VITE_MQTT_BROKER_URL` kosong jika frontend dan MQTT reverse proxy ada di host yang sama.

Di production dengan HTTPS, gunakan:

```env
VITE_MQTT_BROKER_URL=wss://domain-anda.com/mqtt
```

## Run With Docker Compose

1. Buat file `.env`

```env
APP_PORT=80
API_PORT=3001
MQTT_PORT=1883
POSTGRES_PORT=5432
CHAIN_PORT=8545
VITE_API_BASE_URL=
VITE_MQTT_BROKER_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=
VITE_MQTT_CLIENT_ID=hydrigo-dashboard
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

2. Jalankan:

```bash
docker compose up -d --build
```

3. Akses aplikasi:

- Dashboard: `http://IP-VPS/`
- MQTT sensor topic: `hydrigo/lettuce/sensor`
- MQTT TCP: `tcp://IP-VPS:1883`
- MQTT WebSocket via reverse proxy: `ws://IP-VPS/mqtt`
- PostgreSQL: `postgresql://hydrigo:hydrigo@IP-VPS:5432/hydrigo`
- Local EVM RPC: `http://IP-VPS:8545`

## Example IoT Payload

```bash
curl -X POST http://localhost:3001/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "lettuce-rack-a1",
    "timestamp": "2026-04-19T10:20:00Z",
    "ph": 6.1,
    "ec": 1.4,
    "waterTemp": 23.8,
    "humidity": 74
  }'
```

## Example Dashboard Query

```bash
curl http://localhost:3001/dashboard
```

Jika frontend dan backend tidak berada pada host yang sama, isi:

```env
VITE_API_BASE_URL=https://api.domain-anda.com
```

## Files

- [docker-compose.yml](./docker-compose.yml)
- [Dockerfile](./Dockerfile)
- [api/src/index.js](./api/src/index.js)
- [worker/src/index.js](./worker/src/index.js)
- [contracts/contracts/SensorRegistry.sol](./contracts/contracts/SensorRegistry.sol)
- [docker/nginx/default.conf](./docker/nginx/default.conf)
- [docker/mosquitto/mosquitto.conf](./docker/mosquitto/mosquitto.conf)
- [docker/db/init.sql](./docker/db/init.sql)
- [.env.example](./.env.example)

## Important Notes

- Konfigurasi Mosquitto saat ini memakai `allow_anonymous true` agar setup awal ringan dan cepat.
- Local blockchain saat ini memakai Hardhat node untuk baseline integration, bukan Ethereum mainnet.
- Worker hanya menyimpan ke PostgreSQL setelah transaction receipt diterima.
- Untuk VPS publik, sebaiknya next step adalah menambahkan auth MQTT dan TLS.
- Untuk browser production, lebih aman pakai `wss://` di belakang reverse proxy HTTPS.
- VPS `1 vCPU / 1 GB RAM` cukup untuk baseline dev/small load, tapi stack lengkap ini mulai padat. Untuk production serius, pisahkan chain atau gunakan chain eksternal.
