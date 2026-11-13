import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AtSign,
  CheckCircle2,
  GraduationCap,
  Plane,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  deleteMyAccount,
  isUsernameAvailable,
  listClubs,
  listMyClubApplications,
  listMyClubMemberships,
  updateMyProfile,
} from '../lib/api'
import { USERNAME_PATTERN, friendlyError } from '../lib/format'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import { CLUB_ROLE_LABEL, type Profile } from '../lib/types'
import { safeNext } from '../components/guards'
import {
  ErrorBox,
  PageHeader,
  buttonPrimary,
  buttonSecondary,
  card,
  inputClass,
} from '../components/ui'
import MyRsvpsList from '../components/MyRsvpsList'

const RESIDENCES = ['ERICA dormitory', 'Ansan', 'Suwon', 'Seoul', 'Other']

const thisYear = new Date().getFullYear()
const BATCHES = Array.from({ length: 8 }, (_, i) => thisYear + 1 - i)

type FormState = {
  username: string
  student_id: string
  full_name: string
  batch: string
  age: string
  phone: string
  course: string
  residence: string
  consent: boolean
}

function toForm(profile: Profile | null): FormState {
  return {
    username: profile?.username ?? '',
    student_id: profile?.student_id ?? '',
    full_name: profile?.full_name ?? '',
    batch: profile?.batch ? String(profile.batch) : '',
    age: profile?.age ? String(profile.age) : '',
    phone: profile?.phone ?? '',
    course: profile?.course ?? '',
    residence: profile?.residence ?? '',
    consent: Boolean(profile?.consent_at),
  }
}

export default function MePage() {
  usePageMeta('My profile')
  const { session, profile, profileComplete, isAdmin, isOrganizer, setProfile, signOut } =
    useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1' || !profileComplete
  // Members get the full student profile; visitors only a username.
  const [accountType, setAccountType] = useState<'member' | 'visitor'>(
    params.get('become') === 'member' ? 'member' : (profile?.account_type ?? 'member'),
  )
  const isVisitorForm = accountType === 'visitor'
  const next = safeNext(params.get('next'), isVisitorForm ? '/discuss' : '/events')

  // The auth guard only renders this page once the profile has loaded.
  const [form, setForm] = useState<FormState>(() => toForm(profile))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null)
  const wantedName = form.username.trim().toLowerCase()
  const nameNeedsCheck = USERNAME_PATTERN.test(wantedName) && wantedName !== profile?.username
  const usernameState: 'idle' | 'checking' | 'free' | 'taken' = !nameNeedsCheck
    ? 'idle'
    : checked?.name !== wantedName
      ? 'checking'
      : checked.free
        ? 'free'
        : 'taken'

  // Live "is this username free?" check while typing.
  useEffect(() => {
    if (!nameNeedsCheck) return
    const timer = setTimeout(() => {
      isUsernameAvailable(wantedName)
        .then((free) => setChecked({ name: wantedName, free }))
        .catch(() => setChecked({ name: wantedName, free: true }))
    }, 400)
    return () => clearTimeout(timer)
  }, [wantedName, nameNeedsCheck])

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
    setError('')
  }

  function validate(): string {
    const f = form

    if (!USERNAME_PATTERN.test(f.username.trim().toLowerCase())) {
      return 'Pick a username: 3–20 lowercase letters, numbers, _ or .'
    }
    if (usernameState === 'taken') {
      return 'That username is taken. Try another one.'
    }
    if (isVisitorForm) {
      return f.consent ? '' : 'Please tick the consent box.'
    }
    if (!f.student_id.trim() || !f.full_name.trim() || !f.batch || !f.age ||
        !f.phone.trim() || !f.course.trim() || !f.residence) {
      return 'Please fill in every field.'
    }
    if (!/^[A-Za-z0-9-]{3,30}$/.test(f.student_id.trim())) {
      return 'Student ID should be 3–30 letters or numbers.'
    }
    const age = Number(f.age)
    if (!Number.isInteger(age) || age < 15 || age > 99) {
      return 'Please enter a valid age.'
    }
    if (!/^[0-9+\-\s()]{8,20}$/.test(f.phone.trim())) {
      return 'Please enter a valid phone number, e.g. 010-1234-5678.'
    }
    if (!f.consent) {
      return 'Please tick the consent box so we can store your details.'
    }
    return ''
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()

    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    if (!session) return

    setSaving(true)

    try {
      const consent_at = profile?.consent_at ?? new Date().toISOString()
      const updated = await updateMyProfile(
        session.user.id,
        isVisitorForm
          ? {
              username: form.username.trim().toLowerCase(),
              account_type: 'visitor',
              consent_at,
              student_id: profile?.student_id ?? null,
              full_name: profile?.full_name ?? null,
              batch: profile?.batch ?? null,
              age: profile?.age ?? null,
              phone: profile?.phone ?? null,
              course: profile?.course ?? null,
              residence: profile?.residence ?? null,
            }
          : {
        username: form.username.trim().toLowerCase(),
        account_type: 'member',
        student_id: form.student_id.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        batch: Number(form.batch),
        age: Number(form.age),
        phone: form.phone.trim(),
        course: form.course.trim(),
        residence: form.residence,
        consent_at,
      },
      )

      const wasIncomplete = !profileComplete || profile?.account_type !== accountType
      setProfile(updated)
      setSaved(true)

      if (wasIncomplete) {
        navigate(next, { replace: true })
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      'Delete your account, profile and all your RSVPs? This cannot be undone.',
    )
    if (!confirmed) return

    try {
      await deleteMyAccount()
      await signOut()
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {welcome ? (
        <div className="border-b border-slate-200 pb-6">
          <h1 className="font-display text-5xl sm:text-6xl">
            Selamat datang<span className="text-gold">.</span>
          </h1>
          <p className="mt-3 text-[15px] leading-6 text-slate-600">
            {profile?.full_name
              ? 'We added usernames! Pick one so you can join discussions and clubs. Your other details are already saved.'
              : isVisitorForm
                ? 'Just pick a username and you can share and find food spots, hidden gems and trip ideas.'
                : 'Fill this in once (about 2 minutes). After that you can join any PPMK/EMSU event with one tap, with no more Google Forms.'}
          </p>
        </div>
      ) : (
        <PageHeader
          eyebrow="Account"
          title="My profile"
          description="These details are reused for every event you join."
        />
      )}

      {(welcome || isVisitorForm || params.get('become') === 'member') && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-bold">Who are you?</legend>
          {([
            ['member', GraduationCap, 'I’m a PPMK student', 'Malaysian student in Korea. Events, clubs, discussions and everything else.'],
            ['visitor', Plane, 'I’m a visitor', 'Tourist, friend or non-PPMK student. Share and find food, places and trip ideas.'],
          ] as const).map(([value, Icon, title, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setAccountType(value)
                setError('')
              }}
              className={`flex gap-3 rounded-2xl border bg-surface p-4 text-left transition ${
                accountType === value ? 'border-primary ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accountType === value ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Icon size={20} />
              </span>
              <span>
                <span className={`block font-bold ${accountType === value ? 'text-primary' : ''}`}>{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-500">{text}</span>
              </span>
            </button>
          ))}
        </fieldset>
      )}

      <form onSubmit={handleSave} className={`${card} p-5 sm:p-6`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-primary">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="font-bold">{isVisitorForm ? 'Your account' : 'Student information'}</h2>
            <p className="text-xs text-slate-500">
              Signed in as {session?.user.email}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium" htmlFor="username">
            Username <span className="font-normal text-slate-500">(what other students see)</span>
          </label>
          <div className="relative mt-1.5">
            <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="username"
              value={form.username}
              onChange={(e) => update('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={20}
              placeholder="e.g. aisyah.r"
              className={`${inputClass} mt-0 pl-9`}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {usernameState === 'checking' && 'Checking…'}
            {usernameState === 'free' && <span className="font-semibold text-green-700">✓ @{form.username} is available</span>}
            {usernameState === 'taken' && <span className="font-semibold text-red-700">@{form.username} is taken</span>}
            {usernameState === 'idle' &&
              '3–20 characters: lowercase letters, numbers, _ and . Your full name stays private; only organizers of events you join see it.'}
          </p>
        </div>

        {!isVisitorForm && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Full name
            <input
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              autoComplete="name"
              placeholder="As on your student card"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium">
            Student ID
            <input
              value={form.student_id}
              onChange={(e) => update('student_id', e.target.value)}
              placeholder="e.g. 2024012345"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium">
            Batch (year you entered)
            <select
              value={form.batch}
              onChange={(e) => update('batch', e.target.value)}
              className={inputClass}
            >
              <option value="">Select batch</option>
              {BATCHES.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Age
            <input
              type="number"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => update('age', e.target.value)}
              placeholder="e.g. 21"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium">
            Phone
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="010-1234-5678"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium">
            Course
            <input
              value={form.course}
              onChange={(e) => update('course', e.target.value)}
              placeholder="e.g. Computer Science"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium sm:col-span-2">
            Where do you live?
            <select
              value={form.residence}
              onChange={(e) => update('residence', e.target.value)}
              className={inputClass}
            >
              <option value="">Select</option>
              {RESIDENCES.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
          </label>
        </div>
        )}

        <label className="mt-6 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-red-700"
          />
          <span className="text-sm leading-6 text-slate-600">
            {isVisitorForm
              ? 'I agree that the PPMK Community Hub may store my email and username to run my account, as described in the '
              : 'I agree that EMSU/PPMK may store these details to run events, as described in the '}
            <Link to="/privacy" className="font-semibold text-primary underline">
              privacy notice
            </Link>
            . I can edit or delete them at any time.
          </span>
        </label>

        <div className="mt-4 space-y-3">
          <ErrorBox>{error}</ErrorBox>

          {saved && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">
              <CheckCircle2 size={18} />
              Profile saved.
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className={`${buttonPrimary} mt-5 w-full`}>
          {saving ? 'Saving…' : welcome ? 'Save and continue' : 'Save changes'}
        </button>
      </form>

      {!welcome && session && !isVisitorForm && <MyClubs userId={session.user.id} />}

      {!welcome && session && !isVisitorForm && <MyRsvpsList userId={session.user.id} />}

      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={21} />
          <div>
            <h2 className="font-bold">Who can see this?</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Other people only see your <strong>@username</strong>, never your name, phone or student ID.</li>
              <li>On the discussion board you can also post anonymously.</li>
              <li>
                When you RSVP to an event, its organizers can see your details
                for that event, the same as filling in their Google Form.
              </li>
              <li>EMSU admins can see the member list to manage the hub.</li>
            </ul>
          </div>
        </div>
      </section>

      {!welcome && (
        <div className="flex flex-wrap gap-3">
          {isOrganizer && (
            <Link to="/organizer" className={buttonSecondary}>
              Organizer tools
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={buttonSecondary}>
              Admin
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut()
              navigate('/', { replace: true })
            }}
            className={`${buttonSecondary} text-red-700`}
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}

      {!welcome && (
      <section className="rounded-2xl border border-red-100 bg-red-50 p-5 sm:p-6">
        <h2 className="font-bold text-red-800">Delete my data</h2>
        <p className="mt-2 text-sm leading-6 text-red-700">
          Permanently deletes your account, profile and RSVPs from the hub.
        </p>
        <button
          onClick={handleDelete}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-surface px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <Trash2 size={16} />
          Delete my account
        </button>
      </section>
      )}
    </div>
  )
}

function MyClubs({ userId }: { userId: string }) {
  const { data } = useLoader(async () => {
    const [memberships, clubs, applications] = await Promise.all([
      listMyClubMemberships(userId).catch(() => []),
      listClubs(),
      listMyClubApplications(userId).catch(() => []),
    ])
    return {
      rows: memberships.map((m) => ({ ...m, club: clubs.find((c) => c.id === m.club_id) })).filter((m) => m.club),
      applications: applications.filter((a) => a.status !== 'approved'),
    }
  }, [userId])

  const appStatus = {
    pending: ['Waiting for admin review', 'bg-amber-50 text-amber-700'],
    needs_changes: ['Changes requested', 'bg-red-50 text-red-700'],
    rejected: ['Not approved', 'bg-slate-100 text-slate-600'],
    approved: ['Approved', 'bg-green-50 text-green-700'],
  } as const

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">My clubs</h2>
        <div className="flex gap-2">
          <Link to="/clubs" className={buttonSecondary}>Find clubs</Link>
          <Link to="/clubs/apply" className={buttonSecondary}>Start a club</Link>
        </div>
      </div>

      {!data ? null : data.rows.length === 0 && data.applications.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">You haven't joined a club yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {data.rows.map((m) => (
            <li key={m.club_id}>
              <Link to={`/clubs/${m.club_id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.club!.name}</p>
                  <p className="text-xs text-slate-500">
                    {m.status === 'pending' ? 'Request sent, waiting for the club to accept' : CLUB_ROLE_LABEL[m.role]}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
          {data.applications.map((a) => (
            <li key={a.id}>
              <Link to="/clubs/apply" className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText size={18} className="shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.club_name} <span className="font-normal text-slate-500">(new club application)</span></p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${appStatus[a.status][1]}`}>
                      {appStatus[a.status][0]}
                    </span>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
