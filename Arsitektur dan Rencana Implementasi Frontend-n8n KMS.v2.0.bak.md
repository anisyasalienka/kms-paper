# Arsitektur & Rencana Implementasi Frontend–n8n KMS
*Email-to-Knowledge Management System dengan Human-in-the-Loop Validation & Lead Monitoring*

**Versi:** 2.0 (Revisi Komprehensif Berdasarkan Validasi Lingkungan n8n & Mitigasi Risiko Arsitektur)  
**Tanggal:** 15 Oktober 2026  
**Lokasi Dokumen:** `/home/cendi/kms-paper-nisya/Arsitektur dan Rencana Implementasi Frontend-n8n KMS.md`  
**Referensi Riset:** `Analisis Tematik & Requirement Workflow KMS.md` (FR1–FR8, GR1–GR7, NFR1–NFR4)

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Dokumen ini merupakan cetak biru arsitektur dan rencana teknis implementasi **Frontend Web KMS** berbasis **n8n sebagai backend API headless**. Sistem ini mengintegrasikan ingestion email otomatis, validasi pemilik pengetahuan (*Human-in-the-Loop*), penelusuran semantik ber-sitasi (*Chatbot RAG*), dan ringkasan tata kelola berkala untuk supervisor (*Lead Monitoring*).

Revisi v2.0 ini menyelaraskan seluruh keputusan teknis dengan batasan lingkungan riil n8n v2.27.3 dan menutup celah tata kelola (*governance loopholes*) yang diidentifikasi dari evaluasi kritis:

1. **Staging Berbasis n8n Data Tables (Bukan SQLite):** Menghindari risiko bentrok database internal n8n dan tidak membutuhkan node eksternal/kredensial tambahan.
2. **Ingest Asynchronous + Polling:** Mencegah *HTTP 524 Gateway Timeout* dari Cloudflare (batas ±100 detik) saat LLM mengekstrak dokumen lampiran/GDocs/GSheets yang panjang.
3. **Pengamanan Webhook Publik:** Mengamankan endpoint `n8n.cencendi.my.id` dengan **Header Auth (`X-KMS-API-KEY`)** dan pembatasan CORS.
4. **Penyaringan Akses Riil di Chatbot (GR4 & GR5):** Memastikan daftar penerima akses (`access_recipients`) benar-benar difilter di level vector query Qdrant berdasarkan email penanya.
5. **Integritas Edit & Idempotensi Validasi:** Mem-patch `curated_payload` sebelum dikirim ke writer Qdrant, serta mencegah eksekusi ganda (*double-approve*) dengan guard status `pending_validation`.
6. **Deduplikasi 2-Arah:** Memeriksa Qdrant (data approved lampau) dan Data Tables (mencegah duplikasi email yang masih berstatus pending).
7. **Pengelolaan Status Superseded (FR6):** Menandai entri lama di Qdrant saat entri pembaruan (`updated_candidate`) disetujui, agar spesifikasi usang tidak dikutip oleh chatbot.
8. **Pemetaan Statis Profil Pengguna:** Pemetaan tetap 4 profil informan ke alamat email konsisten yang selaras dengan data sintetis.

---

## 2. Analisis & Keputusan Tempat Penyimpanan Staging

### Evaluasi Kritis n8n v2.27.3:
Pada runtime n8n yang terpasang saat ini (versi 2.27.3 di Docker), **node SQLite bawaan tidak tersedia** (hanya community node Tavily yang aktif). Memaksakan SQLite melalui Code node membutuhkan pengaturan environment khusus (`NODE_FUNCTION_ALLOW_EXTERNAL`) yang rapuh. Selain itu, meletakkan file SQLite sekunder di `/home/cendi/n8n/data/` berisiko tertukar atau mengganggu `database.sqlite` milik sistem n8n sendiri.

### Keputusan: Menggunakan n8n Data Tables
n8n Data Tables adalah fitur bawaan resmi n8n yang ideal untuk prototipe penelitian ini:
- **Zero Configuration & Zero Credential:** Beroperasi langsung di dalam n8n tanpa dependensi kontainer tambahan.
- **Isolasi Penuh dari Qdrant:** Data kandidat yang belum di-approve tidak pernah menyentuh Qdrant, mencegah kebocoran data draft/sensitif (*data poisoning*).
- **Kapasitas Memadai:** Prototipe paper mengelola puluhan hingga ratusan entri. Skala ini sangat ringan diproses oleh Data Tables.
- **Agregasi Metrik Efisien:** Perhitungan KPI dashboard lead (GR2) dapat diselesaikan dalam hitungan milidetik oleh satu Code node di n8n menggunakan JavaScript array reduction.

*(Catatan Paper: Jika di masa depan evaluasi membutuhkan SQL murni untuk klaim arsitektur enterprise, satu kontainer PostgreSQL terisolasi dapat ditambahkan ke docker-compose tanpa mengganggu service lain).*

---

## 3. Desain Skema n8n Data Tables

Dua tabel dibuat pada n8n Data Tables:

### 1. Data Table: `kms_candidates`
Menyimpan draf hasil kurasi sebelum divalidasi oleh pemilik pengetahuan.

| Nama Kolom | Tipe Data | Keterangan & Pemetaan Requirement |
| :--- | :--- | :--- |
| `candidate_id` | `string` | Primary Key unik (misal: `CAND-20261015-001`). |
| `project_id` | `string` | ID proyek (misal: `PROJECT-001`). |
| `project_name` | `string` | Nama inisiatif / proyek. |
| `title` | `string` | Judul pengetahuan hasil kurasi. |
| `summary` | `string` | Ringkasan eksekutif pengetahuan. |
| `knowledge_type` | `string` | `PRD`, `UAT`, `Decision`, `IncidentResolution`, `Handover`. |
| `product_or_channel` | `string` | Kanal/produk terkait (`Portal`, `Adsmart`, `Commerce`, `Riset`). |
| `division` | `string` | Divisi pemilik (`IT Portal`, `Data & Riset`, `Product`). |
| `owner_pic` | `string` | Email PIC penanggung jawab validasi (GR1). |
| `effective_date` | `string` | Tanggal berlaku (format `YYYY-MM-DD`). |
| `access_recipients` | `string` | JSON string array email To/CC asli (GR4). |
| `restricted_recipients`| `string` | JSON string array hasil penyempitan milis jika diubah saat validasi (GR5). |
| `has_sensitive_data` | `boolean` | Flag deteksi kredensial/PII/komersial (GR7). |
| `sensitive_details` | `string` | JSON string detail item yang di-mask. |
| `curated_payload` | `string` | JSON string lengkap output dari `knowledge_curator` (termasuk `structured_details`). |
| `status` | `string` | `processing`, `pending_validation`, `approved`, `rejected`, `superseded`. |
| `existing_knowledge_id`| `string` | ID pengetahuan lama jika ini adalah update (`updated_candidate`). |
| `qdrant_point_id` | `string` | UUID Qdrant (terisi setelah approved). |
| `created_at` | `date` | Timestamp penangkapan email. |
| `updated_at` | `date` | Timestamp status terakhir. |

### 2. Data Table: `kms_validation_logs`
Merekam jejak audit trail seluruh keputusan validasi dan alih tugas (GR2, GR3, GR6).

| Nama Kolom | Tipe Data | Keterangan |
| :--- | :--- | :--- |
| `log_id` | `string` | UUID unik log. |
| `candidate_id` | `string` | Relasi ke `kms_candidates.candidate_id`. |
| `action` | `string` | `approve`, `edit_approve`, `reject`, `handover`, `nudge`. |
| `validator_role` | `string` | Role validator (`Supervisor`, `Analyst`, `PM`, `ResearchOps`). |
| `validator_email` | `string` | Email validator yang melakukan aksi. |
| `changes_summary` | `string` | JSON string ringkasan data yang diubah validator. |
| `notes` | `string` | Catatan persetujuan, alasan penolakan, atau pesan serah terima. |
| `timestamp` | `date` | Waktu tindakan dieksekusi. |

---

## 4. Keamanan Webhook & Integrasi Cloudflare

Karena n8n dapat diakses publik melalui domain `https://n8n.cencendi.my.id/webhook/...`, pengamanan wajib diterapkan:

1. **Header Authentication:**
   - Seluruh endpoint webhook n8n memeriksa header HTTP: `X-KMS-API-KEY: <SECRET_KEY>`.
   - Request tanpa header yang valid langsung ditolak dengan status HTTP 401 Unauthorized oleh node Webhook n8n.
2. **CORS Whitelist:**
   - Header CORS pada webhook dibatasi hanya mengizinkan origin frontend web (misal `http://localhost:5173` saat pengembangan atau domain staging resmi).
3. **Pernyataan Batasan Penelitian (Paper Threat to Validity):**
   - Dalam paper riset, dinyatakan bahwa sistem autentikasi pengguna akhir (SSO/OAuth enterprise) diabstraksikan menggunakan token service backend dan profile selector mock, guna memfokuskan evaluasi pada efektivitas orkestrasi KM dan tata kelola validasi manusia.

---

## 5. Arsitektur 4 Komponen Frontend Web

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND WEB (SPA)                                   │
│  [ Profile: I1 Mas Aan | I2 Mbak Fanda | I3 Dila | I4 Mbak Ika ]  [API Key Header]     │
└───────┬────────────────────────┬───────────────────────┬───────────────────────┬───────┘
        │                        │                       │                       │
   (1) Ingest & Poll        (2) Validate            (3) Chatbot Q&A         (4) Lead Summary
   (Async: Start + Check)   (Anti Double-Approve)   (Filtered by Email)     (Aggregated Metrics)
        │                        │                       │                       │
        ▼                        ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                     n8n GATEWAY                                        │
│               Header Auth: X-KMS-API-KEY  |  CORS Restricted to Frontend               │
└───────┬────────────────────────┬───────────────────────┬───────────────────────┬───────┘
        │                        │                       │                       │
        ▼                        ▼                       │                       ▼
┌──────────────────┐    ┌──────────────────┐             │              ┌──────────────────┐
│  AI Orchestrator │    │validate_knowledge│             │              │   lead_summary   │
│  - Inspect       │    │- Idempotency     │             │              │  (Code Node KPI) │
│  - Extract       │    │- Payload Patch   │             │              └────────┬─────────┘
│  - Curate        │    │- Qdrant Upsert   │             │                       │
└───────┬──────────┘    └────────┬─────────┘             │                       │
        │                        │                       │                       │
        ▼                        ▼                       ▼                       ▼
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│             n8n DATA TABLES              │    │               QDRANT CLUSTER             │
│ - kms_candidates (Staging & Pending)     │    │ - knowledge_chunks (Filtered by Access)  │
│ - kms_validation_logs (Audit Trail)      │───>│ - knowledge_store (Full Master Details)  │
│ (Pengecekan duplikasi pending di sini)   │    │ (Hanya data APPROVED & is_superseded=0)  │
└──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

---

### Komponen 1: Input JSON Email & Lampiran (Ingestion)

- **Pola Asynchronous + Polling (Solusi Cloudflare Timeout):**
  1. Pengguna memasukkan data email via Form Builder atau menempelkan (*paste*) JSON sintetis pada tab Raw JSON.
  2. UI memanggil `POST /webhook/ingest-email`.
  3. n8n membuat row baru di `kms_candidates` dengan status `processing` dan **segera membalas dalam <1 detik**:
     ```json
     { "success": true, "candidate_id": "CAND-20261015-001", "status": "processing" }
     ```
  4. n8n menjalankan pipeline orkestrasi di background canvas.
  5. Frontend menampilkan *progress spinner* dengan pesan edukatif ("Menganalisis email & lampiran Google Drive...") dan melakukan polling ke `GET /webhook/candidate-status?id=CAND-20261015-001` setiap 3–5 detik.
  6. Setelah kurasi selesai, status berubah menjadi `pending_validation`. UI menampilkan kartu ringkasan hasil kurasi dan tombol langsung menuju antrean validasi.

- **Deduplikasi 2-Arah (Qdrant + Data Table):**
  - Pada tahap awal `inspect_email`:
    1. Cek Qdrant: apakah `source_id` / `email_id` sudah pernah disetujui sebelumnya (`already_exists`).
    2. Cek `kms_candidates`: apakah email yang sama saat ini sedang berstatus `pending_validation`.
  - Jika sedang pending, workflow langsung menghentikan ekstraksi dan membalas status `already_pending` untuk mencegah duplikasi antrean review.

---

### Komponen 2: Validasi Knowledge (Human-in-the-Loop)

- **Pemenuhan Requirement:** GR1 (pemilik/PIC validasi), GR5 (penyempitan akses milis), GR6 (handover suksesor), GR7 (verifikasi masking sensitif), NFR2 (review 1 tindakan).
- **Fitur Antarmuka:**
  - **Tab Antrean:**
    - *"Menunggu Validasi Saya"*: Memfilter kandidat di mana `owner_pic === active_user_email`.
    - *"Semua Antrean Pending"*: Menampilkan seluruh entri pending untuk transparansi supervisor.
  - **Layar Review 1 Tindakan:**
    - Kartu ringkasan pengetahuan, tanggal efektif, dan nama PIC pemilik.
    - **Sensitivitas (GR7):** Banner peringatan jika ditemukan kredensial/PII, memperlihatkan teks yang telah dimasking.
    - **Kontrol Akses (GR4 & GR5):** Daftar checklist penerima To/CC asli. Validator dapat menghapus centang alamat milis umum agar pengetahuan hanya dapat diakses staf tertentu.
    - **Accordion Teknis:** Preview terstruktur untuk skrip tracking event, requirement PRD, dan skenario UAT.
  - **Aksi Validasi & Logika Backend:**
    1. **Approve (1-Klik):**
       - **Guard Idempotensi:** Backend mengecek apakah status baris masih `pending_validation`. Jika sudah `approved` (misal akibat klik ganda), tolak request tanpa duplikasi eksekusi.
       - Eksekusi subworkflow `knowledge_writer_upsert`.
       - Update row Data Table menjadi `approved`, catat `qdrant_point_id`.
       - Catat di `kms_validation_logs`.
    2. **Edit & Approve:**
       - Pengguna menyunting teks judul, ringkasan, atau mempersempit penerima akses di modal.
       - **Patching Payload:** Backend menggabungkan (*patch*) data suntingan tersebut ke dalam `curated_payload` sebelum dikirim ke `knowledge_writer_upsert`. Ini memastikan data yang di-embed dan disimpan ke Qdrant adalah data hasil revisi manusia.
    3. **Reject:**
       - Modal input alasan penolakan (Duplikat, Tidak Relevan, Batal).
       - Status Data Table diubah menjadi `rejected`, alasan dicatat di log audit.
    4. **Handover Kepemilikan (GR6):**
       - Validator/Lead memilih suksesor dari dropdown pengguna.
       - Action: `handover`, mengubah kolom `owner_pic` di Data Table dan mencatat jejak suksesi di log audit.
    5. **Nudge PIC:**
       - Tombol bagi Lead pada entri yang menggantung >3 hari untuk memicu log pengingat ke PIC.

---

### Komponen 3: Chatbot Q&A dengan Access Control (GR4 & GR5)

- **Penegakan Hak Akses di Level Pencarian Vector:**
  - Saat `knowledge_writer_upsert` menyimpan chunk ke koleksi Qdrant `knowledge`, simpan array `access_recipients` (atau hasil penyempitan `restricted_recipients`) ke dalam payload point.
  - Saat frontend memanggil Chatbot via `/webhook/chat-rag`, sertakan email aktif pengguna:
    ```json
    {
      "chatInput": "Bagaimana spesifikasi tracking video vertikal?",
      "user_email": "ikapratiwi@company.com"
    }
    ```
  - Node `Search Qdrant Knowledge` (`saved_knowledge`) menyertakan filter Qdrant:
    ```json
    {
      "filter": {
        "must": [
          { "key": "is_superseded", "match": { "value": false } }
        ],
        "should": [
          { "key": "access_recipients", "match": { "value": "public_all" } },
          { "key": "access_recipients", "match": { "value": "ikapratiwi@company.com" } }
        ]
      }
    }
    ```
  - **Hasil Evaluasi Paper:** Jika akses email milis dipersempit oleh Mbak Ika hanya untuk tim inti, maka saat akun lain di luar daftar menanyakan hal tersebut ke Chatbot, Qdrant **tidak akan mengembalikan dokumen tersebut**. Ini membuktikan keberhasilan pengujian GR5.

- **Penanganan Status "Superseded" (FR6):**
  - Ketika sebuah email revisi disetujui (`updated_candidate`), entri pengetahuan sebelumnya yang memiliki `existing_knowledge_id` yang sama akan diupdate payload-nya di Qdrant: `is_superseded: true`.
  - Chatbot hanya mengutip entri yang aktif (`is_superseded: false`), mencegah rujukan ke spesifikasi tracking atau timeline rilis yang sudah usang.

- **Sitasi Sumber Eksplisit (FR8):**
  - Output chatbot menyertakan sitasi lengkap: judul dokumen sumber, nomor ID email/lampiran, tanggal efektif, dan PIC yang memvalidasi.

---

### Komponen 4: Monitoring Lead (Supervisor / Head Dept/Div)

- **Pemenuhan Requirement:** GR2 (ringkasan berkala entri pending, rejected, outdated untuk team lead).
- **Fitur Antarmuka:**
  - **Kartu KPI:**
    - Pengetahuan Aktif (Approved).
    - Menunggu Validasi (Pending).
    - Ditolak (Rejected).
    - Tergantikan/Usang (Superseded).
  - **Tabel Bottleneck & Aging:**
    - Menampilkan entri pending dengan masa tunggu >3 hari.
    - Kolom: Judul, Produk/Kanal, PIC yang Bertanggung Jawab, Durasi Menunggu (hari).
    - Tombol Aksi: *"Nudge PIC"* (kirim reminder) dan *"Ambil Alih Validasi"* (Lead override).
  - **Sebaran Kanal & Divisi:**
    - Grafik/tabel proporsi pengetahuan (Portal, Commerce, Adsmart, Riset).
  - **Log Audit Validasi:**
    - Riwayat aktivitas validasi terakhir dari `kms_validation_logs`.

- **Implementasi n8n Endpoint (`GET /webhook/lead-summary`):**
  - Menggunakan satu **Code Node** di n8n untuk membaca tabel `kms_candidates` dan `kms_validation_logs`, lalu menghitung metrik menggunakan JavaScript:
    ```javascript
    const candidates = $('Read Candidates Table').all().map(i => i.json);
    const logs = $('Read Logs Table').all().map(i => i.json);
    const now = new Date();

    const metrics = {
      approved: candidates.filter(c => c.status === 'approved').length,
      pending: candidates.filter(c => c.status === 'pending_validation').length,
      rejected: candidates.filter(c => c.status === 'rejected').length,
      superseded: candidates.filter(c => c.status === 'superseded').length,
    };

    const bottlenecks = candidates
      .filter(c => c.status === 'pending_validation')
      .map(c => {
        const diffDays = Math.floor((now - new Date(c.created_at)) / (1000 * 60 * 60 * 24));
        return { ...c, days_pending: diffDays };
      })
      .filter(c => c.days_pending >= 3);

    return [{ json: { metrics, bottlenecks, recent_logs: logs.slice(-15).reverse() } }];
    ```

---

## 6. Pemetaan Profil Pengguna Tetap (Profile Selector)

Untuk keperluan pengujian multi-peran yang selaras dengan transkrip wawancara dan dataset sintetis:

| Kode | Nama Informan | Posisi / Peran di UI | Email Tetap Pengujian | Otoritas Utama |
| :---: | :--- | :--- | :--- | :--- |
| **I1** | **Mas Aan** | Supervisor Data | `aan.supervisor@company.com` | Lead Monitoring (Komp 4), Override Validasi, Validasi Pipeline. |
| **I2** | **Mbak Fanda**| Data Analyst | `fanda.analyst@company.com` | Validator UAT Sheet & Tracking Script (Komp 2). |
| **I3** | **Dila** | Research Ops | `dila.research@company.com` | Validator Laporan Riset & Pengawasan Akses Milis. |
| **I4** | **Mbak Ika** | PM Commerce | `ikapratiwi@company.com` | Validator PRD, Keputusan Produk, Handover Suksesor. |

---

## 7. Spesifikasi Lengkap Kontrak REST API / Webhook

Seluruh request wajib menyertakan header:
`X-KMS-API-KEY: secret-kms-token-2026`

### 1. Ingest Email (Async)
- **Endpoint:** `POST /webhook/ingest-email`
- **Request Body:** Objek JSON email sintetis (struktur proyek, pesan, lampiran, dan link Drive).
- **Immediate Response (<1 detik):**
  ```json
  {
    "success": true,
    "candidate_id": "CAND-20261015-001",
    "status": "processing",
    "message": "Email ingestion initiated. Poll /webhook/candidate-status for completion."
  }
  ```

### 2. Polling Status Ingest
- **Endpoint:** `GET /webhook/candidate-status?id=CAND-20261015-001`
- **Response (Saat Selesai):**
  ```json
  {
    "candidate_id": "CAND-20261015-001",
    "status": "pending_validation", // "processing" | "pending_validation" | "already_exists" | "already_pending"
    "curated_summary": {
      "title": "Update UI Search Result Video",
      "summary": "...",
      "owner_pic": "ikapratiwi@company.com",
      "division": "Commerce",
      "effective_date": "2026-01-13",
      "has_sensitive_data": false,
      "access_recipients": ["aan.supervisor@company.com", "ikapratiwi@company.com", "milis-data@company.com"]
    }
  }
  ```

### 3. Validasi Knowledge
- **Endpoint:** `POST /webhook/validate-knowledge`
- **Request Body:**
  ```json
  {
    "candidate_id": "CAND-20261015-001",
    "action": "approve", // "approve" | "edit_approve" | "reject" | "handover"
    "validator_role": "PM",
    "validator_email": "ikapratiwi@company.com",
    "patched_fields": {
      "title": "Update UI Search Result Video [Revisi PM]",
      "restricted_recipients": ["aan.supervisor@company.com", "ikapratiwi@company.com"]
    },
    "handover_to": null,
    "notes": "Disetujui untuk rilis Q1."
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "candidate_id": "CAND-20261015-001",
    "new_status": "approved",
    "qdrant_point_id": "7f8b1c4a-92bc-4180-87a3-2c1b7593b451"
  }
  ```

### 4. Nudge Pengingat PIC
- **Endpoint:** `POST /webhook/nudge-pic`
- **Request Body:**
  ```json
  {
    "candidate_id": "CAND-20261015-001",
    "sender_email": "aan.supervisor@company.com",
    "target_pic": "fanda.analyst@company.com",
    "message": "Mohon segera divalidasi spesifikasi Ramadan sebelum sprint planning."
  }
  ```
- **Response:** `{ "success": true, "message": "Nudge logged successfully." }`

### 5. Chatbot RAG Berbasis Hak Akses
- **Endpoint:** `POST /webhook/chat-rag`
- **Request Body:**
  ```json
  {
    "chatInput": "Berapa nomor commit Git dan script tracking untuk video vertical?",
    "user_email": "aan.supervisor@company.com"
  }
  ```
- **Response:**
  ```json
  {
    "output": "Berdasarkan UAT Detiksearch, nomor commit Git adalah GIT-COMMIT-001 (desktop) dan GIT-COMMIT-002 (mobile)...",
    "citations": [
      {
        "knowledge_id": "KNOWLEDGE-001",
        "title": "Update UI Search Result Video",
        "source_doc": "DOC-002",
        "validator": "ikapratiwi@company.com",
        "effective_date": "2026-01-13"
      }
    ]
  }
  ```

### 6. Ringkasan Eksekutif Lead
- **Endpoint:** `GET /webhook/lead-summary`
- **Response:** Objek metrik KPI, daftar bottleneck aging, sebaran divisi, dan log audit terkini.

---

## 8. Prioritas & Roadmap Implementasi

Berikut 5 fase implementasi bertahap (*phased delivery*):

```text
[ FASE 1: Backend Data Tables & Ingestion Asynchronous ] ───────── (P1 - Kritis)
  ├── 1.1 Buat Data Tables di n8n: `kms_candidates` dan `kms_validation_logs`
  ├── 1.2 Pasang Header Auth (`X-KMS-API-KEY`) pada webhook publik n8n
  ├── 1.3 Modifikasi `dummy knowledge management`:
  │     - Ingestion asynchronous (respons cepat + eksekusi background)
  │     - Filter email FR1/FR2 & ekstraksi tautan Drive FR3
  │     - Simpan hasil kurasi ke `kms_candidates` status `pending_validation`
  └── 1.4 Verifikasi: Kirim JSON sintetis ➔ Data tersimpan di Data Table tanpa timeout

[ FASE 2: Validasi Human-in-the-Loop & Persistensi Qdrant ] ─────── (P1 - Kritis)
  ├── 2.1 Buat workflow n8n `validate_knowledge`:
  │     - Guard idempotensi (anti double-approve)
  │     - Logika patching payload sebelum dikirim ke writer
  │     - Integrasi ke `knowledge_writer_upsert` (Qdrant chunks + store)
  │     - Flagging `is_superseded: true` untuk entri versi lama
  │     - Penanganan aksi: `approve`, `edit_approve`, `reject`, `handover`
  └── 2.2 Verifikasi: Approval menghasilkan poin Qdrant ber-metadata hak akses

[ FASE 3: Access Control Chatbot & Endpoint Lead Summary ] ──────── (P2 - Tinggi)
  ├── 3.1 Perbarui `RagChatQdrant20260811`:
  │     - Tambahkan filter Qdrant berbasis `user_email` dan `is_superseded: false`
  ├── 3.2 Buat workflow n8n `lead_summary` (Agregasi metrik KPI via Code Node)
  ├── 3.3 Buat workflow n8n `nudge_pic`
  └── 3.4 Verifikasi: Pengujian hak akses isolasi antar staf

[ FASE 4: Pengembangan Frontend Web UI (SPA 4 Komponen) ] ────────── (P2 - Tinggi)
  ├── 4.1 Inisiasi Web App SPA (React + Vite + TailwindCSS)
  ├── 4.2 Pasang Global Profile Selector (I1 Mas Aan, I2 Mbak Fanda, I3 Dila, I4 Mbak Ika)
  ├── 4.3 Bangun Komponen 1: Form Ingest Email + Polling Status Real-time
  ├── 4.4 Bangun Komponen 2: Antarmuka Validasi 1-Klik + Modal Edit + Checklist Akses
  ├── 4.5 Bangun Komponen 3: Antarmuka Chatbot RAG dengan Sitasi Dokumen
  └── 4.6 Bangun Komponen 4: Dashboard Ringkasan Eksekutif untuk Lead

[ FASE 5: Pengujian Skenario Riset & Penyusunan Laporan ] ────────── (P3 - Evaluasi)
  ├── 5.1 Eksekusi 7 skenario sintetis dari wawancara (Ramadan, Reschedule, Milis, VPN)
  ├── 5.2 Pencatatan bukti audit dan metrik performa untuk Section III paper
  └── 5.3 Finalisasi dokumentasi artefak untuk lampiran publikasi
```

### Matriks Kesiapan & Dependensi:

| Modul | Komponen Teknis | Prioritas | Kompleksitas | Dependensi |
| :--- | :--- | :---: | :---: | :--- |
| **Staging Data** | n8n Data Tables (`kms_candidates`, `kms_validation_logs`) | **P1** | Rendah | Tidak ada (native n8n) |
| **Ingestion** | Async Webhook + Dual Deduplication + Drive Extraction | **P1** | Menengah | n8n Data Tables |
| **Validation** | Workflow `validate_knowledge` + Patch Payload + Idempotensi | **P1** | Menengah | `knowledge_writer_upsert` |
| **Chatbot Guard** | Filter `access_recipients` & `is_superseded` di Qdrant | **P2** | Rendah | `saved_knowledge` & Qdrant |
| **Lead Summary** | Workflow `lead_summary` (Agregasi Code node) | **P2** | Rendah | n8n Data Tables |
| **Frontend UI** | SPA 4 Komponen + Profile Selector (React/Tailwind) | **P2** | Menengah | Endpoint n8n Fase 1–3 |
| **Evaluasi Paper** | Pengujian 4 informan & skenario sintetis wawancara | **P3** | Rendah | Frontend & Backend terhubung |
