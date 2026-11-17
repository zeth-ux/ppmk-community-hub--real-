import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, DoorOpen } from 'lucide-react'

import { useLanguage } from '../context/LanguageContext'
import { selfCheckIn } from '../lib/api'
import { friendlyError } from '../lib/format'
import type { SelfCheckInResult } from '../lib/types'
import { usePageMeta } from '../lib/usePageMeta'
import CodeInput from '../components/CodeInput'
import { ErrorBox, Spinner, buttonPrimary, buttonSecondary, card } from '../components/ui'

// One request per scanned code, even if the page renders twice (React dev
// mode) or the student goes back to it.
const tries = new Map<string, Promise<SelfCheckInResult>>()
function tryOnce(eventId: string, code: string) {
  const key = `${eventId}:${code}`
  if (!tries.has(key)) {
    const request = selfCheckIn(eventId, code)
    request.catch(() => tries.delete(key))
    tries.set(key, request)
  }
  return tries.get(key)!
}

const timeKst = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })

/**
 * Opened by scanning the QR on the organizer's door screen (or from
 * "At the door?" on the event page). Checks the signed-in student in.
 */
export default function HerePage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { t } = useLanguage()
  usePageMeta(t('here.pageTitle'))

  const scanned = (params.get('c') ?? '').replace(/\D/g, '').slice(0, 6)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(scanned.length === 6)
  const [result, setResult] = useState<SelfCheckInResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (scanned.length !== 6) return
    let cancelled = false
    tryOnce(id, scanned).then(
      (r) => !cancelled && setResult(r),
      (err: unknown) => !cancelled && setError(friendlyError(err)),
    ).finally(() => !cancelled && setBusy(false))
    return () => {
      cancelled = true
    }
  }, [id, scanned])

  async function submit(e?: FormEvent, value = code) {
    e?.preventDefault()
    if (value.length !== 6 || busy) return
    setBusy(true)
    setError('')
    try {
      setResult(await tryOnce(id, value))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
      setCode('')
    }
  }

  if (busy && !result) return <Spinner label={t('here.checking')} />

  if (result?.status === 'CHECKED_IN' || result?.status === 'ALREADY') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <section className={`${card} p-8 text-center`}>
          <CheckCircle2 size={64} className="mx-auto text-green-600" />
          <h1 className="mt-4 text-3xl font-black">{t('here.done')}</h1>
          <p className="mt-2 text-lg font-semibold">{t('here.welcome').replace('{title}', result.event_title)}</p>
          {result.status === 'ALREADY' && result.checked_in_at && (
            <p className="mt-2 text-sm text-slate-500">{t('here.already').replace('{time}', timeKst(result.checked_in_at))}</p>
          )}
          {result.status === 'CHECKED_IN' && result.walk_in && (
            <p className="mt-2 text-sm text-slate-500">{t('here.walkIn')}</p>
          )}
        </section>
        <Link to={`/events/${id}`} className={`${buttonSecondary} w-full`}>
          {t('here.openEvent')}
        </Link>
      </div>
    )
  }

  if (result?.status === 'TOO_MANY_TRIES') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <section className={`${card} p-6 text-center`}>
          <AlertTriangle size={40} className="mx-auto text-amber-500" />
          <p className="mt-3 font-semibold">{t('here.tooMany')}</p>
        </section>
        <Link to={`/events/${id}`} className={`${buttonSecondary} w-full`}>
          {t('here.openEvent')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <form onSubmit={(e) => void submit(e)} className={`${card} space-y-4 p-6`}>
        <div className="text-center">
          <DoorOpen size={36} className="mx-auto text-primary" />
          <h1 className="mt-3 text-2xl font-black">{t('here.pageTitle')}</h1>
        </div>
        {result?.status === 'BAD_CODE' && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{t('here.badCode')}</p>
        )}
        <ErrorBox>{error}</ErrorBox>
        <p className="text-sm font-semibold text-slate-600">{t('here.typeCode')}</p>
        <CodeInput value={code} onChange={setCode} onComplete={(v) => void submit(undefined, v)} disabled={busy} />
        <button type="submit" disabled={busy || code.length !== 6} className={`${buttonPrimary} w-full`}>
          {busy ? t('here.checking') : t('here.submit')}
        </button>
      </form>
      <Link to={`/events/${id}`} className={`${buttonSecondary} w-full`}>
        {t('here.openEvent')}
      </Link>
    </div>
  )
}
