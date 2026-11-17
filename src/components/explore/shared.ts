import type { TranslationKey } from '../../context/LanguageContext'
import { deadlineLabel, todayKst } from '../../lib/format'
import type { Opportunity, OpportunityKind, OpportunityScope } from '../../lib/types'

/** Shared by the Explore list and an opportunity's own page. */

export const OPPORTUNITY_KIND_KEYS: Record<OpportunityKind, TranslationKey> = {
  conference: 'explore.kindConference',
  culture: 'explore.kindCulture',
  competition: 'explore.kindCompetition',
  scholarship: 'explore.kindScholarship',
  volunteer: 'explore.kindVolunteer',
  career: 'explore.kindCareer',
  sports: 'explore.kindSports',
  other: 'explore.kindOther',
}

export const OPPORTUNITY_SCOPE_KEYS: Record<OpportunityScope, TranslationKey> = {
  korea: 'explore.scopeKorea',
  asia: 'explore.scopeAsia',
  global: 'explore.scopeGlobal',
  online: 'explore.scopeOnline',
}

type T = (key: TranslationKey) => string

export function formatOpportunityDate(date: string, language: string, style: 'short' | 'long' = 'short') {
  const locale = language === 'ms' ? 'ms-MY' : language === 'ko' ? 'ko-KR' : 'en-GB'
  return new Date(`${date}T00:00:00`).toLocaleDateString(
    locale,
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short' },
  )
}

export function dateRange(o: Opportunity, language: string, t: T) {
  if (!o.start_date) return t('explore.dateTba')
  if (!o.end_date || o.end_date === o.start_date) return formatOpportunityDate(o.start_date, language, 'long')
  return `${formatOpportunityDate(o.start_date, language)} – ${formatOpportunityDate(o.end_date, language)}`
}

export function deadlineText(date: string | null, due: ReturnType<typeof deadlineLabel>, language: string, t: T) {
  if (!date || !due) return ''
  if (due.past) return t('explore.deadlinePassed')
  const days = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKst()}T00:00:00`).getTime()) / 86400000)
  if (days === 0) return t('explore.closesToday')
  if (days === 1) return t('explore.closesTomorrow')
  if (days <= 14) return `${t('explore.closesIn')} ${days} ${t('explore.days')}`
  return `${t('explore.closes')} ${formatOpportunityDate(date, language)}`
}

/** "Find teammates" opens a Team up post prefilled with this opportunity. */
export function teamUpHref(o: Opportunity, t: T) {
  const category = o.kind === 'competition' ? 'hackathon' : 'activities'
  return `/discuss/new?c=${category}&title=${encodeURIComponent(t('explore.teamTitle').replace('{title}', o.title))}${
    o.url ? `&link=${encodeURIComponent(o.url)}` : ''
  }${o.apply_deadline ? `&deadline=${o.apply_deadline}` : ''}`
}

export const canTeamUp = (o: Opportunity) =>
  o.kind === 'competition' || o.kind === 'conference' || o.kind === 'volunteer' || o.kind === 'culture'
