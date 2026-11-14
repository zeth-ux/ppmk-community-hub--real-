// Unit tests for api/reminders.ts with a fake Supabase and a fake mailer.
// Run: npm run test:reminders
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReminderEmail,
  handleRemindersRequest,
  niceDate,
  timeRange,
  type DueReminder,
  type Email,
} from '../api/reminders.ts'

const SECRET = 's'.repeat(40)
const ENV = {
  supabaseUrl: 'https://db.test',
  supabaseAnonKey: 'anon',
  cronSecret: SECRET,
  gmailUser: 'emsu.hub@gmail.com',
  gmailPassword: 'apppassword',
  appUrl: 'https://hub.test',
}

const going: DueReminder = {
  event_id: 'e1',
  user_id: 'u1',
  email: 'aisyah@example.com',
  full_name: 'Aisyah Rahman',
  status: 'attending',
  title: 'Futsal Night',
  event_date: '2026-11-21',
  start_time: '20:00:00',
  end_time: '22:00:00',
  location: 'ERICA Sports Complex',
  bring: 'Indoor shoes',
}
const maybe: DueReminder = { ...going, user_id: 'u2', email: 'danial@example.com', full_name: 'Danial', status: 'maybe', bring: '' }

type Call = { name: string; body: Record<string, unknown> }

function fakeDb(due: DueReminder[], opts: { refuse?: boolean } = {}) {
  const calls: Call[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const name = String(url).split('/rpc/')[1]
    const body = JSON.parse(String(init?.body ?? '{}'))
    calls.push({ name, body })
    if (opts.refuse) return new Response('{"message":"NOT_ALLOWED"}', { status: 400 })
    if (name === 'reminders_due') return new Response(JSON.stringify(due), { status: 200 })
    return new Response(null, { status: 204 })
  }) as typeof fetch
  return { calls, fetchImpl }
}

const cronRequest = (path = '/api/reminders', secret = SECRET) =>
  new Request(`https://hub.test${path}`, { headers: { authorization: `Bearer ${secret}` } })

test('email says what, when, where, with the event link', () => {
  const email = buildReminderEmail(going, 'https://hub.test')
  assert.equal(email.to, 'aisyah@example.com')
  assert.equal(email.subject, 'Reminder: Futsal Night is tomorrow (20:00)')
  assert.match(email.text, /^Hi Aisyah,/)
  assert.match(email.text, /Saturday 21 November, 20:00–22:00/)
  assert.match(email.text, /ERICA Sports Complex/)
  assert.match(email.text, /Bring: Indoor shoes/)
  assert.match(email.text, /https:\/\/hub\.test\/events\/e1/)
  assert.match(email.text, /turn them off on https:\/\/hub\.test\/me/)
})

test('"maybe" people are asked to decide; no empty "Bring" line', () => {
  const email = buildReminderEmail(maybe, 'https://hub.test')
  assert.match(email.text, /you said maybe/)
  assert.match(email.text, /Decided yet\?/)
  assert.doesNotMatch(email.text, /Bring:/)
})

test('organizer text cannot inject HTML or extra email headers', () => {
  const email = buildReminderEmail(
    { ...going, title: 'Party\r\nBcc: everyone@x.com', location: '<script>alert(1)</script>' },
    'https://hub.test',
  )
  assert.doesNotMatch(email.subject, /[\r\n]/)
  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /&lt;script&gt;/)
})

test('dates and times read naturally', () => {
  assert.equal(niceDate('2026-11-06'), 'Friday 6 November')
  assert.equal(timeRange('09:30:00', null), '09:30')
})

test('refuses calls without the cron secret', async () => {
  const db = fakeDb([going])
  const res = await handleRemindersRequest(cronRequest('/api/reminders', 'wrong'), { env: ENV, fetchImpl: db.fetchImpl })
  assert.equal(res.status, 401)
  assert.equal(db.calls.length, 0)
})

test('explains a missing CRON_SECRET instead of running', async () => {
  const res = await handleRemindersRequest(cronRequest(), { env: { ...ENV, cronSecret: undefined } })
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /CRON_SECRET/)
})

test('sends each email, then marks that person reminded', async () => {
  const db = fakeDb([going, maybe])
  const sent: Email[] = []
  const res = await handleRemindersRequest(cronRequest(), {
    env: ENV,
    fetchImpl: db.fetchImpl,
    send: async (email) => void sent.push(email),
  })
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.deepEqual({ testMode: body.testMode, due: body.due, sent: body.sent, failed: body.failed, events: body.events },
    { testMode: false, due: 2, sent: 2, failed: 0, events: 1 })
  assert.deepEqual(sent.map((e) => e.to), ['aisyah@example.com', 'danial@example.com'])
  assert.deepEqual(db.calls.map((c) => c.name), ['reminders_due', 'mark_reminded', 'mark_reminded'])
  assert.equal(db.calls[0].body.p_secret, SECRET)
  assert.deepEqual(db.calls[1].body, { p_secret: SECRET, p_event_id: 'e1', p_user_id: 'u1' })
})

test('the response never contains names or email addresses', async () => {
  const db = fakeDb([going, maybe])
  const res = await handleRemindersRequest(cronRequest(), { env: ENV, fetchImpl: db.fetchImpl, send: async () => {} })
  const text = await res.text()
  assert.doesNotMatch(text, /aisyah|danial|@example\.com|Futsal/i)
})

test('a failed email is not marked, so it is not lost silently', async () => {
  const db = fakeDb([going, maybe])
  const res = await handleRemindersRequest(cronRequest(), {
    env: ENV,
    fetchImpl: db.fetchImpl,
    send: async (email) => {
      if (email.to.startsWith('aisyah')) throw new Error('SMTP down')
    },
  })
  const body = await res.json()
  assert.equal(body.sent, 1)
  assert.equal(body.failed, 1)
  assert.deepEqual(db.calls.filter((c) => c.name === 'mark_reminded').map((c) => c.body.p_user_id), ['u2'])
})

test('test mode when Gmail is not set up: counts, sends nothing, marks nothing', async () => {
  const db = fakeDb([going, maybe])
  let sends = 0
  const res = await handleRemindersRequest(cronRequest(), {
    env: { ...ENV, gmailUser: undefined, gmailPassword: undefined },
    fetchImpl: db.fetchImpl,
    send: async () => void sends++,
  })
  const body = await res.json()
  assert.equal(body.testMode, true)
  assert.equal(body.due, 2)
  assert.equal(body.sent, 0)
  assert.equal(sends, 0)
  assert.match(body.note, /GMAIL_USER/)
  assert.deepEqual(db.calls.map((c) => c.name), ['reminders_due'])
})

test('?dry=1 never sends, even with Gmail set up', async () => {
  const db = fakeDb([going])
  let sends = 0
  const res = await handleRemindersRequest(cronRequest('/api/reminders?dry=1'), {
    env: ENV,
    fetchImpl: db.fetchImpl,
    send: async () => void sends++,
  })
  const body = await res.json()
  assert.equal(body.testMode, true)
  assert.equal(sends, 0)
})

test('a wrong database secret gives a clear message', async () => {
  const db = fakeDb([], { refuse: true })
  const res = await handleRemindersRequest(cronRequest(), { env: ENV, fetchImpl: db.fetchImpl, send: async () => {} })
  assert.equal(res.status, 500)
  assert.match((await res.json()).error, /refused the secret/)
})
