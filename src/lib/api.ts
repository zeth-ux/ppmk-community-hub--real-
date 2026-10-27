// Every call the app makes to the database lives here, so pages stay
// simple and the permission rules (in supabase/migrations) do the
// security work.
import { supabase } from './supabase'
import type {
  AiUsageRow,
  Announcements,
  AppRole,
  Attendee,
  Club,
  ClubInput,
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
