import { UserCheck } from 'lucide-react'

import { useLanguage } from '../../context/LanguageContext'
import { getShowUp } from '../../lib/api'
import { useLoader } from '../../lib/useLoader'
import { card } from '../ui'

/** Said Going vs actually came, for one event (from the event day on). */
export default function ShowUpPanel({ eventId, refreshKey }: { eventId: string; refreshKey: unknown }) {
  const { t } = useLanguage()
  const { data } = useLoader(() => getShowUp(eventId).catch(() => null), [eventId, refreshKey])
  if (!data) return null

  const rate = data.said_going > 0 ? Math.round((data.came / data.said_going) * 100) : null

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <h3 className="flex items-center gap-2 font-bold">
        <UserCheck size={18} className="text-primary" /> {t('showup.title')}
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.event_over ? (
          <Tile label={t('showup.rate')} value={rate === null ? '–' : `${rate}%`}
                note={t('showup.cameOf').replace('{came}', String(data.came)).replace('{going}', String(data.said_going))} />
        ) : (
          <Tile label={t('showup.soFar')} value={`${data.came} / ${data.said_going}`} />
        )}
        <Tile label={t('showup.noShows')} value={data.event_over ? String(data.no_shows) : '–'}
              note={data.event_over ? undefined : t('showup.noShowsLater')} />
        <Tile label={t('showup.walkIns')} value={String(data.walk_ins)} />
        <Tile label={t('showup.self')} value={String(data.self_checked_in)} />
      </div>
    </section>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {note && <p className="mt-0.5 text-xs leading-4 text-slate-500">{note}</p>}
    </div>
  )
}
