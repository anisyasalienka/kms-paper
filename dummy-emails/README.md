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

s3b juga menguji GR7: berisi password yang harus dimasking oleh curator.
