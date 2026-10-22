import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { listEvents, listMyRsvps, listRsvpCounts } from '../lib/api'
import { eventTimeRange, isPast, todayKst } from '../lib/format'
import { CATEGORIES } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import EventCard from '../components/EventCard'
import { EmptyState, ErrorBox, PageHeader, Spinner, buttonPrimary } from '../components/ui'

type View = 'upcoming' | 'calendar' | 'past'

export default function EventsPage() {
  const { session, isOrganizer } = useAuth()
  const userId = session!.user.id

  const { data, loading, error } = useLoader(async () => {
    const [events, rsvps, counts] = await Promise.all([
      listEvents(),
      listMyRsvps(userId),
      listRsvpCounts(),
    ])
    return {
      events,
      counts,
      myStatus: Object.fromEntries(rsvps.map((r) => [r.event_id, r.status])),
    }
  }, [userId])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [view, setView] = useState<View>('upcoming')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return (data?.events ?? []).filter((event) => {
      const matchesCategory = category === 'All' || event.category === category
      const matchesSearch =
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query)
      return matchesCategory && matchesSearch
    })
  }, [data, category, search])

  const upcoming = filtered.filter((e) => !isPast(e))
  const past = filtered.filter((e) => isPast(e)).reverse()

  const monthDays = useMemo(() => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)
    const days: (string | null)[] = Array(firstDay.getDay()).fill(null)

    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(
        `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      )
    }
    return days
  }, [month])

  const today = todayKst()
  const selectedEvents = selectedDate
    ? filtered.filter((event) => event.event_date === selectedDate)
    : []

  const list = view === 'past' ? past : upcoming

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Events"
        description="Find events and RSVP in one tap. Your details are already filled in."
        action={
          isOrganizer && (
            <Link to="/organizer?new=1" className={buttonPrimary}>
              <Plus size={16} />
              New event
            </Link>
          )
        }
      />

      <div className="space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events or places…"
            aria-label="Search events"
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {['All', ...CATEGORIES].map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
                category === item
                  ? 'bg-primary text-white'
                  : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex rounded-xl bg-slate-100 p-1" role="tablist">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['calendar', 'Calendar'],
            ['past', 'Past'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
              view === value ? 'bg-white text-primary shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : view !== 'calendar' ? (
        list.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                myStatus={data?.myStatus[event.id]}
                counts={data?.counts[event.id]}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={view === 'past' ? 'No past events' : 'No upcoming events'}>
            {search || category !== 'All'
              ? 'Try another search or category.'
              : 'New events will appear here as soon as organizers post them.'}
          </EmptyState>
        )
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              aria-label="Previous month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronLeft size={18} />
            </button>

            <h2 className="font-bold">
              {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h2>

            <button
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={`${day}-${index}`} className="py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((dateKey, index) => {
              if (!dateKey) return <div key={index} className="h-12" />

              const count = filtered.filter((e) => e.event_date === dateKey).length
              const selected = selectedDate === dateKey

              return (
                <button
                  key={dateKey}
                  aria-label={`${dateKey}${count ? `, ${count} events` : ''}`}
                  onClick={() => setSelectedDate(count ? dateKey : null)}
                  className={`relative h-12 rounded-lg text-sm ${
                    selected
                      ? 'bg-primary text-white'
                      : dateKey === today
                        ? 'font-bold text-primary ring-1 ring-red-200'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  {Number(dateKey.slice(8))}
                  {count > 0 && (
                    <span
                      className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                        selected ? 'bg-white' : 'bg-primary'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {selectedDate && (
            <div className="mt-5 space-y-2 border-t border-slate-200 pt-5">
              <p className="text-sm font-bold">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              {selectedEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block rounded-xl bg-slate-50 p-4 hover:bg-red-50"
                >
                  <p className="font-semibold">{event.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {eventTimeRange(event)} · {event.location}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
