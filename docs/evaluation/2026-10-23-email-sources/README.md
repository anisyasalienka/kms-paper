# Uji sumber selalu email (v2.12), 23 Oktober 2026

## Pemicu

Peneliti meminta agar sumber di Kandidat Saya dan di jawaban chatbot selalu berupa email, bukan ID knowledge (`KNOWLEDGE-…`).

## Temuan sebelum perbaikan

Jejak knowledge ke email sudah ada di `kms_candidates`: setiap baris menyimpan `knowledge_id`, `source_id`, dan `source_email`, dan baris lama hanya berubah menjadi `superseded`. Masalahnya ada di Qdrant. `knowledge_writer_upsert` menimpa `source_ids`/`email_ids` dengan sumber kandidat terbaru saja.

Knowledge PRD Onboarding Premium (`KNOWLEDGE-47c9…`) dibentuk tiga kandidat: EMAIL-D1 (M01), EMAIL-D5 (keputusan metode verifikasi), dan EMAIL-D1 (M01 + M02). Di Qdrant hanya tersimpan `email_ids: [EMAIL-D1]` ditambah `KNOWLEDGE-47c9…` di `source_ids` (`qdrant-master-before.json`). EMAIL-D5 hilang.

## Perubahan

| Workflow | Perubahan |
| :--- | :--- |
| `kms_validate_knowledge` | `Get Knowledge History` + `Add Source History`: `source_emails` dan `message_ids` gabungan dari semua versi dikirim ke writer |
| `knowledge_writer_upsert` | `source_ids`/`email_ids` digabung dengan `source_emails`, `KNOWLEDGE-…` dibuang; `source_emails` disimpan di master dan chunk |
| `saved_knowledge` | Mengembalikan `source_emails` |
| `Chat with Qdrant Knowledge` | Aturan 6: "Sumber:" hanya berisi email (subjek + ID) |
| `kms_portal_api` | `Get Approved History`; sumber `KNOWLEDGE-…` diganti email-emailnya, sitasi fakta/konflik dipetakan ulang, isi email owner lain hanya bila user ada di `access_users` |
| Frontend | "lihat email" untuk setiap email yang isinya dikirim backend; keterangan "dari knowledge yang diperbarui" |

Dua knowledge yang sudah ada di-backfill langsung di Qdrant (`set_payload`) dengan nilai yang sama seperti hasil logika baru (`qdrant-master-after.json`). Payload sebelum backfill dan cadangan workflow: `/mnt/kms-backups/2026-10-23-email-sources/`.

## Hasil

| Uji | Hasil |
| :--- | :--- |
| `/my-candidates` STAFF-1A, CAND-…9FTM8E | `KNOWLEDGE-47c9…` → EMAIL-D5 (isi email ikut). Fakta yang dulu mengutip knowledge kini mengutip EMAIL-D1 dan EMAIL-D5 (`my-candidates-STAFF-1A.json`) |
| `/my-candidates` STAFF-2A, CAND-…98RJ6S | `KNOWLEDGE-47c9…` → EMAIL-D1. Tidak dobel karena EMAIL-D1 sudah dikutip langsung (`my-candidates-STAFF-2A.json`) |
| Chatbot STAFF-3A: "Kenapa verifikasi onboarding premium tidak pakai OTP SMS?" | Sumber: EMAIL-D1 dan EMAIL-D5 dengan subjeknya, tanpa ID knowledge (`chat-STAFF-3A.json`) |
| `Add Source History` (uji lokal, baris tiruan) | Baris rejected diabaikan; satu entri per thread; `message_ids` tergabung; riwayat kosong hanya berisi thread sendiri |
| Writer `Validate and Prepare` (uji lokal) | `source_ids` = [EMAIL-D1, gpdf, EMAIL-D5], `KNOWLEDGE-…` terbuang |

## Belum diuji

- Approve sungguhan lewat `kms_validate_knowledge` yang baru, karena saat ini tidak ada kandidat pending. Pengujian ini akan berjalan dengan sendirinya pada putaran evaluasi berikutnya.
- Kasus email owner lain yang tidak boleh dibaca user (semua data uji saat ini dapat diakses kedua owner).
- Tampilan di browser; perubahan frontend hanya dicek dengan typecheck, build, dan lint.
