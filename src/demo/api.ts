// Design-preview stand-in for src/lib/api.ts (used only by `npm run demo`).
// Same exports, fake in-memory data, no network.
import type {
  AiUsageRow,
  Announcements,
  AppRole,
  Attendee,
  CheckInResult,
  Club,
  ClubApplication,
  ClubApplicationInput,
  ClubInput,
  ClubMemberCount,
  ClubMemberRow,
  ClubMembership,
  ClubPost,
  ClubPostInput,
  ClubRole,
  ForumComment,
  ForumPost,
  ForumPostInput,
  ForumSort,
  Opportunity,
  OpportunityInput,
  OrgCalendarInput,
  OrgCalendarItem,
  OrgMember,
  OrgMemberInput,
  Photo,
  PhotoTarget,
  PhotoTargetKey,
  PublicClub,
  PublicEvent,
  PublicStats,
  EventFeedback,
  EventFeedbackReport,
  EventInput,
  FeedbackOverview,
  HubEvent,
  HubStats,
  Member,
  Profile,
  ProfileInput,
  Rsvp,
  RsvpCounts,
  RsvpStatus,
} from '../lib/types'
import {
  DEMO_USER_ID,
  demoApplications,
  demoClubMembers,
  demoClubPosts,
  demoClubs,
  demoForumComments,
  demoForumPosts,
  demoOpportunities,
  demoOrgCalendar,
  demoOrgPeople,
  demoPhotos,
  demoUsernames,
  demoAccess,
  demoCounts,
  demoEvents,
  demoMembers,
  demoProfile,
  demoRsvps,
} from './data'

const wait = <T>(value: T, ms = 150) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(structuredClone(value)), ms))

const stamp = () => new Date().toISOString()
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`

// ---------- Profiles ----------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getMyProfile(_userId: string): Promise<Profile | null> {
  return wait(demoProfile)
}

export async function updateMyProfile(_userId: string, input: ProfileInput): Promise<Profile> {
  Object.assign(demoProfile, input, { updated_at: stamp() })
  return wait(demoProfile)
}

export async function setEmailReminders(_userId: string, on: boolean): Promise<Profile> {
  Object.assign(demoProfile, { email_reminders: on, updated_at: stamp() })
  return wait(demoProfile)
}

export async function deleteMyAccount(): Promise<void> {
  alertDemo('Account deletion is disabled in the design preview.')
}

// ---------- Events ----------

const sortEvents = () =>
  demoEvents.sort((a, b) => (a.event_date + a.start_time).localeCompare(b.event_date + b.start_time))

export async function listEvents(): Promise<HubEvent[]> {
  return wait(sortEvents())
}

export async function getEvent(id: string): Promise<HubEvent | null> {
  return wait(demoEvents.find((e) => e.id === id) ?? null)
}

export async function createEvent(input: EventInput): Promise<HubEvent> {
  const event: HubEvent = {
    ...input,
    id: newId('evt'),
    announcements: null,
    created_by: DEMO_USER_ID,
    created_at: stamp(),
    updated_at: stamp(),
  }
  demoEvents.push(event)
  demoCounts[event.id] = { attending: 0, maybe: 0, not_attending: 0 }
  return wait(event)
}

export async function updateEvent(id: string, input: EventInput): Promise<HubEvent> {
  const event = demoEvents.find((e) => e.id === id)
  if (!event) throw new Error('Event not found')
  Object.assign(event, input, { updated_at: stamp() })
  return wait(event)
}

export async function saveAnnouncements(id: string, announcements: Announcements | null): Promise<void> {
  const event = demoEvents.find((e) => e.id === id)
  if (event) event.announcements = announcements
  await wait(null)
}

export async function deleteEvent(id: string): Promise<void> {
  const i = demoEvents.findIndex((e) => e.id === id)
  if (i >= 0) demoEvents.splice(i, 1)
  await wait(null)
}

const invites: Record<string, string[]> = {}

export async function getEventInvites(eventId: string): Promise<string[]> {
  return wait(invites[eventId] ?? [])
}

export async function setEventInvites(eventId: string, userIds: string[]): Promise<number> {
  invites[eventId] = userIds
  return wait(userIds.length)
}

// ---------- RSVPs ----------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listMyRsvps(_userId: string): Promise<Rsvp[]> {
  return wait(demoRsvps)
}

export async function setMyRsvp(eventId: string, status: RsvpStatus, comment = ''): Promise<Rsvp> {
  const counts = (demoCounts[eventId] ??= { attending: 0, maybe: 0, not_attending: 0 })
  let rsvp = demoRsvps.find((r) => r.event_id === eventId)
  if (rsvp) {
    counts[rsvp.status] = Math.max(0, counts[rsvp.status] - 1)
    Object.assign(rsvp, { status, comment, updated_at: stamp() })
  } else {
    rsvp = { event_id: eventId, user_id: DEMO_USER_ID, status, comment, checked_in_at: null, checkin_code: crypto.randomUUID(), created_at: stamp(), updated_at: stamp() }
    demoRsvps.push(rsvp)
  }
  counts[status] += 1
  return wait(rsvp)
}

export async function listRsvpCounts(): Promise<Record<string, RsvpCounts>> {
  return wait(
    Object.fromEntries(Object.entries(demoCounts).map(([event_id, c]) => [event_id, { event_id, ...c }])),
  )
}

const checkIns: Record<string, string | null> = {}

export async function listAttendees(eventId: string): Promise<Attendee[]> {
  const statuses: RsvpStatus[] = ['attending', 'attending', 'maybe', 'attending', 'not_attending', 'attending', 'maybe', 'attending']
  return wait(
    demoMembers.map((m, i) => ({
      user_id: m.id,
      full_name: m.full_name,
      student_id: m.student_id,
      batch: m.batch,
      course: m.course,
      residence: m.residence,
      phone: m.phone,
      email: m.email,
      status: statuses[i % statuses.length],
      comment: i === 2 ? 'Coming after class' : '',
      responded_at: stamp(),
      checked_in_at: checkIns[`${eventId}:${m.id}`] ?? null,
    })),
  )
}

export async function checkInByCode(code: string): Promise<CheckInResult> {
  const rsvp = demoRsvps.find((r) => r.checkin_code === code)
  const event = demoEvents.find((e) => e.id === rsvp?.event_id)
  if (!rsvp || !event) throw new Error('BAD_CHECKIN_CODE')
  const already = rsvp.checked_in_at !== null
  if (!already) rsvp.checked_in_at = stamp()
  return wait({
    event_id: event.id,
    event_title: event.title,
    event_date: event.event_date,
    user_id: rsvp.user_id,
    full_name: demoProfile.full_name,
    student_id: demoProfile.student_id,
    batch: demoProfile.batch,
    status: rsvp.status,
    checked_in_at: rsvp.checked_in_at!,
    already_checked_in: already,
  })
}

export async function setCheckIn(eventId: string, userId: string, checkedIn: boolean): Promise<string | null> {
  const value = checkedIn ? stamp() : null
  checkIns[`${eventId}:${userId}`] = value
  return wait(value)
}

// ---------- Post-event feedback ----------

const demoFeedback: EventFeedback[] = []

export async function getMyFeedback(eventId: string): Promise<EventFeedback | null> {
  return wait(demoFeedback.find((f) => f.event_id === eventId) ?? null)
}

export async function canGiveFeedback(eventId: string): Promise<boolean> {
  const event = demoEvents.find((e) => e.id === eventId)
  const rsvp = demoRsvps.find((r) => r.event_id === eventId)
  const today = new Date().toISOString().slice(0, 10)
  return wait(Boolean(event && rsvp && (rsvp.status === 'attending' || rsvp.checked_in_at) && event.event_date <= today))
}

export async function setMyFeedback(eventId: string, rating: number, comment = ''): Promise<EventFeedback> {
  let row = demoFeedback.find((f) => f.event_id === eventId)
  if (row) Object.assign(row, { rating, comment, updated_at: stamp() })
  else {
    row = { event_id: eventId, user_id: DEMO_USER_ID, rating, comment, created_at: stamp(), updated_at: stamp() }
    demoFeedback.push(row)
  }
  return wait(row)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getEventFeedback(_eventId: string): Promise<EventFeedbackReport> {
  return wait({
    responses: 14,
    average: 4.4,
    stars: [0, 1, 1, 3, 9],
    comments: [
      { rating: 5, comment: 'Best futsal night so far, please do it every month!', given_on: '2026-11-08' },
      { rating: 4, comment: 'Fun, but it started 20 minutes late.', given_on: '2026-11-08' },
      { rating: 2, comment: 'Not enough water for everyone.', given_on: '2026-11-09' },
    ],
  })
}

export async function getFeedbackOverview(): Promise<FeedbackOverview> {
  return wait({ responses: 38, average: 4.31, events_rated: 4 })
}

// ---------- Members & admin ----------

export async function listMembers(): Promise<Member[]> {
  return wait(demoMembers.map(({ id, full_name, batch, course }) => ({ id, full_name, batch, course })))
}

export async function listAllProfiles(): Promise<Profile[]> {
  return wait(demoMembers)
}

export async function setUserRole(userId: string, role: AppRole) {
  const m = demoMembers.find((p) => p.id === userId)
  if (m) m.role = role
  await wait(null)
}

export async function getHubStats(): Promise<HubStats> {
  return wait({
    members: 68,
    complete_profiles: 61,
    organizers: 5,
    events: demoEvents.length,
    upcoming_events: demoEvents.length - 1,
    rsvps: 214,
    check_ins: 41,
  })
}

export async function getAiUsageStats(): Promise<AiUsageRow[]> {
  return wait([
    { kind: 'extract', total: 23, last_7_days: 6, people: 4 },
    { kind: 'announce', total: 17, last_7_days: 5, people: 3 },
    { kind: 'ask', total: 96, last_7_days: 31, people: 27 },
  ] as AiUsageRow[])
}

// ---------- Clubs ----------

export async function listClubs(): Promise<Club[]> {
  return wait([...demoClubs].sort((a, b) => a.name.localeCompare(b.name)))
}

export async function saveClub(input: ClubInput, id?: string): Promise<Club> {
  if (id) {
    const club = demoClubs.find((c) => c.id === id)
    if (!club) throw new Error('Club not found')
    Object.assign(club, input, { updated_at: stamp() })
    return wait(club)
  }
  const club: Club = { ...input, id: newId('club'), created_at: stamp(), updated_at: stamp() }
  demoClubs.push(club)
  return wait(club)
}

export async function deleteClub(id: string): Promise<void> {
  const i = demoClubs.findIndex((c) => c.id === id)
  if (i >= 0) demoClubs.splice(i, 1)
  await wait(null)
}

function alertDemo(message: string) {
  console.info(`[design preview] ${message}`)
}

// ---------- Clubs (pages, members, posts, applications) ----------

const myRole = (clubId: string) =>
  demoClubMembers.find((m) => m.club_id === clubId && m.user_id === DEMO_USER_ID && m.status === 'active')?.role ?? null
const isAdminNow = () => demoProfile.role === 'admin'
const isLeader = (clubId: string) => isAdminNow() || ['president', 'vice_president'].includes(myRole(clubId) ?? '')

export async function getClub(id: string): Promise<Club | null> {
  return wait(demoClubs.find((c) => c.id === id) ?? null)
}

export async function listPublicClubs(): Promise<PublicClub[]> {
  return wait(
    demoClubs
      .filter((c) => c.status === 'active')
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.category,
        tagline: c.tagline,
        members: demoClubMembers.filter((m) => m.club_id === c.id && m.status === 'active').length,
      })),
  )
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  return wait(!Object.entries(demoUsernames).some(([id, u]) => u === username && id !== DEMO_USER_ID))
}

export async function listMyClubMemberships(_userId: string): Promise<ClubMembership[]> {
  void _userId
  return wait(demoClubMembers.filter((m) => m.user_id === DEMO_USER_ID))
}

export async function listClubMemberCounts(): Promise<Record<string, ClubMemberCount>> {
  return wait(
    Object.fromEntries(
      demoClubs.map((c) => {
        const rows = demoClubMembers.filter((m) => m.club_id === c.id)
        return [
          c.id,
          {
            club_id: c.id,
            members: rows.filter((m) => m.status === 'active').length,
            pending: isLeader(c.id) ? rows.filter((m) => m.status === 'pending').length : 0,
          },
        ]
      }),
    ),
  )
}

const ROLE_ORDER: ClubRole[] = ['president', 'vice_president', 'committee', 'member']

export async function listClubMembers(clubId: string): Promise<ClubMemberRow[]> {
  const leader = isLeader(clubId)
  return wait(
    demoClubMembers
      .filter((m) => m.club_id === clubId && (m.status === 'active' || leader || m.user_id === DEMO_USER_ID))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
      .map((m) => ({
        user_id: m.user_id,
        username: demoUsernames[m.user_id] ?? null,
        role: m.role,
        status: m.status,
        message: leader ? m.message : '',
        batch: demoMembers.find((p) => p.id === m.user_id)?.batch ?? null,
        joined_at: m.created_at,
      })),
  )
}

export async function joinClub(clubId: string, message = ''): Promise<'pending' | 'active'> {
  const club = demoClubs.find((c) => c.id === clubId)
  const status = club?.join_policy === 'open' ? 'active' : 'pending'
  demoClubMembers.push({ club_id: clubId, user_id: DEMO_USER_ID, role: 'member', status, message, created_at: stamp() })
  return wait(status)
}

export async function leaveClub(clubId: string): Promise<void> {
  if (myRole(clubId) === 'president') throw new Error('LAST_PRESIDENT')
  const i = demoClubMembers.findIndex((m) => m.club_id === clubId && m.user_id === DEMO_USER_ID)
  if (i >= 0) demoClubMembers.splice(i, 1)
  await wait(null)
}

export async function decideClubRequest(clubId: string, userId: string, accept: boolean) {
  const i = demoClubMembers.findIndex((m) => m.club_id === clubId && m.user_id === userId)
  if (i >= 0) {
    if (accept) demoClubMembers[i].status = 'active'
    else demoClubMembers.splice(i, 1)
  }
  await wait(null)
}

export async function setClubMemberRole(clubId: string, userId: string, role: ClubRole) {
  const m = demoClubMembers.find((x) => x.club_id === clubId && x.user_id === userId)
  if (!m) return
  if ((['president', 'vice_president'].includes(role) || ['president', 'vice_president'].includes(m.role)) &&
      !(isAdminNow() || myRole(clubId) === 'president')) throw new Error('ONLY_PRESIDENT')
  m.role = role
  await wait(null)
}

export async function removeClubMember(clubId: string, userId: string) {
  const i = demoClubMembers.findIndex((m) => m.club_id === clubId && m.user_id === userId)
  if (i >= 0) demoClubMembers.splice(i, 1)
  await wait(null)
}

export async function updateClubPage(id: string, input: Partial<ClubInput>): Promise<Club> {
  const club = demoClubs.find((c) => c.id === id)
  if (!club) throw new Error('Club not found')
  Object.assign(club, input, { updated_at: stamp() })
  return wait(club)
}

export async function adminSetClubPresident(clubId: string, userId: string) {
  const m = demoClubMembers.find((x) => x.club_id === clubId && x.user_id === userId)
  if (m) Object.assign(m, { role: 'president', status: 'active' })
  else demoClubMembers.push({ club_id: clubId, user_id: userId, role: 'president', status: 'active', message: '', created_at: stamp() })
  await wait(null)
}

export async function listClubPosts(clubId: string): Promise<ClubPost[]> {
  const club = demoClubs.find((c) => c.id === clubId)
  const member = isAdminNow() || myRole(clubId) !== null
  return wait(
    demoClubPosts
      .filter((p) => p.club_id === clubId)
      .filter((p) => member || (p.visibility === 'everyone' && club?.posts_visibility === 'everyone'))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))
      .map((p) => ({ ...p, author_username: p.author_id ? demoUsernames[p.author_id] : null })),
  )
}

export async function createClubPost(clubId: string, input: ClubPostInput): Promise<ClubPost> {
  const post: ClubPost = { ...input, id: newId('cp'), club_id: clubId, author_id: DEMO_USER_ID, created_at: stamp(), updated_at: stamp() }
  demoClubPosts.push(post)
  return wait(post)
}

export async function updateClubPost(id: string, input: ClubPostInput): Promise<void> {
  const post = demoClubPosts.find((p) => p.id === id)
  if (post) Object.assign(post, input, { updated_at: stamp() })
  await wait(null)
}

export async function deleteClubPost(id: string): Promise<void> {
  const i = demoClubPosts.findIndex((p) => p.id === id)
  if (i >= 0) demoClubPosts.splice(i, 1)
  await wait(null)
}

export async function listMyClubApplications(_userId: string): Promise<ClubApplication[]> {
  void _userId
  return wait(demoApplications.filter((a) => a.applicant_id === DEMO_USER_ID))
}

export async function listClubApplications(): Promise<ClubApplication[]> {
  return wait([...demoApplications].sort((a, b) => b.created_at.localeCompare(a.created_at)))
}

export async function submitClubApplication(input: ClubApplicationInput, id?: string): Promise<void> {
  if (id) {
    const app = demoApplications.find((a) => a.id === id)
    if (app) Object.assign(app, input, { status: 'pending', updated_at: stamp() })
  } else {
    demoApplications.push({
      ...input, id: newId('app'), applicant_id: DEMO_USER_ID, status: 'pending', admin_note: '',
      reviewed_at: null, club_id: null, created_at: stamp(), updated_at: stamp(),
    })
  }
  await wait(null)
}

export async function withdrawClubApplication(id: string): Promise<void> {
  const i = demoApplications.findIndex((a) => a.id === id)
  if (i >= 0) demoApplications.splice(i, 1)
  await wait(null)
}

export async function reviewClubApplication(
  id: string,
  decision: 'approved' | 'needs_changes' | 'rejected',
  note = '',
): Promise<string | null> {
  const app = demoApplications.find((a) => a.id === id)
  if (!app) throw new Error('NOT_FOUND')
  let clubId: string | null = null
  if (decision === 'approved') {
    const club = await saveClub({
      name: app.club_name, category: app.category, description: app.description,
      leader_name: null, leader_contact: null, logo_url: null, join_url: null,
      status: 'active', tagline: app.tagline, about: `${app.objectives}\n\n${app.activities_plan}`.trim(),
      meeting_info: '', instagram: null, cover_url: null, join_policy: 'approval',
      who_can_post: 'leaders', posts_visibility: 'everyone',
    })
    clubId = club.id
    demoClubMembers.push({ club_id: club.id, user_id: app.applicant_id, role: 'president', status: 'active', message: '', created_at: stamp() })
  }
  Object.assign(app, { status: decision, admin_note: note, reviewed_at: stamp(), club_id: clubId })
  return wait(clubId)
}

// ---------- Discussion board ----------

function publicPost(p: (typeof demoForumPosts)[number]): ForumPost {
  const { author_id, ...rest } = p
  return {
    ...rest,
    author_username: p.is_anonymous ? null : demoUsernames[author_id] ?? null,
    is_mine: author_id === DEMO_USER_ID && demoAccess.level !== 'guest',
    comment_count: demoForumComments.filter((c) => c.post_id === p.id).length,
  }
}

const GROUPS: Record<string, string[]> = {
  'group:explore': ['food', 'hidden_gems', 'hangout', 'trips', 'budget'],
  'group:life': ['study', 'serious', 'career', 'general'],
  'group:teamup': ['hackathon', 'startup', 'activities'],
}
const canSee = (category: string) => demoAccess.level === 'member' || GROUPS['group:explore'].includes(category)

export async function listForumPosts(options: { category?: string | null; sort?: ForumSort; search?: string }): Promise<ForumPost[]> {
  const q = options.search?.trim().toLowerCase() ?? ''
  const cat = options.category ?? null
  const inCategory = (c: string) => !cat || (GROUPS[cat] ? GROUPS[cat].includes(c) : c === cat)
  const hot = (p: ForumPost) => (p.score + 1) / Math.pow((Date.now() - new Date(p.created_at).getTime()) / 3600_000 + 2, 1.5)
  const rows = demoForumPosts
    .map(publicPost)
    .filter((p) => canSee(p.category) && inCategory(p.category))
    .filter((p) => !q || [p.title, p.body, p.place_name, p.place_area].some((t) => t?.toLowerCase().includes(q)))
  rows.sort((a, b) =>
    options.sort === 'new'
      ? b.created_at.localeCompare(a.created_at)
      : options.sort === 'top'
        ? b.score - a.score
        : hot(b) - hot(a),
  )
  return wait(rows)
}

export async function getForumPost(id: string): Promise<ForumPost | null> {
  const p = demoForumPosts.find((x) => x.id === id)
  return wait(p && canSee(p.category) ? publicPost(p) : null)
}

export async function createForumPost(input: ForumPostInput): Promise<string> {
  const id = newId('fp')
  demoForumPosts.push({
    ...input, id, author_id: DEMO_USER_ID, author_username: null, is_mine: true,
    score: 1, my_vote: 1, comment_count: 0, created_at: stamp(), updated_at: stamp(),
  })
  return wait(id)
}

export async function deleteForumPost(id: string): Promise<void> {
  const i = demoForumPosts.findIndex((p) => p.id === id)
  if (i >= 0) demoForumPosts.splice(i, 1)
  await wait(null)
}

export async function setForumPostClosed(id: string, closed: boolean): Promise<void> {
  const p = demoForumPosts.find((x) => x.id === id)
  if (p) p.is_closed = closed
  await wait(null)
}

export async function voteForumPost(id: string, value: -1 | 0 | 1): Promise<number> {
  const p = demoForumPosts.find((x) => x.id === id)
  if (!p) return 0
  p.score += value - (p.my_vote ?? 0)
  p.my_vote = value === 0 ? null : value
  return wait(p.score, 50)
}

export async function listForumComments(postId: string): Promise<ForumComment[]> {
  const post = demoForumPosts.find((p) => p.id === postId)
  return wait(
    demoForumComments
      .filter((c) => c.post_id === postId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ post_id, author_id, ...c }) => {
        void post_id
        return {
          ...c,
          author_username: c.is_anonymous ? null : demoUsernames[author_id] ?? null,
          is_mine: author_id === DEMO_USER_ID,
          is_op: author_id === post?.author_id && (!post.is_anonymous || c.is_anonymous),
        }
      }),
  )
}

export async function addForumComment(postId: string, body: string, isAnonymous: boolean, parentId: string | null = null): Promise<void> {
  demoForumComments.push({
    id: newId('fc'), post_id: postId, parent_id: parentId, author_id: DEMO_USER_ID, body,
    is_anonymous: isAnonymous, author_username: null, is_mine: true, is_op: false, created_at: stamp(),
  })
  await wait(null)
}

export async function deleteForumComment(id: string): Promise<void> {
  const ids = new Set([id])
  let grew = true
  while (grew) {
    grew = false
    for (const c of demoForumComments) if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true }
  }
  for (let i = demoForumComments.length - 1; i >= 0; i--) if (ids.has(demoForumComments[i].id)) demoForumComments.splice(i, 1)
  await wait(null)
}

// ---------- Explore: opportunities ----------

export async function listOpportunities(): Promise<Opportunity[]> {
  const organizer = ['organizer', 'admin'].includes(demoProfile.role) && demoAccess.level === 'member'
  return wait(
    demoOpportunities
      .filter((o) => o.status === 'published' || organizer || (o.created_by === DEMO_USER_ID && demoAccess.level === 'member'))
      .sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999')),
  )
}

export async function saveOpportunity(input: OpportunityInput, id?: string): Promise<void> {
  if (id) {
    const o = demoOpportunities.find((x) => x.id === id)
    if (o) Object.assign(o, input, { updated_at: stamp() })
  } else {
    demoOpportunities.push({ ...input, id: newId('op'), created_by: DEMO_USER_ID, created_at: stamp(), updated_at: stamp() })
  }
  await wait(null)
}

export async function deleteOpportunity(id: string): Promise<void> {
  const i = demoOpportunities.findIndex((o) => o.id === id)
  if (i >= 0) demoOpportunities.splice(i, 1)
  await wait(null)
}

// ---------- Homepage ----------

export async function listPublicUpcomingEvents(): Promise<PublicEvent[]> {
  return wait(
    sortEvents()
      .filter((e) => e.audience === 'everyone' && e.event_date >= new Date().toISOString().slice(0, 10))
      .slice(0, 6)
      .map((e) => ({
        id: e.id, title: e.title, category: e.category, event_date: e.event_date, start_time: e.start_time,
        location: e.location, club_name: demoClubs.find((c) => c.id === e.club_id)?.name ?? null,
      })),
  )
}

export async function getPublicStats(): Promise<PublicStats | null> {
  return wait({ members: 68, clubs: demoClubs.filter((c) => c.status === 'active').length, events_this_year: 24 })
}

// ---------- Photos ----------

function photoVisible(p: Photo) {
  if (demoAccess.level !== 'guest' && (p.uploaded_by === DEMO_USER_ID || isAdminNow())) return true
  if (p.status !== 'approved') return false
  if (p.forum_post_id) {
    const post = demoForumPosts.find((x) => x.id === p.forum_post_id)
    return !!post && canSee(post.category)
  }
  return demoAccess.level === 'member'
}

export async function listPhotos(key: PhotoTargetKey, ids: string[]): Promise<Photo[]> {
  return wait(demoPhotos.filter((p) => p[key] && ids.includes(p[key]!) && photoVisible(p)))
}

export async function uploadPhotos(target: PhotoTarget, files: File[], _userId: string): Promise<number> {
  void _userId
  for (const file of files) {
    const url = URL.createObjectURL(file)
    demoPhotos.push({
      id: newId('ph'), path: url, url, uploaded_by: DEMO_USER_ID,
      forum_post_id: target.forum_post_id ?? null, club_post_id: target.club_post_id ?? null, club_id: target.club_id ?? null,
      caption: '', status: 'pending', reject_reason: '', created_at: stamp(),
    })
  }
  return wait(files.length, 400)
}

export async function deletePhoto(photo: Pick<Photo, 'id' | 'path'>): Promise<void> {
  const i = demoPhotos.findIndex((p) => p.id === photo.id)
  if (i >= 0) demoPhotos.splice(i, 1)
  await wait(null)
}

export async function listPendingPhotos(): Promise<Photo[]> {
  return wait(
    demoPhotos
      .filter((p) => p.status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((p) => {
        if (p.forum_post_id) {
          const post = demoForumPosts.find((x) => x.id === p.forum_post_id)
          return { ...p, context: { label: `Discussion: “${post?.title ?? 'post'}”`, href: `/discuss/${p.forum_post_id}` } }
        }
        if (p.club_id) {
          return { ...p, context: { label: `${demoClubs.find((c) => c.id === p.club_id)?.name} · club photos`, href: `/clubs/${p.club_id}?tab=about` } }
        }
        const post = demoClubPosts.find((x) => x.id === p.club_post_id)
        const club = demoClubs.find((c) => c.id === post?.club_id)
        return { ...p, context: { label: `${club?.name ?? 'Club'} · “${post?.title ?? 'post'}”`, href: `/clubs/${club?.id ?? ''}` } }
      }),
  )
}

export async function reviewPhoto(id: string, approve: boolean, reason = ''): Promise<void> {
  const p = demoPhotos.find((x) => x.id === id)
  if (p) Object.assign(p, { status: approve ? 'approved' : 'rejected', reject_reason: approve ? '' : reason })
  await wait(null)
}

// ---------- Organisation page ----------

export async function listOrgPeople(): Promise<OrgMember[]> {
  const member = demoAccess.level === 'member'
  return wait(
    [...demoOrgPeople]
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.tier - b.tier || (a.sponsor ?? '').localeCompare(b.sponsor ?? '') || a.sort_order - b.sort_order)
      .map((p) =>
        member
          ? { ...p, contacts_hidden: false }
          : { ...p, email: null, phone: null, whatsapp: null, contacts_hidden: Boolean(p.email || p.phone || p.whatsapp) },
      ),
  )
}

export async function saveOrgPerson(input: OrgMemberInput, id?: string): Promise<string> {
  if (id) {
    const p = demoOrgPeople.find((x) => x.id === id)
    if (p) Object.assign(p, input)
    return wait(id)
  }
  const newOne = newId('op')
  demoOrgPeople.push({ ...input, id: newOne, photo_url: null, contacts_hidden: false })
  return wait(newOne)
}

export async function setOrgPersonPhoto(id: string, file: File): Promise<void> {
  const p = demoOrgPeople.find((x) => x.id === id)
  if (p) {
    const url = URL.createObjectURL(file)
    Object.assign(p, { photo_path: url, photo_url: url })
  }
  await wait(null, 300)
}

export async function removeOrgPersonPhoto(id: string): Promise<void> {
  const p = demoOrgPeople.find((x) => x.id === id)
  if (p) Object.assign(p, { photo_path: null, photo_url: null })
  await wait(null)
}

export async function deleteOrgPerson(id: string): Promise<void> {
  const i = demoOrgPeople.findIndex((p) => p.id === id)
  if (i >= 0) demoOrgPeople.splice(i, 1)
  await wait(null)
}

export async function listOrgCalendar(): Promise<OrgCalendarItem[]> {
  return wait([...demoOrgCalendar].sort((a, b) => a.start_date.localeCompare(b.start_date)))
}

export async function saveOrgCalendarItem(input: OrgCalendarInput, id?: string): Promise<void> {
  if (id) {
    const c = demoOrgCalendar.find((x) => x.id === id)
    if (c) Object.assign(c, input)
  } else {
    demoOrgCalendar.push({ ...input, id: newId('oc') })
  }
  await wait(null)
}

export async function deleteOrgCalendarItem(id: string): Promise<void> {
  const i = demoOrgCalendar.findIndex((c) => c.id === id)
  if (i >= 0) demoOrgCalendar.splice(i, 1)
  await wait(null)
}
