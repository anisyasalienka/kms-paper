# kms_evidence_agent

| | |
| :--- | :--- |
| **ID** | `KmsEvidAgent2026` |
| **Pemicu** | Sub-workflow (`When Called by Ingest`) |
| **Dipanggil oleh** | `kms_ingest` (node `Run Evidence Agent`) |
| **Memanggil** | `saved_knowledge`, `gdrive_folder_lister`, `gdocs_reader`, `gsheets_reader`, `gslides_reader`, `gdrive_pdf_reader`; LLM lewat kredensial `9Router` |
| **Requirement** | FR1/FR2 (saring non-knowledge), FR3 (ekstraksi lampiran dan tautan), dedup ingest |

## Tujuan

Agen orchestrator yang **mengumpulkan evidence** untuk satu email. Agen hanya merutekan: memanggil tool dalam urutan tetap lalu berhenti dengan `{"status": "evidence_ready"}`. Agen tidak menulis pengetahuan dan tidak menyalin hasil tool; semua hasil tool dikembalikan apa adanya lewat *intermediate steps*.

## Input

| Field | Isi |
| :--- | :--- |
| `email` | JSON email lengkap (sama seperti body ingest). |
| `candidate` | `candidate_id`, `source_id`, `owner_pic`, `owner_team`, `subject`. Tidak ada project: orchestrator menyimpulkan `project_name` dari subjek dan isi email untuk query `saved_knowledge` dan panggilan extractor. |

## Output

```json
{ "output": "{\"status\": \"evidence_ready\"}", "intermediateSteps": [ { "action": { "tool": "inspect_email", "toolInput": {} }, "observation": "..." } ], "error": null }
```

`output` juga dapat berupa `{"is_knowledge": false, ...}` (bukan pengetahuan) atau `{"status": "already_exists", ...}` (duplikat persis).

## Alur

```text
When Called by Ingest ─> Candidate Context ─> Current Email ─> Evidence Agent ─> Package Agent Result
                                                                   │
        tools: inspect_email, saved_knowledge, list_attachments, document_extractor,
               spreadsheet_extractor, gdrive_folder_lister
        readers (di bawah extractor): gdocs_reader, gslides_reader, gdrive_pdf_reader, gsheets_reader
```

| Node | Jenis | Fungsi |
| :--- | :--- | :--- |
| `Candidate Context` | Set | Menyimpan pengirim dan sumber; `saved_knowledge` membatasi pencarian ke dokumen yang dapat diakses `owner_pic`. |
| `Current Email` | Set | JSON email yang dibaca setiap tool sebagai input otoritatif. |
| `Evidence Agent` | AI Agent v3.1 | Orchestrator (`Model: orchestrator`, `ag/gemini-3.8-flash-high`), `returnIntermediateSteps: true`, maks. 25 iterasi. |
| `inspect_email` | Agent tool (`Model: inspect_email`, `ollama/gpt-oss:120b`) | Mengklasifikasi email (kriteria inklusi/eksklusi) dan mendeteksi `linked_sources`: `gdoc:`, `gsheet:`, `gslide:`, `gfolder:`, `gpdf:`. |
| `saved_knowledge` | Tool workflow | Pencarian Qdrant: `exact_source`, `related_existing_knowledge` (skor ≥ 0,65, atau `thread_continuation` bila thread yang sama punya pesan baru), atau `no_match`. Ekspresi input menambahkan `source_context.message_ids` dari email secara deterministik; model hanya mengisi query. |
| `list_attachments` | Agent tool (`ollama/gpt-oss:120b`) | Inventaris lampiran yang tertanam di JSON email. |
| `document_extractor` | Agent tool (`ag/gemini-3.8-flash`) | Satu dokumen per panggilan: lampiran PDF/dokumen, tautan Google Docs (via `gdocs_reader`), tautan Google Slides (via `gslides_reader`), atau PDF di Drive (via `gdrive_pdf_reader`). |
| `spreadsheet_extractor` | Agent tool (`ag/gemini-3.8-flash`) | Satu spreadsheet per panggilan: lampiran XLS/XLSX atau tautan Google Sheets (via `gsheets_reader`). |
| `gdrive_folder_lister` | Tool workflow | Mendaftar file di folder Drive (tanpa membaca isi). |
| `Package Agent Result` | Code | Mengembalikan `output`, `intermediateSteps`, dan `error`. Output error agen juga diarahkan ke sini. |

## Urutan kerja agen (dari system prompt)

1. `inspect_email` sekali. Bila bukan pengetahuan → berhenti, kembalikan `is_knowledge: false`.
2. `saved_knowledge` sekali. Bila `exact_source` → berhenti, kembalikan `already_exists`.
3. `list_attachments` bila ada lampiran; `gdrive_folder_lister` untuk setiap folder.
4. Satu extractor per sumber relevan (lampiran, tautan, file folder). Maksimal 5 file per folder; file yang jelas tidak terkait dilewati.
5. Kembalikan `{"status": "evidence_ready"}`.

## Kriteria klasifikasi `inspect_email` (FR1, FR2)

Prompt ada di node `inspect_email` → *System Message*.

| Kelompok | Isi |
| :--- | :--- |
| **Knowledge** | MOM, PRD, UAT, tracking plan, keputusan arsitektur; SOP, jadwal deploy/rilis yang disepakati, instruksi konfigurasi, handover; resolusi isu, post-mortem, perubahan kebijakan; balasan yang mengubah jadwal atau keputusan sebelumnya (reschedule). |
| **Bukan knowledge** | Izin cuti/sakit; obrolan santai; **laporan rutin** harian/mingguan/bulanan yang hanya berisi angka; **undangan kalender deployment**; **balasan IT support** (konfirmasi tiket, reset password, "sudah kami proses"); notifikasi sistem otomatis dan alert build/test CI/CD; undangan kalender dan pengingat; pengumuman HR rutin. |
| **Notifikasi deploy** | Notifikasi hasil deploy (mulai, selesai, gagal, rollback) diberi `is_knowledge: true` dan `deployment_notice: true`. Workflow menyimpannya hanya sebagai pembaruan knowledge yang bisa dikaitkan; selain itu `skipped` (lihat `kms_curate_stage`). Bila notifikasi juga memuat hal di bagian Pengecualian, ia diperlakukan sebagai knowledge biasa (`deployment_notice: false`). |
| **Pengecualian** | Email yang tampak rutin tetap knowledge bila mencatat hal yang nanti dijadikan rujukan: isu beserta penyebab atau perbaikannya, keputusan, perubahan jadwal, atau prosedur yang bisa dipakai ulang. Contoh: laporan mingguan yang mencatat bug tracking dan cara memperbaikinya. |

Laporan rutin, notifikasi deploy, balasan IT support, dan bagian pengecualian ditambahkan 18 Oktober 2026 agar daftar eksklusi sama dengan FR1. Pengecualian berasal dari temuan T2 (I4: laporan isu dan jadwal tetap jadi patokan). Uji: `dummy-emails/s6a`–`s6e`.

Pada 19 Oktober 2026 notifikasi deploy dipindah dari daftar eksklusi ke aturan tersendiri (FR1 direvisi bersama pemilik paper): notifikasi yang menutup siklus project yang sudah tersimpan menjadi pembaruan, sesuai I4 ("setiap stage dari email"). Undangan kalender deployment tetap dikecualikan (I2). Uji: `s6c`, `s6f`, `s6g`.

Untuk email bertanda `deployment_notice`, prompt `Evidence Agent` meminta query `saved_knowledge` disusun dari nama fitur atau rilis (subjek seperti "Rilis fitur Simpan Artikel ke production", `project_name` = nama fitur, bukan nama service), tidak menyalin teks template CI/CD. Tanpa aturan ini s6g hanya mendapat skor 0,62; dengan aturan ini 0,73.

## Aturan extractor

- Permintaan tanpa `attachment_id`/`source_id` ditolak (`missing_source`) tanpa memanggil reader.
- Tautan folder tidak pernah diteruskan ke reader.
- Setiap hasil memuat `relevant_to_email` dan `relevance_reason`; `kms_curate_stage` memakai flag ini untuk memisahkan sumber referensi saja.
- Bagian *Masked values* (ditambahkan 19 Oktober 2026, `document_extractor` dan `spreadsheet_extractor`): label `[KREDENSIAL: …]`/`[DATA_PRIBADI: …]` dari `redact_sensitive_data` adalah nilai asli yang disamarkan. Label disalin apa adanya ke `text`, `structured_details`, dan `extracted_facts`, termasuk satu fakta yang menyebut kredensial atau data pribadi apa saja yang ada di dokumen; tidak boleh dibuang atau ditebak. Tanpa aturan ini extractor melewati nilai tersamar (0/5 pada uji s4; 5/5 dengan aturan). Lihat `docs/evaluation/2026-10-19/masked-values/`.

## Mengubah perilaku

- Prompt orchestrator: node `Evidence Agent` → *System Message*.
- Prompt tiap tool: node tool → *System Message* dan *Tool Description*.
- Model: node `Model: ...`.
- **Jangan mengganti nama node tool** tanpa memperbarui prompt orchestrator dan regex di `Collect Evidence` (`kms_curate_stage`), karena nama node adalah nama tool.

## Catatan

- `saved_knowledge` membaca `$('Candidate Context')` untuk `owner_pic` dan `source_id`. Bila node itu diganti nama, ekspresi input tool ikut harus diubah.
- Variasi waktu terbesar ada di model orchestrator (±20–60 detik per email).
