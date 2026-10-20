# Uji pertanyaan lanjutan di chatbot (v2.11), 20 Oktober 2026

## Intinya

Sebelum v2.11, setiap pertanyaan ke chatbot diproses sendiri-sendiri. Kalau user bertanya "kapan rilis fitur Search Result Video?" lalu "siapa validatornya?", chatbot tidak tahu "-nya" merujuk ke fitur apa. Sekarang frontend mengirim 4 pesan terakhir di layar bersama pertanyaan baru, dan agen melengkapi pertanyaan lanjutan sebelum mencari. Ibaratnya seperti petugas perpustakaan yang masih ingat buku apa yang barusan kamu tanyakan, tetapi tetap mengambil jawabannya dari rak, bukan dari ingatan. Server tidak menyimpan percakapan apa pun.

Uji dijalankan tepat setelah Qdrant dan Data Table di-reset, jadi semua jawaban "tidak ditemukan". Yang diuji adalah apakah konteks terbawa ke pencarian, bukan isi jawabannya.

## Perubahan

- Frontend (`ChatPage.tsx`, `toHistory`): kirim `history` berisi 4 pesan terakhir, tanpa pesan error, maksimal 600 karakter per pesan, bagian "Sumber:" dibuang.
- `Request Context`: batas yang sama diterapkan ulang di server, lalu riwayat disusun menjadi teks "User: … / Asisten: …".
- `Qdrant Knowledge Agent`: prompt = "Riwayat percakapan sebelumnya" + "Pertanyaan baru"; aturan 7 di system message: lengkapi pertanyaan lanjutan menjadi pertanyaan mandiri sebelum memanggil `Search Qdrant Knowledge`, jangan menjawab dari riwayat.
- Tidak ada node Memory. Tombol "Percakapan baru" mengosongkan konteks.

## Hasil

| Uji | Input | Ekspektasi | Hasil |
| :--- | :--- | :--- | :--- |
| Eksekusi manual 5109 (`STAFF-A1`, salah ketik untuk `STAFF-1A`; tidak berpengaruh karena basis kosong) | Riwayat: "Kapan tanggal rilis fitur Search Result Video?" → jawaban palsu berisi "Sumber: … validator SPV-A". Pertanyaan: "siapa validatornya?" | Bagian Sumber terbuang; query pencarian menyebut fiturnya; jawaban tidak diambil dari riwayat | `history` di `Request Context` tanpa bagian Sumber. Pencarian pertama: "siapa validator fitur Search Result Video", kedua: "Search Result Video". Jawaban: "Informasi mengenai validator fitur Search Result Video tidak ditemukan…" (SPV-A tidak disebut) |
| Endpoint produksi lewat proxy frontend (`STAFF-1A`) | Riwayat: pertanyaan event tracking banner Ramadan. Pertanyaan: "kapan rilisnya?" | Subjek terbawa | "Informasi mengenai tanggal rilis banner Ramadan tidak ditemukan…" |

## Belum diuji

- Pertanyaan lanjutan dengan knowledge nyata (misalnya s1 lalu "validatornya siapa?" dan "test case-nya?"). Perlu ingest ulang skenario setelah reset.
- Pergantian topik di tengah percakapan; menurut aturan 7, pertanyaan topik baru dicari apa adanya.
