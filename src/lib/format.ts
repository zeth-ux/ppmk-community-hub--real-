import { FORUM_CATEGORIES } from './types'
import type {
  Club,
  EventCategory,
  ForumCategory,
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
  Sports: '/images/ppmk-sports-day.webp',
  Social: '/images/welcome-dinner.webp',
  Academic: '/images/study-group-night.webp',
  Career: '/images/career-talk-alumni.webp',
  Cultural: '/images/malaysian-culture-workshop.webp',
  Religious: '/images/faith-community-gathering.webp',
}

export function eventImage(event: Pick<HubEvent, 'image_url' | 'category'>) {
  return event.image_url || CATEGORY_IMAGES[event.category]
}

export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false
  // Visitors only need a username and consent.
  if (profile.account_type === 'visitor') return Boolean(profile.username && profile.consent_at)

  return Boolean(
    profile.student_id &&
      profile.full_name &&
      profile.batch &&
      profile.age &&
      profile.phone &&
      profile.course &&
      profile.residence &&
      profile.username &&
      profile.consent_at,
  )
}

export function firstName(profile: Profile | null): string {
  return profile?.full_name?.split(' ')[0] ?? 'there'
}

/** What other students see: the username, never the registered full name. */
export function displayName(profile: Profile | null): string {
  return profile?.username ? `@${profile.username}` : firstName(profile)
}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/

/** "3h ago", "2d ago", or a date for older things. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
  if (message.includes('FEEDBACK_CLOSED'))
    return 'Feedback is open from the day of the event until 14 days after, for people who went.'
  if (message.includes('BAD_CHECKIN_CODE'))
    return "This QR code isn't valid. The RSVP may have been removed."
  if (message.includes('LAST_ADMIN'))
    return 'You are the only admin. Make someone else an admin first.'
  if (message.includes('NOT_ALLOWED'))
    return "You don't have permission to do that."
  if (message.includes('profiles_username_key'))
    return 'That username is taken. Try another one.'
  if (message.includes('profiles_username_format'))
    return 'Usernames are 3–20 lowercase letters, numbers, _ or .'
  if (message.includes('PHOTO_DAILY_LIMIT'))
    return 'You have uploaded a lot of photos today. Please try again tomorrow.'
  if (message.includes('PHOTO_POST_LIMIT'))
    return 'You can add up to 6 photos to a post.'
  if (message.includes('MEMBERS_ONLY'))
    return 'This part of the hub is for PPMK members.'
  if (message.includes('LAST_PRESIDENT'))
    return 'A club needs a president. Hand the role to someone else first.'
  if (message.includes('ONLY_PRESIDENT'))
    return 'Only the club president can change the president or vice president.'
  if (message.includes('PROFILE_INCOMPLETE'))
    return 'Please finish your profile first.'
  if (message.includes('ALREADY_DECIDED'))
    return 'This application has already been decided.'
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

const CLUB_PALETTES = [
  'from-rose-500 to-red-700',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-700',
  'from-amber-500 to-orange-600',
  'from-fuchsia-500 to-purple-700',
  'from-slate-600 to-slate-800',
]

export function clubGradient(club: Pick<Club, 'name'>): string {
  let hash = 0
  for (const ch of club.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CLUB_PALETTES[hash % CLUB_PALETTES.length]
}


export function isMemberProfile(profile: Profile | null): boolean {
  return Boolean(profile && (profile.role !== 'student' || profile.account_type !== 'visitor') && isProfileComplete(profile))
}

export function categoryInfo(id: ForumCategory) {
  return FORUM_CATEGORIES.find((c) => c.id === id) ?? FORUM_CATEGORIES[FORUM_CATEGORIES.length - 1]
}

export function forumGroupOf(category: ForumCategory) {
  return categoryInfo(category).group
}

/** "Closes in 3 days", "Closes today", "Closed". */
export function deadlineLabel(date: string | null): { text: string; urgent: boolean; past: boolean } | null {
  if (!date) return null
  const today = new Date(`${todayKst()}T00:00:00`).getTime()
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - today) / 86400000)
  if (days < 0) return { text: 'Deadline passed', urgent: false, past: true }
  if (days === 0) return { text: 'Closes today', urgent: true, past: false }
  if (days === 1) return { text: 'Closes tomorrow', urgent: true, past: false }
  return { text: days <= 14 ? `Closes in ${days} days` : `Closes ${formatDate(date)}`, urgent: days <= 3, past: false }
}

/** Full link to a page of the app (for sharing). */
export function appUrl(path: string): string {
  return import.meta.env.MODE === 'demo' ? `${window.location.origin}/#${path}` : `${window.location.origin}${path}`
}

/** Search links for a place in the two map apps people use in Korea. */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query.trim())
  return {
    naver: `https://map.naver.com/p/search/${q}`,
    kakao: `https://map.kakao.com/?q=${q}`,
  }
}
