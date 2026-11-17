import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, Clock, ExternalLink, Hourglass, MapPin, Pencil, Share2, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { getOpportunity } from '../lib/api'
import { deadlineLabel } from '../lib/format'
import { OPPORTUNITY_KINDS, OPPORTUNITY_SCOPES } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import { usePageMeta } from '../lib/usePageMeta'
import Breadcrumbs from '../components/Breadcrumbs'
import {
  OPPORTUNITY_KIND_KEYS,
  OPPORTUNITY_SCOPE_KEYS,
  canTeamUp,
  dateRange,
  deadlineText,
  teamUpHref,
} from '../components/explore/shared'
import { EmptyState, ErrorBox, Spinner, buttonPrimary, buttonSecondary, card } from '../components/ui'

/**
 * One outside event or programme from Explore, on its own page: the full
 * details, a big Register button and a link people can share. No comments
 * (questions go to the Discussion board, teams to Team up).
 */
export default function OpportunityPage() {
  const { id = '' } = useParams()
  const { language, t } = useLanguage()
  const { session, isMember, isOrganizer } = useAuth()
  const { data: o, loading, error } = useLoader(() => getOpportunity(id), [id])
  usePageMeta(o?.title ?? t('explore.title'), o?.description)
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: o?.title, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* cancelled */
    }
  }

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!o) {
    return (
      <div className="space-y-4">
        <Breadcrumbs items={[[t('nav.explore'), '/explore']]} />
        <EmptyState title={t('explore.notFound')}>
          <Link to="/explore" className="font-semibold text-primary hover:underline">{t('explore.backToExplore')}</Link>
        </EmptyState>
      </div>
    )
  }

  const kind = OPPORTUNITY_KINDS[o.kind]
  const scope = OPPORTUNITY_SCOPES[o.scope]
  const due = deadlineLabel(o.apply_deadline)
  const dueText = deadlineText(o.apply_deadline, due, language, t)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Breadcrumbs items={[[t('nav.explore'), '/explore'], [o.title]]} />

      {o.status === 'suggested' && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <Hourglass size={16} className="shrink-0" /> {t('explore.pendingNote')}
        </p>
      )}

      <article className={`${card} p-5 sm:p-8`}>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-800">{kind.emoji} {t(OPPORTUNITY_KIND_KEYS[o.kind])}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{scope.emoji} {t(OPPORTUNITY_SCOPE_KEYS[o.scope])}</span>
        </div>

        <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">{o.title}</h1>
        {o.organizer && <p className="mt-1 font-medium text-slate-500">{o.organizer}</p>}

        <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
          <p className="flex items-start gap-2"><CalendarDays size={16} className="mt-0.5 shrink-0 text-slate-400" /> {dateRange(o, language, t)}</p>
          {o.location && <p className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /> {o.location}</p>}
          {due && (
            <p className={`flex items-start gap-2 font-semibold sm:col-span-2 ${due.urgent ? 'text-red-600' : due.past ? 'text-slate-400' : 'text-amber-700'}`}>
              <Clock size={16} className="mt-0.5 shrink-0" /> {t('explore.apply')} · {dueText}
            </p>
          )}
        </div>

        {o.description && (
          <p className="mt-6 whitespace-pre-line break-words text-[15px] leading-7 text-slate-700">{o.description}</p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {o.url && (
            due?.past ? (
              <a href={o.url} target="_blank" rel="noreferrer" className={buttonSecondary}>
                {t('explore.details')} <ExternalLink size={16} />
              </a>
            ) : (
              <a href={o.url} target="_blank" rel="noreferrer" className={`${buttonPrimary} w-full sm:w-auto`}>
                {t('explore.register')} <ExternalLink size={16} />
              </a>
            )
          )}
          {canTeamUp(o) &&
            (isMember ? (
              <Link to={teamUpHref(o, t)} className={buttonSecondary}>
                <Users size={16} /> {t('explore.findTeammates')}
              </Link>
            ) : (
              !session && (
                <Link to={`/login?next=/explore/${o.id}`} className={buttonSecondary}>
                  <Users size={16} /> {t('explore.goWithOthers')}
                </Link>
              )
            ))}
          <button onClick={() => void share()} className={buttonSecondary}>
            <Share2 size={16} /> {copied ? t('post.linkCopied') : t('post.share')}
          </button>
          {isOrganizer && (
            <Link to={`/explore?edit=${o.id}`} className={`${buttonSecondary} sm:ml-auto`}>
              <Pencil size={16} /> {t('explore.edit')}
            </Link>
          )}
        </div>
        {!o.url && <p className="mt-3 text-sm text-slate-500">{t('explore.noLink')}</p>}
      </article>
    </div>
  )
}
