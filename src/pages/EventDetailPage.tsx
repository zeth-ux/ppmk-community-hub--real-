import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Backpack,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Share2,
  StickyNote,
  Users,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { getEvent, listClubs, listMyRsvps, listRsvpCounts, setMyRsvp } from '../lib/api'
import {
  STATUS_LABEL,
  appUrl,
  mapLinks,
  eventImage,
  eventTimeRange,
  formatDate,
  friendlyError,
  isRsvpOpen,
  rsvpDeadline,
} from '../lib/format'
import type { RsvpStatus } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import Breadcrumbs from '../components/Breadcrumbs'
import { usePageMeta } from '../lib/usePageMeta'
import { ErrorBox, Spinner, buttonSecondary, card, inputClass } from '../components/ui'

const OPTIONS: { value: RsvpStatus; label: string; active: string }[] = [
  { value: 'attending', label: "I'm going", active: 'border-green-600 bg-green-50 text-green-700' },
  { value: 'maybe', label: 'Maybe', active: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: 'not_attending', label: "Can't go", active: 'border-slate-500 bg-slate-100 text-slate-700' },
]

export default function EventDetailPage() {
  const { id = '' } = useParams()
  const { session, isOrganizer } = useAuth()
  const userId = session!.user.id

  const { data, setData, loading, error } = useLoader(async () => {
    const [event, rsvps, counts, clubs] = await Promise.all([
      getEvent(id),
      listMyRsvps(userId),
      listRsvpCounts(),
      listClubs().catch(() => []),
    ])
    return {
      event,
      club: clubs.find((c) => c.id === event?.club_id) ?? null,
      mine: rsvps.find((r) => r.event_id === id) ?? null,
      counts: counts[id] ?? { event_id: id, attending: 0, maybe: 0, not_attending: 0 },
    }
  }, [id, userId])
  usePageMeta(data?.event?.title, data?.event?.description)

  const [comment, setComment] = useState<string | null>(null)
  const [saving, setSaving] = useState<RsvpStatus | 'comment' | null>(null)
  const [message, setMessage] = useState('')
  const [rsvpError, setRsvpError] = useState('')
  const [copied, setCopied] = useState(false)

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>

  if (!data?.event) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-200 bg-surface p-8 text-center">
        <h1 className="text-xl font-bold">Event not found</h1>
        <p className="text-sm text-slate-500">
          It may have been removed, or it's only open to certain batches or
          invited members.
        </p>
        <Link to="/events" className="inline-block text-sm font-semibold text-primary">
          Back to events
        </Link>
      </div>
    )
  }

  const { event, mine, counts } = data
  const open = isRsvpOpen(event)
  const full = event.capacity !== null && counts.attending >= event.capacity
  const commentValue = comment ?? mine?.comment ?? ''

  async function choose(status: RsvpStatus) {
    if (!data) return
    setSaving(status)
    setRsvpError('')
    setMessage('')

    try {
      const saved = await setMyRsvp(event.id, status, commentValue)
      const freshCounts = (await listRsvpCounts())[event.id] ?? counts
      setData({ ...data, mine: saved, counts: freshCounts })
      setMessage(
        status === 'attending'
          ? "You're in! The organizers have your details."
          : status === 'maybe'
            ? 'Saved as maybe. You can change it any time before the deadline.'
            : "Thanks for letting the organizers know.",
      )
    } catch (err) {
      setRsvpError(friendlyError(err))
    } finally {
      setSaving(null)
    }
  }

  async function saveComment() {
    if (!mine) return
    await choose(mine.status)
  }

  async function share() {
    const url = appUrl(`/events/${event.id}`)
    const text = `${event.title}: ${formatDate(event.event_date)}, ${eventTimeRange(event)} at ${event.location}. RSVP here:`

    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url })
        return
      } catch {
        // user cancelled: fall through to copying
      }
    }

    await navigator.clipboard.writeText(`${text} ${url}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumbs items={[['Events', '/events'], [event.title]]} />

        <div className="flex gap-2">
          <button onClick={share} className={buttonSecondary}>
            <Share2 size={16} />
            {copied ? 'Link copied' : 'Share'}
          </button>
          {isOrganizer && (
            <Link to={`/organizer?event=${event.id}`} className={buttonSecondary}>
              <Pencil size={16} />
              Manage
            </Link>
          )}
        </div>
      </div>

      <article className={`${card} overflow-hidden`}>
        <img
          src={eventImage(event)}
          alt={`${event.title} event banner`}
          className="h-44 w-full object-cover sm:h-60"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />

        <div className="space-y-6 p-5 sm:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/events?category=${encodeURIComponent(event.category)}`}
                className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-primary hover:bg-red-100"
              >
                {event.category}
              </Link>
              {data.club && (
                <Link
                  to={`/clubs/${data.club.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Users size={12} /> Hosted by {data.club.name}
                </Link>
              )}
            </div>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl">{event.title}</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile icon={<Clock size={18} />} label="When">
              {formatDate(event.event_date, 'long')}
              <br />
              {eventTimeRange(event)}
            </InfoTile>
            <InfoTile icon={<MapPin size={18} />} label="Where">
              {event.location}
              <span className="mt-1.5 flex gap-3 text-xs font-semibold">
                <a href={mapLinks(event.location).naver} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Naver Map
                </a>
                <a href={mapLinks(event.location).kakao} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Kakao Map
                </a>
              </span>
            </InfoTile>
            <InfoTile icon={<Users size={18} />} label="Who's coming">
              {counts.attending} going · {counts.maybe} maybe
              {event.capacity !== null && (
                <>
                  <br />
                  {Math.max(event.capacity - counts.attending, 0)} of {event.capacity} places left
                </>
              )}
            </InfoTile>
          </div>

          {event.description && (
            <section>
              <h2 className="font-bold">About</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                {event.description}
              </p>
            </section>
          )}

          {(event.bring || event.notes) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {event.bring && (
                <InfoTile icon={<Backpack size={18} />} label="What to bring">
                  {event.bring}
                </InfoTile>
              )}
              {event.notes && (
                <InfoTile icon={<StickyNote size={18} />} label="Notes">
                  {event.notes}
                </InfoTile>
              )}
            </div>
          )}
        </div>
      </article>

      <section className={`${card} p-5 sm:p-7`} aria-labelledby="rsvp-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rsvp-heading" className="text-lg font-bold">
            {mine ? `Your answer: ${STATUS_LABEL[mine.status]}` : 'Are you coming?'}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={14} />
            RSVP by {formatDate(rsvpDeadline(event))}
          </p>
        </div>

        {!open ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            RSVPs for this event are closed.
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {OPTIONS.map((option) => {
                const selected = mine?.status === option.value
                const blocked = option.value === 'attending' && full && !selected

                return (
                  <button
                    key={option.value}
                    onClick={() => void choose(option.value)}
                    disabled={saving !== null || blocked}
                    aria-pressed={selected}
                    className={`rounded-xl border-2 px-2 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected ? option.active : 'border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {saving === option.value ? 'Saving…' : blocked ? 'Full' : option.label}
                  </button>
                )
              })}
            </div>

            {mine && (
              <div className="mt-4 flex gap-2">
                <input
                  value={commentValue}
                  onChange={(e) => setComment(e.target.value)}
                  maxLength={500}
                  placeholder="Add a note for the organizers (optional)"
                  aria-label="Note for the organizers"
                  className={`${inputClass} mt-0`}
                />
                <button
                  onClick={() => void saveComment()}
                  disabled={saving !== null || commentValue === mine.comment}
                  className={buttonSecondary}
                >
                  Save
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-4 space-y-2">
          <ErrorBox>{rsvpError}</ErrorBox>
          {message && (
            <p className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">
              <CheckCircle2 size={18} />
              {message}
            </p>
          )}
          {mine?.checked_in_at && (
            <p className="text-sm font-semibold text-green-700">
              ✓ Checked in at the event
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

function InfoTile({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-primary">{icon}</div>
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{children}</p>
    </div>
  )
}
