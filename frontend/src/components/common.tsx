import type { ReactNode } from 'react'
import { STATUS_LABEL, STATUS_TONE, type Tone } from '@/lib/format'
import type { CandidateStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const DOT: Record<Tone, string> = {
  warn: 'bg-warn',
  ok: 'bg-ok',
  bad: 'bg-destructive',
  info: 'bg-info',
  muted: 'bg-muted-foreground/50',
  accent: 'bg-primary',
}

export function StatusBadge({ status, className }: { status: CandidateStatus; className?: string }) {
  const tone = STATUS_TONE[status] ?? 'muted'
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-foreground/80', className)}>
      <span className={cn('size-1.5 rounded-full', DOT[tone], (status === 'processing' || status === 'approving') && 'animate-pulse')} />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// Small uppercase marker, used next to a status for flags like "Sensitif".
export function Tag({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'bad' | 'accent' }) {
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center rounded-sm border px-1.5 text-[10px] font-semibold tracking-[0.06em] uppercase',
        tone === 'muted' && 'border-border text-muted-foreground',
        tone === 'bad' && 'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'accent' && 'border-primary/30 bg-accent text-accent-foreground',
      )}
    >
      {children}
    </span>
  )
}

export function UserChips({ ids, highlight }: { ids: string[]; highlight?: string }) {
  if (!ids.length) return <span className="text-sm text-muted-foreground">-</span>
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span
          key={id}
          className={cn(
            'rounded-sm border px-1.5 py-px font-mono text-[11px]',
            id === highlight ? 'border-primary/40 bg-accent font-medium text-accent-foreground' : 'bg-card text-foreground/80',
          )}
          title={id === highlight ? 'Anda' : undefined}
        >
          {id}
        </span>
      ))}
    </div>
  )
}

export function PageHeader({ title, description, action }: { title: string; description: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <h1 className="font-serif text-[1.9rem] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </header>
  )
}

export function SectionTitle({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="font-serif text-lg leading-snug font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase', className)}>{children}</div>
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>
        <Eyebrow>{label}</Eyebrow>
      </dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

// Left-ruled note for warnings and reminders; quieter than a full alert box.
export function Callout({
  tone,
  title,
  icon,
  children,
}: {
  tone: 'warn' | 'bad' | 'info'
  title: ReactNode
  icon?: ReactNode
  children?: ReactNode
}) {
  return (
    <div
      role={tone === 'bad' ? 'alert' : undefined}
      className={cn(
        'rounded-r-md border-l-2 py-2.5 pr-3 pl-3.5 text-sm',
        tone === 'warn' && 'border-warn bg-warn/8',
        tone === 'bad' && 'border-destructive bg-destructive/6',
        tone === 'info' && 'border-info bg-info/8',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 font-medium [&_svg]:size-4',
          tone === 'bad' && 'text-destructive',
          tone === 'warn' && '[&_svg]:text-warn',
        )}
      >
        {icon}
        {title}
      </div>
      {children && <div className="mt-1.5 text-foreground/80">{children}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="font-serif text-base font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}

export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
