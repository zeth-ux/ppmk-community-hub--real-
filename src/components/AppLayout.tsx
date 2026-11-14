import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Compass,
  Home,
  Info,
  LogIn,
  LogOut,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { displayName } from '../lib/format'
import ThemeToggle from './ThemeToggle'
import { CONTACT_EMAIL, SURVEY_URL, isConfigured } from '../config'
import LogoMark from './Logo'
import { Spinner } from './ui'

/**
 * Layout for every page.
 * - Phones and iPads (below 1024px): app-style bottom tab bar + account menu.
 * - Laptops (1024px+): full top navigation.
 */
export default function AppLayout() {
  const { session, isMember, isOrganizer, isAdmin } = useAuth()
  const { t } = useLanguage()
  const location = useLocation()

  // New page: start at the top. Link to a section (/about#faq): scroll to it.
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1))
      const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      return () => clearTimeout(t)
    }
    window.scrollTo({ top: 0 })
  }, [location.pathname, location.hash])

  // What each kind of user can open. Visitors and signed-out people get the
  // public parts only (the database enforces the same limits).
  const navItems = ([
    { to: '/events', label: 'nav.events', icon: CalendarDays, show: isMember },
    { to: '/clubs', label: 'nav.clubs', icon: Users, show: isMember },
    { to: '/discuss', label: 'nav.discuss', icon: MessagesSquare, show: true },
    { to: '/explore', label: 'nav.explore', icon: Compass, show: true },
    { to: '/ppmk', label: 'nav.ppmk', icon: Info, show: true },
    { to: '/ask', label: 'nav.ask', icon: Sparkles, show: isMember },
    { to: '/organizer', label: 'nav.organize', icon: ClipboardList, show: isOrganizer },
    { to: '/admin', label: 'nav.admin', icon: ShieldCheck, show: isAdmin },
  ] satisfies { to: string; label: TranslationKey; icon: LucideIcon; show: boolean }[]).filter((item) => item.show)

  // Phones/iPads: at most 5 tabs. Ask, Organize and Admin are in the account
  // menu.
  const tabItems: { to: string; label: TranslationKey; icon: LucideIcon }[] = !session
    ? [
        { to: '/', label: 'nav.home', icon: Home },
        { to: '/discuss', label: 'nav.discuss', icon: MessagesSquare },
        { to: '/explore', label: 'nav.explore', icon: Compass },
        { to: '/ppmk', label: 'nav.ppmk', icon: Info },
      ]
    : [
        ...navItems.filter((item) => ['/events', '/clubs', '/discuss', '/explore'].includes(item.to)),
        { to: '/me', label: 'nav.me', icon: UserRound },
      ]

  return (
    <div className="min-h-screen bg-background text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 lg:gap-5">
            <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="PPMK Community Hub, home">
              <LogoMark size={36} />
              <div className="leading-none">
                <p className="font-display text-[22px] leading-none">
                  PPMK<span className="text-gold">.</span>hub
                </p>
                <p className="mt-0.5 hidden text-[11px] text-slate-500 min-[360px]:block">Hanyang ERICA</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-0 lg:flex" aria-label={t('nav.main')}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `relative px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? 'text-slate-900 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-primary'
                        : 'text-slate-500 hover:text-slate-900'
                    }`
                  }
                >
                  {t(item.label)}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            {session ? (
              <AccountMenu key={location.pathname} />
            ) : (
              <Link
                to={`/login?next=${encodeURIComponent(location.pathname === '/' ? '/events' : location.pathname)}`}
                className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary-container"
              >
                <LogIn size={16} />
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-150px)] max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:pb-10">
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
      </main>

      <SiteFooter />

      <nav
          aria-label={t('nav.tabs')}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabItems.length}, minmax(0, 1fr))` }}>
            {tabItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition sm:py-3 sm:text-xs ${
                      isActive ? 'text-primary' : 'text-slate-500 active:text-slate-900'
                    }`
                  }
                >
                  <Icon size={21} />
                  {t(item.label)}
                </NavLink>
              )
            })}
          </div>
        </nav>
    </div>
  )
}

function AccountMenu() {
  const { profile, isMember, isVisitor, isOrganizer, isAdmin, signOut } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function logOut() {
    setOpen(false)
    await signOut()
    navigate('/', { replace: true })
  }

  const initial = (profile?.username ?? profile?.full_name ?? '?').charAt(0).toUpperCase()
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 font-bold text-primary">{initial}</span>
        <span className="hidden max-w-[9rem] truncate sm:inline">{displayName(profile)}</span>
        <ChevronDown size={15} className={`hidden transition min-[360px]:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-surface p-2 shadow-xl">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold">{displayName(profile)}</p>
            <p className="truncate text-xs text-slate-500">{profile?.email}</p>
            {isVisitor && <p className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{t('nav.visitorAccount')}</p>}
          </div>
          <div className="my-1 border-t border-slate-100" />
          <Link to="/me" className={item} role="menuitem">
            <UserRound size={17} /> {isVisitor ? t('nav.myProfile') : t('nav.myProfileClubs')}
          </Link>
          {isMember && (
            <Link to="/ask" className={item} role="menuitem">
              <Sparkles size={17} /> {t('nav.askHub')}
            </Link>
          )}
          {isOrganizer && (
            <Link to="/organizer" className={item} role="menuitem">
              <ClipboardList size={17} /> {t('nav.organizerTools')}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={item} role="menuitem">
              <ShieldCheck size={17} /> {t('nav.admin')}
            </Link>
          )}
          <Link to="/ppmk" className={item} role="menuitem">
            <Info size={17} /> {t('nav.ppmk')}
          </Link>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={() => void logOut()} className={`${item} text-red-700 hover:bg-red-50`} role="menuitem">
            <LogOut size={17} /> {t('nav.signOut')}
          </button>
        </div>
      )}
    </div>
  )
}

function SiteFooter() {
  const { isMember } = useAuth()
  const { t } = useLanguage()
  const year = new Date().getFullYear()
  const link = 'text-slate-600 hover:text-primary'

  const columns: [string, [string, string][]][] = [
    [
      t('footer.community'),
      [
        [t('footer.discussions'), '/discuss'],
        [t('footer.exploreKorea'), '/discuss?g=explore'],
        [t('footer.opportunities'), '/explore'],
        ...(isMember ? ([[t('footer.events'), '/events'], [t('footer.clubs'), '/clubs']] as [string, string][]) : []),
      ],
    ],
    [
      t('footer.ppmk'),
      [
        [t('footer.ppmk'), '/ppmk'],
        [t('footer.startClub'), '/clubs/apply'],
        [t('footer.questions'), '/ppmk#faq'],
      ],
    ],
    [
      t('footer.help'),
      [
        [t('footer.privacy'), '/privacy'],
        ...(isConfigured(SURVEY_URL) ? ([[t('footer.feedback'), '/survey']] as [string, string][]) : []),
        ...(isMember ? ([[t('nav.askHub'), '/ask']] as [string, string][]) : []),
      ],
    ],
  ]

  return (
    <footer className="border-t border-slate-200 pb-24 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Link to="/" className="inline-flex items-center gap-2.5" aria-label="PPMK Community Hub, home">
            <LogoMark size={32} />
            <span className="font-display text-2xl">
              PPMK<span className="text-gold">.</span>hub
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-6 text-slate-600">
            Jauh di mata, dekat di hati. Built by Malaysian students at Hanyang ERICA, for Malaysians across Korea.
          </p>
          {isConfigured(CONTACT_EMAIL) && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              {CONTACT_EMAIL}
            </a>
          )}
        </div>
        {columns.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="font-bold">{title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className={link}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">
          © {year} PPMK Community Hub. {t('footer.about')}
        </p>
      </div>
    </footer>
  )
}

function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = [
    { code: 'ms', label: 'MS', name: 'Bahasa Melayu' },
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'ko', label: 'KO', name: '한국어' },
  ] as const

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const selected = options.find((option) => option.code === language)!

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('language.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={t('language.menu')}
        className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-[10px] border border-slate-200 px-2 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
      >
        {selected.label}
        <ChevronDown size={13} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" aria-label={t('language.menu')} className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 bg-surface p-1.5 shadow-xl">
          {options.map((option) => (
            <button
              key={option.code}
              type="button"
              role="menuitemradio"
              aria-checked={language === option.code}
              onClick={() => {
                setLanguage(option.code)
                setOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                language === option.code ? 'bg-red-50 font-semibold text-primary' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{option.name}</span>
              <span className="text-xs font-bold text-slate-400">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
