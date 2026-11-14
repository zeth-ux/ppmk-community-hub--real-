import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  AtSign,
  Camera,
  CalendarClock,
  CalendarPlus,
  Check,
  Crown,
  ExternalLink,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  Pin,
  Settings,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import {
  createClubPost,
  decideClubRequest,
  deleteClubPost,
  deletePhoto,
  getClub,
  joinClub,
  leaveClub,
  listClubMembers,
  listClubPosts,
  listEvents,
  listMyClubMemberships,
  listPhotos,
  listRsvpCounts,
  removeClubMember,
  setClubMemberRole,
  updateClubPage,
  uploadPhotos,
} from '../lib/api'
import { clubGradient, friendlyError, isPast, timeAgo } from '../lib/format'
import {
  type Club,
  type ClubMemberRow,
  type ClubPost,
  type ClubPostInput,
  type ClubPostKind,
  type ClubRole,
  type Photo,
} from '../lib/types'
import Breadcrumbs from '../components/Breadcrumbs'
import { useLoader } from '../lib/useLoader'
import { usePageMeta } from '../lib/usePageMeta'
import ClubAvatar from '../components/ClubAvatar'
import EventCard from '../components/EventCard'
import { PhotoGallery, PhotoPicker } from '../components/photos'
import {
  EmptyState,
  ErrorBox,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  card,
  inputClass,
} from '../components/ui'

type Tab = 'activity' | 'about' | 'events' | 'members' | 'manage'

const KIND_LABEL: Record<ClubPostKind, TranslationKey> = {
  update: 'club.update',
  activity: 'club.activityKind',
  meeting: 'club.meeting',
}

const KIND_STYLE: Record<ClubPostKind, string> = {
  update: 'bg-slate-100 text-slate-700',
  activity: 'bg-violet-50 text-violet-700',
  meeting: 'bg-sky-50 text-sky-700',
}

export default function ClubPage() {
  const { t } = useLanguage()
  const { id = '' } = useParams()
  const { session, isAdmin, isOrganizer } = useAuth()
  const userId = session!.user.id
  const [params, setParams] = useSearchParams()

  const { data, setData, loading, error, reload } = useLoader(async () => {
    const [club, members, mine, posts, events, counts] = await Promise.all([
      getClub(id),
      listClubMembers(id),
      listMyClubMemberships(userId),
      listClubPosts(id),
      listEvents(),
      listRsvpCounts(),
    ])
    const [postPhotos, gallery] = await Promise.all([
      listPhotos('club_post_id', posts.map((p) => p.id)).catch(() => [] as Photo[]),
      listPhotos('club_id', [id]).catch(() => [] as Photo[]),
    ])
    return {
      postPhotos,
      gallery,
      club,
      members,
      me: mine.find((m) => m.club_id === id) ?? null,
      posts,
      events: events.filter((e) => e.club_id === id && !isPast(e)),
      counts,
    }
  }, [id, userId])
  usePageMeta(data?.club?.name, data?.club?.tagline || data?.club?.description)

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data?.club) {
    return (
      <EmptyState title={t('club.notFound')}>
        <Link to="/clubs" className="font-semibold text-primary">{t('club.backToClubs')}</Link>
      </EmptyState>
    )
  }

  const { club, members, me, posts, events, counts, postPhotos, gallery } = data
  const coverPhoto = club.cover_url ?? gallery.find((p) => p.status === 'approved')?.url ?? null
  const myRole: ClubRole | null = me?.status === 'active' ? me.role : null
  const isMember = isAdmin || myRole !== null
  const isLeader = isAdmin || myRole === 'president' || myRole === 'vice_president'
  const canPost =
    isAdmin ||
    myRole === 'president' ||
    myRole === 'vice_president' ||
    myRole === 'committee' ||
    (myRole === 'member' && club.who_can_post === 'members')
  const active = members.filter((m) => m.status === 'active')
  const pending = members.filter((m) => m.status === 'pending' && m.user_id !== userId)
  const leaders = active.filter((m) => m.role === 'president' || m.role === 'vice_president')

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'activity', label: t('club.activity') },
    { id: 'about', label: t('club.about') },
    { id: 'events', label: t('club.events'), badge: events.length || undefined },
    { id: 'members', label: t('club.members'), badge: active.length },
    ...(isLeader ? [{ id: 'manage' as Tab, label: t('club.manage'), badge: pending.length || undefined }] : []),
  ]
  const tab = (tabs.find((t) => t.id === params.get('tab'))?.id ?? 'activity') as Tab
  const setTab = (t: Tab) => setParams(t === 'activity' ? {} : { tab: t }, { replace: true })

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[[t('clubs.title'), '/clubs'], [club.name]]} />

      {/* ---------- Header ---------- */}
      <section className={`${card} overflow-hidden`}>
        <div
          className={`h-28 bg-gradient-to-br sm:h-44 ${coverPhoto ? '' : clubGradient(club)}`}
          style={coverPhoto ? { backgroundImage: `url(${coverPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        />
        <div className="px-5 pb-5 sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="-mt-10">
                <ClubAvatar club={club} size="lg" />
              </div>
              <div className="min-w-0 sm:pt-3">
                <p className="text-xs font-semibold text-primary">{club.category}</p>
                <h1 className="font-display text-4xl sm:text-5xl">{club.name}</h1>
              </div>
            </div>
            <div className="sm:pt-4">
              <JoinButton club={club} me={me} onChange={reload} />
            </div>
          </div>

          {club.tagline && <p className="mt-4 text-slate-700">{club.tagline}</p>}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <Chip icon={<Users size={14} />}>{active.length} {t('club.memberCount')}</Chip>
            {club.meeting_info && <Chip icon={<CalendarClock size={14} />}>{club.meeting_info}</Chip>}
            {club.instagram && (
              <a href={`https://instagram.com/${club.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer">
                <Chip icon={<AtSign size={14} />}>{club.instagram.replace(/^@/, '')}</Chip>
              </a>
            )}
            {myRole && <Chip icon={<Crown size={14} />} tone="green">{t('club.you')} {t(({ president: 'clubRole.president', vice_president: 'clubRole.vicePresident', committee: 'clubRole.committee', member: 'clubRole.member' } as const)[myRole])}</Chip>}
          </div>

          {isLeader && isOrganizer && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/organizer?new=1&club=${club.id}`} className={buttonSecondary}>
                <CalendarPlus size={16} /> {t('club.createEvent')}
              </Link>
              <button onClick={() => setTab('manage')} className={buttonSecondary}>
                <Settings size={16} /> {t('club.manageClub')}
                {pending.length > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-xs text-white">{pending.length}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto border-t border-slate-100 px-2 [scrollbar-width:none] sm:px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              {t.badge !== undefined && (
                <span className={`rounded-full px-1.5 text-xs ${t.id === 'manage' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- Tab content ---------- */}
      {tab === 'activity' && (
        <ActivityTab
          club={club}
          posts={posts}
          canPost={canPost}
          isLeader={isLeader}
          isMember={isMember}
          userId={userId}
          photos={postPhotos}
          onChange={reload}
        />
      )}

      {tab === 'about' && (
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <section className={`${card} p-5 sm:p-6`}>
            <h2 className="font-bold">{t('club.aboutClub')}</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-700">{club.about || club.description || t('club.noDescription')}</p>
            <ClubGallery clubId={club.id} photos={gallery} isLeader={isLeader} userId={userId} onChange={reload} />
          </section>
          <section className={`${card} h-fit space-y-4 p-5 sm:p-6`}>
            <div>
              <h2 className="font-bold">{t('club.ledBy')}</h2>
              <ul className="mt-2 space-y-2">
                {leaders.length === 0 && <li className="text-sm text-slate-500">{club.leader_name ?? t('club.notSet')}</li>}
                {leaders.map((m) => (
                  <li key={m.user_id} className="flex items-center justify-between text-sm">
                    <span className="font-semibold">@{m.username ?? 'member'}</span>
                    <RoleBadge role={m.role} />
                  </li>
                ))}
              </ul>
            </div>
            {club.meeting_info && (
              <div>
                <h2 className="font-bold">{t('club.regularMeeting')}</h2>
                <p className="mt-1 text-sm text-slate-600">{club.meeting_info}</p>
              </div>
            )}
            {club.leader_contact && (
              <div>
                <h2 className="font-bold">{t('club.contact')}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><MessageCircle size={15} /> {club.leader_contact}</p>
              </div>
            )}
            {club.join_url && (
              <a href={club.join_url} target="_blank" rel="noreferrer" className={`${buttonSecondary} w-full`}>
                {t('club.groupChat')} <ExternalLink size={15} />
              </a>
            )}
          </section>
        </div>
      )}

      {tab === 'events' && (
        <section className="space-y-3">
          {isLeader && isOrganizer && (
            <Link to={`/organizer?new=1&club=${club.id}`} className={buttonPrimary}>
              <CalendarPlus size={16} /> {t('club.createEventFor')} {club.name}
            </Link>
          )}
          {events.length === 0 ? (
            <EmptyState title={t('club.noUpcomingEvents')} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} counts={counts[e.id]} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'members' && (
        <MembersTab
          clubId={club.id}
          members={active}
          isLeader={isLeader}
          canAppointTop={isAdmin || myRole === 'president'}
          userId={userId}
          onChange={reload}
        />
      )}

      {tab === 'manage' && isLeader && (
        <ManageTab
          club={club}
          pending={pending}
          onClubSaved={(c) => setData({ ...data, club: c })}
          onChange={reload}
        />
      )}
    </div>
  )
}

function Chip({ icon, children, tone = 'slate' }: { icon: ReactNode; children: ReactNode; tone?: 'slate' | 'green' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ${
        tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-slate-100'
      }`}
    >
      {icon}
      {children}
    </span>
  )
}

function RoleBadge({ role }: { role: ClubRole }) {
  const { t } = useLanguage()
  const roleKeys: Record<ClubRole, TranslationKey> = {
    president: 'clubRole.president',
    vice_president: 'clubRole.vicePresident',
    committee: 'clubRole.committee',
    member: 'clubRole.member',
  }
  const style: Record<ClubRole, string> = {
    president: 'bg-primary text-white',
    vice_president: 'bg-red-50 text-primary',
    committee: 'bg-sky-50 text-sky-700',
    member: 'bg-slate-100 text-slate-600',
  }
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style[role]}`}>{t(roleKeys[role])}</span>
}

// ---------------------------------------------------------------------

function JoinButton({
  club,
  me,
  onChange,
}: {
  club: Club
  me: { status: 'pending' | 'active'; role: ClubRole } | null
  onChange: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [asking, setAsking] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      setAsking(false)
      setMessage('')
      await onChange()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (me?.status === 'active') {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-bold text-green-700">
          <Check size={16} /> {t('club.member')}
        </span>
        {me.role !== 'president' && (
          <button
            disabled={busy}
            onClick={() => window.confirm(t('club.leaveConfirm').replace('{name}', club.name)) && void run(() => leaveClub(club.id))}
            className="text-xs font-semibold text-slate-400 hover:text-red-600"
          >
            {t('club.leave')}
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (me?.status === 'pending') {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <span className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-700">{t('club.requestSent')}</span>
        <button disabled={busy} onClick={() => void run(() => leaveClub(club.id))} className="text-xs font-semibold text-slate-400 hover:text-red-600">
          {t('club.cancelRequest')}
        </button>
      </div>
    )
  }

  if (club.join_policy === 'open') {
    return (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <button disabled={busy} onClick={() => void run(() => joinClub(club.id))} className={buttonPrimary}>
          {busy ? t('club.joining') : t('club.join')}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }

  if (!asking) {
    return (
      <button onClick={() => setAsking(true)} className={buttonPrimary}>
        {t('club.askToJoin')}
      </button>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void run(() => joinClub(club.id, message.trim()))
      }}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:max-w-sm"
    >
      <label className="text-sm font-medium">
        {t('club.messageLeaders')} <span className="font-normal text-slate-400">{t('clubApply.optional')}</span>
        <textarea
          rows={2}
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('club.joinMessagePlaceholder')}
          className={inputClass}
          autoFocus
        />
      </label>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={busy} className={`${buttonPrimary} py-2.5`}>
          {busy ? t('club.sending') : t('club.sendRequest')}
        </button>
        <button type="button" onClick={() => setAsking(false)} className={buttonSecondary}>
          {t('clubApply.cancel')}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------

const EMPTY_POST: ClubPostInput = {
  kind: 'update',
  title: '',
  body: '',
  meeting_at: null,
  location: '',
  visibility: 'everyone',
  pinned: false,
}

function ActivityTab({
  club,
  posts,
  canPost,
  isLeader,
  isMember,
  userId,
  photos,
  onChange,
}: {
  club: Club
  posts: ClubPost[]
  canPost: boolean
  isLeader: boolean
  isMember: boolean
  userId: string
  photos: Photo[]
  onChange: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [composing, setComposing] = useState(false)
  const [form, setForm] = useState<ClubPostInput>(EMPTY_POST)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.title.trim().length < 3) {
      setError(t('club.postTitleHint'))
      return
    }
    if (form.kind === 'meeting' && !form.meeting_at) {
      setError(t('club.meetingDateHint'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await createClubPost(club.id, {
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        location: form.location.trim(),
        meeting_at: form.kind === 'meeting' && form.meeting_at ? new Date(form.meeting_at).toISOString() : null,
        pinned: isLeader ? form.pinned : false,
      })
      if (files.length > 0) {
        try {
          await uploadPhotos({ club_post_id: created.id }, files, userId)
        } catch (err) {
          setError(t('club.photoUploadProblem').replace('{error}', friendlyError(err)))
        }
      }
      setFiles([])
      setForm(EMPTY_POST)
      setComposing(false)
      await onChange()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(post: ClubPost) {
    if (!window.confirm(t('club.deletePostConfirm'))) return
    try {
      await deleteClubPost(post.id)
      await onChange()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {canPost &&
        (composing ? (
          <form onSubmit={submit} className={`${card} space-y-3 p-5`}>
            <div className="flex gap-2">
              {(['update', 'activity', 'meeting'] as ClubPostKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    form.kind === k ? 'bg-primary text-white' : 'border border-slate-200 text-slate-600'
                  }`}
                >
                  {k === 'meeting' ? t('club.regularMeetingKind') : t(KIND_LABEL[k])}
                </button>
              ))}
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={form.kind === 'meeting' ? t('club.meetingTitlePlaceholder') : form.kind === 'activity' ? t('club.activityTitlePlaceholder') : t('club.title')}
              maxLength={120}
              className={inputClass}
              autoFocus
            />
            <textarea
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={t('club.postDetails')}
              maxLength={4000}
              className={inputClass}
            />
            {form.kind === 'meeting' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  {t('club.dateTime')}
                  <input
                    type="datetime-local"
                    value={form.meeting_at ?? ''}
                    onChange={(e) => setForm({ ...form, meeting_at: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm font-medium">
                  {t('club.where')}
                  <input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder={t('club.mapGymPlaceholder')}
                    className={inputClass}
                  />
                </label>
              </div>
            )}
            <PhotoPicker files={files} onChange={setFiles} />
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <span className="font-medium">{t('club.whoCanSee')}</span>
                <select
                  value={form.visibility}
                  onChange={(e) => setForm({ ...form, visibility: e.target.value as ClubPostInput['visibility'] })}
                  className="rounded-lg border border-slate-200 bg-surface px-2 py-1.5"
                >
                  <option value="everyone">{t('club.everyone')}</option>
                  <option value="members">{t('club.clubMembersOnly')}</option>
                </select>
              </label>
              {isLeader && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} className="accent-red-700" />
                  {t('club.pinToTop')}
                </label>
              )}
            </div>
            <ErrorBox>{error}</ErrorBox>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={buttonPrimary}>{busy ? t('club.posting') : t('club.post')}</button>
              <button type="button" onClick={() => setComposing(false)} className={buttonSecondary}>{t('clubApply.cancel')}</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setComposing(true)} className={`${card} flex w-full items-center gap-3 p-4 text-left text-sm text-slate-500 hover:border-primary`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 font-bold text-primary">+</span>
            {t('club.shareUpdate')}
          </button>
        ))}

      {!canPost && isMember && (
        <p className="rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">
          {t('club.postingRules')}
        </p>
      )}

      {!isMember && club.posts_visibility === 'members' ? (
        <EmptyState title={t('club.postsMembersOnly')}>
          <span className="inline-flex items-center gap-1"><Lock size={14} /> {t('club.joinToSee')}</span>
        </EmptyState>
      ) : posts.length === 0 ? (
        <EmptyState title={t('club.noPosts')}>{t('club.clubNothingShared')}</EmptyState>
      ) : (
        posts.map((post) => (
          <article key={post.id} className={`${card} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-semibold ${KIND_STYLE[post.kind]}`}>{t(KIND_LABEL[post.kind])}</span>
                {post.pinned && <span className="inline-flex items-center gap-1 font-semibold text-primary"><Pin size={12} /> {t('club.pinned')}</span>}
                {post.visibility === 'members' && <span className="inline-flex items-center gap-1 text-slate-500"><Lock size={12} /> {t('club.membersOnly')}</span>}
                <span className="text-slate-400">@{post.author_username ?? 'member'} · {timeAgo(post.created_at)}</span>
              </div>
              {(isLeader || post.author_id === userId) && (
                <button onClick={() => void remove(post)} aria-label={t('club.deletePost')} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <h3 className="mt-2 text-lg font-bold">{post.title}</h3>
            {post.kind === 'meeting' && post.meeting_at && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
                <span className="flex items-center gap-1.5">
                  <CalendarClock size={15} />
                  {new Date(post.meeting_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                {post.location && <span className="flex items-center gap-1.5"><MapPin size={15} /> {post.location}</span>}
              </div>
            )}
            {post.body && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{post.body}</p>}
            {photos.some((p) => p.club_post_id === post.id) && (
              <div className="mt-3">
                <PhotoGallery
                  photos={photos.filter((p) => p.club_post_id === post.id)}
                  userId={userId}
                  canManage={isLeader}
                  onDelete={async (p) => {
                    await deletePhoto(p)
                    await onChange()
                  }}
                />
              </div>
            )}
          </article>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------

function MembersTab({
  clubId,
  members,
  isLeader,
  canAppointTop,
  userId,
  onChange,
}: {
  clubId: string
  members: ClubMemberRow[]
  isLeader: boolean
  canAppointTop: boolean
  userId: string
  onChange: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [error, setError] = useState('')

  async function act(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      await onChange()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const roles: ClubRole[] = canAppointTop ? ['president', 'vice_president', 'committee', 'member'] : ['committee', 'member']

  return (
    <section className={`${card} mx-auto max-w-3xl p-5 sm:p-6`}>
      <h2 className="font-bold">{t('club.members')}</h2>
      {isLeader && (
        <p className="mt-1 text-sm text-slate-500">
          {t('club.changeRoles')}
        </p>
      )}
      <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
      <ul className="mt-3 divide-y divide-slate-100">
        {members.map((m) => {
          const editable = isLeader && m.user_id !== userId && (canAppointTop || !['president', 'vice_president'].includes(m.role))
          return (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {(m.username ?? '?').charAt(0).toUpperCase()}
                </span>
                <div>
                  <p className="font-semibold">@{m.username ?? 'member'}{m.user_id === userId && <span className="ml-1 text-xs font-normal text-slate-400">{t('admin.you')}</span>}</p>
                  {m.batch && <p className="text-xs text-slate-500">{t('club.batch')} {m.batch}</p>}
                </div>
              </div>
              {editable ? (
                <div className="flex items-center gap-1">
                  <select
                    value={m.role}
                    onChange={(e) => void act(() => setClubMemberRole(clubId, m.user_id, e.target.value as ClubRole))}
                    aria-label={t('club.roleFor').replace('{name}', m.username ?? '')}
                    className="rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-sm"
                  >
                    {(roles.includes(m.role) ? roles : [m.role, ...roles]).map((r) => (
                      <option key={r} value={r}>{t(({ president: 'clubRole.president', vice_president: 'clubRole.vicePresident', committee: 'clubRole.committee', member: 'clubRole.member' } as const)[r])}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => window.confirm(t('club.removeMemberConfirm').replace('{name}', m.username ?? '')) && void act(() => removeClubMember(clubId, m.user_id))}
                    aria-label={t('club.removeMember').replace('{name}', m.username ?? '')}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <UserMinus size={16} />
                  </button>
                </div>
              ) : (
                <RoleBadge role={m.role} />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ---------------------------------------------------------------------

function ManageTab({
  club,
  pending,
  onClubSaved,
  onChange,
}: {
  club: Club
  pending: ClubMemberRow[]
  onClubSaved: (club: Club) => void
  onChange: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [form, setForm] = useState({
    tagline: club.tagline,
    about: club.about || club.description,
    meeting_info: club.meeting_info,
    instagram: club.instagram ?? '',
    join_url: club.join_url ?? '',
    leader_contact: club.leader_contact ?? '',
    join_policy: club.join_policy,
    who_can_post: club.who_can_post,
    posts_visibility: club.posts_visibility,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v })
    setSaved(false)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const clean = (v: string) => (v.trim() ? v.trim() : null)
      const updated = await updateClubPage(club.id, {
        ...form,
        tagline: form.tagline.trim(),
        about: form.about.trim(),
        meeting_info: form.meeting_info.trim(),
        instagram: clean(form.instagram),
        join_url: clean(form.join_url),
        leader_contact: clean(form.leader_contact),
      })
      onClubSaved(updated)
      setSaved(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  async function decide(userId: string, accept: boolean) {
    try {
      await decideClubRequest(club.id, userId, accept)
      await onChange()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <section className={`${card} h-fit p-5 sm:p-6`}>
        <h2 className="font-bold">{t('club.joinRequests')}</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t('club.noOneWaiting')}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((m) => (
              <li key={m.user_id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold">@{m.username ?? 'student'} {m.batch && <span className="text-xs font-normal text-slate-500">· Batch {m.batch}</span>}</p>
                {m.message && <p className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">“{m.message}”</p>}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void decide(m.user_id, true)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white">
                    <Check size={15} /> {t('club.accept')}
                  </button>
                  <button onClick={() => void decide(m.user_id, false)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600">
                    <X size={15} /> {t('club.decline')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className={`${card} space-y-5 p-5 sm:p-6`}>
        <div>
          <h2 className="font-bold">{t('club.page')}</h2>
          <p className="text-sm text-slate-500">{t('club.pageHint')}</p>
        </div>
        <label className="block text-sm font-medium">
          {t('clubApply.tagline')}
          <input value={form.tagline} maxLength={140} onChange={(e) => set('tagline', e.target.value)} placeholder={t('club.oneLineAbout')} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t('club.about')}
          <textarea rows={5} value={form.about} maxLength={5000} onChange={(e) => set('about', e.target.value)} className={inputClass} />
        </label>
        <label className="block text-sm font-medium">
          {t('club.regularMeeting')}
          <input value={form.meeting_info} maxLength={300} onChange={(e) => set('meeting_info', e.target.value)} placeholder={t('club.meetingInfoPlaceholder')} className={inputClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Instagram
            <input value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="club.handle" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">
            {t('admin.leaderContact')}
            <input value={form.leader_contact} onChange={(e) => set('leader_contact', e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t('club.groupChatLink')}
          <input type="url" value={form.join_url} onChange={(e) => set('join_url', e.target.value)} placeholder={t('club.groupChatPlaceholder')} className={inputClass} />
        </label>

        <div className="space-y-4 rounded-xl bg-slate-50 p-4">
          <h3 className="flex items-center gap-2 font-bold"><Settings size={16} /> {t('club.settings')}</h3>
          <Setting
            label={t('club.whoCanJoin')}
            value={form.join_policy}
            onChange={(v) => set('join_policy', v as Club['join_policy'])}
            options={[
              ['approval', t('club.leadersApprove'), <Lock key="l" size={15} />],
              ['open', t('club.anyoneCanJoin'), <Globe key="g" size={15} />],
            ]}
          />
          <Setting
            label={t('club.whoCanPost')}
            value={form.who_can_post}
            onChange={(v) => set('who_can_post', v as Club['who_can_post'])}
            options={[
              ['leaders', t('club.leadersOnly'), <Crown key="c" size={15} />],
              ['members', t('club.allMembers'), <Users key="u" size={15} />],
            ]}
          />
          <Setting
            label={t('club.whoCanSeePosts')}
            value={form.posts_visibility}
            onChange={(v) => set('posts_visibility', v as Club['posts_visibility'])}
            options={[
              ['everyone', t('club.everyoneInHub'), <Globe key="g" size={15} />],
              ['members', t('club.clubMembersOnly'), <Lock key="l" size={15} />],
            ]}
          />
        </div>

        <ErrorBox>{error}</ErrorBox>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className={buttonPrimary}>{saving ? t('club.saving') : t('profile.saveChanges')}</button>
          {saved && <span className="text-sm font-semibold text-green-700">{t('club.saved')}</span>}
        </div>
      </form>
    </div>
  )
}

function Setting({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string, ReactNode][]
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map(([v, text, icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
              value === v ? 'border-primary bg-surface font-semibold text-primary ring-2 ring-red-100' : 'border-slate-200 bg-surface text-slate-600'
            }`}
          >
            {icon}
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

// ---------------------------------------------------------------------

function ClubGallery({
  clubId,
  photos,
  isLeader,
  userId,
  onChange,
}: {
  clubId: string
  photos: Photo[]
  isLeader: boolean
  userId: string
  onChange: () => Promise<void>
}) {
  const { t } = useLanguage()
  const [files, setFiles] = useState<File[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (photos.length === 0 && !isLeader) return null

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{t('club.clubPhotos')}</h3>
        {isLeader && files === null && (
          <button onClick={() => setFiles([])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Camera size={15} /> {t('club.addPhotos')}
          </button>
        )}
      </div>
      {isLeader && photos.length === 0 && files === null && (
        <p className="mt-1 text-sm text-slate-500">{t('club.coverHint')}</p>
      )}
      {files !== null && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-3">
          <PhotoPicker files={files} onChange={setFiles} max={10} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || files.length === 0}
              onClick={async () => {
                setBusy(true)
                setError('')
                try {
                  await uploadPhotos({ club_id: clubId }, files, userId)
                  setFiles(null)
                  await onChange()
                } catch (err) {
                  setError(friendlyError(err))
                } finally {
                  setBusy(false)
                }
              }}
              className={`${buttonPrimary} px-4 py-2`}
            >
              {busy ? t('club.uploading') : t('club.uploadForReview')}
            </button>
            <button onClick={() => setFiles(null)} className={buttonSecondary}>{t('clubApply.cancel')}</button>
          </div>
        </div>
      )}
      {photos.length > 0 && (
        <div className="mt-3">
          <PhotoGallery
            photos={photos}
            userId={userId}
            canManage={isLeader}
            onDelete={async (p) => {
              await deletePhoto(p)
              await onChange()
            }}
          />
        </div>
      )}
    </div>
  )
}
