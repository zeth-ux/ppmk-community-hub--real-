import { useMemo, useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'

import {
  createEvent,
  getEventInvites,
  listClubs,
  listMembers,
  setEventInvites,
  updateEvent,
} from '../../lib/api'
import { friendlyError, todayKst } from '../../lib/format'
import {
  CATEGORIES,
  type Audience,
  type EventCategory,
  type EventInput,
  type HubEvent,
} from '../../lib/types'
import { useLoader } from '../../lib/useLoader'
import { ErrorBox, buttonPrimary, buttonSecondary, card, inputClass } from '../ui'
import type { AiExtractResult } from '../../lib/ai'
import AiFillBox from './AiFillBox'

type FormState = {
  title: string
  category: EventCategory
  event_date: string
  start_time: string
  end_time: string
  location: string
  description: string
  bring: string
  notes: string
  capacity: string
  rsvp_deadline: string
  club_id: string
  audience: Audience
  audience_batches: number[]
}

function toForm(event?: HubEvent): FormState {
  return {
    title: event?.title ?? '',
    category: event?.category ?? 'Social',
    event_date: event?.event_date ?? '',
    start_time: event?.start_time.slice(0, 5) ?? '',
    end_time: event?.end_time?.slice(0, 5) ?? '',
    location: event?.location ?? '',
    description: event?.description ?? '',
    bring: event?.bring ?? '',
    notes: event?.notes ?? '',
    capacity: event?.capacity ? String(event.capacity) : '',
    rsvp_deadline: event?.rsvp_deadline ?? '',
    club_id: event?.club_id ?? '',
    audience: event?.audience ?? 'everyone',
    audience_batches: event?.audience_batches ?? [],
  }
}

export default function EventForm({
  event,
  onSaved,
  onCancel,
}: {
  event?: HubEvent
  onSaved: (event: HubEvent) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(() => toForm(event))
  const [invited, setInvited] = useState<Set<string>>(new Set())
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { data: lookups } = useLoader(async () => {
    const [members, clubs, invites] = await Promise.all([
      listMembers(),
      listClubs(),
      event ? getEventInvites(event.id) : Promise.resolve([]),
    ])
    setInvited(new Set(invites))
    return { members, clubs }
  }, [event?.id])

  const batches = useMemo(() => {
    const fromMembers = (lookups?.members ?? [])
      .map((m) => m.batch)
      .filter((b): b is number => b !== null)
    return [...new Set([...fromMembers, ...form.audience_batches])].sort((a, b) => b - a)
  }, [lookups, form.audience_batches])

  const visibleMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    return (lookups?.members ?? []).filter(
      (m) => !q || (m.full_name ?? '').toLowerCase().includes(q) || String(m.batch).includes(q),
    )
  }, [lookups, memberSearch])

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setError('')
  }

  function toggleBatch(batch: number) {
    update(
      'audience_batches',
      form.audience_batches.includes(batch)
        ? form.audience_batches.filter((b) => b !== batch)
        : [...form.audience_batches, batch],
    )
  }

  function toggleMember(id: string) {
    setInvited((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function validate(): string {
    if (form.title.trim().length < 3) return 'Give the event a title (at least 3 characters).'
    if (!form.event_date) return 'Pick a date.'
    if (!form.start_time) return 'Pick a start time.'
    if (form.location.trim().length < 2) return 'Add a location.'
    if (!event && form.event_date < todayKst()) return 'The date is in the past.'
    if (form.end_time && form.end_time <= form.start_time) return 'End time must be after the start time.'
    if (form.rsvp_deadline && form.rsvp_deadline > form.event_date)
      return 'The RSVP deadline must be on or before the event date.'
    if (form.capacity && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1))
      return 'Capacity must be a whole number, or leave it empty for no limit.'
    if (form.audience === 'batch' && form.audience_batches.length === 0)
      return 'Choose at least one batch.'
    if (form.audience === 'custom' && invited.size === 0) return 'Choose at least one person to invite.'
    return ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    const input: EventInput = {
      title: form.title.trim(),
      category: form.category,
      event_date: form.event_date,
      start_time: form.start_time,
      end_time: form.end_time || null,
      location: form.location.trim(),
      description: form.description.trim(),
      bring: form.bring.trim(),
      notes: form.notes.trim(),
      capacity: form.capacity ? Number(form.capacity) : null,
      rsvp_deadline: form.rsvp_deadline || null,
      image_url: event?.image_url ?? null,
      club_id: form.club_id || null,
      audience: form.audience,
      audience_batches: form.audience === 'batch' ? form.audience_batches : [],
    }

    setSaving(true)

    try {
      const saved = event ? await updateEvent(event.id, input) : await createEvent(input)
      if (form.audience === 'custom') {
        await setEventInvites(saved.id, [...invited])
      }
      onSaved(saved)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  function applyAi({ event: ai }: AiExtractResult) {
    setError('')
    setForm((current) => ({
      ...current,
      title: ai.title || current.title,
      category: ai.category,
      event_date: ai.event_date ?? current.event_date,
      start_time: ai.start_time ?? current.start_time,
      end_time: ai.end_time ?? '',
      location: ai.location || current.location,
      description: ai.description || current.description,
      bring: ai.bring,
      notes: ai.notes,
      capacity: ai.capacity ? String(ai.capacity) : '',
      rsvp_deadline: ai.rsvp_deadline ?? '',
    }))
  }

  return (
    <form onSubmit={handleSubmit} className={`${card} space-y-6 p-5 sm:p-6`}>
      <div>
        <h2 className="text-xl font-bold">{event ? 'Edit event' : 'New event'}</h2>
        <p className="mt-1 text-sm text-slate-500">
          Students only see what's here, so be specific.
        </p>
      </div>

      {!event && <AiFillBox onFill={applyAi} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium sm:col-span-2">
          Title *
          <input
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. EMSU Futsal Night"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          Category *
          <select
            value={form.category}
            onChange={(e) => update('category', e.target.value as EventCategory)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Club (optional)
          <select
            value={form.club_id}
            onChange={(e) => update('club_id', e.target.value)}
            className={inputClass}
          >
            <option value="">No club: general event</option>
            {lookups?.clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium">
          Date *
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => update('event_date', e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium">
            Starts *
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => update('start_time', e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium">
            Ends
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => update('end_time', e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="text-sm font-medium sm:col-span-2">
          Location *
          <input
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="e.g. ERICA Sports Field"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          Capacity
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={form.capacity}
            onChange={(e) => update('capacity', e.target.value)}
            placeholder="Leave empty for no limit"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          RSVP deadline
          <input
            type="date"
            value={form.rsvp_deadline}
            max={form.event_date || undefined}
            onChange={(e) => update('rsvp_deadline', e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-slate-400">
            Empty = RSVPs stay open until the event day.
          </span>
        </label>

        <label className="text-sm font-medium sm:col-span-2">
          Description
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What's happening, who it's for, schedule…"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          What to bring
          <input
            value={form.bring}
            onChange={(e) => update('bring', e.target.value)}
            placeholder="e.g. Sportswear and water"
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          Notes (dress code, fees…)
          <input
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="e.g. Baju kurung welcome"
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold">Who is this event for?</legend>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['everyone', 'Everyone'],
              ['batch', 'Certain batches'],
              ['custom', 'Invite specific people'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => update('audience', value)}
              aria-pressed={form.audience === value}
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                form.audience === value
                  ? 'border-primary bg-red-50 text-primary'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {form.audience === 'batch' && (
          <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
            {batches.length === 0 && (
              <p className="text-sm text-slate-500">No members have signed up yet.</p>
            )}
            {batches.map((batch) => (
              <label
                key={batch}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.audience_batches.includes(batch)}
                  onChange={() => toggleBatch(batch)}
                  className="accent-red-700"
                />
                Batch {batch}
              </label>
            ))}
          </div>
        )}

        {form.audience === 'custom' && (
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search name or batch…"
                aria-label="Search members"
                className={`${inputClass} mt-0 pl-9`}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{invited.size} selected</p>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              {visibleMembers.map((member) => (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={invited.has(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="accent-red-700"
                  />
                  <span className="flex-1">{member.full_name}</span>
                  <span className="text-xs text-slate-400">
                    {member.batch} · {member.course}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500">
          Only the people you choose can see and RSVP to this event.
        </p>
      </fieldset>

      <ErrorBox>{error}</ErrorBox>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className={buttonPrimary}>
          {saving ? 'Saving…' : event ? 'Save changes' : 'Create event'}
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  )
}
