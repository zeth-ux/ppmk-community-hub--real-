import type {
  EventCategory,
  HubEvent,
  Profile,
  RsvpStatus,
} from './types'

/** Today's date in Korea as YYYY-MM-DD (matches the database's today_kst()). */
export function todayKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatDate(
  date: string,
  style: 'short' | 'long' = 'short',
): string {
  const d = new Date(`${date}T00:00:00`)

  return d.toLocaleDateString(
    'en-GB',
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  )
}

export function formatTime(time: string | null): string {
  return time ? time.slice(0, 5) : ''
}

export function eventTimeRange(event: HubEvent): string {
  const start = formatTime(event.start_time)
  const end = formatTime(event.end_time)

  return end ? `${start}–${end}` : start
}

export function rsvpDeadline(event: HubEvent): string {
  return event.rsvp_deadline ?? event.event_date
}

export function isRsvpOpen(event: HubEvent): boolean {
  return todayKst() <= rsvpDeadline(event)
}

export function isPast(event: HubEvent): boolean {
  return event.event_date < todayKst()
}

export const STATUS_LABEL: Record<RsvpStatus, string> = {
  attending: 'Going',
  maybe: 'Maybe',
  not_attending: 'Not going',
}

export const STATUS_STYLE: Record<RsvpStatus, string> = {
  attending: 'bg-green-50 text-green-700 border-green-200',
  maybe: 'bg-amber-50 text-amber-700 border-amber-200',
  not_attending: 'bg-slate-100 text-slate-600 border-slate-200',
}

const CATEGORY_IMAGES: Record<EventCategory, string> = {
  Sports: '/images/ppmk-sports-day.jpg',
  Social: '/images/welcome-dinner.jpg',
  Academic: '/images/study-group-night.jpg',
  Career: '/images/career-talk-alumni.jpg',
  Cultural: '/images/malaysian-culture-workshop.jpg',
  Religious: '/images/faith-community-gathering.jpg',
}

export function eventImage(event: Pick<HubEvent, 'image_url' | 'category'>) {
  return event.image_url || CATEGORY_IMAGES[event.category]
}

export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false

  return Boolean(
    profile.student_id &&
      profile.full_name &&
      profile.batch &&
      profile.age &&
      profile.phone &&
      profile.course &&
      profile.residence &&
      profile.consent_at,
  )
}

export function firstName(profile: Profile | null): string {
  return profile?.full_name?.split(' ')[0] ?? 'there'
}

/** Turns database / network errors into sentences a student can act on. */
export function friendlyError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)

  if (message.includes('EVENT_FULL'))
    return 'Sorry, this event is full. You can still choose "Maybe".'
  if (message.includes('LAST_ADMIN'))
    return 'You are the only admin. Make someone else an admin first.'
  if (message.includes('NOT_ALLOWED'))
    return "You don't have permission to do that."
  if (message.includes('profiles_student_id_key'))
    return 'That student ID is already registered to another account.'
  if (message.includes('permission denied for'))
    return 'The server refused this action (database permissions). Please tell the EMSU tech team.'
  if (message.includes('row-level security'))
    return 'This action is not allowed. The RSVP may be closed, or your profile may be incomplete.'
  if (message.includes('rate limit') || message.includes('over_email_send_rate_limit'))
    return 'Too many login emails were sent. Please wait a few minutes and try again.'
  if (message.includes('Token has expired') || message.includes('otp_expired'))
    return 'That code has expired or is wrong. Please request a new one.'
  if (message.includes('Failed to fetch'))
    return 'Could not reach the server. Check your internet connection.'

  return message
}
