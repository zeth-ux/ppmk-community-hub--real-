import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, ClipboardList, MousePointerClick, Sparkles, UserPlus } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { listEvents, listRsvpCounts } from '../lib/api'
import { firstName, isPast } from '../lib/format'
import { useLoader } from '../lib/useLoader'
import EventCard from '../components/EventCard'
import MyRsvpsList from '../components/MyRsvpsList'
import { Spinner, buttonSecondary } from '../components/ui'

export default function HomePage() {
  const { session, profileComplete } = useAuth()

  if (session && profileComplete) return <SignedInHome />

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-primary px-6 py-12 text-white sm:px-10 sm:py-16">
        <p className="text-sm font-semibold text-red-100">PPMK · EMSU · Hanyang ERICA</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          Fill in your details once. Join every event with one tap.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-red-100 sm:text-base">
          All Malaysian student events at Hanyang ERICA in one place. No more
          new Google Form every time.
        </p>
        <Link
          to={session ? '/me?welcome=1' : '/login'}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary"
        >
          {session ? 'Finish your profile' : 'Get started'}
          <ArrowRight size={17} />
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          [UserPlus, 'Sign up once', 'Sign in with your email and fill in your details: name, student ID, batch and phone.'],
          [MousePointerClick, 'Tap to RSVP', 'Open an event link from the group chat and tap "I\'m going". That\'s it.'],
          [ClipboardList, 'Organizers relax', 'Organizers get a live attendee list and a CSV export, without rebuilding spreadsheets.'],
        ].map(([Icon, title, text]) => {
          const I = Icon as typeof UserPlus
          return (
            <div key={title as string} className="rounded-2xl border border-slate-200 bg-white p-5">
              <I className="text-primary" />
              <h2 className="mt-3 font-bold">{title as string}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{text as string}</p>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function SignedInHome() {
  const { session, profile, isOrganizer } = useAuth()

  const { data, loading } = useLoader(async () => {
    const [events, counts] = await Promise.all([listEvents(), listRsvpCounts()])
    return { events: events.filter((e) => !isPast(e)).slice(0, 3), counts }
  }, [])

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-primary px-6 py-8 text-white sm:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Hi {firstName(profile)} 👋</h1>
        <p className="mt-2 text-sm text-red-100">Here's what's coming up in the community.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/events" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary">
            <CalendarCheck size={16} />
            All events
          </Link>
          <Link to="/ask" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25">
            <Sparkles size={16} />
            Ask the Hub
          </Link>
          {isOrganizer && (
            <Link to="/organizer?new=1" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25">
              <ClipboardList size={16} />
              Create an event
            </Link>
          )}
        </div>
      </section>

      <MyRsvpsList userId={session!.user.id} title="Your next events" />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Upcoming in the community</h2>
          <Link to="/events" className={buttonSecondary}>
            See all
          </Link>
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
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No upcoming events yet.
          </p>
        )}
      </section>
    </div>
  )
}
