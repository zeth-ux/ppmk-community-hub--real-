import { ExternalLink } from 'lucide-react'
import { SURVEY_URL } from '../config'

export default function SurveyPage() {
  const surveyReady = !SURVEY_URL.includes('REPLACE_ME')

  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-xl border bg-white p-6 md:p-8">
        <p className="text-sm font-semibold text-primary">Feedback</p>

        <h1 className="mt-1 text-3xl font-bold">
          Help shape this app.
        </h1>

        <p className="mt-3 leading-7 text-slate-600">
          2 minutes, anonymous.
        </p>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Your feedback will help us understand whether the community hub
          solves the problems students actually experience.
        </p>

        <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <strong>Privacy note:</strong> The survey should not ask for names,
          student IDs or phone numbers.
        </div>

        <a
          href={SURVEY_URL}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (!surveyReady) {
              event.preventDefault()
              alert('The feedback survey is not open yet. Please check back soon.')
            }
          }}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-white"
        >
          Open survey
          <ExternalLink size={17} />
        </a>

        {!surveyReady && (
          <p className="mt-3 text-xs text-amber-700">
            The survey link hasn't been added yet.
          </p>
        )}
      </section>
    </div>
  )
}