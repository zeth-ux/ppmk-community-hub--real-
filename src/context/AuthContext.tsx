import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import { getMyProfile } from '../lib/api'
import { isProfileComplete } from '../lib/format'
import type { Profile } from '../lib/types'

type AuthContextValue = {
  /** True until we know whether someone is signed in. */
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileComplete: boolean
  isOrganizer: boolean
  isAdmin: boolean
  setProfile: (profile: Profile | null) => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Which user the current `profile` belongs to. While it differs from the
  // signed-in user, we're still loading (prevents a wrong redirect to the
  // "complete your profile" page right after sign-in).
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    // Note: don't call other Supabase methods inside this callback
    // (it can deadlock); the profile is loaded by the effect below.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) return

    try {
      setProfile(await getMyProfile(userId))
    } catch (error) {
      console.error('Could not load profile', error)
      setProfile(null)
    } finally {
      setLoadedFor(userId)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    getMyProfile(userId)
      .catch((error: unknown) => {
        console.error('Could not load profile', error)
        return null
      })
      .then((loaded) => {
        if (cancelled) return
        setProfile(loaded)
        setLoadedFor(userId)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    // A profile left over from a previous sign-in never leaks through.
    const current = userId && loadedFor === userId ? profile : null
    const role = current?.role

    return {
      loading: sessionLoading || (userId !== null && loadedFor !== userId),
      session,
      profile: current,
      profileComplete: isProfileComplete(current),
      isOrganizer: role === 'organizer' || role === 'admin',
      isAdmin: role === 'admin',
      setProfile,
      refreshProfile,
      signOut,
    }
  }, [sessionLoading, loadedFor, userId, session, profile, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
