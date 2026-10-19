# gdrive_pdf_reader

| | |
| :--- | :--- |
| **ID** | `ElNyCOiUqBdJJli0` |
| **Pemicu** | Sub-workflow tool (`When Called by Agent`); juga `Test Run` manual dengan PDF uji |
| **Dipanggil oleh** | `document_extractor` di `kms_evidence_agent` |
| **Kredensial** | `Google SA - docs reader` (scope `drive.readonly`) |

## Tujuan

Membaca teks **satu PDF yang disimpan di Google Drive**, tanpa LLM.

## Input

`url`: tautan file Drive (`drive.google.com/file/d/<id>`, `open?id=`, `uc?id=`) atau ID polos.

## Output

`source_id` (`gpdf:<id>`), `title` (nama file), `url`, `modified_time`, `size_bytes`, `text`, `page_count`, `char_count`, `truncated`, `extraction_status`, `errors[]`.

## Alur

```text
When Called by Agent ─> Parse PDF Link ─> Is Valid PDF Link? ─┬─> Get File Metadata ─> Check PDF Metadata ─> Is Readable PDF? ─┬─> Download PDF ─> Extract PDF Text ─> Build PDF JSON ─> Redact Sensitive Data
                                                               │                                                               └──────────────────────────────────────> Build PDF JSON ─> Redact Sensitive Data
                                                               └──────────────────────────────────────────────────────────────────────────────────────────────────────> Build PDF JSON ─> Redact Sensitive Data
```

1. Metadata dicek dulu: harus `application/pdf` dan ≤ 20 MB.
2. File diunduh lewat Drive API (`alt=media`).
3. Node *Extract from File* (operasi PDF) membaca lapisan teks secara lokal.
4. Teks dibersihkan dan dipotong pada 100.000 karakter.

## Redaksi (NFR4)

Node terakhir, `Redact Sensitive Data`, memanggil workflow `redact_sensitive_data` untuk menyamarkan kredensial dan data pribadi di seluruh hasil (teks, judul, sel, formula) sebelum dikembalikan ke model extractor. Hasil diberi field `redactions[]` (`category`, `type`, `masked_value`). Tautan dan `source_id` tidak diubah. Aturan: [redact_sensitive_data.md](redact_sensitive_data.md).

## Kode error

`missing_url`, `wrong_file_type`, `not_a_file` (tautan folder), `invalid_link`, `not_found`, `access_denied`, `auth_failed`, `fetch_failed`, `file_too_large`, `encrypted_pdf`, `extract_failed`, `no_text_layer`, `text_truncated`.

## Catatan

- **PDF hasil scan** tidak memiliki lapisan teks → `extraction_status: empty` dengan `no_text_layer`. Kurator hanya menyitasi tautannya dan tidak menebak isi. Fallback OCR/LLM belum dibuat.
- Sudah diuji mandiri (PDF 2 halaman, ±1 detik). Belum terpakai di uji pipeline penuh karena folder uji hanya berisi PDF yang tidak terkait.
