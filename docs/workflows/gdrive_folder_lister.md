# gdrive_folder_lister

| | |
| :--- | :--- |
| **ID** | `JITewMLouD0Lz1dT` |
| **Pemicu** | Sub-workflow tool (`When Called by Agent`); juga `Test Run` manual dengan folder uji |
| **Dipanggil oleh** | Orchestrator di `kms_evidence_agent` |
| **Kredensial** | `Google SA - docs reader` (scope `drive.readonly`) |

## Tujuan

**Mendaftar** file PDF, Google Docs, dan Google Sheets di level teratas satu folder Google Drive. Tool ini tidak membaca isi file; orchestrator meneruskan setiap file ke reader yang sesuai.

## Input

`url`: tautan folder (`drive.google.com/drive/folders/<id>`, termasuk varian `/u/<n>/` dan `open?id=`) atau ID polos.

## Output

```json
{
  "source_id": "gfolder:<id>", "url": "...", "file_count": 3,
  "files": [ { "source_id": "gdoc:<id>", "type": "gdoc", "name": "...", "url": "...", "modified_time": "...", "reader_tool": "gdocs_reader" } ],
  "skipped": [ { "name": "...", "mime_type": "...", "reason": "subfolder (top level only)" } ],
  "truncated": false, "extraction_status": "success", "errors": []
}
```

`type`: `pdf` (`gpdf:`), `gdoc` (`gdoc:`), `gsheet` (`gsheet:`). Shortcut diklasifikasi menurut file tujuannya.

## Alur

```text
When Called by Agent ─> Parse Folder Link ─> Is Valid Folder Link? ─┬─> List Folder Files (Drive files.list) ─> Build Folder JSON
                                                                     └──────────────────────────────────────> Build Folder JSON
```

Query Drive: `'<id>' in parents and trashed = false`, maksimal 200 item, urut nama, `supportsAllDrives=true`.

## Kode error

`missing_url`, `not_a_folder` (tautan satu file), `invalid_link`, `not_found`, `access_denied`, `auth_failed`, `fetch_failed`, `no_supported_files`.

## Catatan

- Folder cukup dibagikan "Anyone with the link (Viewer)".
- Hanya level teratas; subfolder dilaporkan di `skipped`.
- Lebih dari 200 item → `truncated: true`.
