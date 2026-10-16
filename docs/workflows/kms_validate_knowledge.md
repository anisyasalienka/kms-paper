# kms_validate_knowledge

| | |
| :--- | :--- |
| **ID** | `kGreWkk0geO6v29i` |
| **Pemicu** | `POST /webhook/validate-knowledge` (Header Auth) |
| **Dipanggil oleh** | Frontend, Komponen 2 (Kandidat Saya) |
| **Memanggil** | `knowledge_writer_upsert` |
| **Requirement** | GR1 (validasi oleh pemilik), GR6 (handover), FR6 (supersede versi lama), audit trail |

## Tujuan

Tindakan *human-in-the-loop* atas satu kandidat: approve, edit & approve, approve sebagai entri baru, reject, atau handover.

## Input

```json
{ "candidate_id": "CAND-...", "user_id": "STAFF-1A", "action": "approve | edit_approve | approve_as_new | reject | handover",
  "patched_fields": { "title": "...", "summary": "...", "effective_date": "..." }, "handover_to": "STAFF-2A", "notes": "..." }
```

## Output

`200 { success, candidate_id, new_status, knowledge_id, qdrant_point_id, chunks_written, superseded_candidates }`. Error: `400` (aksi/alasan tidak valid), `403` (bukan owner/role), `404`, `409` (status tidak sesuai atau sedang diproses request lain), `502` (penulisan Qdrant gagal).

## Alur

```text
POST validate-knowledge ─> Get Candidate ─> Get Actor ─> Get Handover Target ─> Authorize & Plan ─> Allowed? ─┬─> Route Action
                                                                                                               └─> Respond (error)
Route Action ─┬─ approve / approve_as_new / edit_approve ─> Lock Candidate ─> Lock Acquired? ─┬─> Run Writer ─┬─> Supersede Previous ─> Mark Approved ─> Write Audit Log ─> Build Result ─> Respond
              │                                                                              │              └─> Unlock Candidate ─> Writer Failed Result ─> Respond (502)
              │                                                                              └─> Conflict Result ─> Respond (409)
              ├─ reject ─> Mark Rejected ─> Write Audit Log ─> ...
              └─ handover ─> Change Owner ─> Write Audit Log ─> ...
```

## Aturan

- **Otorisasi:** user ada di direktori, role `staff`/`spv`, sama dengan `owner_pic`, dan status `pending_validation`. SPV tidak dapat memvalidasi kandidat milik staff.
- **Lock:** `pending_validation → approving` dengan filter status, sehingga request paralel kedua mendapat 409.
- **Edit & Approve:** judul, ringkasan, dan tanggal efektif di-patch ke `curated_payload` sebelum embedding; perubahan "dari → ke" dicatat.
- **Approve as New:** tautan `existing_knowledge_id` dihapus; knowledge lama tidak di-supersede.
- **Supersede:** setelah pembaruan, baris `approved` lain dengan `knowledge_id` sama menjadi `superseded`.
- **Writer gagal:** status dikembalikan ke `pending_validation` dengan pesan error.
- **Reject** wajib memakai alasan. **Handover** langsung mencabut hak owner lama.
- Setiap aksi dicatat di `kms_validation_logs`.
