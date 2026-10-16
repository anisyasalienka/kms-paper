import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BellRing, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, Eyebrow, PageHeader, SectionTitle } from '@/components/common'
import { api } from '@/lib/api'
import { ACTION_LABEL, formatDateTime } from '@/lib/format'
import { useCurrentUser } from '@/lib/profile'
import type { LeadSummary, PendingItem } from '@/lib/types'
import { cn } from '@/lib/utils'

const KPIS: { key: keyof LeadSummary['metrics']; label: string; dot: string }[] = [
  { key: 'approved', label: 'Disetujui', dot: 'bg-ok' },
  { key: 'pending', label: 'Menunggu', dot: 'bg-warn' },
  { key: 'rejected', label: 'Ditolak', dot: 'bg-destructive' },
  { key: 'superseded', label: 'Digantikan', dot: 'bg-muted-foreground/50' },
  { key: 'failed', label: 'Gagal', dot: 'bg-destructive' },
  { key: 'skipped', label: 'Bukan pengetahuan', dot: 'bg-muted-foreground/50' },
]

const toChart = (rec: Record<string, number>) =>
  Object.entries(rec)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

export default function MonitoringPage() {
  const user = useCurrentUser()
  const [nudgeTarget, setNudgeTarget] = useState<PendingItem | null>(null)

  const query = useQuery({
    queryKey: ['lead-summary', user.user_id],
    queryFn: () => api.leadSummary(user.user_id),
  })
  const d = query.data

  return (
    <>
      <PageHeader
        title={`Monitoring ${d?.team ?? user.team}`}
        description="Ringkasan tata kelola pengetahuan untuk tim Anda, ditambah kandidat lintas tim yang melibatkan Anda. Kirim nudge ke owner yang belum memvalidasi."
        action={
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={cn(query.isFetching && 'animate-spin')} /> Muat ulang
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-24" />
      ) : query.isError ? (
        <p className="text-sm text-destructive">{query.error.message}</p>
      ) : d ? (
        <div className="space-y-12">
          <dl className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card sm:grid-cols-3 lg:grid-cols-6">
            {KPIS.map((k, i) => (
              <div
                key={k.key}
                className={cn(
                  // Hairlines between cells for 2, 3 and 6 columns.
                  'border-border px-4 py-4 lg:border-t-0',
                  i >= 2 && 'border-t',
                  i >= 3 ? 'sm:border-t' : 'sm:border-t-0',
                  i % 2 === 1 && 'border-l',
                  i % 3 !== 0 ? 'sm:border-l' : 'sm:border-l-0',
                  i > 0 && 'lg:border-l',
                )}
              >
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', k.dot)} />
                  {k.label}
                </dt>
                <dd className={cn('mt-1.5 font-serif text-3xl leading-none font-semibold tabular-nums', d.metrics[k.key] === 0 && 'text-muted-foreground/60')}>
                  {d.metrics[k.key]}
                </dd>
              </div>
            ))}
          </dl>

          <section>
            <SectionTitle
              title="Antrean validasi"
              description="Kandidat yang belum divalidasi. Yang sudah menunggu 3 hari atau lebih ditandai sebagai bottleneck."
            />
            {d.pending.length === 0 ? (
              <EmptyState title="Tidak ada antrean">Semua kandidat di cakupan Anda sudah ditangani.</EmptyState>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="pl-4">Judul</TableHead>
                      <TableHead>Kanal</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Umur</TableHead>
                      <TableHead className="pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.pending.map((p) => {
                      const stale = p.days_pending >= 3
                      return (
                        <TableRow key={p.candidate_id}>
                          <TableCell className={cn('max-w-xs border-l-2 border-transparent pl-4 whitespace-normal', stale && 'border-warn')}>
                            <div className="font-medium">{p.title || p.candidate_id}</div>
                            <div className="font-mono text-[11px] text-muted-foreground">{p.candidate_id}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.product_or_channel || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.owner_pic}
                            {p.owner_team !== d.team && <span className="ml-1 text-muted-foreground">({p.owner_team})</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn('font-mono text-xs tabular-nums', stale && 'rounded-sm bg-warn/20 px-1.5 py-0.5 font-medium')}>
                              {p.days_pending} hari
                            </span>
                          </TableCell>
                          <TableCell className="pr-4 text-right">
                            <Button size="xs" variant="outline" onClick={() => setNudgeTarget(p)}>
                              Nudge
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section>
            <SectionTitle title="Distribusi" />
            <div className="grid gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-3">
              <ChartPanel title="Pending per owner" data={toChart(d.pending_by_owner)} empty="Tidak ada pending." />
              <ChartPanel title="Pengetahuan per kanal" data={toChart(d.distribution_by_channel)} empty="Belum ada yang disetujui." />
              <ChartPanel title="Pengetahuan per tipe" data={toChart(d.distribution_by_type)} empty="Belum ada yang disetujui." />
            </div>
          </section>

          <section>
            <SectionTitle title="Log audit terbaru" description="15 aksi validasi terakhir dalam cakupan Anda." />
            {d.recent_logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
            ) : (
              <ol className="divide-y rounded-lg border bg-card">
                {d.recent_logs.map((l, i) => (
                  <li key={i} className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 text-sm sm:grid-cols-[7.5rem_7rem_minmax(0,1fr)]">
                    <span className="font-mono text-xs whitespace-nowrap text-muted-foreground sm:pt-0.5">{formatDateTime(l.at)}</span>
                    <span>
                      <span className="font-medium">{ACTION_LABEL[l.action] ?? l.action}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{l.actor}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{l.title || l.candidate_id}</span>
                      {l.notes && <span className="block truncate text-xs text-muted-foreground">&ldquo;{l.notes}&rdquo;</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}

      <NudgeDialog target={nudgeTarget} onClose={() => setNudgeTarget(null)} />
    </>
  )
}

function ChartPanel({ title, data, empty }: { title: string; data: { name: string; value: number }[]; empty: string }) {
  return (
    <div className="bg-card p-4 text-primary">
      <Eyebrow className="mb-3">{title}</Eyebrow>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 28, top: 0, bottom: 0 }} barCategoryGap={8}>
            <XAxis type="number" allowDecimals={false} domain={[0, 'dataMax']} hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
            />
            <Bar dataKey="value" name="Jumlah" fill="currentColor" radius={[0, 2, 2, 0]} maxBarSize={18} isAnimationActive={false}>
              <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: 'var(--foreground)', fontFamily: 'var(--font-mono)' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function NudgeDialog({ target, onClose }: { target: PendingItem | null; onClose: () => void }) {
  const user = useCurrentUser()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const nudge = useMutation({
    mutationFn: () => api.nudge(target!.candidate_id, user.user_id, message.trim()),
    onSuccess: (res) => {
      toast.success(`Nudge terkirim ke ${res.nudged}.`)
      setMessage('')
      onClose()
      queryClient.invalidateQueries({ queryKey: ['lead-summary'] })
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nudge {target?.owner_pic}</DialogTitle>
          <DialogDescription>
            Pengingat tampil di antrean Kandidat Saya milik owner dan dicatat di log audit. Tidak ada email yang dikirim.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">{target?.title}</p>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mohon segera divalidasi." />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => nudge.mutate()} disabled={nudge.isPending}>
            {nudge.isPending ? <Loader2 className="animate-spin" /> : <BellRing />} Kirim nudge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
