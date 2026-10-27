import { useState } from 'react'
import { AlertTriangle, Check, Copy, Sparkles } from 'lucide-react'

import { saveAnnouncements } from '../../lib/api'
import { aiWriteAnnouncements, announcementSource, type AiTone } from '../../lib/ai'
import { eventTimeRange, formatDate, friendlyError, rsvpDeadline } from '../../lib/format'
import type { Announcements, HubEvent } from '../../lib/types'
import { ErrorBox, buttonPrimary, buttonSecondary, card } from '../ui'

type Lang = 'en' | 'ms' | 'ko'
type Tab = 'basic' | Lang

const TABS: { id: Tab; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ms', label: 'Bahasa Melayu' },
  { id: 'ko', label: '한국어' },
  { id: 'basic', label: 'Basic' },
]

const TONES: { id: AiTone; label: string }[] = [
  { id: 'friendly', label: 'Friendly' },
  { id: 'formal', label: 'Formal' },
  { id: 'short', label: 'Short' },
]

function deadlineIn(lang: Lang, date: string) {
  const d = new Date(`${date}T00:00:00`)
  if (lang === 'ko') return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  if (lang === 'ms') return d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })
  return formatDate(date)
}

/** The RSVP line the app adds under every AI announcement. */
function rsvpFooter(lang: Lang, event: HubEvent, link: string) {
  const by = deadlineIn(lang, rsvpDeadline(event))
  if (lang === 'ko') return `👉 참석 여부 응답하기 (${by}까지):\n${link}`
  if (lang === 'ms') return `👉 RSVP satu klik (sebelum ${by}):\n${link}`
  return `👉 RSVP in one tap (by ${by}):\n${link}`
}

export default function SharePanel({
  event,
  onSaved,
}: {
  event: HubEvent
  onSaved: () => void
}) {
  const link = `${window.location.origin}/events/${event.id}`

  // `?? null` also covers databases where 0003_ai.sql hasn't been run yet.
  const initial = event.announcements?.en ? event.announcements : null
  const [saved, setSaved] = useState<Announcements | null>(initial)
  const [drafts, setDrafts] = useState<Record<Lang, string> | null>(
    initial ? { en: initial.en, ms: initial.ms ?? '', ko: initial.ko ?? '' } : null,
  )
  const [tab, setTab] = useState<Tab>(initial ? 'en' : 'basic')
  const [tone, setTone] = useState<AiTone>(initial?.tone ?? 'friendly')
  const [busy, setBusy] = useState<'ai' | 'save' | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)

  const basic = [
    `📢 ${event.title}`,
    `🗓 ${formatDate(event.event_date, 'long')}, ${eventTimeRange(event)}`,
    `📍 ${event.location}`,
    ...(event.bring ? [`🎒 Bring: ${event.bring}`] : []),
    ...(event.description ? ['', event.description] : []),
    '',
    `RSVP in one tap (by ${formatDate(rsvpDeadline(event))}):`,
    link,
  ].join('\n')

  const outdated = saved !== null && saved.source !== announcementSource(event)
  const dirty =
    saved !== null &&
    drafts !== null &&
    (drafts.en !== saved.en || drafts.ms !== saved.ms || drafts.ko !== saved.ko)

  function fullText(which: Tab): string {
    if (which === 'basic' || !drafts) return basic
    return `${drafts[which].trim()}\n\n${rsvpFooter(which, event, link)}`
  }

  async function copy(what: string, id: string) {
    await navigator.clipboard.writeText(what)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 2000)
  }

  async function generate() {
    setBusy('ai')
    setError('')
    try {
      const res = await aiWriteAnnouncements(event.id, tone)
      const next: Announcements = {
        ...res.announcements,
        tone: res.tone,
        model: res.model,
        source: announcementSource(event),
        generated_at: new Date().toISOString(),
      }
      await saveAnnouncements(event.id, next)
      setSaved(next)
      setDrafts({ en: next.en, ms: next.ms, ko: next.ko })
      setRemaining(res.remaining)
      if (tab === 'basic') setTab('en')
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  async function saveEdits() {
    if (!saved || !drafts) return
    setBusy('save')
    setError('')
    try {
      const next = { ...saved, ...drafts }
      await saveAnnouncements(event.id, next)
      setSaved(next)
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Share it</h3>
          <p className="mt-1 text-sm text-slate-500">
            Paste into the KakaoTalk / WhatsApp group. Students tap the link and
            RSVP. No form needed.
          </p>
        </div>
        <button onClick={() => void copy(link, 'link')} className={buttonSecondary}>
          {copied === 'link' ? <Check size={16} /> : <Copy size={16} />}
          {copied === 'link' ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      {/* AI writer */}
      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles size={17} className="text-violet-600" />
          <p className="mr-auto text-sm font-bold text-violet-950">
            {saved ? 'AI announcement in 3 languages' : 'Write it with AI in English, Malay & Korean'}
          </p>
          <div className="flex rounded-lg bg-white p-0.5" role="radiogroup" aria-label="Tone">
            {TONES.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={tone === t.id}
                onClick={() => setTone(t.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  tone === t.id ? 'bg-violet-600 text-white' : 'text-violet-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void generate()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Sparkles size={14} />
            {busy === 'ai' ? 'Writing…' : saved ? 'Write again' : 'Write'}
          </button>
        </div>
        {outdated && (
          <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            You changed the event after this was written. Tap "Write again" so the
            details match.
          </p>
        )}
        {saved && (
          <p className="mt-1 text-xs text-violet-900/60">
            Check before you send: AI can make mistakes. {saved.model}
            {remaining !== null && ` · ${remaining} AI uses left today`}
          </p>
        )}
      </div>

      <div className="mt-3">
        <ErrorBox>{error}</ErrorBox>
      </div>

      {/* Language tabs */}
      <div className="-mx-1 mt-4 flex gap-1 overflow-x-auto px-1" role="tablist">
        {TABS.filter((t) => t.id === 'basic' || drafts).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === t.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basic' || !drafts ? (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 font-sans text-sm leading-6 text-slate-700">
          {basic}
        </pre>
      ) : (
        <div className="mt-3">
          <textarea
            value={drafts[tab]}
            onChange={(e) => setDrafts({ ...drafts, [tab]: e.target.value })}
            rows={8}
            lang={tab}
            aria-label={`Announcement in ${TABS.find((t) => t.id === tab)?.label}`}
            className="w-full rounded-t-xl border border-b-0 border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 outline-none focus:border-primary"
          />
          <pre className="-mt-1 whitespace-pre-wrap rounded-b-xl border border-t-0 border-slate-200 bg-slate-50 px-4 pb-3 pt-2 font-sans text-xs leading-5 text-slate-500">
            {rsvpFooter(tab, event, link)}
          </pre>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => void copy(fullText(tab), tab)} className={buttonPrimary}>
          {copied === tab ? <Check size={16} /> : <Copy size={16} />}
          {copied === tab ? 'Copied!' : 'Copy this'}
        </button>
        {drafts && (
          <button
            onClick={() =>
              void copy(
                (['en', 'ms', 'ko'] as const).map((l) => drafts[l].trim()).join('\n\n— — —\n\n') +
                  `\n\n👉 RSVP: ${link}`,
                'all',
              )
            }
            className={buttonSecondary}
          >
            {copied === 'all' ? 'Copied!' : 'Copy all 3 languages'}
          </button>
        )}
        {dirty && (
          <button onClick={() => void saveEdits()} disabled={busy !== null} className={buttonSecondary}>
            {busy === 'save' ? 'Saving…' : 'Save my edits'}
          </button>
        )}
      </div>
    </section>
  )
}
