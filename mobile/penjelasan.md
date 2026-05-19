# Penjelasan Project Hydrigo Mobile

## 1. Gambaran Umum

Project ini adalah aplikasi mobile berbasis **Expo + React Native + Expo Router** untuk sistem **Hydrigo**, yaitu sistem monitoring dan kontrol budidaya **selada hidroponik**. Aplikasi ini berfungsi sebagai klien mobile yang terhubung ke backend untuk:

- membaca data dashboard greenhouse,
- menerima pembaruan realtime dari broker MQTT,
- mengirim perintah kontrol perangkat,
- membaca data ledger blockchain dari backend terpisah.

Secara singkat, aplikasi ini bukan sistem yang berdiri sendiri. Mobile hanya menjadi **antarmuka operator** yang mengambil data dari backend API, menerima event realtime dari MQTT, lalu menampilkan data tersebut dalam bentuk dashboard, kontrol, dan riwayat blockchain.

---

## 2. Teknologi yang Digunakan

Berdasarkan `package.json`, stack utama project ini adalah:

- **Expo** untuk runtime dan tooling aplikasi mobile.
- **React Native** untuk UI native cross-platform.
- **Expo Router** untuk navigasi berbasis file.
- **React Navigation** untuk fondasi tab navigation.
- **MQTT.js** untuk komunikasi realtime melalui broker MQTT.
- **TypeScript** untuk pengetikan data dan struktur kode.

Artinya, project ini dirancang agar bisa dijalankan di Android, iOS, dan web, tetapi fokus implementasinya jelas ke pengalaman mobile operator lapangan.

---

## 3. Struktur Project

Struktur file penting:

- `app/_layout.tsx`
  Mengatur root navigation.
- `app/(tabs)/_layout.tsx`
  Mendefinisikan tiga tab utama aplikasi.
- `app/(tabs)/index.tsx`
  Halaman dashboard monitoring.
- `app/(tabs)/explore.tsx`
  Halaman kontrol perangkat dan mode nutrisi.
- `app/(tabs)/blockchain.tsx`
  Halaman pembacaan ledger blockchain.
- `app/modal.tsx`
  Modal panduan singkat budidaya selada.
- `lib/api.ts`
  Seluruh komunikasi HTTP ke backend.
- `lib/mqttClient.ts`
  Seluruh komunikasi realtime MQTT.
- `.env.example`
  Konfigurasi environment URL backend dan broker.

Pola arsitekturnya cukup bersih: file di `app/` fokus ke tampilan dan interaksi layar, sedangkan file di `lib/` fokus ke integrasi jaringan.

---

## 4. Navigasi dan Susunan Halaman

Project memakai pola **file-based routing** dari Expo Router.

### Root layout

Di `app/_layout.tsx`, aplikasi dibungkus oleh `ThemeProvider` dan memiliki dua layer navigasi:

- stack untuk `(tabs)` sebagai halaman utama,
- stack untuk `modal` sebagai halaman tambahan.

### Tab utama

Di `app/(tabs)/_layout.tsx`, ada tiga tab:

- **Dashboard**
- **Kontrol**
- **Blockchain**

Ini menunjukkan aplikasi dibagi menjadi tiga fungsi operasional utama:

1. melihat kondisi greenhouse,
2. mengendalikan perangkat,
3. memeriksa jejak pencatatan data ledger.

---

## 5. Fitur-Fitur Utama

## 5.1 Dashboard Monitoring

Halaman ini ada di `app/(tabs)/index.tsx`.

Fungsi utamanya:

- mengambil data dashboard dari endpoint `/dashboard`,
- menampilkan status koneksi API,
- menampilkan status koneksi MQTT,
- menampilkan snapshot sensor terbaru,
- menampilkan ringkasan statistik,
- menampilkan daftar rak/bed selada,
- menampilkan agenda dan aktivitas terbaru.

### Data yang ditampilkan

Berdasarkan tipe `DashboardData` di `lib/api.ts`, dashboard memuat:

- `summaryCards`
  Ringkasan angka penting.
- `heroStats`
  Statistik utama untuk area hero.
- `sensorSnapshot`
  Nilai sensor cepat: `ph`, `waterTemp`, `humidity`.
- `lettuceBeds`
  Informasi detail tiap bed selada.
- `activities`
  Aktivitas operasional terbaru.
- `schedule`
  Jadwal pekerjaan harian.
- `chartBars`
  Data chart, walaupun pada kode halaman ini belum tampak dipakai secara visual.
- `manualControls`
  Status kontrol manual yang juga dipakai di tab kontrol.
- `nutrientMode`
  Mode nutrisi aktif.

### Cara kerja dashboard

Saat layar dibuka:

1. aplikasi memanggil `fetchDashboard()`,
2. backend mengirim payload dashboard,
3. state React diisi dengan data tersebut,
4. UI dirender ulang sesuai data terbaru.

Selain polling manual lewat refresh, dashboard juga membuka koneksi MQTT untuk menerima update realtime.

### Update realtime di dashboard

Dashboard subscribe ke dua topic:

- `hydrigo/lettuce/sensor`
- `hydrigo/lettuce/status`

Jika ada pesan baru:

- topic sensor akan memperbarui `ph`, `waterTemp`, dan `humidity`,
- topic status akan memperbarui `nutrientMode` dan `manualControls`.

Jadi dashboard bekerja dengan model gabungan:

- **HTTP API** untuk initial load,
- **MQTT** untuk pembaruan realtime setelah halaman aktif.

Ini adalah pola yang tepat untuk aplikasi monitoring, karena initial state tetap sinkron dari backend, lalu update kecil bisa dikirim lebih ringan lewat broker realtime.

---

## 5.2 Kontrol Perangkat

Halaman ini ada di `app/(tabs)/explore.tsx`.

Fungsi utamanya:

- mengambil status kontrol terkini dari backend,
- menampilkan daftar kontrol manual,
- mengaktifkan atau menonaktifkan perangkat melalui switch,
- mengganti mode nutrisi,
- mengirim notifikasi kontrol ke MQTT setelah backend berhasil diperbarui.

### Kontrol manual

Setiap item kontrol memiliki struktur:

- `id`
- `name`
- `description`
- `status`

Contohnya secara konsep bisa berupa pompa, lampu, sirkulasi, atau perangkat otomatis lain, walaupun nama spesifik perangkat tergantung data dari backend.

### Cara kerja toggle kontrol

Saat user menekan switch:

1. aplikasi menentukan status baru, misalnya dari `false` menjadi `true`,
2. aplikasi memanggil endpoint `POST /controls/manual`,
3. backend menyimpan perubahan,
4. backend mengembalikan daftar kontrol terbaru,
5. state mobile diperbarui,
6. mobile mem-publish event ke topic MQTT `hydrigo/lettuce/control`.

Payload MQTT yang dikirim berbentuk konsep seperti:

```json
{
  "type": "manual_control",
  "target": "id-kontrol",
  "value": true
}
```

Urutannya penting: mobile tidak langsung mengubah sistem hanya lewat MQTT, tetapi tetap menjadikan **backend API sebagai sumber kebenaran utama**. Setelah backend menerima perubahan, baru event MQTT dipublish sebagai sinyal realtime.

### Mode nutrisi

Mode nutrisi yang disediakan di kode:

- `Semai`
- `Vegetatif`
- `Finishing`

Saat user memilih mode:

1. aplikasi memanggil `POST /controls/nutrient-mode`,
2. backend mengembalikan mode yang aktif,
3. state diperbarui,
4. mobile mem-publish event MQTT:

```json
{
  "type": "nutrient_mode",
  "value": "Vegetatif"
}
```

### Realtime sync di tab kontrol

Halaman kontrol juga subscribe ke topic `hydrigo/lettuce/status`.

Artinya, jika perubahan kontrol datang dari sumber lain, misalnya web dashboard atau service backend, tab mobile tetap bisa menerima status terbaru tanpa harus reload manual.

---

## 5.3 Halaman Blockchain

Halaman ini ada di `app/(tabs)/blockchain.tsx`.

Fungsi utamanya:

- mengambil data chain blockchain dari backend ledger,
- menampilkan jumlah block,
- menampilkan status validasi chain,
- menampilkan daftar block terbaru,
- menampilkan detail block yang dipilih.

### Data block yang ditampilkan

Struktur block di `lib/api.ts` terdiri dari:

- `block_index`
- `reading_id`
- `transaction_id`
- `device_id`
- `lettuce_bed_id`
- `payload_hash`
- `previous_hash`
- `block_hash`
- `created_at`

Selain daftar block, backend juga mengirim:

- `verification.valid`
- `verification.reason`

### Fungsi halaman blockchain

Tab ini lebih tepat disebut **viewer ledger blockchain** daripada blockchain engine. Aplikasi mobile:

- tidak membuat block,
- tidak menghitung hash,
- tidak memverifikasi chain secara kriptografis di sisi client,
- tidak menjalankan konsensus,
- tidak menyimpan blockchain lokal.

Mobile hanya:

1. memanggil endpoint `/api/v1/blockchain/chain`,
2. menerima daftar block,
3. menerima hasil verifikasi dari backend,
4. menampilkan block dalam urutan terbaru,
5. menampilkan detail block yang dipilih user.

Ini penting karena istilah “blockchain” sering dianggap berarti seluruh proses ada di aplikasi. Pada project ini, implementasi blockchain **berada di backend**, sedangkan mobile hanya menjadi **pembaca dan visualizer**.

---

## 5.4 Modal Panduan Selada

Halaman `app/modal.tsx` adalah fitur pendukung berupa panduan singkat budidaya selada.

Isinya:

- rentang aman pH,
- suhu air,
- kelembapan,
- EC,
- gejala daun pucat,
- gejala akar menguning.

Fitur ini bukan bagian inti integrasi sistem, tetapi membantu operator memahami konteks agronomi dari data yang sedang dipantau.

---

## 6. Cara Kerja Integrasi API

Seluruh panggilan HTTP dikumpulkan di `lib/api.ts`.

### Base URL

Ada dua base URL utama:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_LEDGER_API_BASE_URL`

Jika tidak diisi, kode memakai default:

- `http://109.110.188.181`

Ini berarti aplikasi secara default diarahkan ke server VPS tertentu.

### Endpoint yang dipakai

Endpoint yang benar-benar dipanggil mobile:

- `GET /dashboard`
- `POST /controls/manual`
- `POST /controls/nutrient-mode`
- `GET /api/v1/blockchain/chain`

### Peran `lib/api.ts`

File ini bertanggung jawab untuk:

- menyusun URL endpoint,
- melakukan request `fetch`,
- parsing JSON response,
- validasi bentuk respons dasar,
- melempar error jika backend gagal mengembalikan data valid.

Dengan pola ini, file UI tidak perlu tahu detail URL dan struktur respons mentah, karena semua dirapikan di layer API.

---

## 7. Cara Kerja MQTT

Integrasi MQTT berada di `lib/mqttClient.ts`.

### Topic yang digunakan

Project ini mendefinisikan tiga topic utama:

- `hydrigo/lettuce/control`
- `hydrigo/lettuce/sensor`
- `hydrigo/lettuce/status`

### Fungsi masing-masing topic

- `sensor`
  Untuk data sensor realtime seperti pH, suhu air, dan kelembapan.
- `status`
  Untuk sinkronisasi status kontrol dan mode nutrisi.
- `control`
  Untuk publikasi perintah kontrol dari aplikasi.

### Cara koneksi broker dibangun

Broker URL dibaca dari:

- `EXPO_PUBLIC_MQTT_BROKER_URL`

Jika tidak diisi, sistem mencoba menurunkan broker URL dari host API, lalu membentuk:

- `ws://<host>/mqtt`

Koneksi memakai WebSocket MQTT dengan opsi:

- `clean: true`
- `reconnectPeriod: 3000`
- `connectTimeout: 5000`

Artinya, koneksi akan mencoba reconnect otomatis setiap 3 detik jika putus.

### Pola subscribe

Fungsi `subscribeTopic()`:

1. mengambil singleton client MQTT,
2. subscribe ke topic,
3. memasang listener `message`,
4. mengembalikan fungsi cleanup untuk unsubscribe.

### Pola publish

Fungsi `publishTopic()`:

1. mengambil client MQTT,
2. mengubah payload menjadi JSON string,
3. mengirim payload ke topic tujuan.

### Catatan desain

MQTT di sini berperan sebagai jalur **event realtime**, bukan sumber data utama. Sumber data utama tetap backend API. Ini desain yang masuk akal karena:

- backend menjaga state resmi,
- MQTT mempercepat propagasi update,
- mobile tidak perlu menebak state final perangkat hanya dari pesan event.

---

## 8. Penjelasan Blockchain pada Project Ini

Bagian ini perlu dijelaskan hati-hati supaya tidak salah tafsir.

## 8.1 Apa itu blockchain secara konsep

Blockchain adalah struktur data berantai di mana setiap block:

- berisi data transaksi atau catatan,
- memiliki hash block sendiri,
- menyimpan referensi ke hash block sebelumnya.

Jika satu block diubah, maka hash-nya berubah. Karena block berikutnya menyimpan referensi ke hash lama, rantai menjadi tidak cocok. Inilah dasar sifat **tamper-evident**: perubahan ilegal bisa terdeteksi.

Dalam project ini, setiap block tampaknya mewakili catatan pembacaan atau transaksi yang berkaitan dengan perangkat dan bed selada.

## 8.2 Komponen block pada project

Berdasarkan tipe `LedgerBlock`, satu block berisi:

- `block_index`
  Nomor urut block.
- `reading_id`
  ID data pembacaan yang dicatat.
- `transaction_id`
  ID transaksi/catatan.
- `device_id`
  Identitas perangkat sumber data.
- `lettuce_bed_id`
  Bed atau rak selada yang terkait.
- `payload_hash`
  Hash dari isi payload data.
- `previous_hash`
  Hash dari block sebelumnya.
- `block_hash`
  Hash dari block saat ini.
- `created_at`
  Waktu block dibuat.

Secara logika, rantai valid bila:

1. `previous_hash` block saat ini sama dengan `block_hash` block sebelumnya,
2. `block_hash` sesuai hasil hash dari isi block,
3. urutan block konsisten.

## 8.3 Cara kerja blockchain di arsitektur project

Alur kerjanya kemungkinan besar seperti ini:

1. sensor atau sistem backend menghasilkan pembacaan atau transaksi,
2. backend ledger membentuk record blockchain,
3. backend menghitung hash dan mengaitkannya dengan block sebelumnya,
4. backend menyediakan endpoint chain,
5. mobile memanggil endpoint tersebut,
6. mobile menampilkan hasilnya ke user.

Jadi bagian penting seperti:

- hashing,
- pembentukan block,
- penyimpanan chain,
- verifikasi integritas chain,

tidak dilakukan di aplikasi mobile.

## 8.4 Apa yang benar-benar dilakukan mobile terhadap blockchain

Mobile melakukan beberapa hal ini saja:

- fetch chain dari backend,
- membalik urutan block agar yang terbaru tampil dulu,
- memilih block aktif untuk ditampilkan detailnya,
- menampilkan status validasi chain dari backend,
- memendekkan tampilan hash panjang dengan helper `shortHash()`,
- memformat timestamp dengan locale Indonesia.

## 8.5 Apa yang tidak dilakukan mobile

Mobile **tidak** melakukan hal-hal berikut:

- mining,
- proof of work,
- proof of stake,
- distributed consensus,
- peer-to-peer node discovery,
- verifikasi hash mandiri di sisi client,
- append block baru ke chain.

Artinya, kata “blockchain” pada project ini lebih dekat ke **audit ledger terverifikasi di backend**, bukan blockchain publik seperti Bitcoin atau Ethereum.

## 8.6 Nilai praktis blockchain pada sistem ini

Dalam konteks Hydrigo, ledger seperti ini berguna untuk:

- jejak audit pembacaan data,
- pelacakan asal data dari device tertentu,
- pembuktian bahwa catatan tidak mudah diubah diam-diam,
- penelusuran histori per bed selada,
- meningkatkan kepercayaan pada data monitoring.

Untuk sistem pertanian terkontrol, manfaat utamanya bukan mata uang kripto, tetapi **integritas histori data operasional**.

---

## 9. Alur Kerja Sistem End-to-End

Secara umum, alur sistem dapat dijelaskan seperti ini:

### Alur monitoring

1. aplikasi mobile dibuka,
2. dashboard memanggil API `/dashboard`,
3. backend mengirim snapshot data,
4. mobile menampilkan data,
5. mobile subscribe ke MQTT,
6. jika ada update sensor atau status, UI diperbarui realtime.

### Alur kontrol

1. user membuka tab kontrol,
2. mobile memuat status kontrol dari backend,
3. user mengubah switch atau mode nutrisi,
4. mobile mengirim request ke backend,
5. backend menyimpan perubahan,
6. mobile memperbarui state lokal dari respons backend,
7. mobile mem-publish event MQTT agar sistem lain cepat tahu ada perubahan.

### Alur blockchain

1. user membuka tab blockchain,
2. mobile memanggil ledger API,
3. backend mengembalikan chain dan status verifikasi,
4. mobile menampilkan daftar block,
5. user memilih block,
6. mobile menampilkan detail hash dan metadata block.

---

## 10. Kelebihan Arsitektur Project

Project ini punya beberapa keputusan arsitektur yang cukup baik:

- **Pemisahan UI dan network layer**
  File `app/` fokus tampilan, file `lib/` fokus integrasi.
- **API sebagai source of truth**
  State utama tidak bergantung pada UI lokal.
- **MQTT sebagai pelengkap realtime**
  Cocok untuk sensor dan update status cepat.
- **File-based routing**
  Membuat navigasi mudah dilacak.
- **Typed data model**
  Struktur data cukup jelas karena ada TypeScript type.

---

## 11. Batasan dan Catatan Teknis

Dari analisis kode, ada beberapa batasan yang perlu dicatat:

- Verifikasi blockchain tidak dilakukan mandiri di mobile, tetapi dipercaya dari backend.
- Aplikasi default langsung mengarah ke IP VPS tertentu, sehingga deployment masih cukup statis.
- Error handling dasar sudah ada, tetapi belum tampak mekanisme retry cerdas selain refresh manual dan reconnect MQTT.
- `chartBars` sudah didefinisikan di model dashboard tetapi belum terlihat digunakan di halaman dashboard.
- Tidak terlihat lapisan autentikasi user pada project mobile ini.
- Tidak terlihat penyimpanan offline atau cache lokal.

Ini bukan berarti salah, tetapi perlu dipahami agar ekspektasi terhadap project tetap akurat.

---

## 12. Kesimpulan

Hydrigo Mobile adalah aplikasi operator untuk sistem budidaya selada hidroponik yang menggabungkan tiga fungsi utama:

- **monitoring** melalui dashboard,
- **kontrol** melalui API dan MQTT,
- **audit histori** melalui viewer blockchain ledger.

Fitur blockchain pada aplikasi ini bukan blockchain penuh di sisi mobile. Implementasi blockchain yang sebenarnya berada di backend, sedangkan mobile hanya membaca chain, menampilkan detail block, dan menunjukkan hasil validasi yang dikirim server.

Dengan demikian, peran aplikasi ini adalah:

- menjadi panel operasional mobile,
- menjaga sinkronisasi data dengan backend,
- menerima update realtime,
- dan menyediakan visibilitas terhadap histori ledger yang dianggap penting untuk integritas data sistem.

Jika dijelaskan dalam satu kalimat: project ini adalah **mobile client untuk monitoring, controlling, dan viewing blockchain ledger pada sistem hidroponik selada Hydrigo**.
