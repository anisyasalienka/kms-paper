# Dokumentasi Workflow n8n KMS

Folder ini menjelaskan setiap workflow n8n yang membentuk prototipe KMS. Satu file per workflow, dengan format yang sama: tujuan, pemicu dan input, output, alur, aturan yang ditegakkan, ketergantungan, dan cara menguji. Arsitektur keseluruhan ada di `../../Arsitektur dan Rencana Implementasi Frontend-n8n KMS.md`.

Semua workflow berjalan di n8n 2.27.3 (`https://n8n.cencendi.my.id`). Frontend memanggil `/api/<path>`; nginx (atau proxy Vite saat pengembangan) meneruskannya ke `/webhook/<path>` dan menyisipkan header `X-KMS-API-KEY`.

## Daftar workflow

| Kelompok | Workflow | ID | Pemicu | File |
| :--- | :--- | :--- | :--- | :--- |
| Ingest | `kms_ingest` | `BiDjvbh6ZdCRDlB6` | `POST /webhook/ingest-email` | [kms_ingest.md](kms_ingest.md) |
| Ingest | `kms_evidence_agent` | `KmsEvidAgent2026` | Sub-workflow | [kms_evidence_agent.md](kms_evidence_agent.md) |
| Ingest | `kms_curate_stage` | `KmsCurateStg2026` | Sub-workflow | [kms_curate_stage.md](kms_curate_stage.md) |
| Ingest | `kms_curator_llm` | `AoK0uKKmiK5peSVp` | Sub-workflow | [kms_curator_llm.md](kms_curator_llm.md) |
| Tool baca sumber | `gdocs_reader` | `VO3XcHfsCmvZwLax` | Tool agen | [gdocs_reader.md](gdocs_reader.md) |
| Tool baca sumber | `gsheets_reader` | `tYUmV5RKkwsiw6C8` | Tool agen | [gsheets_reader.md](gsheets_reader.md) |
| Tool baca sumber | `gslides_reader` | `omMFETSvIK89bc83` | Tool agen | [gslides_reader.md](gslides_reader.md) |
| Tool baca sumber | `gdrive_folder_lister` | `JITewMLouD0Lz1dT` | Tool agen | [gdrive_folder_lister.md](gdrive_folder_lister.md) |
| Tool baca sumber | `gdrive_pdf_reader` | `ElNyCOiUqBdJJli0` | Tool agen | [gdrive_pdf_reader.md](gdrive_pdf_reader.md) |
| Keamanan | `redact_sensitive_data` | `KmsRedaction2026` | Sub-workflow | [redact_sensitive_data.md](redact_sensitive_data.md) |
| Pengetahuan | `saved_knowledge` | `2SHsvB58CqAthDHa` | Tool (ingest & chatbot) | [saved_knowledge.md](saved_knowledge.md) |
| Pengetahuan | `get_knowledge_detail` | `GetKnowDetail2026` | Tool chatbot | [get_knowledge_detail.md](get_knowledge_detail.md) |
| Pengetahuan | `knowledge_writer_upsert` | `KwrUpsert20260810A1` | Sub-workflow | [knowledge_writer_upsert.md](knowledge_writer_upsert.md) |
| Validasi | `kms_validate_knowledge` | `kGreWkk0geO6v29i` | `POST /webhook/validate-knowledge` | [kms_validate_knowledge.md](kms_validate_knowledge.md) |
| Chatbot | `Chat with Qdrant Knowledge` | `RagChatQdrant20260811` | `POST /webhook/chat-rag` | [chat_rag.md](chat_rag.md) |
| Portal | `kms_candidate_status` | `GhJKHDSm3ympl89h` | `GET /webhook/candidate-status` | [kms_candidate_status.md](kms_candidate_status.md) |
| Portal | `kms_directory` | `bpUU2HibzLVT0p3x` | `GET /webhook/directory` | [kms_directory.md](kms_directory.md) |
| Portal | `kms_portal_api` | `K05IetusDReVqoiS` | `my-candidates`, `lead-summary`, `nudge` | [kms_portal_api.md](kms_portal_api.md) |
| Admin | `kms_admin_reset` | `PaKzTvasVYO37l6b` | Manual | [kms_admin_reset.md](kms_admin_reset.md) |

## Peta pemanggilan

```text
Frontend ──/api──> nginx ──> n8n webhooks
                               │
  ingest-email ───────────────>│ kms_ingest ─> redact_sensitive_data (email disamarkan dulu)
                               │   ├─> kms_evidence_agent
                               │   │     ├─ inspect_email, list_attachments      (agent tool + model sendiri)
                               │   │     ├─ saved_knowledge ─────────────────────> Qdrant knowledge
                               │   │     ├─ gdrive_folder_lister ───────────────> Google Drive API
                               │   │     ├─ document_extractor ─ gdocs_reader, gslides_reader, gdrive_pdf_reader
                               │   │     └─ spreadsheet_extractor ─ gsheets_reader
                               │   └─> kms_curate_stage
                               │         └─> kms_curator_llm ──────────────────> 9router (internal)
  candidate-status ───────────>│ kms_candidate_status
  validate-knowledge ─────────>│ kms_validate_knowledge ─> knowledge_writer_upsert ─> Qdrant
  chat-rag ───────────────────>│ Chat with Qdrant Knowledge ─ saved_knowledge, get_knowledge_detail
  directory, my-candidates,    │ kms_directory, kms_portal_api
  lead-summary, nudge ────────>│
```

## Penyimpanan data

| Tempat | Isi | Ditulis oleh |
| :--- | :--- | :--- |
| Data Table `kms_directory` (`S5KVXAkYgkydP1OY`) | 12 user pseudonim (3 tim) | `kms_admin_reset` |
| Data Table `kms_candidates` (`kbUIDYKuQb34aXmv`) | Kandidat staging dan statusnya | `kms_ingest`, `kms_validate_knowledge`, `kms_candidate_status` |
| Data Table `kms_validation_logs` (`tqzfRLVDBMSKiwec`) | Audit log validasi dan nudge | `kms_validate_knowledge`, `kms_portal_api` |
| Qdrant `knowledge` | Chunk ber-embedding, hanya yang approved | `knowledge_writer_upsert` |
| Qdrant `knowledge_store` | Dokumen master lengkap per knowledge | `knowledge_writer_upsert` |

## Kredensial

| Kredensial | Dipakai oleh |
| :--- | :--- |
| `KMS API Key (X-KMS-API-KEY)` (Header Auth) | Semua webhook KMS |
| `9Router` (OpenAI API) | Model LLM di `kms_evidence_agent` dan chatbot |
| `9router token` (Bearer) | `kms_curator_llm`, embedding di `saved_knowledge` dan `knowledge_writer_upsert` |
| `Google SA - docs reader` (service account; scope Docs dan Sheets, ditambah `drive.readonly` untuk Drive dan Slides; Slides API harus aktif di project) | Kelima tool baca sumber Google |

## Konvensi

- **Nama node:** langkah biasa memakai kata kerja Title Case (`Resolve Access`, `Collect Evidence`). Node tool agen memakai nama tool persis seperti di prompt (`inspect_email`, `document_extractor`), karena nama node menjadi nama tool yang dilihat model. Node model diberi nama `Model: <tool>`.
- **Sticky note** (Bahasa Indonesia) ada di setiap kanvas KMS, satu per tahap, berisi fungsi tahap dan requirement yang dicakup (FR, GR). Nama node tetap berbahasa Inggris.
- **Tool tidak pernah melempar error.** Tool baca sumber selalu mengembalikan `extraction_status` (`success`, `empty`, `failed`) dan `errors[]`, sehingga agen dapat melanjutkan.
- **Aturan akses dan dedup ditegakkan oleh kode**, bukan oleh LLM.
- **Model tidak pernah menerima data sensitif mentah.** Workflow `redact_sensitive_data`, dipanggil dari `kms_ingest` dan keempat reader Google, menyamarkan kredensial dan data pribadi sebelum teks diserahkan ke model (NFR4). Lihat [redact_sensitive_data.md](redact_sensitive_data.md).

## Pengujian

Skenario uji ada di `../../dummy-emails/` (s0–s5b, lihat README di sana; s5b dikirim setelah s5 di-approve). Sebelum satu putaran evaluasi, jalankan `kms_admin_reset`. Untuk satu email, kirim `POST /api/ingest-email` lalu polling `GET /api/candidate-status?id=<candidate_id>` hingga status bukan `processing`.

Cadangan seluruh workflow sebelum restrukturisasi 16 Oktober 2026: `/home/cendi/n8n/backups/workflows-2026-10-16-before-restructure/`.
