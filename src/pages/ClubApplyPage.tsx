import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Info,
  Pencil,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { listMyClubApplications, submitClubApplication, withdrawClubApplication } from '../lib/api'
import { friendlyError, timeAgo } from '../lib/format'
import { CATEGORIES, type ClubApplication, type ClubApplicationInput } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import Breadcrumbs from '../components/Breadcrumbs'
import { useLoader } from '../lib/useLoader'
import { CLUB_DOCUMENTS, ppmk } from '../data/organization'
import { ErrorBox, PageHeader, Spinner, buttonPrimary, buttonSecondary, card, inputClass } from '../components/ui'

const EMPTY: ClubApplicationInput = {
  club_name: '',
  category: 'Social',
  tagline: '',
  description: '',
  objectives: '',
  activities_plan: '',
  advisor_name: '',
  founding_members: '',
  documents: {},
}

const STATUS = {
  pending: { label: 'Waiting for admin review', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  needs_changes: { label: 'Changes requested', style: 'bg-red-50 text-red-700 border-red-200' },
  approved: { label: 'Approved 🎉', style: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Not approved', style: 'bg-slate-100 text-slate-600 border-slate-200' },
} as const

export default function ClubApplyPage() {
  usePageMeta('Start a club', 'Register a new club under PPMK: documents you need and how approval works.')
  const { session } = useAuth()
  const userId = session!.user.id
  const { data: apps, loading, reload } = useLoader(() => listMyClubApplications(userId), [userId])

  const [editing, setEditing] = useState<ClubApplication | 'new' | null>(null)
  const [sent, setSent] = useState(false)

  const open = (apps ?? []).filter((a) => a.status === 'pending' || a.status === 'needs_changes')

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[['Clubs', '/clubs'], ['Start a club']]} />

      <PageHeader
        eyebrow="Clubs"
        title={`Start a club under ${ppmk.shortName}`}
        description="Got 5 or more friends who share a hobby? Register it as an official club, get your own club page, and run events on the hub."
      />

      {sent && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Application sent.</p>
            <p className="text-sm">An admin will review it, usually within a week. You'll see the decision here and on your profile.</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [FileText, 'Prepare documents', 'Constitution, member list, activity plan and committee (see below).'],
          [Send, 'Apply here', 'Fill in the form and paste links to your documents.'],
          [ShieldCheck, 'Admin review', 'An EMSU/PPMK admin approves, or asks for changes. Usually within a week.'],
          [Sparkles, 'Club goes live', 'You become club president, get your club page and can create events.'],
        ].map(([Icon, title, text], i) => {
          const I = Icon as typeof FileText
          return (
            <div key={title as string} className={`${card} p-4`}>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{i + 1}</span>
                <I size={18} className="text-primary" />
              </div>
              <p className="mt-3 text-sm font-bold sm:text-base">{title as string}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">{text as string}</p>
            </div>
          )
        })}
      </section>

      {/* My applications */}
      {loading ? (
        <Spinner />
      ) : (
        (apps ?? []).length > 0 &&
        !editing && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Your applications</h2>
            {(apps ?? []).map((a) => (
              <div key={a.id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{a.club_name}</p>
                    <p className="text-xs text-slate-500">Sent {timeAgo(a.created_at)} · {a.category}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS[a.status].style}`}>{STATUS[a.status].label}</span>
                </div>
                {a.admin_note && (
                  <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span><strong>Admin:</strong> {a.admin_note}</span>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'approved' && a.club_id && (
                    <Link to={`/clubs/${a.club_id}?tab=manage`} className={buttonPrimary}>Set up your club page</Link>
                  )}
                  {(a.status === 'pending' || a.status === 'needs_changes') && (
                    <>
                      <button onClick={() => setEditing(a)} className={a.status === 'needs_changes' ? buttonPrimary : buttonSecondary}>
                        <Pencil size={15} /> {a.status === 'needs_changes' ? 'Fix and resend' : 'Edit'}
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Withdraw this application?')) return
                          await withdrawClubApplication(a.id)
                          await reload()
                        }}
                        className="text-sm font-semibold text-slate-400 hover:text-red-600"
                      >
                        Withdraw
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </section>
        )
      )}

      {editing ? (
        <ApplicationForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSent={async () => {
            setEditing(null)
            setSent(true)
            await reload()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      ) : (
        <>
          <DocumentChecklist />
          <div className={`${card} flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="font-bold">{open.length > 0 ? 'Applying for another club?' : 'Ready to apply?'}</p>
              <p className="text-sm text-slate-500">
                Want to join an existing club instead? <Link to="/clubs" className="font-semibold text-primary">Browse clubs</Link>.
              </p>
            </div>
            <button onClick={() => { setSent(false); setEditing('new') }} className={buttonPrimary}>
              <ClipboardCheck size={16} /> Start application
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DocumentChecklist() {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <h2 className="text-lg font-bold">Documents you need</h2>
      <p className="mt-1 text-sm text-slate-500">
        Upload each one to Google Drive (or similar), set sharing to <strong>“Anyone with the link can view”</strong>, and
        paste the link in the form.
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {CLUB_DOCUMENTS.map((doc) => (
          <li key={doc.key} className="flex gap-3 rounded-xl border border-slate-200 p-4">
            <FileText size={20} className={`mt-0.5 shrink-0 ${doc.required ? 'text-primary' : 'text-slate-400'}`} />
            <div>
              <p className="font-semibold">
                {doc.title}{' '}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${doc.required ? 'bg-red-50 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                  {doc.required ? 'Required' : 'Optional'}
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{doc.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ApplicationForm({
  initial,
  onCancel,
  onSent,
}: {
  initial: ClubApplication | null
  onCancel: () => void
  onSent: () => Promise<void>
}) {
  const [form, setForm] = useState<ClubApplicationInput>(() =>
    initial
      ? {
          club_name: initial.club_name,
          category: initial.category,
          tagline: initial.tagline,
          description: initial.description,
          objectives: initial.objectives,
          activities_plan: initial.activities_plan,
          advisor_name: initial.advisor_name,
          founding_members: initial.founding_members,
          documents: { ...initial.documents },
        }
      : EMPTY,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof ClubApplicationInput>(k: K, v: ClubApplicationInput[K]) => setForm({ ...form, [k]: v })
  const founders = form.founding_members.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
  const requiredDocs = CLUB_DOCUMENTS.filter((d) => d.required)
  const docsDone = requiredDocs.filter((d) => /^https?:\/\//.test(form.documents[d.key] ?? '')).length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.club_name.trim().length < 2) return setError('Give your club a name.')
    if (form.description.trim().length < 20) return setError('Describe the club in at least one or two sentences.')
    if (founders.length < 5) return setError('List at least 5 founding members (usernames or names).')
    if (docsDone < requiredDocs.length) return setError('Add a link for every required document.')

    const documents = Object.fromEntries(
      Object.entries(form.documents).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v),
    )
    setBusy(true)
    try {
      await submitClubApplication(
        {
          ...form,
          club_name: form.club_name.trim(),
          tagline: form.tagline.trim(),
          description: form.description.trim(),
          objectives: form.objectives.trim(),
          activities_plan: form.activities_plan.trim(),
          advisor_name: form.advisor_name.trim(),
          founding_members: founders.join(', '),
          documents,
        },
        initial?.id,
      )
      await onSent()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-6 p-5 sm:p-8`}>
      <div>
        <h2 className="text-xl font-bold">{initial ? `Edit: ${initial.club_name}` : 'New club application'}</h2>
        {initial?.admin_note && (
          <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><strong>Admin asked:</strong> {initial.admin_note}</p>
        )}
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-400">1 · About the club</legend>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="text-sm font-medium">
            Club name *
            <input value={form.club_name} onChange={(e) => set('club_name', e.target.value)} maxLength={100} placeholder="e.g. Hiking & Outdoors" className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          Tagline
          <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={140} placeholder="One catchy line" className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          What is the club about? *
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Objectives
            <textarea rows={3} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} maxLength={3000} placeholder="What do you want members to get out of it?" className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Planned activities
            <textarea rows={3} value={form.activities_plan} onChange={(e) => set('activities_plan', e.target.value)} maxLength={3000} placeholder="e.g. Weekly training, one trip per semester" className={inputClass} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-400">2 · People</legend>
        <label className="block text-sm font-medium">
          Founding members * <span className="font-normal text-slate-500">(at least 5, usernames or names, separated by commas)</span>
          <textarea rows={2} value={form.founding_members} onChange={(e) => set('founding_members', e.target.value)} placeholder="hafiz_i, nurul.h, danial, …" className={inputClass} />
          <span className={`mt-1 block text-xs font-semibold ${founders.length >= 5 ? 'text-green-700' : 'text-slate-500'}`}>
            {founders.length} / 5 founding members
          </span>
        </label>
        <label className="block text-sm font-medium">
          Advisor <span className="font-normal text-slate-500">(optional: lecturer or staff)</span>
          <input value={form.advisor_name} onChange={(e) => set('advisor_name', e.target.value)} maxLength={100} className={inputClass} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-slate-400">
          3 · Documents <span className="ml-2 normal-case text-slate-500">{docsDone}/{requiredDocs.length} required added</span>
        </legend>
        {CLUB_DOCUMENTS.map((doc) => {
          const done = /^https?:\/\//.test(form.documents[doc.key] ?? '')
          return (
            <label key={doc.key} className="block rounded-xl border border-slate-200 p-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                {done ? <CheckCircle2 size={16} className="text-green-600" /> : <Circle size={16} className="text-slate-300" />}
                {doc.title} {doc.required ? '*' : <span className="font-normal text-slate-400">(optional)</span>}
              </span>
              <span className="mt-0.5 block pl-6 text-xs font-normal text-slate-500">{doc.detail}</span>
              <input
                type="url"
                value={form.documents[doc.key] ?? ''}
                onChange={(e) => set('documents', { ...form.documents, [doc.key]: e.target.value })}
                placeholder="https://drive.google.com/…"
                className={inputClass}
              />
            </label>
          )
        })}
      </fieldset>

      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonPrimary}>
          <Send size={16} /> {busy ? 'Sending…' : initial ? 'Save and resend' : 'Send application'}
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>Cancel</button>
      </div>
    </form>
  )
}
