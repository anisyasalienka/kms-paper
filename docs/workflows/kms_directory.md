# kms_directory

| | |
| :--- | :--- |
| **ID** | `bpUU2HibzLVT0p3x` |
| **Pemicu** | `GET /webhook/directory` (Header Auth) |
| **Dipanggil oleh** | Frontend, profile selector |

## Tujuan

Mengembalikan daftar profil pseudonim untuk pemilih profil di frontend. Tidak ada nama asli informan.

## Output

`{ success: true, users: [ { user_id, role, team, display_label } ] }`, diurutkan per tim, role, lalu ID.

## Alur

```text
GET directory ─> Get Directory (kms_directory) ─> Shape Directory ─> Respond Directory
```

## Catatan

Isi direktori (12 user: `STAFF-1A`…`STAFF-3C`, `SPV-A`…`SPV-C`) di-seed oleh `kms_admin_reset`.
