import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { DirectoryUser } from './types'

// Pseudonymous profile selector. End-user authentication is out of scope for the
// prototype (threat to validity, plan doc section 5): the chosen user_id is trusted.
const STORAGE_KEY = 'kms.profile'

interface ProfileContextValue {
  users: DirectoryUser[]
  user: DirectoryUser | null
  setUserId: (id: string) => void
  isLoading: boolean
  error: Error | null
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const directory = useQuery({ queryKey: ['directory'], queryFn: api.directory, staleTime: Infinity })
  const [userId, setUserIdState] = useState<string | null>(readStored)

  const users = useMemo(() => directory.data?.users ?? [], [directory.data])
  const user = users.find((u) => u.user_id === userId) ?? users.find((u) => u.role === 'staff') ?? null

  useEffect(() => {
    if (user && user.user_id !== userId) setUserIdState(user.user_id)
  }, [user, userId])

  const setUserId = (id: string) => {
    setUserIdState(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Storage may be unavailable (private mode); the selection still works for this session.
    }
  }

  return (
    <ProfileContext.Provider
      value={{ users, user, setUserId, isLoading: directory.isLoading, error: directory.error }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}

// Pages that need an active user render only once the directory has loaded.
export function useCurrentUser(): DirectoryUser {
  const { user } = useProfile()
  if (!user) throw new Error('No active profile')
  return user
}
