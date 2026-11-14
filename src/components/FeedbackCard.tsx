import { useState } from 'react'
import { CheckCircle2, Star } from 'lucide-react'

import { useLanguage, type TranslationKey } from '../context/LanguageContext'
import { canGiveFeedback, getMyFeedback, setMyFeedback } from '../lib/api'
import { friendlyError } from '../lib/format'
import { useLoader } from '../lib/useLoader'
import { ErrorBox, buttonPrimary, card, inputClass } from './ui'

const LABELS: TranslationKey[] = ['feedback.star1', 'feedback.star2', 'feedback.star3', 'feedback.star4', 'feedback.star5']

/**
 * "How was it?" after an event, for people who went. Organizers only ever
 * see the average and the comments, never who wrote them.
 */
export default function FeedbackCard({ eventId }: { eventId: string }) {
  const { t } = useLanguage()
  // If loading fails (e.g. the feedback database update isn't installed
  // yet), `data` stays empty and the card simply doesn't show.
  const { data, setData } = useLoader(async () => {
    const [open, mine] = await Promise.all([
      canGiveFeedback(eventId),
      getMyFeedback(eventId),
    ])
    return { open, mine }
  }, [eventId])

  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  if (!data || (!data.open && !data.mine)) return null

  const { open, mine } = data
  const currentRating = rating ?? mine?.rating ?? 0
  const currentComment = comment ?? mine?.comment ?? ''
  const changed = currentRating !== (mine?.rating ?? 0) || currentComment !== (mine?.comment ?? '')

  async function submit() {
    if (!currentRating) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const row = await setMyFeedback(eventId, currentRating, currentComment.trim())
      setData({ open, mine: row })
      setRating(null)
      setComment(null)
      setSaved(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`${card} p-5 sm:p-7`} aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="text-lg font-bold">
        {mine ? t('feedback.yours') : t('feedback.title')}
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {t('feedback.anonymous')}
      </p>

      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label={t('feedback.ratingLabel')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={currentRating === n}
            aria-label={t('feedback.starAria').replace('{n}', String(n)).replace('{label}', t(LABELS[n - 1]))}
            disabled={!open || saving}
            onClick={() => setRating(n)}
            className="rounded-lg p-1.5 transition hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
          >
            <Star
              size={34}
              className={n <= currentRating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
            />
          </button>
        ))}
        {currentRating > 0 && (
          <span className="ml-2 text-sm font-semibold text-slate-600">{t(LABELS[currentRating - 1])}</span>
        )}
      </div>

      {open ? (
        <>
          <textarea
            value={currentComment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t('feedback.placeholder')}
            aria-label={t('feedback.commentLabel')}
            className={inputClass}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void submit()}
              disabled={!currentRating || saving || !changed}
              className={buttonPrimary}
            >
              {saving ? t('feedback.sending') : mine ? t('feedback.update') : t('feedback.send')}
            </button>
            {saved && !changed && (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <CheckCircle2 size={16} /> {t('feedback.thanks')}
              </span>
            )}
          </div>
        </>
      ) : (
        mine?.comment && <p className="mt-3 text-sm text-slate-600">“{mine.comment}”</p>
      )}

      <div className="mt-3">
        <ErrorBox>{error}</ErrorBox>
      </div>
    </section>
  )
}
