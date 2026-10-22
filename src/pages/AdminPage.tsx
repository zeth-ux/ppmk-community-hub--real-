import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  deleteClub,
  getHubStats,
  listAllProfiles,
  listClubs,
  saveClub,
  setUserRole,
} from '../lib/api'
import { friendlyError, isProfileComplete } from '../lib/format'
import type { AppRole, Club, ClubInput } from '../lib/types'
import { useLoader } from '../lib/useLoader'
import {
  ErrorBox,
  PageHeader,
  Spinner,
  buttonPrimary,
  buttonSecondary,
  card,
  inputClass,
} from '../components/ui'

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Run the hub"
        description="Members, organizer roles and clubs. Everything here can be done without touching code."
      />
      <StatsSection />
      <MembersSection />
      <ClubsSection />
      <RetentionNote />
    </div>
  )
}

function StatsSection() {
  const { data, loading, error } = useLoader(getHubStats, [])

  if (loading) return <Spinner />
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return null

  const tiles = [
    ['Members', data.members],
    ['Profiles complete', data.complete_profiles],
    ['Organizers & admins', data.organizers],
    ['Events', data.events],
    ['Upcoming events', data.upcoming_events],
    ['RSVPs', data.rsvps],
    ['Check-ins', data.check_ins],
  ] as const

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {tiles.map(([label, value]) => (
        <div key={label} className={`${card} p-4`}>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
      ))}
    </section>
  )
}

function MembersSection() {
  const { session } = useAuth()
  const { data, setData, loading, error } = useLoader(listAllProfiles, [])
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter(
      (p) =>
        !q ||
        [p.full_name, p.email, p.student_id, String(p.batch ?? '')]
          .join(' ')
          .toLowerCase()
          .includes(q),
    )
  }, [data, search])

  async function changeRole(userId: string, role: AppRole) {
    setActionError('')
    try {
      await setUserRole(userId, role)
      setData((data ?? []).map((p) => (p.id === userId ? { ...p, role } : p)))
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Members</h2>
          <p className="text-sm text-slate-500">
            Make someone an <strong>organizer</strong> so they can create events and see attendee lists.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            className={`${inputClass} mt-0 pl-9`}
          />
        </div>
      </div>

      <div className="mt-3">
        <ErrorBox>{error || actionError}</ErrorBox>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="-mx-5 mt-3 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 sm:px-6">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Student ID</th>
                <th className="px-3 py-3">Batch</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-5 py-3 sm:px-6">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-3 font-semibold sm:px-6">
                    {p.full_name ?? <span className="font-normal italic text-slate-400">No profile yet</span>}
                    {!isProfileComplete(p) && p.full_name && (
                      <span className="ml-2 text-xs font-normal text-amber-600">incomplete</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{p.email}</td>
                  <td className="px-3 py-3">{p.student_id}</td>
                  <td className="px-3 py-3">{p.batch}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{p.phone}</td>
                  <td className="px-5 py-3 sm:px-6">
                    <select
                      value={p.role}
                      onChange={(e) => void changeRole(p.id, e.target.value as AppRole)}
                      aria-label={`Role for ${p.full_name ?? p.email}`}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    >
                      <option value="student">Student</option>
                      <option value="organizer">Organizer</option>
                      <option value="admin">Admin</option>
                    </select>
                    {p.id === session?.user.id && (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const EMPTY_CLUB: ClubInput = {
  name: '',
  category: 'Social',
  description: '',
  leader_name: '',
  leader_contact: '',
  logo_url: null,
  join_url: '',
}

function ClubsSection() {
  const { data, loading, error, reload } = useLoader(listClubs, [])
  const [editing, setEditing] = useState<Club | 'new' | null>(null)
  const [form, setForm] = useState<ClubInput>(EMPTY_CLUB)
  const [actionError, setActionError] = useState('')

  function start(club: Club | 'new') {
    setEditing(club)
    setActionError('')
    setForm(club === 'new' ? EMPTY_CLUB : { ...club })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 2) {
      setActionError('Club name is required.')
      return
    }
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
      await saveClub(
        {
          ...form,
          name: form.name.trim(),
          description: form.description.trim(),
          leader_name: clean(form.leader_name),
          leader_contact: clean(form.leader_contact),
          join_url: clean(form.join_url),
        },
        editing && editing !== 'new' ? editing.id : undefined,
      )
      setEditing(null)
      await reload()
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  async function remove(club: Club) {
    if (!window.confirm(`Delete ${club.name}? Its events stay, but lose the club link.`)) return
    try {
      await deleteClub(club.id)
      await reload()
    } catch (err) {
      setActionError(friendlyError(err))
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Clubs</h2>
        <button onClick={() => start('new')} className={buttonSecondary}>
          <Plus size={16} />
          Add club
        </button>
      </div>

      <div className="mt-3">
        <ErrorBox>{error || actionError}</ErrorBox>
      </div>

      {editing && (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Name *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Description
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Leader name
            <input value={form.leader_name ?? ''} onChange={(e) => setForm({ ...form, leader_name: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium">
            Leader contact (Kakao ID, email…)
            <input value={form.leader_contact ?? ''} onChange={(e) => setForm({ ...form, leader_contact: e.target.value })} className={inputClass} />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Join link (group chat or form)
            <input type="url" value={form.join_url ?? ''} onChange={(e) => setForm({ ...form, join_url: e.target.value })} placeholder="https://" className={inputClass} />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className={buttonPrimary}>Save club</button>
            <button type="button" onClick={() => setEditing(null)} className={buttonSecondary}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {(data ?? []).map((club) => (
            <li key={club.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{club.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {club.category}
                  {club.leader_name && ` · Led by ${club.leader_name}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => start(club)} aria-label={`Edit ${club.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                  <Pencil size={16} />
                </button>
                <button onClick={() => void remove(club)} aria-label={`Delete ${club.name}`} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RetentionNote() {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} />
        <div>
          <h2 className="font-bold">Data retention (pilot policy)</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Student data is kept while the student is active. Students can delete
            their own account at any time from their profile page. After
            graduation, data should be deleted within one year. During the pilot
            this is done by hand from Supabase; an automatic yearly clean-up is
            planned.
          </p>
        </div>
      </div>
    </section>
  )
}
