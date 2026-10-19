# Notifikasi deploy sebagai pembaruan (FR1, v2.8), 19 Oktober 2026

## Intinya

Sebelumnya semua email "deploy selesai" langsung dibuang. Padahal untuk project yang PRD dan jadwal rilisnya sudah tersimpan, notifikasi itu adalah halaman terakhir ceritanya: kapan fitur benar-benar live dan versi berapa. Ibaratnya buku catatan project yang selalu berhenti di "rencana rilis tanggal 27" tanpa pernah ditulis "sudah rilis". Aturan baru: notifikasi deploy disimpan hanya sebagai tambahan pada catatan project yang sudah ada. Kalau tidak jelas milik project mana, tetap dibuang. Hasilnya, notifikasi yang dikirim sebagai balasan di thread jadwal rilis berhasil masuk dan chatbot bisa menjawab kapan fitur live. Notifikasi yang dikirim di thread baru masih terbuang karena sistem kurang yakin (skor 0,62 dari ambang 0,65).

## Dasar keputusan

- I4: "setiap stage dari email" (MOM, kickoff, handover, timeline rilis, hasil UAT), dan dokumen yang tidak diperbarui membuat orang harus "ngetes ulang lagi sistemnya" untuk tahu kondisi terakhir.
- Kutipan I2 yang dulu menjadi dasar pengecualian ternyata tentang undangan kalender deployment, bukan hasil deploy. Undangan kalender tetap dikecualikan.
- Disetujui pemilik paper pada 19 Oktober 2026. Teks FR1 disesuaikan di `Analisis Tematik & Requirement Workflow KMS.md`.

## Aturan

Notifikasi hasil deploy disimpan hanya sebagai **pembaruan** entri yang sudah ada, bila bisa dikaitkan lewat thread yang sama atau kemiripan ≥ 0,65 dengan entri yang dapat diakses pengirim. Selain itu `skipped`. Notifikasi deploy tidak pernah menjadi entri baru.

| Lapis | Tempat | Jenis |
| :--- | :--- | :--- |
| Tanda `deployment_notice` | `inspect_email` (`kms_evidence_agent`) | Prompt |
| Skip bila tidak terkait | `Collect Evidence` (`kms_curate_stage`) | Kode |
| Hanya `updated_candidate`, tambahkan hasil deploy | `Curator Prompt` | Prompt |
| Kandidat baru dari notifikasi deploy → `skipped` | `Build Candidate Update` | Kode |

## Hasil

Dijalankan pada data hasil evaluasi end-to-end hari yang sama (s6e sudah di-approve).

| Email | Isi | Diharapkan | Hasil | Detik |
| :--- | :--- | :--- | :--- | ---: |
| s0 | Izin sakit | `skipped` | `skipped` | 17 |
| s6a | Laporan harian | `skipped` | `skipped` | 13 |
| s6b | Balasan IT support | `skipped` | `skipped` | 17 |
| s6c | Notifikasi `detik-web v4.18.2`, tanpa nama fitur | `skipped` | `skipped`, alasan "tidak dapat dikaitkan" | 25 |
| s6g | Notifikasi di thread baru, menyebut "Fitur Simpan Artikel" v4.19.0 | Pembaruan s6e | **`skipped`**: kemiripan 0,62 < 0,65 | 21 |
| s6f | Balasan "deploy selesai 10.21 WIB, v4.19.0" di thread s6e | Pembaruan s6e | Pembaruan, di-approve, s6e lama `superseded` | 50 |

Fakta baru di draf s6f: "Deploy fitur Simpan Artikel ke production selesai pada tanggal 27 Maret 2026 pukul 10.21 WIB dengan versi detik-web v4.19.0 dan status SUCCESS." Isi lama (jadwal awal dan alasan mundur) tetap ada.

**Chatbot** ("Kapan fitur Simpan Artikel live di production dan versi berapa?"):

| Penanya | Hasil |
| :--- | :--- |
| STAFF-1A | 27 Maret 2026 pukul 10.21 WIB, detik-web v4.19.0, beserta riwayat jadwal yang dimundurkan |
| SPV-A | Sama |
| STAFF-3A (tidak berhak) | "tidak ditemukan" |

## Temuan s6g

`inspect_email` menandai s6g sebagai notifikasi deploy dengan benar, tetapi `saved_knowledge` mengembalikan `no_match` dengan skor terbaik 0,62. Dua penyebab: teks notifikasi otomatis pendek dan berupa daftar field, dan orchestrator mengisi `project_name` dengan nama service ("detik-web"), bukan nama fitur. Ambang 0,65 dipasang setelah kasus *false update* (iterasi 3, skor 0,43), jadi sistem memilih melewatkan pembaruan daripada menimpa entri yang salah. Ini dicatat sebagai batasan; ambang tidak diubah.

## Menjalankan ulang

1. Pastikan s6e sudah di-approve (misalnya setelah `evaluate.py`).
2. `python3 run_deploy_test.py results.json`
