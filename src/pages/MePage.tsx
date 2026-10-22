import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { deleteMyAccount, updateMyProfile } from '../lib/api'
import { friendlyError } from '../lib/format'
import type { Profile } from '../lib/types'
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
  const { session, profile, profileComplete, isAdmin, isOrganizer, setProfile, signOut } =
    useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const welcome = params.get('welcome') === '1' || !profileComplete
  const next = safeNext(params.get('next'))

  // The auth guard only renders this page once the profile has loaded.
  const [form, setForm] = useState<FormState>(() => toForm(profile))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaved(false)
    setError('')
  }

  function validate(): string {
    const f = form

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
      const updated = await updateMyProfile(session.user.id, {
        student_id: form.student_id.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        batch: Number(form.batch),
        age: Number(form.age),
        phone: form.phone.trim(),
        course: form.course.trim(),
        residence: form.residence,
        consent_at: profile?.consent_at ?? new Date().toISOString(),
      })

      const wasIncomplete = !profileComplete
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
        <div className="rounded-2xl bg-primary p-6 text-white">
          <Sparkles size={22} />
          <h1 className="mt-3 text-2xl font-bold">Welcome! One last step.</h1>
          <p className="mt-2 text-sm leading-6 text-red-100">
            Fill this in once (about 2 minutes). After that you can join any
            PPMK/EMSU event with one tap, with no more Google Forms.
          </p>
        </div>
      ) : (
        <PageHeader
          eyebrow="Account"
          title="My profile"
          description="These details are reused for every event you join."
        />
      )}

      <form onSubmit={handleSave} className={`${card} p-5 sm:p-6`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-primary">
            <UserRound size={20} />
          </div>
          <div>
            <h2 className="font-bold">Student information</h2>
            <p className="text-xs text-slate-500">
              Signed in as {session?.user.email}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

        <label className="mt-6 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => update('consent', e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-red-700"
          />
          <span className="text-sm leading-6 text-slate-600">
            I agree that EMSU/PPMK may store these details to run events, as
            described in the{' '}
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

      {!welcome && session && <MyRsvpsList userId={session.user.id} />}

      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={21} />
          <div>
            <h2 className="font-bold">Who can see this?</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-600">
              <li>Other students can't see your details.</li>
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
          <button onClick={() => void signOut()} className={buttonSecondary}>
            <LogOut size={16} />
            Sign out
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
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <Trash2 size={16} />
          Delete my account
        </button>
      </section>
      )}
    </div>
  )
}
