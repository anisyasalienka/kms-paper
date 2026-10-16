# kms_admin_reset

| | |
| :--- | :--- |
| **ID** | `PaKzTvasVYO37l6b` |
| **Pemicu** | Manual (`Run Reset`), tidak aktif sebagai endpoint |

## Tujuan

Mengosongkan semua data uji sebelum satu putaran evaluasi, lalu mengisi ulang direktori.

## Alur

```text
Run Reset ─> Delete Candidates ─> Delete Logs ─> Delete Directory ─> Clear Qdrant knowledge ─> Clear Qdrant knowledge_store
─> Seed Directory Rows ─> Insert Directory
```

## Efek

- Menghapus **semua** baris `kms_candidates`, `kms_validation_logs`, dan `kms_directory`.
- Menghapus **semua** titik di koleksi Qdrant `knowledge` dan `knowledge_store`.
- Mengisi ulang 12 user: tiga tim (A, B, C), masing-masing `STAFF-1x`, `STAFF-2x`, `STAFF-3x` (role `staff`) dan `SPV-x` (role `spv`).

## Catatan

Tindakan ini tidak dapat dibatalkan. Jalankan hanya di lingkungan uji. Verifikasi cepat setelah reset: `POST http://127.0.0.1:6333/collections/knowledge/points/count` harus mengembalikan `count: 0`.
