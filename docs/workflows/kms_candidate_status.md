# kms_candidate_status

| | |
| :--- | :--- |
| **ID** | `GhJKHDSm3ympl89h` |
| **Pemicu** | `GET /webhook/candidate-status?id=<candidate_id>` (Header Auth) |
| **Dipanggil oleh** | Frontend, polling di Komponen 1 (setiap 4 detik) |

## Tujuan

Endpoint polling: mengembalikan status kandidat dan ringkasan kurasinya. Sekaligus menutup baris yang macet.

## Output

`{ success, candidate_id, status, error_message, duplicate_of, created_at, curated_summary{ title, summary, owner_pic, owner_team, knowledge_type, product_or_channel, effective_date, has_sensitive_data, access_recipients, access_users } }`. ID tidak dikenal → `404`.

## Alur

```text
GET candidate-status ─> Get Candidate ─> Build Status Response ─> Is Stale? ─┬─> Mark Stale As Failed ─> Respond Status
                                                                             └────────────────────────> Respond Status
```

## Aturan

Baris `processing` yang berumur lebih dari 10 menit dilaporkan dan disimpan sebagai `failed` ("Proses kurasi melebihi 10 menit tanpa hasil."), sehingga tidak ada kandidat yang menggantung.
