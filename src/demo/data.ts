// Fake data for the design preview (`npm run demo`). Nothing here touches
// Supabase; everything lives in memory and resets when you reload.
import { todayKst } from '../lib/format'
import type {
  AppRole,
  Club,
  ClubApplication,
  ClubMembership,
  ClubPost,
  ForumComment,
  ForumPost,
  HubEvent,
  Opportunity,
  OrgCalendarItem,
  OrgMember,
  Photo,
  Profile,
  Rsvp,
} from '../lib/types'

export const DEMO_USER_ID = 'demo-user'

const ROLE_KEY = 'ppmk-demo-role'

type PreviewRole = AppRole | 'visitor'

/** Who is using the preview right now: decides what the fake API returns. */
export const demoAccess = { level: 'member' as 'member' | 'visitor' | 'guest' }

export function setDemoAccess(level: 'member' | 'visitor' | 'guest') {
  demoAccess.level = level
}

export function getDemoRole(): PreviewRole {
  try {
    const saved = localStorage.getItem(ROLE_KEY)
    if (saved === 'student' || saved === 'organizer' || saved === 'admin' || saved === 'visitor') return saved
  } catch {
    /* storage unavailable */
  }
  return 'admin'
}

export function setDemoRole(role: PreviewRole) {
  demoProfile.role = role === 'visitor' ? 'student' : role
  demoProfile.account_type = role === 'visitor' ? 'visitor' : 'member'
  demoProfile.username = role === 'visitor' ? 'jamie_travels' : 'aisyah.r'
  syncDemoClubRole(demoProfile.role)
  try {
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    /* storage unavailable */
  }
}

/** YYYY-MM-DD, `days` from today (Korea time). */
function day(days: number): string {
  const d = new Date(`${todayKst()}T00:00:00`)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const now = new Date().toISOString()

export const demoProfile: Profile = {
  id: DEMO_USER_ID,
  email: 'demo.student@hanyang.ac.kr',
  student_id: '2023012345',
  full_name: 'Aisyah Rahman',
  batch: 2023,
  age: 21,
  phone: '010-1234-5678',
  course: 'Computer Science',
  residence: 'Dormitory (Changui-gwan)',
  role: 'student',
  username: 'aisyah.r',
  account_type: 'member',
  consent_at: now,
  created_at: now,
  updated_at: now,
}

const clubDefaults = {
  status: 'active' as const,
  tagline: '',
  about: '',
  meeting_info: '',
  instagram: null,
  cover_url: null,
  join_policy: 'approval' as const,
  who_can_post: 'leaders' as const,
  posts_visibility: 'everyone' as const,
}

export const demoClubs: Club[] = [
  {
    id: 'club-badminton',
    name: 'EMSU Badminton',
    category: 'Sports',
    description: 'Weekly social badminton at the ERICA gym. All levels welcome, rackets provided.',
    leader_name: 'Hafiz',
    leader_contact: '@hafiz_kakao',
    logo_url: null,
    join_url: 'https://open.kakao.com/',
    ...clubDefaults,
    tagline: 'Smash, rally, makan after.',
    about: 'We started in 2023 with six people and one borrowed net. Now we play every week, run a friendly tournament each semester and always end with supper.\n\nBeginners are very welcome: seniors will teach you the basics.',
    meeting_info: 'Every Wednesday, 7–9pm · ERICA Gym, Court 2',
    instagram: 'emsu.badminton',
    join_policy: 'open',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'club-futsal',
    name: 'Futsal Squad',
    category: 'Sports',
    description: 'Friday night futsal with friendly matches against other international student groups.',
    leader_name: 'Danial',
    leader_contact: null,
    logo_url: null,
    join_url: null,
    ...clubDefaults,
    tagline: 'Friday nights are for futsal.',
    meeting_info: 'Fridays, 8–10pm · ERICA Futsal Court',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'club-study',
    name: 'Study Circle',
    category: 'Academic',
    description: 'Exam-season study sessions, past-year papers and seniors helping juniors.',
    leader_name: 'Nurul',
    leader_contact: 'nurul@example.com',
    logo_url: null,
    join_url: null,
    ...clubDefaults,
    tagline: 'Study together, pass together.',
    meeting_info: 'Sundays, 2–6pm · Library Group Study Room B',
    who_can_post: 'members',
    created_at: now,
    updated_at: now,
  },
  {
    id: 'club-culture',
    name: 'Malaysian Culture Team',
    category: 'Cultural',
    description: 'Organises Hari Raya open house, Merdeka celebrations and cultural booths at festivals.',
    leader_name: 'Mei Ling',
    leader_contact: null,
    logo_url: null,
    join_url: null,
    ...clubDefaults,
    tagline: 'Bringing a bit of home to Ansan.',
    posts_visibility: 'members',
    created_at: now,
    updated_at: now,
  },
]

function ev(partial: Partial<HubEvent> & Pick<HubEvent, 'id' | 'title' | 'category' | 'event_date' | 'start_time' | 'location'>): HubEvent {
  return {
    end_time: null,
    description: '',
    bring: '',
    notes: '',
    capacity: null,
    rsvp_deadline: null,
    image_url: null,
    club_id: null,
    audience: 'everyone',
    audience_batches: [],
    announcements: null,
    created_by: DEMO_USER_ID,
    created_at: now,
    updated_at: now,
    ...partial,
  }
}

export const demoEvents: HubEvent[] = [
  ev({
    id: 'evt-badminton',
    title: 'Badminton Night',
    category: 'Sports',
    event_date: day(2),
    start_time: '19:00:00',
    end_time: '21:00:00',
    location: 'ERICA Gym, Court 2',
    description: 'Casual doubles, rotating partners. Snacks after!',
    bring: 'Indoor shoes, water bottle',
    capacity: 24,
    rsvp_deadline: day(1),
    club_id: 'club-badminton',
  }),
  ev({
    id: 'evt-makan',
    title: 'Makan-Makan Potluck',
    category: 'Social',
    event_date: day(5),
    start_time: '18:30:00',
    end_time: '21:30:00',
    location: 'Student Union Lounge, 3F',
    description: 'Bring a dish from home (or from the nearest mart, no judgement). Halal only please.',
    bring: 'One dish to share',
    notes: 'Halal food only',
    capacity: 60,
  }),
  ev({
    id: 'evt-resume',
    title: 'Resume Clinic with Seniors',
    category: 'Career',
    event_date: day(9),
    start_time: '14:00:00',
    end_time: '16:00:00',
    location: 'Engineering Bldg 1, Room 305',
    description: 'Seniors who interned at Samsung and Hyundai review your resume one-on-one.',
    bring: 'Printed or laptop copy of your CV',
    capacity: 15,
    audience: 'batch',
    audience_batches: [2023, 2024],
  }),
  ev({
    id: 'evt-study',
    title: 'Midterm Study Marathon',
    category: 'Academic',
    event_date: day(12),
    start_time: '10:00:00',
    end_time: '18:00:00',
    location: 'Library Group Study Room B',
    description: 'Quiet study with breaks every 90 minutes. Free coffee.',
    club_id: 'club-study',
  }),
  ev({
    id: 'evt-raya',
    title: 'Malaysia Day Celebration',
    category: 'Cultural',
    event_date: day(20),
    start_time: '17:00:00',
    location: 'Hanyang ERICA Grand Hall',
    description: 'Food booths, traditional games and a short performance. Korean friends welcome!',
    capacity: 120,
    club_id: 'club-culture',
  }),
  ev({
    id: 'evt-past',
    title: 'Welcome Party for New Students',
    category: 'Social',
    event_date: day(-14),
    start_time: '18:00:00',
    location: 'Sangnok-su Café',
    description: 'Meet the new batch.',
  }),
]

export const demoRsvps: Rsvp[] = [
  { event_id: 'evt-badminton', checkin_code: '3f1c2a9e-7b4d-4e21-9a0c-5d6e7f8a9b01', user_id: DEMO_USER_ID, status: 'attending', comment: '', checked_in_at: null, created_at: now, updated_at: now },
  { event_id: 'evt-makan', checkin_code: '8a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c02', user_id: DEMO_USER_ID, status: 'maybe', comment: 'Might be late', checked_in_at: null, created_at: now, updated_at: now },
  { event_id: 'evt-past', checkin_code: 'c0ffee00-1234-4abc-9def-0123456789ab', user_id: DEMO_USER_ID, status: 'attending', comment: '', checked_in_at: now, created_at: now, updated_at: now },
]

export const demoCounts: Record<string, { attending: number; maybe: number; not_attending: number }> = {
  'evt-badminton': { attending: 17, maybe: 4, not_attending: 2 },
  'evt-makan': { attending: 38, maybe: 9, not_attending: 3 },
  'evt-resume': { attending: 11, maybe: 2, not_attending: 0 },
  'evt-study': { attending: 8, maybe: 6, not_attending: 1 },
  'evt-raya': { attending: 54, maybe: 20, not_attending: 4 },
  'evt-past': { attending: 41, maybe: 0, not_attending: 5 },
}

const names = ['Aisyah Rahman', 'Hafiz Ismail', 'Nurul Huda', 'Danial Azmi', 'Tan Mei Ling', 'Arjun Nair', 'Siti Aminah', 'Lim Wei Jie']

export const demoMembers: Profile[] = names.map((full_name, i) => ({
  ...demoProfile,
  id: i === 0 ? DEMO_USER_ID : `member-${i}`,
  email: `${full_name.split(' ')[0].toLowerCase()}@example.com`,
  full_name,
  student_id: `20230${10000 + i * 137}`,
  batch: 2022 + (i % 4),
  course: ['Computer Science', 'Mechanical Eng.', 'Business', 'Design'][i % 4],
  role: (i === 0 ? demoProfile.role : i < 3 ? 'organizer' : 'student') as AppRole,
}))


// ---------- Club members, posts, applications ----------

const usernames = ['aisyah.r', 'hafiz_i', 'nurul.h', 'danial', 'meiling', 'arjun.n', 'siti_a', 'weijie']
demoMembers.forEach((m, i) => (m.username = usernames[i]))

export const demoUsernames: Record<string, string> = Object.fromEntries(
  demoMembers.map((m) => [m.id, m.username ?? '']),
)

function membership(club_id: string, user_id: string, role: ClubMembership['role'], status: ClubMembership['status'] = 'active', message = ''): ClubMembership {
  return { club_id, user_id, role, status, message, created_at: now }
}

export const demoClubMembers: ClubMembership[] = [
  membership('club-badminton', DEMO_USER_ID, 'president'),
  membership('club-badminton', 'member-1', 'vice_president'),
  membership('club-badminton', 'member-5', 'committee'),
  membership('club-badminton', 'member-6', 'member'),
  membership('club-badminton', 'member-7', 'member'),
  membership('club-badminton', 'member-4', 'member', 'pending', 'Hi! I played in secondary school, would love to join 🙌'),
  membership('club-futsal', 'member-3', 'president'),
  membership('club-futsal', 'member-6', 'member'),
  membership('club-study', 'member-2', 'president'),
  membership('club-study', DEMO_USER_ID, 'member'),
  membership('club-study', 'member-7', 'committee'),
  membership('club-culture', 'member-4', 'president'),
  membership('club-culture', 'member-2', 'vice_president'),
]

/** The preview's "Student" shows an ordinary member; Organizer/Admin show a club president. */
function syncDemoClubRole(role: AppRole) {
  const mine = demoClubMembers.find((m) => m.club_id === 'club-badminton' && m.user_id === DEMO_USER_ID)
  if (mine) mine.role = role === 'student' ? 'member' : 'president'
  const hafiz = demoClubMembers.find((m) => m.club_id === 'club-badminton' && m.user_id === 'member-1')
  if (hafiz) hafiz.role = role === 'student' ? 'president' : 'vice_president'
}
setDemoRole(getDemoRole())

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

function nextWeekday(day: number, hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + ((day + 7 - d.getDay()) % 7 || 7))
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const demoClubPosts: ClubPost[] = [
  {
    id: 'cp-1', club_id: 'club-badminton', author_id: DEMO_USER_ID, kind: 'meeting',
    title: 'Weekly session', body: 'Usual court. We have 4 spare rackets, just bring indoor shoes.',
    meeting_at: nextWeekday(3, 19), location: 'ERICA Gym, Court 2', visibility: 'everyone',
    pinned: true, created_at: hoursAgo(30), updated_at: hoursAgo(30),
  },
  {
    id: 'cp-2', club_id: 'club-badminton', author_id: 'member-1', kind: 'activity',
    title: 'Friendly match vs Indonesian Students Association 🏸',
    body: 'We won 3–2! Thanks everyone who came to support. Photos are in the KakaoTalk album.',
    meeting_at: null, location: '', visibility: 'everyone', pinned: false,
    created_at: hoursAgo(72), updated_at: hoursAgo(72),
  },
  {
    id: 'cp-3', club_id: 'club-badminton', author_id: 'member-5', kind: 'update',
    title: 'Committee: shuttlecock budget',
    body: 'We need to restock shuttlecocks before the tournament. Committee please check the spreadsheet.',
    meeting_at: null, location: '', visibility: 'members', pinned: false,
    created_at: hoursAgo(120), updated_at: hoursAgo(120),
  },
  {
    id: 'cp-4', club_id: 'club-study', author_id: 'member-2', kind: 'meeting',
    title: 'Midterm study session', body: 'Bring your past-year papers. Seniors from Mech & CS will be there.',
    meeting_at: nextWeekday(0, 14), location: 'Library Group Study Room B', visibility: 'everyone',
    pinned: false, created_at: hoursAgo(10), updated_at: hoursAgo(10),
  },
]

export const demoApplications: ClubApplication[] = [
  {
    id: 'app-1', applicant_id: 'member-5', club_name: 'Hiking & Outdoors',
    category: 'Sports', tagline: 'Mountains near Ansan every month',
    description: 'A club for students who want to explore Korean mountains and trails together, safely and on a budget.',
    objectives: 'Get students outdoors, build friendships across batches, learn hiking safety.',
    activities_plan: 'Monthly hike (Suri-san, Bukhansan), one overnight trip per semester.',
    advisor_name: 'Dr. Kim (International Office)',
    founding_members: 'meiling, arjun.n, siti_a, weijie, nurul.h',
    documents: { constitution: 'https://drive.google.com/', member_list: 'https://drive.google.com/', activity_plan: 'https://drive.google.com/' },
    status: 'pending', admin_note: '', reviewed_at: null, club_id: null,
    created_at: hoursAgo(20), updated_at: hoursAgo(20),
  },
  {
    id: 'app-2', applicant_id: DEMO_USER_ID, club_name: 'Photography Club',
    category: 'Cultural', tagline: 'Capture Korea through our lens',
    description: 'Photo walks around Seoul and Ansan, editing workshops and a small exhibition at the end of the year.',
    objectives: 'Learn photography, document PPMK events.', activities_plan: 'Bi-weekly photo walks.',
    advisor_name: '', founding_members: 'hafiz_i, danial, weijie',
    documents: { constitution: 'https://drive.google.com/' },
    status: 'needs_changes', admin_note: 'Please add at least 5 founding members and your member list document.',
    reviewed_at: hoursAgo(5), club_id: null, created_at: hoursAgo(48), updated_at: hoursAgo(5),
  },
]

// ---------- Discussion board ----------

type DemoForumPost = ForumPost & { author_id: string }
type DemoForumComment = ForumComment & { post_id: string; author_id: string }

function fpost(p: Partial<DemoForumPost> & Pick<DemoForumPost, 'id' | 'category' | 'title' | 'body' | 'author_id'>): DemoForumPost {
  return {
    place_name: null, place_area: null, map_url: null, cost_note: null,
    link_url: null, deadline: null, looking_for: null, is_closed: false, is_anonymous: false,
    author_username: null, is_mine: false, score: 1, my_vote: null, comment_count: 0,
    created_at: now, updated_at: now, ...p,
  }
}

export const demoForumPosts: DemoForumPost[] = [
  fpost({
    id: 'fp-1', category: 'food', author_id: 'member-1', score: 42, created_at: hoursAgo(5),
    title: 'Finally found proper halal nasi lemak in Ansan 😭',
    body: 'Small place near Ansan station, run by an Indonesian couple. Sambal is spicy enough, rice is lemak. ₩9,000 with ayam goreng. Closed Mondays.',
    place_name: 'Warung Bu Sri', place_area: 'Ansan Station', map_url: 'https://map.naver.com/',
    cost_note: '~₩9,000 per person',
  }),
  fpost({
    id: 'fp-2', category: 'hidden_gems', author_id: 'member-4', score: 27, created_at: hoursAgo(26),
    title: 'Gatekeeping no more: quiet rooftop café with a view of the sea',
    body: 'Take bus 123 to the end. Almost no tourists, the strawberry latte is great and they let you study for hours.',
    place_name: 'Cafe Haneul', place_area: 'Daebudo', map_url: 'https://map.kakao.com/',
    cost_note: '~₩7,000 a drink',
  }),
  fpost({
    id: 'fp-7', category: 'trips', author_id: 'member-4', score: 33, created_at: hoursAgo(14),
    title: 'Club MT itinerary: 2 days in Gapyeong for 20 people (tested!)',
    body: 'Day 1: ITX from Yongsan, pension check-in, BBQ (we brought halal meat from Itaewon), games night.\nDay 2: Nami Island in the morning, rail bike, back by 6pm. Book the pension at least 3 weeks ahead.',
    place_name: 'Gapyeong', place_area: 'Gyeonggi-do', cost_note: '~₩85,000 per person',
  }),
  fpost({
    id: 'fp-8', category: 'budget', author_id: 'member-7', score: 21, created_at: hoursAgo(40),
    title: 'Jeju 3D2N on a student budget: full breakdown',
    body: 'Flights booked 6 weeks early, guesthouse near the airport, rented an EV with 3 friends. Biggest saving: eat at the traditional markets.',
    place_area: 'Jeju', cost_note: '~₩320,000 per person',
  }),
  fpost({
    id: 'fp-9', category: 'hackathon', author_id: 'member-5', score: 12, created_at: hoursAgo(18),
    title: 'Looking for 2 teammates for a 48h hackathon in Seoul',
    body: 'Theme is AI for public services. I do backend (Python). Need a frontend dev and someone good at pitching/design. Beginners welcome, we are here to learn.',
    looking_for: 'Frontend (React), Designer / pitcher', deadline: day(10), link_url: 'https://example.com/hackathon',
  }),
  fpost({
    id: 'fp-10', category: 'startup', author_id: 'member-2', score: 8, created_at: hoursAgo(60),
    title: 'Building a halal food finder app for Korea: need co-builders',
    body: 'Have a working prototype and 40 places mapped. Looking for people who want to build something useful for the community.',
    looking_for: 'Mobile dev, data/maps, marketing',
  }),
  fpost({
    id: 'fp-11', category: 'activities', author_id: 'member-3', score: 6, created_at: hoursAgo(30),
    title: 'Anyone joining the ASEAN youth night? Let\'s go as a group',
    body: 'Thinking of going together from Ansan. Will also help at the Malaysia booth if they need volunteers.',
    looking_for: 'Anyone interested!', deadline: day(8), is_closed: false,
  }),
  fpost({
    id: 'fp-3', category: 'serious', author_id: 'member-6', is_anonymous: true, score: 18, created_at: hoursAgo(9),
    title: 'Feeling really behind in my major, is it normal?',
    body: 'Second year, everything is in Korean and I feel like I am the only one struggling. How did you seniors cope?',
  }),
  fpost({
    id: 'fp-4', category: 'study', author_id: 'member-2', score: 15, created_at: hoursAgo(50),
    title: 'TOPIK 4 in 3 months: my study plan + free resources',
    body: 'Sharing what worked for me: daily vocab with Anki, past papers every weekend, and a language exchange partner.',
  }),
  fpost({
    id: 'fp-5', category: 'hangout', author_id: DEMO_USER_ID, score: 9, created_at: hoursAgo(80),
    title: 'Best spot to watch the sunset near campus?',
    body: 'Looking for somewhere chill for a small group this weekend. Bonus points if there is food nearby.',
  }),
  fpost({
    id: 'fp-6', category: 'serious', author_id: 'member-3', score: 11, created_at: hoursAgo(100),
    title: 'Visa extension (D-2): what documents did you need?',
    body: 'My visa ends in February. Anyone did the extension at the Ansan immigration office recently?',
  }),
]

export const demoForumComments: DemoForumComment[] = [
  { id: 'fc-1', post_id: 'fp-1', parent_id: null, author_id: 'member-5', body: 'Went yesterday, can confirm the sambal is legit 🔥', is_anonymous: false, author_username: null, is_mine: false, is_op: false, created_at: hoursAgo(4) },
  { id: 'fc-2', post_id: 'fp-1', parent_id: 'fc-1', author_id: 'member-1', body: 'Told you! Try the rendang next time.', is_anonymous: false, author_username: null, is_mine: false, is_op: false, created_at: hoursAgo(3) },
  { id: 'fc-3', post_id: 'fp-3', parent_id: null, author_id: 'member-2', body: 'Very normal. Year 2 was the hardest for me too. Join the Study Circle on Sundays, seniors explain things in English and BM.', is_anonymous: false, author_username: null, is_mine: false, is_op: false, created_at: hoursAgo(8) },
  { id: 'fc-4', post_id: 'fp-3', parent_id: 'fc-3', author_id: 'member-6', body: 'Thank you, I will try this Sunday 🥹', is_anonymous: true, author_username: null, is_mine: false, is_op: false, created_at: hoursAgo(7) },
  { id: 'fc-5', post_id: 'fp-3', parent_id: null, author_id: DEMO_USER_ID, body: 'You are not alone. DM me if you want to study together.', is_anonymous: true, author_username: null, is_mine: false, is_op: false, created_at: hoursAgo(6) },
]

// ---------- Explore: opportunities ----------

function opp(o: Partial<Opportunity> & Pick<Opportunity, 'id' | 'title' | 'kind' | 'scope'>): Opportunity {
  return {
    organizer: '', location: '', start_date: null, end_date: null, apply_deadline: null, url: null,
    description: '', status: 'published', created_by: null, created_at: now, updated_at: now, ...o,
  }
}

export const demoOpportunities: Opportunity[] = [
  opp({
    id: 'op-1', kind: 'culture', scope: 'korea',
    title: 'ASEAN-Korean Youth Network Night',
    organizer: 'AYNK · ASEAN Youth Network in Korea',
    location: 'Seoul', start_date: day(11),
    description: 'Yearly networking and cultural-exchange night for ASEAN and Korean youth in Korea. (Sample listing for the preview: check AYNK for the real date.)',
    url: 'https://aseanynk.notion.site/',
  }),
  opp({
    id: 'op-2', kind: 'competition', scope: 'korea',
    title: 'AI for Public Good Hackathon (sample)', organizer: 'Sample organizer',
    location: 'Seoul', start_date: day(16), end_date: day(17), apply_deadline: day(10),
    description: '48-hour hackathon open to international students. Teams of 2–4.',
  }),
  opp({
    id: 'op-3', kind: 'conference', scope: 'asia',
    title: 'Asian Youth Leadership Forum (sample)', organizer: 'Sample organizer',
    location: 'Kuala Lumpur, Malaysia', start_date: day(45), end_date: day(48), apply_deadline: day(20),
    description: 'Youth delegates from across Asia discuss climate, education and digital economy.',
  }),
  opp({
    id: 'op-4', kind: 'scholarship', scope: 'global',
    title: 'Summer research exchange (sample)', organizer: 'Sample university network',
    location: 'Various', start_date: day(200), apply_deadline: day(60),
    description: 'Funded 8-week research placements for undergraduates.',
  }),
  opp({
    id: 'op-5', kind: 'career', scope: 'online',
    title: 'Working in Korea after graduation: online career talk (sample)', organizer: 'Sample organizer',
    location: 'Zoom', start_date: day(6),
    description: 'Visa options (D-10, E-7), job search tips and Q&A with Malaysian alumni.',
  }),
  opp({
    id: 'op-6', kind: 'volunteer', scope: 'korea',
    title: 'Embassy community day volunteers (suggested)', organizer: 'Suggested by @nurul.h',
    location: 'Seoul', start_date: day(25), status: 'suggested', created_by: 'member-2',
    description: 'A member suggested this. Organizers check it before it goes live.',
  }),
]

// ---------- Photos ----------

function photo(p: Partial<Photo> & Pick<Photo, 'id' | 'url'>): Photo {
  return {
    path: p.url, uploaded_by: 'member-1', forum_post_id: null, club_post_id: null, club_id: null,
    caption: '', status: 'approved', reject_reason: '', created_at: hoursAgo(5), ...p,
  }
}

export const demoPhotos: Photo[] = [
  photo({ id: 'ph-1', url: '/images/welcome-dinner.webp', forum_post_id: 'fp-1' }),
  photo({ id: 'ph-2', url: '/images/malaysian-culture-workshop.webp', forum_post_id: 'fp-1' }),
  photo({ id: 'ph-3', url: '/images/study-group-night.webp', forum_post_id: 'fp-2', uploaded_by: 'member-4' }),
  photo({ id: 'ph-4', url: '/images/ppmk-sports-day.webp', forum_post_id: 'fp-7', uploaded_by: 'member-4' }),
  photo({ id: 'ph-5', url: '/images/ppmk-sports-day.webp', club_id: 'club-badminton', uploaded_by: DEMO_USER_ID }),
  photo({ id: 'ph-6', url: '/images/welcome-dinner.webp', club_post_id: 'cp-2', uploaded_by: 'member-1' }),
  photo({ id: 'ph-7', url: '/images/faith-community-gathering.webp', forum_post_id: 'fp-8', uploaded_by: 'member-7', status: 'pending', created_at: hoursAgo(2) }),
  photo({ id: 'ph-8', url: '/images/career-talk-alumni.webp', club_post_id: 'cp-1', uploaded_by: DEMO_USER_ID, status: 'pending', created_at: hoursAgo(1) }),
]

// ---------- Organisation page (sample people: NOT real contacts) ----------

function person(p: Partial<OrgMember> & Pick<OrgMember, 'id' | 'role' | 'name'>): OrgMember {
  return {
    kind: 'committee', sponsor: null, tier: 4, detail: '', session: '2026/2027', email: null, phone: null,
    whatsapp: null, instagram: null, photo_path: null, photo_url: null, sort_order: 100, contacts_hidden: false, ...p,
  }
}

const sampleContacts = (n: number) => ({
  email: `sample${n}@ppmk.example`,
  phone: `010-0000-00${String(n).padStart(2, '0')}`,
  whatsapp: `82100000${String(n).padStart(4, '0')}`,
})

export const demoOrgPeople: OrgMember[] = [
  person({ id: 'op-1', tier: 1, role: 'President', name: 'Sample: Amir Hakim', detail: 'Seoul National University', sort_order: 1, ...sampleContacts(1) }),
  person({ id: 'op-2', tier: 2, role: 'Vice President', name: 'Sample: Nurul Izzah', detail: 'Korea University', sort_order: 2, ...sampleContacts(2) }),
  person({ id: 'op-3', tier: 3, role: 'Secretary', name: 'Sample: Tan Wei Ming', detail: 'Hanyang University', sort_order: 3, ...sampleContacts(3) }),
  person({ id: 'op-4', tier: 3, role: 'Treasurer', name: 'Sample: Siti Aminah', detail: 'Yonsei University', sort_order: 4, ...sampleContacts(4) }),
  person({ id: 'op-5', role: 'Head of Welfare', name: 'Sample: Arjun Nair', detail: 'KAIST', sort_order: 5, ...sampleContacts(5) }),
  person({ id: 'op-6', role: 'Head of Academic & Career', name: 'Sample: Hafiz Ismail', detail: 'Pusan National University', sort_order: 6, ...sampleContacts(6) }),
  person({ id: 'op-7', role: 'Head of Sports & Recreation', name: 'Sample: Danial Azmi', detail: 'Hanyang ERICA', sort_order: 7, instagram: 'ppmk.sukan', ...sampleContacts(7) }),
  person({ id: 'op-8', role: 'Head of Media & Publicity', name: 'Sample: Lim Mei Ling', detail: 'Sungkyunkwan University', sort_order: 8, instagram: 'ppmk.media', ...sampleContacts(8) }),
  person({ id: 'op-2b', tier: 2, role: 'Vice President II', name: 'Sample: Farid Hassan', detail: 'Chung-Ang University', sort_order: 3, ...sampleContacts(15) }),
  person({ id: 'op-3b', tier: 3, role: 'Assistant Secretary', name: 'Sample: Chong Li Ying', detail: 'Ewha Womans University', sort_order: 5, ...sampleContacts(16) }),
  person({ id: 'op-ajk1', tier: 5, role: 'AJK Welfare', name: 'Sample: Irfan Zaki', detail: 'Inha University', sort_order: 20 }),
  person({ id: 'op-ajk2', tier: 5, role: 'AJK Sports', name: 'Sample: Balqis Rahim', detail: 'Hanyang ERICA', sort_order: 21 }),
  person({ id: 'op-ajk3', tier: 5, role: 'AJK Media', name: 'Sample: Kevin Ong', detail: 'Kyung Hee University', sort_order: 22 }),
  person({ id: 'op-ajk4', tier: 5, role: 'AJK Academic', name: 'Sample: Hana Yusof', detail: 'Ajou University', sort_order: 23 }),
  person({ id: 'op-9', kind: 'sponsor', sponsor: 'MARA', role: 'Education officer', name: 'Sample MARA officer', detail: 'Scholarship, allowance and study-progress matters for MARA-sponsored students', sort_order: 1, ...sampleContacts(9) }),
  person({ id: 'op-10', kind: 'sponsor', sponsor: 'JPA', role: 'Education officer', name: 'Sample JPA officer', detail: 'Scholarship and allowance matters for JPA-sponsored students', sort_order: 1, ...sampleContacts(10) }),
]

function cal(c: Partial<OrgCalendarItem> & Pick<OrgCalendarItem, 'id' | 'title' | 'start_date'>): OrgCalendarItem {
  return { category: 'event', end_date: null, location: '', description: '', url: null, ...c }
}

export const demoOrgCalendar: OrgCalendarItem[] = [
  cal({ id: 'oc-1', title: 'PPMK Annual General Meeting', category: 'meeting', start_date: day(9), location: 'Seoul', description: 'Committee reports and election of the new High Committee. (Sample date.)' }),
  cal({ id: 'oc-2', title: 'Sports carnival registration closes', category: 'deadline', start_date: day(14) }),
  cal({ id: 'oc-3', title: 'PPMK Sports Carnival', category: 'sports', start_date: day(24), end_date: day(25), location: 'Daejeon', description: 'Futsal, badminton and netball between universities. (Sample.)' }),
  cal({ id: 'oc-4', title: 'Winter welfare check-in', category: 'event', start_date: day(38), location: 'Online' }),
  cal({ id: 'oc-5', title: 'Hari Raya Aidilfitri open house', category: 'festive', start_date: day(118), location: 'Seoul', description: 'Sample date: the real one follows the moon sighting.' }),
  cal({ id: 'oc-6', title: 'Spring semester starts', category: 'academic', start_date: day(108) }),
]
