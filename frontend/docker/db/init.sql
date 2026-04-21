create table if not exists dashboard_fixtures (
  id bigserial primary key,
  slug text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sensor_readings (
  id bigserial primary key,
  device_id text not null,
  recorded_at timestamptz not null,
  ph numeric(8,2) not null,
  ec numeric(8,2) not null,
  water_temp numeric(8,2) not null,
  humidity numeric(8,2) not null,
  tx_hash text not null,
  block_number bigint not null,
  contract_address text not null,
  chain_status text not null default 'confirmed',
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

insert into dashboard_fixtures (slug, payload)
values (
  'main',
  '{
    "summaryCards": [
      { "label": "Selada Aktif", "value": "128", "note": "Bibit sampai siap panen" },
      { "label": "Rata-rata Kesehatan", "value": "91%", "note": "Stabil dalam 24 jam terakhir" },
      { "label": "Tray Siap Panen", "value": "18", "note": "Estimasi panen 2 hari lagi" },
      { "label": "Alert Nutrisi", "value": "01", "note": "Perlu koreksi EC di rak B2" }
    ],
    "heroStats": [
      { "value": "6", "label": "rak selada aktif" },
      { "value": "98.4%", "label": "sensor online" },
      { "value": "22 hari", "label": "siklus rata-rata panen" }
    ],
    "sensorSnapshot": {
      "ph": "6.1",
      "waterTemp": "23.8°C",
      "humidity": "74%"
    },
    "lettuceBeds": [
      {
        "name": "Selada Romaine",
        "zone": "Rak NFT A1",
        "phase": "Umur 18 hari",
        "humidity": "74%",
        "temp": "24°C",
        "ec": "1.4",
        "status": "Optimal",
        "health": 93
      },
      {
        "name": "Selada Butterhead",
        "zone": "Rak NFT B2",
        "phase": "Umur 14 hari",
        "humidity": "71%",
        "temp": "23°C",
        "ec": "1.2",
        "status": "Stabil",
        "health": 88
      },
      {
        "name": "Selada Lollo Rossa",
        "zone": "Rak DWC C1",
        "phase": "Umur 21 hari",
        "humidity": "69%",
        "temp": "25°C",
        "ec": "1.5",
        "status": "Perlu cek",
        "health": 76
      }
    ],
    "activities": [
      { "time": "06:30", "title": "Sirkulasi air aktif", "detail": "Semua jalur NFT selada berjalan normal" },
      { "time": "08:10", "title": "Penyesuaian nutrisi", "detail": "EC rak B2 dinaikkan ke 1.2 untuk fase vegetatif" },
      { "time": "10:45", "title": "Inspeksi daun selada", "detail": "Romaine A1 menunjukkan warna daun merata" },
      { "time": "13:20", "title": "Cek suhu larutan", "detail": "DWC C1 tercatat 25°C dan perlu pemantauan" }
    ],
    "schedule": [
      { "task": "Kalibrasi pH larutan selada", "due": "14:00", "owner": "Rian" },
      { "task": "Tambahkan nutrisi AB mix rak B2", "due": "15:30", "owner": "Salsa" },
      { "task": "Sortir selada siap panen A1", "due": "16:15", "owner": "Tim Panen" }
    ],
    "chartBars": [
      { "label": "Sen", "value": 84 },
      { "label": "Sel", "value": 86 },
      { "label": "Rab", "value": 83 },
      { "label": "Kam", "value": 89 },
      { "label": "Jum", "value": 91 },
      { "label": "Sab", "value": 94 },
      { "label": "Min", "value": 92 }
    ],
    "manualControls": [
      {
        "id": "pump",
        "name": "Pompa NFT",
        "description": "Kontrol aliran larutan utama untuk semua rak selada.",
        "status": true
      },
      {
        "id": "light",
        "name": "Lampu Grow",
        "description": "Aktifkan pencahayaan tambahan saat intensitas rendah.",
        "status": false
      },
      {
        "id": "fan",
        "name": "Sirkulasi Udara",
        "description": "Menjaga suhu dan kelembapan area selada tetap stabil.",
        "status": true
      }
    ],
    "nutrientMode": "Vegetatif"
  }'::jsonb
)
on conflict (slug) do nothing;
