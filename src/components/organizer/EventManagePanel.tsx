import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  DoorOpen,
  Download,
  ExternalLink,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { deleteEvent, listAttendees, setCheckIn } from '../../lib/api'
import {
  STATUS_STYLE,
  eventTimeRange,
  formatDate,
  friendlyError,
  rsvpDeadline,
  statusLabel,
  todayKst,
} from '../../lib/format'
import type { Attendee, HubEvent, RsvpStatus } from '../../lib/types'
import { useLoader } from '../../lib/useLoader'
import { ErrorBox, Spinner, buttonPrimary, buttonSecondary, card } from '../ui'
import FeedbackPanel from './FeedbackPanel'
import ShowUpPanel from './ShowUpPanel'
import SharePanel from './SharePanel'

type Filter = 'all' | RsvpStatus

/** A cell that Excel and Google Sheets must keep as text. */
type TextCell = { keepAsText: string }

/**
 * Excel reads "01044877101" as a number and drops the 0. Digits-only phones are
 * written as ="01044877101" so the 0 stays. Only digits go in, so the formula
 * can't run anything.
 */
function phoneCell(phone: string | null | undefined): string | TextCell {
  const text = String(phone ?? '').trim()
  return /^\d+$/.test(text) ? { keepAsText: text } : text
}

function toCsv(event: HubEvent, rows: Attendee[]): string {
  const header = [
    'Name', 'Student ID', 'Batch', 'Course', 'Residence', 'Phone', 'Email',
    'RSVP', 'Comment', 'Responded at', 'Checked in at',
  ]
  const body = rows.map((a) => [
    a.full_name, a.student_id, a.batch, a.course, a.residence, phoneCell(a.phone), a.email,
    statusLabel(a.status), a.comment,
    new Date(a.responded_at).toLocaleString('en-GB', { timeZone: 'Asia/Seoul' }),
    a.checked_in_at
      ? new Date(a.checked_in_at).toLocaleString('en-GB', { timeZone: 'Asia/Seoul' })
      : '',
  ])
  const escape = (value: unknown) => {
    if (value && typeof value === 'object' && 'keepAsText' in value) {
      return `"=""${(value as TextCell).keepAsText}"""`
    }
    let text = String(value ?? '')
    // Stop spreadsheet apps from treating a cell as a formula.
    if (/^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const title = `${event.title} (${event.event_date})`
  return [[title], header, ...body].map((row) => row.map(escape).join(',')).join('\r\n')
}

function download(filename: string, content: string) {
  // The BOM makes Excel open Korean/Malay characters correctly.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function EventManagePanel({
  event,
  onEdit,
  onDeleted,
  onChanged,
}: {
  event: HubEvent
  onEdit: () => void
  onDeleted: () => void
  onChanged: () => void
}) {
  const { t } = useLanguage()
  const { profile, isAdmin } = useAuth()
  // Same rule as the database: only the event's creator (or an admin) checks people in.
  const canCheckIn = isAdmin || (event.created_by !== null && event.created_by === profile?.id)
  const { data: attendees, setData, loading, error } = useLoader(
    () => listAttendees(event.id),
    [event.id],
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState('')

  const counts = useMemo(() => {
    const rows = attendees ?? []
    return {
      all: rows.length,
      attending: rows.filter((a) => a.status === 'attending').length,
      maybe: rows.filter((a) => a.status === 'maybe').length,
      not_attending: rows.filter((a) => a.status === 'not_attending').length,
      checkedIn: rows.filter((a) => a.checked_in_at).length,
    }
  }, [attendees])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (attendees ?? []).filter(
      (a) =>
        (filter === 'all' || a.status === filter) &&
        (!q ||
          (a.full_name ?? '').toLowerCase().includes(q) ||
          (a.student_id ?? '').toLowerCase().includes(q)),
    )
  }, [attendees, filter, search])

  async function toggleCheckIn(attendee: Attendee) {
    setActionError('')
    try {
      const at = await setCheckIn(event.id, attendee.user_id, !attendee.checked_in_at)
      setData(
        (attendees ?? []).map((a) =>
          a.user_id === attendee.user_id ? { ...a, checked_in_at: at } : a,
        ),
      )
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  async function handleDelete() {
    const sure = window.confirm(
      `Delete "${event.title}"? All ${counts.all} RSVPs for it will be deleted too.`,
    )
    if (!sure) return
    try {
      await deleteEvent(event.id)
      onDeleted()
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  const fileName = `${event.event_date}-${event.title.replace(/[^\w]+/g, '-').toLowerCase()}.csv`

  return (
    <div className="space-y-5">
      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-primary">{event.category}</p>
            <h2 className="mt-1 text-xl font-bold">{event.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(event.event_date, 'long')} · {eventTimeRange(event)} · {event.location}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              For:{' '}
              {event.audience === 'everyone'
                ? 'everyone'
                : event.audience === 'batch'
                  ? `batch ${event.audience_batches.join(', ')}`
                  : 'invited people only'}
              {' · '}RSVP by {formatDate(rsvpDeadline(event))}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to={`/events/${event.id}`} className={buttonSecondary}>
              <ExternalLink size={16} />
              View
            </Link>
            <button onClick={onEdit} className={buttonSecondary}>
              <Pencil size={16} />
              Edit
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Going" value={counts.attending} extra={event.capacity ? `/ ${event.capacity}` : ''} />
          <Stat label="Maybe" value={counts.maybe} />
          <Stat label="Can't go" value={counts.not_attending} />
          <Stat label="Checked in" value={counts.checkedIn} />
        </div>

        {canCheckIn && event.event_date >= todayKst() && (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">{t('door.openHint')}</p>
            <Link to={`/organizer/door/${event.id}`} className={`${buttonPrimary} shrink-0`}>
              <DoorOpen size={16} />
              {t('door.open')}
            </Link>
          </div>
        )}
      </section>

      {event.event_date <= todayKst() && <ShowUpPanel eventId={event.id} refreshKey={counts.checkedIn} />}

      <SharePanel event={event} onSaved={onChanged} />

      {event.event_date <= todayKst() && <FeedbackPanel eventId={event.id} going={counts.attending} />}

      <section className={`${card} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">Responses</h3>
          <button
            onClick={() => attendees && download(fileName, toCsv(event, visible))}
            disabled={!visible.length}
            className={buttonSecondary}
          >
            <Download size={16} />
            Export CSV ({visible.length})
          </button>
        </div>

        <p className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
          <Camera size={16} className="mt-0.5 shrink-0 text-primary" />
          {canCheckIn ? (
            <span>
              <strong>{t('checkin.doorTitle')}</strong> {t('checkin.doorBody')}
            </span>
          ) : (
            <span>{t('checkin.creatorOnly')}</span>
          )}
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or student ID"
              aria-label="Search responses"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {(['all', 'attending', 'maybe', 'not_attending'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${
                  filter === f ? 'bg-primary text-on-primary' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f === 'all' ? 'All' : statusLabel(f)} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <ErrorBox>{error || actionError}</ErrorBox>
        </div>

        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {counts.all === 0 ? 'No responses yet. Share the link!' : 'Nobody matches this filter.'}
          </p>
        ) : (
          <div className="-mx-5 mt-3 overflow-x-auto sm:-mx-6">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 sm:px-6">Name</th>
                  <th className="px-3 py-3">Student ID</th>
                  <th className="px-3 py-3">Batch</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">RSVP</th>
                  <th className="px-3 py-3">Note</th>
                  <th className="px-5 py-3 text-right sm:px-6">Arrived</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((a) => (
                  <tr key={a.user_id}>
                    <td className="px-5 py-3 font-semibold sm:px-6">
                      {a.full_name}
                      <span className="block text-xs font-normal text-slate-400">{a.course}</span>
                    </td>
                    <td className="px-3 py-3">{a.student_id}</td>
                    <td className="px-3 py-3">{a.batch}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <a href={`tel:${a.phone}`} className="hover:text-primary">{a.phone}</a>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[a.status]}`}>
                        {statusLabel(a.status)}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-slate-500">{a.comment}</td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      <button
                        onClick={() => void toggleCheckIn(a)}
                        aria-pressed={Boolean(a.checked_in_at)}
                        disabled={!canCheckIn}
                        title={canCheckIn ? undefined : t('checkin.creatorOnly')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                          a.checked_in_at
                            ? 'bg-green-600 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {a.checked_in_at ? '✓ Here' : 'Check in'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-red-100 bg-red-50 p-5">
        <h3 className="font-bold text-red-800">Delete this event</h3>
        <p className="mt-1 text-sm text-red-700">
          Removes the event and all its RSVPs for everyone. This can't be undone.
        </p>
        {/* Outlined, not filled: a filled red button with white text is hard to read in dark mode. */}
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 bg-surface px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          <Trash2 size={16} />
          Delete event
        </button>
      </section>
    </div>
  )
}

function Stat({ label, value, extra = '' }: { label: string; value: number; extra?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">
        {value}
        {extra && <span className="ml-1 text-sm font-medium text-slate-400">{extra}</span>}
      </p>
    </div>
  )
}
