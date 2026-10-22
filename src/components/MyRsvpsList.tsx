import { Link } from 'react-router-dom'

import { listEvents, listMyRsvps } from '../lib/api'
import { isPast } from '../lib/format'
import { useLoader } from '../lib/useLoader'
import EventCard from './EventCard'
import { ErrorBox, Spinner } from './ui'

/** Upcoming events the user said "Going" or "Maybe" to. */
export default function MyRsvpsList({
  userId,
  title = 'My upcoming events',
}: {
  userId: string
  title?: string
}) {
  const { data, loading, error } = useLoader(async () => {
    const [events, rsvps] = await Promise.all([listEvents(), listMyRsvps(userId)])
    const byEvent = new Map(rsvps.map((r) => [r.event_id, r.status]))

    return events
      .filter((e) => !isPast(e))
      .filter((e) => {
        const status = byEvent.get(e.id)
        return status === 'attending' || status === 'maybe'
      })
      .map((event) => ({ event, status: byEvent.get(event.id)! }))
  }, [userId])

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">{title}</h2>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : data && data.length > 0 ? (
        <div className="grid gap-3">
          {data.map(({ event, status }) => (
            <EventCard key={event.id} event={event} myStatus={status} compact />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          You haven't joined any upcoming events yet.{' '}
          <Link to="/events" className="font-semibold text-primary">
            Browse events
          </Link>
        </div>
      )}
    </section>
  )
}
