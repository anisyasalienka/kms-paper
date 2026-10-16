# kms_curator_llm

| | |
| :--- | :--- |
| **ID** | `AoK0uKKmiK5peSVp` |
| **Pemicu** | Sub-workflow (`When Called by Ingest`) |
| **Dipanggil oleh** | `kms_curate_stage` (node `Run Curator LLM`) |
| **Kredensial** | `9router token` (Bearer) |

## Tujuan

Satu panggilan chat completion untuk kurator, terpisah dari agen. Panggilan memakai jaringan Docker internal (`http://9router:20128/v1/chat/completions`), sehingga batas ±100 detik Cloudflare (HTTP 524) tidak berlaku.

## Input

`request_body`: string JSON chat completion yang sudah disusun `Build Curator Request` (`model`, `messages` berisi system prompt dan evidence).

## Output

```json
{ "content": "<JSON kurator>", "finish_reason": "stop", "model": "...", "usage": { "prompt_tokens": 0, "completion_tokens": 0 } }
```

## Alur

```text
When Called by Ingest ─> Chat Completion (HTTP, timeout 170 s, retry 1× setelah 3 s) ─> Return Content
```

## Catatan

- Bila kedua percobaan gagal, workflow error dan `kms_curate_stage` menulis `failed` lewat `Stage Failed`.
- Model ditentukan oleh body, bukan oleh workflow ini; ganti model di `Build Curator Request`.
- Workflow ini dibuat terpisah karena server MCP n8n tidak dapat memasang kredensial ke node HTTP lewat update; workflow baru dengan kredensial dapat dibuat lewat kode.
