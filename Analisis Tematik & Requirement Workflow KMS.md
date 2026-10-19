# Analisis Tematik & Requirement Workflow KMS

Oct 15, 2026 · @Anisya Mahira

## Ringkasan

Empat transkrip menghasilkan enam tema, yang diturunkan menjadi 19 requirement workflow (8 fungsional, 7 governance, 4 non-fungsional). Sebagian besar temuan mendukung desain di draft: identifikasi, ekstraksi lampiran, konsolidasi, provenance, dan validasi manusia.

Tiga temuan menuntut revisi desain:

- **Validasi** tidak cukup oleh pengirim saja. Informan menyebut pemilik/PIC/PM, dan I3 menambahkan peran lead untuk memantau yang terlewat.
- **Akses berbasis penerima** terlalu luas ketika email dikirim ke milis, dan terlalu sempit ketika PIC berganti. Dua kondisi ini justru kasus utama yang diceritakan informan.
- **Sumber pengetahuan** sering berupa tautan Google Drive, bukan file lampiran. Ekstraksi perlu membaca tautan Drive.

Cara pakai: Bagian Tema menjadi bahan Results untuk RQ1. Tabel Requirement bisa langsung masuk paper (pernyataan sudah dalam bahasa Inggris). Bagian Selisih berisi daftar perubahan untuk Section III-B dan III-C.

## Metode analisis

Analisis memakai thematic analysis Braun & Clarke \[27\] dengan pendekatan hibrida. Kerangka awal deduktif mengikuti panduan wawancara (proses KM \[6\] dan concern governance Section II-B); kode dibangun induktif dari data.

| Fase | Yang dilakukan |
| --- | --- |
| 1. Familiarisasi | Membaca ulang keempat transkrip, mencatat ide awal per informan |
| 2. Kode awal | Memberi kode pada setiap segmen yang relevan, tiap kode terhubung ke kutipan |
| 3. Mencari tema | Mengelompokkan kode yang searah menjadi kandidat tema |
| 4. Meninjau tema | Mengecek tiap tema terhadap kutipannya dan terhadap seluruh data, termasuk bukti yang bertentangan |
| 5. Mendefinisikan tema | Menulis definisi singkat dan nama tema (ID dan EN) |
| 6. Melaporkan | Tema dan kutipan di bawah, lalu diturunkan menjadi requirement |

Kode informan mengikuti Table III di draft. Nama hanya untuk catatan kerja ini; hapus sebelum dokumen dibagikan.

| Kode | Informan | Peran (transkrip) | Masa kerja (transkrip) | Table III |
| --- | --- | --- | --- | --- |
| I1 | Mas Aan | Supervisor data (analis + pipeline) | ±5 tahun di perusahaan; ±6 bulan di posisi ini | Supervisor, 5 tahun |
| I2 | Mbak Fanda | Data analyst (sejak Jul 2026), sebelumnya data tracker | Sejak 2022, ±4 tahun | Employee, 4 tahun |
| I3 | Dila | Research Operations, tim Data & Riset | ±2 tahun kontrak + 1 tahun magang | Employee, ±2 tahun |
| I4 | Mbak Ika | Product Manager, Platform Commerce (Adsmart) | Sejak 2017; pegang Adsmart sejak pertengahan 2025 | Product manager, 3 tahun |

Masa kerja I4 di Table III (3 tahun) tidak cocok dengan transkrip. Perlu diputuskan apakah tabel melaporkan masa kerja di perusahaan atau di peran.

## Tema dan kode

Enam tema muncul; T1–T4 menjawab "masalah KM" di RQ1, T5–T6 menjawab syarat governance. Kutipan ditulis apa adanya; terjemahkan ke bahasa Inggris saat masuk paper.

### T1. Email sebagai jejak formal, bukan tempat pengetahuan disimpan

*Email as a formal trail rather than a knowledge store*

Email mencatat bahwa sesuatu sudah disepakati atau dikerjakan, tetapi substansinya ada di lampiran dan Drive, dan diskusinya di chat atau meet.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Email = bukti kerja formal | I1, I3, I4 | I1: "email tuh kayak: lu kerja ada buktinya di email" · I4: "di email kayak formalnya, chat informalnya" |
| Diskusi pindah ke chat/meet | I1, I2 | I1: "ujungnya pembahasan selanjutnya tuh dari chat" · I2: PM "sudah japri kita duluan" sebelum email formal |
| Substansi di lampiran/Drive | I1, I2, I4 | I1: "Penting itu sebenarnya lampiran" · I1: "Gmail itu sebagai perantara, penyimpanannya itu di Google Drive" |
| Siklus proyek tercatat di email | I4 | MOM, kickoff, handover (PRD + UAT + tactics dibundel), timeline rilis, hasil UAT: "Setiap stage dari email" |
| Tidak ada repositori lintas departemen | I1, I2, I3 | I3: repositori riset masih Google Sheets, tim lain punya sendiri · I2: keputusan deploy tidak didokumentasikan di tempat lain |

### T2. Email rutin menenggelamkan email yang bernilai

*Routine email buries knowledge-bearing email*

Sebagian besar email yang masuk bukan pengetahuan, dan volumenya membuat email penting cepat tertimbun.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Laporan harian/mingguan/bulanan | I1, I2, I3 | I2: "yang paling banyak itu daily report" · I3: email "kebendem dan kalah sama yang daily report" |
| Notifikasi deploy, undangan kalender, balasan IT support | I1, I2 | I2: undangan kalender deployment, balasan IT support tidak perlu disimpan |
| Info HR dan izin pribadi | I1, I4 | I4: yang tidak perlu "yang pribadi kayak sakit" |
| CC milis ke orang yang tidak terlibat | I4 | I4: "yang kita gak terlibat pun kita dapat email-nya karena CC milis" |
| Pengecualian: laporan isu dan jadwal tetap jadi patokan | I4 | I4: "'Eh, itu waktu itu kapan ya?' Karena itu jadi patokan" |

### T3. Penelusuran mahal dan bergantung pada orang

*Costly retrieval and reliance on individuals*

Pengetahuan biasanya akhirnya ketemu, tetapi lewat kata kunci, ingatan, atau bertanya ke orang. Biaya terbesar muncul saat orang berganti atau keluar.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Cari pakai kata kunci, pengirim, tanggal | I1, I3, I4 | I3: cari "meet recording", nama peserta, cek Google Calendar · I1: Drive "Shared with me", "Kadang-kadang kan lupa namanya" |
| Lambat, bukan gagal | I3 | I3: "bukan lebih ke enggak ketemu sih, tapi agak lama nyarinya" · "jeda berapa minggu aja" sudah sulit |
| Bertanya langsung ke orang | I1, I2, I3 | I2: hubungi PM, "paling tertunda sehari" · I3: via WhatsApp atau "nyamperin langsung" |
| Jadi rujukan orang lain | I2 | I2 sering ditanya soal tracker karena orang lain "kehilangan jejak dokumentasinya" |
| Workaround pribadi | I2, I4 | I2: judul tugas disamakan dengan subject email · I4: email password/akses "aku bintang-bintangin" |
| Pengetahuan hanya di orang lama | I2 | I2: CMS dan tracker, "harus menanyakan ke orang lama" |
| Pergantian dan keluarnya orang | I1, I4 | I1: "Kecuali kalau orangnya udah keluar, itu kesusahan" · I4: handover tidak lengkap, "langsung blank" |
| Tidak termasuk penerima | I3, I4 | I3: belum masuk milis PM Data, harus minta di-forward · I4: dokumen lama tidak bisa diakses |
| Harapan: kategori rapi, mudah, relevan | I1, I2, I3, I4 | I2: "user journey-nya simpel" dan "struktur kategorisasi yang rapi" · I4: "otomatis grouping" |

### T4. Pengetahuan terfragmentasi dan cepat usang

*Fragmented and outdated knowledge*

Satu topik tersebar di banyak thread dan PIC, dan perubahan sering hanya tercatat di balasan email, bukan di dokumen utama.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Satu topik, banyak thread dan PIC | I2, I4 | I2: Ramadan tersebar di Food Ramadan, Health Ramadan, dan microsite, "PIC-nya beda-beda" · I4: front end dan back end dipisah |
| Isu berulang jadi email baru | I4 | I4: tiap isu email baru, saat dicari "ini yang mana dan kapan?" |
| Perubahan hanya di reply | I2 | I2: reschedule "cuma di-update di body email saja", PRD tidak diperbarui |
| Dokumen ada tapi tidak diperbarui | I4 | I4: harus "ngetes ulang lagi sistemnya" untuk tahu kondisi terakhir |
| Versi dan masa berlaku | I1 | I1: "ada kedaluwarsanya"; versi lama jadi pembanding, yang dipakai terbaru |
| Verifikasi silang manual | I2, I3 | I3: cek email untuk memastikan dokumen di repositori "dokumen yang sama atau dokumen yang baru" · I2: cek situs, inspect element |
| Bukti bertentangan: konflik antar-thread jarang | I2, I3 | Keduanya belum pernah; I3: koreksi terjadi "di threads email yang sama" |

Implikasi: konsolidasi lebih perlu menangani pembaruan versi daripada mendeteksi konflik.

### T5. Batas akses dan sensitivitas

*Access boundaries and sensitivity*

Penerima email dianggap batas yang wajar, tetapi milis membuat batas itu terlalu luas dan pergantian orang membuatnya terlalu sempit.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Penerima (To/CC) = yang berhak | I1, I3, I4 | I1: "kalau misalnya dia di-CC, berarti orang itu harus mengetahui" · I4: "minimal di level CC-an itu" |
| Milis memperluas akses | I2, I3 | I3: nominal tools dan klien sampai ke anak magang; riset memakai milis PM Data karena belum punya milis sendiri · I2: daily report data harusnya hanya ke tim relevan |
| Pergantian orang memutus akses | I4 | I4: yang sulit "menemukan dokumen yang memang aksesnya gak ada" |
| Kredensial | I1, I4 | I1: password email dan VPN · I4: "Itu sebenarnya credential juga" |
| Data pribadi | I3 | I3: data pemenang reward berisi nomor telepon, alamat, KTP |
| Data komersial | I3, I4 | I4: revenue dan data kontak customer, dikirim langsung, "gak boleh milis" |
| Lingkup berlapis | I1, I3 | I1: personal, one-on-one, grup, divisi, direktorat · I3: data pribadi tetap per tim, dokumen umum boleh lintas tim |
| Kebocoran eksternal | I2 | I2: "lebih ke keamanan dari pihak eksternal" |

### T6. Pemilik memvalidasi, asalkan ringan

*Owners should validate, provided it is effortless*

Informan sepakat pemilik pengetahuan yang memastikan kebenarannya, dan mau meninjau selama tidak ada input manual.

| Kode | Informan | Kutipan pendukung |
| --- | --- | --- |
| Pemilik/PM/PIC yang memastikan | I1, I2, I3 | I1: "Yang punya, pasti pemilik" · I2: "Harusnya PM" |
| Lead memantau kelengkapan | I3 | I3: PIC "bisa aja lupa", sedangkan cek listing "pasti dari lead" |
| Provenance untuk tindak lanjut | I3, I4 | I3: yang butuh "bisa langsung nge-follow up ke PIC-nya" · I4: email klien yang diteruskan perlu pesan awalnya |
| Provenance untuk akuntabilitas | I1, I2 | I2: "supaya kalau ada kesalahan tidak saling lempar tanggung jawab" |
| Capture otomatis | I2, I3, I4 | I4: "Gak masukin satu-satu sendiri, langsung otomatis" |
| Review satu klik | I2, I3, I4 | I2: pop-up ringkasan, "pilih accept, decline, atau edit" · I3: cukup checklist |
| Review bisa sama melelahkannya | I1 | I1: "review lagi, edit lagi, itu kayaknya bakalan sama aja capeknya"; lebih baik template/SOP sejak awal |

## Requirement workflow

Sembilan belas requirement diturunkan dari tema, digabung dengan requirement literatur (validasi, provenance, perlindungan informasi sensitif) sesuai Section III-A. Dua di antaranya baru dan belum ada di desain draft: GR2 dan GR6.

### Fungsional

| ID | Requirement (siap masuk paper) | Dasar | Tahap |
| --- | --- | --- | --- |
| FR1 | The workflow shall classify each email and attachment as knowledge or non-knowledge, excluding routine reports, calendar invitations, IT-support replies, HR announcements, and personal leave notices. A deployment notice shall be kept only as an update to the existing entry it can be linked to, and excluded otherwise. | T2 · I1–I4 · \[6\] | Identification |
| FR2 | The workflow shall treat project artefacts and decisions as knowledge, including meeting minutes, PRDs, UAT documents, tracking plans, handovers, schedule changes, and issue resolutions. | T1, T2 · I1, I2, I4 | Identification |
| FR3 | The workflow shall extract knowledge from the email body, attached files, and linked Google Drive documents, selecting the extraction tool by file or link type. | T1 · I1, I2, I4 | Extraction |
| FR4 | Each entry shall carry structured metadata: project, product or channel, knowledge type, owner (PIC), division, and effective date. | T3, T4 · I1, I2, I4 | Extraction |
| FR5 | The workflow shall consolidate related content across threads, senders, and attachments into one entry per project or topic, including recurring issue reports. | T4 · I2, I4 | Consolidation |
| FR6 | The workflow shall update an existing entry when a later reply changes it, retain earlier versions, and mark the current one. | T4 · I1, I2, I4 · \[16\] | Consolidation |
| FR7 | The workflow shall retrieve knowledge by meaning, without requiring the original subject, keyword, sender, or date, with optional filters by project, type, and period. | T3 · I1, I3, I4 | Retrieval |
| FR8 | Generated answers shall cite the entries used and link to their source emails and attachments. | T6 · I1–I4 · \[12\] | Retrieval |

### Governance

| ID | Requirement (siap masuk paper) | Dasar | Tahap |
| --- | --- | --- | --- |
| GR1 | Each entry shall be validated before storage by its knowledge owner: the sender by default, or the PIC or PM where they differ. | T6 · I1, I2, I3 · \[12\] | Validation |
| GR2 | Team leads shall receive a periodic summary of pending, rejected, and outdated entries for their team. | T6 · I3 | Validation (baru) |
| GR3 | Each entry shall preserve provenance: links to its source emails and attachments, its original author, and the external origin of forwarded emails. | T6 · I1–I4 · \[6\], \[12\] | Storage |
| GR4 | Access to an entry shall default to the recipients of its source communication. | T5 · I1, I3, I4 · \[6\], \[9\] | Storage |
| GR5 | The validator shall be able to narrow access for entries whose source was sent to a mailing list but contains restricted content. | T5 · I2, I3 | Validation |
| GR6 | Ownership of and access to entries shall be transferable to a successor at handover, with approval from the team lead. | T3, T5 · I1, I4 | Storage (baru) |
| GR7 | Credentials, personal data, and commercial data shall be detected and excluded or masked before storage and flagged to the validator. | T5 · I1, I3, I4 · \[9\] | Identification |

### Non-fungsional

| ID | Requirement (siap masuk paper) | Dasar | Tahap |
| --- | --- | --- | --- |
| NFR1 | Capture shall be automatic; contributors shall not enter knowledge manually. | T6 · I2, I3, I4 | Semua tahap |
| NFR2 | Review shall require a single action per entry (approve, edit, or reject) from a notification that shows the entry summary. | T6 · I1, I2, I4 | Validation |
| NFR3 | Stored knowledge shall be browsable through a category structure in addition to search. | T3 · I1, I2, I4 | Retrieval |
| NFR4 | The system shall be self-hosted and shall protect stored knowledge against external exposure. | T5 · I2 · \[6\] | Storage |

Catatan GR1: I1 mengingatkan bahwa review bisa sama melelahkannya dengan menulis ulang. Karena itu NFR2 adalah syarat agar GR1 bisa dijalankan, bukan pelengkap.

## Pemetaan ke tahap workflow

Setiap tahap di Table IV draft kini punya requirement yang menjadi dasarnya; label di kanan tiap kotak adalah proses KM-nya.

&#91;embedded content: alur workflow · 6 tahap dengan requirement per tahap\]

Validasi (disorot) adalah satu-satunya tahap yang melibatkan manusia. GR2 dan GR6 adalah tambahan dari wawancara yang belum ada di draft.

## Selisih dengan draft paper

Delapan bagian draft perlu disesuaikan agar desain benar-benar turun dari temuan, sesuai klaim kontribusi pertama paper.

| Bagian draft | Draft sekarang | Temuan wawancara | Saran revisi |
| --- | --- | --- | --- |
| III-B, validasi | Pengirim meninjau, mengedit, atau menolak entri | Informan menyebut pemilik/PM/PIC; I3 menambahkan lead sebagai pemantau | Ubah jadi "knowledge owner (sender by default)" dan tambahkan ringkasan berkala untuk lead (GR1, GR2) |
| III-B, akses | Akses mengikuti penerima komunikasi asli | Didukung I1, I3, I4 sebagai batas dasar; tapi milis terlalu luas (I2, I3) dan penerus tidak dapat akses (I4) | Pertahankan sebagai default; tambahkan penyempitan saat validasi dan alih akses saat handover (GR5, GR6); bahas tegangan ini di Discussion |
| III-B, keputusan agen (i) | Memilih alat ekstraksi per tipe file lampiran | Substansi sering di tautan Google Drive (I1, I4) | Perluas ke tautan Drive; agen juga mengecek izin akses dokumen sebelum membaca (FR3) |
| III-B, governance | Empat mekanisme: validasi, provenance, akses, versi | Kredensial, data pribadi, dan data komersial muncul di email (I1, I3, I4) | Tambahkan mekanisme kelima, deteksi dan masking konten sensitif (GR7) |
| III-B, implementasi | Model LLM berbasis API cloud | I2 khawatir kebocoran ke pihak eksternal | Letakkan masking sebelum pemanggilan LLM, atau sebutkan sebagai batasan |
| III-B, kriteria pengetahuan | Undangan rapat, konfirmasi, laporan metrik dikecualikan | Ditambah undangan kalender deployment, balasan IT support, info HR, izin pribadi; tapi balasan yang mengubah jadwal adalah pengetahuan (I2, I4), dan notifikasi deploy memperbarui entri project yang sudah ada (I4) | Perbarui daftar pengecualian; nyatakan bahwa balasan yang mengubah keputusan memicu pembaruan entri (FR1, FR6) |
| III-C, dataset sintetis | Email pengetahuan, non-pengetahuan, lintas thread, pembaruan | Kasus nyata tersedia dari wawancara | Tambahkan skenario: topik Ramadan lintas kanal dan PIC, reschedule hanya di reply, isu berulang, email milis berisi harga tools, email kredensial VPN, email klien yang diteruskan, email berisi tautan Drive saja |
| III-A, Table III | I4: 3 tahun; durasi wawancara "\[xx\]" | I4 di perusahaan sejak 2017, peran sekarang sejak 2025; I3 di Research Ops dan I4 di Commerce | Samakan definisi masa kerja; isi durasi; cek klaim bahwa keempat informan berasal dari direktorat yang sama |

Kuesioner evaluasi (III-D) sebaiknya juga punya item untuk GR2 dan GR6, karena keduanya requirement baru.

## Status implementasi prototipe

Keputusan 18 Oktober 2026 setelah pengecekan prototipe terhadap requirement. Bagian yang belum dibangun pada FR5, FR7, GR2, GR3, GR6, NFR1, dan NFR2 tidak dilanjutkan, karena implementasi sekarang dianggap cukup untuk paper. GR5 dan NFR3 di-drop. FR1 sudah dilengkapi. NFR4 ditangani dengan redaksi berbasis kode sebelum model dipanggil (opsi A), dengan batasan yang dicatat di bawah.

| ID | Status | Yang sudah ada | Yang tidak dibangun |
| --- | --- | --- | --- |
| FR1 | Terpenuhi | Laporan rutin, balasan IT support, undangan kalender, info HR, dan izin pribadi dikecualikan. Email rutin yang mencatat perbaikan isu atau perubahan jadwal tetap diproses. Notifikasi deploy disimpan hanya sebagai pembaruan knowledge yang terkait (revisi 19 Okt). Diuji dengan s6a–s6g | Notifikasi di thread baru dengan kemiripan di bawah 0,65 ikut di-skip (s6g) |
| FR2 | Terpenuhi | MOM, PRD, UAT, tracking plan, handover, perubahan jadwal, dan resolusi isu diklasifikasi sebagai knowledge | |
| FR3 | Terpenuhi | Isi email, lampiran, Google Docs, Google Sheets, folder Drive, dan PDF di Drive. Pembaca dipilih sesuai jenis sumber | PDF Drive baru diuji terpisah, belum di pipeline penuh |
| FR4 | Terpenuhi | Project (disimpulkan AI), produk/kanal, tipe knowledge, owner, tim, tanggal efektif | |
| FR5 | Sebagian, cukup | Pembaruan dalam thread yang sama terdeteksi andal. Lintas thread digabung bila kemiripan ≥ 0,65 | Skenario Ramadan lintas kanal dan isu berulang tidak diuji |
| FR6 | Terpenuhi | Satu versi aktif di Qdrant, versi lama berstatus `superseded` dan isinya tetap tersimpan | |
| FR7 | Sebagian, cukup | Pencarian berdasarkan makna | Filter per project, tipe, dan periode |
| FR8 | Terpenuhi | Jawaban chatbot menyebut judul, ID sumber, tanggal efektif, dan validator | |
| GR1 | Terpenuhi | Owner = pengirim pertama. PIC lain lewat handover | |
| GR2 | Sebagian, cukup | Dashboard SPV (KPI, draf menggantung ≥ 3 hari, tunggakan per owner) dan nudge | Ringkasan berkala yang dikirim otomatis |
| GR3 | Sebagian, cukup | Sumber email dan dokumen, penulis asli | Asal eksternal email yang di-forward |
| GR4 | Terpenuhi | Akses = penerima. Alamat tim memberi akses ke seluruh anggota tim, dan SPV tim yang terlibat selalu ikut | |
| GR5 | Di-drop | | Penyempitan akses oleh validator. Alasan: menambah keputusan kedua di setiap review (bertentangan dengan NFR2) dan menyulitkan audit akses |
| GR6 | Sebagian, cukup | Owner bisa menyerahkan kepemilikan, owner lama langsung kehilangan hak validasi | Hak akses penerus, persetujuan lead |
| GR7 | Terpenuhi | Kredensial, data pribadi, dan data komersial ditandai untuk validator dan disamarkan sebelum disimpan (uji s3b, s4) | |
| NFR1 | Sebagian, cukup | Seluruh pipeline setelah email masuk berjalan otomatis | Konektor email. Input disimulasikan sebagai JSON thread yang sudah dinormalisasi |
| NFR2 | Sebagian, cukup | Review satu tindakan dengan ringkasan di halaman "Kandidat Saya" | Notifikasi ke owner |
| NFR3 | Di-drop | | Halaman jelajah knowledge per kategori |
| NFR4 | Sebagian | n8n, staging, dan Qdrant self-hosted. Kredensial dan data pribadi terstruktur disamarkan dengan kode sebelum teks dikirim ke model cloud (18 Okt). Uji kebocoran: 0 dari 10 nilai | Model tetap berbasis cloud. Data komersial, nama, alamat, dan rahasia yang ditulis bebas masih bisa sampai ke model. Lihat di bawah |

### NFR4: redaksi sebelum LLM

**Masalah awal.** Isi email mentah (termasuk password dan data pribadi) dikirim ke model cloud lewat 9router di setiap langkah AI: agen orchestrator, klasifikasi (`inspect_email`), daftar lampiran, ekstraksi dokumen, dan kurasi. Penyamaran GR7 baru terjadi di keluaran kurator, jadi data sensitif sudah sampai ke penyedia model sebelum disamarkan. I2 khawatir soal kebocoran ke pihak eksternal.

**Keputusan (18 Oktober 2026).** Dari empat opsi yang dibahas (A redaksi sebelum LLM, B model lokal penuh, C hibrida, D hanya batasan), dipilih **opsi A dengan aturan berbasis kode (regex), tanpa model NER**. Hal yang sulit dideteksi dijadikan batasan.

**Implementasi.** Workflow `redact_sensitive_data`, dipanggil dari `kms_ingest` (sebelum email diserahkan ke agen dan kurator) dan dari ketiga reader Google (sebelum isi dokumen dikembalikan ke extractor). Aturannya ada di satu tempat. Nilai sensitif diganti label yang membawa bentuk tersamarnya, misalnya `[KREDENSIAL: Vpn#****]`. Di akhir, `kms_curate_stage` mengubah label menjadi teks tersamar dan mencatatnya di `sensitive_audit`, sehingga validator tetap melihat peringatan GR7. Rincian aturan: `docs/workflows/redact_sensitive_data.md`.

| Terdeteksi | Tidak terdeteksi (batasan) |
| --- | --- |
| Password, PIN, OTP, secret, API key, token, dan berbagai jenis *key* yang diikuti nilainya | Data komersial (harga, kontrak, revenue): sengaja tidak disamarkan sebelum model karena sering menjadi isi knowledge; tetap disamarkan kurator sebelum disimpan |
| Password di dalam URL, format token yang dikenal (JWT, `sk-`, `AKIA`, `ghp_`, Bearer, private key) | Nama orang dan alamat rumah |
| String acak yang memuat simbol | Rahasia yang ditulis bebas, token alfanumerik tanpa kata kunci, rahasia di gambar atau PDF hasil scan |
| NIK (divalidasi), nomor HP, NPWP, nomor kartu (Luhn), nomor rekening, email pribadi | |

**Hasil uji.** 36 uji unit lulus (22 harus disamarkan, 14 tidak boleh tersentuh). Uji pipeline s0–s7 tidak mengubah status skenario mana pun. Pada cek kebocoran, 10 nilai mentah dari s3b, s4, dan s7 dicari di data eksekusi n8n yang berisi semua input ke model. Putaran pertama menemukan 1 kebocoran (`Merchant Key` di Google Doc s4, karena kata kuncinya belum dikenal). Setelah aturan diperbaiki, putaran kedua: **0 dari 10**.

**Evaluasi end-to-end (19 Oktober 2026)** setelah reset: 0 nilai rahasia mentah di data yang dikirim ke model, di jawaban chatbot, dan di Qdrant. Akses chatbot 22/23 benar, dengan 11/11 penolakan benar. Satu jawaban kurang lengkap: kredensial tersamar s4 tidak terjangkau chatbot karena kurator menaruhnya di bagian yang tidak dijadikan chunk. Rincian di `docs/evaluation/2026-10-19/`.

**Efek samping redaksi (19 Oktober 2026).** Penelusuran temuan s4 menunjukkan model melewati nilai yang sudah disamarkan saat menulis fakta, karena menganggapnya bukan informasi. Pada uji terkontrol, extractor dokumen menulis kredensial s4 sebagai fakta 5/5 kali bila nilainya mentah, 0/5 bila berlabel, dan 0/5 bila tersamar tanpa label. Satu aturan di prompt ("label adalah nilai yang disamarkan; salin sebagai fakta, jangan dibuang atau ditebak") mengembalikannya menjadi 5/5 tanpa satu pun tebakan nilai asli. Kurator menunjukkan perilaku yang sama, sehingga ditambahkan pengaman di kode: nilai tersamar yang hanya tertinggal di bagian yang tidak dicari chatbot dijadikan satu fakta. Setelah perbaikan, chatbot menjawab kredensial s4 dalam bentuk tersamar kepada orang yang berhak dan tetap menolak yang tidak berhak. Rincian di `docs/evaluation/2026-10-19/masked-values/`. Temuan ini juga menunjukkan bahwa tanpa redaksi, model menyalin rahasia mentah ke fakta setiap kali (5/5), sehingga penyamaran yang hanya mengandalkan model (GR7) tidak cukup.

**Draf paragraf Limitation (bahasa Inggris):**

> The workflow calls hosted language models, so message content leaves the organisation during extraction and curation. To limit exposure (NFR4), a rule-based redaction step masks credentials and structured personal data before any model call, covering both the email and the content of linked Google documents. In our leak test, none of ten planted values reached a model after one rule was added for "merchant key", which the first run had missed. Rules cannot recognise every secret: names, home addresses, free-text hints, alphanumeric tokens without a recognisable label, and text inside images still reach the model. Commercial figures are deliberately left unmasked at this stage because they are often the knowledge itself; the curator masks them before storage. Masking also changes model behaviour: in a controlled test the extraction model omitted masked credentials from its facts in all five runs, so the chatbot could not tell users that the values existed. An explicit prompt rule restored them in all five runs, and a deterministic check after curation now adds a fact for any masked value left out. A locally hosted model would remove the residual exposure at the cost of hardware and re-evaluation.

### FR1: notifikasi deploy (revisi 19 Oktober 2026)

**Pertanyaan.** Apakah notifikasi "deploy selesai" untuk project yang PRD/UAT-nya sudah tersimpan juga knowledge? Sebelumnya semua notifikasi deploy di-skip.

**Dasar revisi.** I4 menggambarkan siklus project yang lengkap di email ("setiap stage dari email": MOM, kickoff, handover, timeline rilis, hasil UAT) dan mengeluhkan dokumen yang tidak diperbarui, sehingga orang harus "ngetes ulang lagi sistemnya" untuk tahu kondisi terakhir. Notifikasi deploy adalah tahap terakhir siklus itu. Kutipan I2 yang menjadi dasar pengecualian ternyata tentang *undangan kalender* deployment, bukan hasil deploy. Notifikasi yang berdiri sendiri tetap tidak bernilai dan bisa membanjiri antrean validasi.

**Keputusan (disetujui pemilik paper).** Notifikasi hasil deploy disimpan hanya sebagai **pembaruan** entri yang sudah ada, bila bisa dikaitkan lewat thread yang sama atau kemiripan isi ≥ 0,65 dengan entri yang dapat diakses pengirim. Selain itu di-skip. Notifikasi deploy tidak pernah menjadi entri baru. Teks FR1 di atas sudah disesuaikan.

**Implementasi.** `inspect_email` memberi tanda `deployment_notice`. `Collect Evidence` (kode) men-skip notifikasi yang tidak dikaitkan `saved_knowledge`. Kurator hanya boleh membuat `updated_candidate` dan menambahkan hasil deploy (fitur, versi, environment, status, waktu selesai). `Build Candidate Update` mengubah kandidat baru dari notifikasi deploy menjadi `skipped`.

**Hasil uji.**

| Email | Isi | Hasil |
| --- | --- | --- |
| s6c | Notifikasi otomatis `detik-web v4.18.2`, tanpa nama fitur | `skipped` (tidak terkait) |
| s6f | Notifikasi sebagai balasan di thread jadwal rilis s6e | Pembaruan s6e, di-approve. Chatbot menjawab "27 Maret 2026 pukul 10.21 WIB, detik-web v4.19.0" kepada STAFF-1A dan SPV-A; STAFF-3A ditolak |
| s6g | Notifikasi otomatis di thread baru, menyebut "Fitur Simpan Artikel" | `skipped`: kemiripan dengan s6e 0,62, di bawah ambang 0,65 |
| s0, s6a, s6b | Izin sakit, laporan harian, balasan IT support | Tetap `skipped` |

**Batasan.** Notifikasi yang terkait tetapi dikirim di thread baru dan singkat bisa tidak lolos ambang kemiripan (s6g). Ambang 0,65 dipasang untuk mencegah *false update*, jadi sistem memilih melewatkan pembaruan daripada menimpa entri yang salah.

**Draf kalimat untuk paper (bahasa Inggris):**

> Deployment notices are not knowledge on their own, but a notice for a project that is already stored closes its lifecycle. Following I4, the workflow keeps such a notice only as an update to the entry it can be linked to, either through the same thread or through a similarity of at least 0.65 with an entry the sender can access, and discards it otherwise. In our test, a notice sent as a reply in the release thread updated the entry and the chatbot then reported the go-live date and version. A notice sent in a new thread scored 0.62 and was discarded: the threshold that prevents false updates also drops some genuine ones.

## Batasan lingkup

Lima hal muncul di wawancara tetapi berada di luar jangkauan artefak; sebutkan di Limitation agar penguji tidak menganggapnya terlewat.

- **Diskusi di chat, meet, dan WhatsApp.** Keempat informan menyebut pembahasan lanjut terjadi di luar email. Artefak hanya menangkap hasil formal yang tercatat di email.
- **Pengetahuan tacit orang lama.** CMS dan tracker lama hanya diketahui staf senior (I2). Ini konsisten dengan lingkup pengetahuan eksplisit di draft.
- **Template dan SOP di sumber.** I1 menyarankan email dibuat terstruktur sejak awal. Ini intervensi organisasi yang melengkapi workflow, bukan bagian artefak.
- **Struktur milis.** Tim riset belum punya milis sendiri (I3). Perbaikannya ada di organisasi; GR5 hanya menambal dampaknya.
- **Visibilitas proses sejak perencanaan.** I3 berharap Research Ops tahu rencana riset lebih awal. Ini soal waktu berbagi, bukan penangkapan pengetahuan.
