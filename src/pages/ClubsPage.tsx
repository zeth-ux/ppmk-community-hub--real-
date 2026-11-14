import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, Plus, Search, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { listClubMemberCounts, listClubs, listMyClubMemberships } from '../lib/api'
import type { ClubRole } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import { useLoader } from '../lib/useLoader'
import ClubAvatar from '../components/ClubAvatar'
import { EmptyState, ErrorBox, PageHeader, Spinner, buttonPrimary, card, inputClass } from '../components/ui'

const roleTranslation: Record<ClubRole, TranslationKey> = {
  president: 'clubRole.president',
  vice_president: 'clubRole.vicePresident',
  committee: 'clubRole.committee',
  member: 'clubRole.member',
}
const categoryTranslation: Record<string, TranslationKey> = {
  Sports: 'category.sports',
  Social: 'category.social',
  Academic: 'category.academic',
  Career: 'category.career',
  Cultural: 'category.cultural',
  Religious: 'category.religious',
}

export default function ClubsPage() {
  const { t } = useLanguage()
  usePageMeta(t('clubs.title'), t('clubs.meta'))
  const { session } = useAuth()
  const userId = session!.user.id

  const { data, loading, error } = useLoader(async () => {
    const [clubs, counts, mine] = await Promise.all([
      listClubs(),
      listClubMemberCounts().catch(() => ({}) as Awaited<ReturnType<typeof listClubMemberCounts>>),
      listMyClubMemberships(userId).catch(() => []),
    ])
    return { clubs: clubs.filter((c) => c.status !== 'inactive'), counts, mine }
  }, [userId])

  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')

  const clubs = data?.clubs ?? []
  const categories = ['All', ...new Set(clubs.map((club) => club.category))]
  const q = search.trim().toLowerCase()
  const filtered = clubs
    .filter((c) => category === 'All' || c.category === category)
    .filter((c) => !q || `${c.name} ${c.tagline} ${c.description}`.toLowerCase().includes(q))
  const myIds = new Set(data?.mine.map((m) => m.club_id))
  const mineFirst = [...filtered.filter((c) => myIds.has(c.id)), ...filtered.filter((c) => !myIds.has(c.id))]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('footer.community')}
        title={t('clubs.title')}
        description={t('clubs.description')}
        action={
          <Link to="/clubs/apply" className={buttonPrimary}>
            <Plus size={16} />
            {t('clubs.startClub')}
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('clubs.search')}
            aria-label={t('clubs.search')}
            className={`${inputClass} mt-0 pl-9`}
          />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                category === item ? 'bg-primary text-white' : 'border border-slate-200 bg-surface text-slate-600 hover:border-slate-300'
              }`}
            >
              {item === 'All' ? t('clubs.all') : categoryTranslation[item] ? t(categoryTranslation[item]) : item}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <ErrorBox>{error}</ErrorBox>
      ) : mineFirst.length === 0 ? (
        <EmptyState title={t('clubs.noClubs')}>
          <Link to="/clubs/apply" className="font-semibold text-primary">{t('clubs.startOne')}</Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mineFirst.map((club) => {
            const mine = data?.mine.find((m) => m.club_id === club.id)
            const count = data?.counts[club.id]
            return (
              <Link
                key={club.id}
                to={`/clubs/${club.id}`}
                className={`${card} group flex min-w-0 flex-col p-5 transition hover:border-primary`}
              >
                <div className="flex items-start gap-3">
                  <ClubAvatar club={club} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-primary">{club.category}</p>
                    <h2 className="truncate text-lg font-bold group-hover:text-primary">{club.name}</h2>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-slate-300 group-hover:text-primary" />
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{club.tagline || club.description}</p>

                <div className="mt-auto space-y-1.5 pt-4 text-xs text-slate-500">
                  {club.meeting_info && (
                    <p className="flex items-center gap-1.5">
                      <CalendarClock size={14} className="shrink-0" />
                      <span className="truncate">{club.meeting_info}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />                       {count?.members ?? 0} {t('club.memberCount')}
                    </span>
                    {mine ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-semibold ${
                          mine.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {mine.status === 'pending' ? t('clubs.requested') : t(roleTranslation[mine.role])}
                      </span>
                    ) : (
                      <span className="font-semibold text-primary">{club.join_policy === 'open' ? t('clubs.join') : t('clubs.askToJoin')}</span>
                    )}
                  </div>
                  {count && count.pending > 0 && (
                    <p className="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                      {count.pending} {t('clubs.requestWaiting')}
                    </p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
