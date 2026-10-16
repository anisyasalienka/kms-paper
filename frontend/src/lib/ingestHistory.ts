import { useState } from 'react'

// Per-browser list of submitted candidate IDs so the user can keep tracking the
// asynchronous curation after leaving the page. The server remains the source of truth.
export interface IngestEntry {
  candidate_id: string
  subject: string
  submitted_by: string
  at: string
}

const KEY = 'kms.ingest.history'
const MAX = 20

function load(): IngestEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as IngestEntry[]) : []
  } catch {
    return []
  }
}

function save(entries: IngestEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Ignore: history is a convenience only.
  }
}

export function useIngestHistory(userId: string) {
  const [all, setAll] = useState<IngestEntry[]>(load)

  const add = (entry: IngestEntry) => {
    const next = [entry, ...all.filter((e) => e.candidate_id !== entry.candidate_id)].slice(0, MAX)
    setAll(next)
    save(next)
  }

  const remove = (candidateId: string) => {
    const next = all.filter((e) => e.candidate_id !== candidateId)
    setAll(next)
    save(next)
  }

  return { entries: all.filter((e) => e.submitted_by === userId), add, remove }
}
