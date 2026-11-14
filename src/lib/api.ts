// Every call the app makes to the database lives here, so pages stay
// simple and the permission rules (in supabase/migrations) do the
// security work.
import { supabase } from './supabase'
import { compressImage, cropSquare } from './images'
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
  EventFeedback,
  EventFeedbackReport,
  FeedbackOverview,
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
  EventInput,
  HubEvent,
  HubStats,
  Member,
  Profile,
  ProfileInput,
  Rsvp,
  RsvpCounts,
  RsvpStatus,
} from './types'

function must<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error
  return result.data as T
}

// ---------- Profiles ----------

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const result = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  return must(result) as Profile | null
}

export async function updateMyProfile(
  userId: string,
  input: ProfileInput,
): Promise<Profile> {
  const result = await supabase
    .from('profiles')
    .update(input)
    .eq('id', userId)
    .select('*')
    .single()

  return must(result) as Profile
}

export async function setEmailReminders(userId: string, on: boolean): Promise<Profile> {
  const result = await supabase
    .from('profiles')
    .update({ email_reminders: on })
    .eq('id', userId)
    .select('*')
    .single()

  return must(result) as Profile
}

export async function deleteMyAccount(): Promise<void> {
  must(await supabase.rpc('delete_my_account'))
}

// ---------- Events ----------

export async function listEvents(): Promise<HubEvent[]> {
  const result = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  return must(result) as HubEvent[]
}

export async function getEvent(id: string): Promise<HubEvent | null> {
  const result = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return must(result) as HubEvent | null
}

export async function createEvent(input: EventInput): Promise<HubEvent> {
  const result = await supabase
    .from('events')
    .insert(input)
    .select('*')
    .single()

  return must(result) as HubEvent
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<HubEvent> {
  const result = await supabase
    .from('events')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  return must(result) as HubEvent
}

export async function saveAnnouncements(
  id: string,
  announcements: Announcements | null,
): Promise<void> {
  must(await supabase.from('events').update({ announcements }).eq('id', id))
}

export async function deleteEvent(id: string): Promise<void> {
  must(await supabase.from('events').delete().eq('id', id))
}

export async function getEventInvites(eventId: string): Promise<string[]> {
  const result = await supabase
    .from('event_invites')
    .select('user_id')
    .eq('event_id', eventId)

  return (must(result) as { user_id: string }[]).map((row) => row.user_id)
}

export async function setEventInvites(
  eventId: string,
  userIds: string[],
): Promise<number> {
  return must(
    await supabase.rpc('set_event_invites', {
      p_event_id: eventId,
      p_user_ids: userIds,
    }),
  ) as number
}

// ---------- RSVPs ----------

export async function listMyRsvps(userId: string): Promise<Rsvp[]> {
  const result = await supabase
    .from('rsvps')
    .select('*')
    .eq('user_id', userId)

  return must(result) as Rsvp[]
}

export async function setMyRsvp(
  eventId: string,
  status: RsvpStatus,
  comment = '',
): Promise<Rsvp> {
  return must(
    await supabase.rpc('set_my_rsvp', {
      p_event_id: eventId,
      p_status: status,
      p_comment: comment,
    }),
  ) as Rsvp
}

export async function listRsvpCounts(): Promise<Record<string, RsvpCounts>> {
  const rows = must(await supabase.rpc('event_rsvp_counts')) as RsvpCounts[]

  return Object.fromEntries(rows.map((row) => [row.event_id, row]))
}

export async function listAttendees(eventId: string): Promise<Attendee[]> {
  return must(
    await supabase.rpc('event_attendees', { p_event_id: eventId }),
  ) as Attendee[]
}

export async function setCheckIn(
  eventId: string,
  userId: string,
  checkedIn: boolean,
): Promise<string | null> {
  return must(
    await supabase.rpc('check_in', {
      p_event_id: eventId,
      p_user_id: userId,
      p_checked_in: checkedIn,
    }),
  ) as string | null
}

// ---------- Post-event feedback ----------

export async function getMyFeedback(eventId: string): Promise<EventFeedback | null> {
  const result = await supabase
    .from('event_feedback')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle()

  return must(result) as EventFeedback | null
}

/** Did the signed-in person go to this event, and is feedback still open? */
export async function canGiveFeedback(eventId: string): Promise<boolean> {
  return Boolean(must(await supabase.rpc('can_give_feedback', { p_event_id: eventId })))
}

export async function setMyFeedback(
  eventId: string,
  rating: number,
  comment = '',
): Promise<EventFeedback> {
  return must(
    await supabase.rpc('set_my_feedback', {
      p_event_id: eventId,
      p_rating: rating,
      p_comment: comment,
    }),
  ) as EventFeedback
}

/** Organizers: ratings and comments for one event, without names. */
export async function getEventFeedback(eventId: string): Promise<EventFeedbackReport> {
  const [summary, comments] = await Promise.all([
    supabase.rpc('event_feedback_summary', { p_event_id: eventId }),
    supabase.rpc('event_feedback_comments', { p_event_id: eventId }),
  ])
  const row = (must(summary) as {
    responses: number; average: number | null
    stars_1: number; stars_2: number; stars_3: number; stars_4: number; stars_5: number
  }[])[0]

  return {
    responses: Number(row?.responses ?? 0),
    average: row?.average === null || row?.average === undefined ? null : Number(row.average),
    stars: [row?.stars_1, row?.stars_2, row?.stars_3, row?.stars_4, row?.stars_5].map((n) => Number(n ?? 0)) as EventFeedbackReport['stars'],
    comments: must(comments) as EventFeedbackReport['comments'],
  }
}

/** Admins: feedback totals across the hub (for the course report). */
export async function getFeedbackOverview(): Promise<FeedbackOverview> {
  const row = (must(await supabase.rpc('feedback_overview')) as FeedbackOverview[])[0]
  return {
    responses: Number(row?.responses ?? 0),
    average: row?.average === null || row?.average === undefined ? null : Number(row.average),
    events_rated: Number(row?.events_rated ?? 0),
  }
}

/** Organizers: a scanned QR code → check that person in. */
export async function checkInByCode(code: string): Promise<CheckInResult> {
  const rows = must(await supabase.rpc('check_in_by_code', { p_code: code })) as CheckInResult[]
  return rows[0]
}

// ---------- Members & admin ----------

export async function listMembers(): Promise<Member[]> {
  return must(await supabase.rpc('list_members')) as Member[]
}

export async function listAllProfiles(): Promise<Profile[]> {
  const result = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true, nullsFirst: false })

  return must(result) as Profile[]
}

export async function setUserRole(userId: string, role: AppRole) {
  must(
    await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role }),
  )
}

export async function getHubStats(): Promise<HubStats> {
  const rows = must(await supabase.rpc('hub_stats')) as HubStats[]
  return rows[0]
}

export async function getAiUsageStats(): Promise<AiUsageRow[]> {
  return must(await supabase.rpc('ai_usage_stats')) as AiUsageRow[]
}

// ---------- Clubs ----------

export async function listClubs(): Promise<Club[]> {
  const result = await supabase
    .from('clubs')
    .select('*')
    .order('name', { ascending: true })

  return must(result) as Club[]
}

export async function saveClub(
  input: ClubInput,
  id?: string,
): Promise<Club> {
  const query = id
    ? supabase.from('clubs').update(input).eq('id', id)
    : supabase.from('clubs').insert(input)

  return must(await query.select('*').single()) as Club
}

export async function deleteClub(id: string): Promise<void> {
  must(await supabase.from('clubs').delete().eq('id', id))
}

export async function getClub(id: string): Promise<Club | null> {
  const result = await supabase.from('clubs').select('*').eq('id', id).maybeSingle()
  return must(result) as Club | null
}

/** Club names for the landing page (works before sign-in). */
export async function listPublicClubs(): Promise<PublicClub[]> {
  return must(await supabase.rpc('public_club_directory')) as PublicClub[]
}

// ---------- Usernames ----------

export async function isUsernameAvailable(username: string): Promise<boolean> {
  return must(await supabase.rpc('username_available', { p_username: username })) as boolean
}

async function attachUsernames<T extends { author_id: string | null; author_username?: string | null }>(
  rows: T[],
): Promise<T[]> {
  const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[]
  if (ids.length === 0) return rows
  const names = must(await supabase.rpc('public_usernames', { p_ids: ids })) as { id: string; username: string | null }[]
  const byId = Object.fromEntries(names.map((n) => [n.id, n.username]))
  return rows.map((r) => ({ ...r, author_username: r.author_id ? byId[r.author_id] ?? null : null }))
}

// ---------- Club membership ----------

export async function listMyClubMemberships(userId: string): Promise<ClubMembership[]> {
  const result = await supabase.from('club_members').select('*').eq('user_id', userId)
  return must(result) as ClubMembership[]
}

export async function listClubMemberCounts(): Promise<Record<string, ClubMemberCount>> {
  const rows = must(await supabase.rpc('club_member_counts')) as ClubMemberCount[]
  return Object.fromEntries(rows.map((r) => [r.club_id, r]))
}

export async function listClubMembers(clubId: string): Promise<ClubMemberRow[]> {
  return must(await supabase.rpc('list_club_members', { p_club_id: clubId })) as ClubMemberRow[]
}

export async function joinClub(clubId: string, message = ''): Promise<'pending' | 'active'> {
  return must(await supabase.rpc('join_club', { p_club_id: clubId, p_message: message })) as
    | 'pending'
    | 'active'
}

export async function leaveClub(clubId: string): Promise<void> {
  must(await supabase.rpc('leave_club', { p_club_id: clubId }))
}

export async function decideClubRequest(clubId: string, userId: string, accept: boolean) {
  must(await supabase.rpc('decide_club_request', { p_club_id: clubId, p_user_id: userId, p_accept: accept }))
}

export async function setClubMemberRole(clubId: string, userId: string, role: ClubRole) {
  must(await supabase.rpc('set_club_member_role', { p_club_id: clubId, p_user_id: userId, p_role: role }))
}

export async function removeClubMember(clubId: string, userId: string) {
  must(await supabase.rpc('remove_club_member', { p_club_id: clubId, p_user_id: userId }))
}

export async function updateClubPage(id: string, input: Partial<ClubInput>): Promise<Club> {
  return must(await supabase.from('clubs').update(input).eq('id', id).select('*').single()) as Club
}

export async function adminSetClubPresident(clubId: string, userId: string) {
  must(await supabase.rpc('admin_set_club_president', { p_club_id: clubId, p_user_id: userId }))
}

// ---------- Club posts ----------

export async function listClubPosts(clubId: string): Promise<ClubPost[]> {
  const result = await supabase
    .from('club_posts')
    .select('*')
    .eq('club_id', clubId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  return attachUsernames(must(result) as ClubPost[])
}

export async function createClubPost(clubId: string, input: ClubPostInput): Promise<ClubPost> {
  const result = await supabase
    .from('club_posts')
    .insert({ ...input, club_id: clubId })
    .select('*')
    .single()
  return must(result) as ClubPost
}

export async function updateClubPost(id: string, input: ClubPostInput): Promise<void> {
  must(await supabase.from('club_posts').update(input).eq('id', id))
}

export async function deleteClubPost(id: string): Promise<void> {
  must(await supabase.from('club_posts').delete().eq('id', id))
}

// ---------- Club applications ----------

export async function listMyClubApplications(userId: string): Promise<ClubApplication[]> {
  const result = await supabase
    .from('club_applications')
    .select('*')
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
  return must(result) as ClubApplication[]
}

/** Admins: every application, newest first. */
export async function listClubApplications(): Promise<ClubApplication[]> {
  const result = await supabase
    .from('club_applications')
    .select('*')
    .order('created_at', { ascending: false })
  return must(result) as ClubApplication[]
}

export async function submitClubApplication(input: ClubApplicationInput, id?: string): Promise<void> {
  must(
    id
      ? await supabase.from('club_applications').update(input).eq('id', id)
      : await supabase.from('club_applications').insert(input),
  )
}

export async function withdrawClubApplication(id: string): Promise<void> {
  must(await supabase.from('club_applications').delete().eq('id', id))
}

export async function reviewClubApplication(
  id: string,
  decision: 'approved' | 'needs_changes' | 'rejected',
  note = '',
): Promise<string | null> {
  return must(
    await supabase.rpc('review_club_application', { p_id: id, p_decision: decision, p_note: note }),
  ) as string | null
}

// ---------- Discussion board ----------

export async function listForumPosts(options: {
  category?: string | null
  sort?: ForumSort
  search?: string
}): Promise<ForumPost[]> {
  return must(
    await supabase.rpc('list_forum_posts', {
      p_category: options.category ?? null,
      p_sort: options.sort ?? 'hot',
      p_search: options.search?.trim() || null,
      p_limit: 50,
      p_offset: 0,
    }),
  ) as ForumPost[]
}

export async function getForumPost(id: string): Promise<ForumPost | null> {
  const rows = must(await supabase.rpc('get_forum_post', { p_id: id })) as ForumPost[]
  return rows[0] ?? null
}

export async function createForumPost(input: ForumPostInput): Promise<string> {
  const result = await supabase.from('forum_posts').insert(input).select('id').single()
  return (must(result) as { id: string }).id
}

export async function deleteForumPost(id: string, asAdmin = false): Promise<void> {
  must(
    asAdmin
      ? await supabase.rpc('admin_remove_forum_item', { p_kind: 'post', p_id: id })
      : await supabase.from('forum_posts').delete().eq('id', id),
  )
}

/** Team up: the author marks the team as full (or opens it again). */
export async function setForumPostClosed(id: string, closed: boolean): Promise<void> {
  must(await supabase.from('forum_posts').update({ is_closed: closed }).eq('id', id))
}

export async function voteForumPost(id: string, value: -1 | 0 | 1): Promise<number> {
  return must(await supabase.rpc('vote_forum_post', { p_post_id: id, p_value: value })) as number
}

export async function listForumComments(postId: string): Promise<ForumComment[]> {
  return must(await supabase.rpc('list_forum_comments', { p_post_id: postId })) as ForumComment[]
}

export async function addForumComment(
  postId: string,
  body: string,
  isAnonymous: boolean,
  parentId: string | null = null,
): Promise<void> {
  must(
    await supabase
      .from('forum_comments')
      .insert({ post_id: postId, body, is_anonymous: isAnonymous, parent_id: parentId }),
  )
}

export async function deleteForumComment(id: string, asAdmin = false): Promise<void> {
  must(
    asAdmin
      ? await supabase.rpc('admin_remove_forum_item', { p_kind: 'comment', p_id: id })
      : await supabase.from('forum_comments').delete().eq('id', id),
  )
}

// ---------- Explore: opportunities ----------

export async function listOpportunities(): Promise<Opportunity[]> {
  const result = await supabase
    .from('opportunities')
    .select('*')
    .neq('status', 'archived')
    .order('start_date', { ascending: true, nullsFirst: false })
  return must(result) as Opportunity[]
}

export async function saveOpportunity(input: OpportunityInput, id?: string): Promise<void> {
  must(
    id
      ? await supabase.from('opportunities').update(input).eq('id', id)
      : await supabase.from('opportunities').insert(input),
  )
}

export async function deleteOpportunity(id: string): Promise<void> {
  must(await supabase.from('opportunities').delete().eq('id', id))
}

// ---------- Homepage (works signed out) ----------

export async function listPublicUpcomingEvents(): Promise<PublicEvent[]> {
  return must(await supabase.rpc('public_upcoming_events')) as PublicEvent[]
}

export async function getPublicStats(): Promise<PublicStats | null> {
  const rows = must(await supabase.rpc('public_hub_stats')) as PublicStats[]
  return rows[0] ?? null
}

// ---------- Photos (every photo needs admin approval) ----------

async function withUrls(rows: Omit<Photo, 'url'>[]): Promise<Photo[]> {
  if (rows.length === 0) return []
  const { data } = await supabase.storage.from('photos').createSignedUrls(rows.map((r) => r.path), 60 * 60)
  const byPath = Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]))
  return rows.map((r) => ({ ...r, url: byPath[r.path] ?? '' })).filter((r) => r.url)
}

/** Photos attached to these posts/clubs that you are allowed to see. */
export async function listPhotos(key: PhotoTargetKey, ids: string[]): Promise<Photo[]> {
  if (ids.length === 0) return []
  const result = await supabase
    .from('photos')
    .select('*')
    .in(key, ids)
    .order('created_at', { ascending: true })
  return withUrls(must(result) as Omit<Photo, 'url'>[])
}

/** Compress, record (as "pending") and upload. Returns how many worked. */
export async function uploadPhotos(target: PhotoTarget, files: File[], userId: string): Promise<number> {
  let done = 0
  for (const file of files) {
    const blob = await compressImage(file)
    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const row = must(await supabase.from('photos').insert({ ...target, path }).select('id').single()) as { id: string }
    const { error } = await supabase.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) {
      await supabase.from('photos').delete().eq('id', row.id)
      throw error
    }
    done += 1
  }
  return done
}

export async function deletePhoto(photo: Pick<Photo, 'id' | 'path'>): Promise<void> {
  must(await supabase.from('photos').delete().eq('id', photo.id))
  await supabase.storage.from('photos').remove([photo.path])
}

/** Admins: photos waiting for review, oldest first. */
export async function listPendingPhotos(): Promise<Photo[]> {
  const result = await supabase.from('photos').select('*').eq('status', 'pending').order('created_at', { ascending: true })
  const photos = await withUrls(must(result) as Omit<Photo, 'url'>[])

  // Where each photo will appear, so the admin can check it in context.
  const postIds = photos.map((p) => p.club_post_id).filter(Boolean) as string[]
  const posts = postIds.length
    ? (must(await supabase.from('club_posts').select('id, club_id, title').in('id', postIds)) as { id: string; club_id: string; title: string }[])
    : []
  const clubIds = [...new Set([...posts.map((p) => p.club_id), ...(photos.map((p) => p.club_id).filter(Boolean) as string[])])]
  const clubs = clubIds.length
    ? (must(await supabase.from('clubs').select('id, name').in('id', clubIds)) as { id: string; name: string }[])
    : []
  const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? 'a club'

  return photos.map((p) => {
    if (p.forum_post_id) return { ...p, context: { label: 'Discussion post', href: `/discuss/${p.forum_post_id}` } }
    if (p.club_id) return { ...p, context: { label: `${clubName(p.club_id)} · club photos`, href: `/clubs/${p.club_id}?tab=about` } }
    const post = posts.find((x) => x.id === p.club_post_id)
    return { ...p, context: post ? { label: `${clubName(post.club_id)} · “${post.title}”`, href: `/clubs/${post.club_id}` } : { label: 'Club post', href: '/clubs' } }
  })
}

export async function reviewPhoto(id: string, approve: boolean, reason = ''): Promise<void> {
  must(await supabase.rpc('review_photo', { p_id: id, p_approve: approve, p_reason: reason }))
}

// ---------- Organisation page ----------

/** Committee and sponsor officers. Contacts come back empty unless you're a member. */
export async function listOrgPeople(): Promise<OrgMember[]> {
  const rows = must(await supabase.rpc('list_org_people')) as OrgMember[]
  return rows.map((p) => ({
    ...p,
    photo_url: p.photo_path ? supabase.storage.from('org-photos').getPublicUrl(p.photo_path).data.publicUrl : null,
  }))
}

/** Saves a person and returns their id (needed to attach a photo to a new one). */
export async function saveOrgPerson(input: OrgMemberInput, id?: string): Promise<string> {
  if (id) {
    must(await supabase.from('org_people').update(input).eq('id', id))
    return id
  }
  return (must(await supabase.from('org_people').insert(input).select('id').single()) as { id: string }).id
}

export async function deleteOrgPerson(id: string, photoPath?: string | null): Promise<void> {
  must(await supabase.from('org_people').delete().eq('id', id))
  if (photoPath) await supabase.storage.from('org-photos').remove([photoPath])
}

/** Admins: crop to a square, upload, and replace the person's old photo. */
export async function setOrgPersonPhoto(id: string, file: File, oldPath?: string | null): Promise<void> {
  const blob = await cropSquare(file)
  const path = `${id}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('org-photos').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  must(await supabase.from('org_people').update({ photo_path: path }).eq('id', id))
  if (oldPath) await supabase.storage.from('org-photos').remove([oldPath])
}

export async function removeOrgPersonPhoto(id: string, path: string): Promise<void> {
  must(await supabase.from('org_people').update({ photo_path: null }).eq('id', id))
  await supabase.storage.from('org-photos').remove([path])
}

export async function listOrgCalendar(): Promise<OrgCalendarItem[]> {
  const result = await supabase
    .from('org_calendar')
    .select('*')
    .order('start_date', { ascending: true })
  return must(result) as OrgCalendarItem[]
}

export async function saveOrgCalendarItem(input: OrgCalendarInput, id?: string): Promise<void> {
  must(
    id
      ? await supabase.from('org_calendar').update(input).eq('id', id)
      : await supabase.from('org_calendar').insert(input),
  )
}

export async function deleteOrgCalendarItem(id: string): Promise<void> {
  must(await supabase.from('org_calendar').delete().eq('id', id))
}
