# Sumber flowchart "Alur Proses KMS"

`flowchart.html` adalah sumber `../Alur Proses KMS - Flowchart n8n.pdf` (7 halaman A4). Font ada di `fonts/`, jadi tidak perlu internet.

Membuat ulang PDF:

```bash
/snap/bin/chromium --headless --no-pdf-header-footer --print-to-pdf=out.pdf "file://$PWD/flowchart.html"
```

Chromium versi snap hanya bisa menulis di dalam folder home. Setelah mengubah alur, cek jumlah halaman tetap 7 (`pdfinfo out.pdf`), karena satu tahap harus muat satu halaman.

Versi terakhir: 20 Oktober 2026 (v2.11). Isinya mencakup notifikasi deploy (v2.8), `Save Source Email` dan tombol "Lihat email asli" (v2.9), Google Slides dan aturan redaksi kata kunci + spasi (v2.10), serta pertanyaan lanjutan di chatbot (v2.11).
