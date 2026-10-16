# Arsitektur & Rencana Implementasi Frontend–n8n KMS
*Email-to-Knowledge Management System dengan Human-in-the-Loop Validation & Lead Monitoring*

**Versi:** 2.5 (Model akses tim, IEEE citation grounding di review kandidat, auto-sender profil login, status implementasi Fase 4 terverifikasi)  
**Tanggal:** 16 Oktober 2026  
**Lokasi Dokumen:** `/home/cendi/kms-paper-nisya/Arsitektur dan Rencana Implementasi Frontend-n8n KMS.md`  
**Referensi Riset:** `Analisis Tematik & Requirement Workflow KMS.md` (FR1–FR8, GR1–GR7, NFR1–NFR4)  
**Versi sebelumnya:** `...v2.0.bak.md`, `...v2.1.bak.md`, `...v2.2.bak.md`, `...v2.3.bak.md`, `...v2.4.bak.md`

---

## 1. Ringkasan Eksekutif & Prinsip Desain

Dokumen ini merupakan cetak biru arsitektur dan rencana teknis **Frontend Web KMS** dengan **n8n sebagai backend API headless**. Sistem mengintegrasikan ingestion email otomatis, validasi pemilik pengetahuan (*Human-in-the-Loop*), penelusuran semantik ber-sitasi (*Chatbot RAG*), dan ringkasan tata kelola untuk supervisor (*Lead Monitoring*).

Prinsip desain v2.4:

1. **Staging di n8n Data Tables.** Tidak ada node SQLite di n8n v2.27.3. Qdrant hanya berisi pengetahuan yang sudah divalidasi.
2. **Identitas pseudonim berbasis tim.** Tiga tim (A, B, C), masing-masing 3 staff dan 1 SPV. Tidak ada nama asli informan di sistem.
3. **Owner = pengirim.** Kandidat pengetahuan hanya dapat divalidasi oleh pengirim email aslinya (staff atau SPV).
4. **Akses dihitung deterministik dari header email**, tidak oleh LLM, dan dibekukan saat ingest sebagai daftar user (`access_users`).
5. **Ingest asynchronous + polling.** Kurasi berlangsung ±5 menit; pola sinkron akan terputus oleh Cloudflare (HTTP 524, batas ±100 detik).
6. **API key tidak pernah sampai ke browser.** nginx meneruskan `/api/*` ke n8n dan menyisipkan header `X-KMS-API-KEY`.
7. **Integritas validasi.** Lock status `approving` mencegah double-approve, suntingan validator di-patch ke payload sebelum embedding, semua aksi tercatat di audit log.
8. **Siklus status lengkap**, termasuk `skipped`, `failed`, dan `superseded`, sehingga tidak ada entri menggantung dan KPI dashboard akurat.
9. **5-Layer Dedup & Ingest Guard.** Mencegah *false update* (email baru menimpa knowledge lama yang tak terkait akibat kemiripan semantik lemah): batasan akses pencarian dedup, ambang batas skor minimum (≥0.65), prompt kurator ketat, pengaman deterministik canvas, serta opsi validasi `approve_as_new`.
10. **Klasifikasi Cerdas & Auto-Skip Non-Knowledge (FR1/FR2).** Email yang bukan pengetahuan organisasi (izin cuti pribadi, obrolan santai, notifikasi server otomatis, undangan kalender) langsung disaring oleh `inspect_email` di langkah pertama tanpa memanggil Qdrant, ekstraktor, atau kurator, dan otomatis berstatus `skipped` dalam <15 detik. `project_name` bersifat opsional agar email operasional/SOP umum tidak dipaksa mengarang nama proyek.

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
| `project_id`, `project_name` | `string` | Proyek terkait. |
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
│  - Inspect/Curate│    │- Patch + Writer  │    │  (deterministik) │    └────────┬─────────┘
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
  1. Pengguna mengisi Form Builder atau menempelkan JSON di tab Raw JSON, lalu UI memanggil `POST /api/ingest-email`. Pengirim email utama otomatis terisi dari akun profil aktif pengguna yang sedang login (tanpa dropdown manual), menjaga kepatuhan aturan GR1 (owner = pengirim). Bidang `project_name` bersifat **opsional** agar email umum, SOP, atau koordinasi lintas tim tidak dipaksa mengarang nama proyek.
  2. n8n memvalidasi body, membaca direktori, menghitung `owner_pic`, `owner_team`, dan `access_users` (aturan 3.3), membuat row status `processing`, dan **langsung membalas (±1,5 detik)**.
  3. Pengirim yang tidak ada di direktori langsung berstatus `failed`.
  4. Pipeline AI (`inspect_email` ➜ jika knowledge: `saved_knowledge` ➜ `list attachments` ➜ `extractor` ➜ `curator`) berjalan setelah respons terkirim. Jika `inspect_email` mendeteksi kriteria eksklusi (izin cuti, obrolan santai, alert otomatis), orchestrator langsung mengembalikan `is_knowledge: false` tanpa memanggil Qdrant atau kurator, dan row staging langsung berstatus `skipped`.
  5. UI polling `GET /api/candidate-status?id=...` setiap 3–5 detik hingga status bukan `processing`, dengan batas waktu 3 menit di UI. Di backend, row `processing` lebih dari 10 menit otomatis dilaporkan `failed`.
  6. Tampilan hasil: `pending_validation` (kartu ringkasan), `skipped` (bukan pengetahuan + alasan jelas), `already_exists` / `already_pending` (info duplikat), `failed` (pesan error + coba lagi).
- **Deduplikasi 2-arah & 5-Layer Ingest Guard:**
  1. *Staging Dedup (Data Table):* `source_id` yang sama sedang `processing`/`pending_validation`/`approving` → `already_pending`.
  2. *Scoped Retrieval (Qdrant via `saved_knowledge`):* Pencarian semantik dibatasi hanya pada dokumen yang ada dalam `access_users` pengirim (`owner_pic`), mencegah pengguna me-revisi dokumen tim lain yang di luar hak aksesnya.
  3. *Ambang Skor Kemiripan (`min_related_score: 0.65`):* Mencegah *nearest neighbor* acak. Kemiripan lemah (<0.65, misal newsletter vs Ramadan yang berjarak 0.43) dikembalikan sebagai `noMatch`.
  4. *Prompt Kurator Ketat:* Bagian `## Unrelated saved knowledge` mewajibkan kurator mengabaikan kemiripan semantik semu dan hanya menetapkan `updated_candidate` jika subjek/fitur/dokumen sama persis.
  5. *Pengaman Deterministik Canvas:* Node `Build Candidate Update` memverifikasi integritas rujukan pembaruan sebelum mencatat ke staging.
- **Retry otomatis:** bila orchestrator berhenti di tengah (model menulis pemanggilan tool sebagai teks biasa), workflow mengulang agen hingga 2 kali sebelum menandai `failed`.
- **Bahasa:** judul, ringkasan, fakta, kondisi ditulis dalam Bahasa Indonesia. Kode, nama event, ID, URL, dan istilah teknis disalin apa adanya.

### Komponen 2: Kandidat Saya (Human-in-the-Loop)

- **Requirement:** GR1 (validasi oleh pemilik), GR6 (handover), GR7 (verifikasi masking), NFR2 (review 1 tindakan).
- **Antrean:** hanya kandidat dengan `owner_pic === user aktif`.
- **Layar review 1 tindakan & Sitasi IEEE (FR8):** ringkasan, tanggal efektif, banner sensitif (GR7) dengan teks termasking, daftar siapa saja yang akan mendapat akses (`access_users`, informatif, tidak dapat diubah), accordion detail teknis (tracking, requirement, UAT), serta penanda visual bila kandidat dideteksi sebagai pembaruan knowledge lama.
  * **Grounding Sitasi Bergaya IEEE:** Setiap butir fakta terverifikasi dan konflik antarsumber disitasi secara inline menggunakan penomoran numerik `[1]`, `[2]` yang dapat diklik langsung.
  * **Daftar Referensi Sumber (IEEE Style):** Bagian bawah kartu menyajikan katalog sumber bernomor lengkap: tipe sumber (Email, Google Docs, Google Sheets, Dokumen/Spreadsheet), judul/nama sumber, ID sumber, serta tautan langsung untuk dokumen eksternal (`gdoc:*` dan `gsheet:*`).
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
| Ingest `POST /webhook/ingest-email` | `dummy knowledge management` (`BiDjvbh6ZdCRDlB6`) | ✅ Fase 1 (Diperkuat 5-layer guard) |
| Polling `GET /webhook/candidate-status` | `kms_candidate_status` (`GhJKHDSm3ympl89h`) | ✅ Fase 1 |
| Direktori `GET /webhook/directory` | `kms_directory` (`bpUU2HibzLVT0p3x`) | ✅ Fase 1 |
| Validasi `POST /webhook/validate-knowledge` | `kms_validate_knowledge` (`kGreWkk0geO6v29i`) | ✅ Fase 2 (Dukung `approve_as_new`) |
| Writer Qdrant | `knowledge_writer_upsert` (`KwrUpsert20260810A1`), node `Attach Governance Metadata` menambah `access_users`, `owner_pic`, `owner_team`, `candidate_id`, `validated_by` | ✅ Fase 2 |
| Reset data uji | `kms_admin_reset` (`PaKzTvasVYO37l6b`, manual): hapus kandidat, log, Qdrant; seed ulang direktori | ✅ |
| Email dummy skenario | `dummy-emails/` (s0, s1, s2, s3a, s3b) | ✅ |
| Chatbot `POST /webhook/chat-rag` | `Chat with Qdrant Knowledge` (`RagChatQdrant20260811`): Header Auth, node `Request Context` menetapkan `user_id`; tool search & detail memfilter `access_users` | ✅ Fase 3 |
| Filter akses | `saved_knowledge` (`2SHsvB58CqAthDHa`, filter `access_scope: 'user'` & `min_related_score`), `get_knowledge_detail` (`GetKnowDetail2026`, filter wajib) | ✅ Fase 3 |
| Portal API | `kms_portal_api` (`K05IetusDReVqoiS`): `my-candidates`, `lead-summary`, `nudge` | ✅ Fase 3 |
| Frontend Web (SPA) | `/home/cendi/kms-paper-nisya/frontend` (Vite, React, TS, Tailwind, shadcn/ui) | ✅ Fase 4 (4 Komponen dibangun) |

**Catatan teknis:** writer sudah memakai credential `9router token`. Node `Embedding` di `saved_knowledge` masih menyimpan token secara langsung dan perlu dipindahkan ke credential yang sama lewat UI.

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
[ FASE 5: Evaluasi Skenario Wawancara & Laporan ] ──────────────────
```
