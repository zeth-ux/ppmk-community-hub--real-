import { useState } from 'react'
import { ExternalLink, MessageCircle, UserRound, Users } from 'lucide-react'

import { listClubs, listEvents } from '../lib/api'
import { isPast } from '../lib/format'
import { useLoader } from '../lib/useLoader'
import EventCard from '../components/EventCard'
import { EmptyState, ErrorBox, PageHeader, Spinner, card } from '../components/ui'

export default function ClubsPage() {
  const { data, loading, error } = useLoader(async () => {
    const [clubs, events] = await Promise.all([listClubs(), listEvents()])
    return { clubs, events: events.filter((e) => !isPast(e)) }
  }, [])

  const [category, setCategory] = useState('All')

  const clubs = data?.clubs ?? []
  const categories = ['All', ...new Set(clubs.map((club) => club.category))]
  const filtered = category === 'All' ? clubs : clubs.filter((c) => c.category === category)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Community"
        title="Clubs"
        description="PPMK-registered clubs, who runs them and what they're up to next."
      />

      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() => setCategory(item)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              category === item ? 'bg-primary text-white' : 'border border-slate-200 bg-white text-slate-600'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : filtered.length === 0 ? (
        <EmptyState title="No clubs listed yet" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((club) => {
            const upcoming = (data?.events ?? []).filter((e) => e.club_id === club.id).slice(0, 2)

            return (
              <article key={club.id} className={`${card} flex flex-col p-5`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-primary">{club.category}</p>
                    <h2 className="mt-1 text-xl font-bold">{club.name}</h2>
                  </div>
                  <div className="rounded-xl bg-red-50 p-2 text-primary">
                    <Users size={20} />
                  </div>
                </div>

                {club.description && (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{club.description}</p>
                )}

                {(club.leader_name || club.leader_contact) && (
                  <div className="mt-4 space-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    {club.leader_name && (
                      <p className="flex items-center gap-2">
                        <UserRound size={15} /> {club.leader_name}
                      </p>
                    )}
                    {club.leader_contact && (
                      <p className="flex items-center gap-2">
                        <MessageCircle size={15} /> {club.leader_contact}
                      </p>
                    )}
                  </div>
                )}

                {upcoming.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Coming up</p>
                    {upcoming.map((event) => (
                      <EventCard key={event.id} event={event} compact />
                    ))}
                  </div>
                )}

                {club.join_url && (
                  <a
                    href={club.join_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Join this club
                    <ExternalLink size={15} />
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
