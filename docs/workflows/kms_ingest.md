# kms_ingest

| | |
| :--- | :--- |
| **ID** | `BiDjvbh6ZdCRDlB6` |
| **Pemicu** | `POST /webhook/ingest-email` (Header Auth `X-KMS-API-KEY`) |
| **Dipanggil oleh** | Frontend, Komponen 1 (Ingest) |
| **Memanggil** | `kms_evidence_agent`, `kms_curate_stage` |
| **Requirement** | GR1 (owner = pengirim), GR4 (akses dari header), FR1–FR3 dan GR7 lewat sub-workflow |

## Tujuan

Pintu masuk ingest email. Workflow ini memvalidasi permintaan, menghitung pemilik dan daftar akses secara deterministik, mencegah duplikat, membuat baris staging, lalu **langsung membalas HTTP 202**. Pekerjaan AI berjalan setelah balasan terkirim (pola async + polling), karena kurasi dapat melebihi batas ±100 detik Cloudflare.

## Input

```json
{ "user_id": "STAFF-1A", "email": { "project_id": "...", "project_name": "...", "sources": [ { "source_id": "EMAIL-S1", "messages": [ { "message_id": "...", "sender": "STAFF-1A", "recipients": [], "cc": [], "date": "2026-03-02", "content": "...", "attachments": [] } ] } ] } }
```

`email.sources[0].source_id` wajib ada. `project_name` opsional.

## Output

Balasan cepat (±1,5 detik): `202 { success, candidate_id, status, duplicate_of, error }` dengan `status` = `processing`, `already_pending`, atau `failed`. Body tidak valid mendapat `400`.

Hasil akhir ditulis ke baris `kms_candidates` dan dibaca frontend lewat `kms_candidate_status`.

## Alur

```text
Ingest Webhook ─> Prepare Ingest ─> Is Valid Request? ─┬─> Get Directory ─> Resolve Access ─> Find Active Duplicate ─> Check Duplicate
                                                        └─> Respond Invalid (400)
─> Insert Candidate Row ─> Respond Accepted (202) ─> Should Process?
─> Run Evidence Agent ─> Run Curation ─> Retry Agent? ─┬─> Update Candidate Row
          │                  │                          └─> (kembali ke Run Evidence Agent, maks. 2×)
          └──────────────────┴─> Mark Failed (bila sub-workflow error)
```

| Tahap (sticky note) | Node | Fungsi |
| :--- | :--- | :--- |
| 1. Intake dan akses | `Prepare Ingest` | Menormalkan body, membuat `candidate_id` (`CAND-YYYYMMDD-XXXXXX`), mengumpulkan semua ID dari header (pengirim, to, cc, bcc). |
| | `Get Directory`, `Resolve Access` | Menentukan `owner_pic` (pengirim pesan pertama), `owner_team`, dan `access_users` dengan aturan 3.3 plan doc: orang yang disebut, seluruh anggota tim untuk alamat `TEAM-x`, dan SPV setiap tim yang terlibat. |
| | `Find Active Duplicate`, `Check Duplicate` | `source_id` yang sama sedang `processing`/`pending_validation`/`approving` → `already_pending`. Pengirim di luar direktori → `failed`. |
| 2. Staging dan balasan cepat | `Insert Candidate Row`, `Respond Accepted` | Membuat baris dengan status awal, lalu membalas 202. |
| | `Should Process?` | Hanya status `processing` yang lanjut ke tahap AI. |
| 3. Tahap AI | `Run Evidence Agent` | Menjalankan `kms_evidence_agent` dengan input `email` dan `candidate`. |
| | `Run Curation` | Menjalankan `kms_curate_stage` dengan `agent_result`, `email`, `candidate`; mengembalikan update baris. |
| | `Retry Agent?` | Bila hasil `retryable` (agen berhenti tanpa `evidence_ready` atau output kurator tidak terbaca), ulangi agen. Maksimal 2 kali (`$runIndex < 2`). |
| 4. Hasil | `Update Candidate Row` | Menulis status akhir (`pending_validation`, `skipped`, `already_exists`, atau `failed`) beserta hasil kurasi. |
| | `Mark Failed` | Menangkap error dari sub-workflow dan menulis `failed` + pesan error. |

## Aturan penting

- **Akses tidak pernah ditentukan LLM.** `access_users` dihitung di `Resolve Access` dan dibekukan di baris kandidat. Validator tidak dapat mengubahnya.
- **Pengirim = owner.** Hanya `owner_pic` yang kelak boleh memvalidasi (ditegakkan di `kms_validate_knowledge`).
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
