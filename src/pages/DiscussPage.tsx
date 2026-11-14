import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Clock, ExternalLink, Flame, Lock, MessageCircle, PenSquare, Search, TrendingUp } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { listForumPosts, listPhotos } from '../lib/api'
import { categoryInfo, timeAgo } from '../lib/format'
import {
  FORUM_CATEGORIES,
  FORUM_GROUPS,
  TEAMUP_CATEGORIES,
  type ForumCategory,
  type ForumGroupId,
  type ForumSort,
} from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import { AuthorTag, CostBadge, PlaceBadge, TeamUpInfo, VoteButtons } from '../components/forum'
import { MembersOnly } from '../components/guards'
import { EmptyState, ErrorBox, Spinner, buttonPrimary, card, inputClass } from '../components/ui'

const SORTS: { id: ForumSort; label: TranslationKey; icon: typeof Flame }[] = [
  { id: 'hot', label: 'discuss.sortHot', icon: Flame },
  { id: 'new', label: 'discuss.sortNew', icon: Clock },
  { id: 'top', label: 'discuss.sortTop', icon: TrendingUp },
]

const GROUP_LABEL_KEYS: Record<ForumGroupId, TranslationKey> = {
  explore: 'discuss.groupExplore',
  life: 'discuss.groupLife',
  teamup: 'discuss.groupTeamup',
}
const GROUP_BLURB_KEYS: Record<ForumGroupId, TranslationKey> = {
  explore: 'discuss.groupExploreBlurb',
  life: 'discuss.groupLifeBlurb',
  teamup: 'discuss.groupTeamupBlurb',
}
const CATEGORY_LABEL_KEYS: Record<ForumCategory, TranslationKey> = {
  food: 'discuss.categoryFood',
  hidden_gems: 'discuss.categoryHiddenGems',
  hangout: 'discuss.categoryHangout',
  trips: 'discuss.categoryTrips',
  budget: 'discuss.categoryBudget',
  study: 'discuss.categoryStudy',
  serious: 'discuss.categorySerious',
  career: 'discuss.categoryCareer',
  general: 'discuss.categoryGeneral',
  hackathon: 'discuss.categoryHackathon',
  startup: 'discuss.categoryStartup',
  activities: 'discuss.categoryActivities',
}

const GROUP_STYLE: Record<ForumGroupId, { active: string; soft: string }> = {
  explore: { active: 'border-emerald-500', soft: 'bg-emerald-50 text-emerald-800' },
  life: { active: 'border-primary', soft: 'bg-red-50 text-primary' },
  teamup: { active: 'border-indigo-500', soft: 'bg-indigo-50 text-indigo-800' },
}

export default function DiscussPage() {
  const { t } = useLanguage()
  usePageMeta(t('discuss.title'), t('discuss.meta'))
  const { session, isMember } = useAuth()
  const [params, setParams] = useSearchParams()

  const categoryParam = params.get('c') as ForumCategory | null
  const category = FORUM_CATEGORIES.some((c) => c.id === categoryParam) ? categoryParam : null
  const groupParam = params.get('g') as ForumGroupId | null
  const group: ForumGroupId = category
    ? categoryInfo(category).group
    : FORUM_GROUPS.some((g) => g.id === groupParam)
      ? groupParam!
      : 'explore'
  const groupInfo = FORUM_GROUPS.find((g) => g.id === group)!
  const locked = !groupInfo.public && !isMember
  const sort = (params.get('sort') as ForumSort | null) ?? 'hot'

  const [search, setSearch] = useState(params.get('q') ?? '')
  const [query, setQuery] = useState(search)
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const { data: loaded, loading, error } = useLoader(async () => {
    if (locked) return { posts: [], thumbs: {} as Record<string, string> }
    const posts = await listForumPosts({ category: category ?? `group:${group}`, sort, search: query })
    const photos = await listPhotos('forum_post_id', posts.map((p) => p.id)).catch(() => [])
    const thumbs: Record<string, string> = {}
    for (const ph of photos) if (ph.status === 'approved' && !thumbs[ph.forum_post_id!]) thumbs[ph.forum_post_id!] = ph.url
    return { posts, thumbs }
  }, [category, group, sort, query, locked])
  const data = loaded?.posts

  function go(next: { g?: ForumGroupId; c?: ForumCategory | null; sort?: ForumSort }) {
    const p = new URLSearchParams(params)
    if (next.g) {
      p.set('g', next.g)
      p.delete('c')
    }
    if (next.c !== undefined) {
      if (next.c) p.set('c', next.c)
      else p.delete('c')
    }
    if (next.sort) {
      if (next.sort === 'hot') p.delete('sort')
      else p.set('sort', next.sort)
    }
    setParams(p, { replace: true })
  }

  const cats = FORUM_CATEGORIES.filter((c) => c.group === group)
  const newPostHref = session
    ? `/discuss/new?c=${category ?? cats[0].id}`
    : `/login?next=${encodeURIComponent(`/discuss/new?c=${category ?? cats[0].id}`)}`
  const isTeamUp = group === 'teamup'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl sm:text-6xl">{t('discuss.title')}</h1>
        </div>
        {!locked && (
          <Link to={newPostHref} className={buttonPrimary}>
            <PenSquare size={16} /> {isTeamUp ? t('discuss.findTeammates') : t('discuss.newPost')}
          </Link>
        )}
      </div>

      {/* Sections: the main divider. Compact 3-way switch on phones, cards on bigger screens. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {FORUM_GROUPS.map((g) => {
          const active = g.id === group
          const isLocked = !g.public && !isMember
          return (
            <button
              key={g.id}
              onClick={() => go({ g: g.id })}
              aria-pressed={active}
              className={`relative rounded-2xl p-3 text-center transition sm:p-4 sm:text-left ${
                active
                  ? `border-2 bg-surface ${GROUP_STYLE[g.id].active}`
                  : 'border-2 border-transparent bg-surface ring-1 ring-slate-200 hover:ring-slate-300'
              }`}
            >
              {isLocked && <Lock size={13} className="absolute right-2.5 top-2.5 text-slate-400" />}
              <span className="block text-2xl">{g.emoji}</span>
              <span className="mt-1 block text-xs font-bold leading-tight sm:mt-2 sm:text-base">{t(GROUP_LABEL_KEYS[g.id])}</span>
              <span className="mt-0.5 hidden text-xs leading-5 text-slate-500 sm:line-clamp-2 sm:block">
                {t(GROUP_BLURB_KEYS[g.id])}
              </span>
            </button>
          )
        })}
      </div>
      <p className="-mt-2 text-sm text-slate-500 sm:hidden">{t(GROUP_BLURB_KEYS[groupInfo.id])}</p>

      {locked ? (
        <MembersOnly compact />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-4">
            {/* Topics inside the section */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip active={!category} onClick={() => go({ c: null })}>
                {t('discuss.all')} {t(GROUP_LABEL_KEYS[groupInfo.id])}
              </Chip>
              {cats.map((c) => (
                <Chip key={c.id} active={category === c.id} onClick={() => go({ c: c.id })}>
                  {c.emoji} {t(CATEGORY_LABEL_KEYS[c.id])}
                </Chip>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex self-start rounded-xl bg-surface p-1 ring-1 ring-slate-200">
                {SORTS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => go({ sort: id })}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      sort === id ? 'bg-red-50 text-primary' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={15} /> {t(label)}
                  </button>
                ))}
              </div>
              <div className="relative sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={group === 'explore' ? t('discuss.searchExplore') : t('discuss.searchPosts')}
                  aria-label={t('discuss.searchPosts')}
                  className={`${inputClass} mt-0 pl-9`}
                />
              </div>
            </div>

            {!session && group === 'explore' && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                👋 {t('discuss.visitorWelcome')}{' '}
                <Link to="/login?next=/discuss" className="font-bold underline">{t('discuss.signIn')}</Link>{' '}
                {t('discuss.visitorPrompt')}
              </p>
            )}

            {loading ? (
              <Spinner />
            ) : error ? (
              <ErrorBox>{error}</ErrorBox>
            ) : (data ?? []).length === 0 ? (
              <EmptyState title={query ? t('discuss.noSearchResults') : t('discuss.noPosts')}>
                <Link to={newPostHref} className="font-semibold text-primary">{t('discuss.firstPost')}</Link>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {(data ?? []).map((post) => {
                  const cat = categoryInfo(post.category)
                  const teamUp = TEAMUP_CATEGORIES.includes(post.category)
                  return (
                    <li key={post.id}>
                      <div className={`${card} relative flex gap-2 p-3 transition hover:border-primary sm:gap-3 sm:p-4`}>
                        <div className="relative z-10">
                          <VoteButtons post={post} signedIn={Boolean(session)} />
                        </div>
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span className={`rounded-full px-2 py-0.5 font-semibold ${GROUP_STYLE[cat.group].soft}`}>
                              {cat.emoji} {t(CATEGORY_LABEL_KEYS[post.category])}
                            </span>
                            <AuthorTag username={post.author_username} anonymous={post.is_anonymous} isMine={post.is_mine} />
                            <span>· {timeAgo(post.created_at)}</span>
                          </div>
                          <h2 className="mt-1.5 text-base font-bold leading-snug sm:text-lg">
                            {/* The ::after overlay makes the whole card clickable. */}
                            <Link to={`/discuss/${post.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
                              {post.title}
                            </Link>
                          </h2>
                          {post.body && <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{post.body}</p>}
                          {teamUp && (
                            <div className="mt-2">
                              <TeamUpInfo post={post} compact />
                            </div>
                          )}
                          {loaded?.thumbs[post.id] && (
                            <img
                              src={loaded.thumbs[post.id]}
                              alt={`${t('discuss.photoFrom')} “${post.title}”`}
                              loading="lazy"
                              className="mt-2 h-40 w-full rounded-xl object-cover sm:hidden"
                            />
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {(post.place_name || post.place_area) && (
                              <span className="relative z-10">
                                <PlaceBadge post={post} />
                              </span>
                            )}
                            <CostBadge cost={post.cost_note} />
                            {teamUp && post.link_url && (
                              <a
                                href={post.link_url}
                                target="_blank"
                                rel="noreferrer"
                                className="relative z-10 inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                              >
                                {t('discuss.eventPage')} <ExternalLink size={12} />
                              </a>
                            )}
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                              <MessageCircle size={14} /> {post.comment_count}
                            </span>
                          </div>
                        </div>
                        {loaded?.thumbs[post.id] && (
                          <img
                            src={loaded.thumbs[post.id]}
                            alt={`${t('discuss.photoFrom')} “${post.title}”`}
                            loading="lazy"
                            className="hidden h-24 w-32 shrink-0 self-center rounded-xl object-cover sm:block"
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Laptop sidebar: every topic, divided by section */}
          <aside className="hidden space-y-4 lg:block">
            <nav className={`${card} p-3`} aria-label={t('discuss.topics')}>
              {FORUM_GROUPS.map((g, i) => {
                const isLocked = !g.public && !isMember
                return (
                  <div key={g.id} className={i > 0 ? 'mt-3 border-t border-slate-100 pt-3' : ''}>
                    <button
                      onClick={() => go({ g: g.id })}
                      className="flex w-full items-center justify-between px-2 pb-1 text-xs font-bold text-slate-400 hover:text-slate-700"
                    >
                      <span>{g.emoji} {t(GROUP_LABEL_KEYS[g.id])}</span>
                      {isLocked && <Lock size={12} />}
                    </button>
                    {!isLocked &&
                      FORUM_CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => go({ c: c.id })}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                            category === c.id ? 'bg-red-50 font-semibold text-primary' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span>{c.emoji}</span> {t(CATEGORY_LABEL_KEYS[c.id])}
                        </button>
                      ))}
                  </div>
                )
              })}
            </nav>
            {isTeamUp ? (
              <div className={`${card} p-4 text-sm leading-6 text-slate-600`}>
                <p className="font-bold text-slate-900">{t('discuss.howTeamup')}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  <li>{t('discuss.teamupStep1')}</li>
                  <li>{t('discuss.teamupStep2')}</li>
                  <li>{t('discuss.teamupStep3')}</li>
                </ol>
                <Link to="/explore" className="mt-3 inline-block font-semibold text-primary">
                  {t('discuss.browseOpportunities')}
                </Link>
              </div>
            ) : (
              <div className={`${card} p-4 text-sm leading-6 text-slate-600`}>
                <p className="font-bold text-slate-900">{t('discuss.rulesTitle')}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>{t('discuss.rule1')}</li>
                  <li>{t('discuss.rule2')}</li>
                  <li>{t('discuss.rule3')}</li>
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
        active ? 'bg-ink text-on-ink' : 'border border-slate-200 text-slate-600 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}
