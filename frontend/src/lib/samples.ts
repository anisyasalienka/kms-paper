import s0 from '../../../dummy-emails/s0-non-knowledge.json'
import s1 from '../../../dummy-emails/s1-personal-cc-spv.json'
import s2 from '../../../dummy-emails/s2-spv-cc-team.json'
import s3a from '../../../dummy-emails/s3a-cross-team-cc-teams.json'
import s3b from '../../../dummy-emails/s3b-cross-team-cc-persons.json'
import s4 from '../../../dummy-emails/s4-drive-folder.json'
import s5 from '../../../dummy-emails/s5-long-thread.json'
import s5b from '../../../dummy-emails/s5b-long-thread-continued.json'
import type { EmailPayload } from './types'

// Scenario emails from dummy-emails/README.md, used to replay the interview scenarios.
export const SAMPLES: { key: string; label: string; expected: string; email: EmailPayload }[] = [
  { key: 's1', label: 'Skenario 1: staff ke staff, cc SPV', expected: 'STAFF-1A, STAFF-2A, SPV-A', email: s1 as EmailPayload },
  { key: 's2', label: 'Skenario 2: SPV, cc email tim', expected: 'Seluruh tim A', email: s2 as EmailPayload },
  { key: 's3a', label: 'Skenario 3a: lintas tim, cc kedua tim', expected: 'Seluruh tim A dan tim C', email: s3a as EmailPayload },
  { key: 's3b', label: 'Skenario 3b: lintas tim, cc personal', expected: 'STAFF-3A, STAFF-2C, STAFF-1A, SPV-A, SPV-C', email: s3b as EmailPayload },
  { key: 's4', label: 'Skenario 4: tautan folder Google Drive', expected: 'STAFF-1A, STAFF-2A, SPV-A', email: s4 as EmailPayload },
  { key: 's5', label: 'Skenario 5: thread panjang (10 pesan)', expected: 'STAFF-1B, STAFF-2B, SPV-B, SPV-C', email: s5 as EmailPayload },
  { key: 's5b', label: 'Skenario 5b: thread s5 + 3 balasan baru (kirim setelah s5 di-approve)', expected: 'Pembaruan knowledge s5 (updated_candidate)', email: s5b as EmailPayload },
  { key: 's0', label: 'Bukan pengetahuan (izin sakit)', expected: 'Status skipped', email: s0 as EmailPayload },
]
