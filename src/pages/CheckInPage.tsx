import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Camera, CheckCircle2, ListChecks, Undo2 } from 'lucide-react'

import { useLanguage } from '../context/LanguageContext'
import { checkInByCode, setCheckIn } from '../lib/api'
import { formatDate, friendlyError, todayKst } from '../lib/format'
import type { CheckInResult } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import { usePageMeta } from '../lib/usePageMeta'
import { ErrorBox, Spinner, buttonSecondary, card } from '../components/ui'

// One request per scanned code, even if the page renders twice (React dev
// mode) or the organizer goes back to it: a repeat shows the same answer.
const scans = new Map<string, Promise<CheckInResult>>()
function scanOnce(code: string) {
  if (!scans.has(code)) {
    const request = checkInByCode(code)
    request.catch(() => scans.delete(code)) // allow a retry after an error
    scans.set(code, request)
  }
  return scans.get(code)!
}

const timeKst = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })

/**
 * What an organizer sees after scanning a student's check-in QR with the
 * phone camera. Opening the link is the check-in.
 */
export default function CheckInPage() {
  const { code = '' } = useParams()
  const { t } = useLanguage()
  usePageMeta(t('checkin.pageTitle'))
  const { data, error, loading } = useLoader(() => scanOnce(code), [code])
  const [undone, setUndone] = useState(false)
  const [undoError, setUndoError] = useState('')

  if (loading) return <Spinner label={t('checkin.checking')} />

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <ErrorBox>{error || t('checkin.error')}</ErrorBox>
        <ScanHelp />
      </div>
    )
  }

  const notToday = data.event_date !== todayKst()
  const notGoing = data.status !== 'attending'

  async function undo() {
    setUndoError('')
    try {
      await setCheckIn(data!.event_id, data!.user_id, false)
      scans.delete(code)
      setUndone(true)
    } catch (err) {
      setUndoError(friendlyError(err))
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section
        className={`${card} p-6 text-center ${
          undone ? '' : data.already_checked_in ? 'border-amber-300 bg-amber-50' : 'border-green-300 bg-green-50'
        }`}
        aria-live="polite"
      >
        {undone ? (
          <p className="text-lg font-bold">{t('checkin.undone')}</p>
        ) : (
          <>
            {data.already_checked_in ? (
              <AlertTriangle size={56} className="mx-auto text-amber-500" />
            ) : (
              <CheckCircle2 size={56} className="mx-auto text-green-600" />
            )}
            <p className={`mt-3 text-sm font-bold uppercase tracking-wide ${data.already_checked_in ? 'text-amber-700' : 'text-green-700'}`}>
              {data.already_checked_in ? t('checkin.already').replace('{time}', timeKst(data.checked_in_at)) : t('checkin.done')}
            </p>
          </>
        )}

        <p className="mt-2 text-2xl font-bold">{data.full_name ?? t('checkin.unknownName')}</p>
        <p className="mt-1 text-sm text-slate-600">
          {[
            data.student_id && t('checkin.studentId').replace('{id}', data.student_id),
            data.batch && t('checkin.batch').replace('{batch}', String(data.batch)),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          {data.event_title} · {formatDate(data.event_date)}
        </p>
      </section>

      {!undone && (notToday || notGoing) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {notToday && (
            <p>
              <strong>{t('checkin.checkEvent')}</strong>{' '}
              {t('checkin.notToday').replace('{title}', data.event_title).replace('{date}', formatDate(data.event_date))}
            </p>
          )}
          {notGoing && (
            <p className={notToday ? 'mt-2' : ''}>
              {t('checkin.rsvpSays').replace(
                '{status}',
                t(data.status === 'maybe' ? 'eventDetail.maybeOption' : 'eventDetail.cantGo'),
              )}
              {data.status === 'not_attending' ? ` ${t('checkin.checkedAnyway')}` : ''}
            </p>
          )}
        </div>
      )}

      <ErrorBox>{undoError}</ErrorBox>

      <div className="grid grid-cols-2 gap-2">
        <Link to={`/organizer?event=${data.event_id}`} className={buttonSecondary}>
          <ListChecks size={16} /> {t('checkin.attendeeList')}
        </Link>
        {!undone && !data.already_checked_in ? (
          <button onClick={() => void undo()} className={buttonSecondary}>
            <Undo2 size={16} /> {t('checkin.undo')}
          </button>
        ) : (
          <span />
        )}
      </div>

      <ScanHelp />
    </div>
  )
}

function ScanHelp() {
  const { t } = useLanguage()
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
      <Camera size={20} className="mt-0.5 shrink-0 text-primary" />
      <p>
        <strong>{t('checkin.nextTitle')}</strong> {t('checkin.nextBody')}
      </p>
    </div>
  )
}
