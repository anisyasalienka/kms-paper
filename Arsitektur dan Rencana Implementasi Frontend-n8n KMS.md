# Arsitektur & Rencana Implementasi Frontend–n8n KMS
*Email-to-Knowledge Management System dengan Human-in-the-Loop Validation & Lead Monitoring*

**Versi:** 2.7.1 (nilai tersamar tetap bisa dicari chatbot: aturan "Masked values" di extractor dan pengaman fakta di kurasi). Versi 2.7: redaksi data sensitif sebelum LLM untuk NFR4, uji kebocoran s3b/s4/s7. Versi 2.6.1: kriteria eksklusi FR1 dilengkapi (laporan rutin, notifikasi deploy, balasan IT support, plus pengecualian; uji s6a–s6e), keputusan lingkup requirement. Versi 2.6: sumber Google Drive (folder & PDF); restrukturisasi pipeline ingest: kurator dipisah dari agen, evidence dikumpulkan deterministik; model kurator flash; hasil uji regresi s0–s4  
**Tanggal:** 19 Oktober 2026  
**Lokasi Dokumen:** `/home/cendi/kms-paper-nisya/Arsitektur dan Rencana Implementasi Frontend-n8n KMS.md`  
**Referensi Riset:** `Analisis Tematik & Requirement Workflow KMS.md` (FR1–FR8, GR1–GR7, NFR1–NFR4)  
**Versi sebelumnya:** `...v2.0.bak.md`, `...v2.1.bak.md`, `...v2.5.bak.md` (cadangan v2.2–v2.4 tidak tersimpan; isi dan pemicunya direkonstruksi dari transkrip sesi, lihat bagian 10)

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Dokumen ini merupakan cetak biru arsitektur dan rencana teknis **Frontend Web KMS** dengan **n8n sebagai backend API headless**. Sistem mengintegrasikan ingestion email otomatis, validasi pemilik pengetahuan (*Human-in-the-Loop*), penelusuran semantik ber-sitasi (*Chatbot RAG*), dan ringkasan tata kelola untuk supervisor (*Lead Monitoring*).

Prinsip desain v2.6:

1. **Staging di n8n Data Tables.** Tidak ada node SQLite di n8n v2.27.3. Qdrant hanya berisi pengetahuan yang sudah divalidasi.
2. **Identitas pseudonim berbasis tim.** Tiga tim (A, B, C), masing-masing 3 staff dan 1 SPV. Tidak ada nama asli informan di sistem.
3. **Owner = pengirim.** Kandidat pengetahuan hanya dapat divalidasi oleh pengirim email aslinya (staff atau SPV).
4. **Akses dihitung deterministik dari header email**, tidak oleh LLM, dan dibekukan saat ingest sebagai daftar user (`access_users`).
5. **Ingest asynchronous + polling.** Kurasi umumnya berlangsung 30–120 detik (lihat hasil uji di bagian 8); pola sinkron tetap berisiko terputus oleh Cloudflare (HTTP 524, batas ±100 detik).
6. **API key tidak pernah sampai ke browser.** nginx meneruskan `/api/*` ke n8n dan menyisipkan header `X-KMS-API-KEY`.
7. **Integritas validasi.** Lock status `approving` mencegah double-approve, suntingan validator di-patch ke payload sebelum embedding, semua aksi tercatat di audit log.
8. **Siklus status lengkap**, termasuk `skipped`, `failed`, dan `superseded`, sehingga tidak ada entri menggantung dan KPI dashboard akurat.
9. **5-Layer Dedup & Ingest Guard.** Mencegah *false update* (email baru menimpa knowledge lama yang tak terkait akibat kemiripan semantik lemah): batasan akses pencarian dedup, ambang batas skor minimum (≥0.65), prompt kurator ketat, pengaman deterministik canvas, serta opsi validasi `approve_as_new`.
10. **Klasifikasi Cerdas & Auto-Skip Non-Knowledge (FR1/FR2).** Email yang bukan pengetahuan organisasi (izin cuti pribadi, obrolan santai, laporan rutin harian/mingguan/bulanan, notifikasi deploy, balasan IT support, notifikasi server otomatis, undangan kalender, pengumuman HR rutin) langsung disaring oleh `inspect_email` di langkah pertama tanpa memanggil Qdrant, ekstraktor, atau kurator, dan otomatis berstatus `skipped` dalam <15 detik. Email yang tampak rutin tetap diproses bila mencatat isu dan perbaikannya, keputusan, perubahan jadwal, atau prosedur yang bisa dipakai ulang (pengecualian dari temuan T2). Kriteria lengkap ada di `docs/workflows/kms_evidence_agent.md`. `project_name` bersifat opsional agar email operasional/SOP umum tidak dipaksa mengarang nama proyek.
11. **LLM merutekan, kode merakit evidence.** Agen orchestrator hanya memanggil tool dan berhenti dengan `evidence_ready`. Node kode `Collect Evidence` merakit evidence kurator langsung dari hasil tool yang asli, lalu kurator dipanggil sekali di luar agen. Tidak ada evidence yang diketik ulang oleh LLM, sehingga nilai teknis tidak berubah di tengah jalan dan latensi turun.
12. **Sumber Google Drive.** Tautan folder Drive dan PDF di Drive dibaca seperti tautan Google Docs/Sheets. Folder hanya didaftar (bukan dibaca); setiap file diteruskan ke reader yang sesuai. File yang tidak dibaca atau tidak relevan tetap disitasi sebagai referensi, tetapi tidak menjadi fakta.
13. **Model tidak pernah menerima data sensitif mentah (NFR4).** Workflow `redact_sensitive_data` (satu-satunya tempat aturan redaksi), dipanggil dari `kms_ingest` dan ketiga reader Google, menyamarkan kredensial dan data pribadi terstruktur sebelum teks diserahkan ke model cloud. Label seperti `[KREDENSIAL: Vpn#****]` dibawa sampai kurator, lalu diubah menjadi teks tersamar dan dicatat di `sensitive_audit` untuk validator (GR7). Aturan dan batasannya ada di `docs/workflows/redact_sensitive_data.md`.

---

## 2. Keputusan Tempat Penyimpanan Staging

n8n v2.27.3 yang terpasang **tidak memiliki node SQLite**. Memaksakan SQLite lewat Code node membutuhkan `NODE_FUNCTION_ALLOW_EXTERNAL` yang rapuh, dan file SQLite tambahan di `/home/cendi/n8n/data/` berisiko tertukar dengan `database.sqlite` milik n8n.

**Keputusan: n8n Data Tables.** Bawaan n8n, tanpa kontainer atau kredensial tambahan, cukup untuk puluhan hingga ratusan entri, dan agregasi KPI dapat dihitung oleh satu Code node. Kandidat yang belum di-approve tidak pernah menyentuh Qdrant, sehingga chatbot tidak dapat membaca draf.

*(Catatan paper: bila evaluasi membutuhkan SQL murni, satu kontainer PostgreSQL terisolasi dapat ditambahkan tanpa mengganggu service lain.)*

---

## 3. Identitas, Role, dan Aturan Akses

### 3.1 Direktori

| Tim | Staff | Supervisor | Alamat email tim |
| :--- | :--- | :--- | :--- |
| A | `STAFF-1A`, `STAFF-2A`, `STAFF-3A` | `SPV-A` | `TEAM-A` |
| B | `STAFF-1B`, `STAFF-2B`, `STAFF-3B` | `SPV-B` | `TEAM-B` |
| C | `STAFF-1C`, `STAFF-2C`, `STAFF-3C` | `SPV-C` | `TEAM-C` |

Email sintetis memakai ID ini langsung sebagai pengirim/penerima. Alamat tim (`TEAM-x`) bukan user, melainkan milis yang berarti seluruh anggota tim tersebut.

### 3.2 Role

| Role | Hak | Halaman UI |
| :--- | :--- | :--- |
| **Staff** | Memvalidasi kandidat dari email yang ia kirim; handover kepemilikan; chatbot. | Ingest, Kandidat Saya, Chatbot |
| **SPV** | Semua hak staff (SPV kadang menjadi pengirim email knowledge) **ditambah** monitoring tim sendiri dan nudge. | Ingest, Kandidat Saya, Chatbot, Monitoring |

Aturan validasi (GR1):
- Antrean **"Kandidat Saya"** berisi kandidat yang pengirim pertamanya adalah user aktif.
- Approve / Edit & Approve / Reject / Handover hanya oleh `owner_pic`. Selain itu ditolak HTTP 403.
- SPV tidak dapat memvalidasi kandidat milik staff. Jika staff tidak responsif, SPV mengirim nudge.

### 3.3 Aturan Akses Pengetahuan (hasil wawancara)

Akses dihitung dari header email (pengirim, to, cc) dengan tiga aturan:

1. **Orang yang disebut langsung** (pengirim, to, cc personal) mendapat akses.
2. **Alamat tim** di to/cc memberi akses ke **seluruh anggota tim** tersebut.
3. **SPV selalu tahu.** SPV dari setiap tim yang terlibat (tim milik orang yang disebut, atau tim yang alamatnya di-cc) mendapat akses.

| Skenario | Header | Akses |
| :--- | :--- | :--- |
| 1 | `STAFF-1A` → `STAFF-2A`, cc `SPV-A` | STAFF-1A, STAFF-2A, SPV-A. STAFF-3A **tidak** |
| 2 | `SPV-A` → staff mana pun, cc `TEAM-A` | Seluruh tim A |
| 3a | `STAFF-xA` → `STAFF-yC`, cc `TEAM-A` dan `TEAM-C` | Seluruh tim A dan tim C |
| 3b | `STAFF-xA` → `STAFF-yC`, cc beberapa orang | Orang yang disebut + SPV-A + SPV-C |

Daftar akses dibekukan saat ingest (`access_users`), sehingga perubahan keanggotaan tim di kemudian hari tidak mengubah akses pengetahuan yang sudah ada. Validator tidak dapat mengubah daftar akses. Email dummy tiap skenario ada di `dummy-emails/` beserta README ekspektasinya.

---

## 4. Desain Skema n8n Data Tables

Data Tables otomatis menyediakan kolom `id`, `createdAt`, dan `updatedAt`.

### 4.1 `kms_directory`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `user_id` | `string` | `STAFF-1A` … `SPV-C`. |
| `role` | `string` | `staff` / `spv`. |
| `team` | `string` | `TEAM-A` / `TEAM-B` / `TEAM-C`. |
| `display_label` | `string` | Label UI, misal "Staff 1A (Tim A)". |

### 4.2 `kms_candidates`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `candidate_id` | `string` | ID unik (misal `CAND-20261015-2H9N1V`). |
| `source_id` | `string` | ID email sumber (misal `EMAIL-S1`), dipakai untuk deduplikasi. |
| `project_name` | `string` | Proyek terkait, disimpulkan kurator dari isi email (input email tidak memuat project). `project_id` tidak lagi diisi. |
| `title`, `summary` | `string` | Hasil kurasi (Bahasa Indonesia). |
| `knowledge_type` | `string` | `PRD`, `UAT`, `Decision`, `IncidentResolution`, `Handover`, `TrackingSpec`, `Other`. |
| `product_or_channel` | `string` | Produk/kanal terkait. |
| `owner_pic` | `string` | Pengirim pesan pertama (GR1). |
| `owner_team` | `string` | Tim pemilik, dipakai dashboard SPV. |
| `effective_date` | `string` | `YYYY-MM-DD`. |
| `access_recipients` | `string` | JSON array ID mentah dari header (orang + alamat tim). |
| `access_users` | `string` | JSON array user yang berhak mengakses, hasil aturan 3.3 (GR4). |
| `has_sensitive_data` | `boolean` | Deteksi kredensial/PII/komersial (GR7). |
| `sensitive_details` | `string` | JSON item sensitif (nilai sudah dimasking). |
| `curated_payload` | `string` | JSON lengkap output curator (termasuk `structured_details`). |
| `status` | `string` | Lihat 4.4. |
| `error_message` | `string` | Pesan error untuk `failed`, atau catatan penulisan Qdrant gagal. |
| `existing_knowledge_id` | `string` | ID knowledge lama bila ini pembaruan. |
| `knowledge_id`, `qdrant_point_id` | `string` | Terisi setelah approved. |
| `superseded_by` | `string` | `candidate_id` pengganti bila tergantikan. |
| `duplicate_of` | `string` | Rujukan kandidat/knowledge yang sudah ada (`already_pending` / `already_exists`). |
| `submitted_by` | `string` | User yang mengirim lewat Komponen 1. |

### 4.3 `kms_validation_logs`

| Kolom | Tipe | Keterangan |
| :--- | :--- | :--- |
| `log_id` | `string` | ID unik log. |
| `candidate_id` | `string` | Relasi ke kandidat. |
| `action` | `string` | `approve`, `edit_approve`, `reject`, `handover`, `nudge`. |
| `actor_user_id`, `actor_role` | `string` | Pelaku aksi. |
| `changes_summary` | `string` | JSON perubahan "dari → ke" (judul, ringkasan, tanggal, owner). |
| `notes` | `string` | Alasan reject, catatan approve, pesan handover/nudge. |

### 4.4 Siklus Status `kms_candidates`

```text
processing ──┬──> pending_validation ──> approving ──┬──> approved ──> superseded
             │            │                          └──> pending_validation (jika tulis Qdrant gagal)
             │            └──> rejected
             ├──> skipped          (inspect_email: bukan pengetahuan, FR1/FR2)
             ├──> already_exists   (sumber sudah approved di Qdrant)
             ├──> already_pending  (sumber yang sama sedang diproses/pending)
             └──> failed           (pengirim tidak terdaftar, error LLM/Google API, atau >10 menit)
```

---

## 5. Keamanan Webhook & Integrasi Cloudflare

1. **Header Authentication.** Semua webhook KMS memakai credential Header Auth `X-KMS-API-KEY`. Request tanpa header valid ditolak (HTTP 403). Nilai kunci ada di `/home/cendi/n8n/.env` (`KMS_API_KEY`), tidak ditulis di dokumen, repositori, maupun kode frontend.
2. **Reverse proxy nginx.** Frontend (build statis) dan API satu domain. nginx meneruskan `/api/<path>` ke `n8n:5678/webhook/<path>` dan menyisipkan header dari sisi server. Karena satu origin, CORS tidak dibuka. CORS bukan mekanisme keamanan dan tidak diandalkan. Saat pengembangan, proxy Vite melakukan hal yang sama.
3. **Proteksi halaman UI** dengan Cloudflare Access atau basic auth nginx.
4. **Threat to validity (paper).** Autentikasi pengguna akhir diabstraksikan menjadi profile selector pseudonim. Identitas yang dikirim frontend dipercaya backend, agar evaluasi berfokus pada orkestrasi KM dan tata kelola validasi.

---

## 6. Arsitektur 4 Komponen Frontend Web

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND WEB (SPA, build statis)                              │
│  [ Profile: STAFF-1A … STAFF-3C | SPV-A, SPV-B, SPV-C ]   (tanpa API key di browser)   │
└───────┬────────────────────────┬───────────────────────┬───────────────────────┬───────┘
   (1) Ingest & Poll        (2) Kandidat Saya       (3) Chatbot Q&A         (4) Monitoring
   [Staff & SPV]            [owner = pengirim]      [Staff & SPV]           [SPV, tim sendiri]
        ▼                        ▼                       ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│      nginx (same origin)  /api/*  ──>  n8n /webhook/*  + sisip header X-KMS-API-KEY    │
└────────────────────────────────────────────────────────────────────────────────────────┘
        ▼                        ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Ingest          │    │validate_knowledge│    │  chat-rag        │    │   lead_summary   │
│  - Resolve akses │    │- Cek owner       │    │- Filter          │    │  (KPI tim)       │
│  - Dedup 2-arah  │    │- Lock "approving"│    │  access_users    │    │  nudge           │
│  - Agen→Evidence │    │- Patch + Writer  │    │  (deterministik) │    └────────┬─────────┘
└───────┬──────────┘    └────────┬─────────┘    └────────┬─────────┘             │
        ▼                        ▼                       ▼                       ▼
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────────┐
│             n8n DATA TABLES              │    │                  QDRANT                  │
│ - kms_directory (user, role, tim)        │    │ - knowledge (chunks + access_users)      │
│ - kms_candidates (staging & status)      │───>│ - knowledge_store (detail + access_users)│
│ - kms_validation_logs (audit trail)      │    │ (Hanya APPROVED, versi terbaru)          │
└──────────────────────────────────────────┘    └──────────────────────────────────────────┘
```

---

### Komponen 1: Input JSON Email (Ingestion)

- **Async + polling.**
  1. Pengguna mengisi Form Builder atau menempelkan JSON di tab Raw JSON, lalu UI memanggil `POST /api/ingest-email`. Pengirim email utama otomatis terisi dari akun profil aktif pengguna yang sedang login (tanpa dropdown manual), menjaga kepatuhan aturan GR1 (owner = pengirim). Input berupa satu thread email (`source_id`, `subject`, `messages[]` dengan `from`, `to`, `cc`, `subject`, `body`, `attachments`) dan **tidak memuat project**. Kurator menyimpulkan `project_name` dari isi email (FR4) dan bernilai `null` untuk email umum, SOP, atau koordinasi lintas tim. Format ini mensimulasikan email setelah dinormalisasi konektor (alamat sudah dipetakan ke ID direktori, body sudah teks biasa).
  2. n8n memvalidasi body, membaca direktori, menghitung `owner_pic`, `owner_team`, dan `access_users` (aturan 3.3), membuat row status `processing`, dan **langsung membalas (±1,5 detik)**.
  3. Pengirim yang tidak ada di direktori langsung berstatus `failed`.
  4. Pipeline AI berjalan setelah respons terkirim (rincian di bawah). Jika `inspect_email` mendeteksi kriteria eksklusi (misalnya izin cuti, laporan rutin, notifikasi deploy, balasan IT support), orchestrator langsung mengembalikan `is_knowledge: false` tanpa memanggil Qdrant atau kurator, dan row staging langsung berstatus `skipped`.
  5. UI polling `GET /api/candidate-status?id=...` setiap 4 detik hingga status bukan `processing`. Kartu menampilkan menit berjalan; setelah 8 menit polling berhenti dan UI menampilkan "Masih diproses lebih lama dari biasanya". Di backend, row `processing` lebih dari 10 menit otomatis dilaporkan `failed`.
  6. Tampilan hasil: `pending_validation` (kartu ringkasan), `skipped` (bukan pengetahuan + alasan jelas), `already_exists` / `already_pending` (info duplikat), `failed` (pesan error + coba lagi).
- **Deduplikasi 2-arah & 5-Layer Ingest Guard:**
  1. *Staging Dedup (Data Table):* `source_id` yang sama sedang `processing`/`pending_validation`/`approving` → `already_pending`.
  2. *Scoped Retrieval (Qdrant via `saved_knowledge`):* Pencarian semantik dibatasi hanya pada dokumen yang ada dalam `access_users` pengirim (`owner_pic`), mencegah pengguna me-revisi dokumen tim lain yang di luar hak aksesnya.
  3. *Ambang Skor Kemiripan (`min_related_score: 0.65`):* Mencegah *nearest neighbor* acak. Kemiripan lemah (<0.65, misal newsletter vs Ramadan yang berjarak 0.43) dikembalikan sebagai `noMatch`.
  4. *Prompt Kurator Ketat:* Bagian `## Unrelated saved knowledge` mewajibkan kurator mengabaikan kemiripan semantik semu dan hanya menetapkan `updated_candidate` jika subjek/fitur/dokumen sama persis.
  5. *Pengaman Deterministik Canvas:* Node `Build Candidate Update` memverifikasi integritas rujukan pembaruan sebelum mencatat ke staging.
  6. *Thread lanjutan (`message_ids`):* Setiap knowledge menyimpan `message_ids` thread sumbernya (ditulis oleh kode, bukan LLM). `saved_knowledge` hanya mengembalikan `exact_source` bila `source_id` sama **dan** semua `message_id` sudah tersimpan. Thread yang bertambah balasan setelah di-approve ditandai `thread_continuation`, lalu `Build Curator Request` meminta kurator membuat `updated_candidate` untuk knowledge tersebut. Knowledge lama tanpa `message_ids` tetap diperlakukan exact. Batasan: deteksi ini bergantung pada knowledge lama muncul di 5 hasil teratas pencarian semantik.
- **Pipeline AI (v2.6):**

  ```text
  kms_ingest:          ... Respond Accepted (202) ─> Should Process? ─> Run Evidence Agent ─> Run Curation ─> Retry Agent? ─> Update Candidate Row
                                                                         │                    │
  kms_evidence_agent:  Candidate Context ─> Current Email ─> Evidence Agent (orchestrator, returnIntermediateSteps)
                         ├─ inspect_email ─ saved_knowledge ─ list_attachments
                         ├─ gdrive_folder_lister (tautan folder)
                         ├─ document_extractor ─ gdocs_reader / gdrive_pdf_reader
                         └─ spreadsheet_extractor ─ gsheets_reader
                       └─> Package Agent Result {output: "evidence_ready", intermediateSteps}
                                                                                              │
  kms_curate_stage:    Collect Evidence ─> Needs Curator? ─┬─> Curator Prompt ─> Build Curator Request ─> Run Curator LLM (kms_curator_llm)
                                                            └─> (langsung: skipped / already_exists / incomplete)
                       ─> Parse Curator Output ─> Build Candidate Update  (error ─> Stage Failed)
  ```

  Pipeline dipecah menjadi tiga workflow (16 Oktober 2026) agar setiap tahap dapat ditampilkan dan dipahami terpisah. Dokumentasi per workflow ada di `docs/workflows/`.

  1. *Orchestrator hanya merutekan.* Agen (di `kms_evidence_agent`) memanggil tool sesuai aturan, lalu berhenti dengan `{"status": "evidence_ready"}`. Agen tidak lagi memanggil kurator sebagai tool, sehingga tidak perlu mengetik ulang seluruh hasil ekstraksi ke kurator dan mengulang jawaban kurator (sebelumnya ±75 detik per email hanya untuk menyalin teks).
  2. *`Collect Evidence` (deterministik, di `kms_curate_stage`).* Node kode membaca `intermediateSteps` agen (hasil tool yang asli) dan merakit evidence: `current_email` (email asli tanpa isi lampiran), `email_findings`, `saved_knowledge`, `attachments`, `document_results`, `spreadsheet_results`. Node ini juga:
     - memangkas `text`/`rows` mentah bila ekstraktor sudah menghasilkan `structured_details` atau `extracted_facts` (batas 6.000 karakter / 40 baris bila tidak);
     - meringkas tetangga `saved_knowledge` lain menjadi pratinjau (payload lengkap hanya untuk kecocokan teratas, yang dibutuhkan untuk merge pembaruan);
     - memindahkan sumber bertanda `relevant_to_email: false` dan file folder yang tidak dibaca (`listed_not_read`) ke referensi saja;
     - menegakkan dedup `exact_source` langsung dari hasil `saved_knowledge`, sehingga kekeliruan model tidak dapat membuat duplikat;
     - mengarahkan ke `incomplete` (dapat di-retry) bila agen berhenti tanpa `evidence_ready`.
  3. *Kurator sebagai panggilan LLM tunggal.* Prompt kurator ada di node Set `Curator Prompt` (dapat disunting di UI n8n). `Build Curator Request` menyusun request chat completion; node `Run Curator LLM` menjalankan sub-workflow `kms_curator_llm` yang memanggil 9router lewat jaringan Docker internal (`http://9router:20128`), sehingga batas ±100 detik Cloudflare (HTTP 524) tidak berlaku, dengan 1 kali retry otomatis. Model kurator: `ag/gemini-3.8-flash` (lihat uji A/B di bagian 8).
  4. *Sumber deterministik.* `Parse Curator Output` menambahkan folder Drive (`gfolder:*`) dan referensi saja (`reference_only: true`) ke `sources`, serta melengkapi URL sumber yang dibaca, tanpa bergantung pada LLM. Sumber referensi saja dan folder tidak menjadi kunci dedup di Qdrant (`source_ids`), agar email berikutnya yang membagikan folder sama dengan dokumen baru tidak dianggap duplikat.
- **Sumber Google Drive:**
  - `inspect_email` mendeteksi tautan folder (`drive.google.com/drive/folders/<id>` → `gfolder:<id>`) dan file Drive (`drive.google.com/file/d/<id>` → `gpdf:<id>`), selain Google Docs (`gdoc:`) dan Sheets (`gsheet:`).
  - `gdrive_folder_lister` mendaftar file PDF, Google Docs, dan Google Sheets di level teratas folder lewat Drive API (`files.list`). Subfolder dan tipe lain dilaporkan di `skipped`. Tool ini hanya mendaftar tautan, tidak membaca isi.
  - Orchestrator membaca maksimal 5 file per folder, memilih yang namanya paling sesuai dengan email, dan melewati file yang jelas tidak terkait (misal CV pribadi).
  - `gdrive_pdf_reader` memeriksa metadata (harus PDF, maksimal 20 MB), mengunduh file, lalu mengekstrak lapisan teks dengan node *Extract from File* tanpa LLM. PDF hasil scan (tanpa lapisan teks) dikembalikan `extraction_status: empty` (`no_text_layer`) dan hanya disitasi sebagai tautan; isinya tidak ditebak.
  - Akses: folder/file cukup dibagikan "Anyone with the link (Viewer)". Credential service account `Google SA - docs reader` memerlukan scope `drive.readonly`.
  - *Catatan paper:* pengetahuan dari folder mewarisi `access_users` email (dibekukan saat ingest), bukan izin berbagi Drive.
- **Validasi ekstraktor:** ekstraktor menolak permintaan tanpa `attachment_id`/`source_id` (`missing_source`) tanpa memanggil reader, tidak pernah meneruskan tautan folder ke reader, dan selalu mengisi `relevant_to_email` + `relevance_reason`.
- **Retry otomatis:** bila orchestrator berhenti di tengah (model menulis pemanggilan tool sebagai teks biasa) atau output kurator tidak dapat di-parse, workflow mengulang agen hingga 2 kali sebelum menandai `failed`. Kegagalan pemanggilan kurator setelah retry langsung menandai `failed`.
- **Bahasa:** judul, ringkasan, fakta, kondisi ditulis dalam Bahasa Indonesia. Kode, nama event, ID, URL, dan istilah teknis disalin apa adanya.

### Komponen 2: Kandidat Saya (Human-in-the-Loop)

- **Requirement:** GR1 (validasi oleh pemilik), GR6 (handover), GR7 (verifikasi masking), NFR2 (review 1 tindakan).
- **Antrean:** hanya kandidat dengan `owner_pic === user aktif`.
- **Layar review 1 tindakan & Sitasi IEEE (FR8):** ringkasan, tanggal efektif, banner sensitif (GR7) dengan teks termasking, daftar siapa saja yang akan mendapat akses (`access_users`, informatif, tidak dapat diubah), accordion detail teknis (tracking, requirement, UAT), serta penanda visual bila kandidat dideteksi sebagai pembaruan knowledge lama.
  * **Grounding Sitasi Bergaya IEEE:** Setiap butir fakta terverifikasi dan konflik antarsumber disitasi secara inline menggunakan penomoran numerik `[1]`, `[2]` yang dapat diklik langsung.
  * **Daftar Referensi Sumber (IEEE Style):** Bagian bawah kartu menyajikan katalog sumber bernomor lengkap: tipe sumber (Email, Google Docs, Google Sheets, PDF (Google Drive), Folder Google Drive, Dokumen, Spreadsheet), judul/nama sumber, ID sumber, serta tautan langsung untuk dokumen eksternal (`gdoc:*`, `gsheet:*`, `gpdf:*`, `gfolder:*`). Sumber `reference_only` (file folder yang tidak dibaca atau tidak relevan) tetap tercantum agar validator dapat memeriksanya.
- **Aksi (`POST /api/validate-knowledge`):**
  0. **Otorisasi:** user harus ada di direktori, role `staff`/`spv`, dan sama dengan `owner_pic`; status harus `pending_validation`.
  1. **Approve:** lock `pending_validation → approving` (request paralel kedua mendapat 409), panggil `knowledge_writer_upsert` dengan `access_users`, lalu status `approved` + `knowledge_id` + `qdrant_point_id`. Bila merupakan update yang valid, versi lama ditandai `superseded`. Bila writer gagal, status kembali `pending_validation` (HTTP 502).
  2. **Approve as New (`approve_as_new`):** Jika AI keliru mendeteksi sebagai pembaruan (atau validator ingin memisahkan entitas), validator menyetujui sebagai entri independen. Tautan `existing_knowledge_id` dihapus, ID baru dibuat, dan knowledge lama tidak di-supersede.
  3. **Edit & Approve:** judul, ringkasan, tanggal efektif di-patch ke `curated_payload` sebelum embedding. Perubahan "dari → ke" dicatat.
  4. **Reject:** alasan wajib.
  5. **Handover (GR6):** owner memindahkan kepemilikan ke staff/SPV lain. Owner lama langsung kehilangan hak validasi.

### Komponen 3: Chatbot Q&A dengan Kontrol Akses (GR4)

- **Filter deterministik.** Workflow `chat-rag` menerima `user_id` dari frontend dan meneruskannya ke tool pencarian sebagai nilai tetap dari workflow (bukan `$fromAI`). LLM hanya mengisi query, sehingga tidak dapat melewati filter.
- **Filter Qdrant** (berlaku untuk `saved_knowledge` mode chat **dan** `get_knowledge_detail`):
  ```json
  { "filter": { "must": [ { "key": "access_users", "match": { "any": ["STAFF-3A"] } } ] } }
  ```
  `saved_knowledge` menerima `user_id` opsional. Jika kosong (dipanggil oleh ingest untuk deduplikasi), filter tidak diterapkan.
- **Pembaruan (FR6).** Writer memakai `knowledge_id` yang sama, menghapus chunk lama, dan menulis versi gabungan terbaru. Qdrant tidak pernah menyimpan dua versi aktif. Row kandidat lama berubah `superseded`, `superseded_by` terisi, dan versi lama tetap dapat diaudit lewat `curated_payload`.
- **Sitasi (FR8):** judul, ID email/lampiran sumber, tanggal efektif, dan validator (ID pseudonim).
- **Bukti evaluasi:** skenario 1 menunjukkan STAFF-3A tidak mendapatkan jawaban dari email yang hanya melibatkan STAFF-1A, STAFF-2A, dan SPV-A.

### Komponen 4: Monitoring (SPV, tim sendiri)

- **Requirement:** GR2 (ringkasan berkala pending, rejected, outdated).
- **Cakupan:** kandidat yang `owner_team` = tim SPV, atau yang `access_users`-nya melibatkan SPV tersebut.
- **Kartu KPI:** Approved, Pending, Rejected, Superseded, Failed.
- **Bottleneck & aging:** pending ≥3 hari (judul, kanal, owner, umur).
- **Nudge PIC:** mencatat pengingat di audit log dan menampilkannya di antrean owner. Tidak ada email/notifikasi eksternal pada prototipe ini.
- **Sebaran** per kanal/produk dan **log audit** terbaru tim.
- `GET /api/lead-summary?user_id=SPV-A`: role selain `spv` ditolak. Node *Get rows* memakai `returnAll: true`. Agregasi dilakukan satu Code node.

---

## 7. Kontrak API

Frontend memanggil `/api/<path>`; nginx meneruskan ke `n8n/webhook/<path>` dengan `X-KMS-API-KEY`. Setiap request menyertakan `user_id` profil aktif. Kode error: `400` (input tidak valid), `403` (API key/role/kepemilikan), `404` (tidak ditemukan), `409` (status tidak sesuai/konflik), `422` (data kandidat rusak), `502` (penulisan Qdrant gagal).

| # | Endpoint | Status | Body / Query | Response utama |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `POST /ingest-email` | ✅ | `{ user_id, email }` | `202 { candidate_id, status, duplicate_of, error }` |
| 2 | `GET /candidate-status?id=` | ✅ | | `{ status, error_message, duplicate_of, curated_summary{ title, summary, owner_pic, owner_team, knowledge_type, product_or_channel, effective_date, has_sensitive_data, access_recipients, access_users } }` |
| 3 | `POST /validate-knowledge` | ✅ | `{ candidate_id, user_id, action, patched_fields{title,summary,effective_date}, handover_to, notes }` *(action: `approve`, `edit_approve`, `approve_as_new`, `reject`, `handover`)* | `{ new_status, knowledge_id, qdrant_point_id, chunks_written, superseded_candidates }` |
| 4 | `GET /directory` | ✅ | | `{ users[{ user_id, role, team, display_label }] }` |
| 5 | `GET /my-candidates?user_id=` | ✅ | | Antrean "Kandidat Saya" |
| 6 | `POST /chat-rag` | ✅ | `{ chatInput, user_id }` | `{ output, citations[] }` |
| 7 | `GET /lead-summary?user_id=` | ✅ | | `{ metrics, pending, bottlenecks, pending_by_owner, distribution_by_channel, distribution_by_type, recent_logs }` |
| 8 | `POST /nudge` | ✅ | `{ candidate_id, user_id, message }` | `{ success, logged }` |

---

## 8. Status Implementasi (Referensi Teknis)

| Item | ID / Lokasi | Status |
| :--- | :--- | :--- |
| Data Table `kms_directory` | `S5KVXAkYgkydP1OY` | 12 user (3 tim) |
| Data Table `kms_candidates` | `kbUIDYKuQb34aXmv` | Aktif |
| Data Table `kms_validation_logs` | `tqzfRLVDBMSKiwec` | Aktif |
| Credential Header Auth | `KMS API Key (X-KMS-API-KEY)` | Aktif |
| Ingest `POST /webhook/ingest-email` | `kms_ingest` (`BiDjvbh6ZdCRDlB6`, dahulu `dummy knowledge management`): intake, akses, dedup staging, balasan 202, retry, tulis hasil | ✅ Fase 1 (5-layer guard; v2.6: dipecah) |
| Agen evidence | `kms_evidence_agent` (`KmsEvidAgent2026`): orchestrator + 6 tool + reader | ✅ v2.6 |
| Tahap kurasi | `kms_curate_stage` (`KmsCurateStg2026`): `Collect Evidence`, kurator, parsing, update kandidat | ✅ v2.6 |
| Kurator LLM | `kms_curator_llm` (`AoK0uKKmiK5peSVp`): HTTP ke `http://9router:20128/v1/chat/completions`, credential `9router token`, retry 1× | ✅ v2.6 |
| Daftar folder Drive | `gdrive_folder_lister` (`JITewMLouD0Lz1dT`), tool orchestrator | ✅ v2.6 |
| Pembaca PDF Drive | `gdrive_pdf_reader` (`ElNyCOiUqBdJJli0`), tool `document_extractor` | ✅ v2.6 (uji mandiri; belum terpakai di uji pipeline penuh) |
| Pembaca Google Docs / Sheets | `gdocs_reader` (`VO3XcHfsCmvZwLax`), `gsheets_reader` (`tYUmV5RKkwsiw6C8`) | ✅ |
| Polling `GET /webhook/candidate-status` | `kms_candidate_status` (`GhJKHDSm3ympl89h`) | ✅ Fase 1 |
| Direktori `GET /webhook/directory` | `kms_directory` (`bpUU2HibzLVT0p3x`) | ✅ Fase 1 |
| Validasi `POST /webhook/validate-knowledge` | `kms_validate_knowledge` (`kGreWkk0geO6v29i`) | ✅ Fase 2 (Dukung `approve_as_new`) |
| Writer Qdrant | `knowledge_writer_upsert` (`KwrUpsert20260810A1`), node `Attach Governance Metadata` menambah `access_users`, `owner_pic`, `owner_team`, `candidate_id`, `validated_by`, `project_name`, `message_ids` | ✅ Fase 2 |
| Reset data uji | `kms_admin_reset` (`PaKzTvasVYO37l6b`, manual): hapus kandidat, log, Qdrant; seed ulang direktori | ✅ |
| Email dummy skenario | `dummy-emails/` (s0, s1, s2, s3a, s3b, s4 folder Drive, s5 thread panjang, s5b thread lanjutan), format satu thread tanpa project | ✅ |
| Chatbot `POST /webhook/chat-rag` | `Chat with Qdrant Knowledge` (`RagChatQdrant20260811`): Header Auth, node `Request Context` menetapkan `user_id`; tool search & detail memfilter `access_users` | ✅ Fase 3 |
| Filter akses | `saved_knowledge` (`2SHsvB58CqAthDHa`, filter `access_scope: 'user'` & `min_related_score`), `get_knowledge_detail` (`GetKnowDetail2026`, filter wajib) | ✅ Fase 3 |
| Portal API | `kms_portal_api` (`K05IetusDReVqoiS`): `my-candidates`, `lead-summary`, `nudge` | ✅ Fase 3 |
| Frontend Web (SPA) | `/home/cendi/kms-paper-nisya/frontend` (Vite, React, TS, Tailwind, shadcn/ui) | ✅ Fase 4 (4 Komponen dibangun) |
| Dokumentasi workflow | `docs/workflows/` (satu file per workflow + `README.md` berisi peta pemanggilan) | ✅ v2.6 |
| Cadangan workflow | `/home/cendi/n8n/backups/workflows-2026-10-16-before-restructure/` (26 workflow, sebelum pemecahan) | ✅ |

**Catatan teknis:**
- Writer, `kms_curator_llm`, dan node `Embedding` di `saved_knowledge` memakai credential `9router token` (diverifikasi dari ekspor workflow 16 Oktober 2026; token tidak tertulis di parameter node).
- `knowledge_writer_upsert` (v2.6): kunci dedup `source_ids`/`email_ids` hanya diambil dari sumber yang benar-benar dibaca; sumber `reference_only` dan folder tetap tersimpan di `sources` untuk sitasi.
- Format input email (16 Oktober 2026, malam): pembungkus `project` dan `sources[]` dihapus; field pesan menjadi `from`/`to`/`cc`/`subject`/`body`. `project_name` kini dihasilkan kurator (sebelumnya diambil dari input dan tidak pernah tersimpan di Qdrant), lalu disimpan di `kms_candidates` dan di setiap titik Qdrant bersama `message_ids`. Diuji end-to-end dengan s3a (project "Search Result Video" tersimpulkan) serta s5 → approve → s5b (hasil `updated_candidate`, bukan `already_exists`). Cadangan sebelum perubahan: `/mnt/kms-backups/2026-10-16-format/`.
- Restrukturisasi dilakukan dengan ekspor CLI n8n, transformasi JSON oleh skrip, lalu `n8n import:workflow`, sehingga prompt, kode, dan kredensial tersalin persis (diverifikasi dengan diff parameter per node).
- `saved_knowledge` (v2.6): body `Embedding` kini disusun dengan `JSON.stringify` dari `query_text`. Sebelumnya isi email ditempel mentah ke template JSON, sehingga baris baru atau tanda kutip membuat panggilan pertama selalu gagal ("JSON Body is not valid JSON") dan orchestrator harus mengulang (±10 detik per email).
- Server MCP n8n tidak dapat memasang credential ke node HTTP lewat `update_workflow`; node HTTP ber-credential dibuat lewat `create_workflow_from_code` (alasan kurator berada di sub-workflow tersendiri).

**Hasil uji Fase 3 (chatbot, data dummy-emails):**

| Skenario | Pertanyaan | Dapat jawaban | Ditolak ("tidak ditemukan") |
| :--- | :--- | :--- | :--- |
| 1 | Nama event tracking banner Ramadan | STAFF-1A, STAFF-2A, SPV-A | STAFF-3A, SPV-B |
| 2 | Template laporan UAT v2 | STAFF-3A | STAFF-1B |
| 3a | Tanggal rilis Search Result Video | STAFF-3C | STAFF-1B |
| 3b | Host dan port VPN staging | SPV-C | STAFF-2A, STAFF-3C |

Password VPN pada s3b tersimpan sebagai `Vpn#****` dan tidak muncul di jawaban mana pun. Nudge: SPV-A ke kandidat tim A berhasil dan tampil di antrean STAFF-3A; SPV-B (di luar cakupan) dan staff ditolak 403. `lead-summary` ditolak untuk staff (403).

**Hasil uji Fase 2 (data PERSON-xxx sebelum reset):** penolakan non-owner/role/aksi/alasan kosong (403/400/404), double-approve paralel (200 + 409), edit & approve, reject, handover (owner lama langsung 403), deteksi `updated_candidate`, supersede row lama, dan audit log lengkap.

**Evaluasi Temuan E2E Fase 4 (Mitigasi False-Update Ingest & Auto-Skip Non-Knowledge):**
1. *Pencegahan False-Update:* Pada pengujian E2E frontend (`e2e_ingest.mjs`), email baru mengenai *Jadwal Pengiriman Newsletter Mingguan* (`STAFF-1B`, Tim B) memicu pencarian kemiripan di Qdrant. Karena saat itu `saved_knowledge` belum memfilter akses pengirim dan belum memiliki batas skor minimum, titik terdekat yang ditemukan adalah *Tracking Banner Ramadan* (`STAFF-1A`, Tim A) dengan skor kemiripan hanya `0.4258`. Kurator AI keliru menandainya sebagai `updated_candidate`, sehingga saat diapprove, knowledge Ramadan terhapus/tersupersede oleh Newsletter di Qdrant. Masalah ini diselesaikan secara komprehensif melalui *5-Layer Ingest Guard* (scoped retrieval, threshold score ≥0.65, pengetatan prompt kurator, canvas fallback deterministik, dan opsi validasi `approve_as_new`).
2. *Auto-Skip Non-Knowledge (FR1/FR2):* Email non-pengetahuan seperti permohonan cuti tahunan personal (`STAFF-1C`) sebelumnya lolos ke kurator karena prompt `INSPECT_TOOL` belum memiliki kriteria eksklusi tegas. Prompt diperbaiki dengan aturan eksklusi eksplisit (cuti pribadi, obrolan santai, alert otomatis, undangan kalender) dan orchestrator AI Agent diinstruksikan langsung berhenti tanpa memanggil Qdrant atau kurator. Pengujian menghasilkan status otomatis `skipped` dalam ±15 detik. Bidang `project_name` juga disesuaikan menjadi opsional di form UI maupun payload agar email operasional umum tidak dipaksa mengarang nama proyek.

**Hasil uji Ingest v2.6 (16 Oktober 2026, data direset sebelum tiap putaran):**

Diagnosis awal pada s4 (email berisi tautan folder Drive dengan 1 Google Doc, 1 Google Sheet, 1 PDF) dengan arsitektur lama: total **6 menit 44 detik**. Rinciannya: orchestrator menyalin ±5.500 token evidence ke kurator (28 detik, dua kali karena retry), panggilan kurator pertama gagal HTTP 524 setelah 125 detik, retry 67 detik, lalu orchestrator mengulang jawaban kurator 4.228 token (27 detik). Selain itu folder tidak tersitasi dan sheet template "To-do list" menjadi fakta.

| Skenario | Sebelum v2.6 | v2.6, kurator `gemini-3.8-flash-high` | v2.6, kurator `gemini-3.8-flash` (aktif) |
| :--- | :--- | :--- | :--- |
| s0 (bukan knowledge) | – | 21 detik, `skipped` | 18 detik, `skipped` |
| s1 | – | 47 detik | 31 detik |
| s2 | – | 165 detik | 32 detik |
| s3a | – | 68 detik | 83 detik |
| s3b (password) | – | 83 detik | 36 detik |
| s4 (folder Drive) | 6 m 44 d | 153 detik | 115 detik |

- Status, `owner_pic`, dan `access_users` semua skenario sesuai `dummy-emails/README.md`.
- GR7: password s3b tersimpan `Vpn#****`; kredensial sandbox di Google Doc s4 tersimpan `Qris#****` dan `MK_STG_****`. Tidak ada nilai rahasia mentah di output mana pun.
- s4: Google Doc dibaca dan menjadi sumber fakta; sheet template ditandai `not_relevant`; CV di folder tidak dibaca; keduanya beserta folder tercantum sebagai sumber referensi.
- *Uji A/B model kurator:* kualitas setara (fakta dengan nilai konkret, masking, `structured_details` terisi). Varian `-high` menghabiskan hingga 17.399 token penalaran untuk 739 token output pada s2 (140 detik), sehingga model kurator diganti ke `gemini-3.8-flash`.
- *Temuan selama pengembangan:* versi pertama `Collect Evidence` tidak menyertakan email asli, hanya klasifikasi inspector. Akibatnya fakta s3b menjadi umum dan password tidak terdeteksi. Diperbaiki dengan field `current_email`; tabel di atas sudah memakai versi perbaikan.
- *Variasi waktu:* durasi orchestrator bervariasi antar-putaran (misal s3a 68 vs 83 detik) karena latensi model; angka di atas adalah satu putaran per skenario, bukan rata-rata.

**Hasil uji kriteria FR1 (18 Oktober 2026):** daftar eksklusi `inspect_email` sebelumnya belum memuat laporan rutin dan balasan IT support, dan notifikasi deploy hanya tercakup sebagian. Setelah prompt dilengkapi (termasuk bagian pengecualian), satu putaran uji tanpa reset:

| Skenario | Ekspektasi | Hasil |
| :--- | :--- | :--- |
| s6a laporan harian | `skipped` | `skipped`, 16 detik |
| s6b balasan IT support | `skipped` | `skipped`, 16 detik |
| s6c notifikasi deploy | `skipped` | `skipped`, 16 detik |
| s6d laporan mingguan berisi perbaikan bug | knowledge | `pending_validation`, 37 detik. Judul "Resolusi Isu Tracking Event video_play pada Template AMP Kanal Health" |
| s6e balasan yang memundurkan rilis | knowledge, tanggal final 27 Maret | `pending_validation`, 48 detik. `effective_date` 2026-03-27, ringkasan menyebut jadwal lama dan alasannya |
| s0 izin sakit (regresi) | `skipped` | `skipped`, 16 detik |
| s1 keputusan tracking (regresi) | knowledge | `pending_validation`, 37 detik |

**Hasil uji redaksi NFR4 (18 Oktober 2026):** `Redact Sensitive Data` dipasang di `kms_ingest` dan ketiga reader Google. Uji unit 36 kasus lulus. Pipeline s0–s7 dijalankan ulang dengan ID baru: semua status sesuai ekspektasi (s3a dan s5 `already_exists` karena isinya sama dengan knowledge yang sudah approved). Cek kebocoran mencari 10 nilai mentah dari s3b, s4 (Google Doc), dan s7 di data eksekusi n8n semua workflow yang memanggil model. Putaran pertama: 1 bocor (`Merchant Key` di Google Doc s4, kata kunci belum dikenal). Setelah aturan ditambah: **0 dari 10**. Rincian di `docs/workflows/redact_sensitive_data.md`.

**Evaluasi end-to-end setelah reset (19 Oktober 2026):** seluruh skenario s0–s7 dan s5b dijalankan dari email masuk sampai chatbot. Status ingest 13/13 sesuai ekspektasi, daftar akses 7/7 skenario sesuai, duplikat saat diproses `already_pending`, approve 10/10, s5b menjadi pembaruan dan s5 `superseded`, s1 dikirim ulang setelah approved `already_exists`. Chatbot: 11/11 penanya tanpa akses mendapat "tidak ditemukan", 11/12 penanya berhak mendapat jawaban benar. Nilai rahasia mentah: 0 di jawaban chatbot, 0 di Qdrant, 0 di data yang dikirim ke model. Temuan: kredensial tersamar s4 hanya ditaruh kurator di `raw_structured_evidence` (tidak dijadikan chunk), sehingga chatbot menjawab "tidak ditemukan" untuk pertanyaan client secret/merchant key. Rincian, waktu per email, dan jawaban lengkap: `docs/evaluation/2026-10-19/`.

**Perbaikan nilai tersamar (19 Oktober 2026):** uji terkontrol menunjukkan `document_extractor` melewati kredensial yang sudah disamarkan (0/5; nilai mentah 5/5), dan kurator berperilaku sama. Ditambahkan aturan "Masked values" di prompt `document_extractor` dan `spreadsheet_extractor` (5/5 pada uji) serta pengaman di `Build Candidate Update` yang menambahkan fakta bila nilai tersamar hanya tertinggal di `raw_structured_evidence`. s4 diuji ulang: chatbot menjawab `MK_S****` dan `Qris****` kepada STAFF-2A, STAFF-3A tetap ditolak. Rincian: `docs/evaluation/2026-10-19/masked-values/`.

---

## 9. Roadmap

```text
[ FASE 1: Data Tables & Ingest Async ] ─────────────────────────── ✅ selesai
[ FASE 2: Validasi Human-in-the-Loop & Writer Qdrant ] ─────────── ✅ selesai
[ FASE 3: Chatbot ber-akses & Endpoint SPV ] ───────────────────── ✅ selesai
  ├── 3.1 `chat-rag`: teruskan user_id ke tool secara deterministik
  ├── 3.2 `saved_knowledge` (filter opsional) & `get_knowledge_detail` (filter wajib) pada access_users
  ├── 3.3 `my-candidates`, `lead_summary`, `nudge`
  └── 3.4 Uji akses skenario 1, 2, 3a, 3b (dummy-emails/README.md)
[ FASE 4: Frontend & Ingest Resilience ] ─────────────────────────── ✅ selesai
  ├── Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query ✅
  ├── Profile selector 12 user, menu dinamis sesuai role (Staff & SPV) ✅
  ├── Komponen 1 (Ingest Async + Polling), 2 (Review 1 Tindakan + Approve As New), 3 (Chat RAG Citations), 4 (SPV Monitoring + Nudge) ✅
  ├── 5-Layer Ingest Guard & Opsi 'approve_as_new' (penyelesaian false-update) ✅
  └── E2E Flow Verification (Ingest -> Nudge -> Validate -> Chat RAG) ✅
[ FASE 4.5: Sumber Google Drive & Restrukturisasi Ingest (v2.6) ] ── ✅ selesai
  ├── gdrive_folder_lister & gdrive_pdf_reader + deteksi gfolder:/gpdf: di inspect_email ✅
  ├── Kurator dipisah dari agen: Collect Evidence + kms_curator_llm (jaringan internal) ✅
  ├── Relevansi sumber, sitasi folder & referensi deterministik, validasi missing_source ✅
  ├── Perbaikan body JSON saved_knowledge ✅
  ├── Uji regresi s0–s4 + A/B model kurator (flash dipilih) ✅
  ├── Pemecahan kms_ingest / kms_evidence_agent / kms_curate_stage, sticky note per tahap, konvensi nama ✅
  ├── Uji ulang setelah pemecahan: s0–s4, duplikat (already_pending), approve s4, chatbot akses ✅
  ├── Dokumentasi per workflow (docs/workflows/) ✅
  └── Uji PDF Drive di pipeline penuh (butuh PDF terkait proyek di folder uji) ⏳
[ KEPUTUSAN LINGKUP 18 Okt 2026 ] ───────────────────────────────────
  ├── FR1 dilengkapi (laporan rutin, notifikasi deploy, balasan IT support) ✅
  ├── Kekurangan FR5, FR7, GR2, GR3, GR6, NFR1, NFR2 tidak dilanjutkan; implementasi sekarang cukup
  ├── GR5 dan NFR3 di-drop
  └── NFR4: opsi A (redaksi berbasis kode sebelum LLM) dipilih dan dipasang; uji kebocoran 0 dari 10 ✅
[ FASE 5: Evaluasi Skenario Wawancara & Laporan ] ──────────────────
  ├── Evaluasi end-to-end s0–s7 + s5b setelah reset (19 Okt), hasil di docs/evaluation/2026-10-19/ ✅
  └── Temuan: kredensial tersamar s4 tidak terjangkau chatbot → aturan "Masked values" di extractor + pengaman fakta di kurasi, s4 diuji ulang ✅
```

---

## 10. Riwayat Iterasi

Bahan untuk bagian paper yang menjelaskan bagaimana artefak dibangun dan diperbaiki. Setiap iterasi dicatat dengan pemicunya (temuan uji atau keputusan), perubahan, dan bukti uji. Pemicu yang tidak tercatat ditulis apa adanya. Riwayat git dimulai 16 Oktober 2026; sebelum itu sumbernya adalah cadangan dokumen ini (`.bak.md`), catatan uji di bagian 8, dan transkrip sesi pengembangan. Pengembangan memakai dua asisten AI: Claude Code dan Hermes (v2.0, dan v2.3–v2.5 saat batas pemakaian Claude habis).

| # | Versi | Tanggal | Pemicu | Perubahan | Bukti uji |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 0 | 2.0 | 15 Okt | Draf pertama (15 Okt malam) memakai SQLite terpisah untuk staging. Tinjauan menemukan n8n v2.27.3 tidak punya node SQLite dan file SQLite tambahan berisiko tertukar dengan database n8n | Staging di n8n Data Tables, ingest asinkron + polling, pengamanan webhook, n8n sebagai API headless | – |
| 1 | 2.1 | 15 Okt | Tinjauan rancangan v2.0 (saran dan kekhawatiran implementasi), lalu permintaan peneliti agar profil tidak memakai nama asli dan role hanya dua: staff sebagai validator, supervisor sebagai pemantau | Identitas pseudonim, model dua role, keamanan proxy API key, penanganan status | – |
| 2 | 2.2 | 15 Okt | Usulan menyederhanakan akses menjadi "hanya pengirim yang bisa melihat" ditolak peneliti: ada kasus cc ke email personal dan ke email tim, sehingga perlu struktur tim | Tiga tim (A, B, C), masing-masing tiga staff dan satu SPV; owner = pengirim; akses dihitung dari header email; SPV bisa memvalidasi dan memantau. Fase 1–3 (ingest, validasi, writer Qdrant, chatbot ber-akses, endpoint SPV) dibangun | Uji Fase 2: penolakan non-owner, double-approve paralel, edit, reject, handover, supersede, audit log. Uji akses Fase 3 (skenario 1, 2, 3a, 3b) |
| 3 | 2.3 | 15 Okt | Uji E2E frontend (Fase 4): email jadwal newsletter STAFF-1B (tim B) dianggap pembaruan knowledge banner Ramadan STAFF-1A (tim A) dengan kemiripan hanya 0,43 (*false update*), karena pencarian dedup belum dibatasi akses dan belum punya skor minimum. Setelah di-approve, knowledge Ramadan milik tim A tergantikan (`superseded`) oleh newsletter tim B | 5-layer ingest guard: (1) cek `source_id` duplikat di staging, (2) pencarian dedup dibatasi akses pengirim, (3) skor minimum 0,65, (4) aturan prompt kurator untuk mengabaikan kemiripan semu, (5) pengaman deterministik di `Build Candidate Update`; aksi `approve_as_new` agar validator bisa menyetujui sebagai entri baru tanpa menimpa yang lama | Email newsletter menjadi kandidat baru, bukan pembaruan |
| 4 | 2.4 | 16 Okt | Peneliti mencoba email izin cuti STAFF-1C ke SPV-C: lolos menjadi kandidat (`pending_validation`). Prompt `inspect_email` terlalu umum, dan form ingest mewajibkan nama proyek sehingga email itu dikirim dengan proyek "Izin Cuti", yang ikut mengecoh model | Kriteria eksklusi eksplisit di `inspect_email` (cuti/izin pribadi, obrolan santai, alert otomatis, undangan kalender); orchestrator langsung berhenti tanpa memanggil Qdrant dan kurator bila bukan knowledge (status `skipped`); nama proyek di form menjadi opsional | Email cuti (s0) menjadi `skipped` dalam kurang dari 15 detik |
| 5 | 2.5 | 16 Okt | Masukan peneliti saat mencoba UI: pengirim seharusnya mengikuti profil yang sedang login, dan sitasi di "Kandidat Saya" sebaiknya bergaya IEEE ([1], [2], daftar referensi di bawah) | Pengirim dikunci mengikuti profil login (menegakkan owner = pengirim); `kms_portal_api` meneruskan daftar sumber lengkap; fakta dan konflik di layar review memakai sitasi [1], [2] dengan daftar referensi bernomor (jenis sumber, judul, ID, tautan dokumen) | Diuji manual oleh peneliti lewat UI (email spesifikasi Dynamic QRIS dan revisinya) |
| 6 | 2.6 | 16–17 Okt | s4 (folder Drive) butuh 6 m 44 d dengan HTTP 524; folder tidak tersitasi; sheet template menjadi fakta; panggilan `saved_knowledge` pertama selalu gagal JSON; `project_name` dari input tidak pernah tersimpan | Tool folder Drive dan PDF; kurator dipisah dari agen (`Collect Evidence` deterministik, `kms_curator_llm` di jaringan internal); relevansi sumber; body JSON diperbaiki; input email datar dan `project_name` disimpulkan kurator; deteksi thread lanjutan dari `message_ids`; A/B model kurator | s4 6 m 44 d → 115 d; regresi s0–s4; s5/s5b menjadi pembaruan; `-high` vs flash setara mutu, flash dipilih |
| 7 | 2.6.1 | 18 Okt | Pemeriksaan kesesuaian dengan requirement: daftar eksklusi `inspect_email` belum memuat laporan rutin, notifikasi deploy, dan balasan IT support (FR1) | Kriteria eksklusi dilengkapi beserta pengecualian (laporan rutin yang mencatat perbaikan atau perubahan jadwal tetap knowledge); keputusan lingkup bersama pemilik paper: GR5 dan NFR3 di-drop, kekurangan lain dianggap cukup | s6a–s6c `skipped`, s6d–s6e tetap knowledge |
| 8 | 2.7 | 18–19 Okt | Isi email mentah (password, data pribadi) terkirim ke model cloud di setiap langkah AI; kekhawatiran I2 soal kebocoran (NFR4) | Redaksi berbasis aturan sebelum LLM (opsi A), di email dan isi dokumen Google; label `[KREDENSIAL: …]` dicatat ke `sensitive_audit`. Hari berikutnya empat salinan kode disatukan menjadi sub-workflow `redact_sensitive_data` | 36 uji unit; cek kebocoran 1/10 bocor (`Merchant Key`) → aturan ditambah → 0/10; setelah penyatuan 0/10; evaluasi E2E setelah reset: 13/13 status, 22/23 chatbot, 0 nilai mentah di model, jawaban, dan Qdrant |
| 9 | 2.7.1 | 19 Okt | Evaluasi E2E: chatbot menjawab "tidak ditemukan" untuk kredensial tersamar s4 | Aturan "Masked values" di prompt `document_extractor` dan `spreadsheet_extractor`; pengaman di `Build Candidate Update` yang menambahkan fakta bila nilai tersamar hanya ada di `raw_structured_evidence` | Uji terkontrol extractor: nilai tersamar masuk fakta 0/5 → 5/5 dengan aturan (nilai mentah 5/5); s4 diuji ulang: STAFF-2A mendapat `MK_S****`/`Qris****`, STAFF-3A ditolak |

**Pola yang muncul untuk diskusi paper:**

- **Temuan uji menggerakkan sebagian besar iterasi.** Iterasi 3, 4, 6, 8 (putaran kedua), dan 9 dipicu kegagalan yang terlihat saat skenario dummy dijalankan, bukan dari rancangan awal.
- **Keputusan deterministik menggantikan keputusan model.** Akses, dedup, pengumpulan evidence, redaksi, dan pengaman fakta dipindah dari model ke kode secara bertahap (iterasi 2, 3, 4, 6, 8, 9), karena perilaku model tidak konsisten antar-run.
- **Satu perbaikan dapat menimbulkan efek samping baru.** Redaksi (iterasi 8) menutup kebocoran ke model, tetapi membuat model melewati nilai yang disamarkan (iterasi 9).
- **Peneliti ikut menentukan arah lewat uji coba langsung** (iterasi 2, 4, 5, 7): aturan akses tim, penyaringan email non-knowledge, tampilan sitasi, dan lingkup requirement: requirement yang tidak dibangun tetap tercantum dan dijelaskan sebagai batasan.
