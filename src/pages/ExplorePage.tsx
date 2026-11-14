import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  Clock,
  ExternalLink,
  Lightbulb,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { deleteOpportunity, listOpportunities, saveOpportunity } from '../lib/api'
import { deadlineLabel, friendlyError, todayKst } from '../lib/format'
import {
  OPPORTUNITY_KINDS,
  OPPORTUNITY_SCOPES,
  type Opportunity,
  type OpportunityInput,
  type OpportunityKind,
  type OpportunityScope,
} from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import { EmptyState, ErrorBox, Spinner, buttonPrimary, buttonSecondary, card, inputClass } from '../components/ui'

type When = 'upcoming' | 'closing' | 'past'

const OPPORTUNITY_KIND_KEYS: Record<OpportunityKind, TranslationKey> = {
  conference: 'explore.kindConference',
  culture: 'explore.kindCulture',
  competition: 'explore.kindCompetition',
  scholarship: 'explore.kindScholarship',
  volunteer: 'explore.kindVolunteer',
  career: 'explore.kindCareer',
  sports: 'explore.kindSports',
  other: 'explore.kindOther',
}

const OPPORTUNITY_SCOPE_KEYS: Record<OpportunityScope, TranslationKey> = {
  korea: 'explore.scopeKorea',
  asia: 'explore.scopeAsia',
  global: 'explore.scopeGlobal',
  online: 'explore.scopeOnline',
}

const EMPTY: OpportunityInput = {
  title: '',
  organizer: '',
  kind: 'culture',
  scope: 'korea',
  location: '',
  start_date: null,
  end_date: null,
  apply_deadline: null,
  url: null,
  description: '',
  status: 'suggested',
}

export default function ExplorePage() {
  const { language, t } = useLanguage()
  usePageMeta(t('explore.title'), t('explore.meta'))
  const { session, isMember, isOrganizer } = useAuth()
  const { data, loading, error, reload } = useLoader(listOpportunities, [])

  const [scope, setScope] = useState<OpportunityScope | 'all'>('all')
  const [kind, setKind] = useState<OpportunityKind | 'all'>('all')
  const [when, setWhen] = useState<When>('upcoming')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Opportunity | 'new' | null>(null)
  const [notice, setNotice] = useState('')

  const today = todayKst()
  const all = data ?? []
  const published = all.filter((o) => o.status === 'published')
  const suggestions = all.filter((o) => o.status === 'suggested')

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const isPast = (o: Opportunity) => (o.end_date ?? o.start_date ?? '9999') < today
    return published
      .filter((o) => scope === 'all' || o.scope === scope)
      .filter((o) => kind === 'all' || o.kind === kind)
      .filter((o) => !q || `${o.title} ${o.organizer} ${o.location} ${o.description}`.toLowerCase().includes(q))
      .filter((o) =>
        when === 'past' ? isPast(o) : when === 'closing' ? !!o.apply_deadline && o.apply_deadline >= today : !isPast(o),
      )
      .sort((a, b) =>
        when === 'closing'
          ? (a.apply_deadline ?? '').localeCompare(b.apply_deadline ?? '')
          : when === 'past'
            ? (b.start_date ?? '').localeCompare(a.start_date ?? '')
            : (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'),
      )
  }, [published, scope, kind, when, search, today])

  const counts = Object.fromEntries(
    (Object.keys(OPPORTUNITY_SCOPES) as OpportunityScope[]).map((s) => [s, published.filter((o) => o.scope === s).length]),
  )

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-6">
        <h1 className="font-display text-5xl sm:text-7xl">
          {language === 'ko' ? (
            <><span className="text-gold">PPMK</span>{' '}{t('explore.heading')}</>
          ) : (
            <>{t('explore.heading')} <span className="text-gold">PPMK</span></>
          )}
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-7 text-slate-600">
          {t('explore.intro')}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {isMember ? (
            <button onClick={() => { setNotice(''); setEditing('new') }} className={buttonPrimary}>
              {isOrganizer ? <Plus size={16} /> : <Lightbulb size={16} />}
              {isOrganizer ? t('explore.addListing') : t('explore.suggest')}
            </button>
          ) : (
            !session && (
              <Link to="/login?next=/explore" className={buttonPrimary}>
                {t('explore.signInSuggest')}
              </Link>
            )
          )}
          {isMember && (
            <Link to="/discuss?g=teamup" className={buttonSecondary}>
              <Users size={16} /> {t('explore.findTeammates')}
            </Link>
          )}
        </div>
      </section>

      {editing && (
        <OpportunityForm
          initial={editing === 'new' ? null : editing}
          canPublish={isOrganizer}
          onDone={async () => {
            setNotice(
              editing === 'new'
                ? isOrganizer
                  ? t('explore.listingPublished')
                  : t('explore.suggestionSent')
                : t('explore.listingSaved'),
            )
            setEditing(null)
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

      {isOrganizer && suggestions.length > 0 && !editing && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <p className="font-bold text-amber-900">
            {suggestions.length} {t(suggestions.length === 1 ? 'explore.suggestionSingular' : 'explore.suggestionPlural')}
          </p>
          <ul className="mt-3 space-y-2">
            {suggestions.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-xs text-slate-500">{o.organizer} · {o.location}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      const { id, created_by, created_at, updated_at, ...input } = o
                      void created_by
                      void created_at
                      void updated_at
                      await saveOpportunity({ ...input, status: 'published' }, id)
                      await reload()
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white"
                  >
                    <Check size={15} /> {t('explore.publish')}
                  </button>
                  <button onClick={() => setEditing(o)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t('explore.edit')}>
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(t('explore.deleteSuggestionConfirm'))) return
                      await deleteOpportunity(o.id)
                      await reload()
                    }}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label={t('explore.delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isOrganizer && suggestions.length > 0 && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          {t('explore.youSuggested')} {suggestions.length === 1 ? `“${suggestions[0].title}”` : `${suggestions.length} ${t('explore.listings')}`}. {t('explore.organizerWillCheck')}
        </p>
      )}

      {/* Where */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <ScopeTab active={scope === 'all'} onClick={() => setScope('all')} label={t('explore.everywhere')} emoji="✨" count={published.length} />
        {(Object.keys(OPPORTUNITY_SCOPES) as OpportunityScope[]).map((s) => (
          <ScopeTab key={s} active={scope === s} onClick={() => setScope(s)} label={t(OPPORTUNITY_SCOPE_KEYS[s])} emoji={OPPORTUNITY_SCOPES[s].emoji} count={counts[s]} />
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Chip active={kind === 'all'} onClick={() => setKind('all')}>{t('explore.allTypes')}</Chip>
          {(Object.keys(OPPORTUNITY_KINDS) as OpportunityKind[]).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {OPPORTUNITY_KINDS[k].emoji} {t(OPPORTUNITY_KIND_KEYS[k])}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={when} onChange={(e) => setWhen(e.target.value as When)} aria-label={t('explore.when')} className="rounded-xl border border-slate-200 bg-surface px-3 py-2.5 text-sm font-semibold">
            <option value="upcoming">{t('explore.upcoming')}</option>
            <option value="closing">{t('explore.closingSoon')}</option>
            <option value="past">{t('explore.past')}</option>
          </select>
          <div className="relative flex-1 lg:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('explore.search')} aria-label={t('explore.searchOpportunities')} className={`${inputClass} mt-0 pl-9`} />
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : list.length === 0 ? (
        <EmptyState title={t('explore.nothingYet')}>
          {isMember ? t('explore.suggestAbove') : t('explore.checkBack')}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <OpportunityCard
              key={o.id}
              o={o}
              t={t}
              language={language}
              isMember={isMember}
              signedIn={Boolean(session)}
              canEdit={isOrganizer}
              onEdit={() => {
                setEditing(o)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScopeTab({ active, onClick, label, emoji, count }: { active: boolean; onClick: () => void; label: string; emoji: string; count: number }) {
  return (
    <button
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
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-primary text-white' : 'border border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function formatOpportunityDate(date: string, language: string, style: 'short' | 'long' = 'short') {
  const locale = language === 'ms' ? 'ms-MY' : language === 'ko' ? 'ko-KR' : 'en-GB'
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    locale,
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  )
}

function dateRange(o: Opportunity, language: string, t: (key: TranslationKey) => string) {
  if (!o.start_date) return t('explore.dateTba')
  if (!o.end_date || o.end_date === o.start_date) return formatOpportunityDate(o.start_date, language, 'long')
  return `${formatOpportunityDate(o.start_date, language)} – ${formatOpportunityDate(o.end_date, language)}`
}

function deadlineText(
  date: string | null,
  due: ReturnType<typeof deadlineLabel>,
  language: string,
  t: (key: TranslationKey) => string,
) {
  if (!date || !due) return ''
  if (due.past) return t('explore.deadlinePassed')
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKst()}T00:00:00`).getTime()) / 86400000)
  if (days === 0) return t('explore.closesToday')
  if (days === 1) return t('explore.closesTomorrow')
  if (days <= 14) return `${t('explore.closesIn')} ${days} ${t('explore.days')}`
  return `${t('explore.closes')} ${formatOpportunityDate(date, language)}`
}

function OpportunityCard({
  o,
  t,
  language,
  isMember,
  signedIn,
  canEdit,
  onEdit,
}: {
  o: Opportunity
  t: (key: TranslationKey) => string
  language: string
  isMember: boolean
  signedIn: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  const kind = OPPORTUNITY_KINDS[o.kind]
  const scope = OPPORTUNITY_SCOPES[o.scope]
  const due = deadlineLabel(o.apply_deadline)
  const dueText = deadlineText(o.apply_deadline, due, language, t)
  const teamCategory = o.kind === 'competition' ? 'hackathon' : 'activities'
  const teamHref = `/discuss/new?c=${teamCategory}&title=${encodeURIComponent(`Looking for teammates: ${o.title}`)}${
    o.url ? `&link=${encodeURIComponent(o.url)}` : ''
  }${o.apply_deadline ? `&deadline=${o.apply_deadline}` : ''}`

  return (
    <article className={`${card} relative flex flex-col p-5 transition`}>
      <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${canEdit ? 'pr-8' : ''}`}>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800">{kind.emoji} {t(OPPORTUNITY_KIND_KEYS[o.kind])}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{scope.emoji} {t(OPPORTUNITY_SCOPE_KEYS[o.scope])}</span>
        {canEdit && (
          <button onClick={onEdit} aria-label={`${t('explore.edit')} ${o.title}`} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Pencil size={14} />
          </button>
        )}
      </div>

      <h2 className="mt-3 text-lg font-bold leading-snug">
        {o.url ? (
          <a href={o.url} target="_blank" rel="noreferrer" className="hover:text-primary">{o.title}</a>
        ) : (
          o.title
        )}
      </h2>
      {o.organizer && <p className="mt-0.5 text-sm font-medium text-slate-500">{o.organizer}</p>}

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-center gap-2"><CalendarDays size={15} className="shrink-0 text-slate-400" /> {dateRange(o, language, t)}</p>
        {o.location && <p className="flex items-center gap-2"><MapPin size={15} className="shrink-0 text-slate-400" /> {o.location}</p>}
        {due && (
          <p className={`flex items-center gap-2 font-semibold ${due.urgent ? 'text-red-600' : due.past ? 'text-slate-400' : 'text-amber-700'}`}>
            <Clock size={15} className="shrink-0" /> {t('explore.apply')} · {dueText}
          </p>
        )}
      </div>

      {o.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{o.description}</p>}

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {o.url && (
          <a href={o.url} target="_blank" rel="noreferrer" className={`${buttonPrimary} px-4 py-2.5`}>
            {t('explore.details')} <ExternalLink size={15} />
          </a>
        )}
        {(o.kind === 'competition' || o.kind === 'conference' || o.kind === 'volunteer' || o.kind === 'culture') &&
          (isMember ? (
            <Link to={teamHref} className={`${buttonSecondary} px-4 py-2.5`}>
              <Users size={15} /> {t('explore.findTeammates')}
            </Link>
          ) : (
            !signedIn && (
              <Link to="/login?next=/explore" className={`${buttonSecondary} px-4 py-2.5`}>
                <Users size={15} /> {t('explore.goWithOthers')}
              </Link>
            )
          ))}
      </div>
    </article>
  )
}

function OpportunityForm({
  initial,
  canPublish,
  onDone,
  onCancel,
}: {
  initial: Opportunity | null
  canPublish: boolean
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState<OpportunityInput>(() => {
    if (!initial) return { ...EMPTY, status: canPublish ? 'published' : 'suggested' }
    const { id, created_by, created_at, updated_at, ...rest } = initial
    void id
    void created_by
    void created_at
    void updated_at
    return rest
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof OpportunityInput>(k: K, v: OpportunityInput[K]) => setForm({ ...form, [k]: v })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.title.trim().length < 3) return setError(t('explore.errorTitle'))
    if (form.url && !/^https?:\/\//.test(form.url.trim())) return setError(t('explore.errorLink'))
    if (form.start_date && form.end_date && form.end_date < form.start_date) return setError(t('explore.errorDate'))
    setBusy(true)
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
      await saveOpportunity(
        {
          ...form,
          title: form.title.trim(),
          organizer: form.organizer.trim(),
          location: form.location.trim(),
          description: form.description.trim(),
          url: clean(form.url),
          start_date: clean(form.start_date),
          end_date: clean(form.end_date),
          apply_deadline: clean(form.apply_deadline),
        },
        initial?.id,
      )
      await onDone()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-5 sm:p-6`}>
      <div>
        <h2 className="text-lg font-bold">{initial ? t('explore.editListing') : canPublish ? t('explore.addListing') : t('explore.suggest')}</h2>
        {!canPublish && <p className="text-sm text-slate-500">{t('explore.reviewHint')}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          {t('explore.titleLabel')} *
          <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={150} placeholder={t('explore.titlePlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.organizer')}
          <input value={form.organizer} onChange={(e) => set('organizer', e.target.value)} maxLength={120} placeholder={t('explore.organizerPlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.location')}
          <input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={200} placeholder={t('explore.locationPlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.type')}
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as OpportunityKind)} className={inputClass}>
            {(Object.keys(OPPORTUNITY_KINDS) as OpportunityKind[]).map((k) => (
              <option key={k} value={k}>{OPPORTUNITY_KINDS[k].emoji} {t(OPPORTUNITY_KIND_KEYS[k])}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('explore.where')}
          <select value={form.scope} onChange={(e) => set('scope', e.target.value as OpportunityScope)} className={inputClass}>
            {(Object.keys(OPPORTUNITY_SCOPES) as OpportunityScope[]).map((s) => (
              <option key={s} value={s}>{OPPORTUNITY_SCOPES[s].emoji} {t(OPPORTUNITY_SCOPE_KEYS[s])}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('explore.starts')}
          <input type="date" value={form.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.ends')}
          <input type="date" value={form.end_date ?? ''} onChange={(e) => set('end_date', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.applyBy')}
          <input type="date" value={form.apply_deadline ?? ''} onChange={(e) => set('apply_deadline', e.target.value)} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('explore.link')}
          <input type="url" value={form.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://" className={inputClass} />
        </label>
        <label className="text-sm font-medium sm:col-span-2">
          {t('explore.shortDescription')}
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} className={inputClass} />
        </label>
        {canPublish && (
          <label className="text-sm font-medium">
            {t('explore.status')}
            <select value={form.status} onChange={(e) => set('status', e.target.value as OpportunityInput['status'])} className={inputClass}>
              <option value="published">{t('explore.published')}</option>
              <option value="suggested">{t('explore.draft')}</option>
              <option value="archived">{t('explore.archived')}</option>
            </select>
          </label>
        )}
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonPrimary}>
          {busy ? t('explore.saving') : initial ? t('explore.save') : canPublish ? t('explore.publish') : t('explore.sendSuggestion')}
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>{t('explore.cancel')}</button>
        {initial && canPublish && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(t('explore.deleteListingConfirm'))) return
              await deleteOpportunity(initial.id)
              await onDone()
            }}
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-red-600"
          >
            <Trash2 size={15} /> {t('explore.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
