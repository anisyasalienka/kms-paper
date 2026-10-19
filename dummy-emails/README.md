# Email Dummy Skenario Akses

Direktori: TEAM-A, TEAM-B, TEAM-C. Setiap tim punya STAFF-1x, STAFF-2x, STAFF-3x, dan SPV-x.

| File | Skenario | Pengirim (owner) | Ekspektasi akses chatbot |
| --- | --- | --- | --- |
| s1-personal-cc-spv.json | 1. Staff ke staff, cc SPV | STAFF-1A | STAFF-1A, STAFF-2A, SPV-A (STAFF-3A tidak) |
| s2-spv-cc-team.json | 2. SPV ke staff, cc email tim | SPV-A | Seluruh tim A |
| s3a-cross-team-cc-teams.json | 3a. Lintas tim, cc kedua email tim | STAFF-2A | Seluruh tim A dan tim C |
| s3b-cross-team-cc-persons.json | 3b. Lintas tim, cc personal | STAFF-3A | STAFF-3A, STAFF-2C, STAFF-1A, SPV-A, SPV-C |
| s0-non-knowledge.json | FR1: bukan knowledge (izin sakit) | STAFF-2B | Status `skipped`, tidak masuk antrean |
| s4-drive-folder.json | Tautan folder Google Drive (Doc, Sheet, PDF) | STAFF-1A | STAFF-1A, STAFF-2A, SPV-A. Fakta dari Google Doc; sheet template & PDF tak terkait hanya jadi referensi; folder tersitasi |
| s5-long-thread.json | Thread panjang (10 pesan): keputusan berubah, pesan noise, SPV-C masuk cc di pesan ke-6, lampiran UAT di tengah thread | STAFF-1B | STAFF-1B, STAFF-2B, SPV-B, SPV-C (STAFF-3B tidak). Keputusan final: go-live 2026-04-28 10:00 WIB, topic `breaking_news` dan `morning_digest` |
| s5b-long-thread-continued.json | s5 + 3 balasan baru (hasil go-live, temuan iOS). Kirim setelah s5 di-approve | STAFF-1B | `updated_candidate` atas knowledge s5, bukan `already_exists` |
| s6a-daily-report.json | FR1: laporan harian berisi angka saja | STAFF-3B | `skipped` |
| s6b-it-support-reply.json | FR1: balasan IT support (reset password) | STAFF-2C | `skipped` |
| s6c-deploy-notice.json | FR1: notifikasi deploy otomatis | SPV-A | `skipped` |
| s6d-weekly-report-with-fix.json | FR1 pengecualian: laporan mingguan yang mencatat bug tracking AMP dan perbaikannya | STAFF-1A | Tetap knowledge (`pending_validation`), seluruh tim A |
| s6e-release-reschedule.json | FR2: balasan yang memundurkan jadwal rilis | STAFF-2A | Tetap knowledge, tanggal rilis final 27 Maret 2026 |
| s7-sensitive-mixed.json | NFR4/GR7: data pemenang reward (NIK, HP, email pribadi, rekening), API key, password di URL database, Bearer token | SPV-B | `pending_validation`. Ketujuh nilai disamarkan sebelum masuk model dan tercatat di `sensitive_audit`. Nama pemenang tidak tersamar (batasan) |

s3b juga menguji GR7: berisi password. Sejak 18 Oktober 2026 password itu sudah disamarkan oleh `Redact Sensitive Data` sebelum masuk model (NFR4), dan tetap tampil tersamar di hasil kurasi.

s5 dan s5b menguji thread yang bertambah setelah di-ingest. Duplikat ditentukan dari `message_id`, bukan hanya `source_id`: thread dengan `source_id` sama tetapi berisi pesan baru diperlakukan sebagai pembaruan. Akses dihitung dari gabungan header semua pesan, jadi orang yang baru masuk cc di tengah thread (SPV-C di s5) mendapat akses ke knowledge seluruh thread.

## Format

Setiap file adalah **satu thread email**, tanpa project. Project disimpulkan oleh AI (kurator) dari isi email.

```json
{
  "source_id": "EMAIL-S1",
  "subject": "Keputusan nama event tracking banner Ramadan",
  "messages": [
    {
      "message_id": "EMAIL-S1-M01",
      "date": "2026-03-02",
      "from": "STAFF-1A",
      "to": ["STAFF-2A"],
      "cc": ["SPV-A"],
      "subject": "Keputusan nama event tracking banner Ramadan",
      "body": "Halo 2A, ...",
      "attachments": []
    }
  ]
}
```

Format ini mensimulasikan email **setelah** dinormalisasi oleh konektor email: header `From/To/Cc` sudah dipetakan ke ID direktori (`STAFF-1A`, `SPV-A`, `TEAM-A`) dan body sudah berupa teks biasa (bukan MIME/base64 seperti respons Gmail API).
