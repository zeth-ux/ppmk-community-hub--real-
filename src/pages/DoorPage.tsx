import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Maximize, Timer, Users } from 'lucide-react'

import { useLanguage } from '../context/LanguageContext'
import { getDoorCode, getEvent, getShowUp } from '../lib/api'
import { appUrl, formatDate, friendlyError } from '../lib/format'
import type { DoorCode, HubEvent, ShowUp } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import QrCode from '../components/QrCode'
import { ErrorBox, Spinner, buttonSecondary } from '../components/ui'

/**
 * The organizer's door screen: one QR for the whole event. Students scan it
 * with their own phone and check themselves in (/here/:id). The code comes
 * from the database and changes every minute; this page fetches the next
 * one when the current one runs out, and shows how many people are in.
 */
export default function DoorPage() {
  const { id = '' } = useParams()
  const { t } = useLanguage()
  usePageMeta(t('door.pageTitle'))

  const [event, setEvent] = useState<HubEvent | null>(null)
  const [door, setDoor] = useState<DoorCode | null>(null)
  const [showUp, setShowUp] = useState<ShowUp | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState('')
  const [qrSize, setQrSize] = useState(() => qrSizeFor(window.innerWidth, window.innerHeight))

  // The event, once.
  useEffect(() => {
    getEvent(id).then(setEvent, (err: unknown) => setError(friendlyError(err)))
  }, [id])

  // The code: fetch, then fetch again when it runs out.
  const loadCode = useCallback(async () => {
    try {
      const next = await getDoorCode(id)
      setDoor(next)
      setSecondsLeft(next.seconds_left)
      setError('')
      return next.seconds_left
    } catch (err) {
      setError(friendlyError(err))
      return 10 // try again shortly (e.g. the phone lost signal)
    }
  }, [id])

  useEffect(() => {
    let timer: number | undefined
    let stopped = false
    const cycle = async () => {
      const wait = await loadCode()
      if (!stopped) timer = window.setTimeout(cycle, wait * 1000 + 500)
    }
    void cycle()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [loadCode])

  // Countdown shown under the code.
  useEffect(() => {
    const tick = window.setInterval(() => setSecondsLeft((s) => Math.max(s - 1, 0)), 1000)
    return () => window.clearInterval(tick)
  }, [])

  // How many are in, every 10 seconds.
  useEffect(() => {
    let stopped = false
    const load = () =>
      getShowUp(id).then(
        (s) => !stopped && setShowUp(s),
        () => undefined, // the counter is a nice-to-have; the QR matters
      )
    void load()
    const poll = window.setInterval(load, 10000)
    return () => {
      stopped = true
      window.clearInterval(poll)
    }
  }, [id])

  // Keep the phone screen on while the door screen is open (where supported).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const request = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
        lock = (await nav.wakeLock?.request('screen')) ?? null
      } catch {
        // Not supported or not allowed: the organizer keeps the screen on by hand.
      }
    }
    void request()
    const onVisible = () => document.visibilityState === 'visible' && void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const onResize = () => setQrSize(qrSizeFor(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function fullScreen() {
    document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  if (!door && error) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <ErrorBox>{error}</ErrorBox>
        <Link to={`/organizer?event=${id}`} className={buttonSecondary}>
          <ArrowLeft size={16} /> {t('door.back')}
        </Link>
      </div>
    )
  }
  if (!door) return <Spinner />

  const came = showUp ? showUp.came + showUp.walk_ins : null

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link to={`/organizer?event=${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-primary">
          <ArrowLeft size={16} /> {t('door.back')}
        </Link>
        {'requestFullscreen' in document.documentElement && (
          <button onClick={fullScreen} className={`${buttonSecondary} px-3 py-2 text-xs`}>
            <Maximize size={14} /> {t('door.fullscreen')}
          </button>
        )}
      </div>

      {!door.is_today && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {t('door.notToday').replace('{date}', formatDate(door.event_date, 'long'))}
        </p>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 text-center text-slate-900 shadow-sm sm:p-8">
        {event && <p className="text-sm font-semibold text-primary">{event.title}</p>}
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">{t('door.scanTitle')}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">{t('door.scanBody')}</p>

        <div className="mt-5 flex justify-center">
          <QrCode value={appUrl(`/here/${id}?c=${door.code}`)} size={qrSize} label={t('door.scanTitle')} />
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('door.orType')}</p>
        <p className="mt-1 font-mono text-5xl font-black tracking-[0.15em] tabular-nums sm:text-6xl" aria-live="polite">
          {door.code.slice(0, 3)} {door.code.slice(3)}
        </p>

        <div className="mx-auto mt-4 max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
              style={{ width: `${(secondsLeft / 60) * 100}%` }}
            />
          </div>
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-slate-500">
            <Timer size={12} /> {t('door.changesIn').replace('{s}', String(secondsLeft))}
          </p>
        </div>
      </section>

      {came !== null && showUp && (
        <section className="flex items-center justify-center gap-3 rounded-2xl bg-green-50 p-4 text-green-800">
          <Users size={22} />
          <p className="text-lg font-bold">
            {came} {t('door.checkedIn')}
            <span className="ml-2 text-sm font-medium text-green-700">
              · {t('door.ofGoing').replace('{n}', String(showUp.said_going))}
            </span>
          </p>
        </section>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}
      <p className="text-center text-xs leading-5 text-slate-500">{t('door.keepOpen')}</p>
    </div>
  )
}

/** As big as fits: room for the code and countdown below it. */
function qrSizeFor(width: number, height: number) {
  return Math.max(200, Math.min(width - 96, height - 360, 420))
}
