const { redactText } = require('./redact.js');
const must = [
  ['Username akun bersama: stg-ops, password sementara: Vpn#Stg2026. Akses ini berlaku', 'Vpn#Stg2026'],
  ['DB_PASSWORD=Sup3rS3cret!', 'Sup3rS3cret!'],
  ['client secret sandbox: Qris#Sbx2026', 'Qris#Sbx2026'],
  ['Kata sandi wifi adalah Detik2026kantor', 'Detik2026kantor'],
  // Token-shaped test values are split so secret scanners do not flag this file.
  ['api_key: ' + 'AIza' + 'SyA1234567890abcdefghijklmnopqrstuv', 'SyA1234567890abcdefghijklmnopqrstuv'],
  ['Authorization: Bearer abcdef1234567890ghijkl', 'abcdef1234567890ghijkl'],
  ['Token webhook ke vendor: Bearer 8f3kQ2mZp9Lx7Vb1Nc4R', '8f3kQ2mZp9Lx7Vb1Nc4R'],
  ['koneksi db: postgres://admin:H4rdP@ss@db.internal:5432/kms', '@ss@'],
  ['mongodb://user:pw12345@host/db', 'pw12345'],
  ['token github ' + 'ghp' + '_abcdefghijklmnopqrstuvwxyz0123456789', '_abcdefghijklmnopqrstuvwxyz0123456789'],
  ['jwt ' + 'eyJ' + 'hbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N', 'hbGciOiJIUzI1NiJ9'],
  ['Pemenang: NIK 3174052508900001, HP 0812-3456-7890', '3174052508900001'],
  ['Pemenang: NIK 3174052508900001, HP 0812-3456-7890', '0812-3456-7890'],
  ['hubungi +6281234567890 ya', '+6281234567890'],
  ['NPWP 01.234.567.8-901.000', '01.234.567.8-901.000'],
  ['kartu 4111 1111 1111 1111 exp 12/27', '4111 1111 1111 1111'],
  ['transfer ke rekening BCA 1234567890 a.n. Budi', '1234567890'],
  ['email pribadinya budi.santoso@gmail.com', 'budi.santoso@gmail.com'],
  ['pakai kode MK_STG#9x7Lq2 untuk sandbox', 'MK_STG#9x7Lq2'],
  ['Merchant Key: MK_STG_9982401', 'MK_STG_9982401'],
  ['Client Secret Sandbox: Qris#StgSecr3t2026!', 'Qris#StgSecr3t2026!'],
  ['ACCESS_KEY=AbCdEf123456', 'AbCdEf123456'],
];
const keep = [
  'Lihat https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd/edit?tab=t.0',
  'Sumber gdoc:1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd sudah dibaca',
  'commit 3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f dan UUID 550e8400-e29b-41d4-a716-446655440000',
  'event video_play memakai {{content.id}} di amp-analytics, rilis 2026-03-27 pukul 10.00 WIB',
  'Harga tools Rp 12.500.000 per tahun, nilai kontrak Rp1.200.000.000',
  'vpn-staging.internal port 1194, profil staging-jkt, user stg-ops',
  'Password: menyusul via japri. Token FCM topic breaking_news',
  'UAT Pass: 12, Fail: 2, total 14 test case FCM-01 sampai FCM-14',
  'Pageviews: 1.284.500 (+3,2% dari kemarin), Users: 412.880',
  'Hubungi analytics@detik.com untuk akses dashboard',
  'Tiket #IT-48213 sudah diproses, versi v4.18.2 deploy 22:14 WIB',
  'Nomor dokumen 2026031200000001 dan order id 9876543210123456',
  'C++ dan C# dipakai; skor A+ untuk tim; lihat section_3/overview',
  'Key: breaking_news adalah topic utama, key result Q1 tercapai',
];
let fail = 0;
for (const [t, secret] of must) {
  const f = []; const out = redactText(t, 'x', f);
  const ok = !out.includes(secret) && f.length > 0;
  if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', 'MASK', JSON.stringify(out));
}
for (const t of keep) {
  const f = []; const out = redactText(t, 'x', f);
  const ok = out === t;
  if (!ok) fail++;
  console.log(ok ? 'OK  ' : 'FAIL', 'KEEP', ok ? t.slice(0, 60) : JSON.stringify(out) + ' ' + JSON.stringify(f));
}
console.log('failures:', fail);
