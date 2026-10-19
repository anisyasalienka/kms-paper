# Evaluasi end-to-end, 19 Oktober 2026

## Intinya

Setelah data uji direset (`kms_admin_reset`), seluruh skenario email dummy dijalankan dari awal sampai akhir: email masuk, dirangkum AI, disetujui owner, lalu ditanyakan ke chatbot oleh orang yang berhak dan yang tidak berhak. Semua status, aturan akses, deteksi duplikat, dan pembaruan versi berjalan sesuai harapan. Tidak ada nilai rahasia mentah yang sampai ke model, ke jawaban chatbot, maupun ke Qdrant. Satu temuan: chatbot menjawab "tidak ditemukan" untuk kredensial s4 padahal kredensial tersamarnya tersimpan (lihat Temuan).

Versi sistem: kms v2.7 (FR1 dengan pengecualian, redaksi `redact_sensitive_data`). Waktu: 00.19–00.38 WIB.

## Ringkasan hasil

| Aspek | Hasil |
| :--- | :--- |
| Status ingest s0–s7 sesuai ekspektasi | 13 dari 13 |
| Daftar akses (`access_users`) sesuai README dummy-emails | 7 dari 7 skenario yang diperiksa |
| Email sama dikirim ulang saat masih diproses | `already_pending` |
| Approve oleh owner | 10 dari 10 (HTTP 200) |
| s5b (thread s5 bertambah 3 balasan) | `pending_validation` sebagai pembaruan, s5 menjadi `superseded` setelah approve |
| s1 dikirim ulang setelah approved | `already_exists` |
| Chatbot: penanya tanpa akses mendapat "tidak ditemukan" | 11 dari 11 |
| Chatbot: penanya berhak mendapat jawaban yang benar | 11 dari 12 (lihat Temuan) |
| Nilai rahasia mentah di jawaban chatbot | 0 |
| Nilai rahasia mentah di Qdrant (`knowledge`, `knowledge_store`) | 0 dari 10 |
| Nilai rahasia mentah di data yang dikirim ke model | 0 dari 10 (17 eksekusi agen, 17 kurasi, 12 panggilan kurator, 2 reader) |

## Waktu proses per email

| Email | Status | Detik |
| :--- | :--- | ---: |
| s0 izin sakit | skipped | 13 |
| s1 keputusan tracking Ramadan | pending_validation | 54 |
| s2 SOP template UAT v2 | pending_validation | 34 |
| s3a reschedule rilis | pending_validation | 38 |
| s3b akses VPN (password) | pending_validation | 38 |
| s4 folder Drive QRIS | pending_validation | 88 |
| s5 thread panjang FCM | pending_validation | 152 |
| s6a laporan harian | skipped | 13 |
| s6b balasan IT support | skipped | 17 |
| s6c notifikasi deploy | skipped | 13 |
| s6d laporan mingguan berisi perbaikan | pending_validation | 33 |
| s6e reschedule rilis Simpan Artikel | pending_validation | 108 |
| s7 data pemenang dan kredensial | pending_validation | 46 |
| s5b lanjutan thread s5 | pending_validation (pembaruan) | 54 |

Waktu adalah satu putaran per email, bukan rata-rata. Variasi terbesar berasal dari model orchestrator.

## Uji akses chatbot

| Skenario | Pertanyaan | Dapat jawaban | Ditolak |
| :--- | :--- | :--- | :--- |
| s1 | Nama event tracking klik banner Ramadan | STAFF-1A, STAFF-2A, SPV-A | STAFF-3A, SPV-B |
| s2 | Aturan template laporan UAT v2 | STAFF-3A | STAFF-1B |
| s3a | Tanggal rilis Search Result Video | STAFF-3C | STAFF-1B |
| s3b | Host, port, dan password VPN staging | SPV-C (password tampil `Vpn#****`) | STAFF-2A, STAFF-3C |
| s4 | Client secret dan merchant key sandbox QRIS | STAFF-2A: lihat Temuan | STAFF-3A |
| s5b | Hasil go-live FCM dan temuan iOS | STAFF-2B, SPV-C | STAFF-3B |
| s6d | Penyebab event video_play AMP tidak terkirim | STAFF-3A | STAFF-1B |
| s6e | Tanggal rilis Simpan Artikel (27 Maret) | STAFF-1A | STAFF-3A |
| s7 | API key klaim hadiah dan NIK pemenang | STAFF-2B (tersamar) | STAFF-1B |

Jawaban lengkap tiap pertanyaan ada di `eval_results.json`.

## Temuan

**Kredensial s4 tersimpan tetapi tidak bisa ditemukan chatbot.** STAFF-2A mendapat jawaban yang benar soal base URL staging, header, dan port, tetapi chatbot menyatakan client secret dan merchant key "tidak ditemukan". Kedua nilai itu sebenarnya tersimpan tersamar (`Qris****`, `MK_S****`), tetapi kurator menaruhnya hanya di `raw_structured_evidence`. Bagian itu sengaja tidak dijadikan chunk pencarian oleh `knowledge_writer_upsert`, sehingga chatbot tidak pernah melihatnya. Pada uji sebelum redaksi (16 Oktober), kurator menaruh kredensial tersamar di `facts` dan chatbot menjawab `Qris#****`. Penempatan oleh kurator tidak deterministik, jadi belum bisa dipastikan apakah perubahan ini disebabkan label redaksi. Bukan kebocoran dan bukan kesalahan akses, tetapi jawaban "tidak ditemukan" menyesatkan. Kemungkinan perbaikan: prompt kurator mewajibkan satu fakta yang menyebut kredensial apa saja yang ada beserta bentuk tersamarnya.

**Catatan skrip.** Pada putaran ini skrip memeriksa penanda `is_update` s5b di antrean STAFF-2B, padahal owner thread s5 adalah STAFF-1B. Penanda dicek ulang secara manual (`is_update: true`) dan skrip sudah diperbaiki.

## Menjalankan ulang

1. Jalankan `kms_admin_reset` di n8n.
2. Pastikan frontend dev server berjalan di `localhost:5173` (proxy `/api`).
3. `python3 evaluate.py eval_results.json` (±20 menit).
4. Cek kebocoran: salin `database.sqlite`, `-wal`, dan `-shm` dari container n8n, lalu `python3 leakcheck.py <folder> <started_at dari eval_results.json>`.

Skrip memakai `curl` karena n8n di balik Cloudflare menolak klien HTTP bawaan Python.
