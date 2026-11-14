import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/usePageMeta'

import { CONTACT_EMAIL, isConfigured } from '../config'
import { useLanguage } from '../context/LanguageContext'

const visibilityRows = [
  ['privacy.you', 'privacy.youDetails'],
  ['privacy.membersVisitors', 'privacy.membersVisitorsDetails'],
  ['privacy.organizers', 'privacy.organizersDetails'],
  ['privacy.clubLeaders', 'privacy.clubLeadersDetails'],
  ['privacy.admins', 'privacy.adminsDetails'],
  ['privacy.signedOut', 'privacy.signedOutDetails'],
] as const

const sections = [
  ['privacy.collectTitle', 'privacy.collectBody'],
  ['privacy.whyTitle', 'privacy.whyBody'],
  ['privacy.storageTitle', 'privacy.storageBody'],
  ['privacy.responsibleTitle', 'privacy.responsibleBody'],
  ['privacy.retentionTitle', 'privacy.retentionBody'],
  ['privacy.rightsTitle', 'privacy.rightsBody'],
  ['privacy.aiTitle', 'privacy.aiBody'],
  ['privacy.sharingTitle', 'privacy.sharingBody'],
  ['privacy.legalTitle', 'privacy.legalBody'],
] as const

export default function PrivacyPage() {
  const { t } = useLanguage()
  usePageMeta(t('privacy.title'), t('privacy.meta'))
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <h1 className="font-display text-5xl sm:text-6xl">{t('privacy.heading')}</h1>
        <p className="mt-4 text-[15px] leading-7 text-slate-600">
          {t('privacy.intro')}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="text-lg font-bold">{t('privacy.visibilityHeading')}</h2>
        <dl className="mt-3 divide-y divide-slate-100">
          {visibilityRows.map(([whoKey, whatKey]) => (
            <div key={whoKey} className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]">
              <dt className="text-sm font-semibold">{t(whoKey)}</dt>
              <dd className="text-sm leading-6 text-slate-600">{t(whatKey)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {sections.map(([titleKey, bodyKey], index) => (
        <section key={titleKey} className="rounded-xl border border-slate-200 bg-surface p-5">
          <h2 className="text-lg font-bold">
            {index + 1}. {t(titleKey)}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {bodyKey === 'privacy.rightsBody' ? (
              <>
                {t('privacy.rightsBeforeLink')}{' '}
                <Link to="/me" className="font-semibold text-primary underline">{t('privacy.profileLink')}</Link>
                {t('privacy.rightsAfterLink')}
              </>
            ) : t(bodyKey)}
          </p>
        </section>
      ))}

      <section className="rounded-xl border border-slate-200 bg-surface p-5">
        <h2 className="text-lg font-bold">{t('privacy.questions')}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {isConfigured(CONTACT_EMAIL) ? (
            <>
              {t('privacy.contactTeam')}{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-primary underline">
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            t('privacy.contactGroup')
          )}
        </p>
      </section>
    </div>
  )
}
