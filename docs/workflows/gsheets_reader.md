# gsheets_reader

| | |
| :--- | :--- |
| **ID** | `tYUmV5RKkwsiw6C8` |
| **Pemicu** | Sub-workflow tool (`When Called by Agent`) |
| **Dipanggil oleh** | `spreadsheet_extractor` di `kms_evidence_agent` |
| **Kredensial** | `Google SA - docs reader` (Sheets API) |

## Tujuan

Membaca **satu Google Sheet** dari tautannya: semua tab, nilai, dan formula.

## Input

`url`: tautan Google Sheets (`docs.google.com/spreadsheets/d/<id>`) atau ID polos.

## Output

`source_id` (`gsheet:<id>`), `title`, `sheets[]` (per tab: `headers`, `rows` dalam urutan header, `formulas[]` dengan sel, formula, dan nilai, `row_count`, `truncated`), `extraction_status`, `errors[]`.

## Alur

```text
When Called by Agent ─> Parse Sheet Link ─> Is Valid Sheets Link? ─┬─> Fetch Spreadsheet (Sheets API) ─> Build Spreadsheet JSON
                                                                    └──────────────────────────────────> Build Spreadsheet JSON
```

## Batas

- Maksimal 1.000 baris data per tab; sisanya dilaporkan `rows_truncated`.
- Maksimal 200 formula per tab.

## Catatan

Spreadsheet cukup dibagikan "Anyone with the link (Viewer)". Workflow tidak pernah melempar error.
