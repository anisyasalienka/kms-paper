import type {
  CandidateStatusResponse,
  ChatResponse,
  DirectoryUser,
  EmailPayload,
  IngestResponse,
  LeadSummary,
  MyCandidatesResponse,
  ValidateRequest,
  ValidateResponse,
} from './types'

// All calls go to /api/*, which nginx (or the Vite dev proxy) forwards to n8n /webhook/*
// and signs with X-KMS-API-KEY. The browser never sees the key.
const BASE = '/api'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Input tidak valid.',
  403: 'Akses ditolak.',
  404: 'Data tidak ditemukan.',
  409: 'Status kandidat sudah berubah. Muat ulang data.',
  422: 'Data kandidat rusak.',
  502: 'Penulisan ke basis pengetahuan gagal.',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server.')
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string; message?: string } | null)?.error ||
      (data as { message?: string } | null)?.message ||
      FALLBACK_MESSAGES[res.status] ||
      `Server membalas HTTP ${res.status}.`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

const qs = (params: Record<string, string>) => '?' + new URLSearchParams(params).toString()

export const api = {
  directory: () => request<{ success: boolean; users: DirectoryUser[] }>('/directory'),

  ingest: (user_id: string, email: EmailPayload) =>
    request<IngestResponse>('/ingest-email', { method: 'POST', body: JSON.stringify({ user_id, email }) }),

  candidateStatus: (id: string) => request<CandidateStatusResponse>('/candidate-status' + qs({ id })),

  myCandidates: (user_id: string) => request<MyCandidatesResponse>('/my-candidates' + qs({ user_id })),

  validate: (body: ValidateRequest) =>
    request<ValidateResponse>('/validate-knowledge', { method: 'POST', body: JSON.stringify(body) }),

  chat: (user_id: string, chatInput: string) =>
    request<ChatResponse>('/chat-rag', { method: 'POST', body: JSON.stringify({ user_id, chatInput }) }),

  leadSummary: (user_id: string) => request<LeadSummary>('/lead-summary' + qs({ user_id })),

  nudge: (candidate_id: string, user_id: string, message: string) =>
    request<{ success: boolean; logged: boolean; nudged: string }>('/nudge', {
      method: 'POST',
      body: JSON.stringify({ candidate_id, user_id, message }),
    }),
}
