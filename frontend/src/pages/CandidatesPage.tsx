import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, BellRing, Check, ExternalLink, GitMerge, Loader2, Mail, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Callout, EmptyState, Eyebrow, Field, NativeSelect, PageHeader, StatusBadge, Tag, UserChips } from '@/components/common'
import { SourceEmailDialog } from '@/components/SourceEmailDialog'
import { api, ApiError } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { useCurrentUser, useProfile } from '@/lib/profile'
import type { MyCandidate, ValidateAction, ValidateRequest } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'pending' | 'all'

export default function CandidatesPage() {
  const user = useCurrentUser()
  const [filter, setFilter] = useState<Filter>('pending')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['my-candidates', user.user_id],
    queryFn: () => api.myCandidates(user.user_id),
  })

  const all = query.data?.candidates ?? []
  const list = filter === 'pending' ? all.filter((c) => c.status === 'pending_validation') : all
  const selected = list.find((c) => c.candidate_id === selectedId) ?? list[0] ?? null

  return (
    <>
      <PageHeader
        title="Kandidat Saya"
        description="Pengetahuan hasil kurasi AI dari email yang Anda kirim. Periksa ringkasan dan data sensitif, lalu setujui, edit, tolak, atau serahkan ke rekan. Hanya kandidat yang disetujui yang masuk ke chatbot."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-8">
          <div className="mb-3 flex gap-5 border-b text-sm">
            {(['pending', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  '-mb-px border-b-2 border-transparent pb-2 text-muted-foreground transition-colors hover:text-foreground',
                  filter === f && 'border-primary font-medium text-foreground',
                )}
              >
                {f === 'pending' ? 'Menunggu' : 'Semua'}
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  {f === 'pending' ? (query.data?.pending_count ?? 0) : all.length}
                </span>
              </button>
            ))}
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : query.isError ? (
            <p className="text-sm text-destructive">{query.error.message}</p>
          ) : list.length === 0 ? (
            <EmptyState title={filter === 'pending' ? 'Tidak ada yang menunggu' : 'Belum ada kandidat'}>
              Kandidat muncul di sini setelah email yang Anda kirim selesai dikurasi.{' '}
              <Link to="/ingest" className="text-primary underline underline-offset-2">
                Ingest email
              </Link>
            </EmptyState>
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-card lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
              {list.map((c) => {
                const active = selected?.candidate_id === c.candidate_id
                return (
                  <li key={c.candidate_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.candidate_id)}
                      aria-current={active}
                      className={cn(
                        'relative block w-full px-3.5 py-3 text-left transition-colors hover:bg-muted/60',
                        active && 'bg-accent/60 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary hover:bg-accent/60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StatusBadge status={c.status} />
                        <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(c.created_at)}</span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm leading-snug font-medium">{c.title || c.source_id}</div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{c.project_name || 'Tanpa proyek'}</span>
                        {c.is_update && <Tag>Pembaruan</Tag>}
                        {c.has_sensitive_data && <Tag tone="bad">Sensitif</Tag>}
                        {c.nudges.length > 0 && c.status === 'pending_validation' && (
                          <span className="inline-flex items-center gap-1 text-foreground/80">
                            <BellRing className="size-3 text-warn" /> {c.nudges.length}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="min-w-0">
          {selected && (
            <CandidateDetail key={selected.candidate_id} candidate={selected} newMessageIds={newThreadMessages(selected, all)} />
          )}
        </div>
      </div>
    </>
  )
}

// Messages in this candidate's thread that the previous candidate from the same thread did not have
// (thread continuation, e.g. s5 -> s5b). Undefined when there is no earlier version to compare with.
function newThreadMessages(c: MyCandidate, all: MyCandidate[]): Set<string> | undefined {
  if (!c.source_email) return undefined
  const previous = all
    .filter((o) => o.source_id === c.source_id && o.candidate_id !== c.candidate_id && o.source_email && o.created_at < c.created_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  if (!previous?.source_email) return undefined
  const seen = new Set(previous.source_email.messages.map((m) => m.message_id))
  return new Set(c.source_email.messages.map((m) => m.message_id).filter((id) => !seen.has(id)))
}

// ---------------------------------------------------------------------------

const DETAIL_LABELS: Record<string, string> = {
  tracking_specifications: 'Spesifikasi tracking',
  requirements: 'Requirement',
  test_cases: 'Test case',
  test_scenarios: 'Skenario uji',
  design_references: 'Referensi desain',
  git_references: 'Referensi Git',
  implementation_notes: 'Catatan implementasi',
  raw_structured_evidence: 'Data terstruktur lainnya',
}

function isEmpty(v: unknown): boolean {
  if (v == null) return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v).length === 0
  return v === ''
}

interface NormalizedSource {
  id: string
  refNumber: number
  name: string
  sourceType: string
  url?: string
}

function resolveCandidateSources(c: MyCandidate): {
  sourceMap: Map<string, number>
  references: NormalizedSource[]
} {
  const map = new Map<string, number>()
  const list: NormalizedSource[] = []

  const register = (id: string, name?: string, sourceType?: string, url?: string) => {
    if (!id || map.has(id)) return
    const num = list.length + 1
    map.set(id, num)

    let finalUrl = url
    if (!finalUrl) {
      if (id.startsWith('gdoc:')) {
        finalUrl = `https://docs.google.com/document/d/${id.replace(/^gdoc:/, '')}`
      } else if (id.startsWith('gsheet:')) {
        finalUrl = `https://docs.google.com/spreadsheets/d/${id.replace(/^gsheet:/, '')}`
      } else if (id.startsWith('gslide:')) {
        finalUrl = `https://docs.google.com/presentation/d/${id.replace(/^gslide:/, '')}`
      } else if (id.startsWith('gpdf:')) {
        finalUrl = `https://drive.google.com/file/d/${id.replace(/^gpdf:/, '')}/view`
      } else if (id.startsWith('gfolder:')) {
        finalUrl = `https://drive.google.com/drive/folders/${id.replace(/^gfolder:/, '')}`
      } else if (id.startsWith('http://') || id.startsWith('https://')) {
        finalUrl = id
      }
    }

    list.push({
      id,
      refNumber: num,
      name: name || (id.startsWith('EMAIL-') ? `Email Thread (${id})` : id),
      sourceType:
        sourceType ||
        (id.startsWith('EMAIL-')
          ? 'email_thread'
          : id.startsWith('gdoc:')
            ? 'document'
            : id.startsWith('gsheet:')
              ? 'spreadsheet'
              : id.startsWith('gfolder:')
                ? 'folder'
                : 'document'),
      url: finalUrl,
    })
  }

  for (const s of c.sources || []) {
    register(s.source_id, s.name, s.source_type, s.url)
  }

  if (c.source_id && !map.has(c.source_id)) {
    register(c.source_id, c.title || c.source_id, 'email_thread')
  }

  for (const f of c.facts || []) {
    for (const src of f.source || []) {
      register(src)
    }
  }

  for (const conf of c.conflicts || []) {
    for (const src of conf.sources || []) {
      register(src)
    }
  }

  return { sourceMap: map, references: list }
}

function CandidateDetail({ candidate: c, newMessageIds }: { candidate: MyCandidate; newMessageIds?: Set<string> }) {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<ValidateAction | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const pending = c.status === 'pending_validation'

  const validate = useMutation({
    mutationFn: (body: Omit<ValidateRequest, 'candidate_id' | 'user_id'>) =>
      api.validate({ candidate_id: c.candidate_id, user_id: user.user_id, ...body }),
    onSuccess: (res, body) => {
      setDialog(null)
      if (body.action === 'handover') toast.success(`Kandidat diserahkan ke ${res.new_owner}.`)
      else if (body.action === 'reject') toast.success('Kandidat ditolak.')
      else
        toast.success('Disetujui dan disimpan ke basis pengetahuan.', {
          description: `${res.chunks_written ?? 0} chunk ditulis${res.superseded_candidates?.length ? `, menggantikan ${res.superseded_candidates.join(', ')}` : ''}.`,
        })
      queryClient.invalidateQueries({ queryKey: ['my-candidates'] })
      queryClient.invalidateQueries({ queryKey: ['lead-summary'] })
    },
    onError: (err) => {
      toast.error(err.message)
      if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
        setDialog(null)
        queryClient.invalidateQueries({ queryKey: ['my-candidates'] })
      }
    },
  })

  const details = Object.entries(c.structured_details || {}).filter(([, v]) => !isEmpty(v))
  const { sourceMap, references } = resolveCandidateSources(c)

  const refLinks = (ids: string[] | undefined) => {
    const refs = Array.from(new Set((ids || []).map((x) => sourceMap.get(x)).filter(Boolean) as number[])).sort((x, y) => x - y)
    if (!refs.length) return null
    return (
      <sup className="ml-0.5 font-mono text-[10px] font-medium">
        {refs.map((r, i) => (
          <span key={r}>
            {i > 0 && ','}
            <a href={`#ref-${c.candidate_id}-${r}`} className="text-primary hover:underline" title={`Sumber [${r}]`}>
              {r}
            </a>
          </span>
        ))}
      </sup>
    )
  }

  return (
    <article className="rounded-lg border bg-card">
      <header className="px-6 pt-6 pb-5 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusBadge status={c.status} />
          {c.is_update && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <GitMerge className="size-3.5" /> Memperbarui pengetahuan yang sudah ada
            </span>
          )}
          {c.knowledge_type && <Tag tone="accent">{c.knowledge_type}</Tag>}
        </div>
        <h2 className="mt-3 font-serif text-2xl leading-snug font-semibold tracking-[-0.005em] text-balance">
          {c.title || '(tanpa judul)'}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-mono text-[11px] text-muted-foreground">
            {c.candidate_id} · sumber {c.source_id}
          </p>
          <Button variant="outline" size="xs" onClick={() => setEmailOpen(true)}>
            <Mail /> Lihat email asli
          </Button>
        </div>
      </header>

      <div className="space-y-7 px-6 pb-7 sm:px-8">
        {c.nudges.length > 0 && pending && (
          <Callout tone="warn" icon={<BellRing />} title="Pengingat dari supervisor">
            <ul className="space-y-1">
              {c.nudges.map((n, i) => (
                <li key={i}>
                  <span className="font-mono text-xs">{n.from}</span> &ldquo;{n.message}&rdquo;{' '}
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.at)}</span>
                </li>
              ))}
            </ul>
          </Callout>
        )}

        {c.has_sensitive_data && (
          <Callout tone="bad" icon={<ShieldAlert />} title="Data sensitif terdeteksi dan sudah dimasking">
            <p className="mb-2">Pastikan tidak ada nilai asli yang tersisa di ringkasan, fakta, maupun detail sebelum menyetujui.</p>
            <ul className="space-y-0.5 text-xs">
              {c.sensitive_details.map((s, i) => (
                <li key={i}>
                  <span className="font-medium">{s.category}</span> <span className="text-muted-foreground">di {s.location}</span>{' '}
                  <code className="rounded-sm bg-card px-1 font-mono">{s.masked_value}</code>
                </li>
              ))}
            </ul>
          </Callout>
        )}

        {c.error_message && c.status !== 'pending_validation' && (
          <p className="text-sm text-muted-foreground">{c.error_message}</p>
        )}

        <p className="font-serif text-[1.06rem] leading-[1.7] text-foreground/90">{c.summary}</p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y py-4 sm:grid-cols-4">
          <Field label="Tanggal efektif">{formatDate(c.effective_date)}</Field>
          <Field label="Proyek">{c.project_name || '-'}</Field>
          <Field label="Produk / kanal">{c.product_or_channel || '-'}</Field>
          <Field label="Keyakinan AI">
            {c.confidence != null ? <ConfidenceMeter value={c.confidence} /> : '-'}
          </Field>
        </dl>

        {c.facts.length > 0 && (
          <section>
            <Eyebrow className="mb-2.5">Fakta terverifikasi</Eyebrow>
            <ol className="space-y-2 text-sm">
              {c.facts.map((f, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_1fr] leading-relaxed">
                  <span className="pt-px font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    {f.fact}
                    {refLinks(f.source)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {c.conditions.length > 0 && (
          <section>
            <Eyebrow className="mb-2.5">Kondisi</Eyebrow>
            <ul className="space-y-1.5 text-sm">
              {c.conditions.map((x, i) => (
                <li key={i} className="grid grid-cols-[1.5rem_1fr] leading-relaxed">
                  <span className="text-muted-foreground">–</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {c.conflicts.length > 0 && (
          <Callout tone="warn" icon={<AlertTriangle />} title="Konflik antarsumber">
            <ul className="space-y-1">
              {c.conflicts.map((x, i) => (
                <li key={i}>
                  {x.conflict}
                  {refLinks(x.sources)}
                </li>
              ))}
            </ul>
          </Callout>
        )}

        <section>
          <div className="mb-2.5 flex items-baseline justify-between gap-2">
            <Eyebrow>Akses di chatbot</Eyebrow>
            <span className="text-xs text-muted-foreground">{c.access_users.length} orang</span>
          </div>
          <UserChips ids={c.access_users} highlight={user.user_id} />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Dihitung dari pengirim, penerima, dan cc email. Alamat tim mencakup seluruh anggotanya, dan SPV tim yang terlibat selalu ikut.
          </p>
        </section>

        {details.length > 0 && (
          <section>
            <Eyebrow className="mb-1">Detail terstruktur</Eyebrow>
            <Accordion>
              {details.map(([key, value]) => (
                <AccordionItem key={key} value={key}>
                  <AccordionTrigger>
                    <span>
                      {DETAIL_LABELS[key] ?? key}
                      {Array.isArray(value) && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{value.length}</span>}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <DetailValue value={value} />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {references.length > 0 && (
          <section className="border-t pt-5">
            <Eyebrow className="mb-3">Sumber</Eyebrow>
            <ol className="space-y-2.5 text-xs">
              {references.map((ref) => {
                const typeLabel = ref.sourceType.includes('email')
                  ? 'Email'
                  : ref.id.startsWith('gfolder:') || ref.sourceType.includes('folder')
                    ? 'Folder Google Drive'
                    : ref.id.startsWith('gpdf:')
                      ? 'PDF (Google Drive)'
                      : ref.id.startsWith('gslide:')
                        ? 'Google Slides'
                      : ref.id.startsWith('gsheet:')
                        ? 'Google Sheets'
                        : ref.id.startsWith('gdoc:')
                          ? 'Google Docs'
                          : ref.sourceType.includes('spreadsheet')
                            ? 'Spreadsheet'
                            : ref.sourceType.includes('document')
                              ? 'Dokumen'
                              : ref.sourceType

                return (
                  <li
                    key={ref.id}
                    id={`ref-${c.candidate_id}-${ref.refNumber}`}
                    className="grid scroll-mt-24 grid-cols-[1.5rem_1fr] rounded-sm target:bg-warn/15"
                  >
                    <span className="font-mono text-muted-foreground">[{ref.refNumber}]</span>
                    <div>
                      <span className="text-sm text-foreground">{ref.name}</span>
                      <span className="text-muted-foreground">
                        {' '}· {typeLabel}
                      </span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted-foreground">
                        <span className="break-all">{ref.id}</span>
                        {ref.id === c.source_id && (
                          <button type="button" onClick={() => setEmailOpen(true)} className="inline-flex items-center gap-1 text-primary hover:underline">
                            lihat email <Mail className="size-3" />
                          </button>
                        )}
                        {ref.url && (
                          <a href={ref.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            buka <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </div>

      {pending && (
        <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-b-lg border-t bg-card/95 px-6 py-3 backdrop-blur sm:px-8">
          <Button onClick={() => validate.mutate({ action: 'approve' })} disabled={validate.isPending}>
            {validate.isPending && validate.variables?.action === 'approve' ? <Loader2 className="animate-spin" /> : <Check />}
            Approve
          </Button>
          {c.is_update && (
            <Button
              variant="outline"
              onClick={() => validate.mutate({ action: 'approve_as_new' })}
              disabled={validate.isPending}
              title="Setujui sebagai pengetahuan baru (tidak menimpa versi sebelumnya)"
            >
              {validate.isPending && validate.variables?.action === 'approve_as_new' && <Loader2 className="animate-spin" />}
              Approve as new
            </Button>
          )}
          <Button variant="outline" onClick={() => setDialog('edit_approve')} disabled={validate.isPending}>
            Edit & approve
          </Button>
          <Button variant="ghost" onClick={() => setDialog('handover')} disabled={validate.isPending}>
            Handover
          </Button>
          <Button variant="ghost" onClick={() => setDialog('reject')} disabled={validate.isPending} className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto">
            Reject
          </Button>
        </footer>
      )}

      <EditApproveDialog
        open={dialog === 'edit_approve'}
        candidate={c}
        busy={validate.isPending}
        onClose={() => setDialog(null)}
        onSubmit={(patched_fields, notes) => validate.mutate({ action: 'edit_approve', patched_fields, notes })}
      />
      <RejectDialog
        open={dialog === 'reject'}
        busy={validate.isPending}
        onClose={() => setDialog(null)}
        onSubmit={(notes) => validate.mutate({ action: 'reject', notes })}
      />
      <HandoverDialog
        open={dialog === 'handover'}
        busy={validate.isPending}
        onClose={() => setDialog(null)}
        onSubmit={(handover_to, notes) => validate.mutate({ action: 'handover', handover_to, notes })}
      />
      <SourceEmailDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        sourceId={c.source_id}
        email={c.source_email}
        newMessageIds={newMessageIds}
      />
    </article>
  )
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono tabular-nums">{pct}%</span>
      <span className="h-1 w-14 overflow-hidden rounded-full bg-muted">
        <span className={cn('block h-full', pct >= 70 ? 'bg-ok' : pct >= 40 ? 'bg-warn' : 'bg-destructive')} style={{ width: `${pct}%` }} />
      </span>
    </span>
  )
}

function DetailValue({ value }: { value: unknown }) {
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return (
      <ul className="space-y-1 font-mono text-xs [&>li]:border-l-2 [&>li]:pl-2">
        {value.map((v, i) => (
          <li key={i}>{String(v)}</li>
        ))}
      </ul>
    )
  }
  return (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Action dialogs

function EditApproveDialog({
  open,
  candidate,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  candidate: MyCandidate
  busy: boolean
  onClose: () => void
  onSubmit: (patched: { title?: string; summary?: string; effective_date?: string }, notes: string) => void
}) {
  const [title, setTitle] = useState(candidate.title ?? '')
  const [summary, setSummary] = useState(candidate.summary ?? '')
  const [date, setDate] = useState(candidate.effective_date ?? '')
  const [notes, setNotes] = useState('')

  const patched: { title?: string; summary?: string; effective_date?: string } = {}
  if (title.trim() && title.trim() !== candidate.title) patched.title = title.trim()
  if (summary.trim() && summary.trim() !== candidate.summary) patched.summary = summary.trim()
  if (date && date !== candidate.effective_date) patched.effective_date = date
  const changed = Object.keys(patched).length > 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit & approve</DialogTitle>
          <DialogDescription>Perbaiki judul, ringkasan, atau tanggal efektif. Perubahan "dari → ke" dicatat di log audit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ed-title">Judul</Label>
            <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-summary">Ringkasan</Label>
            <Textarea id="ed-summary" value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-32" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-date">Tanggal efektif</Label>
            <Input id="ed-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-notes">Catatan (opsional)</Label>
            <Input id="ed-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => onSubmit(patched, notes)} disabled={!changed || busy}>
            {busy && <Loader2 className="animate-spin" />} Simpan & approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectDialog({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (notes: string) => void }) {
  const [notes, setNotes] = useState('')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tolak kandidat</DialogTitle>
          <DialogDescription>Alasan wajib diisi dan tersimpan di log audit.</DialogDescription>
        </DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="mis. Informasi sudah tidak berlaku." />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button variant="destructive" onClick={() => onSubmit(notes.trim())} disabled={!notes.trim() || busy}>
            {busy && <Loader2 className="animate-spin" />} Tolak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HandoverDialog({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onSubmit: (to: string, notes: string) => void
}) {
  const { users, user } = useProfile()
  const options = users.filter((u) => u.user_id !== user?.user_id)
  const [to, setTo] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Serahkan validasi</DialogTitle>
          <DialogDescription>
            Pemilik baru yang akan memvalidasi. Anda langsung kehilangan hak validasi atas kandidat ini. Daftar akses chatbot tidak berubah.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <NativeSelect value={to} onChange={(e) => setTo(e.target.value)} className="w-full font-mono">
            <option value="">Pilih pengguna...</option>
            {options.map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.user_id} ({u.display_label})
              </option>
            ))}
          </NativeSelect>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional), mis. sedang cuti" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => onSubmit(to, notes.trim())} disabled={!to || busy}>
            {busy && <Loader2 className="animate-spin" />} Serahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
