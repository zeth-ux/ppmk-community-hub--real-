import { ExternalLink } from 'lucide-react'
import { SURVEY_URL } from '../config'
import { usePageMeta } from '../lib/usePageMeta'
import { useLanguage } from '../context/LanguageContext'

export default function SurveyPage() {
  const { t } = useLanguage()
  usePageMeta(t('survey.title'))
  const surveyReady = !SURVEY_URL.includes('REPLACE_ME')

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-xl border bg-surface p-6 md:p-8">
        <p className="text-sm font-semibold text-primary">{t('survey.title')}</p>

        <h1 className="mt-1 text-3xl font-bold">
          {t('survey.heading')}
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          {t('survey.time')}
        </p>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          {t('survey.description')}
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <strong>{t('survey.privacyLabel')}</strong> {t('survey.privacyNote')}
        </div>

        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!surveyReady) {
              event.preventDefault()
              alert(t('survey.notOpen'))
            }
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white"
        >
          {t('survey.open')}
          <ExternalLink size={17} />
        </a>

        {!surveyReady && (
          <p className="mt-3 text-xs text-amber-700">
            {t('survey.noLink')}
          </p>
        )}
      </section>
    </div>
  )
}