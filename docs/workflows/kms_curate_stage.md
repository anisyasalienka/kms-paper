# kms_curate_stage

| | |
| :--- | :--- |
| **ID** | `KmsCurateStg2026` |
| **Pemicu** | Sub-workflow (`When Called by Ingest`) |
| **Dipanggil oleh** | `kms_ingest` (node `Run Curation`) |
| **Memanggil** | `kms_curator_llm` |
| **Requirement** | GR7 (masking data sensitif), NFR4 (label redaksi), FR8 (sitasi sumber), dedup dan pengaman pembaruan |

## Tujuan

Mengubah hasil tool agen menjadi **satu kandidat pengetahuan** dan mengembalikan update baris `kms_candidates` ke `kms_ingest`. Evidence dirakit oleh kode, kurator dipanggil sekali, lalu hasilnya diperiksa secara deterministik.

## Input

| Field | Isi |
| :--- | :--- |
| `agent_result` | Output `kms_evidence_agent`: `output`, `intermediateSteps`, `error`. |
| `email` | JSON email asli. |
| `candidate` | `candidate_id`, `owner_pic`, `owner_team`, `subject`, dst. |

## Output

Satu objek update baris: `candidate_id`, `status`, `retryable`, `error_message`, `title`, `summary`, `knowledge_type`, `product_or_channel`, `project_name`, `effective_date`, `has_sensitive_data`, `sensitive_details`, `curated_payload`, `existing_knowledge_id`, `duplicate_of`.

## Alur

```text
When Called by Ingest ─> Collect Evidence ─> Needs Curator? ─┬─> Curator Prompt ─> Build Curator Request ─> Run Curator LLM ─┐
                                                              └────────────────────────────────────────────────────────────────┤
                                                                                         Parse Curator Output <────────────────┘
                                                                                         ─> Build Candidate Update
                         (error kurator, parsing, atau build) ─> Stage Failed
```

| Node | Fungsi |
| :--- | :--- |
| `Collect Evidence` | Membaca `intermediateSteps`, mengelompokkan hasil per tool, dan merakit evidence: `current_email` (email asli tanpa isi lampiran), `email_findings`, `saved_knowledge`, `attachments`, `document_results`, `spreadsheet_results`. Juga menentukan rute (lihat di bawah). |
| `Needs Curator?` | Rute `curate` ke kurator; rute lain langsung ke parsing. |
| `Curator Prompt` | Node Set berisi system prompt kurator. **Sunting prompt di sini.** Kurator juga menyimpulkan `project_name` dari evidence dan memakai ulang nama project dari `saved_knowledge` bila topiknya sama, supaya pengetahuan dari thread berbeda tetap terkelompok (FR4, FR5). Prompt juga meminta label `[KREDENSIAL: …]`/`[DATA_PRIBADI: …]` disalin apa adanya dan tidak ditebak isi aslinya. |
| `Build Curator Request` | Menyusun body chat completion; konstanta `CURATOR_MODEL` (saat ini `ag/gemini-3.8-flash`). Bila `saved_knowledge` menandai `thread_continuation`, menambahkan petunjuk pesan mana yang baru dan meminta `updated_candidate` untuk knowledge tersebut. |
| `Run Curator LLM` | Menjalankan `kms_curator_llm`. |
| `Parse Curator Output` | Mengurai JSON kurator dan menambahkan sumber deterministik (folder, referensi saja, URL sumber). |
| `Build Candidate Update` | Mengubah label redaksi (lihat [redact_sensitive_data.md](redact_sensitive_data.md)) di hasil kurator menjadi teks tersamar biasa (`[KREDENSIAL: Vpn#****]` → `Vpn#****`), lalu menambahkan setiap label yang ada di evidence atau hasil kurator ke `sensitive_audit` dengan lokasi "Disamarkan otomatis sebelum diproses AI", sehingga banner GR7 tetap muncul walaupun model tidak pernah melihat nilainya. Bila nilai tersamar dari evidence tidak muncul di bagian yang dijadikan chunk (hanya di `raw_structured_evidence`), menambahkan satu fakta "Sumber memuat kredensial yang disamarkan otomatis: Merchant Key MK_S****, …" beserta sumbernya, supaya chatbot tetap bisa menemukannya (temuan s4, 19 Oktober 2026). Menyimpan `message_ids` thread ke `curated_payload` (dipakai writer untuk deteksi thread lanjutan). Pengaman: `updated_candidate` tanpa `existing_knowledge_id` dijadikan `candidate`; status tak dikenal → `failed` + `retryable`. Memetakan hasil ke kolom tabel. |
| `Stage Failed` | Error kurator/parsing → update `failed` (tidak di-retry, karena `kms_curator_llm` sudah retry sekali). |

## Rute dari `Collect Evidence`

| Rute | Kondisi | Hasil |
| :--- | :--- | :--- |
| `direct` | `inspect_email` menyatakan bukan pengetahuan | `skipped` |
| `direct` | `saved_knowledge` mengembalikan `exact_source` (ditegakkan dari hasil tool, bukan dari jawaban agen) | `already_exists` |
| `incomplete` | Agen berhenti tanpa `evidence_ready` | `failed` + `retryable` → `kms_ingest` mengulang agen |
| `curate` | Selain itu | Kurator dipanggil |

## Pemangkasan evidence

- `text` atau `rows` mentah dibuang bila extractor sudah memberi `structured_details`/`extracted_facts`; bila tidak, dipotong pada 6.000 karakter atau 40 baris tidak kosong.
- Tetangga lain dari `saved_knowledge` diringkas (ID, skor, judul, 1.200 karakter isi); payload lengkap hanya untuk kecocokan teratas.
- Isi lampiran dibuang dari `current_email` (sudah ada di hasil extractor).

## Sumber referensi saja

Sumber berikut dicantumkan di daftar sumber dengan `reference_only: true` tetapi tidak menjadi fakta:

- file folder Drive yang tidak dibaca (`listed_not_read`);
- sumber yang ditandai extractor `relevant_to_email: false` (`not_relevant`);
- folder Drive itu sendiri (`source_type: folder`).

`knowledge_writer_upsert` tidak memakai sumber ini sebagai kunci dedup.

## Catatan

- Versi pertama `Collect Evidence` tidak menyertakan email asli, sehingga kurator kehilangan nilai konkret dan password s3b tidak terdeteksi. Field `current_email` wajib dipertahankan.
- Hasil uji A/B model kurator ada di bagian 8 plan doc.
