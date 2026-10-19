# kms_ingest

| | |
| :--- | :--- |
| **ID** | `BiDjvbh6ZdCRDlB6` |
| **Pemicu** | `POST /webhook/ingest-email` (Header Auth `X-KMS-API-KEY`) |
| **Dipanggil oleh** | Frontend, Komponen 1 (Ingest) |
| **Memanggil** | `redact_sensitive_data`, `kms_evidence_agent`, `kms_curate_stage` |
| **Requirement** | GR1 (owner = pengirim), GR4 (akses dari header), NFR4 (redaksi sebelum LLM), FR1–FR3 dan GR7 lewat sub-workflow |

## Tujuan

Pintu masuk ingest email. Workflow ini memvalidasi permintaan, menghitung pemilik dan daftar akses secara deterministik, mencegah duplikat, membuat baris staging, lalu **langsung membalas HTTP 202**. Pekerjaan AI berjalan setelah balasan terkirim (pola async + polling), karena kurasi dapat melebihi batas ±100 detik Cloudflare.

## Input

```json
{ "user_id": "STAFF-1A", "email": { "source_id": "EMAIL-S1", "subject": "...", "messages": [ { "message_id": "EMAIL-S1-M01", "date": "2026-03-02", "from": "STAFF-1A", "to": ["STAFF-2A"], "cc": ["SPV-A"], "subject": "...", "body": "...", "attachments": [] } ] } }
```

`email` adalah satu thread email. `source_id`, `messages` (minimal satu), dan `from` di setiap pesan wajib ada. Input **tidak** memuat project: kurator menyimpulkan `project_name` dari isi email (FR4), lalu `Update Candidate Row` menuliskannya. Body berupa teks biasa; decode MIME/base64 dan pemetaan alamat email ke ID staf adalah tugas konektor email, di luar prototipe ini.

## Output

Balasan cepat (±1,5 detik): `202 { success, candidate_id, status, duplicate_of, error }` dengan `status` = `processing`, `already_pending`, atau `failed`. Body tidak valid mendapat `400`.

Hasil akhir ditulis ke baris `kms_candidates` dan dibaca frontend lewat `kms_candidate_status`.

## Alur

```text
Ingest Webhook ─> Prepare Ingest ─> Is Valid Request? ─┬─> Get Directory ─> Resolve Access ─> Find Active Duplicate ─> Check Duplicate
                                                        └─> Respond Invalid (400)
─> Insert Candidate Row ─> Respond Accepted (202) ─> Should Process? ─> Redact Sensitive Data ─> Save Source Email
─> Run Evidence Agent ─> Run Curation ─> Retry Agent? ─┬─> Update Candidate Row
          │                  │                          └─> (kembali ke Run Evidence Agent, maks. 2×)
          └──────────────────┴─> Mark Failed (bila sub-workflow error)
```

| Tahap (sticky note) | Node | Fungsi |
| :--- | :--- | :--- |
| 1. Intake dan akses | `Prepare Ingest` | Memvalidasi body, membuat `candidate_id` (`CAND-YYYYMMDD-XXXXXX`), mengumpulkan semua ID dari header setiap pesan (`from`, `to`, `cc`, `bcc`). |
| | `Get Directory`, `Resolve Access` | Menentukan `owner_pic` (`from` pesan pertama), `owner_team`, dan `access_users` dengan aturan 3.3 plan doc: orang yang disebut, seluruh anggota tim untuk alamat `TEAM-x`, dan SPV setiap tim yang terlibat. |
| | `Find Active Duplicate`, `Check Duplicate` | `source_id` yang sama sedang `processing`/`pending_validation`/`approving` → `already_pending`. Pengirim di luar direktori → `failed`. |
| 2. Staging dan balasan cepat | `Insert Candidate Row`, `Respond Accepted` | Membuat baris dengan status awal, lalu membalas 202. |
| | `Should Process?` | Hanya status `processing` yang lanjut ke tahap AI. |
| 3. Tahap AI | `Redact Sensitive Data` | Memanggil workflow `redact_sensitive_data` untuk menyamarkan kredensial dan data pribadi di email sebelum diserahkan ke model mana pun (NFR4). Aturannya di [redact_sensitive_data.md](redact_sensitive_data.md). Email asli tidak keluar dari workflow ini. |
| | `Save Source Email` | Menyimpan email versi tersamar ke kolom `source_email` (isi lampiran dibuang, `attachment_id`/`filename`/`mime_type` tetap) agar validator dapat membacanya di "Kandidat Saya". Diatur `alwaysOutputData` + `continueRegularOutput`, jadi kegagalan menyimpan tidak menghentikan kurasi. |
| | `Run Evidence Agent` | Menjalankan `kms_evidence_agent` dengan input `email` (versi tersamar) dan `candidate`. |
| | `Run Curation` | Menjalankan `kms_curate_stage` dengan `agent_result`, `email` (versi tersamar), `candidate`; mengembalikan update baris. |
| | `Retry Agent?` | Bila hasil `retryable` (agen berhenti tanpa `evidence_ready` atau output kurator tidak terbaca), ulangi agen. Maksimal 2 kali (`$runIndex < 2`). |
| 4. Hasil | `Update Candidate Row` | Menulis status akhir (`pending_validation`, `skipped`, `already_exists`, atau `failed`) beserta hasil kurasi, termasuk `project_name` hasil inferensi kurator. |
| | `Mark Failed` | Menangkap error dari sub-workflow dan menulis `failed` + pesan error. |

## Aturan penting

- **Akses tidak pernah ditentukan LLM.** `access_users` dihitung di `Resolve Access` dan dibekukan di baris kandidat. Validator tidak dapat mengubahnya.
- **Pengirim = owner.** Hanya `owner_pic` yang kelak boleh memvalidasi (ditegakkan di `kms_validate_knowledge`).
- **Model tidak pernah menerima email asli.** Kedua sub-workflow mengambil email dari `Redact Sensitive Data`, termasuk saat agen diulang.
- Baris yang macet di `processing` lebih dari 10 menit dilaporkan `failed` oleh `kms_candidate_status`.

## Cara menguji

```bash
curl -s -X POST http://localhost:5173/api/ingest-email -H 'Content-Type: application/json' \
  --data @dummy-emails/s1-personal-cc-spv.json
curl -s "http://localhost:5173/api/candidate-status?id=<candidate_id>"
```

Mengirim email yang sama lagi saat masih pending harus menghasilkan `already_pending` dalam ±1 detik.

## Riwayat

Sebelum 16 Oktober 2026 workflow ini bernama `dummy knowledge management` dan berisi 39 node (agen, tool, dan kurator dalam satu kanvas, plus trigger manual dan Sample Email untuk uji). Agen dan kurasi dipindahkan ke `kms_evidence_agent` dan `kms_curate_stage`; scaffolding uji dihapus karena pengujian memakai `dummy-emails/`.
