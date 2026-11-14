import { MessageSquareQuote, Star } from 'lucide-react'

import { getEventFeedback } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useLoader } from '../../lib/useLoader'
import { Spinner, card } from '../ui'

/**
 * Post-event feedback for organizers: average, 1–5 breakdown and comments.
 * Anonymous by design: the database never tells the organizer who wrote what.
 */
export default function FeedbackPanel({ eventId, going }: { eventId: string; going: number }) {
  const { data, loading } = useLoader(() => getEventFeedback(eventId), [eventId])

  if (loading) return <Spinner label="Loading feedback…" />
  // Not installed yet (database update 0007) or no permission: hide quietly.
  if (!data) return null

  const max = Math.max(...data.stars, 1)

  return (
    <section className={`${card} p-5 sm:p-6`} aria-labelledby="feedback-results">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="feedback-results" className="font-bold">Feedback</h3>
        <p className="text-xs text-slate-500">
          Anonymous · open for 14 days after the event
        </p>
      </div>

      {data.responses === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No feedback yet. People who went see a “How was it?” card on the event page.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="text-center sm:px-4">
              <p className="text-4xl font-bold">{data.average?.toFixed(1)}</p>
              <p className="mt-1 flex justify-center gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={14}
                    className={n <= Math.round(data.average ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                  />
                ))}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.responses} {data.responses === 1 ? 'response' : 'responses'}
                {/* People who said "can't go" but were checked in can rate too, so cap at 100%. */}
                {going > 0 && ` · ${Math.min(100, Math.round((data.responses / going) * 100))}% of people going`}
              </p>
            </div>

            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((n) => {
                const count = data.stars[n - 1]
                return (
                  <div key={n} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right font-semibold text-slate-600">{n}</span>
                    <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden />
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / max) * 100}%` }} />
                    </div>
                    <span className="w-6 text-right text-slate-500">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {data.comments.length > 0 && (
            <ul className="mt-5 space-y-2">
              {data.comments.map((c, i) => (
                <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-amber-600">
                      <MessageSquareQuote size={14} /> {c.rating}/5
                    </span>
                    <span>{formatDate(c.given_on)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-slate-700">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
