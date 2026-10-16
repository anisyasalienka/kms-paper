import s0 from '../../../dummy-emails/s0-non-knowledge.json'
import s1 from '../../../dummy-emails/s1-personal-cc-spv.json'
import s2 from '../../../dummy-emails/s2-spv-cc-team.json'
import s3a from '../../../dummy-emails/s3a-cross-team-cc-teams.json'
import s3b from '../../../dummy-emails/s3b-cross-team-cc-persons.json'
import type { EmailPayload } from './types'

// Scenario emails from dummy-emails/README.md, used to replay the interview scenarios.
export const SAMPLES: { key: string; label: string; expected: string; email: EmailPayload }[] = [
  { key: 's1', label: 'Skenario 1: staff ke staff, cc SPV', expected: 'STAFF-1A, STAFF-2A, SPV-A', email: s1 as EmailPayload },
  { key: 's2', label: 'Skenario 2: SPV, cc email tim', expected: 'Seluruh tim A', email: s2 as EmailPayload },
  { key: 's3a', label: 'Skenario 3a: lintas tim, cc kedua tim', expected: 'Seluruh tim A dan tim C', email: s3a as EmailPayload },
  { key: 's3b', label: 'Skenario 3b: lintas tim, cc personal', expected: 'STAFF-3A, STAFF-2C, STAFF-1A, SPV-A, SPV-C', email: s3b as EmailPayload },
  { key: 's0', label: 'Bukan pengetahuan (izin sakit)', expected: 'Status skipped', email: s0 as EmailPayload },
]
