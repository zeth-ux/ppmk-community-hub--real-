import { useState } from 'react'
import { ExternalLink } from 'lucide-react'

import { externalEvents } from '../data/externalEvents'

export default function ExplorePage() {
  const [category, setCategory] =
    useState('All')

  const categories = [
    'All',
    ...new Set(
      externalEvents.map(
        (event) => event.category,
      ),
    ),
  ]

  const filteredEvents =
    category === 'All'
      ? externalEvents
      : externalEvents.filter(
          (event) =>
            event.category === category,
        )

  return (
    <div className="mx-auto max-w-5xl">
      <section>
        <p className="text-sm font-semibold text-primary">
          Discover
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          Explore
        </h1>

        <p className="mt-2 text-slate-600">
          Discover events and opportunities
          beyond PPMK-organised activities.
        </p>

        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Sample listings for now. The real board, with AI that turns a poster
          or link into a listing, is coming soon.
        </p>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            key={item}
            onClick={() =>
              setCategory(item)
            }
            className={`rounded-full border px-4 py-2 text-sm ${
              category === item
                ? 'bg-primary text-white'
                : 'bg-white'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="mt-6 space-y-4">
        {filteredEvents.map((event) => (
          <article
            key={event.id}
            className="rounded-xl border bg-white p-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-primary">
                  {event.category}
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {event.title}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {event.organizer}
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                External
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {event.description}
            </p>

            <div className="mt-4 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <p>
                <strong>Date:</strong>{' '}
                {event.date}
              </p>

              <p>
                <strong>Location:</strong>{' '}
                {event.location}
              </p>
            </div>

            {event.url !== '#' && (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
              >
                View external event
                <ExternalLink size={16} />
              </a>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}