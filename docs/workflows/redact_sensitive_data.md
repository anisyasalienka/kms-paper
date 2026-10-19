# redact_sensitive_data (NFR4)

| | |
| :--- | :--- |
| **ID** | `KmsRedaction2026` |
| **Pemicu** | Sub-workflow (`When Called by Workflow`), input `value` (objek JSON apa pun) |
| **Dipanggil oleh** | Node `Redact Sensitive Data` di `kms_ingest` (sebelum `Run Evidence Agent`) dan di `gdocs_reader`, `gsheets_reader`, `gdrive_pdf_reader` (node terakhir) |
| **Output** | Objek yang sama dengan nilai sensitif diganti label, ditambah `redactions[]` (`category`, `type`, `location`, `masked_value`) |
| **Sumber kode** | [redact/redact.js](redact/redact.js), uji di [redact/redact.test.js](redact/redact.test.js) |
| **Requirement** | NFR4 (tidak ada data sensitif mentah yang keluar ke penyedia model), GR7 (data sensitif ditandai untuk validator) |

## Intinya

Semua model LLM di prototipe ini berjalan di cloud (lewat 9router). Sebelum 18 Oktober 2026, email dan dokumen dikirim apa adanya ke model, dan data sensitif baru disamarkan oleh kurator di akhir proses. Workflow ini menyamarkan data sensitif **dengan kode biasa, tanpa AI**, sebelum teks diserahkan ke model mana pun. Jadi model hanya pernah melihat versi tersamarnya.

## Apa yang disamarkan

Nilai yang ditemukan diganti label yang membawa bentuk tersamarnya sendiri. Nilai asli tidak disimpan di mana pun selain email atau dokumen sumbernya.

| Kategori | Label | Jenis dan cara deteksi | Contoh hasil |
| :--- | :--- | :--- | :--- |
| Kredensial | `KREDENSIAL` | Kata kunci + nilai: *password, pass, kata sandi, PIN, OTP, secret, client secret, API key, token, merchant/access/app/secret/private key* diikuti `:`, `=`, "adalah", atau "yaitu" | `password sementara: [KREDENSIAL: Vpn#****]` |
| | | Password di dalam URL (`skema://user:password@host`) | `postgres://app:[KREDENSIAL: Rw#****]@db…` |
| | | Format token yang dikenal: JWT, `sk-…`, `AKIA…`, `ghp_…`, `xox…-`, `AIza…`, `Bearer …`, blok private key | `[KREDENSIAL: ghp_****]` |
| | | String acak 10–64 karakter yang memuat simbol (`!@#$%^&*+=?~`) dan minimal tiga jenis karakter | `[KREDENSIAL: MK_S****]` |
| Data pribadi | `DATA_PRIBADI` | NIK 16 digit (kode provinsi, tanggal, dan bulan dicek) | `[DATA_PRIBADI: 3174************]` |
| | | Nomor HP Indonesia (`+62`, `62`, `08`), NPWP, nomor kartu (cek Luhn), nomor rekening (setelah kata *rekening/rek./a/c*) | `[DATA_PRIBADI: 0813****55]` |
| | | Alamat email pribadi (Gmail, Yahoo, Outlook, iCloud, Proton, dan sejenisnya) | `[DATA_PRIBADI: r***@gmail.com]` |

Yang **tidak** diubah: tautan (supaya agen tetap bisa membuka dokumen, kecuali password di dalam tautan), `source_id` seperti `gdoc:…`, field header email (`from`, `to`, `cc`, `message_id`, dst.), commit hash, UUID, nama event tracking, tanggal, dan angka rupiah.

## Alur label sampai ke validator

1. `redact_sensitive_data` mengganti nilai dengan label. `kms_ingest` membuang field `redactions` sebelum email diteruskan ke agen dan kurator. Reader mengembalikannya bersama isi dokumen.
2. Agen, extractor, dan kurator hanya melihat label. Prompt kurator, `document_extractor`, dan `spreadsheet_extractor` meminta label disalin apa adanya sebagai fakta dan tidak ditebak isinya.
3. `Build Candidate Update` di `kms_curate_stage` mengubah label menjadi teks tersamar biasa (`Vpn#****`) dan menambahkan setiap label ke `sensitive_audit` dengan lokasi "Disamarkan otomatis sebelum diproses AI". Banner data sensitif di layar validator tetap muncul. Bila nilai tersamar hanya tertinggal di `raw_structured_evidence` (tidak dijadikan chunk), kode yang sama menambahkan satu fakta yang menyebutnya, supaya chatbot tetap bisa menjawab bahwa nilainya ada.

**Efek samping yang perlu dijaga.** Model cenderung melewati nilai yang sudah disamarkan saat menulis fakta, karena menganggapnya bukan informasi. Pada uji terkontrol 19 Oktober 2026, extractor menulis kredensial s4 sebagai fakta 0 dari 5 kali saat nilainya tersamar, dan 5 dari 5 kali setelah prompt diberi aturan "Masked values". Rincian di `docs/evaluation/2026-10-19/masked-values/`.

## Batasan

- **Data komersial** (harga, nilai kontrak, revenue) tidak disamarkan sebelum masuk model, karena angka itu sering menjadi isi knowledge-nya. Kurator tetap menandai dan menyamarkannya sebelum disimpan (GR7).
- **Nama orang dan alamat rumah** tidak terdeteksi. Ini butuh model NER, dan dukungan bahasa Indonesia untuk itu masih lemah.
- **Rahasia yang ditulis bebas** (misalnya "passwordnya sama dengan tanggal lahir"), token alfanumerik acak tanpa kata kunci dan tanpa format yang dikenal, serta rahasia di gambar atau PDF hasil scan.
- Prompt dan instruksi sistem tetap dikirim ke model. Yang dilindungi adalah isi email dan dokumen.

## Mengubah aturan

Kode hanya ada di satu tempat, node `Redact Sensitive Data` di workflow ini. Perubahan langsung berlaku untuk email dan ketiga reader. Bila aturan diubah:

1. Ubah [redact/redact.js](redact/redact.js) lalu jalankan `node redact/redact.test.js` sampai `failures: 0`. Tambahkan kasus uji untuk setiap aturan baru, baik yang harus disamarkan maupun yang tidak boleh tersentuh.
2. Salin isi fungsi (tanpa baris `module.exports`) ke node `Redact Sensitive Data` di workflow ini, bagian atas sebelum baris `const findings`, lalu publish.
3. Jalankan ulang s3b, s4, dan s7, lalu lakukan cek kebocoran (lihat "Bukti uji").

## Riwayat

Versi pertama (18 Oktober 2026) menempelkan kode yang sama di empat node Code terpisah. Pada 19 Oktober 2026 kode dipindah ke workflow ini supaya perubahan aturan tidak bisa tertinggal di salah satu jalur. Keempat node lama diganti node Execute Workflow dengan nama yang sama.

## Bukti uji

Uji 18 Oktober 2026.

**Uji unit** (`redact.test.js`): 22 kasus yang harus disamarkan dan 14 kasus yang tidak boleh tersentuh (tautan Google Doc, `gdoc:` ID, commit hash, UUID, `{{content.id}}`, angka rupiah, `Pass: 12`, nomor tiket, metrik traffic, alamat email kantor). Semua lulus. Fungsi juga dijalankan ke seluruh email dummy: hanya s3b dan s7 yang kena, sesuai harapan.

**Uji pipeline**: email s0–s7 (dengan ID baru supaya tidak bentrok dengan data lama) dikirim ke `/api/ingest-email`. Status semua skenario sama seperti sebelum redaksi dipasang. s3a dan s5 menjadi `already_exists` karena isinya sama dengan knowledge yang sudah di-approve.

**Cek kebocoran**: 10 nilai mentah (password s3b; client secret dan merchant key di Google Doc s4; NIK, nomor HP, email pribadi, rekening, API key, password database, dan Bearer token di s7) dicari di data eksekusi n8n semua workflow yang mengirim data ke model (`kms_evidence_agent`, `kms_curate_stage`, `kms_curator_llm`) dan di hasil akhir reader. Data eksekusi n8n mencatat input setiap node model, sedangkan log 9router hanya mencatat metadata.

| Putaran | Hasil |
| :--- | :--- |
| Pertama | 1 dari 10 bocor: `Merchant Key: MK_STG_…` di Google Doc s4. Kata "key" belum ada di daftar kata kunci, dan nilainya tanpa simbol sehingga lapis string acak juga tidak menangkapnya. |
| Kedua, setelah kata kunci `merchant/access/app/…/private key` ditambahkan | **0 dari 10 bocor.** Kedua kredensial s4 dan ketujuh nilai s7 tercatat di `sensitive_audit` dan tampil tersamar di draf (`Vpn#****`, `MK_S****`, `3174************`, `rwd_****`). |
| Ketiga (19 Okt), setelah kode dipindah ke workflow ini; s3b, s4, s7, s0, s1 | **0 dari 10 bocor.** `redact_sensitive_data` berjalan 7 kali (5 email, 2 dokumen), semua sukses. Status kelima skenario sama, `sensitive_audit` lengkap, tidak ada label yang tertinggal di draf. |

Temuan putaran pertama menunjukkan batasan pendekatan berbasis aturan: nilai rahasia yang tidak punya kata kunci yang dikenal dan tidak punya bentuk khas akan lolos.
