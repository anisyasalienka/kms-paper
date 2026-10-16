# Arsitektur & Rencana Implementasi Frontend–n8n KMS
*Email-to-Knowledge Management System dengan Human-in-the-Loop Validation & Lead Monitoring*

**Versi:** 2.1 (Revisi identitas pseudonim, model 2 role, keamanan proxy, dan penanganan status)  
**Tanggal:** 15 Oktober 2026  
**Lokasi Dokumen:** `/home/cendi/kms-paper-nisya/Arsitektur dan Rencana Implementasi Frontend-n8n KMS.md`  
**Referensi Riset:** `Analisis Tematik & Requirement Workflow KMS.md` (FR1–FR8, GR1–GR7, NFR1–NFR4)

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Dokumen ini merupakan cetak biru arsitektur dan rencana teknis implementasi **Frontend Web KMS** berbasis **n8n sebagai backend API headless**. Sistem ini mengintegrasikan ingestion email otomatis, validasi pemilik pengetahuan (*Human-in-the-Loop*), penelusuran semantik ber-sitasi (*Chatbot RAG*), dan ringkasan tata kelola berkala untuk supervisor (*Lead Monitoring*).

Prinsip desain v2.1:

1. **Staging Berbasis n8n Data Tables (Bukan SQLite):** Tidak ada node SQLite di n8n v2.27.3. Data Tables bersifat bawaan, tanpa kontainer atau kredensial tambahan.
2. **Identitas Pseudonim & Model 2 Role:** Tidak ada nama asli informan di sistem. Pengguna diidentifikasi dengan `STAFF-xxx` (validator) dan `SUPERVISOR-xxx` (monitoring), yang dipetakan ke ID samaran `PERSON-xxx` / `TEAM-xxx` pada data sintetis melalui tabel direktori.
3. **Ingest Asynchronous + Polling:** Mencegah *HTTP 524 Gateway Timeout* dari Cloudflare (batas ±100 detik) saat LLM mengekstrak lampiran/GDocs/GSheets yang panjang.
4. **API Key Tidak Pernah Sampai ke Browser:** Frontend memanggil `/api/*` di domain yang sama. nginx meneruskan ke n8n dan menambahkan header `X-KMS-API-KEY` dari sisi server.
5. **Penyaringan Akses Riil di Chatbot (GR4 & GR5):** Filter akses diterapkan secara deterministik di workflow (bukan lewat argumen LLM), berlaku untuk pencarian chunk maupun pengambilan detail.
6. **Otorisasi, Integritas Edit & Idempotensi Validasi:** Hanya PIC pemilik yang boleh memvalidasi. Suntingan di-patch ke `curated_payload` sebelum embedding. Approve dikunci dengan status `approving`.
7. **Deduplikasi 2-Arah:** Memeriksa Qdrant (data approved) dan Data Tables (data yang masih pending/diproses).
8. **Siklus Status Lengkap:** Termasuk `failed`, `skipped`, dan `superseded`, sehingga tidak ada entri yang menggantung dan KPI dashboard akurat.

---

## 2. Analisis & Keputusan Tempat Penyimpanan Staging

### Evaluasi Kritis n8n v2.27.3
Pada runtime n8n yang terpasang (versi 2.27.3 di Docker), **node SQLite bawaan tidak tersedia** (hanya community node Tavily yang aktif). Memaksakan SQLite melalui Code node membutuhkan pengaturan environment khusus (`NODE_FUNCTION_ALLOW_EXTERNAL`) yang rapuh. Selain itu, file SQLite sekunder di `/home/cendi/n8n/data/` berisiko tertukar dengan `database.sqlite` milik sistem n8n sendiri.

### Keputusan: Menggunakan n8n Data Tables
- **Tanpa Konfigurasi & Kredensial Tambahan:** Beroperasi langsung di dalam n8n.
- **Isolasi Penuh dari Qdrant:** Kandidat yang belum di-approve tidak pernah menyentuh Qdrant, sehingga chatbot tidak dapat membaca draf atau data sensitif.
- **Kapasitas Memadai:** Prototipe mengelola puluhan hingga ratusan entri.
- **Agregasi Metrik:** KPI dashboard (GR2) dihitung oleh satu Code node menggunakan JavaScript.

*(Catatan Paper: Jika evaluasi membutuhkan SQL murni, satu kontainer PostgreSQL terisolasi dapat ditambahkan ke docker-compose tanpa mengganggu service lain.)*

---

## 3. Identitas Pengguna & Model Role

### 3.1 Dua Role

| Role | Format ID | Tugas | Halaman UI |
| :--- | :--- | :--- | :--- |
| **Staff** | `STAFF-xxx` | Validator pengetahuan miliknya (approve, edit & approve, reject), mengalihkan kepemilikan miliknya ke staff lain (handover), memakai chatbot. | Ingest, Validasi, Chatbot |
| **Supervisor** | `SUPERVISOR-xxx` | Monitoring tata kelola: KPI, bottleneck, audit log, mengirim nudge, dan menugaskan ulang PIC (reassign) untuk entri yang menggantung. **Tidak** meng-approve atau me-reject. | Monitoring, Chatbot |

Aturan pemisahan tugas (GR1):
- Approve / Edit & Approve / Reject hanya boleh dilakukan oleh staff yang tercatat sebagai `owner_pic` kandidat tersebut.
- Supervisor tidak memvalidasi isi pengetahuan. Jika PIC tidak responsif, supervisor melakukan **reassign** ke staff lain, lalu staff baru tersebut yang memvalidasi.
- Supervisor melihat metadata semua kandidat (judul, PIC, status, umur antrean) di dashboard, tetapi di chatbot tetap tunduk pada filter akses seperti pengguna lain.

### 3.2 Tabel Direktori (Pemetaan Profil ke Data Sintetis)

Data sintetis memakai ID samaran (`PERSON-001`, `TEAM-IT-001`), bukan email. Profile selector memakai `user_id` (`STAFF-xxx` / `SUPERVISOR-xxx`). Tabel `kms_directory` menjembatani keduanya.

| `user_id` | `role` | `person_id` | `teams` | Peran di data sintetis |
| :--- | :--- | :--- | :--- | :--- |
| `STAFF-001` | staff | `PERSON-001` | `[]` | Product Management Media |
| `STAFF-002` | staff | `PERSON-002` | `["TEAM-IT-001"]` | IT Product Portal Development |
| `STAFF-003` | staff | `PERSON-003` | `[]` | Data Tracker |
| `STAFF-004` | staff | `PERSON-004` | `[]` | UX |
| `STAFF-005` | staff | `PERSON-006` | `["TEAM-IT-001"]` | Tech Lead |
| `STAFF-006` | staff | `PERSON-099` | `[]` | Tidak terlibat di PROJECT-001 (penguji isolasi akses) |
| `SUPERVISOR-001` | supervisor | `PERSON-100` | `[]` | Supervisor / Head Dept |

> Keanggotaan `TEAM-IT-001` di atas adalah asumsi dan perlu disesuaikan dengan skenario. `STAFF-006` sengaja tidak menjadi penerima email mana pun, sehingga dipakai untuk membuktikan bahwa filter akses bekerja.

---

## 4. Desain Skema n8n Data Tables

Data Tables otomatis menyediakan kolom `id`, `createdAt`, dan `updatedAt`, sehingga kolom timestamp tidak dibuat manual.

### 4.1 `kms_directory`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `user_id` | `string` | `STAFF-xxx` / `SUPERVISOR-xxx`. |
| `role` | `string` | `staff` / `supervisor`. |
| `person_id` | `string` | ID samaran di data sintetis (`PERSON-xxx`). |
| `teams` | `string` | JSON string array ID tim/milis (`TEAM-xxx`). |
| `display_label` | `string` | Label netral di UI (misal "Staff 001 – Data Tracker"). |

### 4.2 `kms_candidates`

| Kolom | Tipe | Keterangan & Pemetaan Requirement |
| :--- | :--- | :--- |
| `candidate_id` | `string` | ID unik (misal `CAND-20261015-001`). |
| `source_id` | `string` | ID email sumber (misal `EMAIL-001`), dipakai untuk deduplikasi. |
| `project_id` | `string` | ID proyek (misal `PROJECT-001`). |
| `project_name` | `string` | Nama inisiatif / proyek. |
| `title` | `string` | Judul pengetahuan hasil kurasi. |
| `summary` | `string` | Ringkasan pengetahuan. |
| `knowledge_type` | `string` | `PRD`, `UAT`, `Decision`, `IncidentResolution`, `Handover`. |
| `product_or_channel` | `string` | Kanal/produk terkait. |
| `division` | `string` | Divisi pemilik. |
| `owner_pic` | `string` | `person_id` PIC pemilik pengetahuan (GR1), misal `PERSON-001`. |
| `effective_date` | `string` | Tanggal berlaku (`YYYY-MM-DD`). |
| `access_recipients` | `string` | JSON string array ID penerima asli To/CC, berisi `PERSON-xxx` dan/atau `TEAM-xxx` (GR4). |
| `restricted_recipients` | `string` | JSON string array hasil penyempitan akses saat validasi (GR5). Kosong jika tidak diubah. |
| `has_sensitive_data` | `boolean` | Flag deteksi kredensial/PII/komersial (GR7). |
| `sensitive_details` | `string` | JSON string detail item yang di-mask. |
| `curated_payload` | `string` | JSON string lengkap output `knowledge_curator` (termasuk `structured_details`). |
| `status` | `string` | Lihat 4.4. |
| `error_message` | `string` | Pesan error jika `status = failed`. |
| `existing_knowledge_id` | `string` | ID pengetahuan lama jika ini adalah update (`updated_candidate`). |
| `superseded_by` | `string` | `candidate_id` pengganti jika entri ini tergantikan. |
| `qdrant_point_id` | `string` | UUID Qdrant (terisi setelah approved). |
| `duplicate_of` | `string` | `candidate_id` (untuk `already_pending`) atau ID knowledge (untuk `already_exists`) yang sudah ada. |
| `submitted_by` | `string` | `user_id` yang mengirim email lewat Komponen 1. |

### 4.3 `kms_validation_logs`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `log_id` | `string` | UUID unik log. |
| `candidate_id` | `string` | Relasi ke `kms_candidates.candidate_id`. |
| `action` | `string` | `approve`, `edit_approve`, `reject`, `handover`, `reassign`, `nudge`, `supersede`. |
| `actor_user_id` | `string` | `STAFF-xxx` / `SUPERVISOR-xxx` yang melakukan aksi. |
| `actor_role` | `string` | `staff` / `supervisor`. |
| `changes_summary` | `string` | JSON string ringkasan perubahan (field yang diedit, PIC lama → baru). |
| `notes` | `string` | Catatan persetujuan, alasan penolakan, atau pesan nudge/handover. |

### 4.4 Siklus Status `kms_candidates`

```text
processing ──┬──> pending_validation ──> approving ──┬──> approved ──> superseded
             │            │                          └──> pending_validation (jika tulis Qdrant gagal)
             │            └──> rejected
             ├──> skipped          (inspect_email: bukan pengetahuan, FR1/FR2)
             ├──> already_exists   (sumber sudah approved di Qdrant)
             ├──> already_pending  (sumber yang sama sedang diproses/pending)
             └──> failed           (error LLM / Google API / timeout, isi error_message)
```

Daftar status ini dipakai sama persis oleh tabel, endpoint polling, dan UI.

---

## 5. Keamanan Webhook & Integrasi Cloudflare

n8n dapat diakses publik melalui `https://n8n.cencendi.my.id/webhook/...`, sehingga:

1. **Header Authentication di n8n:** Semua webhook KMS memakai Header Auth `X-KMS-API-KEY: <KMS_API_KEY>`. Request tanpa header valid ditolak dengan HTTP 401. Nilai kunci disimpan sebagai credential n8n dan di konfigurasi nginx, tidak ditulis di dokumen, repositori, maupun kode frontend.
2. **Reverse Proxy nginx (API key tidak sampai ke browser):**
   - Frontend (hasil build statis) dan API berada di domain yang sama.
   - nginx meneruskan `/api/<path>` ke `n8n:5678/webhook/<path>` dan menyisipkan header `X-KMS-API-KEY` di sisi server.
   - Karena satu origin, CORS tidak perlu dibuka. CORS bukan mekanisme keamanan (tidak berlaku untuk `curl`/Postman), sehingga tidak diandalkan.
   - Saat pengembangan, proxy Vite (`server.proxy`) melakukan hal yang sama di lokal.
3. **Proteksi Halaman UI:** Halaman frontend dilindungi Cloudflare Access atau basic auth nginx, sehingga hanya peneliti dan penguji yang bisa membukanya.
4. **Pernyataan Batasan Penelitian (Threat to Validity):** Autentikasi pengguna akhir (SSO/OAuth) diabstraksikan menggunakan profile selector pseudonim. Identitas yang dikirim frontend dipercaya oleh backend. Hal ini dilakukan agar evaluasi berfokus pada orkestrasi KM dan tata kelola validasi manusia.

---

## 6. Arsitektur 4 Komponen Frontend Web

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND WEB (SPA, build statis)                              │
│  [ Profile: STAFF-001 … STAFF-006 | SUPERVISOR-001 ]   (tanpa API key di browser)      │
└───────┬────────────────────────┬───────────────────────┬───────────────────────┬───────┘
   (1) Ingest & Poll        (2) Validate            (3) Chatbot Q&A         (4) Monitoring
   [Staff]                  [Staff = owner_pic]     [Staff & Supervisor]    [Supervisor]
        │                        │                       │                       │
        ▼                        ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│      nginx (same origin)  /api/*  ──>  n8n /webhook/*  + sisip header X-KMS-API-KEY    │
└────────────────────────────────────────────────────────────────────────────────────────┘
        │                        │                       │                       │
        ▼                        ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  AI Orchestrator │    │validate_knowledge│    │  chat-rag        │    │   lead_summary   │
│  - Dedup 2-arah  │    │- Cek owner_pic   │    │- Resolve user ke │    │  (Code Node KPI) │
│  - Inspect       │    │- Lock "approving"│    │  person+teams    │    │  nudge / reassign│
│  - Extract       │    │- Payload Patch   │    │- Filter akses    │    └────────┬─────────┘
│  - Curate        │    │- Qdrant Upsert   │    │  deterministik   │             │
└───────┬──────────┘    └────────┬─────────┘    └────────┬─────────┘             │
        ▼                        ▼                       ▼                       ▼
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│             n8n DATA TABLES              │    │                  QDRANT                  │
│ - kms_directory (user ↔ person ↔ team)   │    │ - knowledge (chunks, payload akses)      │
│ - kms_candidates (staging & status)      │───>│ - knowledge_store (detail, payload akses)│
│ - kms_validation_logs (audit trail)      │    │ (Hanya APPROVED, versi terbaru)          │
└──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

---

### Komponen 1: Input JSON Email & Lampiran (Ingestion) — role Staff

- **Pola Asynchronous + Polling:**
  1. Pengguna memasukkan email via Form Builder atau menempelkan JSON sintetis di tab Raw JSON.
  2. UI memanggil `POST /api/ingest-email`.
  3. n8n membuat row baru di `kms_candidates` dengan status `processing` dan **segera membalas (<1 detik)** lewat node *Respond to Webhook*, lalu workflow berlanjut:
     ```json
     { "success": true, "candidate_id": "CAND-20261015-001", "status": "processing" }
     ```
  4. Pipeline orkestrasi berjalan setelah respons terkirim.
  5. Frontend menampilkan spinner dengan pesan ("Menganalisis email & lampiran Google Drive...") dan polling `GET /api/candidate-status?id=...` setiap 3–5 detik.
  6. Polling berhenti saat status bukan lagi `processing`. UI menampilkan:
     - `pending_validation`: kartu ringkasan hasil kurasi + tombol ke antrean validasi.
     - `skipped`: "Email ini tidak mengandung pengetahuan yang perlu disimpan" + alasan dari `inspect_email`.
     - `already_exists` / `already_pending`: info duplikat + tautan ke entri yang sudah ada.
     - `failed`: pesan error + tombol coba lagi.
  7. **Batas waktu polling 3 menit.** Jika masih `processing`, UI menampilkan pesan timeout. Di sisi n8n, workflow error handler (Error Trigger / `onError`) mengubah status menjadi `failed` dan mengisi `error_message`, sehingga tidak ada row yang tertahan di `processing`.

- **Deduplikasi 2-Arah (sebelum ekstraksi):**
  1. Cek `kms_candidates`: apakah `source_id` yang sama sedang berstatus `processing`, `pending_validation`, atau `approving` → status `already_pending`.
  2. Cek Qdrant lewat `saved_knowledge` (**tanpa** filter akses, karena ingest tidak mewakili user tertentu): apakah `source_id` sudah approved → status `already_exists`, kecuali email tersebut adalah pembaruan (`updated_candidate`), yang tetap diproses dengan `existing_knowledge_id` terisi.

---

### Komponen 2: Validasi Knowledge (Human-in-the-Loop) — role Staff

- **Pemenuhan Requirement:** GR1 (validasi oleh PIC pemilik), GR5 (penyempitan akses), GR6 (handover suksesor), GR7 (verifikasi masking sensitif), NFR2 (review 1 tindakan).
- **Fitur Antarmuka:**
  - **Tab Antrean:**
    - *"Menunggu Validasi Saya"*: kandidat dengan `owner_pic === person_id` milik profil aktif.
    - *"Semua Pending"*: seluruh entri pending (baca saja, tombol aksi nonaktif jika bukan pemilik).
  - **Layar Review 1 Tindakan:**
    - Kartu ringkasan, tanggal efektif, PIC pemilik.
    - **Sensitivitas (GR7):** banner peringatan jika ada kredensial/PII, memperlihatkan teks yang telah dimasking.
    - **Kontrol Akses (GR4 & GR5):** checklist penerima asli (`PERSON-xxx` dan `TEAM-xxx`). Validator dapat menghapus centang tim/milis sehingga hanya orang tertentu yang dapat mengakses.
    - **Accordion Teknis:** preview skrip tracking, requirement PRD, skenario UAT.
- **Aksi & Logika Backend (`validate_knowledge`):**
  0. **Otorisasi:** resolve `user_id` lewat `kms_directory`. Tolak (HTTP 403) jika role bukan `staff` atau `person_id` ≠ `owner_pic`.
  1. **Approve (1-Klik):**
     - **Lock idempotensi:** langkah pertama mengubah status `pending_validation` → `approving`. Jika status saat dibaca bukan `pending_validation` (klik ganda, request paralel), request ditolak (HTTP 409) tanpa eksekusi ulang.
     - Eksekusi subworkflow `knowledge_writer_upsert` dengan payload yang menyertakan `access_recipients` efektif (`restricted_recipients` jika diisi, selain itu `access_recipients`).
     - Berhasil → status `approved`, isi `qdrant_point_id`. Gagal → status kembali ke `pending_validation`, error dicatat di log.
     - Jika `existing_knowledge_id` terisi, jalankan langkah **Supersede** (lihat Komponen 3).
     - Catat di `kms_validation_logs`.
  2. **Edit & Approve:** suntingan judul, ringkasan, dan penerima akses di-*patch* ke `curated_payload` (bukan hanya kolom tabel) sebelum dikirim ke writer, sehingga yang di-embed adalah hasil revisi manusia. Selanjutnya sama dengan Approve.
  3. **Reject:** alasan wajib (Duplikat, Tidak Relevan, Informasi Salah/Batal). Status → `rejected`, alasan dicatat di log.
  4. **Handover Kepemilikan (GR6):** PIC memilih staff suksesor. `owner_pic` diubah, jejak suksesi dicatat di log.

---

### Komponen 3: Chatbot Q&A dengan Access Control — role Staff & Supervisor

- **Resolusi Identitas di Workflow (bukan oleh LLM):**
  - Frontend mengirim `user_id`. Workflow `chat-rag` me-resolve-nya lewat `kms_directory` menjadi `person_id` + `teams` **sebelum** AI Agent berjalan.
  - Daftar `allowed_ids = [person_id, ...teams, "public_all"]` diteruskan ke sub-workflow tool sebagai nilai tetap dari workflow (misalnya lewat field yang diisi expression, bukan `$fromAI`). LLM hanya mengisi query pencarian, sehingga tidak bisa melewati atau mengubah filter akses.
- **Filter Qdrant (berlaku untuk `saved_knowledge` mode chat dan `get_knowledge_detail`):**
  ```json
  {
    "filter": {
      "must": [
        { "key": "access_recipients", "match": { "any": ["PERSON-003", "TEAM-IT-001", "public_all"] } }
      ]
    }
  }
  ```
  - Filter superseded tidak diperlukan karena pembaruan menimpa versi lama di Qdrant (lihat Penanganan Superseded di bawah).
  - `saved_knowledge` menerima parameter opsional `allowed_ids`. Jika kosong (dipanggil dari ingest untuk deduplikasi), filter akses tidak diterapkan.
  - `get_knowledge_detail` wajib menerapkan filter yang sama. Tanpa ini, detail lengkap tetap bisa diambil walaupun chunk-nya tersaring.
  - Nilai `public_all` dipakai untuk pengetahuan yang sengaja dibuka untuk semua. Nilai ini hanya bisa diberikan validator lewat checklist akses.
- **Migrasi Data Qdrant yang Sudah Ada:** point lama belum memiliki `access_recipients`, sehingga akan tersaring oleh filter `must`. Sebelum Fase 3, lakukan salah satu: (a) backfill payload `access_recipients` dari data sumber, atau (b) kosongkan koleksi dan ingest ulang skenario melalui alur validasi baru. Opsi (b) disarankan agar seluruh data uji melewati alur yang sama.
- **Hasil Evaluasi Paper (GR5):** jika `STAFF-001` mempersempit akses dengan menghapus `TEAM-IT-001`, maka `STAFF-005` (anggota tim tersebut) dan `STAFF-006` (bukan penerima) tidak mendapat dokumen itu dari chatbot, sedangkan staff yang masih tercantum tetap mendapatkannya.
- **Penanganan Superseded (FR6):** saat kandidat pembaruan (`updated_candidate`, dengan `existing_knowledge_id`) di-approve:
  1. `knowledge_writer_upsert` memakai `knowledge_id` yang sama, menghapus chunk lama, lalu menulis versi gabungan terbaru (master point di `knowledge_store` ikut tertimpa karena ID-nya diturunkan dari `knowledge_id`). Qdrant tidak pernah menyimpan dua versi aktif, sehingga chatbot otomatis hanya mengutip versi terbaru dan flag `is_superseded` tidak diperlukan.
  2. Row kandidat lama dengan `knowledge_id` yang sama dan status `approved` diubah menjadi `superseded`, `superseded_by` diisi `candidate_id` baru.
  3. Versi lama tetap dapat diaudit lewat `curated_payload` pada row yang berstatus `superseded`.
  Langkah 2 diperlukan agar KPI "Tergantikan/Usang" di dashboard akurat.
- **Sitasi Sumber Eksplisit (FR8):** output menyertakan judul, ID email/lampiran sumber, tanggal efektif, dan PIC yang memvalidasi (dalam ID pseudonim).

---

### Komponen 4: Monitoring — role Supervisor

- **Pemenuhan Requirement:** GR2 (ringkasan berkala entri pending, rejected, outdated untuk team lead).
- **Fitur Antarmuka:**
  - **Kartu KPI:** Aktif (Approved), Menunggu Validasi (Pending), Ditolak (Rejected), Tergantikan (Superseded), Gagal Diproses (Failed).
  - **Tabel Bottleneck & Aging:** entri pending ≥3 hari. Kolom: Judul, Produk/Kanal, PIC, Durasi Menunggu (hari).
  - **Aksi Supervisor:**
    - *"Nudge PIC"*: mencatat pengingat di `kms_validation_logs` dan menampilkannya sebagai notifikasi di antrean PIC saat profil tersebut dipilih. Pada prototipe ini tidak ada email/notifikasi eksternal yang dikirim.
    - *"Reassign PIC"*: memindahkan `owner_pic` ke staff lain. Supervisor tidak meng-approve sendiri.
  - **Sebaran Kanal & Divisi:** grafik proporsi pengetahuan approved per kanal/divisi.
  - **Log Audit Validasi:** riwayat aktivitas terakhir dari `kms_validation_logs`.

- **Implementasi `GET /api/lead-summary`:**
  - Workflow menolak request jika `user_id` bukan supervisor.
  - Node Data Table *Get rows* untuk kedua tabel diset `returnAll: true` (default-nya dibatasi).
  - Code node:
    ```javascript
    const candidates = $('Read Candidates Table').all().map(i => i.json);
    const logs = $('Read Logs Table').all().map(i => i.json);
    const now = new Date();
    const DAY = 1000 * 60 * 60 * 24;

    const count = (s) => candidates.filter(c => c.status === s).length;
    const metrics = {
      approved: count('approved'),
      pending: count('pending_validation'),
      rejected: count('rejected'),
      superseded: count('superseded'),
      failed: count('failed'),
    };

    const bottlenecks = candidates
      .filter(c => c.status === 'pending_validation')
      .map(c => ({
        candidate_id: c.candidate_id,
        title: c.title,
        product_or_channel: c.product_or_channel,
        owner_pic: c.owner_pic,
        days_pending: Math.floor((now - new Date(c.createdAt)) / DAY),
      }))
      .filter(c => c.days_pending >= 3)
      .sort((a, b) => b.days_pending - a.days_pending);

    const distribution = {};
    for (const c of candidates.filter(c => c.status === 'approved')) {
      const key = c.product_or_channel || 'Lainnya';
      distribution[key] = (distribution[key] || 0) + 1;
    }

    const recent_logs = logs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 15);

    return [{ json: { metrics, bottlenecks, distribution, recent_logs } }];
    ```

---

## 7. Spesifikasi Kontrak API

Frontend memanggil `/api/<path>` (same origin). nginx meneruskan ke `n8n/webhook/<path>` dan menyisipkan `X-KMS-API-KEY: <KMS_API_KEY>`. Setiap request menyertakan `user_id` profil aktif.

Kode error umum: `401` (API key salah, dari n8n), `403` (role/kepemilikan tidak sesuai), `409` (status tidak sesuai, misal sudah di-approve).

### 1. Ingest Email (Async)
- **Endpoint:** `POST /api/ingest-email`
- **Request Body:** `{ "user_id": "STAFF-003", "email": { ...objek JSON email sintetis... } }`
- **Response (<1 detik):**
  ```json
  {
    "success": true,
    "candidate_id": "CAND-20261015-001",
    "status": "processing"
  }
  ```

### 2. Polling Status Ingest
- **Endpoint:** `GET /api/candidate-status?id=CAND-20261015-001`
- **Response:**
  ```json
  {
    "candidate_id": "CAND-20261015-001",
    "status": "pending_validation",
    "error_message": null,
    "duplicate_of": null,
    "curated_summary": {
      "title": "Update UI Search Result Video",
      "summary": "...",
      "owner_pic": "PERSON-001",
      "division": "Product",
      "effective_date": "2026-01-13",
      "has_sensitive_data": false,
      "access_recipients": ["PERSON-001", "PERSON-002", "TEAM-IT-001"]
    }
  }
  ```
  `status` bernilai salah satu dari siklus pada bagian 4.4. `duplicate_of` terisi untuk `already_exists` / `already_pending`.

### 3. Validasi Knowledge (Staff)
- **Endpoint:** `POST /api/validate-knowledge`
- **Request Body:**
  ```json
  {
    "candidate_id": "CAND-20261015-001",
    "user_id": "STAFF-001",
    "action": "edit_approve",
    "patched_fields": {
      "title": "Update UI Search Result Video [Revisi PIC]",
      "restricted_recipients": ["PERSON-001", "PERSON-003"]
    },
    "handover_to": null,
    "notes": "Disetujui, akses tim IT dipersempit."
  }
  ```
  `action`: `approve` | `edit_approve` | `reject` | `handover`. `handover_to` berisi `user_id` staff suksesor.
- **Response:**
  ```json
  {
    "success": true,
    "candidate_id": "CAND-20261015-001",
    "new_status": "approved",
    "qdrant_point_id": "7f8b1c4a-92bc-4180-87a3-2c1b7593b451"
  }
  ```

### 4. Aksi Supervisor
- **Endpoint:** `POST /api/supervisor-action`
- **Request Body:**
  ```json
  {
    "candidate_id": "CAND-20261012-004",
    "user_id": "SUPERVISOR-001",
    "action": "nudge",
    "reassign_to": null,
    "message": "Mohon segera divalidasi sebelum sprint planning."
  }
  ```
  `action`: `nudge` | `reassign`. `reassign_to` berisi `user_id` staff tujuan.
- **Response:** `{ "success": true, "action": "nudge", "logged": true }`

### 5. Chatbot RAG Berbasis Hak Akses
- **Endpoint:** `POST /api/chat-rag`
- **Request Body:**
  ```json
  {
    "chatInput": "Berapa nomor commit Git dan script tracking untuk video vertical?",
    "user_id": "STAFF-003"
  }
  ```
- **Response:**
  ```json
  {
    "output": "Berdasarkan UAT detiksearch, nomor commit Git adalah GIT-COMMIT-001 (desktop) dan GIT-COMMIT-002 (mobile)...",
    "citations": [
      {
        "knowledge_id": "KNOWLEDGE-001",
        "title": "Update UI Search Result Video",
        "source_doc": "DOC-002",
        "validator": "PERSON-001",
        "effective_date": "2026-01-13"
      }
    ]
  }
  ```

### 6. Ringkasan Monitoring (Supervisor)
- **Endpoint:** `GET /api/lead-summary?user_id=SUPERVISOR-001`
- **Response:** `{ metrics, bottlenecks, distribution, recent_logs }` sesuai Code node pada Komponen 4.

### 7. Direktori Profil
- **Endpoint:** `GET /api/directory`
- **Response:** daftar `user_id`, `role`, `display_label` untuk mengisi profile selector dan dropdown handover/reassign.

---

## 8. Status Implementasi (Referensi Teknis)

| Item | ID / Lokasi | Status |
| :--- | :--- | :--- |
| Data Table `kms_directory` | `S5KVXAkYgkydP1OY` | Dibuat, terisi 7 profil (3.2) |
| Data Table `kms_candidates` | `kbUIDYKuQb34aXmv` | Dibuat |
| Data Table `kms_validation_logs` | `tqzfRLVDBMSKiwec` | Dibuat |
| Credential Header Auth | `KMS API Key (X-KMS-API-KEY)`, nilai di `/home/cendi/n8n/.env` (`KMS_API_KEY`) | Dibuat |
| Ingest async `POST /webhook/ingest-email` | Workflow `dummy knowledge management` (`BiDjvbh6ZdCRDlB6`) | Fase 1 |
| Polling `GET /webhook/candidate-status` | Workflow `kms_candidate_status` (`GhJKHDSm3ympl89h`) | Fase 1 |
| Direktori `GET /webhook/directory` | Workflow `kms_directory` (`bpUU2HibzLVT0p3x`) | Fase 1 |
| Validasi `POST /webhook/validate-knowledge` | Workflow `kms_validate_knowledge` (`kGreWkk0geO6v29i`) | Fase 2 |
| Writer Qdrant | `knowledge_writer_upsert` (`KwrUpsert20260810A1`): + node `Attach Governance Metadata` (payload `access_recipients`, `owner_pic`, `candidate_id`, `validated_by`); header `Api-Key` palsu dihapus | Fase 2 |
| Koleksi Qdrant `knowledge`, `knowledge_store` | Dikosongkan 15 Okt 2026 (snapshot di `/qdrant/snapshots`), kini hanya berisi data yang lolos validasi | Aktif |

Catatan teknis: Bearer token embedding 9router masih tertulis langsung di node `Embedding` pada writer. Pindahkan ke credential n8n (Header Auth) lewat UI.

---

## 9. Prioritas & Roadmap Implementasi

```text
[ FASE 1: Backend Data Tables & Ingestion Asynchronous ] ───────── (P1 - Kritis)
  ├── 1.1 Buat Data Tables: `kms_directory` (isi sesuai 3.2), `kms_candidates`, `kms_validation_logs`
  ├── 1.2 Buat credential Header Auth (`X-KMS-API-KEY`) dan pasang di semua webhook KMS
  ├── 1.3 Modifikasi `dummy knowledge management`:
  │     - Respond to Webhook segera (status `processing`), lanjut di background
  │     - Deduplikasi 2-arah (Data Table + Qdrant)
  │     - Filter email FR1/FR2 (status `skipped`) & ekstraksi tautan Drive FR3
  │     - Curator menghasilkan `owner_pic` & `access_recipients` dalam ID PERSON/TEAM
  │     - Simpan hasil ke `kms_candidates` status `pending_validation`
  │     - Error handler → status `failed` + `error_message`
  ├── 1.4 Workflow `candidate-status` dan `directory`
  └── 1.5 Verifikasi: kirim email001/email002 → status akhir benar tanpa timeout

[ FASE 2: Validasi Human-in-the-Loop & Persistensi Qdrant ] ─────── (P1 - Kritis)
  ├── 2.1 Workflow `validate_knowledge`:
  │     - Otorisasi owner_pic (403) & lock `approving` (409)
  │     - Patch `curated_payload` sebelum dikirim ke writer
  │     - Aksi: approve, edit_approve, reject, handover
  ├── 2.2 Perbarui `knowledge_writer_upsert`: payload `access_recipients`, `owner_pic`, `validated_by`
  │       di koleksi `knowledge` dan `knowledge_store`
  ├── 2.3 Langkah supersede (Qdrant + Data Table + log)
  ├── 2.4 Kosongkan koleksi Qdrant lama atau backfill payload akses
  └── 2.5 Verifikasi: approval menghasilkan point Qdrant ber-metadata akses; klik ganda tidak menggandakan data

[ FASE 3: Access Control Chatbot & Endpoint Supervisor ] ────────── (P2 - Tinggi)
  ├── 3.1 Perbarui `RagChatQdrant20260811`: resolve user_id → allowed_ids sebelum agent
  ├── 3.2 Perbarui `saved_knowledge` (filter opsional) & `get_knowledge_detail` (filter wajib)
  ├── 3.3 Workflow `lead_summary` dan `supervisor_action` (nudge, reassign)
  └── 3.4 Verifikasi: uji isolasi akses STAFF-001 / STAFF-005 / STAFF-006

[ FASE 4: Pengembangan Frontend Web UI ] ─────────────────────────── (P2 - Tinggi)
  ├── 4.1 Inisiasi SPA: Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query
  ├── 4.2 Profile selector (STAFF-xxx / SUPERVISOR-xxx) & menu sesuai role
  ├── 4.3 Komponen 1: Form Ingest + polling status (dengan batas waktu)
  ├── 4.4 Komponen 2: Validasi 1-klik + modal edit + checklist akses + handover
  ├── 4.5 Komponen 3: Chatbot dengan sitasi
  ├── 4.6 Komponen 4: Dashboard monitoring supervisor
  └── 4.7 nginx reverse proxy + Cloudflare Access / basic auth

[ FASE 5: Pengujian Skenario Riset & Penyusunan Laporan ] ────────── (P3 - Evaluasi)
  ├── 5.1 Eksekusi 7 skenario sintetis dari wawancara (Ramadan, Reschedule, Milis, VPN, dst.)
  ├── 5.2 Pencatatan bukti audit dan metrik untuk Section III paper
  └── 5.3 Finalisasi dokumentasi artefak untuk lampiran publikasi
```

### Matriks Kesiapan & Dependensi

| Modul | Komponen Teknis | Prioritas | Kompleksitas | Dependensi |
| :--- | :--- | :---: | :---: | :--- |
| **Staging Data** | Data Tables (`kms_directory`, `kms_candidates`, `kms_validation_logs`) | **P1** | Rendah | Tidak ada (native n8n) |
| **Ingestion** | Async webhook + dedup 2-arah + error handling | **P1** | Menengah | Data Tables |
| **Validation** | `validate_knowledge` + otorisasi + lock + patch payload + supersede | **P1** | Menengah | `knowledge_writer_upsert` |
| **Chatbot Guard** | Resolve identitas + filter akses di chunk & detail + migrasi data lama | **P2** | Menengah | `saved_knowledge`, `get_knowledge_detail`, Qdrant |
| **Supervisor** | `lead_summary` + `supervisor_action` | **P2** | Rendah | Data Tables |
| **Frontend UI** | SPA 4 komponen + profile selector + proxy nginx | **P2** | Menengah | Endpoint Fase 1–3 |
| **Evaluasi Paper** | Skenario sintetis wawancara | **P3** | Rendah | Frontend & backend terhubung |
