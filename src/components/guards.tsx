import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

/**
 * Signed-in users only. Also makes sure the one-time profile is filled in
 * before anything else (the profile page itself is exempt).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, session, profileComplete } = useAuth()
  const location = useLocation()
  const here = location.pathname + location.search

  if (loading) return <Spinner />

  if (!session) {
    return <Navigate to={`/login?next=${encodeURIComponent(here)}`} replace />
  }

  if (!profileComplete && location.pathname !== '/me') {
    return <Navigate to={`/me?welcome=1&next=${encodeURIComponent(here)}`} replace />
  }

  return <>{children}</>
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
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
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
