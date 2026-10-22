# knowledge_writer_upsert

| | |
| :--- | :--- |
| **ID** | `KwrUpsert20260810A1` |
| **Pemicu** | Sub-workflow (`When Executed by Another Workflow`) |
| **Dipanggil oleh** | `kms_validate_knowledge` (node `Run Writer`) |
| **Kredensial** | `9router token` (embedding) |
| **Requirement** | FR6 (satu versi aktif), GR4 (`access_users` di setiap titik) |

## Tujuan

Menulis knowledge yang **sudah divalidasi** ke Qdrant: dokumen master ke `knowledge_store` dan chunk ber-embedding ke `knowledge`. Hanya workflow ini yang menulis ke Qdrant.

## Input

`input.knowledge`: `curated_payload` kandidat (sudah di-patch validator) ditambah `access_users`, `owner_pic`, `owner_team`, `candidate_id`, `validated_by`, serta (v2.12) `source_emails`, `source_files`, dan `message_ids` gabungan dari `kms_validate_knowledge`. Status harus `candidate` atau `updated_candidate`.

## Output

`status: saved`, `operation` (`create` / `update`), `knowledge_id`, `master_point_id`, `chunks_written`, `chunk_ids`.

## Alur

```text
When Executed by Another Workflow ─> Validate and Prepare ─> Attach Governance Metadata ─> Save Master to Store
─> Build Chunk Items ─> Embedding ─> Prepare Qdrant Point ─> Aggregate Points ─> Should Delete Existing Chunks?
   ─┬─> Delete Existing Chunks ─> Qdrant Upsert ─> Output      (update)
    └─────────────────────────────> Qdrant Upsert ─> Output     (create)
```

| Node | Fungsi |
| :--- | :--- |
| `Validate and Prepare` | Validasi status/judul/ringkasan; untuk pembaruan, menggabungkan `structured_details` lama dan baru (array digabung, `raw_structured_evidence` di-merge); membuat `knowledge_id` baru bila perlu; memecah konten menjadi chunk per bagian (`overview`, `facts`, `conditions`, `conflicts`, dan setiap kategori `structured_details`), maks. 6.000 karakter per chunk. |
| `Attach Governance Metadata` | Menambahkan `access_users`, `owner_pic`, `owner_team`, `candidate_id`, `validated_by`, `validated_at`, `knowledge_type`, `product_or_channel`, `project_name`, dan `message_ids` ke master dan setiap chunk. Tanpa `access_users` → error. |
| `Delete Existing Chunks` | Pada pembaruan, menghapus semua chunk lama `knowledge_id` yang sama sebelum menulis versi gabungan. |

## Aturan

- **ID titik deterministik** (hash dari `knowledge_id#bagian#urutan`), sehingga upsert berulang tidak menggandakan data.
- **Kunci dedup (`source_ids`, `email_ids`) hanya dari sumber yang benar-benar dibaca.** Sumber `reference_only` dan folder Drive tetap tercantum di `sources` (untuk sitasi) tetapi tidak menjadi kunci dedup, agar email berikutnya yang membagikan folder sama dengan dokumen baru tidak dianggap duplikat (perbaikan 16 Oktober 2026).
- **`message_ids` disimpan bersama `source_ids`.** Dipakai `saved_knowledge` untuk membedakan duplikat persis dari thread yang bertambah balasan (thread lanjutan menjadi pembaruan, bukan `already_exists`).
- **Sumber selalu email (v2.12).** `source_ids` = sumber kandidat (tanpa `reference_only`/folder) digabung dengan `source_emails`, lalu ID `KNOWLEDGE-…` dibuang. Sebelumnya pembaruan menimpa `source_ids`/`email_ids` dengan sumber kandidat terbaru saja, sehingga email versi lama hilang dari Qdrant (contoh: EMAIL-D5 pada knowledge PRD Onboarding Premium). `source_emails` (`{ source_id, subject, date }`) dan `source_files` (`{ source_id, name, source_type, url }`, file yang dibaca di semua versi; tanpa folder dan `reference_only`) disimpan di master dan setiap chunk untuk sitasi chatbot.
- `raw_structured_evidence` hanya disimpan di `knowledge_store`, tidak di-chunk.
