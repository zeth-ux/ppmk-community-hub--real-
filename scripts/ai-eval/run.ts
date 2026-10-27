// =====================================================================
// AI test set runner: scores one or more models on scripts/ai-eval/cases.json
//
//   npm run ai:eval                                   (model from GEMINI_MODEL / default)
//   npm run ai:eval -- gemini-3.5-flash-lite gemma-4-26b-a4b-it
//   npm run ai:eval -- --only=extract gemini-3.8-flash
//
// Needs GEMINI_API_KEY in .env.local. Writes a Markdown report to
// scripts/ai-eval/results/ that you can paste into the course report.
// =====================================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  AiError,
  DEFAULT_MODEL,
  extractEvent,
  writeAnnouncements,
  type Announcements,
  type EventForAnnouncement,
  type ExtractResult,
} from '../../api/ai.ts'

const here = dirname(fileURLToPath(import.meta.url))

type Expect = {
  event_date?: string | null
  start_time?: string | null
  end_time?: string | null
  capacity?: number | null
  rsvp_deadline?: string | null
  category?: string
  location_any?: string[]
  location_empty?: boolean
  bring_any?: string[]
  notes_any?: string[]
  title_not_any?: string[]
}

type ExtractCase = { id: string; lang: string; notes: string; expect: Expect }
type AnnounceCase = { id: string; event: EventForAnnouncement; location_key: string }

const cases = JSON.parse(readFileSync(join(here, 'cases.json'), 'utf8')) as {
  today: string
  extract: ExtractCase[]
  announce: AnnounceCase[]
}

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing. Add it to .env.local (see SETUP.md).')
  process.exit(1)
}

const args = process.argv.slice(2)
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1]
const models = args.filter((a) => !a.startsWith('--'))
if (models.length === 0) models.push(process.env.GEMINI_MODEL || DEFAULT_MODEL)
const delayMs = Number(process.env.AI_EVAL_DELAY_MS ?? 4500)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Calls fn, waiting and retrying when the free-tier rate limit is hit. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof AiError && err.code === 'AI_BUSY' && attempt < 4) {
        process.stdout.write(` (rate limited, waiting ${20 * attempt}s)`)
        await sleep(20_000 * attempt)
        continue
      }
      throw err
    }
  }
}

// ---------- scoring: extraction ----------

const EXACT_FIELDS = ['event_date', 'start_time', 'end_time', 'capacity', 'rsvp_deadline', 'category'] as const
const NULLABLE = new Set(['event_date', 'start_time', 'end_time', 'capacity', 'rsvp_deadline'])

type Check = { field: string; ok: boolean; expected: string; got: string; invented?: boolean }

const has = (value: string, words: string[]) => words.some((w) => value.toLowerCase().includes(w.toLowerCase()))
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '∅' : String(v))

function scoreExtract(c: ExtractCase, r: ExtractResult): Check[] {
  const checks: Check[] = []
  const e = r.event as unknown as Record<string, unknown>

  for (const field of EXACT_FIELDS) {
    if (!(field in c.expect)) continue
    const expected = c.expect[field]
    const got = e[field] ?? null
    const ok = expected === null ? got === null : String(got) === String(expected)
    checks.push({
      field,
      ok,
      expected: show(expected),
      got: show(got),
      invented: NULLABLE.has(field) && expected === null && got !== null,
    })
  }

  const loc = String(e.location ?? '')
  if (c.expect.location_any) {
    checks.push({ field: 'location', ok: has(loc, c.expect.location_any), expected: c.expect.location_any.join(' / '), got: show(loc) })
  }
  if (c.expect.location_empty) {
    checks.push({ field: 'location', ok: loc === '', expected: '∅', got: show(loc), invented: loc !== '' })
  }
  if (c.expect.bring_any) {
    const bring = String(e.bring ?? '')
    checks.push({ field: 'bring', ok: has(bring, c.expect.bring_any), expected: c.expect.bring_any.join(' / '), got: show(bring) })
  }
  if (c.expect.notes_any) {
    const notes = `${e.notes ?? ''} ${e.description ?? ''}`
    checks.push({ field: 'notes', ok: has(notes, c.expect.notes_any), expected: c.expect.notes_any.join(' / '), got: show(e.notes) })
  }
  if (c.expect.title_not_any) {
    const title = String(e.title ?? '')
    checks.push({ field: 'title', ok: !has(title, c.expect.title_not_any), expected: `not "${c.expect.title_not_any.join('/')}"`, got: show(title) })
  }
  return checks
}

// ---------- scoring: announcements ----------

const HANGUL = /[가-힣]/
const MALAY_MARKERS = /\b(jom|korang|semua|jangan|untuk|dan|di|pada|akan|kita|anda)\b/i
const INDONESIAN_MARKERS = /\b(kamu|acara|kegiatan|silakan|teman-teman)\b/i
const MONEY = /(\bRM\s?\d|₩|\d[\d,]*\s?(won|원)\b|\bfree (food|meal|makan)|\bpercuma\b|무료)/i

function mentionsHour(textOut: string, time: string) {
  const h24 = Number(time.slice(0, 2))
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return new RegExp(`(^|\\D)(${h24}|${String(h24).padStart(2, '0')}|${h12})(\\D|$)`).test(textOut)
}

function scoreAnnounce(c: AnnounceCase, a: Announcements): Check[] {
  const checks: Check[] = []
  const factsHaveMoney = MONEY.test(`${c.event.notes} ${c.event.description}`)
  const day = Number(c.event.event_date.slice(8, 10))
  const mentionsDay = (t: string) => new RegExp(`(^|\\D)${day}(\\D|$)`).test(t)

  checks.push({ field: 'ko is Korean', ok: HANGUL.test(a.ko), expected: 'Hangul', got: a.ko.slice(0, 30) })
  checks.push({ field: 'ms is Malay', ok: MALAY_MARKERS.test(a.ms), expected: 'Malay words', got: a.ms.slice(0, 30) })
  checks.push({ field: 'ms not Indonesian', ok: !INDONESIAN_MARKERS.test(a.ms), expected: 'no kamu/acara/kegiatan', got: (a.ms.match(INDONESIAN_MARKERS) ?? ['ok'])[0] })

  for (const lang of ['en', 'ms', 'ko'] as const) {
    const t = a[lang]
    checks.push({ field: `${lang} has time`, ok: mentionsHour(t, c.event.start_time), expected: c.event.start_time.slice(0, 5), got: t.slice(0, 40) })
    checks.push({ field: `${lang} has date`, ok: mentionsDay(t), expected: String(day), got: t.slice(0, 40) })
    checks.push({ field: `${lang} no invented money`, ok: factsHaveMoney || !MONEY.test(t), expected: 'none', got: (t.match(MONEY) ?? ['ok'])[0], invented: !factsHaveMoney && MONEY.test(t) })
    checks.push({ field: `${lang} no link`, ok: !/https?:\/\//.test(t), expected: 'none', got: 'checked' })
  }
  for (const lang of ['en', 'ms'] as const) {
    checks.push({ field: `${lang} has place`, ok: has(a[lang], [c.location_key]), expected: c.location_key, got: a[lang].slice(0, 40) })
  }
  return checks
}

// ---------- run ----------

type ModelReport = {
  model: string
  extract: { id: string; lang: string; checks: Check[]; error?: string; ms: number }[]
  announce: { id: string; checks: Check[]; error?: string; ms: number; sample?: Announcements }[]
}

async function evaluate(model: string): Promise<ModelReport> {
  const report: ModelReport = { model, extract: [], announce: [] }

  if (only !== 'announce') {
    console.log(`\n▶ ${model}: extraction (${cases.extract.length} cases)`)
    for (const c of cases.extract) {
      process.stdout.write(`  ${c.id.padEnd(28)}`)
      const t0 = Date.now()
      try {
        const r = await withRetry(() => extractEvent({ notes: c.notes, today: cases.today, model, apiKey: apiKey! }))
        const checks = scoreExtract(c, r)
        const ms = Date.now() - t0
        report.extract.push({ id: c.id, lang: c.lang, checks, ms })
        const bad = checks.filter((x) => !x.ok)
        console.log(bad.length ? `✗ ${bad.map((b) => `${b.field}: ${b.got} (want ${b.expected})`).join('; ')}` : '✓')
      } catch (err) {
        report.extract.push({ id: c.id, lang: c.lang, checks: [], error: (err as Error).message, ms: Date.now() - t0 })
        console.log(`ERROR ${(err as Error).message}`)
      }
      await sleep(delayMs)
    }
  }

  if (only !== 'extract') {
    console.log(`\n▶ ${model}: announcements (${cases.announce.length} events × 3 languages)`)
    for (const c of cases.announce) {
      process.stdout.write(`  ${c.id.padEnd(28)}`)
      const t0 = Date.now()
      try {
        const a = await withRetry(() => writeAnnouncements({ event: c.event, tone: 'friendly', model, apiKey: apiKey! }))
        const checks = scoreAnnounce(c, { ...a } as Announcements)
        report.announce.push({ id: c.id, checks, ms: Date.now() - t0, sample: a as Announcements })
        const bad = checks.filter((x) => !x.ok)
        console.log(bad.length ? `✗ ${bad.map((b) => b.field).join('; ')}` : '✓')
      } catch (err) {
        report.announce.push({ id: c.id, checks: [], error: (err as Error).message, ms: Date.now() - t0 })
        console.log(`ERROR ${(err as Error).message}`)
      }
      await sleep(delayMs)
    }
  }
  return report
}

function pct(n: number, d: number) {
  return d ? `${Math.round((100 * n) / d)}%` : 'n/a'
}

function summarize(r: ModelReport) {
  const ex = r.extract
  const exChecks = ex.flatMap((c) => c.checks)
  const an = r.announce
  const anChecks = an.flatMap((c) => c.checks)
  const avg = (xs: { ms: number }[]) => (xs.length ? `${(xs.reduce((s, x) => s + x.ms, 0) / xs.length / 1000).toFixed(1)}s` : 'n/a')
  return {
    model: r.model,
    fieldAccuracy: pct(exChecks.filter((c) => c.ok).length, exChecks.length),
    perfectCases: `${ex.filter((c) => !c.error && c.checks.every((x) => x.ok)).length}/${ex.length}`,
    dates: pct(exChecks.filter((c) => c.field === 'event_date' && c.ok).length, exChecks.filter((c) => c.field === 'event_date').length),
    inventions: exChecks.filter((c) => c.invented).length,
    extractErrors: ex.filter((c) => c.error).length,
    extractLatency: avg(ex),
    announceChecks: pct(anChecks.filter((c) => c.ok).length, anChecks.length),
    announceInventions: anChecks.filter((c) => c.invented).length,
    announceErrors: an.filter((c) => c.error).length,
    announceLatency: avg(an),
  }
}

function markdown(reports: ModelReport[]) {
  const stamp = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Seoul' })
  const lines: string[] = [
    `# AI test set results`,
    ``,
    `Run: ${stamp} (KST) · fixed "today": ${cases.today} · ${cases.extract.length} extraction cases, ${cases.announce.length} announcement cases`,
    ``,
    `## Summary`,
    ``,
    `| Model | Field accuracy | Perfect cases | Dates right | Invented details | Errors | Avg time | Announcement checks | Invented in announcements | Avg time |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
  ]
  for (const r of reports) {
    const s = summarize(r)
    lines.push(`| \`${s.model}\` | ${s.fieldAccuracy} | ${s.perfectCases} | ${s.dates} | ${s.inventions} | ${s.extractErrors + s.announceErrors} | ${s.extractLatency} | ${s.announceChecks} | ${s.announceInventions} | ${s.announceLatency} |`)
  }
  lines.push(
    ``,
    `*Field accuracy* = share of all checked fields that were right. *Perfect cases* = notes where every field was right. *Invented details* = the AI filled in something that was not in the notes (should be 0).`,
    ``,
  )

  for (const r of reports) {
    lines.push(`## \`${r.model}\`: extraction details`, ``, `| Case | Lang | Result | Problems |`, `|---|---|---|---|`)
    for (const c of r.extract) {
      const bad = c.checks.filter((x) => !x.ok)
      const result = c.error ? 'error' : bad.length ? `${c.checks.length - bad.length}/${c.checks.length}` : '✓'
      const problems = c.error ?? bad.map((b) => `${b.field}: got ${b.got}, want ${b.expected}${b.invented ? ' **(invented)**' : ''}`).join('<br>')
      lines.push(`| ${c.id} | ${c.lang} | ${result} | ${problems.replace(/\|/g, '/')} |`)
    }
    if (r.announce.length) {
      lines.push(``, `## \`${r.model}\`: announcement details`, ``, `| Event | Result | Problems |`, `|---|---|---|`)
      for (const c of r.announce) {
        const bad = c.checks.filter((x) => !x.ok)
        lines.push(`| ${c.id} | ${c.error ? 'error' : `${c.checks.length - bad.length}/${c.checks.length}`} | ${(c.error ?? bad.map((b) => b.field).join(', ')).replace(/\|/g, '/')} |`)
      }
      const sample = r.announce.find((c) => c.sample)?.sample
      if (sample) {
        lines.push(``, `### Sample output (${r.announce.find((c) => c.sample)!.id})`, ``)
        for (const lang of ['en', 'ms', 'ko'] as const) lines.push(`**${lang}**`, '', '```', sample[lang], '```', '')
      }
    }
    lines.push(``)
  }
  return lines.join('\n')
}

const reports: ModelReport[] = []
for (const model of models) reports.push(await evaluate(model))

console.log('\n=== Summary ===')
console.table(reports.map(summarize))

const outDir = join(here, 'results')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}_${models.join('_vs_')}.md`)
writeFileSync(file, markdown(reports))
console.log(`\nReport saved: ${file}`)
