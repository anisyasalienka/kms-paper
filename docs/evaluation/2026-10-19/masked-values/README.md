# Nilai tersamar tidak terjangkau chatbot (s4), 19 Oktober 2026

## Intinya

Setelah redaksi dipasang, chatbot menjawab "tidak ditemukan" saat ditanya client secret dan merchant key sandbox QRIS (s4), padahal keduanya ada di Google Doc. Ibaratnya seperti juru catat yang menerima formulir berisi kotak hitam: ia melewati baris itu karena merasa tidak ada yang bisa dicatat. Model AI memperlakukan nilai yang sudah disamarkan sebagai "bukan informasi" lalu tidak menuliskannya sebagai fakta. Ini terjadi dua kali di jalur dokumen: di extractor dokumen, lalu di kurator. Perbaikannya satu aturan di prompt extractor dan satu pengaman di kode akhir kurasi. Setelah itu chatbot menjawab `MK_S****` dan `Qris****` kepada orang yang berhak, dan tetap menolak orang yang tidak berhak.

## Jejak masalah

Kredensial di body email (s3b, s7) selalu masuk ke `facts`. Kredensial di Google Doc (s4) tidak.

| Email | Asal kredensial | Label diterima kurator | Masuk `facts` |
| :--- | :--- | ---: | ---: |
| s3b | body email | 1 | 1 |
| s7 | body email | 7 | 7 |
| s4 | Google Doc, lewat `document_extractor` | 2 | 0 |

Pada s4, extractor menulis "Port tunneling internal 8443" sebagai fakta tetapi melewati Merchant Key dan Client Secret di bagian dokumen yang sama. Kurator lalu menaruh kedua nilai itu hanya di `raw_structured_evidence`, bagian yang sengaja tidak dijadikan chunk pencarian oleh `knowledge_writer_upsert`.

## Uji terkontrol extractor

Percakapan yang sama persis dengan run evaluasi s4 (prompt sistem, instruksi agen, isi Google Doc dari `gdocs_reader`) dikirim langsung ke model `document_extractor` (`ag/gemini-3.8-flash`) lewat 9router. Hanya bentuk kedua kredensial yang diubah. Lima kali per versi.

| Versi | Merchant key di `extracted_facts` | Client secret di `extracted_facts` |
| :--- | ---: | ---: |
| Nilai mentah | 5/5 | 5/5 |
| Berlabel `[KREDENSIAL: MK_S****]` (kondisi saat itu) | 0/5 | 0/5 |
| Tersamar tanpa label `MK_S****` | 0/5 | 0/5 |
| Berlabel + aturan "Masked values" di prompt | 5/5 | 5/5 |

- Penyebabnya penyamaran itu sendiri, bukan format label: versi tanpa label juga dibuang.
- Dengan aturan baru, fakta berbunyi "Dokumen memuat kredensial sandbox staging berupa Merchant Key [KREDENSIAL: MK_S****] dan Client Secret Sandbox [KREDENSIAL: Qris****]". Label tersalin utuh 5/5, dan dari 15 run versi tersamar tidak ada yang menebak nilai aslinya.
- Tanpa redaksi, nilai mentah masuk ke fakta 5/5. Menyerahkan penyamaran kepada model (GR7 saja) tidak cukup.

## Lapisan kedua: kurator

Setelah aturan dipasang di extractor, s4 dikirim ulang (thread yang sama ditambah satu balasan, supaya diproses sebagai pembaruan). Extractor sekarang menulis fakta kredensial berlabel, tetapi kurator pada run itu tetap tidak menyalinnya ke `facts`. Uji terkontrol untuk kurator tidak dijalankan karena kunci sementara 9router sudah dihapus. Perbaikannya dibuat di kode, jadi tidak bergantung pada perilaku model: `Build Candidate Update` memeriksa setiap label di evidence, dan bila nilai tersamarnya tidak muncul di bagian yang dijadikan chunk, menambahkan satu fakta, misalnya "Sumber memuat kredensial yang disamarkan otomatis: Merchant Key MK_S****, Client Secret Sandbox Qris****."

Uji lokal kode itu pada data empat run asli: kedua run s4 mendapat fakta tambahan, s3b dan s7 tidak berubah karena labelnya sudah ada di `facts`.

## Hasil setelah perbaikan

| Langkah | Hasil |
| :--- | :--- |
| Ingest s4 (thread + 1 balasan) | `pending_validation`, pembaruan atas s4, 80 detik |
| Fakta kredensial di draf | "Dokumen memuat kredensial sandbox staging berupa Merchant Key MK_S****, Client Secret Sandbox Qris****, serta port tunneling internal 8443." (ditulis kurator sendiri; pengaman kode tidak perlu turun tangan) |
| Approve oleh STAFF-1A | `approved`, 6 chunk, s4 lama `superseded` |
| Chatbot, STAFF-2A (berhak) | Menjawab Merchant Key `MK_S****` dan Client Secret `Qris****`, dengan sumber Google Doc |
| Chatbot, STAFF-3A (tidak berhak) | "tidak ditemukan" |
| Nilai mentah di jawaban | 0 |

## Berkas

| Berkas | Isi |
| :--- | :--- |
| `extractor_experiment.py` | Skrip uji terkontrol. Membaca kunci 9router dari `~/.9router-key`; kunci tidak disimpan di repo |
| `extractor_input_s4.json` | Percakapan extractor dari run evaluasi s4 (sudah berlabel) |
| `extractor_results.json` | Output 20 run. Versi "raw" memuat nilai dummy mentah s4, sama seperti `leakcheck.py` |
| `s4_rerun_results.json` | Draf, approve, dan jawaban chatbot setelah perbaikan |
