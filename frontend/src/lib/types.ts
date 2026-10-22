export type Role = 'staff' | 'spv'

export interface DirectoryUser {
  user_id: string
  role: Role
  team: string
  display_label: string
}

export type CandidateStatus =
  | 'processing'
  | 'pending_validation'
  | 'approving'
  | 'approved'
  | 'superseded'
  | 'rejected'
  | 'skipped'
  | 'already_exists'
  | 'already_pending'
  | 'failed'

// Email payload accepted by POST /ingest-email (same shape as dummy-emails/*.json): one thread,
// no project. The curator infers the project from the content.
export interface EmailMessage {
  message_id: string
  date: string
  from: string
  to: string[]
  cc: string[]
  subject: string
  body: string
  attachments: unknown[]
}

export interface EmailPayload {
  source_id: string
  subject: string
  messages: EmailMessage[]
}

export interface IngestResponse {
  success: boolean
  candidate_id: string | null
  status: CandidateStatus
  duplicate_of: string | null
  error: string | null
}

export interface CuratedSummary {
  title: string | null
  summary: string | null
  owner_pic: string | null
  owner_team: string | null
  knowledge_type: string | null
  product_or_channel: string | null
  effective_date: string | null
  has_sensitive_data: boolean | null
  access_recipients: string[]
  access_users: string[]
}

export interface CandidateStatusResponse {
  success: boolean
  candidate_id: string
  status: CandidateStatus
  error_message: string | null
  duplicate_of: string | null
  created_at: string
  curated_summary: CuratedSummary | null
}

export interface SensitiveItem {
  category: string
  location: string
  masked_value: string
}

export interface Fact {
  fact: string
  source: string[]
}

export interface Conflict {
  conflict: string
  sources: string[]
}

export interface CandidateSource {
  source_id: string
  source_type: 'email' | 'email_thread' | 'spreadsheet' | 'document' | 'saved_knowledge' | string
  name: string
  url?: string
  // v2.12: an email that reached this candidate through saved knowledge (KNOWLEDGE- source resolved by
  // my-candidates). `email` is null when the viewer may not read that thread.
  via_knowledge?: string
  email?: EmailPayload | null
}

export interface Nudge {
  from: string
  message: string
  at: string
}

export interface MyCandidate {
  candidate_id: string
  source_id: string
  project_name: string | null
  status: CandidateStatus
  title: string | null
  summary: string | null
  knowledge_type: string | null
  product_or_channel: string | null
  effective_date: string | null
  is_update: boolean
  has_sensitive_data: boolean | null
  sensitive_details: SensitiveItem[]
  access_users: string[]
  facts: Fact[]
  conditions: string[]
  conflicts: Conflict[]
  sources?: CandidateSource[]
  structured_details: Record<string, unknown>
  confidence: number | null
  error_message: string | null
  // Redacted thread saved at ingest (attachment contents removed); null for candidates created before 2026-10-19.
  source_email?: EmailPayload | null
  created_at: string
  nudges: Nudge[]
}

export interface MyCandidatesResponse {
  success: boolean
  user_id: string
  pending_count: number
  candidates: MyCandidate[]
}

export type ValidateAction = 'approve' | 'edit_approve' | 'approve_as_new' | 'reject' | 'handover'

export interface ValidateRequest {
  candidate_id: string
  user_id: string
  action: ValidateAction
  patched_fields?: { title?: string; summary?: string; effective_date?: string }
  handover_to?: string
  notes?: string
}

export interface ValidateResponse {
  success: boolean
  candidate_id: string
  new_status?: CandidateStatus
  new_owner?: string
  knowledge_id?: string
  qdrant_point_id?: string
  chunks_written?: number
  superseded_candidates?: string[]
  error?: string
}

export interface PendingItem {
  candidate_id: string
  title: string | null
  product_or_channel: string | null
  owner_pic: string
  owner_team: string
  days_pending: number
  created_at: string
}

export interface AuditLog {
  at: string
  action: string
  actor: string
  candidate_id: string
  title: string | null
  notes: string | null
}

export interface LeadSummary {
  success: boolean
  spv: string
  team: string
  metrics: Record<'approved' | 'pending' | 'rejected' | 'superseded' | 'failed' | 'skipped', number>
  pending: PendingItem[]
  bottlenecks: PendingItem[]
  pending_by_owner: Record<string, number>
  distribution_by_channel: Record<string, number>
  distribution_by_type: Record<string, number>
  recent_logs: AuditLog[]
}

export interface ChatResponse {
  output: string
}

// Earlier turns sent with each question so the agent can resolve follow-ups; n8n keeps no memory.
export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}
