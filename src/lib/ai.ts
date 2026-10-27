// Browser side of the AI features. Talks only to our own /api/ai endpoint;
// the Gemini key never reaches the browser.
import { supabase } from './supabase'
import type { Announcements, EventCategory } from './types'

export type AiTone = 'friendly' | 'formal' | 'short'

export type AiExtractResult = {
  event: {
    title: string
    category: EventCategory
    event_date: string | null
    start_time: string | null
    end_time: string | null
    location: string
    capacity: number | null
    rsvp_deadline: string | null
    bring: string
    notes: string
    description: string
  }
  missing: string[]
  warnings: string[]
  model: string
  remaining: number
}

export type AiAnnounceResult = {
  announcements: Pick<Announcements, 'en' | 'ms' | 'ko'>
  tone: AiTone
  model: string
  remaining: number
}

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again.')

  let res: Response
  try {
    res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach the server. Check your internet connection.')
  }

  const payload = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || !payload) {
    throw new Error(payload?.error ?? `The AI is not available right now (error ${res.status}).`)
  }
  return payload
}

export function aiExtractEvent(notes: string) {
  return callAi<AiExtractResult>({ action: 'extract', notes })
}

export function aiWriteAnnouncements(eventId: string, tone: AiTone) {
  return callAi<AiAnnounceResult>({ action: 'announce', eventId, tone })
}

/** Fingerprint of the facts an announcement was written from, so we can
 *  tell the organizer when the event changed afterwards. */
export function announcementSource(event: {
  title: string
  event_date: string
  start_time: string
  end_time: string | null
  location: string
  bring: string
  capacity: number | null
  rsvp_deadline: string | null
}): string {
  return [
    event.title,
    event.event_date,
    event.start_time.slice(0, 5),
    event.end_time?.slice(0, 5) ?? '',
    event.location,
    event.bring,
    event.capacity ?? '',
    event.rsvp_deadline ?? '',
  ].join('|')
}

export type ChatTurn = { role: 'user' | 'assistant'; text: string }

export type AiAskResult = {
  answer: string
  eventIds: string[]
  clubIds: string[]
  model: string
  remaining: number
}

export function aiAsk(question: string, history: ChatTurn[]) {
  return callAi<AiAskResult>({ action: 'ask', question, history: history.slice(-6) })
}
