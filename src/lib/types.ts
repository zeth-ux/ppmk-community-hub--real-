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
  /** Public display name (lowercase letters, numbers, _ and .). */
  username: string | null
  /** 'visitor' = not a PPMK member: only the public Explore Korea topics. */
  account_type: 'member' | 'visitor'
  /** "Your event is tomorrow" emails (0009). Missing until 0009 is installed. */
  email_reminders?: boolean
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
  | 'username'
  | 'account_type'
>

export type Announcements = {
  en: string
  ms: string
  ko: string
  tone: 'friendly' | 'formal' | 'short'
  model: string
  /** Which event facts it was written from (see announcementSource). */
  source: string
  generated_at: string
}

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
  announcements: Announcements | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EventInput = Omit<
  HubEvent,
  'id' | 'created_by' | 'created_at' | 'updated_at' | 'announcements'
>

export type Rsvp = {
  event_id: string
  user_id: string
  status: RsvpStatus
  comment: string
  checked_in_at: string | null
  /** Secret code behind the student's check-in QR (0008). */
  checkin_code?: string
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
  status: 'active' | 'inactive'
  tagline: string
  about: string
  meeting_info: string
  instagram: string | null
  cover_url: string | null
  join_policy: 'open' | 'approval'
  who_can_post: 'leaders' | 'members'
  posts_visibility: 'everyone' | 'members'
  created_at: string
  updated_at: string
}

export type ClubInput = Omit<Club, 'id' | 'created_at' | 'updated_at'>

export type ClubRole = 'president' | 'vice_president' | 'committee' | 'member'

export const CLUB_ROLE_LABEL: Record<ClubRole, string> = {
  president: 'President',
  vice_president: 'Vice President',
  committee: 'Committee',
  member: 'Member',
}

export type ClubMembership = {
  club_id: string
  user_id: string
  role: ClubRole
  status: 'pending' | 'active'
  message: string
  created_at: string
}

export type ClubMemberRow = {
  user_id: string
  username: string | null
  role: ClubRole
  status: 'pending' | 'active'
  message: string
  batch: number | null
  joined_at: string
}

export type ClubMemberCount = { club_id: string; members: number; pending: number }

export type ClubPostKind = 'update' | 'activity' | 'meeting'

export type ClubPost = {
  id: string
  club_id: string
  author_id: string | null
  kind: ClubPostKind
  title: string
  body: string
  meeting_at: string | null
  location: string
  visibility: 'everyone' | 'members'
  pinned: boolean
  created_at: string
  updated_at: string
  /** Filled in by the app from public_usernames(). */
  author_username?: string | null
}

export type ClubPostInput = Pick<
  ClubPost,
  'kind' | 'title' | 'body' | 'meeting_at' | 'location' | 'visibility' | 'pinned'
>

export type ApplicationStatus = 'pending' | 'needs_changes' | 'approved' | 'rejected'

export type ClubApplication = {
  id: string
  applicant_id: string
  club_name: string
  category: string
  tagline: string
  description: string
  objectives: string
  activities_plan: string
  advisor_name: string
  founding_members: string
  documents: Record<string, string>
  status: ApplicationStatus
  admin_note: string
  reviewed_at: string | null
  club_id: string | null
  created_at: string
  updated_at: string
}

export type ClubApplicationInput = Pick<
  ClubApplication,
  | 'club_name'
  | 'category'
  | 'tagline'
  | 'description'
  | 'objectives'
  | 'activities_plan'
  | 'advisor_name'
  | 'founding_members'
  | 'documents'
>

export type PublicClub = { id: string; name: string; category: string; tagline: string; members: number }

// ---------- Discussion board ----------

export type ForumGroupId = 'explore' | 'life' | 'teamup'

/** The board is split into three sections so people can focus. */
export const FORUM_GROUPS: { id: ForumGroupId; label: string; emoji: string; blurb: string; public: boolean }[] = [
  { id: 'explore', label: 'Explore Korea', emoji: '🧭', blurb: 'Food, hidden gems, trips and budgets. Open to everyone, visitors too.', public: true },
  { id: 'life', label: 'Student life', emoji: '🎓', blurb: 'Study help, visas & housing, jobs, and general talk. PPMK members only.', public: false },
  { id: 'teamup', label: 'Team up', emoji: '🤝', blurb: 'Find teammates for hackathons, startups, competitions and external programmes.', public: false },
]

export const FORUM_CATEGORIES = [
  { id: 'food', group: 'explore', label: 'Makan & halal food', emoji: '🍜', hint: 'Halal, Malaysian & must-try food' },
  { id: 'hidden_gems', group: 'explore', label: 'Hidden gems', emoji: '💎', hint: 'Gatekept spots worth sharing' },
  { id: 'hangout', group: 'explore', label: 'Cafés & hangouts', emoji: '☕', hint: 'Cafés, parks, places to chill' },
  { id: 'trips', group: 'explore', label: 'Trips & itineraries', emoji: '🗺️', hint: 'Club MT, staycations, day trips, routes' },
  { id: 'budget', group: 'explore', label: 'Budget & holiday tips', emoji: '💸', hint: 'What it costs, how to save, deals' },
  { id: 'study', group: 'life', label: 'Study', emoji: '📚', hint: 'Courses, exams, notes, TOPIK' },
  { id: 'serious', group: 'life', label: 'Visa, housing & help', emoji: '💬', hint: 'Serious questions and wellbeing' },
  { id: 'career', group: 'life', label: 'Jobs & internships', emoji: '💼', hint: 'Part-time, internships, CVs' },
  { id: 'general', group: 'life', label: 'General', emoji: '🗣️', hint: 'Anything else' },
  { id: 'hackathon', group: 'teamup', label: 'Hackathons & competitions', emoji: '🏆', hint: 'Looking for teammates' },
  { id: 'startup', group: 'teamup', label: 'Startups & side projects', emoji: '🚀', hint: 'Co-founders, builders, testers' },
  { id: 'activities', group: 'teamup', label: 'External programmes', emoji: '🌏', hint: 'Forums, exchanges, volunteering' },
] as const

export type ForumCategory = (typeof FORUM_CATEGORIES)[number]['id']

/** Categories where a post is about a place you can go to. */
export const PLACE_CATEGORIES: ForumCategory[] = ['hidden_gems', 'food', 'hangout', 'trips']
/** Categories where a rough cost helps ("~₩15,000 per person"). */
export const COST_CATEGORIES: ForumCategory[] = ['food', 'hidden_gems', 'hangout', 'trips', 'budget']
export const TEAMUP_CATEGORIES: ForumCategory[] = ['hackathon', 'startup', 'activities']
export const PUBLIC_CATEGORIES: ForumCategory[] = ['food', 'hidden_gems', 'hangout', 'trips', 'budget']

export type ForumPost = {
  id: string
  category: ForumCategory
  title: string
  body: string
  place_name: string | null
  place_area: string | null
  map_url: string | null
  cost_note: string | null
  link_url: string | null
  deadline: string | null
  looking_for: string | null
  is_closed: boolean
  is_anonymous: boolean
  /** null when the author chose to stay anonymous. */
  author_username: string | null
  is_mine: boolean
  score: number
  my_vote: -1 | 1 | null
  comment_count: number
  created_at: string
  updated_at: string
}

export type ForumPostInput = Pick<
  ForumPost,
  | 'category'
  | 'title'
  | 'body'
  | 'place_name'
  | 'place_area'
  | 'map_url'
  | 'cost_note'
  | 'link_url'
  | 'deadline'
  | 'looking_for'
  | 'is_closed'
  | 'is_anonymous'
>

export type ForumComment = {
  id: string
  parent_id: string | null
  body: string
  is_anonymous: boolean
  author_username: string | null
  is_mine: boolean
  is_op: boolean
  created_at: string
}

export type ForumSort = 'hot' | 'new' | 'top'

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

export type AiUsageRow = {
  kind: 'extract' | 'announce' | 'ask'
  total: number
  last_7_days: number
  people: number
}

// ---------- Explore: opportunities beyond PPMK ----------

export const OPPORTUNITY_KINDS = {
  conference: { label: 'Forums & conferences', emoji: '🎤' },
  culture: { label: 'Culture & networking', emoji: '🎎' },
  competition: { label: 'Competitions & hackathons', emoji: '🏆' },
  scholarship: { label: 'Scholarships & exchanges', emoji: '🎓' },
  volunteer: { label: 'Volunteering', emoji: '🤲' },
  career: { label: 'Careers & job fairs', emoji: '💼' },
  sports: { label: 'Sports', emoji: '⚽' },
  other: { label: 'Other', emoji: '✨' },
} as const

export type OpportunityKind = keyof typeof OPPORTUNITY_KINDS

export const OPPORTUNITY_SCOPES = {
  korea: { label: 'In Korea', emoji: '🇰🇷' },
  asia: { label: 'Asia', emoji: '🌏' },
  global: { label: 'Global', emoji: '🌍' },
  online: { label: 'Online', emoji: '💻' },
} as const

export type OpportunityScope = keyof typeof OPPORTUNITY_SCOPES

export type Opportunity = {
  id: string
  title: string
  organizer: string
  kind: OpportunityKind
  scope: OpportunityScope
  location: string
  start_date: string | null
  end_date: string | null
  apply_deadline: string | null
  url: string | null
  description: string
  status: 'suggested' | 'published' | 'archived'
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'created_by' | 'created_at' | 'updated_at'>

// ---------- Homepage (signed out) ----------

export type PublicEvent = {
  id: string
  title: string
  category: string
  event_date: string
  start_time: string
  location: string
  club_name: string | null
}

export type PublicStats = { members: number; clubs: number; events_this_year: number }

// ---------- Photos (admin-approved) ----------

export type PhotoTargetKey = 'forum_post_id' | 'club_post_id' | 'club_id'
export type PhotoTarget = Partial<Record<PhotoTargetKey, string>>

export type Photo = {
  id: string
  path: string
  uploaded_by: string
  forum_post_id: string | null
  club_post_id: string | null
  club_id: string | null
  caption: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason: string
  created_at: string
  /** Short-lived signed link to the image. */
  url: string
  /** Admin queue only: where the photo will appear. */
  context?: { label: string; href: string }
}

// ---------- PPMK organisation page ----------

export type OrgMember = {
  id: string
  kind: 'committee' | 'sponsor'
  /** 'MARA', 'JPA', ... for sponsor officers. */
  sponsor: string | null
  role: string
  /** Committee level: 1 President … 5 committee members. */
  tier: CommitteeTier
  name: string
  detail: string
  session: string
  /** null for people who are not signed-in members. */
  email: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  /** Path in the public "org-photos" storage. */
  photo_path: string | null
  /** Ready-to-use image link (filled in by the app). */
  photo_url?: string | null
  sort_order: number
  /** True when contacts exist but are hidden (not a member). */
  contacts_hidden: boolean
}

export type OrgMemberInput = Omit<OrgMember, 'id' | 'contacts_hidden' | 'photo_url'>

export type CommitteeTier = 1 | 2 | 3 | 4 | 5

/** The High Committee hierarchy, top to bottom. */
export const COMMITTEE_TIERS: Record<CommitteeTier, { label: string; plural: string }> = {
  1: { label: 'President', plural: 'President' },
  2: { label: 'Vice President', plural: 'Vice Presidents' },
  3: { label: 'Secretariat & Treasury', plural: 'Secretariat & Treasury' },
  4: { label: 'Bureau head', plural: 'Bureaus' },
  5: { label: 'Committee member (AJK)', plural: 'Committee members' },
}

/** Best guess of the level from the role name (English or Malay). Admins can change it. */
export function guessTier(role: string): CommitteeTier {
  const r = role.toLowerCase()
  if (/(vice|deputy|timbalan|naib)/.test(r)) return 2
  if (/(^|\s)(president|presiden|yang dipertua)\b/.test(r)) return 1
  if (/(secretar|setiausaha|treasur|bendahari)/.test(r)) return 3
  if (/(^|\b)(ajk|member|ahli)\b/.test(r)) return 5
  return 4
}

export const CALENDAR_CATEGORIES = {
  event: { label: 'Event', dot: 'bg-primary' },
  festive: { label: 'Festive', dot: 'bg-gold' },
  sports: { label: 'Sports', dot: 'bg-emerald-500' },
  academic: { label: 'Academic', dot: 'bg-sky-500' },
  deadline: { label: 'Deadline', dot: 'bg-red-600' },
  meeting: { label: 'Meeting', dot: 'bg-slate-400' },
} as const

export type CalendarCategory = keyof typeof CALENDAR_CATEGORIES

export type OrgCalendarItem = {
  id: string
  title: string
  category: CalendarCategory
  start_date: string
  end_date: string | null
  location: string
  description: string
  url: string | null
}

export type OrgCalendarInput = Omit<OrgCalendarItem, 'id'>

// ---------- Post-event feedback (0007) ----------

export type EventFeedback = {
  event_id: string
  user_id: string
  rating: number
  comment: string
  created_at: string
  updated_at: string
}

/** What an organizer sees: numbers and comments, never who wrote them. */
export type EventFeedbackReport = {
  responses: number
  average: number | null
  /** How many people gave 1, 2, 3, 4 and 5 stars. */
  stars: [number, number, number, number, number]
  comments: { rating: number; comment: string; given_on: string }[]
}

export type FeedbackOverview = {
  responses: number
  average: number | null
  events_rated: number
}

// ---------- QR check-in (0008) ----------

export type CheckInResult = {
  event_id: string
  event_title: string
  event_date: string
  user_id: string
  full_name: string | null
  student_id: string | null
  batch: number | null
  status: RsvpStatus
  checked_in_at: string
  /** True if this QR was already scanned before (nothing changed). */
  already_checked_in: boolean
}
