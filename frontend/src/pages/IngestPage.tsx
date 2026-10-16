import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, RefreshCw, Reply, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect, PageHeader, SectionTitle, StatusBadge, UserChips } from '@/components/common'
import { api, ApiError } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/format'
import { useIngestHistory, type IngestEntry } from '@/lib/ingestHistory'
import { useCurrentUser, useProfile } from '@/lib/profile'
import { SAMPLES } from '@/lib/samples'
import type { EmailMessage, EmailPayload } from '@/lib/types'
import { cn } from '@/lib/utils'

const TAB = 'flex-none px-0 pb-2.5 after:bottom-[-1px]! after:bg-primary!'

const POLL_MS = 4000
// Curation usually takes 1-5 minutes. The backend marks a row failed after 10 minutes.
const UI_TIMEOUT_MS = 8 * 60 * 1000

export default function IngestPage() {
  const user = useCurrentUser()
  const history = useIngestHistory(user.user_id)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<string>('form')
  const [raw, setRaw] = useState('')
  // Bumped after a successful send so the form starts empty again.
  const [formKey, setFormKey] = useState(0)

  const ingest = useMutation({
    mutationFn: (email: EmailPayload) => api.ingest(user.user_id, email),
    onSuccess: (res, email) => {
      if (!res.candidate_id) {
        toast.error(res.error || 'Email ditolak server.')
        return
      }
      history.add({
        candidate_id: res.candidate_id,
        subject: email.subject || res.candidate_id,
        submitted_by: user.user_id,
        at: new Date().toISOString(),
      })
      queryClient.invalidateQueries({ queryKey: ['candidate-status', res.candidate_id] })
      setFormKey((k) => k + 1)
      if (res.status === 'processing') toast.success('Email diterima. AI sedang mengkurasi.')
      else toast.info(`Email diterima dengan status ${res.status}.`)
    },
    onError: (err) => toast.error(err.message),
  })

  const submitRaw = () => {
    let parsed: EmailPayload
    try {
      parsed = JSON.parse(raw)
    } catch (e) {
      toast.error('JSON tidak valid: ' + (e as Error).message)
      return
    }
    if (!parsed?.source_id || !Array.isArray(parsed.messages) || !parsed.messages.length) {
      toast.error('JSON harus memiliki "source_id" dan array "messages" berisi minimal satu pesan.')
      return
    }
    ingest.mutate(parsed)
  }

  return (
    <>
      <PageHeader
        title="Ingest Email"
        description="Kirim thread email ke pipeline AI. Pengirim pesan pertama menjadi pemilik (owner) kandidat dan memvalidasinya di Kandidat Saya. Hak akses chatbot dihitung otomatis dari header pengirim, penerima, dan cc."
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList variant="line" className="mb-5 h-auto! w-full justify-start gap-5 rounded-none border-b p-0">
                <TabsTrigger value="form" className={TAB}>Form</TabsTrigger>
                <TabsTrigger value="raw" className={TAB}>Raw JSON</TabsTrigger>
                <TabsTrigger value="samples" className={TAB}>Contoh skenario</TabsTrigger>
              </TabsList>

              <TabsContent value="form">
                <EmailForm key={formKey} submitting={ingest.isPending} onSubmit={(email) => ingest.mutate(email)} onShowJson={(email) => {
                  setRaw(JSON.stringify(email, null, 2))
                  setTab('raw')
                }} />
              </TabsContent>

              <TabsContent value="raw" className="space-y-3">
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder='{ "source_id": "...", "subject": "...", "messages": [ { "from": "...", "to": [], "cc": [], "body": "..." } ] }'
                  className="min-h-[420px] bg-card font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                <div className="flex justify-end">
                  <Button onClick={submitRaw} disabled={!raw.trim() || ingest.isPending}>
                    {ingest.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                    Kirim ke pipeline
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="samples">
                <p className="mb-3 text-sm text-muted-foreground">
                  Email dummy dari <code className="font-mono text-xs">dummy-emails/</code>. Pilih untuk membukanya di tab Raw JSON, lalu kirim.
                </p>
                <div className="divide-y rounded-lg border bg-card">
                  {SAMPLES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        setRaw(JSON.stringify(s.email, null, 2))
                        setTab('raw')
                      }}
                      className="group grid w-full grid-cols-[2rem_1fr_auto] items-baseline px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{s.key}</span>
                      <div>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Pengirim <span className="font-mono">{s.email.messages[0].from}</span>. Ekspektasi
                        akses: {s.expected}
                      </div>
                      </div>
                      <span className="text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">Buka →</span>
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
        </div>

        <aside className="lg:sticky lg:top-8">
          <SectionTitle title="Riwayat kiriman" description="Status kurasi diperbarui otomatis." />
          {history.entries.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Belum ada email yang Anda kirim dari browser ini.
            </p>
          ) : (
            <ol className="divide-y rounded-lg border bg-card">
              {history.entries.map((e) => (
                <IngestTracker key={e.candidate_id} entry={e} onRemove={() => history.remove(e.candidate_id)} />
              ))}
            </ol>
          )}
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Form builder

interface DraftMessage extends Omit<EmailMessage, 'message_id' | 'subject' | 'attachments'> {
  key: number
}

const today = () => new Date().toISOString().slice(0, 10)

function EmailForm({
  submitting,
  onSubmit,
  onShowJson,
}: {
  submitting: boolean
  onSubmit: (email: EmailPayload) => void
  onShowJson: (email: EmailPayload) => void
}) {
  const user = useCurrentUser()
  const [subject, setSubject] = useState('')
  const [messages, setMessages] = useState<DraftMessage[]>([
    { key: 1, from: user.user_id, to: [], cc: [], date: today(), body: '' },
  ])

  useEffect(() => {
    setMessages((ms) => ms.map((m, i) => (i === 0 ? { ...m, from: user.user_id } : m)))
  }, [user.user_id])

  const update = (key: number, patch: Partial<DraftMessage>) =>
    setMessages((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)))

  const build = (): EmailPayload => {
    const stamp = Date.now().toString(36).toUpperCase()
    const sourceId = 'EMAIL-' + stamp
    const trimmedSubject = subject.trim()
    return {
      source_id: sourceId,
      subject: trimmedSubject,
      messages: messages.map((m, i) => ({
        message_id: `${sourceId}-M${String(i + 1).padStart(2, '0')}`,
        date: m.date,
        from: m.from,
        to: m.to,
        cc: m.cc,
        subject: i === 0 ? trimmedSubject : 'Re: ' + trimmedSubject,
        body: m.body.trim(),
        attachments: [],
      })),
    }
  }

  const problems = [
    !subject.trim() && 'subjek',
    messages.some((m) => !m.body.trim()) && 'isi setiap pesan',
    messages.some((m) => !m.to.length) && 'minimal satu penerima per pesan',
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="subject">Subjek thread</Label>
        <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="mis. Keputusan nama event tracking" />
      </div>

      {messages.map((m, i) => (
        <div key={m.key} className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {i === 0 ? 'Pesan pertama' : `Balasan ${i}`}
              {i === 0 && <span className="ml-2 font-normal tracking-normal normal-case">pengirimnya menjadi owner</span>}
            </span>
            {messages.length > 1 && (
              <Button variant="ghost" size="icon-xs" onClick={() => setMessages((ms) => ms.filter((x) => x.key !== m.key))} aria-label="Hapus pesan">
                <X />
              </Button>
            )}
          </div>
          <div className="divide-y text-sm">
            <HeaderRow label="Dari">
              {i === 0 ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{user.user_id}</span>
                  <span className="text-xs text-muted-foreground">{user.display_label} · akun login</span>
                </span>
              ) : (
                <SenderSelect value={m.from} onChange={(from) => update(m.key, { from })} />
              )}
            </HeaderRow>
            <HeaderRow label="Kepada">
              <AddressPicker value={m.to} exclude={m.from} onChange={(to) => update(m.key, { to })} />
            </HeaderRow>
            <HeaderRow label="Cc">
              <AddressPicker value={m.cc} exclude={m.from} onChange={(cc) => update(m.key, { cc })} />
            </HeaderRow>
            <HeaderRow label="Tanggal">
              <Input type="date" value={m.date} onChange={(e) => update(m.key, { date: e.target.value })} className="h-7 w-auto" />
            </HeaderRow>
          </div>
          <Textarea
            value={m.body}
            onChange={(e) => update(m.key, { body: e.target.value })}
            className="min-h-32 rounded-none border-0 border-t bg-transparent px-4 py-3 leading-relaxed focus-visible:ring-0 dark:bg-transparent"
            placeholder="Tulis isi email..."
            aria-label={`Isi pesan ${i + 1}`}
          />
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setMessages((ms) => [
              ...ms,
              { key: Date.now(), from: ms[ms.length - 1].to[0] || user.user_id, to: [ms[ms.length - 1].from], cc: ms[ms.length - 1].cc, date: today(), body: '' },
            ])
          }
        >
          <Reply /> Tambah balasan
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => onShowJson(build())}>
            Lihat JSON
          </Button>
          <Button onClick={() => onSubmit(build())} disabled={problems.length > 0 || submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            Kirim ke pipeline
          </Button>
        </div>
      </div>
      {problems.length > 0 && <p className="text-right text-xs text-muted-foreground">Lengkapi: {problems.join(', ')}.</p>}
    </div>
  )
}

function HeaderRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 px-4 py-2">
      <span className="pt-1 text-xs text-muted-foreground">{label}</span>
      <div className="min-h-7 pt-0.5">{children}</div>
    </div>
  )
}

function SenderSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { users } = useProfile()
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value)} className="h-7 font-mono text-xs">
      {users.map((u) => (
        <option key={u.user_id} value={u.user_id}>
          {u.user_id}
        </option>
      ))}
    </NativeSelect>
  )
}

// Toggle list of personal addresses plus one distribution address per team.
function AddressPicker({ value, exclude, onChange }: { value: string[]; exclude: string; onChange: (v: string[]) => void }) {
  const { users } = useProfile()
  const teams = [...new Set(users.map((u) => u.team))]
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  const chip = (id: string, isTeam = false) => (
    <button
      key={id}
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={value.includes(id)}
      className={cn(
        'rounded-sm border px-1.5 py-px font-mono text-[11px] transition-colors',
        value.includes(id)
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-foreground/70 hover:border-foreground/30 hover:text-foreground',
        isTeam && !value.includes(id) && 'border-dashed font-medium',
      )}
    >
      {id}
    </button>
  )

  return (
    <div className="space-y-1.5">
      {teams.map((team) => (
        <div key={team} className="flex flex-wrap items-center gap-1">
          {chip(team, true)}
          <span className="mx-0.5 h-3 w-px bg-border" />
          {users.filter((u) => u.team === team && u.user_id !== exclude).map((u) => chip(u.user_id))}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Garis putus-putus = alamat tim (semua anggotanya mendapat akses).</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Polling card

function IngestTracker({ entry, onRemove }: { entry: IngestEntry; onRemove: () => void }) {
  const queryClient = useQueryClient()
  const startedAt = new Date(entry.at).getTime()
  const status = useQuery({
    queryKey: ['candidate-status', entry.candidate_id],
    queryFn: () => api.candidateStatus(entry.candidate_id),
    refetchInterval: (q) =>
      q.state.data?.status === 'processing' && Date.now() - startedAt < UI_TIMEOUT_MS ? POLL_MS : false,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  })

  const data = status.data
  const s = data?.curated_summary

  // Once curation finishes, refresh the owner's queue so the nav badge updates.
  const finished = data && data.status !== 'processing'
  useEffect(() => {
    if (finished) queryClient.invalidateQueries({ queryKey: ['my-candidates'] })
  }, [finished, queryClient])
  const timedOut = data?.status === 'processing' && Date.now() - startedAt >= UI_TIMEOUT_MS
  const elapsedMin = Math.max(0, Math.floor((Date.now() - startedAt) / 60000))

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm leading-snug font-medium">{s?.title || entry.subject}</div>
          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {entry.candidate_id} · {formatDateTime(entry.at)}
          </div>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label="Hapus dari riwayat" title="Hapus dari riwayat" className="-mr-1 text-muted-foreground">
          <X />
        </Button>
      </div>

      <div className="mt-2.5 space-y-2">
        {status.isError ? (
          <p className="flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {status.error.message}
          </p>
        ) : !data ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Memuat status...
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusBadge status={data.status} />
              {data.status === 'processing' && !timedOut && (
                <span className="text-xs text-muted-foreground">
                  {elapsedMin} menit · biasanya 1–5 menit
                </span>
              )}
            </div>

            {data.status === 'processing' && timedOut && (
              <p className="text-xs text-muted-foreground">Masih diproses lebih lama dari biasanya. Cek lagi nanti.</p>
            )}

            {data.status === 'pending_validation' && s && (
              <div className="space-y-2.5">
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{s.summary}</p>
                <dl className="grid grid-cols-2 gap-3">
                  <Field label="Owner">
                    <span className="font-mono text-xs">{s.owner_pic}</span>
                  </Field>
                  <Field label="Tanggal efektif">{formatDate(s.effective_date)}</Field>
                </dl>
                <Field label="Akses">
                  <UserChips ids={s.access_users} />
                </Field>
                <Link to="/kandidat" className="inline-block text-xs font-medium text-primary hover:underline">
                  Validasi di Kandidat Saya →
                </Link>
              </div>
            )}

            {data.status === 'skipped' && (
              <p className="text-xs text-muted-foreground">
                AI menilai email ini bukan pengetahuan organisasi.{data.error_message ? ` ${data.error_message}` : ''}
              </p>
            )}

            {(data.status === 'already_exists' || data.status === 'already_pending') && (
              <p className="text-xs text-muted-foreground">
                Sumber ini sudah {data.status === 'already_exists' ? 'tersimpan di basis pengetahuan' : 'ada di antrean validasi'}
                {data.duplicate_of && (
                  <>
                    {' '}(<span className="font-mono">{data.duplicate_of}</span>)
                  </>
                )}
                .
              </p>
            )}

            {data.status === 'failed' && (
              <p className="text-xs text-destructive">{data.error_message || 'Pipeline gagal.'} Kirim ulang email untuk mencoba lagi.</p>
            )}

            {['approved', 'rejected', 'superseded'].includes(data.status) && s && (
              <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{s.summary}</p>
            )}
          </>
        )}

        {(timedOut || status.isError) && (
          <Button variant="outline" size="xs" onClick={() => status.refetch()}>
            <RefreshCw /> Cek lagi
          </Button>
        )}
      </div>
    </li>
  )
}
