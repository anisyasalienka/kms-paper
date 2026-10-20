# Uji sumber Google Slides (s8a, s8b), 20 Oktober 2026

## Intinya

Hasil sprint review dan rencana rilis sering dibagikan sebagai deck, bukan dokumen. Sejak v2.10 sistem bisa membaca tautan Google Slides di email: setiap slide, poin bertingkat, tabel, dan catatan pembicara. Ibaratnya seperti notulis yang tidak hanya membaca slide di layar, tetapi juga catatan kecil presenter di bawahnya. Uji ini memakai satu deck buatan Gemini dan dua email. Hasilnya: fakta dari slide dan catatan pembicara masuk ke knowledge, balasan di thread memperbarui knowledge itu, dan password di catatan pembicara tidak pernah sampai ke model. Yang terakhir baru tercapai setelah satu perbaikan aturan redaksi.

## Bahan uji

- Deck: <https://docs.google.com/presentation/d/1YT8B16z0mPS5D9OANji_b6NaoNEO77PD36qf7R6pXYg/edit> (7 slide, "Rencana Go-Live Rekomendasi Artikel Personal v2"), dibuat dengan Gemini lalu dilengkapi manual: catatan pembicara slide 3 (aturan rollback) dan slide 6 (password staging), slide 7 disembunyikan.
- Ciri deck buatan Gemini yang ikut teruji: judul slide berupa kotak teks biasa (bukan placeholder judul), dan jadwal berupa kotak-kotak teks, bukan tabel Slides.
- Email: `dummy-emails/s8a-google-slides.json` (STAFF-1C ke STAFF-2C, STAFF-3C, cc SPV-C; body sengaja singkat) dan `s8b-google-slides-reply.json` (thread yang sama ditambah balasan SPV-C: UAT mundur ke 29–31 Oktober, ambang fallback 300 ms menjadi 250 ms).

## Hasil

| Langkah | Ekspektasi | Hasil |
| :--- | :--- | :--- |
| `gslides_reader` langsung | 7 slide, catatan pembicara, slide tersembunyi ditandai | Sesuai. Judul slide awalnya kosong (lihat Temuan 2) |
| Ingest s8a | `pending_validation`, fakta dari slide, password tersamar | `pending_validation` dalam 100 detik. 11 fakta bersumber `gslide:<id>`, termasuk aturan rollback dari catatan pembicara dan keempat baris jadwal beserta PIC. Password hanya muncul sebagai `Reko****` dan tercatat di `sensitive_audit`. Akses: STAFF-1C, STAFF-2C, STAFF-3C, SPV-C |
| Approve s8a (STAFF-1C) | `approved` | `approved`, 4 chunk |
| Ingest s8b | `updated_candidate` atas s8a | `updated_candidate` dalam 113 detik, `existing_knowledge_id` = knowledge s8a. UAT 29–31 Okt dan ambang 250 ms diperbarui; keduanya dicatat sebagai konflik dengan deck; fakta slide (A/B test, rollback, cold start) tetap ada |
| Approve s8b | Menggantikan s8a | `approved`, 5 chunk, s8a `superseded` |
| Chatbot "Kapan UAT … dan apa aturan rollback-nya?" | STAFF-3C dan SPV-C dijawab, STAFF-1A ditolak | 3/3 sesuai. Jawaban memakai UAT 29–31 Oktober dan aturan rollback 3,0% selama 2 jam |
| Cek kebocoran (`leakcheck.py`) | 0 nilai mentah | 0 dari 11 nilai (termasuk `Reko#Stg2026`) di data eksekusi `kms_evidence_agent`, `kms_curate_stage`, `kms_curator_llm`, hasil `gslides_reader`, dan semua Data Table. Output: `leakcheck_output.txt` |

## Temuan

1. **Password di catatan pembicara lolos redaksi pada uji pertama.** Teksnya `password Reko#Stg2026!`, tanpa titik dua. Aturan kata kunci butuh `:`, `=`, "adalah", atau "yaitu", dan lapis string acak menolak nilai yang diakhiri simbol. Ini bukan masalah khusus Slides; email dengan tulisan yang sama juga akan lolos. Perbaikan: aturan kata kunci + spasi di `redact_sensitive_data` yang hanya menyamarkan nilai berbentuk rahasia (huruf dan angka, ditambah simbol atau huruf besar-kecil), sehingga "password reset sudah selesai" tidak tersentuh. Uji unit 42/42; semua email dummy lama memberi hasil redaksi yang sama. Ditemukan sebelum ingest pipeline, jadi password mentah tidak pernah terkirim ke model.
2. **Judul slide tidak terbaca.** Gemini menaruh judul di kotak teks biasa, bukan placeholder judul. `gslides_reader` kini memakai kotak teks pertama sebagai judul bila isinya satu baris pendek. Setelah itu ketujuh judul terbaca.
3. **Slide tersembunyi ikut dibaca.** Slide 7 ("Draft Lama: Varian C", disembunyikan) menjadi fakta "Varian C dibatalkan". Isinya benar dan relevan, jadi dibiarkan; reader menandainya "(disembunyikan)" sehingga model tahu statusnya.
4. **Jadwal berupa kotak teks, bukan tabel.** Setiap sel menjadi satu baris, tetapi urutannya tetap sehingga extractor menyusun ulang jadwal dengan benar. Tabel Slides asli ditulis sebagai baris `| … |` (diuji dengan data tiruan).

## Menjalankan ulang

1. `python3 run_s8.py ingest-a`, lalu `approve-a`, `ingest-b`, `approve-b`, `chat`. Hasil ditambahkan ke `results.json`.
2. Cek kebocoran: salin `database.sqlite`, `-wal`, dan `-shm` dari container n8n, lalu `python3 leakcheck.py <folder> 2026-10-20T04:52:00` (ganti dengan waktu mulai putaran).

Setelah `kms_admin_reset`, s8a dan s8b dapat dikirim ulang tanpa mengubah ID.
