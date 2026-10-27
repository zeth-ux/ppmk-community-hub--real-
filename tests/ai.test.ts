// Unit tests for api/ai.ts with a fake Gemini and a fake Supabase.
// Run: npm run test:ai
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  handleAiRequest,
  normalizeExtract,
  parseJsonObject,
  extractPrompts,
} from '../api/ai.ts'

const ENV = {
  apiKey: 'test-key',
  model: 'gemini-test',
  supabaseUrl: 'https://db.test',
  supabaseAnonKey: 'anon',
}
const EVENT_ID = '11111111-2222-3333-4444-555555555555'

type Call = { url: string; body: Record<string, unknown> | null }

/** A fake network: Supabase RPC/REST + Gemini, with scripted answers. */
function fakeFetch(opts: {
  aiBegin?: { status: number; body: unknown }
  gemini?: { status: number; body: unknown }[]
  event?: unknown[]
}) {
  const calls: Call[] = []
  const geminiQueue = [...(opts.gemini ?? [])]

  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, body })

    const reply = (status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })

    if (url.endsWith('/rest/v1/rpc/ai_begin')) {
      const r = opts.aiBegin ?? { status: 200, body: 39 }
      return reply(r.status, r.body)
    }
    if (url.includes('/rest/v1/events')) return reply(200, opts.event ?? [])
    if (url.includes('generativelanguage.googleapis.com')) {
      const next = geminiQueue.shift()
      if (!next) throw new Error('unexpected Gemini call')
      return reply(next.status, next.body)
    }
    throw new Error('unexpected fetch ' + url)
  }) as typeof fetch

  return { impl, calls }
}

const gemini = (textOut: string) => ({
  status: 200,
  body: { candidates: [{ content: { parts: [{ text: textOut }] } }] },
})

function post(body: unknown, token: string | null = 'user-jwt') {
  return new Request('https://app.test/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
}

// ---------- endpoint behaviour ----------

test('no sign-in → 401, Gemini never called', async () => {
  const net = fakeFetch({})
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal friday 8pm' }, null), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 401)
  assert.equal(net.calls.length, 0)
})

test('missing GEMINI_API_KEY → clear setup message', async () => {
  const net = fakeFetch({})
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal friday 8pm' }), {
    env: { ...ENV, apiKey: undefined },
    fetchImpl: net.impl,
  })
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /GEMINI_API_KEY/)
})

test('student (not organizer) → 403, Gemini never called', async () => {
  const net = fakeFetch({ aiBegin: { status: 400, body: { message: 'NOT_ALLOWED' } } })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal friday 8pm' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 403)
  assert.ok(!net.calls.some((c) => c.url.includes('googleapis')))
})

test('daily limit reached → 429 with friendly message', async () => {
  const net = fakeFetch({ aiBegin: { status: 400, body: { message: 'AI_DAILY_LIMIT' } } })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal friday 8pm' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 429)
  assert.match((await res.json()).error, /today's AI limit/)
})

test('extract: happy path returns cleaned event + remaining quota', async () => {
  const net = fakeFetch({
    gemini: [
      gemini(JSON.stringify({
        title: 'EMSU Futsal Night', category: 'sports', event_date: '2099-01-02', start_time: '20:00',
        end_time: '22:00', location: 'ERICA Sports Complex', capacity: 20, rsvp_deadline: null,
        bring: 'Water', notes: '', description: 'Friendly futsal.', missing: ['rsvp_deadline'],
      })),
    ],
  })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal 2 jan 8-10pm erica sports complex max 20 bawak air' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.event.category, 'Sports')
  assert.equal(data.event.capacity, 20)
  assert.equal(data.remaining, 39)
  assert.equal(data.model, 'gemini-test')

  const geminiCall = net.calls.find((c) => c.url.includes('googleapis'))!
  assert.ok(geminiCall.url.includes('/models/gemini-test:generateContent'))
  const config = geminiCall.body!.generationConfig as Record<string, unknown>
  assert.equal(config.responseMimeType, 'application/json')
})

test('extract: notes that are too short are rejected before any call', async () => {
  const net = fakeFetch({})
  const res = await handleAiRequest(post({ action: 'extract', notes: 'hi' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 400)
  assert.equal(net.calls.length, 0)
})

test('model rejects structured output (400) → retries in plain mode', async () => {
  const net = fakeFetch({
    gemini: [
      { status: 400, body: { error: { message: 'JSON mode is not enabled for this model' } } },
      gemini('```json\n{"title":"Badminton","category":"Sports","event_date":null,"start_time":null,"end_time":null,"location":"","capacity":null,"rsvp_deadline":null,"bring":"","notes":"","description":"","missing":[]}\n```'),
    ],
  })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'badminton sometime' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.event.title, 'Badminton')
  assert.deepEqual(data.missing, ['event_date', 'start_time', 'location'])

  const second = net.calls.filter((c) => c.url.includes('googleapis'))[1]
  assert.equal(second.body!.systemInstruction, undefined)
  assert.equal((second.body!.generationConfig as Record<string, unknown>).responseMimeType, undefined)
})

test('Gemma models are called without structured-output settings', async () => {
  const net = fakeFetch({
    gemini: [gemini('{"title":"Study Group","category":"Academic","event_date":null,"start_time":null,"end_time":null,"location":"Library","capacity":null,"rsvp_deadline":null,"bring":"","notes":"","description":"","missing":[]}')],
  })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'study group at library' }), {
    env: { ...ENV, model: 'gemma-4-26b-a4b-it' },
    fetchImpl: net.impl,
  })
  assert.equal(res.status, 200)
  const call = net.calls.find((c) => c.url.includes('googleapis'))!
  assert.equal((call.body!.generationConfig as Record<string, unknown>).responseMimeType, undefined)
})

test('Gemini rate limit (429) → friendly busy message', async () => {
  const net = fakeFetch({ gemini: [{ status: 429, body: { error: { message: 'quota' } } }] })
  const res = await handleAiRequest(post({ action: 'extract', notes: 'futsal friday 8pm' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 429)
  assert.match((await res.json()).error, /wait a minute/)
})

test('announce: loads the event, returns 3 languages, strips invented links', async () => {
  const net = fakeFetch({
    event: [{
      title: 'EMSU Futsal Night', category: 'Sports', event_date: '2099-01-02', start_time: '20:00:00',
      end_time: null, location: 'ERICA Sports Complex', description: '', bring: 'Water', notes: '',
      capacity: 20, rsvp_deadline: null,
    }],
    gemini: [gemini(JSON.stringify({
      en: 'Futsal Friday at 20:00! Sign up: https://evil.example',
      ms: 'Jom futsal Jumaat ni pukul 8 malam!',
      ko: '이번 주 금요일 저녁 8시에 풋살해요!',
    }))],
  })
  const res = await handleAiRequest(post({ action: 'announce', eventId: EVENT_ID, tone: 'formal' }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.tone, 'formal')
  assert.ok(!data.announcements.en.includes('http'))
  assert.match(data.announcements.ko, /[가-힣]/)

  const prompt = JSON.stringify(net.calls.find((c) => c.url.includes('googleapis'))!.body)
  assert.ok(prompt.includes('ERICA Sports Complex'))
  assert.ok(prompt.includes('Friday'), 'weekday is given to the model')
})

test('announce: event the organizer cannot see → 404', async () => {
  const net = fakeFetch({ event: [] })
  const res = await handleAiRequest(post({ action: 'announce', eventId: EVENT_ID }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 404)
})

test('announce: AI leaves out a language → error, nothing returned', async () => {
  const net = fakeFetch({
    event: [{ title: 'X Event', category: 'Social', event_date: '2099-01-02', start_time: '20:00:00', end_time: null, location: 'Hall', description: '', bring: '', notes: '', capacity: null, rsvp_deadline: null }],
    gemini: [gemini('{"en":"Hello","ms":"","ko":"안녕하세요"}')],
  })
  const res = await handleAiRequest(post({ action: 'announce', eventId: EVENT_ID }), { env: ENV, fetchImpl: net.impl })
  assert.equal(res.status, 502)
})

// ---------- cleaning the AI output ----------

test('normalizeExtract fixes or drops bad values', () => {
  const r = normalizeExtract({
    title: 'Hi',
    category: 'Party',
    event_date: '2026-02-30',
    start_time: '8pm',
    end_time: '07:00',
    location: '  Hall  ',
    capacity: -5,
    rsvp_deadline: '2099-12-31',
    missing: ['banana'],
  }, '2026-11-02')
  assert.equal(r.event.title, '')
  assert.equal(r.event.category, 'Social')
  assert.equal(r.event.event_date, null)
  assert.equal(r.event.start_time, null)
  assert.equal(r.event.location, 'Hall')
  assert.equal(r.event.capacity, null)
  assert.deepEqual(r.missing, ['title', 'event_date', 'start_time'])
  assert.ok(r.warnings.some((w) => w.includes('unreadable date')))
})

test('normalizeExtract: deadline after event and end before start are dropped', () => {
  const r = normalizeExtract({
    title: 'Dinner Night', category: 'Social', event_date: '2026-11-10', start_time: '19:00',
    end_time: '18:00', location: 'Hall', capacity: '30', rsvp_deadline: '2026-11-12',
  }, '2026-11-02')
  assert.equal(r.event.end_time, null)
  assert.equal(r.event.rsvp_deadline, null)
  assert.equal(r.event.capacity, 30)
  assert.equal(r.warnings.length, 2)
})

test('normalizeExtract warns about past dates', () => {
  const r = normalizeExtract({ title: 'Old Event', category: 'Social', event_date: '2026-01-01', start_time: '10:00', location: 'X' }, '2026-11-02')
  assert.ok(r.warnings.some((w) => w.includes('in the past')))
})

test('parseJsonObject handles fences and chatter, rejects junk', () => {
  assert.deepEqual(parseJsonObject('Sure! ```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(parseJsonObject('Here: {"a": {"b": 2}} done'), { a: { b: 2 } })
  assert.throws(() => parseJsonObject('no json here'))
  assert.throws(() => parseJsonObject('[1,2,3]'))
})

test('extract prompt tells the model today\'s date and weekday', () => {
  const { system } = extractPrompts('futsal friday', '2026-11-02')
  assert.ok(system.includes('Monday, 2026-11-02'))
})
