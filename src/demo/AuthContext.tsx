// Design-preview stand-in for src/context/AuthContext.tsx (used only by
// `npm run demo`). Always signed in as a fake student, plus a small floating
// switcher so you can preview the student / organizer / admin screens.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'

import type { AppRole, Profile } from '../lib/types'

type PreviewRole = AppRole | 'visitor'
import { demoProfile, getDemoRole, setDemoAccess, setDemoRole } from './data'
import { demoSession } from './supabase'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileComplete: boolean
  isMember: boolean
  isVisitor: boolean
  isOrganizer: boolean
  isAdmin: boolean
  setProfile: (profile: Profile | null) => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<PreviewRole>(getDemoRole())
  const [signedIn, setSignedIn] = useState(true)
  const [profile, setProfileState] = useState<Profile>({ ...demoProfile })

  useEffect(() => {
    const signIn = () => setSignedIn(true)
    window.addEventListener('demo-sign-in', signIn)
    return () => window.removeEventListener('demo-sign-in', signIn)
  }, [])

  setDemoAccess(!signedIn ? 'guest' : role === 'visitor' ? 'visitor' : 'member')

  const changeRole = (next: PreviewRole) => {
    setDemoRole(next)
    setRole(next)
    setProfileState({ ...demoProfile })
  }

  const setProfile = useCallback((p: Profile | null) => {
    if (p) setProfileState(p)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: false,
      session: signedIn ? (demoSession as unknown as Session) : null,
      profile: signedIn ? profile : null,
      profileComplete: signedIn,
      isMember: signedIn && role !== 'visitor',
      isVisitor: signedIn && role === 'visitor',
      isOrganizer: signedIn && (role === 'organizer' || role === 'admin'),
      isAdmin: signedIn && role === 'admin',
      setProfile,
      refreshProfile: async () => {},
      signOut: async () => setSignedIn(false),
    }),
    [signedIn, profile, role, setProfile],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 right-3 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-amber-300 bg-amber-50/95 px-2 py-1 text-xs backdrop-blur">
        <span className="px-1 font-semibold text-amber-800">Preview</span>
        {(['visitor', 'student', 'organizer', 'admin'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setSignedIn(true)
              changeRole(r)
            }}
            className={`shrink-0 rounded-full px-2 py-0.5 capitalize ${
              signedIn && role === r ? 'bg-amber-500 text-white' : 'text-amber-900 hover:bg-amber-100'
            }`}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSignedIn(false)}
          className={`shrink-0 rounded-full px-2 py-0.5 ${!signedIn ? 'bg-amber-500 text-white' : 'text-amber-900 hover:bg-amber-100'}`}
        >
          signed out
        </button>
      </div>
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
