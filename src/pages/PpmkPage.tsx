import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  AtSign,
  CalendarPlus,
  Camera,
  ExternalLink,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import {
  deleteOrgCalendarItem,
  deleteOrgPerson,
  listOrgCalendar,
  listOrgPeople,
  removeOrgPersonPhoto,
  saveOrgCalendarItem,
  saveOrgPerson,
  setOrgPersonPhoto,
} from '../lib/api'
import { friendlyError, todayKst } from '../lib/format'
import { downloadIcs } from '../lib/ics'
import {
  CALENDAR_CATEGORIES,
  COMMITTEE_TIERS,
  guessTier,
  type CalendarCategory,
  type CommitteeTier,
  type OrgCalendarInput,
  type OrgCalendarItem,
  type OrgMember,
  type OrgMemberInput,
} from '../lib/types'
import { useLoader } from '../lib/useLoader'
import { usePageMeta } from '../lib/usePageMeta'
import { ppmk } from '../data/organization'
import Songket from '../components/Songket'
import { ErrorBox, Spinner, buttonPrimary, buttonSecondary, inputClass } from '../components/ui'

const SPONSOR_SITES: Record<string, string> = {
  MARA: 'https://www.mara.gov.my',
  JPA: 'https://www.jpa.gov.my',
}

const FAQ: [string, string][] = [
  [
    'Who is PPMK for?',
    'Every Malaysian student studying in Korea, at any university, sponsored or self-funded. Friends and visitors can still use the public parts of the hub.',
  ],
  [
    'Who do I contact about my scholarship or allowance?',
    'Your sponsor’s officer (MARA, JPA or others) listed on this page. PPMK can help you find the right person, but only your sponsor can decide on scholarship matters.',
  ],
  [
    'Who can see my phone number and student ID?',
    'Only the organizers of events you RSVP to and hub admins. Everyone else only sees your @username. You can delete your account and data at any time from your profile.',
  ],
  [
    'Why can’t I see the committee’s phone numbers?',
    'Contact details are shown only to signed-in PPMK members, so personal numbers aren’t copied from a public page. Sign in and finish your member profile to see them.',
  ],
  [
    'How do I start a club?',
    'Get at least 5 founding members and prepare a short constitution, member list, activity plan and committee list. Then apply under Clubs → Start a club. An admin replies, usually within a week.',
  ],
]

export default function PpmkPage() {
  usePageMeta('PPMK', 'Persatuan Pelajar Malaysia Korea: the High Committee, the PPMK calendar, and MARA and JPA contacts.')
  const { session, isMember, isAdmin } = useAuth()
  const { data, loading, error, reload } = useLoader(async () => {
    const [people, calendar] = await Promise.all([listOrgPeople(), listOrgCalendar()])
    return { people, calendar }
  }, [session?.user.id ?? 'guest'])
  const [editing, setEditing] = useState(false)

  const committee = (data?.people ?? []).filter((p) => p.kind === 'committee')
  const sponsors = (data?.people ?? []).filter((p) => p.kind === 'sponsor')
  const contactsHidden = (data?.people ?? []).some((p) => p.contacts_hidden)
  const session_ = committee.find((p) => p.session)?.session

  return (
    <div className="space-y-16">
      {/* ---------- Intro ---------- */}
      <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-slate-200 px-4 pb-10 pt-8 sm:-mx-6 sm:px-6">
        <Songket className="absolute right-0 top-0 hidden h-full w-[45%] opacity-20 [mask-image:linear-gradient(to_left,black_20%,transparent)] md:block dark:opacity-25" />
        <div className="relative">
          <h1 className="font-display text-[5.5rem] sm:text-[9rem]">
            PPMK<span className="text-gold">.</span>
          </h1>
          <p className="mt-2 text-xl font-semibold">{ppmk.fullName}</p>
          <p className="text-slate-500">{ppmk.englishName}</p>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-600">{ppmk.summary}</p>
          <nav aria-label="On this page" className="mt-7 flex flex-wrap gap-2">
            <Link to={{ hash: 'committee' }} className={buttonSecondary}>High Committee</Link>
            <Link to={{ hash: 'calendar' }} className={buttonSecondary}>Calendar</Link>
            <Link to={{ hash: 'sponsors' }} className={buttonSecondary}>MARA &amp; JPA</Link>
            <Link to={{ hash: 'faq' }} className={buttonSecondary}>Questions</Link>
          </nav>
        </div>
      </section>

      <section aria-labelledby="focus" className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <h2 id="focus" className="font-display text-4xl sm:text-5xl">What we do</h2>
        <dl className="grid border-t border-slate-200 sm:grid-cols-2">
          {ppmk.focus.map((f, i) => (
            <div key={f.title} className={`border-b border-slate-200 py-5 ${i % 2 === 0 ? 'sm:border-r sm:pr-6' : 'sm:pl-6'}`}>
              <dt className="text-lg font-bold">{f.title}</dt>
              <dd className="mt-1 text-[15px] leading-6 text-slate-600">{f.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {isAdmin && (
        <div className="sticky top-20 z-30 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="text-sm font-semibold">
            {editing ? 'Editing this page. Changes save straight away.' : 'You can edit the committee, calendar and sponsor contacts.'}
          </p>
          <button onClick={() => setEditing(!editing)} className={`${editing ? buttonPrimary : buttonSecondary} shrink-0 py-2`}>
            {editing ? 'Done' : <><Pencil size={15} /> Edit page</>}
          </button>
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>

      {/* ---------- High Committee ---------- */}
      <section id="committee" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl">High Committee</h2>
            <p className="mt-2 text-slate-600">
              Majlis Tertinggi PPMK{session_ ? `, session ${session_}` : ''}.
            </p>
          </div>
        </div>
        {contactsHidden && !isMember && <MembersOnlyNote signedIn={Boolean(session)} />}

        {loading ? (
          <Spinner />
        ) : (
          <>
            {committee.length === 0 && !editing && (
              <p className="mt-6 text-slate-500">The committee list will be added soon.</p>
            )}
            <CommitteeChart people={committee} editing={editing} onChange={reload} />
            {editing && <PersonForm kind="committee" onDone={reload} />}
          </>
        )}
      </section>

      {/* ---------- Calendar ---------- */}
      <section id="calendar" className="scroll-mt-24">
        <CalendarSection items={data?.calendar ?? []} loading={loading} editing={editing} onChange={reload} />
      </section>

      {/* ---------- Scholarship sponsors ---------- */}
      <section id="sponsors" className="scroll-mt-24">
        <h2 className="font-display text-4xl sm:text-5xl">MARA &amp; JPA</h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          For scholarship, allowance or study-progress questions, contact your sponsor’s officer directly. PPMK can
          point you to the right person, but only your sponsor can decide on scholarship matters.
        </p>
        {contactsHidden && !isMember && <MembersOnlyNote signedIn={Boolean(session)} />}
        {loading ? (
          <Spinner />
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {[...new Set(['MARA', 'JPA', ...sponsors.map((s) => s.sponsor ?? '')])].filter(Boolean).map((name) => {
              const officers = sponsors.filter((s) => s.sponsor === name)
              if (officers.length === 0 && !SPONSOR_SITES[name] && !editing) return null
              return (
                <div key={name} className="rounded-xl border border-slate-200 bg-surface p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-3xl">{name}</h3>
                    {SPONSOR_SITES[name] && (
                      <a href={SPONSOR_SITES[name]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Official site <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  {officers.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">The officer in charge will be listed here soon.</p>
                  ) : (
                    <ul>
                      {officers.map((p) => (
                        <PersonRow key={p.id} person={p} editing={editing} onChange={reload} compact />
                      ))}
                    </ul>
                  )}
                  {editing && <PersonForm kind="sponsor" sponsor={name} onDone={reload} />}
                </div>
              )
            })}
          </div>
        )}
        {editing && (
          <p className="mt-3 text-sm text-slate-500">
            Another sponsor (e.g. Yayasan, Petronas)? Add an officer under MARA or JPA, then change the sponsor name in its form.
          </p>
        )}
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="scroll-mt-24 border-t border-slate-200 pt-10">
        <h2 className="font-display text-4xl sm:text-5xl">Questions</h2>
        <div className="mt-6 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <Plus size={20} className="shrink-0 text-slate-400 transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-prose leading-7 text-slate-600">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to={session ? '/clubs/apply' : '/login?next=/clubs/apply'} className={buttonSecondary}>
            <Plus size={16} /> Start a club under PPMK
          </Link>
          <Link to="/explore" className={buttonSecondary}>Opportunities beyond PPMK</Link>
        </div>
      </section>
    </div>
  )
}

function MembersOnlyNote({ signedIn }: { signedIn: boolean }) {
  return (
    <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
      <Lock size={14} className="text-slate-400" />
      Phone numbers and emails are shown to PPMK members.{' '}
      <Link to={signedIn ? '/me?become=member' : '/login?next=/ppmk'} className="font-semibold text-primary hover:underline">
        {signedIn ? 'Switch to a member profile' : 'Sign in'}
      </Link>
    </p>
  )
}

// ---------------------------------------------------------------------

type PersonVariant = 'lead' | 'card' | 'row' | 'small'

function PersonRow({
  person: p,
  editing,
  onChange,
  compact = false,
  variant = 'row',
}: {
  person: OrgMember
  editing: boolean
  onChange: () => Promise<void>
  compact?: boolean
  /** lead/card: centred, for the top of the hierarchy. row: list. small: committee members. */
  variant?: PersonVariant
}) {
  const [edit, setEdit] = useState(false)

  if (edit) {
    return (
      <li className="w-full basis-full py-2 sm:col-span-2 lg:col-span-3">
        <PersonForm
          kind={p.kind}
          sponsor={p.sponsor ?? undefined}
          initial={p}
          onDone={async () => {
            setEdit(false)
            await onChange()
          }}
          onCancel={() => setEdit(false)}
        />
      </li>
    )
  }

  const editButtons = editing && (
    <div className="flex shrink-0 gap-1">
      <button onClick={() => setEdit(true)} aria-label={`Edit ${p.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <Pencil size={15} />
      </button>
      <button
        onClick={async () => {
          if (!window.confirm(`Remove ${p.name}?`)) return
          await deleteOrgPerson(p.id, p.photo_path)
          await onChange()
        }}
        aria-label={`Remove ${p.name}`}
        className="rounded-lg p-2 text-red-600 hover:bg-red-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )

  // Top of the hierarchy: centred cards, bigger for the President.
  if (variant === 'lead' || variant === 'card') {
    const lead = variant === 'lead'
    return (
      <li
        className={`relative flex flex-col items-center rounded-xl border bg-surface px-5 text-center ${
          lead ? 'w-full max-w-sm border-gold/60 pb-6 pt-7' : 'w-full max-w-[17rem] border-slate-200 pb-5 pt-6'
        }`}
      >
        {editing && <div className="absolute right-2 top-2">{editButtons}</div>}
        <Avatar person={p} size={lead ? 112 : 80} />
        <p className={`mt-4 font-semibold ${lead ? 'text-gold' : 'text-primary'} text-sm`}>{p.role}</p>
        <p className={`mt-0.5 font-bold leading-snug ${lead ? 'text-2xl' : 'text-lg'}`}>{p.name}</p>
        {p.detail && <p className="mt-0.5 text-sm text-slate-500">{p.detail}</p>}
        <Contacts person={p} className="mt-4 justify-center" />
      </li>
    )
  }

  if (variant === 'small') {
    return (
      <li className="flex items-center gap-3 border-b border-slate-200 py-3">
        <Avatar person={p} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">{p.name}</p>
          <p className="truncate text-sm text-slate-500">
            {p.role}
            {p.detail ? `, ${p.detail}` : ''}
          </p>
        </div>
        <Contacts person={p} iconsOnly />
        {editButtons}
      </li>
    )
  }

  return (
    <li className={`border-b border-slate-200 ${compact ? 'pt-4 pb-4 last:border-0 last:pb-0' : 'py-5'}`}>
      <div className="flex items-start gap-4">
        <Avatar person={p} size={compact ? 56 : 64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">{p.role}</p>
          <p className="mt-0.5 text-lg font-bold leading-snug">{p.name}</p>
          {p.detail && <p className="mt-0.5 text-sm text-slate-500">{p.detail}</p>}
        </div>
        {editButtons}
      </div>
      <Contacts person={p} className={`mt-3 ${compact ? 'pl-[72px]' : 'pl-20'}`} />
    </li>
  )
}

function Contacts({ person: p, className = '', iconsOnly = false }: { person: OrgMember; className?: string; iconsOnly?: boolean }) {
  if (!(p.whatsapp || p.phone || p.email || p.instagram)) return null
  const btn = iconsOnly
    ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-900'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900'
  return (
    <div className={`flex flex-wrap gap-2 ${iconsOnly ? 'shrink-0 gap-1.5' : ''} ${className}`}>
      {p.whatsapp && (
        <a href={`https://wa.me/${p.whatsapp.replace(/^\+/, '')}`} target="_blank" rel="noreferrer" className={btn} aria-label={`WhatsApp ${p.name}`}>
          <MessageCircle size={14} /> {!iconsOnly && 'WhatsApp'}
        </a>
      )}
      {p.phone && (
        <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className={btn} aria-label={`Call ${p.name}`}>
          <Phone size={14} /> {!iconsOnly && p.phone}
        </a>
      )}
      {p.email && (
        <a href={`mailto:${p.email}`} className={btn} aria-label={`Email ${p.name}`}>
          <Mail size={14} /> {!iconsOnly && 'Email'}
        </a>
      )}
      {p.instagram && (
        <a href={`https://instagram.com/${p.instagram.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className={btn} aria-label={`${p.name} on Instagram`}>
          <AtSign size={14} /> {!iconsOnly && p.instagram.replace(/^@/, '')}
        </a>
      )}
    </div>
  )
}

/** The High Committee as a top-down chart: President, VPs, Secretariat & Treasury, Bureaus, AJK. */
function CommitteeChart({ people, editing, onChange }: { people: OrgMember[]; editing: boolean; onChange: () => Promise<void> }) {
  const tiers = ([1, 2, 3, 4, 5] as CommitteeTier[])
    .map((t) => [t, people.filter((p) => p.tier === t)] as const)
    .filter(([, list]) => list.length > 0)

  return (
    <div className="mt-8">
      {tiers.map(([tier, list], i) => (
        <div key={tier}>
          {i > 0 && <div aria-hidden className="mx-auto h-8 w-px bg-slate-300" />}
          <h3 className="mb-4 flex items-center justify-center gap-3 text-sm font-semibold text-slate-500">
            <span aria-hidden className="h-px w-8 bg-slate-200" />
            {COMMITTEE_TIERS[tier].plural}
            <span aria-hidden className="h-px w-8 bg-slate-200" />
          </h3>
          {tier <= 3 ? (
            <ul className="flex flex-wrap items-stretch justify-center gap-4">
              {list.map((p) => (
                <PersonRow key={p.id} person={p} editing={editing} onChange={onChange} variant={tier === 1 ? 'lead' : 'card'} />
              ))}
            </ul>
          ) : tier === 4 ? (
            <ul className="grid gap-x-8 rounded-xl border border-slate-200 bg-surface px-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <PersonRow key={p.id} person={p} editing={editing} onChange={onChange} />
              ))}
            </ul>
          ) : (
            <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <PersonRow key={p.id} person={p} editing={editing} onChange={onChange} variant="small" />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function PersonForm({
  kind,
  sponsor,
  initial,
  onDone,
  onCancel,
}: {
  kind: OrgMember['kind']
  sponsor?: string
  initial?: OrgMember
  onDone: () => Promise<void>
  onCancel?: () => void
}) {
  const blank: OrgMemberInput = {
    kind,
    sponsor: kind === 'sponsor' ? (sponsor ?? 'MARA') : null,
    role: kind === 'sponsor' ? 'Education officer' : '',
    tier: 4,
    name: '',
    detail: '',
    session: '',
    email: null,
    phone: null,
    whatsapp: null,
    instagram: null,
    photo_path: null,
    sort_order: 100,
  }
  const [open, setOpen] = useState(Boolean(initial))
  const [form, setForm] = useState<OrgMemberInput>(() => {
    if (!initial) return blank
    const { id, contacts_hidden, photo_url, ...rest } = initial
    void id
    void contacts_hidden
    void photo_url
    return rest
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  // Until the admin picks a level, guess it from the role they type.
  const [tierPicked, setTierPicked] = useState(Boolean(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof OrgMemberInput>(k: K, v: OrgMemberInput[K]) => setForm({ ...form, [k]: v })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={`${buttonSecondary} mt-4`}>
        <Plus size={15} /> {kind === 'sponsor' ? `Add ${sponsor} officer` : 'Add committee member'}
      </button>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.role.trim().length < 2 || form.name.trim().length < 2) return setError('Role and name are required.')
    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
    const wa = clean(form.whatsapp)?.replace(/[\s-]/g, '') ?? null
    if (wa && !/^\+?[0-9]{8,15}$/.test(wa)) return setError('WhatsApp number: digits with country code, e.g. 821012345678 or 60123456789.')
    setBusy(true)
    try {
      const id = await saveOrgPerson(
        {
          ...form,
          role: form.role.trim(),
          name: form.name.trim(),
          detail: form.detail.trim(),
          session: form.session.trim(),
          sponsor: form.kind === 'sponsor' ? (clean(form.sponsor) ?? 'MARA').toUpperCase() : null,
          email: clean(form.email),
          phone: clean(form.phone),
          whatsapp: wa,
          instagram: clean(form.instagram)?.replace(/^@/, '') ?? null,
        },
        initial?.id,
      )
      if (photo) await setOrgPersonPhoto(id, photo, initial?.photo_path)
      else if (removePhoto && initial?.photo_path) await removeOrgPersonPhoto(id, initial.photo_path)
      if (!initial) {
        setForm(blank)
        setPhoto(null)
        setOpen(false)
      }
      await onDone()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <PhotoField
        name={form.name || 'New person'}
        current={removePhoto ? null : (initial?.photo_url ?? null)}
        file={photo}
        onPick={(f) => {
          setPhoto(f)
          setRemovePhoto(false)
        }}
        onRemove={() => {
          setPhoto(null)
          setRemovePhoto(true)
        }}
      />
      <label className="text-sm font-medium">
        Role *
        <input
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value, tier: tierPicked || kind === 'sponsor' ? form.tier : guessTier(e.target.value) })
          }
          placeholder={kind === 'sponsor' ? 'Education officer' : 'e.g. Timbalan Presiden, Head of Welfare'}
          className={inputClass}
        />
      </label>
      {kind === 'committee' && (
        <label className="text-sm font-medium">
          Level in the committee
          <select
            value={form.tier}
            onChange={(e) => {
              setTierPicked(true)
              set('tier', Number(e.target.value) as CommitteeTier)
            }}
            className={inputClass}
          >
            {([1, 2, 3, 4, 5] as CommitteeTier[]).map((t) => (
              <option key={t} value={t}>
                {t}. {COMMITTEE_TIERS[t].label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium">
        Name *
        <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
      </label>
      {kind === 'sponsor' ? (
        <label className="text-sm font-medium">
          Sponsor
          <input value={form.sponsor ?? ''} onChange={(e) => set('sponsor', e.target.value)} placeholder="MARA, JPA, Yayasan…" className={inputClass} />
        </label>
      ) : (
        <label className="text-sm font-medium">
          Session
          <input value={form.session} onChange={(e) => set('session', e.target.value)} placeholder="2026/2027" className={inputClass} />
        </label>
      )}
      <label className="text-sm font-medium">
        {kind === 'sponsor' ? 'Office / what they help with' : 'University'}
        <input value={form.detail} onChange={(e) => set('detail', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Email
        <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Phone
        <input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="010-1234-5678" className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        WhatsApp (with country code)
        <input value={form.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} placeholder="60123456789" className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Instagram
        <input value={form.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} placeholder="handle" className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Order on the page
        <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 100)} className={inputClass} />
      </label>
      <p className="self-end text-xs text-slate-500 sm:col-span-2">
        Contacts are only shown to signed-in PPMK members. The photo is public, like the name: get the person’s OK first.
      </p>
      <div className="sm:col-span-2"><ErrorBox>{error}</ErrorBox></div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={buttonPrimary}>{busy ? (photo ? 'Uploading photo…' : 'Saving…') : initial ? 'Save' : 'Add'}</button>
        <button type="button" onClick={() => (onCancel ? onCancel() : setOpen(false))} className={buttonSecondary}>Cancel</button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------

function initialsOf(name: string) {
  return name
    .replace(/^sample:\s*/i, '')
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
}

function Avatar({ person, size }: { person: Pick<OrgMember, 'name' | 'photo_url'>; size: number }) {
  return person.photo_url ? (
    <img
      src={person.photo_url}
      alt={`Photo of ${person.name}`}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full object-cover ring-1 ring-slate-200"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-slate-100 font-display text-slate-500 ring-1 ring-slate-200"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initialsOf(person.name)}
    </div>
  )
}

function PhotoField({
  name,
  current,
  file,
  onPick,
  onRemove,
}: {
  name: string
  current: string | null
  file: File | null
  onPick: (f: File) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])
  const shown = preview ?? current

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      <Avatar person={{ name, photo_url: shown }} size={72} />
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.click()} className={`${buttonSecondary} py-2`}>
            <Camera size={15} /> {shown ? 'Change photo' : 'Add photo'}
          </button>
          {shown && (
            <button type="button" onClick={onRemove} className="rounded-[10px] px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
              Remove
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">Cropped to a square around the face. JPG or PNG.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function fmtRange(i: OrgCalendarItem) {
  const d = (s: string, opts: Intl.DateTimeFormatOptions) => new Date(`${s}T00:00:00`).toLocaleDateString('en-GB', opts)
  if (!i.end_date || i.end_date === i.start_date) return d(i.start_date, { weekday: 'long', day: 'numeric', month: 'long' })
  return `${d(i.start_date, { day: 'numeric', month: 'short' })} – ${d(i.end_date, { day: 'numeric', month: 'short' })}`
}

function CalendarSection({
  items,
  loading,
  editing,
  onChange,
}: {
  items: OrgCalendarItem[]
  loading: boolean
  editing: boolean
  onChange: () => Promise<void>
}) {
  const today = todayKst()
  const [showPast, setShowPast] = useState(false)
  const [editingItem, setEditingItem] = useState<OrgCalendarItem | 'new' | null>(null)

  const upcoming = items.filter((i) => (i.end_date ?? i.start_date) >= today)
  const past = items.filter((i) => (i.end_date ?? i.start_date) < today).reverse()
  const shown = showPast ? past : upcoming

  const months = useMemo(() => {
    const groups: [string, OrgCalendarItem[]][] = []
    for (const i of shown) {
      const key = new Date(`${i.start_date}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      const g = groups.find(([k]) => k === key)
      if (g) g[1].push(i)
      else groups.push([key, [i]])
    }
    return groups
  }, [shown])

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl sm:text-5xl">PPMK Calendar</h2>
          <p className="mt-2 text-slate-600">Key dates for Malaysian students across Korea.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-[10px] border border-slate-200 p-1" role="group" aria-label="Which dates">
            {[
              [false, `Upcoming (${upcoming.length})`],
              [true, `Past (${past.length})`],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                onClick={() => setShowPast(value as boolean)}
                aria-pressed={showPast === value}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold ${showPast === value ? 'bg-ink text-on-ink' : 'text-slate-500'}`}
              >
                {label as string}
              </button>
            ))}
          </div>
          {upcoming.length > 0 && (
            <button onClick={() => downloadIcs(upcoming, 'ppmk-calendar.ics')} className={buttonSecondary}>
              <CalendarPlus size={16} /> Add all to my calendar
            </button>
          )}
        </div>
      </div>

      {editing && editingItem === null && (
        <button onClick={() => setEditingItem('new')} className={`${buttonSecondary} mt-5`}>
          <Plus size={15} /> Add a date
        </button>
      )}
      {editing && editingItem && (
        <CalendarForm
          initial={editingItem === 'new' ? null : editingItem}
          onDone={async () => {
            setEditingItem(null)
            await onChange()
          }}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {loading ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <p className="mt-6 text-slate-500">{showPast ? 'No past dates yet.' : 'No upcoming dates yet. Check back soon.'}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {months.map(([month, list]) => (
            <div key={month}>
              <h3 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-500">{month}</h3>
              <ul className="divide-y divide-slate-200">
                {list.map((i) => {
                  const cat = CALENDAR_CATEGORIES[i.category]
                  const date = new Date(`${i.start_date}T00:00:00`)
                  return (
                    <li key={i.id} className="flex gap-4 py-4 sm:gap-6">
                      <div className="w-14 shrink-0 text-center sm:w-16">
                        <p className="font-display text-4xl text-gold sm:text-5xl">{date.getDate()}</p>
                        <p className="text-xs font-semibold text-slate-500">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          <span className={`h-2 w-2 rounded-full ${cat.dot}`} aria-hidden /> {cat.label}
                        </p>
                        <p className="mt-0.5 text-lg font-bold leading-snug">{i.title}</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {fmtRange(i)}
                          {i.location && (
                            <>
                              {' '}<span className="text-slate-400">at</span>{' '}
                              <span className="inline-flex items-center gap-1"><MapPin size={13} className="text-slate-400" />{i.location}</span>
                            </>
                          )}
                        </p>
                        {i.description && <p className="mt-1.5 max-w-prose text-sm leading-6 text-slate-600">{i.description}</p>}
                        <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
                          {!showPast && (
                            <button onClick={() => downloadIcs([i], `${i.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`)} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <CalendarPlus size={14} /> Add to calendar
                            </button>
                          )}
                          {i.url && (
                            <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                              Details <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                      {editing && (
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => setEditingItem(i)} aria-label={`Edit ${i.title}`} className="h-fit rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Remove “${i.title}” from the calendar?`)) return
                              await deleteOrgCalendarItem(i.id)
                              await onChange()
                            }}
                            aria-label={`Remove ${i.title}`}
                            className="h-fit rounded-lg p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function CalendarForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: OrgCalendarItem | null
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<OrgCalendarInput>(() => {
    if (!initial) return { title: '', category: 'event', start_date: '', end_date: null, location: '', description: '', url: null }
    const { id, ...rest } = initial
    void id
    return rest
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof OrgCalendarInput>(k: K, v: OrgCalendarInput[K]) => setForm({ ...form, [k]: v })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.title.trim().length < 2 || !form.start_date) return setError('Title and date are required.')
    if (form.end_date && form.end_date < form.start_date) return setError('The end date is before the start date.')
    if (form.url && !/^https?:\/\//.test(form.url.trim())) return setError('The link should start with https://')
    setBusy(true)
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
      await saveOrgCalendarItem(
        { ...form, title: form.title.trim(), location: form.location.trim(), description: form.description.trim(), end_date: clean(form.end_date), url: clean(form.url) },
        initial?.id,
      )
      await onDone()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
      <div className="flex items-center justify-between sm:col-span-2">
        <p className="font-bold">{initial ? 'Edit date' : 'New date'}</p>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={16} /></button>
      </div>
      <label className="text-sm font-medium sm:col-span-2">
        Title *
        <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. PPMK Sports Carnival" className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Starts *
        <input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Ends <span className="font-normal text-slate-500">(if more than one day)</span>
        <input type="date" value={form.end_date ?? ''} onChange={(e) => set('end_date', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium">
        Type
        <select value={form.category} onChange={(e) => set('category', e.target.value as CalendarCategory)} className={inputClass}>
          {(Object.keys(CALENDAR_CATEGORIES) as CalendarCategory[]).map((c) => (
            <option key={c} value={c}>{CALENDAR_CATEGORIES[c].label}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Where
        <input value={form.location} onChange={(e) => set('location', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium sm:col-span-2">
        Details
        <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
      </label>
      <label className="text-sm font-medium sm:col-span-2">
        Link
        <input type="url" value={form.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://" className={inputClass} />
      </label>
      <div className="sm:col-span-2"><ErrorBox>{error}</ErrorBox></div>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className={buttonPrimary}>{busy ? 'Saving…' : initial ? 'Save' : 'Add to calendar'}</button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>Cancel</button>
      </div>
    </form>
  )
}
