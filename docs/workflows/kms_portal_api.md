# kms_portal_api

| | |
| :--- | :--- |
| **ID** | `K05IetusDReVqoiS` |
| **Pemicu** | Tiga webhook (Header Auth): `GET /webhook/my-candidates`, `GET /webhook/lead-summary`, `POST /webhook/nudge` |
| **Dipanggil oleh** | Frontend, Komponen 2 (Kandidat Saya) dan Komponen 4 (Monitoring SPV) |
| **Requirement** | GR1 (antrean owner), GR2 (ringkasan tata kelola SPV) |

## 1. `GET /my-candidates?user_id=`

```text
GET my-candidates ─> Get My Candidates ─> Get Nudges ─> Get Approved History ─> Shape My Candidates ─> Respond My Candidates
```

Antrean "Kandidat Saya": semua kandidat dengan `owner_pic` = user aktif (pending di atas), lengkap dengan data review (fakta, sumber, detail teknis, item sensitif, `access_users`), email sumber versi tersamar (`source_email`, `null` untuk kandidat lama), dan nudge dari SPV. Email hanya ikut di endpoint ini, sehingga yang dapat membacanya hanya owner kandidat.

**Sumber selalu email (v2.12).** `Get Approved History` mengambil semua baris `approved`/`superseded`. Untuk setiap sumber `KNOWLEDGE-…` (tipe `saved_knowledge`), `Shape My Candidates` mencari baris dengan `knowledge_id` itu yang dibuat sebelum kandidat ini, mengambil satu baris per thread (yang terbaru, karena pesannya paling banyak), lalu menggantinya dengan entri `{ source_id, source_type: 'email_thread', name: subjek, via_knowledge, email }`. Thread milik kandidat itu sendiri tidak diulang. Sitasi `KNOWLEDGE-…` di fakta dan konflik dipetakan ke ID email yang sama. Sumber `EMAIL-…` lain yang dikutip langsung juga diberi `email` bila threadnya ada di riwayat. `email` diisi hanya bila user aktif adalah owner baris itu atau ada di `access_users`-nya; selain itu `null` (frontend menampilkan ID dan subjek saja). Knowledge tanpa baris riwayat tetap tampil sebagai `saved_knowledge`.

## 2. `GET /lead-summary?user_id=`

```text
GET lead-summary ─> Get Lead Actor ─> Get All Candidates ─> Get All Logs ─> Build Lead Summary ─> Respond Lead Summary
```

Ringkasan tata kelola untuk satu SPV. Cakupan: kandidat milik tim SPV atau yang `access_users`-nya memuat SPV tersebut. Isi: KPI (approved, pending, rejected, superseded, failed), bottleneck (pending ≥ 3 hari), pending per owner, sebaran per kanal dan tipe, serta log audit terbaru. Role selain `spv` → `403`.

## 3. `POST /nudge`

```text
POST nudge ─> Get Nudge Actor ─> Get Nudge Candidate ─> Authorize Nudge ─> Nudge Allowed? ─┬─> Write Nudge Log ─> Respond Nudge
                                                                                            └──────────────────> Respond Nudge
```

Body: `{ candidate_id, user_id, message }`. Hanya SPV, hanya untuk kandidat pending dalam cakupannya. Nudge dicatat di `kms_validation_logs` dan tampil di antrean owner. Tidak ada email atau notifikasi eksternal.
