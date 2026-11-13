import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Compass, Lock, MessagesSquare } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { Spinner, buttonPrimary, buttonSecondary } from './ui'

/**
 * Who may open a page:
 * - 'member'  (default) PPMK members with a complete profile
 * - 'account' anyone signed in with a finished profile (visitors too)
 * - 'guest'   everyone, even signed out (the page limits what it shows)
 * Signed-in users always finish their one-time profile first.
 */
export function RequireAuth({
  children,
  allow = 'member',
}: {
  children: ReactNode
  allow?: 'member' | 'account' | 'guest'
}) {
  const { loading, session, profileComplete, isMember } = useAuth()
  const location = useLocation()
  const here = location.pathname + location.search

  if (loading) return <Spinner />

  if (!session) {
    if (allow === 'guest') return <>{children}</>
    return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />
  }

  if (!profileComplete && location.pathname !== '/me') {
    return <Navigate to={`/me?welcome=1&next=${encodeURIComponent(here)}`} replace />
  }

  if (allow === 'member' && !isMember) return <MembersOnly />

  return <>{children}</>
}

export function MembersOnly({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth()
  return (
    <div className={`mx-auto max-w-lg rounded-2xl border border-slate-200 bg-surface text-center ${compact ? 'p-6' : 'p-8 sm:p-10'}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-primary">
        <Lock size={22} />
      </div>
      <p className="mt-4 text-lg font-bold">For PPMK members</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Events, clubs and these discussions are for Malaysian students in PPMK. Visitors can still share and find
        food, hidden gems and trip ideas in <strong>Explore Korea</strong>.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link to="/discuss?g=explore" className={buttonPrimary}>
          <MessagesSquare size={16} /> Explore Korea
        </Link>
        <Link to="/explore" className={buttonSecondary}>
          <Compass size={16} /> Opportunities
        </Link>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        A PPMK student?{' '}
        <Link to={session ? '/me?become=member' : '/login'} className="font-semibold text-primary">
          {session ? 'Switch to a member profile' : 'Sign in'}
        </Link>
      </p>
    </div>
  )
}

export function RequireRole({
  role,
  children,
}: {
  role: 'organizer' | 'admin'
  children: ReactNode
}) {
  const { isOrganizer, isAdmin } = useAuth()
  const allowed = role === 'admin' ? isAdmin : isOrganizer

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-surface p-8 text-center">
        <p className="text-lg font-bold">Organizers only</p>
        <p className="mt-2 text-sm text-slate-500">
          This page is for {role === 'admin' ? 'admins' : 'event organizers'}.
          If you should have access, ask an EMSU admin to update your role.
        </p>
      </div>
    )
  }

  return <>{children}</>
}

/** Only allow in-app paths as a redirect target (no open redirects). */
// eslint-disable-next-line react-refresh/only-export-components
export function safeNext(next: string | null, fallback = '/events'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback
  return next
}
