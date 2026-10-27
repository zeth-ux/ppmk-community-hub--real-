import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'

import { aiExtractEvent, type AiExtractResult } from '../../lib/ai'
import { ErrorBox, inputClass } from '../ui'

const FIELD_LABEL: Record<string, string> = {
  title: 'title',
  event_date: 'date',
  start_time: 'start time',
  end_time: 'end time',
  location: 'location',
  capacity: 'capacity',
  rsvp_deadline: 'RSVP deadline',
  bring: 'what to bring',
  notes: 'notes',
}
const REQUIRED = new Set(['title', 'event_date', 'start_time', 'location'])

const EXAMPLES = [
  'futsal jumaat ni 8-10mlm erica sports complex, max 20 org, bawak air & kasut indoor',
  'Welcome dinner for new students next saturday 6.30pm at Ansan community hall, rsvp by thursday',
  '다음 주 수요일 저녁 7시 도서관 스터디 그룹, 노트북 가져오기',
]

/** "Describe your event in your own words": AI fills in the form below. */
export default function AiFillBox({ onFill }: { onFill: (result: AiExtractResult) => void }) {
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AiExtractResult | null>(null)

  async function run() {
    if (notes.trim().length < 5) {
      setError('Write a few words about the event first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await aiExtractEvent(notes)
      setResult(res)
      onFill(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const mustFill = result?.missing.filter((m) => REQUIRED.has(m)) ?? []
  const optional = result?.missing.filter((m) => !REQUIRED.has(m) && FIELD_LABEL[m]) ?? []

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-violet-600" />
        <h3 className="font-bold text-violet-950">Fill with AI</h3>
      </div>
      <p className="mt-1 text-sm leading-6 text-violet-900/80">
        Describe the event the way you'd type it in the group chat, in English,
        Malay or Korean. The AI fills in the form below; you check it before saving.
      </p>

      <textarea
        rows={3}
        value={notes}
        maxLength={2000}
        onChange={(e) => {
          setNotes(e.target.value)
          setError('')
        }}
        placeholder={EXAMPLES[0]}
        aria-label="Describe your event"
        className={`${inputClass} border-violet-200 focus:border-violet-500 focus:ring-violet-100`}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
        >
          <Sparkles size={16} />
          {busy ? 'Reading your notes…' : result ? 'Try again' : 'Fill the form'}
        </button>
        {!notes && (
          <button
            type="button"
            onClick={() => setNotes(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
            className="text-xs font-semibold text-violet-700 underline"
          >
            Show me an example
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-violet-900/60">
        Don't include anyone's name, phone number or other personal details; the
        text is sent to Google's Gemini AI.
      </p>

      <div className="mt-3 space-y-2">
        <ErrorBox>{error}</ErrorBox>

        {result && (
          <div className="space-y-2 rounded-xl bg-white p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold text-green-700">
              <CheckCircle2 size={16} />
              Filled in. Please check every field below before saving.
            </p>
            {mustFill.length > 0 && (
              <p className="text-amber-800">
                <strong>Still needed:</strong> {mustFill.map((m) => FIELD_LABEL[m]).join(', ')}
              </p>
            )}
            {optional.length > 0 && (
              <p className="text-slate-500">
                Not in your notes (optional): {optional.map((m) => FIELD_LABEL[m]).join(', ')}
              </p>
            )}
            {result.warnings.map((w) => (
              <p key={w} className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                {w}
              </p>
            ))}
            <p className="text-xs text-slate-400">
              {result.model} · {result.remaining} AI uses left today
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
