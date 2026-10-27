import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Send, Sparkles, Users } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { listClubs, listEvents, listMyRsvps, listRsvpCounts } from '../lib/api'
import { aiAsk, type ChatTurn } from '../lib/ai'
import { firstName } from '../lib/format'
import { useLoader } from '../lib/useLoader'
import EventCard from '../components/EventCard'

type Message = ChatTurn & {
  id: number
  eventIds?: string[]
  clubIds?: string[]
  error?: boolean
}

const SUGGESTIONS = [
  "What's on this week?",
  'Ada event apa minggu ni?',
  '이번 주 행사 뭐 있어?',
  "What have I RSVP'd to?",
  'Which clubs can I join?',
]

const STORAGE_KEY = 'ppmk:ask-chat'

function loadSaved(): Message[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Message[]) : []
  } catch {
    return []
  }
}

export default function AskPage() {
  const { session, profile } = useAuth()
  const userId = session!.user.id

  // Events, clubs and my RSVPs, used to show tappable cards under answers.
  const { data: hub, reload } = useLoader(async () => {
    const [events, rsvps, counts, clubs] = await Promise.all([
      listEvents(),
      listMyRsvps(userId),
      listRsvpCounts(),
      listClubs(),
    ])
    return {
      events: new Map(events.map((e) => [e.id, e])),
      myStatus: Object.fromEntries(rsvps.map((r) => [r.event_id, r.status])),
      counts,
      clubs: new Map(clubs.map((c) => [c.id, c])),
    }
  }, [userId])

  const [messages, setMessages] = useState<Message[]>(loadSaved)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      // private mode etc.: chat just won't survive a reload
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return

    const history: ChatTurn[] = messages
      .filter((m) => !m.error)
      .map(({ role, text }) => ({ role, text }))
    const userMsg: Message = { id: Date.now(), role: 'user', text: q }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setBusy(true)

    try {
      const res = await aiAsk(q, history)
      setRemaining(res.remaining)
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: 'assistant', text: res.answer, eventIds: res.eventIds, clubIds: res.clubIds },
      ])
      // Refresh my RSVP badges in case they changed in another tab.
      void reload()
    } catch (err) {
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: 'assistant', text: err instanceof Error ? err.message : String(err), error: true },
      ])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(input)
  }

  function retry() {
    const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastQuestion) return
    setMessages((m) => m.slice(0, m.lastIndexOf(lastQuestion)))
    void ask(lastQuestion.text)
  }

  const lastIsError = messages.at(-1)?.error

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Ask the Hub</h1>
            <p className="text-sm text-slate-500">Events, clubs and your RSVPs · English, Melayu, 한국어</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
          >
            <RotateCcw size={14} />
            New chat
          </button>
        )}
      </div>

      <div className="mt-5 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5">
            <p className="font-semibold text-violet-950">
              Hi {firstName(profile)}! Ask me anything about PPMK/EMSU events and clubs.
            </p>
            <p className="mt-1 text-sm text-violet-900/70">Try one of these:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => void ask(s)}
                  className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-sm text-violet-800 hover:border-violet-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-start gap-2">
              <div
                className={`max-w-[92%] whitespace-pre-line rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-6 ${
                  m.error
                    ? 'border border-red-100 bg-red-50 text-red-700'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                {m.text}
              </div>

              {m.eventIds && m.eventIds.length > 0 && hub && (
                <div className="grid w-full max-w-[92%] gap-2">
                  {m.eventIds
                    .map((id) => hub.events.get(id))
                    .filter((e) => e !== undefined)
                    .map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        myStatus={hub.myStatus[event.id]}
                        counts={hub.counts[event.id]}
                        compact
                      />
                    ))}
                </div>
              )}

              {m.clubIds && m.clubIds.length > 0 && hub && (
                <div className="flex max-w-[92%] flex-wrap gap-2">
                  {m.clubIds
                    .map((id) => hub.clubs.get(id))
                    .filter((c) => c !== undefined)
                    .map((club) => (
                      <Link
                        key={club.id}
                        to="/clubs"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold hover:border-primary hover:text-primary"
                      >
                        <Users size={14} />
                        {club.name}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <span className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
            </span>
            Checking the hub…
          </div>
        )}

        {lastIsError && !busy && (
          <button onClick={retry} className="text-sm font-semibold text-primary">
            Try again
          </button>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-5 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg md:bottom-4"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void ask(input)
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Ask about events or clubs…"
            aria-label="Your question"
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="px-2 pb-1 pt-1 text-[11px] leading-4 text-slate-400">
          AI can make mistakes, so check the event page. Your question and your own RSVP answers are
          sent to Google Gemini.{remaining !== null && ` ${remaining} questions left today.`}
        </p>
      </form>
    </div>
  )
}
