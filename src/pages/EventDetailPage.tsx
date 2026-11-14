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
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { getEvent, listClubs, listMyRsvps, listRsvpCounts, setMyRsvp } from '../lib/api'
import {
  appUrl,
  mapLinks,
  eventImage,
  eventTimeRange,
  formatDate,
  friendlyError,
  isRsvpOpen,
  rsvpDeadline,
  todayKst,
} from '../lib/format'
import type { RsvpStatus } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import Breadcrumbs from '../components/Breadcrumbs'
import FeedbackCard from '../components/FeedbackCard'
import { usePageMeta } from '../lib/usePageMeta'
import { ErrorBox, Spinner, buttonSecondary, card, inputClass } from '../components/ui'

const categoryTranslation: Record<string, TranslationKey> = {
  Sports: 'category.sports',
  Social: 'category.social',
  Academic: 'category.academic',
  Career: 'category.career',
  Cultural: 'category.cultural',
  Religious: 'category.religious',
}

const OPTIONS: { value: RsvpStatus; label: TranslationKey; active: string }[] = [
  { value: 'attending', label: 'eventDetail.imGoing', active: 'border-green-600 bg-green-50 text-green-700' },
  { value: 'maybe', label: 'eventDetail.maybeOption', active: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: 'not_attending', label: 'eventDetail.cantGo', active: 'border-slate-500 bg-slate-100 text-slate-700' },
]

export default function EventDetailPage() {
  const { t } = useLanguage()
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
        <h1 className="text-xl font-bold">{t('eventDetail.notFound')}</h1>
        <p className="text-sm text-slate-500">
          {t('eventDetail.notFoundHint')}
        </p>
        <Link to="/events" className="inline-block text-sm font-semibold text-primary">
          {t('eventDetail.backToEvents')}
        </Link>
      </div>
    )
  }

  const { event, mine, counts } = data
  const open = isRsvpOpen(event)
  const full = event.capacity !== null && counts.attending >= event.capacity
  const commentValue = comment ?? mine?.comment ?? ''
  // "How was it?" from the day of the event, for people who went.
  const showFeedback =
    mine !== null && (mine.status === 'attending' || mine.checked_in_at !== null) && event.event_date <= todayKst()

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
          ? t('eventDetail.attendingMessage')
          : status === 'maybe'
            ? t('eventDetail.maybeMessage')
            : t('eventDetail.notAttendingMessage'),
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
        <Breadcrumbs items={[[t('events.title'), '/events'], [event.title]]} />

        <div className="flex gap-2">
          <button onClick={share} className={buttonSecondary}>
            <Share2 size={16} />
            {copied ? t('eventDetail.linkCopied') : t('eventDetail.share')}
          </button>
          {isOrganizer && (
            <Link to={`/organizer?event=${event.id}`} className={buttonSecondary}>
              <Pencil size={16} />
              {t('eventDetail.manage')}
            </Link>
          )}
        </div>
      </div>

      <article className={`${card} overflow-hidden`}>
        <img
          src={eventImage(event)}
          alt={`${event.title} ${t('eventDetail.bannerAlt')}`}
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
                {categoryTranslation[event.category] ? t(categoryTranslation[event.category]) : event.category}
              </Link>
              {data.club && (
                <Link
                  to={`/clubs/${data.club.id}`}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Users size={12} /> {t('eventDetail.hostedBy')} {data.club.name}
                </Link>
              )}
            </div>
            <h1 className="mt-4 font-display text-5xl sm:text-6xl">{event.title}</h1>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile icon={<Clock size={18} />} label={t('eventDetail.when')}>
              {formatDate(event.event_date, 'long')}
              <br />
              {eventTimeRange(event)}
            </InfoTile>
            <InfoTile icon={<MapPin size={18} />} label={t('eventDetail.where')}>
              {event.location}
              <span className="mt-1.5 flex gap-3 text-xs font-semibold">
                <a href={mapLinks(event.location).naver} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {t('eventDetail.naverMap')}
                </a>
                <a href={mapLinks(event.location).kakao} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {t('eventDetail.kakaoMap')}
                </a>
              </span>
            </InfoTile>
            <InfoTile icon={<Users size={18} />} label={t('eventDetail.whosComing')}>
              {counts.attending} {t('eventDetail.going')} · {counts.maybe} {t('eventDetail.maybe')}
              {event.capacity !== null && (
                <>
                  <br />
                  {Math.max(event.capacity - counts.attending, 0)} / {event.capacity} {t('eventDetail.placesLeft')}
                </>
              )}
            </InfoTile>
          </div>

          {event.description && (
            <section>
              <h2 className="font-bold">{t('eventDetail.about')}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                {event.description}
              </p>
            </section>
          )}

          {(event.bring || event.notes) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {event.bring && (
                <InfoTile icon={<Backpack size={18} />} label={t('eventDetail.whatToBring')}>
                  {event.bring}
                </InfoTile>
              )}
              {event.notes && (
                <InfoTile icon={<StickyNote size={18} />} label={t('eventDetail.notes')}>
                  {event.notes}
                </InfoTile>
              )}
            </div>
          )}
        </div>
      </article>

      {showFeedback && <FeedbackCard eventId={event.id} />}

      <section className={`${card} p-5 sm:p-7`} aria-labelledby="rsvp-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rsvp-heading" className="text-lg font-bold">
            {mine ? `${t('eventDetail.yourAnswer')} ${t(mine.status === 'attending' ? 'eventDetail.imGoing' : mine.status === 'maybe' ? 'eventDetail.maybeOption' : 'eventDetail.cantGo')}` : t('eventDetail.areYouComing')}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={14} />
            {t('eventDetail.rsvpBy')} {formatDate(rsvpDeadline(event))}
          </p>
        </div>

        {!open ? (
          <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
            {t('eventDetail.rsvpsClosed')}
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
                    {saving === option.value ? t('eventDetail.saving') : blocked ? t('eventDetail.full') : t(option.label)}
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
                  placeholder={t('eventDetail.notePlaceholder')}
                  aria-label={t('eventDetail.noteLabel')}
                  className={`${inputClass} mt-0`}
                />
                <button
                  onClick={() => void saveComment()}
                  disabled={saving !== null || commentValue === mine.comment}
                  className={buttonSecondary}
                >
                  {t('eventDetail.save')}
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
              ✓ {t('eventDetail.checkedIn')}
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
