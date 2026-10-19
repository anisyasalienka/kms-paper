# Notifikasi deploy sebagai pembaruan (FR1, v2.8), 19 Oktober 2026

## Intinya

Sebelumnya semua email "deploy selesai" langsung dibuang. Padahal untuk project yang PRD dan jadwal rilisnya sudah tersimpan, notifikasi itu adalah halaman terakhir ceritanya: kapan fitur benar-benar live dan versi berapa. Ibaratnya buku catatan project yang selalu berhenti di "rencana rilis tanggal 27" tanpa pernah ditulis "sudah rilis". Aturan baru: notifikasi deploy disimpan hanya sebagai tambahan pada catatan project yang sudah ada. Kalau tidak jelas milik project mana, tetap dibuang. Hasilnya, notifikasi yang dikirim sebagai balasan di thread jadwal rilis berhasil masuk dan chatbot bisa menjawab kapan fitur live. Notifikasi yang dikirim di thread baru awalnya terbuang (skor 0,62 dari ambang 0,65), karena pencariannya memakai teks template CI/CD. Setelah pencarian diarahkan ke nama fitur, skornya naik ke 0,73 dan notifikasi itu ikut masuk sebagai pembaruan.

## Dasar keputusan

- I4: "setiap stage dari email" (MOM, kickoff, handover, timeline rilis, hasil UAT), dan dokumen yang tidak diperbarui membuat orang harus "ngetes ulang lagi sistemnya" untuk tahu kondisi terakhir.
- Kutipan I2 yang dulu menjadi dasar pengecualian ternyata tentang undangan kalender deployment, bukan hasil deploy. Undangan kalender tetap dikecualikan.
- Disetujui pemilik paper pada 19 Oktober 2026. Teks FR1 disesuaikan di `Analisis Tematik & Requirement Workflow KMS.md`.

## Aturan

Notifikasi hasil deploy disimpan hanya sebagai **pembaruan** entri yang sudah ada, bila bisa dikaitkan lewat thread yang sama atau kemiripan ≥ 0,65 dengan entri yang dapat diakses pengirim. Selain itu `skipped`. Notifikasi deploy tidak pernah menjadi entri baru.

| Lapis | Tempat | Jenis |
| :--- | :--- | :--- |
| Tanda `deployment_notice` | `inspect_email` (`kms_evidence_agent`) | Prompt |
| Pencarian memakai nama fitur, bukan teks template | `Evidence Agent` (`kms_evidence_agent`) | Prompt |
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
| s6g | Notifikasi di thread baru, menyebut "Fitur Simpan Artikel" v4.19.0 | Pembaruan s6e | Putaran 1: **`skipped`**, kemiripan 0,62 < 0,65. Putaran 2 (setelah perbaikan query): pembaruan, kemiripan 0,73 | 21 / 77 |
| s6f | Balasan "deploy selesai 10.21 WIB, v4.19.0" di thread s6e | Pembaruan s6e | Pembaruan, di-approve, s6e lama `superseded` | 50 |

Fakta baru di draf s6f: "Deploy fitur Simpan Artikel ke production selesai pada tanggal 27 Maret 2026 pukul 10.21 WIB dengan versi detik-web v4.19.0 dan status SUCCESS." Isi lama (jadwal awal dan alasan mundur) tetap ada.

**Chatbot** ("Kapan fitur Simpan Artikel live di production dan versi berapa?"):

| Penanya | Hasil |
| :--- | :--- |
| STAFF-1A | 27 Maret 2026 pukul 10.21 WIB, detik-web v4.19.0, beserta riwayat jadwal yang dimundurkan |
| SPV-A | Sama |
| STAFF-3A (tidak berhak) | "tidak ditemukan" |

## Temuan s6g dan perbaikan query

Pada putaran 1, `inspect_email` menandai s6g sebagai notifikasi deploy dengan benar, tetapi `saved_knowledge` mengembalikan `no_match` dengan skor terbaik 0,62. Dua penyebab: query pencarian disalin dari teks notifikasi yang berupa daftar field template CI/CD ("Deployment notification, Service, Status, Started…"), dan orchestrator mengisi `project_name` dengan nama service ("detik-web"), bukan nama fitur.

Perbaikan: satu aturan di prompt `Evidence Agent`. Untuk notifikasi deploy, query dibangun dari fitur atau rilis yang dilaporkan, misalnya subjek "Rilis fitur Simpan Artikel ke production", dan `project_name` diisi nama fitur, bukan nama service. Ambang 0,65 tidak diubah.

| Email | Query (subjek) putaran 1 | Skor | Query (subjek) putaran 2 | Skor | Hasil putaran 2 |
| :--- | :--- | ---: | :--- | ---: | :--- |
| s6g | `[Deploy] Fitur Simpan Artikel (detik-web v4.19.0) ke production selesai` | 0,62 | `Rilis fitur Simpan Artikel ke production` | **0,73** | Pembaruan s6e (77 detik). Fakta: "Proses deployment service detik-web versi v4.19.0 (Fitur Simpan Artikel) ke environment production dimulai pada 27 Maret 2026 pukul 10:00 WIB dan selesai pada 10:21 WIB … status SUCCESS" |
| s6c | `[Deploy] detik-web v4.18.2 ke production selesai` | 0,44 | `Rilis v4.18.2 ke production` | 0,59 | Tetap `skipped` |

Draf s6g putaran 2 ditolak setelah diperiksa, karena fakta deploy yang sama sudah masuk lewat s6f. Hasil lengkap: `results_query_fix.json`.

Catatan: query yang dirapikan juga menaikkan skor notifikasi yang tidak terkait (s6c dari 0,44 ke 0,59). Jaraknya ke ambang tinggal 0,06, jadi notifikasi tanpa nama fitur tetap bergantung pada ambang dan pada pengaman kode yang mencegah notifikasi deploy menjadi entri baru.

## Dasar ambang 0,65

Ambang 0,65 dipasang 15 Oktober 2026 (iterasi 3) sebagai angka heuristik setelah kasus *false update*: email newsletter tim B dicocokkan dengan knowledge Ramadan tim A pada skor 0,43. Angka itu tidak dikalibrasi dengan data. Skor yang tercatat di data eksekusi n8n sejak itu (model embedding yang sama):

| Jenis pasangan | Contoh | Rentang skor |
| :--- | :--- | :--- |
| Email berbeda topik (tetangga terdekat yang bukan pasangannya) | s1, s2, s3b, s4, s6d, s6e, s7 saat belum ada pasangannya; s6c | 0,34–0,59 |
| Kasus *false update* yang memicu ambang | Newsletter tim B vs Ramadan tim A | 0,43 |
| Topik sama, bentuk berbeda (notifikasi deploy vs jadwal rilis) | s6g putaran 1 / putaran 2 | 0,62 / 0,73 |
| Topik sama, isi hampir sama (kirim ulang, thread lanjutan) | s3a, s4, s5, s6e | 0,77–0,89 |

Pada data uji ini, 0,65 berada di celah antara pasangan tak terkait tertinggi (0,59) dan pasangan sejenis terendah setelah perbaikan query (0,73). Celahnya sempit dan datanya sedikit (satu set email dummy), jadi angka ini lebih tepat disebut ambang yang ditetapkan secara heuristik lalu diperiksa terhadap data uji, bukan hasil kalibrasi.

## Menjalankan ulang

1. Pastikan s6e sudah di-approve (misalnya setelah `evaluate.py`).
2. `python3 run_deploy_test.py results.json`
