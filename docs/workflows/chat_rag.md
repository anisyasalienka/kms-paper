# Chat with Qdrant Knowledge (chat-rag)

| | |
| :--- | :--- |
| **ID** | `RagChatQdrant20260811` |
| **Pemicu** | `POST /webhook/chat-rag` (Header Auth); juga chat trigger bawaan n8n untuk uji di UI |
| **Dipanggil oleh** | Frontend, Komponen 3 (Chatbot) |
| **Memanggil** | `saved_knowledge`, `get_knowledge_detail`; model `ag/gemini-3.8-flash` (kredensial `9Router`) |
| **Requirement** | GR4 (hanya knowledge yang boleh diakses), FR8 (sitasi) |

## Tujuan

Chatbot RAG yang menjawab hanya dari knowledge yang sudah divalidasi **dan** boleh diakses penanya.

## Input

`{ "chatInput": "pertanyaan", "user_id": "STAFF-2A" }`

## Output

`{ "output": "jawaban dalam Bahasa Indonesia dengan bagian Sumber:" }`

## Alur

```text
Webhook Trigger / When chat message received ─> Request Context ─> Qdrant Knowledge Agent
                                                                     ├─ Search Qdrant Knowledge  (saved_knowledge, access_scope 'user')
                                                                     └─ Get Section Details      (get_knowledge_detail)
```

## Aturan

- **Filter deterministik.** `Request Context` menetapkan `user_id`; kedua tool mengambilnya dari node itu, bukan dari `$fromAI`. LLM hanya mengisi query, sehingga tidak dapat melewati filter akses.
- Agen selalu mencari dulu, mengambil detail bagian bila diminta nilai persis, dan menutup jawaban dengan "Sumber:" (judul, `source_ids`, tanggal efektif, `validated_by`).
- Bila tidak ada hasil, agen menjawab bahwa informasi tidak ditemukan di basis pengetahuan yang dapat diakses, tanpa berspekulasi.

## Bukti uji

Setelah knowledge s4 di-approve: STAFF-2A mendapat base URL staging dan client secret termasking (`Qris#****`) beserta sumber; STAFF-3A mendapat jawaban "tidak ditemukan". Hasil uji akses skenario 1–3b ada di bagian 8 plan doc.
