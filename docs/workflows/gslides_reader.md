# gslides_reader

| | |
| :--- | :--- |
| **ID** | `omMFETSvIK89bc83` |
| **Pemicu** | Sub-workflow tool (`When Called by Agent`) |
| **Dipanggil oleh** | `document_extractor` di `kms_evidence_agent` |
| **Kredensial** | `Google SA - docs reader` (Slides API, scope `drive.readonly`) |

## Tujuan

Membaca **seluruh isi satu presentasi Google Slides** dari tautannya, slide demi slide, termasuk tabel dan catatan pembicara, lalu mengembalikannya sebagai teks berstruktur.

## Input

`url`: tautan Google Slides (`docs.google.com/presentation/d/<id>`), tautan `drive.google.com/file/d/<id>`, atau ID polos.

## Output

`source_id` (`gslide:<id>`), `title`, `slides[]` (`slide_number`, `title`, `skipped`, `has_notes`, `has_text`, `image_count`, `char_count`), `slide_count`, `text`, `outline[]`, `char_count`, `extraction_status` (`success` / `empty` / `failed`), `errors[]`.

Format `text`:

```text
# <judul presentasi>
## Slide 1: <judul slide>
- poin
  - sub-poin
| sel | sel |
[2 gambar]
Catatan pembicara: <isi catatan>
## Slide 2 (disembunyikan)
...
```

Judul slide diambil dari placeholder judul. Bila slide tidak punya placeholder judul (umum pada deck buatan Gemini atau tool AI lain), kotak teks pertama yang berisi satu baris pendek (maks. 100 karakter) dipakai sebagai judul. Placeholder nomor slide, tanggal, dan footer diabaikan. Gambar hanya dihitung (isinya tidak dibaca). Chart dari Google Sheets dan video ditulis sebagai penanda.

## Alur

```text
When Called by Agent ─> Parse Slides Link ─> Is Valid Slides Link? ─┬─> Fetch Google Slides (Slides API, fields=title,slides) ─> Build Slides JSON ─> Redact Sensitive Data
                                                                     └──────────────────────────────────────────────────────> Build Slides JSON ─> Redact Sensitive Data
```

## Redaksi (NFR4)

Node terakhir, `Redact Sensitive Data`, memanggil workflow `redact_sensitive_data` untuk menyamarkan kredensial dan data pribadi di seluruh hasil (teks slide dan catatan pembicara) sebelum dikembalikan ke model extractor. Aturan: [redact_sensitive_data.md](redact_sensitive_data.md).

## Kode error

`missing_url`, `wrong_file_type` (tautan Docs/Sheets/Forms/folder, atau file .pptx yang diunggah ke Drive), `invalid_link`, `api_disabled` (Slides API belum diaktifkan di project service account), `not_found`, `access_denied`, `auth_failed`, `fetch_failed`, `empty_presentation`.

## Catatan

- Presentasi cukup dibagikan "Anyone with the link (Viewer)".
- Google Slides API harus aktif di project Google Cloud milik service account (project `498137184158`).
- Hanya Google Slides asli. File .pptx yang diunggah ke Drive tidak didukung dan tetap masuk `skipped` di `gdrive_folder_lister`.
- Workflow tidak pernah melempar error; kegagalan dikembalikan sebagai `extraction_status: failed`.
