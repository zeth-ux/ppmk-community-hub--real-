// =====================================================================
// GET /api/reminders: "your event is tomorrow" emails (runs on Vercel)
//
// Vercel calls this once a day (vercel.json → crons, 00:00 UTC = 09:00
// Korea time). It asks the database who has an event TOMORROW (going or
// maybe, reminders on, not reminded yet), emails each person from the
// shared EMSU Gmail, and records that they were reminded.
//
// Environment variables (Vercel → Settings → Environment Variables):
//   CRON_SECRET         long random secret (`npm run reminders:secret`).
//                       Vercel sends it with every scheduled call; the
//                       database only answers when it matches.
//   GMAIL_USER          the shared EMSU Gmail address
//   GMAIL_APP_PASSWORD  its 16-character app password
//   APP_URL             optional, e.g. https://ppmk-community-hub-real.vercel.app
//
// Without GMAIL_USER / GMAIL_APP_PASSWORD it runs in TEST MODE: it reports
// how many emails it WOULD send and sends nothing. `?dry=1` does the same.
// The response never contains names or email addresses.
//
// No service_role key: the database checks CRON_SECRET itself (0009).
// No local imports, so the unit tests can import it as-is.
// =====================================================================

import nodemailer from 'nodemailer'

export type DueReminder = {
  event_id: string
  user_id: string
  email: string
  full_name: string | null
  status: 'attending' | 'maybe'
  title: string
  event_date: string // YYYY-MM-DD
  start_time: string // HH:MM:SS
  end_time: string | null
  location: string
  bring: string
}

export type Email = { to: string; subject: string; text: string; html: string }

export type RunResult = {
  testMode: boolean
  due: number
  sent: number
  failed: number
  events: number
}

type Env = {
  supabaseUrl?: string
  supabaseAnonKey?: string
  cronSecret?: string
  gmailUser?: string
  gmailPassword?: string
  appUrl: string
}

export function readEnv(): Env {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    cronSecret: process.env.CRON_SECRET,
    gmailUser: process.env.GMAIL_USER,
    gmailPassword: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ''),
    appUrl: (process.env.APP_URL || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:5173')).replace(/\/$/, ''),
  }
}

// ---------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------

const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ').trim()

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export function niceDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

export function timeRange(start: string, end: string | null): string {
  return end ? `${start.slice(0, 5)}–${end.slice(0, 5)}` : start.slice(0, 5)
}

export function buildReminderEmail(r: DueReminder, appUrl: string): Email {
  const title = oneLine(r.title)
  const name = oneLine(r.full_name ?? '').split(' ')[0] || 'there'
  const when = `${niceDate(r.event_date)}, ${timeRange(r.start_time, r.end_time)}`
  const link = `${appUrl}/events/${r.event_id}`
  const answer = r.status === 'attending' ? "you're going" : 'you said maybe'

  const lines = [
    `Hi ${name},`,
    '',
    `Just a reminder: ${title} is tomorrow and ${answer}.`,
    '',
    `When:  ${when}`,
    `Where: ${oneLine(r.location)}`,
    ...(r.bring.trim() ? [`Bring: ${oneLine(r.bring)}`] : []),
    '',
    `Your check-in QR code is on the event page: ${link}`,
    r.status === 'attending'
      ? "Can't make it any more? Change your answer there so someone else can take your place."
      : 'Decided yet? Tap "I\'m going" or "Can\'t go" on the event page so the organizers can plan.',
    '',
    'See you there!',
    'PPMK Community Hub',
    '',
    `You get this because you RSVP'd. To stop reminder emails, turn them off on ${appUrl}/me`,
  ]

  const row = (label: string, value: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#64748b">${label}</td><td style="padding:2px 0"><strong>${escapeHtml(value)}</strong></td></tr>`

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f172a;max-width:520px">
<p>Hi ${escapeHtml(name)},</p>
<p>Just a reminder: <strong>${escapeHtml(title)}</strong> is <strong>tomorrow</strong> and ${answer}.</p>
<table style="border-collapse:collapse;margin:12px 0">
${row('When', when)}
${row('Where', oneLine(r.location))}
${r.bring.trim() ? row('Bring', oneLine(r.bring)) : ''}
</table>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ac0024;color:#fff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">Open the event &amp; check-in QR</a></p>
<p style="color:#475569">${
    r.status === 'attending'
      ? "Can't make it any more? Change your answer on the event page so someone else can take your place."
      : 'Decided yet? Tap “I’m going” or “Can’t go” on the event page so the organizers can plan.'
  }</p>
<p>See you there!<br>PPMK Community Hub</p>
<p style="font-size:12px;color:#94a3b8">You get this because you RSVP'd. To stop reminder emails, turn them off on <a href="${escapeHtml(appUrl)}/me" style="color:#94a3b8">your Me page</a>.</p>
</div>`

  return {
    to: r.email,
    subject: `Reminder: ${title} is tomorrow (${timeRange(r.start_time, r.end_time).split('–')[0]})`,
    text: lines.join('\n'),
    html,
  }
}

// ---------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------

type Deps = {
  env: Env
  fetchImpl?: typeof fetch
  /** Sends one email. Missing → test mode (nothing is sent). */
  send?: (email: Email) => Promise<void>
}

async function rpc<T>(env: Env, fetchImpl: typeof fetch, name: string, body: object): Promise<T> {
  const res = await fetchImpl(`${env.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey!,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Database call ${name} failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function runReminders({ env, fetchImpl = fetch, send }: Deps): Promise<RunResult> {
  const due = await rpc<DueReminder[]>(env, fetchImpl, 'reminders_due', { p_secret: env.cronSecret })
  const result: RunResult = {
    testMode: !send,
    due: due.length,
    sent: 0,
    failed: 0,
    events: new Set(due.map((r) => r.event_id)).size,
  }
  if (!send) return result

  for (const reminder of due) {
    try {
      await send(buildReminderEmail(reminder, env.appUrl))
      // Record each one straight away: if the job stops half-way, a re-run
      // only emails the people who haven't had theirs yet.
      await rpc(env, fetchImpl, 'mark_reminded', {
        p_secret: env.cronSecret,
        p_event_id: reminder.event_id,
        p_user_id: reminder.user_id,
      })
      result.sent += 1
    } catch (error) {
      result.failed += 1
      // Log the event, never the person.
      console.error(`Reminder for event ${reminder.event_id} failed:`, error instanceof Error ? error.message : error)
    }
  }
  return result
}

function gmailSender(env: Env) {
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    pool: true,
    maxConnections: 1,
    auth: { user: env.gmailUser, pass: env.gmailPassword },
  })
  return async (email: Email) => {
    await transport.sendMail({ from: { name: 'PPMK Community Hub', address: env.gmailUser! }, ...email })
  }
}

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Handler with injectable pieces, for the unit tests. */
export async function handleRemindersRequest(request: Request, deps: Partial<Deps> = {}): Promise<Response> {
  const env = deps.env ?? readEnv()

  if (!env.cronSecret || env.cronSecret.length < 32) {
    return json(500, { error: 'CRON_SECRET is not set up. See SETUP.md → Reminder emails.' })
  }
  if (request.headers.get('authorization') !== `Bearer ${env.cronSecret}`) {
    return json(401, { error: 'Not allowed.' })
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return json(500, { error: 'Supabase settings are missing.' })
  }

  const dry = new URL(request.url).searchParams.get('dry') === '1'
  const canSend = Boolean(env.gmailUser && env.gmailPassword)
  const send = dry || !canSend ? undefined : (deps.send ?? gmailSender(env))

  try {
    const result = await runReminders({ env, fetchImpl: deps.fetchImpl, send })
    return json(200, {
      ...result,
      note: result.testMode
        ? canSend
          ? 'Test run (?dry=1): nothing was sent.'
          : 'Test mode: GMAIL_USER / GMAIL_APP_PASSWORD are not set, so nothing was sent.'
        : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Reminder job failed:', message)
    return json(500, {
      error: message.includes('NOT_ALLOWED')
        ? 'The database refused the secret. Re-run the SQL from `npm run reminders:secret`.'
        : message.includes('reminders_due')
          ? 'Reminder database setup missing or failed. Run supabase/migrations/0009_event_reminders.sql.'
          : 'Reminder job failed. See the Vercel logs.',
    })
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleRemindersRequest(request)
}
