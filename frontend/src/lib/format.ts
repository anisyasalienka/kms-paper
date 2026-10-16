import type { CandidateStatus } from './types'

export const STATUS_LABEL: Record<CandidateStatus, string> = {
  processing: 'Diproses AI',
  pending_validation: 'Menunggu validasi',
  approving: 'Sedang disimpan',
  approved: 'Disetujui',
  superseded: 'Digantikan versi baru',
  rejected: 'Ditolak',
  skipped: 'Bukan pengetahuan',
  already_exists: 'Sudah ada',
  already_pending: 'Sudah dalam antrean',
  failed: 'Gagal',
}

export type Tone = 'warn' | 'ok' | 'bad' | 'info' | 'muted' | 'accent'

export const STATUS_TONE: Record<CandidateStatus, Tone> = {
  processing: 'info',
  pending_validation: 'warn',
  approving: 'info',
  approved: 'ok',
  superseded: 'muted',
  rejected: 'bad',
  skipped: 'muted',
  already_exists: 'muted',
  already_pending: 'muted',
  failed: 'bad',
}

export const ACTION_LABEL: Record<string, string> = {
  approve: 'Approve',
  edit_approve: 'Edit & approve',
  reject: 'Reject',
  handover: 'Handover',
  nudge: 'Nudge',
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
