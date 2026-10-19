import { Fragment } from 'react'
import { Paperclip, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Callout, Tag } from '@/components/common'
import { formatDate, formatDateTime } from '@/lib/format'
import type { EmailPayload } from '@/lib/types'

// Same tag format as redact_sensitive_data, e.g. [KREDENSIAL: Vpn#****].
const REDACTION_RE = /(\[(?:KREDENSIAL|DATA_PRIBADI): [^\]\n]{1,80}\])/g

function RedactedText({ text }: { text: string }) {
  return (
    <>
      {text.split(REDACTION_RE).map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            title="Disamarkan otomatis sebelum diproses AI"
            className="rounded-sm bg-warn/15 px-0.5 font-mono text-[0.85em] text-foreground"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

// Thread as stored at ingest (redacted, attachment contents removed). `newMessageIds` marks messages
// that were not in the previous candidate from the same thread.
export function SourceEmailDialog({
  open,
  onClose,
  sourceId,
  email,
  newMessageIds,
}: {
  open: boolean
  onClose: () => void
  sourceId: string
  email: EmailPayload | null | undefined
  newMessageIds?: Set<string>
}) {
  const messages = email?.messages ?? []

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] grid-rows-[auto_minmax(0,1fr)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg leading-snug">{email?.subject || 'Email sumber'}</DialogTitle>
          <DialogDescription className="font-mono text-[11px]">
            {sourceId}
            {email && ` · ${messages.length} pesan`}
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 space-y-5 overflow-y-auto pr-2">
          {!email ? (
            <p className="text-sm text-muted-foreground">
              Email asli tidak tersimpan untuk kandidat ini. Penyimpanan email dimulai 19 Oktober 2026; kandidat yang lebih lama
              perlu di-ingest ulang.
            </p>
          ) : (
            <>
              <Callout tone="info" icon={<ShieldCheck />} title="Versi tersamar">
                Ini email yang dibaca AI. Kredensial dan data pribadi sudah disamarkan sebelum diproses, dan isi lampiran tidak
                disimpan di sini.
              </Callout>

              <ol className="space-y-4">
                {messages.map((m, i) => (
                  <li key={m.message_id || i} className="rounded-md border">
                    <header className="space-y-1 border-b bg-muted/40 px-4 py-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono font-medium text-foreground">{m.from}</span>
                        <span className="text-muted-foreground">→ {(m.to || []).join(', ') || '-'}</span>
                        {newMessageIds?.has(m.message_id) && <Tag tone="accent">Baru</Tag>}
                        <span className="ml-auto text-muted-foreground">
                          {/^\d{4}-\d{2}-\d{2}$/.test(m.date) ? formatDate(m.date) : formatDateTime(m.date)}
                        </span>
                      </div>
                      {(m.cc || []).length > 0 && <div className="text-muted-foreground">cc {m.cc.join(', ')}</div>}
                      {m.subject && m.subject !== email.subject && <div className="text-foreground/80">{m.subject}</div>}
                      <div className="font-mono text-[10px] text-muted-foreground">{m.message_id}</div>
                    </header>
                    <div className="px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                      <RedactedText text={m.body || ''} />
                    </div>
                    {(m.attachments || []).length > 0 && (
                      <ul className="flex flex-wrap gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                        {(m.attachments as { attachment_id?: string; filename?: string }[]).map((a, j) => (
                          <li key={a.attachment_id || j} className="inline-flex items-center gap-1">
                            <Paperclip className="size-3" />
                            {a.filename || a.attachment_id || 'lampiran'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
