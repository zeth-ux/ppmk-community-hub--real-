import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  LogIn,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const { session, profile, isOrganizer, isAdmin } = useAuth()

  const navItems = [
    { to: '/events', label: 'Events', icon: CalendarDays, show: true },
    { to: '/clubs', label: 'Clubs', icon: Users, show: true },
    { to: '/explore', label: 'Explore', icon: Compass, show: true },
    { to: '/organizer', label: 'Organize', icon: ClipboardList, show: isOrganizer },
    { to: '/admin', label: 'Admin', icon: ShieldCheck, show: isAdmin },
  ].filter((item) => item.show)

  // Phones get at most 5 tabs: Admin lives on the Me page there.
  const mobileItems = [
    ...navItems.filter((item) => item.to !== '/admin'),
    { to: '/me', label: 'Me', icon: UserRound, show: true },
  ]

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
              <GraduationCap size={20} />
            </div>

            <div className="leading-tight">
              <p className="text-sm font-bold">PPMK Community Hub</p>
              <p className="text-xs text-slate-500">Hanyang ERICA</p>
            </div>
          </Link>

          {session && (
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-red-50 text-primary'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          {session ? (
            <NavLink
              to="/me"
              className={({ isActive }) =>
                `hidden items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold md:flex ${
                  isActive
                    ? 'border-red-200 bg-red-50 text-primary'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`
              }
            >
              <UserRound size={16} />
              {profile?.full_name?.split(' ')[0] ?? 'Me'}
            </NavLink>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"
            >
              <LogIn size={16} />
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-150px)] max-w-6xl px-4 py-6 pb-28 sm:px-6 md:pb-10">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white pb-20 md:pb-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6">
          <p className="text-xs text-slate-500">
            PPMK Community Hub · EMSU pilot · Not an official university service
          </p>

          <div className="flex items-center gap-4 text-xs">
            <Link
              to="/privacy"
              className="flex items-center gap-1 text-slate-500 hover:text-primary"
            >
              <ShieldCheck size={14} />
              Privacy
            </Link>

            <Link to="/survey" className="text-slate-500 hover:text-primary">
              Give feedback
            </Link>
          </div>
        </div>
      </footer>

      {session && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
          >
            {mobileItems.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                      isActive ? 'text-primary' : 'text-slate-500'
                    }`
                  }
                >
                  <Icon size={20} />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
