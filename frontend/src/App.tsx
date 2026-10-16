import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Toaster } from 'sonner'
import { NativeSelect } from '@/components/common'
import { api } from '@/lib/api'
import { ProfileProvider, useProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'

const IngestPage = lazy(() => import('@/pages/IngestPage'))
const CandidatesPage = lazy(() => import('@/pages/CandidatesPage'))
const ChatPage = lazy(() => import('@/pages/ChatPage'))
const MonitoringPage = lazy(() => import('@/pages/MonitoringPage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{ className: '!rounded-md !border-border !font-sans' }} />
      </ProfileProvider>
    </QueryClientProvider>
  )
}

function Shell() {
  const { user, isLoading, error } = useProfile()

  const pending = useQuery({
    queryKey: ['my-candidates', user?.user_id],
    queryFn: () => api.myCandidates(user!.user_id),
    enabled: Boolean(user),
  })

  const nav = [
    { to: '/kandidat', label: 'Kandidat Saya', hint: 'Antrean validasi', show: true, count: pending.data?.pending_count },
    { to: '/ingest', label: 'Ingest Email', hint: 'Kirim thread ke AI', show: true },
    { to: '/chat', label: 'Chatbot', hint: 'Tanya basis pengetahuan', show: true },
    { to: '/monitoring', label: 'Monitoring', hint: 'Ringkasan tim', show: user?.role === 'spv' },
  ]

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b bg-sidebar md:sticky md:top-0 md:h-screen md:border-r md:border-b-0">
        <div className="flex items-baseline gap-2 px-5 pt-5 pb-4 md:block md:pt-7 md:pb-6">
          <div className="font-serif text-xl leading-none font-semibold tracking-tight">
            KMS<span className="text-primary">.</span>
          </div>
          <div className="text-xs text-muted-foreground md:mt-1.5">Basis pengetahuan tim</div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
          {nav
            .filter((n) => n.show)
            .map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-foreground md:py-2',
                    isActive &&
                      'bg-card font-medium text-foreground shadow-[0_0_0_1px_var(--border)] md:before:absolute md:before:inset-y-2 md:before:-left-3 md:before:w-0.5 md:before:rounded-r md:before:bg-primary',
                  )
                }
              >
                <span>
                  {n.label}
                  <span className="hidden text-xs font-normal text-muted-foreground md:block">{n.hint}</span>
                </span>
                {Boolean(n.count) && (
                  <span className="min-w-5 rounded-sm bg-warn/20 px-1 text-center font-mono text-[11px] leading-5 font-medium text-foreground">
                    {n.count}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto hidden border-t px-5 py-4 md:block">
          <ProfileSwitcher />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex items-center justify-end gap-2 border-b px-4 py-2 md:hidden">
          <ProfileSwitcher compact />
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-10">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat direktori pengguna...
            </div>
          ) : error || !user ? (
            <p className="text-sm text-destructive">Direktori pengguna gagal dimuat: {error?.message ?? 'kosong'}.</p>
          ) : (
            // Keyed by user so switching profile resets every page's local state.
            <Suspense fallback={<Loader2 className="size-4 animate-spin text-muted-foreground" />}>
              <Routes key={user.user_id}>
                <Route path="/" element={<Navigate to="/kandidat" replace />} />
                <Route path="/ingest" element={<IngestPage />} />
                <Route path="/kandidat" element={<CandidatesPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route
                  path="/monitoring"
                  element={user.role === 'spv' ? <MonitoringPage /> : <Navigate to="/kandidat" replace />}
                />
                <Route path="*" element={<Navigate to="/kandidat" replace />} />
              </Routes>
            </Suspense>
          )}
        </main>
      </div>
    </div>
  )
}

function ProfileSwitcher({ compact }: { compact?: boolean }) {
  const { user, users, setUserId } = useProfile()
  const teams = [...new Set(users.map((u) => u.team))]
  return (
    <div className={cn(compact ? 'flex items-center gap-2' : 'space-y-1.5')}>
      <label htmlFor={compact ? 'profile-m' : 'profile'} className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Masuk sebagai
      </label>
      <NativeSelect
        id={compact ? 'profile-m' : 'profile'}
        value={user?.user_id ?? ''}
        onChange={(e) => setUserId(e.target.value)}
        disabled={!users.length}
        className={cn('font-mono', !compact && 'w-full')}
      >
        {teams.map((team) => (
          <optgroup key={team} label={team}>
            {users
              .filter((u) => u.team === team)
              .sort((a, b) => (a.role === b.role ? a.user_id.localeCompare(b.user_id) : a.role === 'spv' ? 1 : -1))
              .map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.user_id} ({u.role === 'spv' ? 'SPV' : 'Staff'})
                </option>
              ))}
          </optgroup>
        ))}
      </NativeSelect>
      {!compact && user && (
        <p className="text-xs text-muted-foreground">
          {user.role === 'spv' ? 'Supervisor' : 'Staff'} · {user.team}
        </p>
      )}
    </div>
  )
}
