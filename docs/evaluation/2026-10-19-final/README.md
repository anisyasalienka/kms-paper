# Evaluasi end-to-end final (v2.9), 19 Oktober 2026

## Intinya

Putaran ini mengulang evaluasi pagi tadi pada versi sistem terakhir (v2.9), setelah data uji direset dengan `kms_admin_reset`. Cakupannya ditambah dua hal yang belum ada di putaran pagi: notifikasi deploy (v2.8, s6f dan s6g) dan email sumber yang kini disimpan untuk validator (v2.9). Hasilnya: semua status, aturan akses, dedup, pembaruan versi, dan uji chatbot sesuai harapan, termasuk kredensial s4 yang pagi tadi masih "tidak ditemukan". Tidak ada nilai rahasia mentah di jawaban chatbot, di Qdrant, di data yang dikirim ke model, maupun di Data Table n8n. Satu hasil tidak sesuai: s6g di-skip karena skor kemiripannya 0,6486, tepat di bawah ambang 0,65 (lihat Temuan).

Versi sistem: kms v2.9. Waktu: 19.59–20.24 WIB (`started_at`/`finished_at` di `eval_results.json`, UTC).

## Ringkasan hasil

| Aspek | Hasil |
| :--- | :--- |
| Status ingest s0–s7 sesuai ekspektasi | 13 dari 13 |
| Daftar akses (`access_users`) sesuai README dummy-emails | 7 dari 7 skenario yang diperiksa |
| Email sama dikirim ulang saat masih diproses | `already_pending` |
| Approve oleh owner | 11 dari 11 (HTTP 200) |
| s5b (thread s5 bertambah 3 balasan) | Pembaruan, s5 menjadi `superseded` setelah approve |
| s6f (balasan "deploy selesai" di thread s6e) | Pembaruan, s6e menjadi `superseded` setelah approve |
| s6g (notifikasi deploy di thread baru) | **`skipped`**, diharapkan pembaruan s6e (lihat Temuan) |
| s1 dikirim ulang setelah approved | `already_exists` |
| Chatbot: penanya tanpa akses mendapat "tidak ditemukan" | 12 dari 12 |
| Chatbot: penanya berhak mendapat jawaban yang benar | 14 dari 14 |
| Nilai rahasia mentah di jawaban chatbot | 0 |
| Nilai rahasia mentah di Qdrant (`knowledge`, `knowledge_store`) | 0 dari 10 |
| Nilai rahasia mentah di data yang dikirim ke model | 0 dari 10 (17 eksekusi agen, 17 kurasi, 11 panggilan kurator, 2 reader) |
| Nilai rahasia mentah di Data Table n8n (3 tabel, termasuk `source_email`) | 0 dari 10 |
| Email sumber tersimpan dan benar (v2.9) | 18 dari 18 kandidat |

## Email sumber (v2.9)

Setiap kandidat yang diproses menyimpan email versi tersamar di `source_email`. Pemeriksaan per kandidat: email tersimpan, jumlah pesan sama dengan input, isi lampiran tidak ikut, dan tidak ada nilai rahasia mentah.

| Pemeriksaan | Hasil |
| :--- | :--- |
| Kandidat yang diproses punya `source_email` | 17 dari 17 (termasuk `skipped` dan `already_exists`) |
| Kandidat `already_pending` | Tidak punya email, sesuai rancangan (tidak diproses) |
| Jumlah pesan sesuai input | 18 dari 18 (mis. s5 10 pesan, s5b 13, s6e 2, s6f 3) |
| Label redaksi tersimpan | s7: 7, s3b: 1 (password VPN) |
| Penanda "Baru" s5b terhadap s5 | `EMAIL-S5-M11`, `M12`, `M13` (tiga balasan tambahan) |

Tampilan dialog di frontend: `../2026-10-19/source-email/`.

## Waktu proses per email

| Email | Status | Detik |
| :--- | :--- | ---: |
| s0 izin sakit | skipped | 18 |
| s1 keputusan tracking Ramadan | pending_validation | 56 |
| s2 SOP template UAT v2 | pending_validation | 54 |
| s3a reschedule rilis | pending_validation | 53 |
| s3b akses VPN (password) | pending_validation | 48 |
| s4 folder Drive QRIS | pending_validation | 143 |
| s5 thread panjang FCM | pending_validation | 86 |
| s6a laporan harian | skipped | 13 |
| s6b balasan IT support | skipped | 17 |
| s6c notifikasi deploy tanpa nama fitur | skipped | 38 |
| s6d laporan mingguan berisi perbaikan | pending_validation | 50 |
| s6e reschedule rilis Simpan Artikel | pending_validation | 54 |
| s7 data pemenang dan kredensial | pending_validation | 54 |
| s5b lanjutan thread s5 | pending_validation (pembaruan) | 87 |
| s6g notifikasi deploy, thread baru | skipped | 25 |
| s6f balasan deploy di thread s6e | pending_validation (pembaruan) | 92 |

Satu putaran per email, bukan rata-rata.

## Uji akses chatbot

| Skenario | Pertanyaan | Dapat jawaban | Ditolak |
| :--- | :--- | :--- | :--- |
| s1 | Nama event tracking klik banner Ramadan | STAFF-1A, STAFF-2A, SPV-A | STAFF-3A, SPV-B |
| s2 | Aturan template laporan UAT v2 | STAFF-3A | STAFF-1B |
| s3a | Tanggal rilis Search Result Video | STAFF-3C | STAFF-1B |
| s3b | Host, port, dan password VPN staging | SPV-C (password tampil `Vpn#****`) | STAFF-2A, STAFF-3C |
| s4 | Client secret dan merchant key sandbox QRIS | STAFF-2A (`MK_S****`, `Qris****`) | STAFF-3A |
| s5b | Hasil go-live FCM dan temuan iOS | STAFF-2B, SPV-C | STAFF-3B |
| s6d | Penyebab event video_play AMP tidak terkirim | STAFF-3A | STAFF-1B |
| s6e | Tanggal rilis Simpan Artikel (27 Maret) | STAFF-1A | STAFF-3A |
| s6f | Kapan Simpan Artikel live dan versi berapa | STAFF-1A, SPV-A ("27 Maret 2026 pukul 10.21 WIB, detik-web v4.19.0") | STAFF-3A |
| s7 | API key klaim hadiah dan NIK pemenang | STAFF-2B (tersamar) | STAFF-1B |

Jawaban lengkap ada di `eval_results.json`.

## Temuan

**s6g di-skip karena skor tepat di bawah ambang.** Query pencarian sudah memakai nama fitur ("Rilis fitur Simpan Artikel ke production"), sesuai perbaikan v2.8. Skor terbaiknya 0,6486 terhadap knowledge s6e, sedangkan ambangnya 0,65. Pada uji v2.8 siang tadi, query yang sama mendapat 0,73. Bedanya ada di teks knowledge s6e yang disimpan: setelah reset, s6e dikurasi ulang oleh model dan rumusannya sedikit berbeda, sehingga skor kemiripan ikut bergeser. Ini bukan akibat perubahan v2.9, yang tidak menyentuh pencarian maupun kurasi. Temuan ini menegaskan batasan yang sudah tercatat: ambang 0,65 bersifat heuristik dan belum dikalibrasi. Skor email yang memang terkait kini teramati 0,65–0,89, dan email yang tidak terkait 0,34–0,59, jadi jarak antara keduanya sempit. Ambang tidak diubah. Notifikasi deploy yang dikirim sebagai balasan di thread yang sama (s6f) tidak terdampak, karena dikaitkan lewat thread, bukan lewat skor.

**Perbaikan s4 terkonfirmasi.** Pada putaran pagi, chatbot menjawab "tidak ditemukan" untuk kredensial s4. Setelah perbaikan nilai tersamar (v2.7.1), STAFF-2A mendapat `MK_S****` dan `Qris****` pada putaran pertama tanpa pengiriman ulang.

## Menjalankan ulang

1. Jalankan `kms_admin_reset` di n8n.
2. Pastikan frontend dev server berjalan di `localhost:5173` (proxy `/api`).
3. `python3 evaluate.py eval_results.json` (±25 menit).
4. Cek kebocoran: salin `database.sqlite`, `-wal`, dan `-shm` dari container n8n, lalu `python3 leakcheck.py <folder> <started_at dari eval_results.json>`. Output putaran ini: `leakcheck_output.txt`.

Dibanding skrip putaran pagi, `evaluate.py` menambah s6g (pembaruan, lalu ditolak karena faktanya masuk lewat s6f), s6f (pembaruan, di-approve), pertanyaan chatbot s6f, dan pemeriksaan `source_email`. `leakcheck.py` menambah pemindaian semua Data Table n8n.
