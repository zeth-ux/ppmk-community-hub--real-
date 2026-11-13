import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUp,
  CalendarCheck,
  ClipboardList,
  Compass,
  Info,
  MapPin,
  MessageCircle,
  MessagesSquare,
  MousePointerClick,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  getPublicStats,
  listClubs,
  listEvents,
  listForumPosts,
  listMyClubMemberships,
  listOpportunities,
  listPendingPhotos,
  listPhotos,
  listPublicClubs,
  listPublicUpcomingEvents,
  listRsvpCounts,
} from '../lib/api'
import { categoryInfo, displayName, isPast, timeAgo } from '../lib/format'
import { CLUB_ROLE_LABEL, FORUM_CATEGORIES, OPPORTUNITY_KINDS } from '../lib/types'
import { emsu, ppmk } from '../data/organization'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import EventCard from '../components/EventCard'
import MyRsvpsList from '../components/MyRsvpsList'
import { Spinner, buttonPrimary, buttonSecondary, card } from '../components/ui'
import Songket from '../components/Songket'

export default function HomePage() {
  usePageMeta(null)
  const { session, profileComplete, isMember } = useAuth()
  if (session && profileComplete && isMember) return <SignedInHome />
  return <Landing />
}

// ---------------------------------------------------------------------
// Public homepage: PPMK for everyone (signed out, visitors, new users)
// ---------------------------------------------------------------------

function Landing() {
  const { session, profileComplete, isVisitor } = useAuth()
  const { data } = useLoader(async () => {
    const [clubs, events, stats, places, opportunities] = await Promise.all([
      listPublicClubs().catch(() => []),
      listPublicUpcomingEvents().catch(() => []),
      getPublicStats().catch(() => null),
      listForumPosts({ category: 'group:explore', sort: 'top' }).catch(() => []),
      listOpportunities().catch(() => []),
    ])
    const top = places.slice(0, 3)
    const photos = await listPhotos('forum_post_id', top.map((p) => p.id)).catch(() => [])
    const thumbs: Record<string, string> = {}
    for (const ph of photos) if (ph.status === 'approved' && !thumbs[ph.forum_post_id!]) thumbs[ph.forum_post_id!] = ph.url
    return {
      thumbs,
      clubs,
      events: events.slice(0, 3),
      stats,
      places: top,
      opportunities: opportunities.filter((o) => o.status === 'published').slice(0, 3),
    }
  }, [])

  const start = session ? (profileComplete ? '/discuss' : '/me?welcome=1') : '/login?next=/events'
  const startLabel = session ? (profileComplete ? 'Open the board' : 'Finish your profile') : 'Join the hub'

  return (
    <div className="-mt-6 space-y-14 sm:space-y-20">
      {/* Hero */}
      <section className="relative -mx-4 overflow-hidden border-b border-slate-200 px-4 pb-12 pt-6 sm:-mx-6 sm:px-6 lg:pb-16 lg:pt-10">
        <Songket className="absolute right-0 top-0 hidden h-[62%] w-[45%] opacity-20 [mask-image:linear-gradient(to_left,black_20%,transparent),linear-gradient(to_top,transparent,black_40%)] [mask-composite:intersect] md:block dark:opacity-25" />
        <div className="relative">
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            {ppmk.fullName}
          </Link>
          <h1 className="mt-6 font-display text-[3.7rem] sm:text-8xl lg:text-[9.5rem]">
            <span className="block whitespace-nowrap">Jauh di mata,</span>
            <span className="block whitespace-nowrap text-gold">dekat di hati.</span>
          </h1>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <p className="max-w-lg text-[17px] leading-7 text-slate-600">
                Far from home, close at heart. Events, clubs, halal makan and hidden gems for Malaysian students in
                Korea, run by {ppmk.shortName} and {emsu.shortName}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to={start} className={`${buttonPrimary} px-6 py-3.5`}>
                  {startLabel} <ArrowRight size={17} />
                </Link>
                <Link to="/discuss" className={`${buttonSecondary} bg-background px-6 py-3.5`}>
                  <Compass size={17} /> Visiting Korea? Explore
                </Link>
              </div>
              {!session && <p className="mt-4 text-sm text-slate-500">No password. Your email and a 6-digit code.</p>}
              {isVisitor && <p className="mt-4 text-sm text-slate-500">Signed in as a visitor: Explore Korea and Opportunities are open to you.</p>}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-surface p-5">
              {data?.stats && (
                <dl className="grid grid-cols-3 divide-x divide-slate-200">
                  {[
                    [data.stats.members, 'students'],
                    [data.stats.clubs, 'clubs'],
                    [data.stats.events_this_year, 'events this year'],
                  ].map(([n, label]) => (
                    <div key={label as string} className="flex flex-col-reverse px-4 first:pl-0">
                      <dt className="mt-1 text-sm text-slate-500">{label as string}</dt>
                      <dd className="font-display text-5xl text-gold">{n as number}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {data?.events[0] && (
                <Link
                  to={session ? `/events/${data.events[0].id}` : `/login?next=/events/${data.events[0].id}`}
                  className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4 transition hover:text-primary"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      Next up: {new Date(`${data.events[0].event_date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })},{' '}
                      {data.events[0].start_time.slice(0, 5)}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-slate-500">
                      {data.events[0].title}, {data.events[0].location}
                    </p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-primary" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* About PPMK */}
      <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-display text-5xl sm:text-6xl">Who we are</h2>
          <p className="mt-5 leading-7 text-slate-600">{ppmk.summary}</p>
          <p className="mt-3 leading-7 text-slate-600">{emsu.summary}</p>
          <Link to="/ppmk" className="mt-5 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            Committee and contacts <ArrowRight size={15} />
          </Link>
        </div>
        <dl className="grid border-t border-slate-200 sm:grid-cols-2">
          {ppmk.focus.map((f, i) => (
            <div key={f.title} className={`border-b border-slate-200 py-5 ${i % 2 === 0 ? 'sm:border-r sm:pr-6' : 'sm:pl-6'}`}>
              <dt className="text-lg font-bold">{f.title}</dt>
              <dd className="mt-1 text-[15px] leading-6 text-slate-600">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Upcoming events */}
      {data && data.events.length > 0 && (
        <section>
          <SectionHead title="Coming up" text="Open events from PPMK and EMSU clubs." link={session ? '/events' : '/login?next=/events'} linkLabel="All events" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.events.map((e) => (
              <Link
                key={e.id}
                to={session ? `/events/${e.id}` : `/login?next=/events/${e.id}`}
                className={`${card} flex gap-4 p-4 transition hover:border-primary`}
              >
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[10px] border border-slate-200 py-2">
                  <span className="text-xs font-semibold text-primary">{new Date(`${e.event_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })}</span>
                  <span className="font-display text-3xl">{new Date(`${e.event_date}T00:00:00`).getDate()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500">{e.club_name ?? e.category}</p>
                  <p className="font-bold leading-snug">{e.title}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500"><MapPin size={12} /> {e.location}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore Korea: open to everyone */}
      <section>
        <SectionHead
          title="Explore Korea, the Malaysian way"
          text="Halal makan, hidden gems, trip itineraries and budgets, shared by students. Open to everyone, tourists too."
          link="/discuss?g=explore"
          linkLabel="Open Explore Korea"
        />
        <div className="mt-5 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {FORUM_CATEGORIES.filter((c) => c.group === 'explore').map((c) => (
            <Link key={c.id} to={`/discuss?c=${c.id}`} className="shrink-0 rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700">
              {c.emoji} {c.label}
            </Link>
          ))}
        </div>
        {data && data.places.length > 0 && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {data.places.map((p) => (
              <Link key={p.id} to={`/discuss/${p.id}`} className={`${card} flex flex-col overflow-hidden transition hover:border-emerald-400`}>
                {data.thumbs[p.id] && <img src={data.thumbs[p.id]} alt={`Photo from “${p.title}”`} loading="lazy" className="h-36 w-full object-cover" />}
                <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-semibold text-emerald-700">{categoryInfo(p.category).emoji} {categoryInfo(p.category).label}</p>
                <p className="mt-1 line-clamp-2 font-bold leading-snug">{p.title}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-500">
                  {(p.place_name || p.place_area) && <span className="flex items-center gap-1"><MapPin size={12} /> {[p.place_name, p.place_area].filter(Boolean).join(' · ')}</span>}
                  <span className="flex items-center gap-1"><ArrowUp size={12} /> {p.score}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {p.comment_count}</span>
                </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Clubs */}
      {data && data.clubs.length > 0 && (
        <section>
          <SectionHead title="Clubs under PPMK" text="Find your people, or start your own club with 5 friends." link={session ? '/clubs/apply' : '/login?next=/clubs/apply'} linkLabel="Start a club" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.clubs.map((club) => (
              <Link
                key={club.id}
                to={session ? `/clubs/${club.id}` : `/login?next=/clubs/${club.id}`}
                className={`${card} p-4 transition hover:border-primary`}
              >
                <p className="text-xs font-semibold text-primary">{club.category}</p>
                <p className="mt-1 font-bold">{club.name}</p>
                {club.tagline && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{club.tagline}</p>}
                <p className="mt-3 text-xs text-slate-400">{club.members} members</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Opportunities */}
      {data && data.opportunities.length > 0 && (
        <section>
          <SectionHead title="Beyond PPMK" text="Youth forums, hackathons and programmes in Korea, Asia and online." link="/explore" linkLabel="All opportunities" />
          <ul className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            {data.opportunities.map((o) => (
              <li key={o.id}>
                <Link to="/explore" className="flex items-center justify-between gap-4 py-4 transition hover:text-primary">
                  <div className="min-w-0">
                    <p className="font-bold leading-snug">{o.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {OPPORTUNITY_KINDS[o.kind].label}, {o.organizer}
                    </p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* How it works + CTA */}
      <section className="border-t border-slate-200 pt-10">
        <h2 className="font-display text-4xl sm:text-5xl">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {[
            [UserPlus, 'Sign up once', 'Email + 6-digit code, pick a username. PPMK students add their details once; visitors just need a username.'],
            [MousePointerClick, 'Tap to join', 'Open an event link from the group chat and tap "I\'m going". Join clubs the same way.'],
            [ClipboardList, 'Organizers relax', 'Club leaders get live attendee lists, check-in and a CSV export, without new spreadsheets.'],
          ].map(([Icon, title, text], i) => {
            const I = Icon as typeof UserPlus
            return (
              <li key={title as string} className="flex gap-4">
                <span className="font-display text-5xl text-gold">{i + 1}</span>
                <div>
                  <p className="flex items-center gap-2 font-bold"><I size={17} className="text-slate-400" /> {title as string}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{text as string}</p>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={start} className={buttonPrimary}>
            {startLabel} <ArrowRight size={16} />
          </Link>
          <Link to="/ppmk" className={buttonSecondary}>PPMK</Link>
        </div>
      </section>
    </div>
  )
}

function SectionHead({ title, text, link, linkLabel }: { title: string; text: string; link: string; linkLabel: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-4xl sm:text-5xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-slate-600">{text}</p>
      </div>
      <Link to={link} className={buttonSecondary}>{linkLabel}</Link>
    </div>
  )
}

// ---------------------------------------------------------------------
// Signed-in home
// ---------------------------------------------------------------------

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }).format(new Date()))
  return hour < 12 ? 'Selamat pagi' : hour < 18 ? 'Selamat petang' : 'Selamat malam'
}

function SignedInHome() {
  const { session, profile, isOrganizer, isAdmin } = useAuth()
  const userId = session!.user.id
  const { data: pendingPhotos } = useLoader(() => (isAdmin ? listPendingPhotos().catch(() => []) : Promise.resolve([])), [isAdmin])

  const { data, loading } = useLoader(async () => {
    const [events, counts, posts, memberships, clubs] = await Promise.all([
      listEvents(),
      listRsvpCounts(),
      listForumPosts({ sort: 'hot' }).catch(() => []),
      listMyClubMemberships(userId).catch(() => []),
      listClubs(),
    ])
    return {
      events: events.filter((e) => !isPast(e)).slice(0, 3),
      counts,
      posts: posts.slice(0, 4),
      myClubs: memberships
        .filter((m) => m.status === 'active')
        .map((m) => ({ ...m, club: clubs.find((c) => c.id === m.club_id) }))
        .filter((m) => m.club),
    }
  }, [userId])

  const ledClub = data?.myClubs.find((m) => m.role === 'president' || m.role === 'vice_president')

  const quick = [
    { to: '/events', label: 'Events', icon: CalendarCheck },
    { to: '/clubs', label: 'Clubs', icon: Users },
    { to: '/discuss', label: 'Discuss', icon: MessagesSquare },
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/ask', label: 'Ask the Hub', icon: Sparkles },
    { to: '/ppmk', label: 'PPMK', icon: Info },
  ]

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-200 pb-6">
        <p className="text-slate-500">{greeting()},</p>
        <h1 className="font-display text-5xl normal-case sm:text-6xl">{displayName(profile)}</h1>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {isOrganizer && (
            <Link
              to={ledClub ? `/organizer?new=1&club=${ledClub.club_id}` : '/organizer?new=1'}
              className={`${buttonPrimary} shrink-0 py-2.5`}
            >
              <ClipboardList size={16} />
              Create an event
            </Link>
          )}
          {quick.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={`${buttonSecondary} shrink-0`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {pendingPhotos && pendingPhotos.length > 0 && (
        <Link to="/admin" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 hover:bg-amber-100">
          <span className="font-semibold">
            📷 {pendingPhotos.length} {pendingPhotos.length === 1 ? 'photo is' : 'photos are'} waiting for your approval
          </span>
          <ArrowRight size={18} />
        </Link>
      )}

      {data && data.myClubs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Your clubs</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {data.myClubs.map((m) => (
              <Link
                key={m.club_id}
                to={`/clubs/${m.club_id}`}
                className={`${card} min-w-[220px] shrink-0 p-4 transition hover:border-primary`}
              >
                <p className="text-xs font-semibold text-primary">{CLUB_ROLE_LABEL[m.role]}</p>
                <p className="mt-1 font-bold">{m.club!.name}</p>
                {m.club!.meeting_info && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{m.club!.meeting_info}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <MyRsvpsList userId={userId} title="Your next events" />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Coming up</h2>
          <Link to="/events" className={buttonSecondary}>See all</Link>
        </div>
        {loading ? (
          <Spinner />
        ) : data && data.events.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.events.map((event) => (
              <EventCard key={event.id} event={event} counts={data.counts[event.id]} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-surface p-6 text-center text-sm text-slate-500">
            No upcoming events yet.
          </p>
        )}
      </section>

      {data && data.posts.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">People are talking about</h2>
            <Link to="/discuss" className={buttonSecondary}>Open board</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.posts.map((post) => {
              const cat = FORUM_CATEGORIES.find((c) => c.id === post.category)
              return (
                <Link key={post.id} to={`/discuss/${post.id}`} className={`${card} flex gap-3 p-4 transition hover:border-primary`}>
                  <div className="flex w-10 shrink-0 flex-col items-center text-slate-500">
                    <ArrowUp size={16} />
                    <span className="text-sm font-bold text-slate-800">{post.score}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">
                      {cat?.emoji} {cat?.label} · {timeAgo(post.created_at)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 font-semibold leading-snug">{post.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <MessageCircle size={13} /> {post.comment_count}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
