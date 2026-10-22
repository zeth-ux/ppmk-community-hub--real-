import { Link } from 'react-router-dom'
import { Clock, MapPin, Users } from 'lucide-react'

import {
  STATUS_LABEL,
  STATUS_STYLE,
  eventImage,
  eventTimeRange,
  formatDate,
  isPast,
} from '../lib/format'
import type { HubEvent, RsvpCounts, RsvpStatus } from '../lib/types'

export default function EventCard({
  event,
  myStatus,
  counts,
  compact = false,
}: {
  event: HubEvent
  myStatus?: RsvpStatus
  counts?: RsvpCounts
  compact?: boolean
}) {
  const going = counts?.attending ?? 0
  const full = event.capacity !== null && going >= event.capacity

  return (
    <Link
      to={`/events/${event.id}`}
      className={`group flex overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-primary hover:shadow-md ${
        compact ? 'flex-row' : 'flex-col'
      } ${isPast(event) ? 'opacity-70' : ''}`}
    >
      <img
        src={eventImage(event)}
        alt=""
        loading="lazy"
        className={compact ? 'h-auto w-24 shrink-0 object-cover sm:w-32' : 'h-40 w-full object-cover'}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {event.category}
          </span>

          {myStatus && (
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[myStatus]}`}
            >
              {STATUS_LABEL[myStatus]}
            </span>
          )}

          {full && !compact && (
            <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
              Full
            </span>
          )}
        </div>

        <h2 className="mt-2 font-bold leading-snug group-hover:text-primary">
          {event.title}
        </h2>

        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <p className="flex items-center gap-1.5">
            <Clock size={14} className="shrink-0" />
            {formatDate(event.event_date)} · {eventTimeRange(event)}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </p>
          {!compact && (
            <p className="flex items-center gap-1.5">
              <Users size={14} className="shrink-0" />
              {going} going
              {event.capacity !== null && ` · ${event.capacity} ${event.capacity === 1 ? 'place' : 'places'}`}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
