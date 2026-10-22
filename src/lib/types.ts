export const CATEGORIES = [
  'Sports',
  'Social',
  'Academic',
  'Career',
  'Cultural',
  'Religious',
] as const

export type EventCategory = (typeof CATEGORIES)[number]

export type AppRole = 'student' | 'organizer' | 'admin'
export type RsvpStatus = 'attending' | 'maybe' | 'not_attending'
export type Audience = 'everyone' | 'batch' | 'custom'

export type Profile = {
  id: string
  email: string
  student_id: string | null
  full_name: string | null
  batch: number | null
  age: number | null
  phone: string | null
  course: string | null
  residence: string | null
  role: AppRole
  consent_at: string | null
  created_at: string
  updated_at: string
}

export type ProfileInput = Pick<
  Profile,
  | 'student_id'
  | 'full_name'
  | 'batch'
  | 'age'
  | 'phone'
  | 'course'
  | 'residence'
  | 'consent_at'
>

export type HubEvent = {
  id: string
  title: string
  category: EventCategory
  event_date: string // YYYY-MM-DD
  start_time: string // HH:MM:SS
  end_time: string | null
  location: string
  description: string
  bring: string
  notes: string
  capacity: number | null
  rsvp_deadline: string | null
  image_url: string | null
  club_id: string | null
  audience: Audience
  audience_batches: number[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EventInput = Omit<
  HubEvent,
  'id' | 'created_by' | 'created_at' | 'updated_at'
>

export type Rsvp = {
  event_id: string
  user_id: string
  status: RsvpStatus
  comment: string
  checked_in_at: string | null
  created_at: string
  updated_at: string
}

export type RsvpCounts = {
  event_id: string
  attending: number
  maybe: number
  not_attending: number
}

export type Club = {
  id: string
  name: string
  category: string
  description: string
  leader_name: string | null
  leader_contact: string | null
  logo_url: string | null
  join_url: string | null
  created_at: string
  updated_at: string
}

export type ClubInput = Omit<Club, 'id' | 'created_at' | 'updated_at'>

export type Attendee = {
  user_id: string
  full_name: string | null
  student_id: string | null
  batch: number | null
  course: string | null
  residence: string | null
  phone: string | null
  email: string
  status: RsvpStatus
  comment: string
  responded_at: string
  checked_in_at: string | null
}

export type Member = {
  id: string
  full_name: string | null
  batch: number | null
  course: string | null
}

export type HubStats = {
  members: number
  complete_profiles: number
  organizers: number
  events: number
  upcoming_events: number
  rsvps: number
  check_ins: number
}
