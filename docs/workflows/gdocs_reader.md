# gdocs_reader

| | |
| :--- | :--- |
| **ID** | `VO3XcHfsCmvZwLax` |
| **Pemicu** | Sub-workflow tool (`When Called by Agent`) |
| **Dipanggil oleh** | `document_extractor` di `kms_evidence_agent` |
| **Kredensial** | `Google SA - docs reader` (Docs API) |

## Tujuan

Membaca **seluruh isi satu Google Doc** dari tautannya, termasuk semua tab, dan mengembalikannya sebagai teks berstruktur.

## Input

`url`: tautan Google Docs (`docs.google.com/document/d/<id>`), tautan `drive.google.com/file/d/<id>`, atau ID polos.

## Output

`source_id` (`gdoc:<id>`), `title`, `tabs[]`, `text` (heading `#`, daftar bernomor bertingkat, tabel sebagai baris `|`), `outline[]`, `char_count`, `extraction_status` (`success` / `empty` / `failed`), `errors[]`.

## Alur

```text
When Called by Agent ─> Parse Doc Link ─> Is Valid Docs Link? ─┬─> Fetch Google Doc (Docs API, includeTabsContent=true) ─> Build Document JSON
                                                                └─────────────────────────────────────────────────────────> Build Document JSON
```

## Kode error

`missing_url`, `wrong_file_type` (tautan Sheets/Slides/Forms), `invalid_link`, `not_found`, `access_denied`, `auth_failed`, `fetch_failed`, `empty_document`.

## Catatan

- Dokumen cukup dibagikan "Anyone with the link (Viewer)".
- Workflow tidak pernah melempar error; kegagalan dikembalikan sebagai `extraction_status: failed`.
