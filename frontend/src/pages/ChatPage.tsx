import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUpRight, CornerDownLeft, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Callout, Eyebrow, PageHeader } from '@/components/common'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/profile'

interface Message {
  role: 'user' | 'assistant' | 'error'
  text: string
  at: number
}

const SUGGESTIONS = [
  'Apa nama event tracking untuk klik banner Ramadan?',
  'Template laporan UAT apa yang wajib dipakai?',
  'Kapan tanggal rilis fitur Search Result Video?',
  'Bagaimana cara akses VPN ke server staging?',
]

export default function ChatPage() {
  const user = useCurrentUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const chat = useMutation({
    mutationFn: (q: string) => api.chat(user.user_id, q),
    onSuccess: (res) =>
      setMessages((m) => [...m, { role: 'assistant', text: res?.output || '(jawaban kosong)', at: Date.now() }]),
    onError: (err) => setMessages((m) => [...m, { role: 'error', text: err.message, at: Date.now() }]),
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chat.isPending])

  const ask = (q: string) => {
    const text = q.trim()
    if (!text || chat.isPending) return
    setMessages((m) => [...m, { role: 'user', text, at: Date.now() }])
    setInput('')
    chat.mutate(text)
  }

  return (
    <>
      <PageHeader
        title="Chatbot Pengetahuan"
        description={
          <>
            Jawaban hanya diambil dari pengetahuan yang sudah divalidasi dan yang boleh diakses oleh{' '}
            <span className="font-mono font-medium text-foreground">{user.user_id}</span>. Setiap pertanyaan dijawab
            mandiri, tanpa mengingat percakapan sebelumnya.
          </>
        }
        action={
          messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setMessages([])}>
              Percakapan baru
            </Button>
          )
        }
      />

      <div className="flex h-[calc(100vh-15rem)] min-h-[440px] flex-col rounded-lg border bg-card">
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center">
              <p className="font-serif text-xl leading-snug font-semibold">Apa yang ingin Anda ketahui?</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="size-3.5" /> Filter akses diterapkan oleh workflow, bukan oleh AI.
              </p>
              <Eyebrow className="mt-8 mb-2">Contoh pertanyaan</Eyebrow>
              <ul className="divide-y border-y">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => ask(s)}
                      className="group flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {s}
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-7">
              {messages.map((m) => (
                <Turn key={m.at + m.role} message={m} />
              ))}
              {chat.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Mencari di basis pengetahuan...
                </div>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-t p-3 sm:px-5"
          onSubmit={(e) => {
            e.preventDefault()
            ask(input)
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-md border border-input bg-background p-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  ask(input)
                }
              }}
              placeholder="Tanyakan sesuatu..."
              className="max-h-40 min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              rows={1}
            />
            <Button type="submit" disabled={!input.trim() || chat.isPending}>
              Kirim <CornerDownLeft className="size-3.5 opacity-70" />
            </Button>
          </div>
          <p className="mx-auto mt-1.5 max-w-3xl text-[11px] text-muted-foreground">Enter untuk kirim, Shift+Enter untuk baris baru.</p>
        </form>
      </div>
    </>
  )
}

function Turn({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] rounded-md bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap">{message.text}</p>
      </div>
    )
  }
  if (message.role === 'error') {
    return (
      <Callout tone="bad" title="Gagal mendapatkan jawaban">
        {message.text}
      </Callout>
    )
  }
  return (
    <div className="border-l-2 border-primary/50 pl-4">
      <Eyebrow className="mb-1.5">Jawaban</Eyebrow>
      <div className="prose-chat text-[0.95rem]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
      </div>
    </div>
  )
}
