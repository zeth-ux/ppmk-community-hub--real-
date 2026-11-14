import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, FileText, ImageIcon, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import {
  adminSetClubPresident,
  listPendingPhotos,
  reviewPhoto,
  deleteClub,
  listClubApplications,
  reviewClubApplication,
  getAiUsageStats,
  getFeedbackOverview,
  getHubStats,
  listAllProfiles,
  listClubs,
  saveClub,
  setUserRole,
} from '../lib/api'
import { friendlyError, isProfileComplete, timeAgo } from '../lib/format'
import type { AppRole, Club, ClubApplication, ClubInput, Profile } from '../lib/types'
import { CLUB_DOCUMENTS } from '../data/organization'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import {
  ErrorBox,
  PageHeader,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  card,
  inputClass,
} from '../components/ui'

export default function AdminPage() {
  const { t } = useLanguage()
  usePageMeta(t('nav.admin'))
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('nav.admin')}
        title={t('admin.runHub')}
        description={t('admin.description')}
      />
      <StatsSection />
      <PhotoReviewSection />
      <ApplicationsSection />
      <MembersSection />
      <ClubsSection />
      <RetentionNote />
    </div>
  )
}

function StatsSection() {
  const { t } = useLanguage()
  const { data, loading, error } = useLoader(getHubStats, [])
  const { data: ai } = useLoader(() => getAiUsageStats().catch(() => []), [])
  const { data: feedback } = useLoader(() => getFeedbackOverview().catch(() => null), [])

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return null

  const tiles: [TranslationKey, number][] = [
    ['admin.members', data.members],
    ['admin.profilesComplete', data.complete_profiles],
    ['admin.organizersAdmins', data.organizers],
    ['admin.events', data.events],
    ['admin.upcomingEvents', data.upcoming_events],
    ['admin.rsvps', data.rsvps],
    ['admin.checkIns', data.check_ins],
  ] as const

  const aiLabel: Record<NonNullable<typeof ai>[number]['kind'], TranslationKey> = {
    extract: 'admin.aiEventFills',
    announce: 'admin.aiAnnouncements',
    ask: 'admin.chatbotQuestions',
  }

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tiles.map(([label, value]) => (
          <div key={label} className={`${card} p-4`}>
            <p className="text-xs font-semibold text-slate-500">{t(label)}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>
      {feedback && feedback.responses > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold text-amber-700">Event feedback</p>
          <p className="mt-1 text-2xl font-bold">
            {feedback.average?.toFixed(2)} <span className="text-sm font-medium text-slate-500">/ 5</span>
          </p>
          <p className="text-xs text-slate-500">
            {feedback.responses} {feedback.responses === 1 ? 'response' : 'responses'} across{' '}
            {feedback.events_rated} {feedback.events_rated === 1 ? 'event' : 'events'}
          </p>
        </section>
      )}
      {ai && ai.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ai.map((row) => (
            <div key={row.kind} className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
              <p className="text-xs font-semibold text-violet-700">{t(aiLabel[row.kind])}</p>
              <p className="mt-1 text-2xl font-bold">{row.total}</p>
              <p className="text-xs text-slate-500">
                {row.last_7_days} {t('admin.thisWeek')} · {row.people} {t(row.people === 1 ? 'admin.person' : 'admin.people')}
              </p>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function MembersSection() {
  const { t } = useLanguage()
  const { session } = useAuth()
  const { data, setData, loading, error } = useLoader(listAllProfiles, [])
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter(
      (p) =>
        !q ||
        [p.full_name, p.username, p.email, p.student_id, String(p.batch ?? '')]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
  }, [data, search])

  async function changeRole(userId: string, role: AppRole) {
    setActionError('')
    try {
      await setUserRole(userId, role)
      setData((data ?? []).map((p) => (p.id === userId ? { ...p, role } : p)))
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t('admin.members')}</h2>
          <p className="text-sm text-slate-500">
            {t('admin.makeOrganizer')}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.searchMembers')}
            aria-label={t('admin.searchMembers')}
            className={`${inputClass} mt-0 pl-9`}
          />
        </div>
      </div>

      <div className="mt-3">
        <ErrorBox>{error || actionError}</ErrorBox>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="-mx-5 mt-3 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 sm:px-6">{t('admin.name')}</th>
                <th className="px-3 py-3">{t('admin.email')}</th>
                <th className="px-3 py-3">{t('admin.studentId')}</th>
                <th className="px-3 py-3">{t('admin.batch')}</th>
                <th className="px-3 py-3">{t('admin.phone')}</th>
                <th className="px-5 py-3 sm:px-6">{t('admin.role')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-semibold sm:px-6">
                    {p.full_name ?? <span className="font-normal italic text-slate-400">{t('admin.noProfile')}</span>}
                    {!isProfileComplete(p) && p.full_name && (
                      <span className="ml-2 text-xs font-normal text-amber-600">{t('admin.incomplete')}</span>
                    )}
                    {p.username && <span className="block text-xs font-normal text-slate-500">@{p.username}</span>}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{p.email}</td>
                  <td className="px-3 py-3">{p.student_id}</td>
                  <td className="px-3 py-3">{p.batch}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{p.phone}</td>
                  <td className="px-5 py-3 sm:px-6">
                    <select
                      value={p.role}
                      onChange={(e) => void changeRole(p.id, e.target.value as AppRole)}
                      aria-label={`Role for ${p.full_name ?? p.email}`}
                      className="rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-sm"
                    >
                      <option value="student">{t('admin.roleStudent')}</option>
                      <option value="organizer">{t('admin.roleOrganizer')}</option>
                      <option value="admin">{t('admin.roleAdmin')}</option>
                    </select>
                    {p.id === session?.user.id && (
                      <span className="ml-2 text-xs text-slate-400">{t('admin.you')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const EMPTY_CLUB: ClubInput = {
  name: '',
  category: 'Social',
  description: '',
  leader_name: '',
  leader_contact: '',
  logo_url: null,
  join_url: '',
  status: 'active',
  tagline: '',
  about: '',
  meeting_info: '',
  instagram: null,
  cover_url: null,
  join_policy: 'approval',
  who_can_post: 'leaders',
  posts_visibility: 'everyone',
}

function ClubsSection() {
  const { t } = useLanguage()
  const { data, loading, error, reload } = useLoader(listClubs, [])
  const { data: people } = useLoader(() => listAllProfiles().catch(() => [] as Profile[]), [])
  const [editing, setEditing] = useState<Club | 'new' | null>(null)
  const [form, setForm] = useState<ClubInput>(EMPTY_CLUB)
  const [president, setPresident] = useState('')
  const [actionError, setActionError] = useState('')

  function start(club: Club | 'new') {
    setEditing(club)
    setActionError('')
    setPresident('')
    if (club === 'new') {
      setForm(EMPTY_CLUB)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created_at, updated_at, ...input } = club
      setForm(input)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      setActionError(t('admin.clubNameRequired'))
      return
    }
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
      const saved = await saveClub(
        {
          ...form,
          name: form.name.trim(),
          description: form.description.trim(),
          leader_name: clean(form.leader_name),
          leader_contact: clean(form.leader_contact),
          join_url: clean(form.join_url),
        },
        editing && editing !== 'new' ? editing.id : undefined,
      )
      if (president) await adminSetClubPresident(saved.id, president)
      setEditing(null)
      await reload()
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  async function remove(club: Club) {
    if (!window.confirm(t('admin.deleteClubConfirm').replace('{name}', club.name))) return
    try {
      await deleteClub(club.id)
      await reload()
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('clubs.title')}</h2>
        <button onClick={() => start('new')} className={buttonSecondary}>
          <Plus size={16} />
          {t('admin.addClub')}
        </button>
      </div>

      <div className="mt-3">
        <ErrorBox>{error || actionError}</ErrorBox>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            {t('admin.name')} *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            {t('admin.category')}
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {t('admin.descriptionField')}
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            {t('admin.leaderName')}
            <input value={form.leader_name ?? ''} onChange={(e) => setForm({ ...form, leader_name: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            {t('admin.leaderContact')}
            <input value={form.leader_contact ?? ''} onChange={(e) => setForm({ ...form, leader_contact: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {t('admin.setPresident')} <span className="font-normal text-slate-500">{t('admin.presidentHint')}</span>
            <select value={president} onChange={(e) => setPresident(e.target.value)} className={inputClass}>
              <option value="">{t('admin.keepAsIs')}</option>
              {(people ?? [])
                .filter((p) => p.username)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    @{p.username} · {p.full_name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            {t('admin.joinLink')}
            <input type="url" value={form.join_url ?? ''} onChange={(e) => setForm({ ...form, join_url: e.target.value })} placeholder="https://" className={inputClass} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={buttonPrimary}>{t('admin.saveClub')}</button>
            <button type="button" onClick={() => setEditing(null)} className={buttonSecondary}>{t('admin.cancel')}</button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {(data ?? []).map((club) => (
            <li key={club.id} className="flex items-center justify-between gap-3 py-3">
              <Link to={`/clubs/${club.id}`} className="min-w-0 hover:text-primary">
                <p className="font-semibold">{club.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {club.category}
                  {club.leader_name && ` · ${t('admin.ledBy')} ${club.leader_name}`}
                </p>
              </Link>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => start(club)} aria-label={t('admin.editClub').replace('{name}', club.name)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <Pencil size={16} />
                </button>
                <button onClick={() => void remove(club)} aria-label={t('admin.deleteClub').replace('{name}', club.name)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const REJECT_REASONS = [
  'Not appropriate for the hub',
  'Shows people who may not have agreed',
  'Shows personal info (ID, address, phone)',
  'Not related to the post',
]

function PhotoReviewSection() {
  const { t } = useLanguage()
  const { data, setData, loading, error } = useLoader(listPendingPhotos, [])
  const { data: people } = useLoader(() => listAllProfiles().catch(() => [] as Profile[]), [])
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [actionError, setActionError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  async function decide(id: string, approve: boolean) {
    setActionError('')
    try {
      await reviewPhoto(id, approve, approve ? '' : reason)
      setData((data ?? []).filter((p) => p.id !== id))
      setRejecting(null)
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  const photos = data ?? []
  const who = (id: string) => {
    const p = people?.find((x) => x.id === id)
    return p?.username ? `@${p.username}` : (p?.full_name ?? t('admin.unknown'))
  }
  const rejectReasonKeys: Record<(typeof REJECT_REASONS)[number], TranslationKey> = {
    'Not appropriate for the hub': 'admin.rejectReasonHub',
    'Shows people who may not have agreed': 'admin.rejectReasonConsent',
    'Shows personal info (ID, address, phone)': 'admin.rejectReasonPersonal',
    'Not related to the post': 'admin.rejectReasonUnrelated',
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ImageIcon size={19} className="text-primary" /> {t('admin.photoReview')}
        {photos.length > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{photos.length}</span>}
      </h2>
      <p className="text-sm text-slate-500">{t('admin.photoReviewHint')}</p>
      <div className="mt-3"><ErrorBox>{error || actionError}</ErrorBox></div>
      {loading ? (
        <Spinner />
      ) : photos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('admin.allCaughtUp')}</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-slate-200">
              <button onClick={() => setOpen(p.url)} className="block aspect-[4/3] w-full bg-slate-100" aria-label={t('admin.viewFullSize')}>
                <img src={p.url} alt={t('admin.photoWaiting').replace('{name}', who(p.uploaded_by))} className="h-full w-full object-cover" />
              </button>
              <div className="space-y-2 p-3 text-sm">
                <p className="text-xs text-slate-500">
                  {who(p.uploaded_by)} · {timeAgo(p.created_at)}
                </p>
                {p.context && (
                  <Link to={p.context.href} className="block truncate text-xs font-semibold text-primary hover:underline">
                    {p.context.label}
                  </Link>
                )}
                {rejecting === p.id ? (
                  <div className="space-y-2">
                    <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
                      {REJECT_REASONS.map((r) => <option key={r} value={r}>{t(rejectReasonKeys[r])}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => void decide(p.id, false)} className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 font-bold text-white">{t('admin.reject')}</button>
                      <button onClick={() => setRejecting(null)} className="rounded-lg px-3 py-1.5 font-semibold text-slate-500 hover:bg-slate-100">{t('admin.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => void decide(p.id, true)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 font-bold text-white">
                      <Check size={15} /> {t('admin.approve')}
                    </button>
                    <button onClick={() => setRejecting(p.id)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">
                      <X size={15} /> {t('admin.reject')}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
          <img src={open} alt={t('admin.viewFullSize')} className="max-h-full max-w-full rounded-lg object-contain" />
          <button aria-label={t('admin.close')} className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"><X size={22} /></button>
        </div>
      )}
    </section>
  )
}

function ApplicationsSection() {
  const { t } = useLanguage()
  const { data, loading, error, reload } = useLoader(async () => {
    const [apps, people] = await Promise.all([listClubApplications(), listAllProfiles()])
    return { apps, people }
  }, [])
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [showDone, setShowDone] = useState(false)

  const apps = data?.apps ?? []
  const waiting = apps.filter((a) => a.status === 'pending')
  const others = apps.filter((a) => a.status !== 'pending')
  const applicant = (a: ClubApplication) => data?.people.find((p) => p.id === a.applicant_id)

  async function decide(a: ClubApplication, decision: 'approved' | 'needs_changes' | 'rejected') {
    if (decision !== 'approved' && !note.trim()) {
      setActionError(t('admin.writeNote'))
      return
    }
    setBusy(true)
    setActionError('')
    try {
      await reviewClubApplication(a.id, decision, note.trim())
      setOpenId(null)
      setNote('')
      await reload()
    } catch (err) {
      setActionError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const statusStyle = {
    pending: 'bg-amber-50 text-amber-700',
    needs_changes: 'bg-red-50 text-red-700',
    approved: 'bg-green-50 text-green-700',
    rejected: 'bg-slate-100 text-slate-600',
  }
  const statusLabels: Record<ClubApplication['status'], TranslationKey> = {
    pending: 'admin.statusPending',
    needs_changes: 'admin.statusNeedsChanges',
    approved: 'admin.statusApproved',
    rejected: 'admin.statusRejected',
  }
  const docTitleKeys: Record<(typeof CLUB_DOCUMENTS)[number]['key'], TranslationKey> = {
    constitution: 'clubApply.doc.constitution',
    member_list: 'clubApply.doc.memberList',
    activity_plan: 'clubApply.doc.activityPlan',
    committee_list: 'clubApply.doc.committeeList',
    budget: 'clubApply.doc.budget',
    advisor_letter: 'clubApply.doc.advisorLetter',
  }

  const row = (a: ClubApplication) => {
    const who = applicant(a)
    const isOpen = openId === a.id
    return (
      <li key={a.id} className="rounded-xl border border-slate-200">
        <button
          onClick={() => {
            setOpenId(isOpen ? null : a.id)
            setNote(a.admin_note)
            setActionError('')
          }}
          className="flex w-full items-center justify-between gap-3 p-4 text-left"
        >
          <div className="min-w-0">
            <p className="font-bold">{a.club_name} <span className="text-xs font-normal text-slate-500">· {a.category}</span></p>
            <p className="truncate text-xs text-slate-500">
              {t('admin.applicantBy')} {who?.username ? `@${who.username}` : who?.full_name ?? t('admin.unknown')}
              {who?.full_name && who.username ? ` (${who.full_name})` : ''} · {timeAgo(a.created_at)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle[a.status]}`}>
            {t(statusLabels[a.status])}
          </span>
        </button>
        {isOpen && (
          <div className="space-y-4 border-t border-slate-100 p-4 text-sm">
            {a.tagline && <p className="italic text-slate-600">“{a.tagline}”</p>}
            <dl className="grid gap-3 sm:grid-cols-2">
              {([
                [t('admin.about'), a.description],
                [t('admin.objectives'), a.objectives],
                [t('admin.plannedActivities'), a.activities_plan],
                [t('admin.foundingMembers'), a.founding_members],
                [t('admin.advisor'), a.advisor_name],
              ] as const).map(([label, value]) =>
                value ? (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-slate-400">{label}</dt>
                    <dd className="mt-0.5 whitespace-pre-line text-slate-700">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            <div>
              <p className="text-xs font-semibold text-slate-400">{t('admin.documents')}</p>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {CLUB_DOCUMENTS.map((d) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <FileText size={14} className="text-slate-400" />
                    {a.documents[d.key] ? (
                      <a href={a.documents[d.key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        {t(docTitleKeys[d.key])} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className={d.required ? 'text-red-600' : 'text-slate-400'}>{t(docTitleKeys[d.key])}: {t('admin.missing')}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {(a.status === 'pending' || a.status === 'needs_changes') && (
              <>
                <label className="block font-medium">
                  {t('admin.applicantNote')}
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin.noteHint')} className={inputClass} />
                </label>
                <ErrorBox>{actionError}</ErrorBox>
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy} onClick={() => void decide(a, 'approved')} className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2.5 font-bold text-white disabled:opacity-50">
                    <Check size={16} /> {t('admin.approveCreateClub')}
                  </button>
                  <button disabled={busy} onClick={() => void decide(a, 'needs_changes')} className={buttonSecondary}>
                    <Pencil size={15} /> {t('admin.askChanges')}
                  </button>
                  <button disabled={busy} onClick={() => void decide(a, 'rejected')} className={`${buttonSecondary} text-red-700`}>
                    <X size={15} /> {t('admin.reject')}
                  </button>
                </div>
                <p className="text-xs text-slate-500">{t('admin.approvalHint')}</p>
              </>
            )}
            {a.status === 'approved' && a.club_id && (
              <Link to={`/clubs/${a.club_id}`} className="inline-flex items-center gap-1 font-semibold text-primary">{t('admin.openClubPage')}</Link>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {t('admin.clubApplications')}
            {waiting.length > 0 && <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{waiting.length} {t('admin.waiting')}</span>}
          </h2>
          <p className="text-sm text-slate-500">{t('admin.applicationsHint')}</p>
        </div>
      </div>
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
      {loading ? (
        <Spinner />
      ) : apps.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('admin.noApplications')}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2">{waiting.map(row)}</ul>
          {waiting.length === 0 && <p className="mt-3 text-sm text-slate-500">{t('admin.nothingWaiting')}</p>}
          {others.length > 0 && (
            <div className="mt-4">
              <button onClick={() => setShowDone(!showDone)} className="text-sm font-semibold text-slate-500 hover:text-primary">
                {showDone ? t('admin.hide') : t('admin.show')} {others.length} {t(others.length === 1 ? 'admin.otherApplication' : 'admin.otherApplications')}
              </button>
              {showDone && <ul className="mt-2 space-y-2">{others.map(row)}</ul>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function RetentionNote() {
  const { t } = useLanguage()
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
        <div>
          <h2 className="font-bold">{t('admin.retentionTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t('admin.retentionDescription')}
          </p>
        </div>
      </div>
    </section>
  )
}
