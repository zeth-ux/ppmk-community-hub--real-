import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BookOpen, Check, Clock, Flag, HandHeart, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { dismissMarketReport, deleteMarketListing, listMarketListings, listMarketReports, listPhotos } from '../../lib/api'
import { MARKET_CATEGORIES, type MarketCategory, type MarketListing, type Photo } from '../../lib/types'
import { useLoader } from '../../lib/useLoader'
import { usePageMeta } from '../../lib/usePageMeta'
import { EmptyState, ErrorBox, Spinner, buttonPrimary, buttonSecondary, card } from '../ui'
import { MembersOnly } from '../guards'
import ListingDetail from './ListingDetail'
import ListingForm from './ListingForm'
import { CATEGORY_KEYS, CONDITION_KEYS, courseMatches, formatPrice, type Translate } from './shared'

type View = 'preloved' | 'books' | 'mine'

/** Explore → Market: preloved items and Pass the Book. Members only. */
export default function MarketTab() {
  const { t } = useLanguage()
  const { session, isMember } = useAuth()
  usePageMeta(t('market.title'), t('market.meta'))

  if (!isMember) {
    return (
      <div className="space-y-6">
        <MarketHero />
        {session ? (
          <MembersOnly compact />
        ) : (
          <div className={`${card} p-6 text-center`}>
            <p className="font-semibold">{t('market.signInTitle')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('market.signInBody')}</p>
            <Link to="/login?next=%2Fexplore%3Ftab%3Dmarket" className={`${buttonPrimary} mt-4`}>
              {t('nav.signIn')}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return <MarketBoard />
}

function MarketHero({ children }: { children?: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <section className="border-b border-slate-200 pb-6">
      <h1 className="font-display text-5xl sm:text-7xl">
        {t('market.headingStart')} <span className="text-gold">{t('market.headingAccent')}</span>
      </h1>
      <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-600">{t('market.intro')}</p>
      {children}
    </section>
  )
}

async function loadMarket() {
  const listings = await listMarketListings()
  const photos = await listPhotos('listing_id', listings.map((l) => l.id)).catch(() => [] as Photo[])
  return { listings, photos }
}

function MarketBoard() {
  const { t, language } = useLanguage()
  const { profile, isAdmin } = useAuth()
  const { data, loading, error, reload } = useLoader(loadMarket, [])
  const reports = useLoader(() => (isAdmin ? listMarketReports() : Promise.resolve([])), [isAdmin])

  const [params, setParams] = useSearchParams()
  const view = (['preloved', 'books', 'mine'].includes(params.get('v') ?? '') ? params.get('v') : 'preloved') as View
  const openId = params.get('item')
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: key === 'item' && !value })
  }

  const [category, setCategory] = useState<MarketCategory | 'all'>('all')
  const [freeOnly, setFreeOnly] = useState(false)
  const [myCourse, setMyCourse] = useState(Boolean(profile?.course))
  const [year, setYear] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MarketListing | 'new' | 'book' | null>(null)
  const [notice, setNotice] = useState('')

  const listings = useMemo(() => data?.listings ?? [], [data])
  const photos = data?.photos ?? []
  const photosFor = (id: string) => photos.filter((p) => p.listing_id === id)

  const open = listings.filter((l) => l.status !== 'done' && !l.expired)
  const books = open.filter((l) => l.category === 'textbook')
  const preloved = open.filter((l) => l.category !== 'textbook')
  const mine = listings.filter((l) => l.is_mine)
  const asked = listings.filter((l) => l.i_asked && !l.is_mine)

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matchesSearch = (l: MarketListing) =>
      !q || `${l.title} ${l.description} ${l.area} ${l.course ?? ''} ${l.subject_code ?? ''}`.toLowerCase().includes(q)
    if (view === 'books') {
      return books
        .filter(matchesSearch)
        .filter((l) => !myCourse || !profile?.course || courseMatches(l.course, profile.course))
        .filter((l) => year === 'all' || l.for_year === null || l.for_year === year)
        .filter((l) => !freeOnly || l.kind === 'free')
    }
    return preloved
      .filter(matchesSearch)
      .filter((l) => category === 'all' || l.category === category)
      .filter((l) => !freeOnly || l.kind === 'free')
  }, [view, books, preloved, search, myCourse, profile, year, category, freeOnly])

  const selected = openId ? listings.find((l) => l.id === openId) : undefined

  async function afterSave(id: string, isNew: boolean) {
    setEditing(null)
    setNotice(isNew ? t('market.posted') : t('market.saved'))
    await reload()
    if (isNew) setParam('item', id)
  }

  return (
    <div className="space-y-6">
      <MarketHero>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => { setNotice(''); setEditing('new') }} className={buttonPrimary}>
            <Plus size={16} /> {t('market.listItem')}
          </button>
          <button onClick={() => { setNotice(''); setEditing('book') }} className={buttonSecondary}>
            <BookOpen size={16} /> {t('market.giveBook')}
          </button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-green-600" />
          {t('market.safetyShort')}
        </p>
      </MarketHero>

      {editing && (
        <ListingForm
          initial={editing === 'new' || editing === 'book' ? null : editing}
          preset={editing === 'book' ? 'book' : null}
          initialPhotos={editing !== 'new' && editing !== 'book' ? photosFor(editing.id) : []}
          onDone={afterSave}
          onDeleted={async () => {
            setEditing(null)
            setNotice(t('market.deleted'))
            await reload()
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {notice && !editing && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          <Check size={17} /> {notice}
        </p>
      )}

      {isAdmin && (reports.data?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-5">
          <p className="flex items-center gap-2 font-bold text-red-900">
            <Flag size={16} /> {t('market.reportsTitle')} ({reports.data!.length})
          </p>
          <ul className="mt-3 space-y-2">
            {reports.data!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3">
                <button onClick={() => setParam('item', r.listing_id)} className="min-w-0 text-left">
                  <p className="font-semibold">{r.listing_title}</p>
                  <p className="text-xs text-slate-500">“{r.reason}”</p>
                </button>
                <div className="flex gap-1">
                  <button
                    onClick={async () => { await dismissMarketReport(r.id); await reports.reload() }}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    {t('market.dismiss')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(t('market.deleteConfirm'))) return
                      await deleteMarketListing(r.listing_id)
                      await Promise.all([reload(), reports.reload()])
                    }}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-100"
                    aria-label={t('market.delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist">
        <ViewTab active={view === 'preloved'} onClick={() => setParam('v', null)} emoji="🛍️" label={t('market.tabPreloved')} count={preloved.length} />
        <ViewTab active={view === 'books'} onClick={() => setParam('v', 'books')} emoji="📚" label={t('market.tabBooks')} count={books.length} />
        <ViewTab active={view === 'mine'} onClick={() => setParam('v', 'mine')} emoji="🙋" label={t('market.tabMine')} count={mine.length + asked.length} />
      </div>

      {view !== 'mine' && (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {view === 'preloved' ? (
              <>
                <Chip active={category === 'all'} onClick={() => setCategory('all')}>{t('market.allItems')}</Chip>
                {(Object.keys(MARKET_CATEGORIES) as MarketCategory[])
                  .filter((c) => c !== 'textbook')
                  .map((c) => (
                    <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                      {MARKET_CATEGORIES[c].emoji} {t(CATEGORY_KEYS[c])}
                    </Chip>
                  ))}
              </>
            ) : (
              <>
                {profile?.course && (
                  <Chip active={myCourse} onClick={() => setMyCourse(!myCourse)}>
                    🎓 {t('market.forMyCourse')} ({profile.course})
                  </Chip>
                )}
                <Chip active={year === 'all'} onClick={() => setYear('all')}>{t('market.anyYear')}</Chip>
                {[1, 2, 3, 4].map((y) => (
                  <Chip key={y} active={year === y} onClick={() => setYear(y)}>
                    {t('market.year')} {y}
                  </Chip>
                ))}
              </>
            )}
            <Chip active={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>🎁 {t('market.freeOnly')}</Chip>
          </div>
          <div className="relative lg:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'books' ? t('market.searchBooks') : t('market.search')}
              aria-label={t('market.search')}
              className="w-full rounded-[10px] border border-slate-200 bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : view === 'mine' ? (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-bold">{t('market.myListings')}</h2>
            {mine.length === 0 ? (
              <div className="mt-3"><EmptyState title={t('market.noMine')}>{t('market.noMineHint')}</EmptyState></div>
            ) : (
              <Grid>
                {mine.map((l) => (
                  <ListingCard key={l.id} l={l} photo={coverPhoto(photosFor(l.id))} t={t} language={language} onOpen={() => setParam('item', l.id)} />
                ))}
              </Grid>
            )}
          </section>
          <section>
            <h2 className="text-lg font-bold">{t('market.askedAbout')}</h2>
            {asked.length === 0 ? (
              <div className="mt-3"><EmptyState title={t('market.noAsked')} /></div>
            ) : (
              <Grid>
                {asked.map((l) => (
                  <ListingCard key={l.id} l={l} photo={coverPhoto(photosFor(l.id))} t={t} language={language} onOpen={() => setParam('item', l.id)} />
                ))}
              </Grid>
            )}
          </section>
        </div>
      ) : shown.length === 0 ? (
        <EmptyState title={view === 'books' ? t('market.noBooks') : t('market.noItems')}>
          {view === 'books' && myCourse && profile?.course ? (
            <button onClick={() => setMyCourse(false)} className="font-semibold text-primary">{t('market.showAllCourses')}</button>
          ) : (
            t('market.beFirst')
          )}
        </EmptyState>
      ) : (
        <Grid>
          {shown.map((l) => (
            <ListingCard key={l.id} l={l} photo={coverPhoto(photosFor(l.id))} t={t} language={language} onOpen={() => setParam('item', l.id)} />
          ))}
        </Grid>
      )}

      {openId && !loading && (
        <ListingDetail
          listing={selected}
          photos={photosFor(openId)}
          onClose={() => setParam('item', null)}
          onChanged={reload}
          onEdit={(l) => {
            setParam('item', null)
            setEditing(l)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}
    </div>
  )
}

function coverPhoto(photos: Photo[]) {
  return photos.find((p) => p.status === 'approved') ?? photos.find((p) => p.status === 'pending')
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">{children}</div>
}

function ViewTab({ active, onClick, label, emoji, count }: { active: boolean; onClick: () => void; label: string; emoji: string; count: number }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active ? 'bg-ink text-on-ink' : 'border border-slate-200 bg-surface text-slate-700 hover:border-slate-300'
      }`}
    >
      <span>{emoji}</span> {label}
      <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-on-ink/20' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-primary text-white' : 'border border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function ListingCard({
  l,
  photo,
  t,
  language,
  onOpen,
}: {
  l: MarketListing
  photo?: Photo
  t: Translate
  language: string
  onOpen: () => void
}) {
  const statusBadge =
    l.status === 'done' ? t('market.statusDone') : l.status === 'reserved' ? t('market.statusReserved') : l.expired ? t('market.expired') : ''

  return (
    <button onClick={onOpen} className={`${card} group flex flex-col overflow-hidden text-left transition hover:border-slate-300`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {photo ? (
          <img
            src={photo.url}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${photo.status !== 'approved' ? 'opacity-60' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">{MARKET_CATEGORIES[l.category].emoji}</div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-lg px-2 py-1 text-xs font-bold shadow-sm ${
            l.kind === 'free' ? 'bg-green-600 text-white' : 'bg-surface text-slate-900'
          }`}
        >
          {formatPrice(l, t, language)}
        </span>
        {statusBadge && (
          <span
            className={`absolute right-2 top-2 rounded-lg px-2 py-1 text-[11px] font-bold ${
              l.status === 'reserved' ? 'bg-amber-100 text-amber-800' : 'bg-slate-800 text-white'
            }`}
          >
            {statusBadge}
          </span>
        )}
        {photo && photo.status === 'pending' && l.is_mine && (
          <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-surface/95 px-2 py-1 text-[11px] font-bold text-amber-700">
            <Clock size={12} /> {t('market.photoPending')}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug">{l.title}</p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {l.category === 'textbook'
            ? [l.subject_code, l.for_year ? `${t('market.year')} ${l.for_year}` : null, l.course].filter(Boolean).join(' · ')
            : [t(CONDITION_KEYS[l.condition]), l.area].filter(Boolean).join(' · ')}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
          <span className="truncate">@{l.seller_username ?? '…'}</span>
          {l.is_mine && (l.interest_count ?? 0) > 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-bold text-primary">
              <HandHeart size={12} /> {l.interest_count}
            </span>
          ) : l.i_asked ? (
            <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 font-bold text-green-700">{t('market.asked')}</span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
