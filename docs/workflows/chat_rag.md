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

`{ "chatInput": "pertanyaan", "user_id": "STAFF-2A", "history": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }] }`

`history` opsional (v2.11): pesan sebelumnya di layar, dikirim frontend. `Request Context` hanya memakai 4 pesan terakhir dengan role `user`/`assistant`, memotong tiap pesan menjadi 600 karakter, dan membuang bagian "Sumber:".

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
- Agen selalu mencari dulu, mengambil detail bagian bila diminta nilai persis, dan menutup jawaban dengan "Sumber:" (judul, tanggal efektif, `validated_by`, lalu setiap email di `source_emails` sebagai "subjek (ID)"). Sejak v2.12 aturan 6 melarang mengutip `KNOWLEDGE-…`, ID chunk, atau ID dokumen; sumber selalu email.
- Bila tidak ada hasil, agen menjawab bahwa informasi tidak ditemukan di basis pengetahuan yang dapat diakses, tanpa berspekulasi.
- **Pertanyaan lanjutan (v2.11).** Bila ada riwayat, prompt agen berisi "Riwayat percakapan sebelumnya" lalu "Pertanyaan baru". Aturan 7 meminta agen melengkapi rujukan singkat ("siapa validatornya?") dengan subjek dari riwayat sebelum mencari, dan melarang menjawab dari riwayat. Workflow tidak memakai node Memory; percakapan tidak disimpan di n8n.

## Bukti uji

Sumber email (23 Okt 2026, v2.12): STAFF-3A bertanya "Kenapa verifikasi onboarding premium tidak pakai OTP SMS?"; bagian Sumber berisi "Draf PRD Onboarding Langganan Premium v1 (EMAIL-D1)" dan "Keputusan metode verifikasi pengguna baru (EMAIL-D5)", tanpa ID knowledge. Rincian: `docs/evaluation/2026-10-23-email-sources/`.

Setelah knowledge s4 di-approve: STAFF-2A mendapat base URL staging dan client secret termasking (`Qris#****`) beserta sumber; STAFF-3A mendapat jawaban "tidak ditemukan". Hasil uji akses skenario 1–3b ada di bagian 8 plan doc.

Pertanyaan lanjutan (20 Okt 2026, basis pengetahuan kosong): eksekusi 5109, "siapa validatornya?" setelah pertanyaan rilis Search Result Video dicari sebagai "siapa validator fitur Search Result Video". Rincian: `docs/evaluation/2026-10-20-chat-history/`.
