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
import { isMemberProfile, isProfileComplete } from '../lib/format'
import type { Profile } from '../lib/types'

type AuthContextValue = {
  /** True until we know whether someone is signed in. */
  loading: boolean
  session: Session | null
  profile: Profile | null
  profileComplete: boolean
  /**
   * The profile could not be loaded (network or server problem). This is not
   * the same as "no profile yet": the person must NOT be sent to the
   * "complete your profile" form, because they probably already have one.
   */
  profileError: boolean
  /** A PPMK member (not a visitor) with a complete profile. */
  isMember: boolean
  isVisitor: boolean
  isOrganizer: boolean
  isAdmin: boolean
  setProfile: (profile: Profile | null) => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Loads the profile, trying once more after a short pause (a blip on phone data is common). */
async function loadProfile(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return { profile: await getMyProfile(userId), failed: false }
    } catch (error) {
      console.error('Could not load profile', error)
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1500))
    }
  }
  return { profile: null, failed: true }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  // Which user the current `profile` belongs to. While it differs from the
  // signed-in user, we're still loading (prevents a wrong redirect to the
  // "complete your profile" page right after sign-in).
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)

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

    const result = await loadProfile(userId)
    // If it failed, keep whatever profile we already had instead of wiping it.
    if (!result.failed) setProfile(result.profile)
    setLoadFailed(result.failed)
    setLoadedFor(userId)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    loadProfile(userId).then((result) => {
      if (cancelled) return
      setProfile(result.profile)
      setLoadFailed(result.failed)
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
      profileError: userId !== null && loadedFor === userId && loadFailed && current === null,
      isMember: isMemberProfile(current),
      isVisitor: current?.account_type === 'visitor' && role === 'student',
      isOrganizer: role === 'organizer' || role === 'admin',
      isAdmin: role === 'admin',
      setProfile,
      refreshProfile,
      signOut,
    }
  }, [sessionLoading, loadedFor, loadFailed, userId, session, profile, refreshProfile, signOut])

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
