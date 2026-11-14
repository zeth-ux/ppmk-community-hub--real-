import { Link, useSearchParams } from 'react-router-dom'
import { CalendarPlus, Plus, Settings } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'

import { listClubs, listEvents, listMyClubMemberships, listRsvpCounts } from '../lib/api'
import { formatDate, isPast } from '../lib/format'
import type { ClubRole, HubEvent } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import EventForm from '../components/organizer/EventForm'
import EventManagePanel from '../components/organizer/EventManagePanel'
import { ErrorBox, PageHeader, Spinner, buttonPrimary, card } from '../components/ui'

const roleTranslation: Record<ClubRole, TranslationKey> = {
  president: 'clubRole.president',
  vice_president: 'clubRole.vicePresident',
  committee: 'clubRole.committee',
  member: 'clubRole.member',
}

export default function OrganizerPage() {
  const { t } = useLanguage()
  usePageMeta(t('organizer.title'))
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('event')
  const mode = params.get('new') === '1' ? 'new' : params.get('edit') === '1' ? 'edit' : 'view'

  const { data, loading, error, reload } = useLoader(async () => {
    const [events, counts] = await Promise.all([listEvents(), listRsvpCounts()])
    return { events, counts }
  }, [])

  const events = data?.events ?? []
  const selected = events.find((e) => e.id === selectedId)
  const upcoming = events.filter((e) => !isPast(e))
  const past = events.filter((e) => isPast(e)).reverse()

  function go(next: Record<string, string>) {
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSaved(event: HubEvent) {
    await reload()
    go({ event: event.id })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('organizer.title')}
        title={t('organizer.manageEvents')}
        description={t('organizer.description')}
        action={
          <button onClick={() => go({ new: '1' })} className={buttonPrimary}>
            <Plus size={16} />
            {t('organizer.newEvent')}
          </button>
        }
      />

      <ErrorBox>{error}</ErrorBox>

      {mode === 'view' && !selected && <MyLedClubs />}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className={`${card} h-fit p-3 ${mode !== 'view' || selected ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <Spinner />
          ) : events.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">{t('organizer.noEvents')}</p>
          ) : (
            <>
              <EventGroup
                title={t('organizer.upcoming')}
                events={upcoming}
                selectedId={selectedId}
                counts={data?.counts}
                onSelect={(id) => go({ event: id })}
              />
              {past.length > 0 && (
                <EventGroup
                  title={t('organizer.past')}
                  events={past}
                  selectedId={selectedId}
                  counts={data?.counts}
                  onSelect={(id) => go({ event: id })}
                />
              )}
            </>
          )}
        </aside>

        <div className="min-w-0">
          {mode === 'new' ? (
            <EventForm defaultClubId={params.get('club') ?? undefined} onSaved={handleSaved} onCancel={() => go({})} />
          ) : mode === 'edit' && selected ? (
            <EventForm
              key={selected.id}
              event={selected}
              onSaved={handleSaved}
              onCancel={() => go({ event: selected.id })}
            />
          ) : selected ? (
            <>
              <button
                onClick={() => go({})}
                className="mb-3 text-sm font-semibold text-slate-500 hover:text-primary lg:hidden"
              >
                {t('organizer.allEvents')}
              </button>
              <EventManagePanel
                key={selected.id}
                event={selected}
                onEdit={() => go({ event: selected.id, edit: '1' })}
                onChanged={() => void reload()}
                onDeleted={async () => {
                  await reload()
                  go({})
                }}
              />
            </>
          ) : (
            !loading && (
              <div className="hidden rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm text-slate-500 lg:block">
                {t('organizer.pickEvent')}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function EventGroup({
  title,
  events,
  selectedId,
  counts,
  onSelect,
}: {
  title: string
  events: HubEvent[]
  selectedId: string | null
  counts?: Record<string, { attending: number }>
  onSelect: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <div className="mb-2">
      <p className="px-3 pb-1 pt-2 text-xs font-bold text-slate-400">
        {title}
      </p>
      {events.length === 0 && <p className="px-3 py-2 text-sm text-slate-400">{t('eventDetail.none')}</p>}
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => onSelect(event.id)}
          className={`block w-full rounded-xl px-3 py-2.5 text-left ${
            event.id === selectedId ? 'bg-red-50' : 'hover:bg-slate-50'
          }`}
        >
          <p className={`text-sm font-semibold ${event.id === selectedId ? 'text-primary' : ''}`}>
            {event.title}
          </p>
          <p className="text-xs text-slate-500">
            {formatDate(event.event_date)} · {counts?.[event.id]?.attending ?? 0} {t('organizer.going')}
          </p>
        </button>
      ))}
    </div>
  )
}

/** Club leaders: quick links to run their club from here. */
function MyLedClubs() {
  const { t } = useLanguage()
  const { session } = useAuth()
  const userId = session!.user.id
  const { data } = useLoader(async () => {
    const [mine, clubs] = await Promise.all([listMyClubMemberships(userId).catch(() => []), listClubs()])
    return mine
      .filter((m) => m.status === 'active' && (m.role === 'president' || m.role === 'vice_president'))
      .map((m) => ({ ...m, club: clubs.find((c) => c.id === m.club_id) }))
      .filter((m) => m.club)
  }, [userId])

  if (!data || data.length === 0) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <div key={m.club_id} className={`${card} p-4`}>
          <p className="text-xs font-semibold text-primary">{t('organizer.youLead')} · {t(roleTranslation[m.role])}</p>
          <Link to={`/clubs/${m.club_id}`} className="mt-0.5 block font-bold hover:text-primary">{m.club!.name}</Link>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link to={`/organizer?new=1&club=${m.club_id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-primary hover:bg-red-100">
              <CalendarPlus size={15} /> {t('organizer.clubEvent')}
            </Link>
            <Link to={`/clubs/${m.club_id}?tab=manage`} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-200">
              <Settings size={15} /> {t('organizer.manage')}
            </Link>
          </div>
        </div>
      ))}
    </section>
  )
}
