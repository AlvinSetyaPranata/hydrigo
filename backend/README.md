# Hydrigo Backend

Backend Django untuk menerima data IoT tanaman selada, mencatat transaksi ingest ke database, membentuk ledger hash-chain, lalu menyiapkan anchor ke Ethereum.

## Fitur

- Endpoint ingest data sensor dari device IoT.
- Setiap request ingest dibuat sebagai transaksi yang bisa dilacak statusnya.
- Penyimpanan data ke SQLite lokal.
- Setiap data sensor otomatis dibuatkan blok dengan `previous_hash`, `payload_hash`, dan `block_hash`.
- Endpoint untuk melihat data terbaru dan memverifikasi integritas chain.
- Endpoint untuk mengirim hash block ke smart contract Ethereum.

## Jalankan

Jalankan migrasi dulu:

```bash
./bin/python manage.py migrate
```

Lalu nyalakan server Django:

```bash
./bin/python manage.py runserver
```

Server akan berjalan di `http://127.0.0.1:8000`.

## Deployment Script

Untuk deploy backend Django via Docker:

```bash
./scripts/deploy_backend.sh
```

Script ini akan:

- build image backend
- start private chain, contract deployer, backend, dan nginx gateway dari `docker-compose.deploy.yml`
- menjalankan migrasi Django saat container start
- menjalankan `manage.py check`
- start Gunicorn untuk `config.wsgi:application`

Prasyarat:

```bash
cp backend/.env.example backend/.env
```

Gunakan PostgreSQL yang sudah terpasang di server atau di host/database terpisah. Stack Docker ini tidak lagi menjalankan container PostgreSQL sendiri.

Environment variable yang dipakai container:

```bash
HYDRIGO_PORT=8000
HYDRIGO_WORKERS=2
HYDRIGO_TIMEOUT=120
HYDRIGO_DB_ENGINE=postgres
POSTGRES_DB=hydrigo
POSTGRES_USER=hydrigo
POSTGRES_PASSWORD=change_me
POSTGRES_HOST=YOUR_POSTGRES_HOST
POSTGRES_PORT=5432
ETH_RPC_URL=http://chain:8545
ETH_CHAIN_ID=31337
```

Untuk deploy gabungan backend + MQTT broker tanpa frontend container:

```bash
./scripts/deploy_full_stack.sh
```

## Production Requirements

Image backend memakai `requirements-prod.txt`. File ini sengaja lebih kecil dari `requirements.txt` dan hanya memuat dependency yang benar-benar dipakai oleh:

- Django app
- Gunicorn
- helper Ethereum anchor/deploy contract

`requirements.txt` saat ini berisi banyak package lain yang tidak dibutuhkan untuk menjalankan backend ini di production.

## Research Stack

Deploy path saat ini ditujukan untuk research/self-hosted mode:

- private EVM chain dijalankan lokal via Docker
- contract `HydrigoAnchor` dideploy otomatis ke chain itu
- backend membaca artifact deploy dan memakai contract address tersebut bila `ETH_CONTRACT_ADDRESS` kosong
- PostgreSQL dipakai sebagai database utama Django dan diasumsikan dikelola di luar container stack ini
- nginx menjadi entrypoint tunggal untuk HTTP dan MQTT WebSocket
- MQTT TCP tetap tersedia langsung di port `1883`

## Endpoint

### Health check

```bash
curl http://127.0.0.1:8000/health
```

### Kirim data IoT

```bash
curl -X POST http://127.0.0.1:8000/api/v1/iot/readings \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "esp32-selada-01",
    "lettuce_bed_id": "bed-a1",
    "temperature_c": 24.6,
    "humidity_pct": 77.2,
    "ph": 6.4,
    "tds_ppm": 812,
    "water_level_pct": 68,
    "light_lux": 14200,
    "recorded_at": "2026-04-19T04:00:00Z",
    "signature": "opsional-device-signature"
  }'
```

### Lihat data terbaru

```bash
curl "http://127.0.0.1:8000/api/v1/readings?limit=10"
```

### Lihat daftar transaksi ingest

```bash
curl "http://127.0.0.1:8000/api/v1/transactions?limit=10"
```

### Lihat detail transaksi tertentu

```bash
curl "http://127.0.0.1:8000/api/v1/transactions/txn-xxxxxxxxxxxxxxxx"
```

### Lihat blockchain ledger

```bash
curl http://127.0.0.1:8000/api/v1/blockchain/chain
```

### Anchor block terbaru ke Ethereum

Atur dulu environment berikut:

```bash
export ETH_RPC_URL="https://sepolia.infura.io/v3/PROJECT_ID"
export ETH_CHAIN_ID=11155111
export ETH_CONTRACT_ADDRESS="0xYourContractAddress"
export ETH_PRIVATE_KEY="0xYourPrivateKey"
```

Lalu kirim anchor:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/blockchain/anchor/latest
```

Atau anchor block tertentu:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/blockchain/anchor/0
```

Riwayat anchor yang sudah sukses:

```bash
curl http://127.0.0.1:8000/api/v1/blockchain/anchors
```

## Smart contract

Source contract tersedia di [contracts/HydrigoAnchor.sol](./contracts/HydrigoAnchor.sol) dan ABI di [contracts/HydrigoAnchor.abi.json](./contracts/HydrigoAnchor.abi.json).

Contract ini menyimpan:

- `offchainBlockIndex`
- `readingId`
- `payloadHash`
- `blockHash`
- metadata device dan bed selada
- alamat wallet pengirim anchor

Contract didesain untuk satu kali anchor per `offchainBlockIndex`.

## Deploy contract

Template env tersedia di [.env.example](./.env.example).

1. Isi `ETH_RPC_URL`, `ETH_CHAIN_ID`, `ETH_PRIVATE_KEY`, dan opsional `ETH_WALLET_ADDRESS`.
2. Jalankan deploy script:

```bash
./bin/python deploy_contract.py
```

3. Setelah sukses, alamat contract akan tersimpan di `build/HydrigoAnchor.deploy.json`.
4. Isi `ETH_CONTRACT_ADDRESS` dengan alamat hasil deploy itu.
5. Jalankan backend, lalu mulai anchor block dari endpoint API.

Jika ingin target jaringan:

- Sepolia gunakan `ETH_CHAIN_ID=11155111`
- Polygon Amoy gunakan `ETH_CHAIN_ID=80002`

Script deploy akan:

- mengunduh `solc 0.8.24` bila belum ada,
- compile `contracts/HydrigoAnchor.sol`,
- deploy contract ke RPC yang Anda pilih,
- menyimpan artifact deploy ke folder `build/`.

## Struktur Django

- `iot/models.py`: model transaksi ingest, sensor reading, ledger block, dan anchor on-chain
- `iot/services.py`: validasi payload, pembentukan `transaction_id`, penyimpanan transaksi, dan pembentukan block
- `iot/views.py`: endpoint JSON untuk ingest, transaksi, readings, health check, dan chain
- `iot/urls.py`: routing API

## Catatan arsitektur

Arsitektur sekarang terdiri dari dua lapis:

- transaksi ingest:
  request masuk, payload divalidasi, dibuat `transaction_id`, lalu status bergerak dari `received` -> `validated` -> `stored`
- penyimpanan data:
  data sensor disimpan ke tabel `sensor_readings` dan dihubungkan ke `transaction_id`
- ledger integritas:
  setiap sensor reading dibuat block hash-chain untuk audit lokal
- anchor on-chain:
  block yang sudah tersimpan bisa dikirim ke Ethereum

Tahap berikutnya yang layak:

1. Deploy contract ke Sepolia atau Polygon Amoy.
2. Simpan private key relayer di secret manager, bukan `.env` biasa.
3. Tanda tangani payload dari device atau gateway.
4. Tambahkan worker queue agar ingest sensor tidak tertahan proses transaksi on-chain.
