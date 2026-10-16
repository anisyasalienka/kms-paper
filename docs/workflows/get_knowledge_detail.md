# get_knowledge_detail

| | |
| :--- | :--- |
| **ID** | `GetKnowDetail2026` |
| **Pemicu** | Sub-workflow tool (`When Executed by Another Workflow`) |
| **Dipanggil oleh** | `Chat with Qdrant Knowledge` (tool `Get Section Details`) |
| **Requirement** | GR4 (filter akses wajib) |

## Tujuan

Mengambil detail teknis satu bagian (`tracking_specifications`, `requirements`, `test_cases`, `test_scenarios`, `design_references`, `git_references`, `implementation_notes`) dari dokumen master di koleksi Qdrant `knowledge_store`. Chatbot memakainya saat pengguna meminta nilai persis, misalnya skrip HTML atau test case.

## Input

```json
{ "knowledge_id": "KNOWLEDGE-...", "section": "test_cases", "filter_query": "opsional", "user_id": "STAFF-1A" }
```

## Output

Data bagian yang diminta (difilter `filter_query` bila ada), atau `found: false` dengan pesan.

## Alur

```text
When Executed by Another Workflow ─> Fetch from Qdrant Store (scroll, filter knowledge_id + access_users) ─> Filter Section & Query
```

## Aturan

Filter `access_users` **selalu** diterapkan. Knowledge yang tidak boleh diakses terlihat sama dengan "tidak ditemukan", sehingga keberadaannya tidak bocor.
