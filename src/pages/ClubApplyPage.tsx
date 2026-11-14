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
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
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

const STATUS: Record<ClubApplication['status'], { label: TranslationKey; style: string }> = {
  pending: { label: 'clubApply.waitingReview', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  needs_changes: { label: 'clubApply.changesRequested', style: 'bg-red-50 text-red-700 border-red-200' },
  approved: { label: 'clubApply.approved', style: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'clubApply.notApproved', style: 'bg-slate-100 text-slate-600 border-slate-200' },
}
const DOC_KEYS: Record<(typeof CLUB_DOCUMENTS)[number]['key'], [TranslationKey, TranslationKey]> = {
  constitution: ['clubApply.doc.constitution', 'clubApply.doc.constitutionHint'],
  member_list: ['clubApply.doc.memberList', 'clubApply.doc.memberListHint'],
  activity_plan: ['clubApply.doc.activityPlan', 'clubApply.doc.activityPlanHint'],
  committee_list: ['clubApply.doc.committeeList', 'clubApply.doc.committeeListHint'],
  budget: ['clubApply.doc.budget', 'clubApply.doc.budgetHint'],
  advisor_letter: ['clubApply.doc.advisorLetter', 'clubApply.doc.advisorLetterHint'],
}
const CATEGORY_KEYS: Record<(typeof CATEGORIES)[number], TranslationKey> = {
  Sports: 'category.sports',
  Social: 'category.social',
  Academic: 'category.academic',
  Career: 'category.career',
  Cultural: 'category.cultural',
  Religious: 'category.religious',
}

export default function ClubApplyPage() {
  const { t } = useLanguage()
  usePageMeta(t('clubApply.title'), t('clubApply.meta'))
  const { session } = useAuth()
  const userId = session!.user.id
  const { data: apps, loading, reload } = useLoader(() => listMyClubApplications(userId), [userId])

  const [editing, setEditing] = useState<ClubApplication | 'new' | null>(null)
  const [sent, setSent] = useState(false)

  const open = (apps ?? []).filter((a) => a.status === 'pending' || a.status === 'needs_changes')

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[[t('clubs.title'), '/clubs'], [t('clubApply.title')]]} />

      <PageHeader
        eyebrow={t('clubs.title')}
        title={`${t('clubApply.title')} · ${ppmk.shortName}`}
        description={t('clubApply.description')}
      />

      {sent && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">{t('clubApply.sent')}</p>
            <p className="text-sm">{t('clubApply.sentHint')}</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [FileText, t('clubApply.prepareDocuments'), t('clubApply.prepareHint')],
          [Send, t('clubApply.applyHere'), t('clubApply.applyHint')],
          [ShieldCheck, t('clubApply.adminReview'), t('clubApply.reviewHint')],
          [Sparkles, t('clubApply.goesLive'), t('clubApply.liveHint')],
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
            <h2 className="text-lg font-bold">{t('clubApply.yourApplications')}</h2>
            {(apps ?? []).map((a) => (
              <div key={a.id} className={`${card} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">{a.club_name}</p>
                    <p className="text-xs text-slate-500">{t('clubApply.sentAt')} {timeAgo(a.created_at)} · {CATEGORY_KEYS[a.category as (typeof CATEGORIES)[number]] ? t(CATEGORY_KEYS[a.category as (typeof CATEGORIES)[number]]) : a.category}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS[a.status].style}`}>{t(STATUS[a.status].label)}</span>
                </div>
                {a.admin_note && (
                  <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <Info size={16} className="mt-0.5 shrink-0 text-primary" />
                    <span><strong>{t('clubApply.admin')}</strong> {a.admin_note}</span>
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status === 'approved' && a.club_id && (
                    <Link to={`/clubs/${a.club_id}?tab=manage`} className={buttonPrimary}>{t('clubApply.setupPage')}</Link>
                  )}
                  {(a.status === 'pending' || a.status === 'needs_changes') && (
                    <>
                      <button onClick={() => setEditing(a)} className={a.status === 'needs_changes' ? buttonPrimary : buttonSecondary}>
                        <Pencil size={15} /> {a.status === 'needs_changes' ? t('clubApply.fixResend') : t('clubApply.edit')}
                      </button>
                      <button
                        onClick={async () => {
                          if (!window.confirm(t('clubApply.withdrawConfirm'))) return
                          await withdrawClubApplication(a.id)
                          await reload()
                        }}
                        className="text-sm font-semibold text-slate-400 hover:text-red-600"
                      >
                        {t('clubApply.withdraw')}
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
              <p className="font-bold">{open.length > 0 ? t('clubApply.anotherClub') : t('clubApply.ready')}</p>
              <p className="text-sm text-slate-500">
                {t('clubApply.joinExisting')} <Link to="/clubs" className="font-semibold text-primary">{t('clubApply.browseClubs')}</Link>.
              </p>
            </div>
            <button onClick={() => { setSent(false); setEditing('new') }} className={buttonPrimary}>
              <ClipboardCheck size={16} /> {t('clubApply.startApplication')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DocumentChecklist() {
  const { t } = useLanguage()
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <h2 className="text-lg font-bold">{t('clubApply.documentsTitle')}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {t('clubApply.documentsHint')}
      </p>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {CLUB_DOCUMENTS.map((doc) => (
          <li key={doc.key} className="flex gap-3 rounded-xl border border-slate-200 p-4">
            <FileText size={20} className={`mt-0.5 shrink-0 ${doc.required ? 'text-primary' : 'text-slate-400'}`} />
            <div>
              <p className="font-semibold">
                {t(DOC_KEYS[doc.key][0])}{' '}
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${doc.required ? 'bg-red-50 text-primary' : 'bg-slate-100 text-slate-500'}`}>
                  {doc.required ? t('clubApply.required') : t('clubApply.optional')}
                </span>
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{t(DOC_KEYS[doc.key][1])}</p>
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
  const { t } = useLanguage()
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
    if (form.club_name.trim().length < 2) return setError(t('clubApply.giveClubName'))
    if (form.description.trim().length < 20) return setError(t('clubApply.describeClub'))
    if (founders.length < 5) return setError(t('clubApply.foundersMinimum'))
    if (docsDone < requiredDocs.length) return setError(t('clubApply.requiredDocs'))

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
        <h2 className="text-xl font-bold">{initial ? t('clubApply.editApplication').replace('{name}', initial.club_name) : t('clubApply.newApplication')}</h2>
        {initial?.admin_note && (
          <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700"><strong>{t('clubApply.adminAsked')}</strong> {initial.admin_note}</p>
        )}
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-400">{t('clubApply.aboutClub')}</legend>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="text-sm font-medium">
            {t('clubApply.clubName')}
            <input value={form.club_name} onChange={(e) => set('club_name', e.target.value)} maxLength={100} placeholder="e.g. Hiking & Outdoors" className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            {t('clubApply.category')}
            <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t(CATEGORY_KEYS[c])}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t('clubApply.tagline')}
          <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={140} placeholder={t('clubApply.taglinePlaceholder')} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t('clubApply.whatAbout')}
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {t('clubApply.objectives')}
            <textarea rows={3} value={form.objectives} onChange={(e) => set('objectives', e.target.value)} maxLength={3000} placeholder={t('clubApply.objectivesHint')} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            {t('clubApply.activities')}
            <textarea rows={3} value={form.activities_plan} onChange={(e) => set('activities_plan', e.target.value)} maxLength={3000} placeholder={t('clubApply.activitiesHint')} className={inputClass} />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-400">{t('clubApply.people')}</legend>
        <label className="block text-sm font-medium">
          {t('clubApply.foundingMembers')} <span className="font-normal text-slate-500">{t('clubApply.foundersHint')}</span>
          <textarea rows={2} value={form.founding_members} onChange={(e) => set('founding_members', e.target.value)} placeholder="hafiz_i, nurul.h, danial, …" className={inputClass} />
          <span className={`mt-1 block text-xs font-semibold ${founders.length >= 5 ? 'text-green-700' : 'text-slate-500'}`}>
            {founders.length} / 5 {t('clubApply.foundersCount')}
          </span>
        </label>
        <label className="block text-sm font-medium">
          {t('clubApply.advisor')} <span className="font-normal text-slate-500">{t('clubApply.advisorHint')}</span>
          <input value={form.advisor_name} onChange={(e) => set('advisor_name', e.target.value)} maxLength={100} className={inputClass} />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-slate-400">
          {t('clubApply.documents')} <span className="ml-2 normal-case text-slate-500">{docsDone}/{requiredDocs.length} {t('clubApply.requiredAdded')}</span>
        </legend>
        {CLUB_DOCUMENTS.map((doc) => {
          const done = /^https?:\/\//.test(form.documents[doc.key] ?? '')
          return (
            <label key={doc.key} className="block rounded-xl border border-slate-200 p-3 text-sm font-medium">
              <span className="flex items-center gap-2">
                {done ? <CheckCircle2 size={16} className="text-green-600" /> : <Circle size={16} className="text-slate-300" />}
                {t(DOC_KEYS[doc.key][0])} {doc.required ? '*' : <span className="font-normal text-slate-400">{t('clubApply.optional')}</span>}
              </span>
              <span className="mt-0.5 block pl-6 text-xs font-normal text-slate-500">{t(DOC_KEYS[doc.key][1])}</span>
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
          <Send size={16} /> {busy ? t('clubApply.sending') : initial ? t('clubApply.saveResend') : t('clubApply.sendApplication')}
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>{t('clubApply.cancel')}</button>
      </div>
    </form>
  )
}
