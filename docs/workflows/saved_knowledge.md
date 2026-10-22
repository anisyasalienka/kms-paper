# saved_knowledge

| | |
| :--- | :--- |
| **ID** | `2SHsvB58CqAthDHa` |
| **Pemicu** | Sub-workflow tool (`When Executed by Another Workflow`) |
| **Dipanggil oleh** | `kms_evidence_agent` (dedup ingest), `Chat with Qdrant Knowledge` (pencarian chatbot) |
| **Kredensial** | `9router token` (embedding) |
| **Requirement** | GR4 (filter akses chatbot), dedup ingest (layer 2–3 dari 5-layer guard) |

## Tujuan

Pencarian semantik di koleksi Qdrant `knowledge`, dipakai untuk dua keperluan: deteksi duplikat/pembaruan saat ingest, dan retrieval untuk chatbot.

## Input

```json
{
  "query": { "subject": "...", "body": "...", "project_name": null, "topics": [] },
  "source_context": { "email_id": "EMAIL-S1", "source_ids": ["gdoc:..."], "message_ids": ["EMAIL-S1-M01"] },
  "access_scope": "user", "user_id": "STAFF-1A", "min_related_score": 0.65
}
```

`query` dipakai untuk embedding; `source_context` hanya untuk pencocokan sumber persis. `message_ids` diisi otomatis oleh `kms_evidence_agent` dari email (bukan oleh LLM).

## Output

`match_type` (`exact_source` / `related_existing_knowledge` / `no_match`), `same_source`, `score`, `thread_continuation`, `new_message_ids`, `knowledge_id`, `content`, `source_ids`, `source_emails` dan `source_files` (v2.12; titik lama tanpa field ini diisi dari `email_ids`/`source_ids`), `existing_knowledge` (payload lengkap kecocokan teratas), `related_chunks[]`, `reason`.

## Alur

```text
When Executed by Another Workflow ─> Prepare Embedding ─> Embedding (text-embedding-3-small) ─> Semantic Search (Qdrant, limit 5) ─> Output
```

## Aturan

- `access_scope: 'user'` → filter Qdrant `access_users` berisi `user_id`. User tanpa akses tidak melihat apa pun (deny by default).
- `exact_source`: salah satu `source_id`/`email_id` saat ini sudah ada di `source_ids`/`email_ids` titik Qdrant, **dan** semua `message_ids` saat ini sudah tersimpan. Knowledge lama yang belum punya `message_ids` tetap dianggap exact.
- Thread lanjutan: `source_id` sama tetapi ada `message_id` yang belum tersimpan. Hasilnya `related_existing_knowledge` dengan `thread_continuation: true` dan `new_message_ids`, lalu kurator membuat `updated_candidate` (lihat `kms_curate_stage`, node `Build Curator Request`).
- `min_related_score` (ingest: 0,65): tetangga semantik yang lemah dikembalikan sebagai `no_match`, sehingga tidak dianggap pembaruan knowledge lain.

## Catatan

- Body `Embedding` disusun dengan `JSON.stringify` dari `query_text` (perbaikan 16 Oktober 2026). Sebelumnya isi email ditempel mentah ke template JSON, sehingga baris baru atau tanda kutip membuat panggilan pertama selalu gagal.
