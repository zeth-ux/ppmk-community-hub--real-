import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Lock, MapPin, Send, Users, Wallet } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'
import { usePageMeta } from '../lib/usePageMeta'

import { useAuth } from '../context/AuthContext'
import { createForumPost, uploadPhotos } from '../lib/api'
import { friendlyError } from '../lib/format'
import {
  COST_CATEGORIES,
  FORUM_CATEGORIES,
  FORUM_GROUPS,
  PLACE_CATEGORIES,
  TEAMUP_CATEGORIES,
  type ForumCategory,
  type ForumPostInput,
} from '../lib/types'
import { AnonymousToggle } from '../components/forum'
import { PhotoPicker } from '../components/photos'
import { ErrorBox, buttonPrimary, buttonSecondary, card, inputClass } from '../components/ui'

const PLACEHOLDER: Partial<Record<ForumCategory, string>> = {
  food: 'e.g. Finally found proper halal nasi lemak in Ansan',
  hidden_gems: 'e.g. Gatekeeping no more: quiet rooftop café by the sea',
  hangout: 'e.g. Best study café near ERICA that stays open late',
  trips: 'e.g. Club MT itinerary: 2 days in Gapyeong for 20 people',
  budget: 'e.g. Jeju 3D2N on a student budget: full breakdown',
  hackathon: 'e.g. Looking for 2 teammates for a 48h hackathon',
  startup: 'e.g. Building a halal food finder app: need co-builders',
  activities: 'e.g. Anyone joining the ASEAN youth night? Let’s go as a group',
}

export default function DiscussNewPage() {
  usePageMeta('New post')
  const { profile, isMember, session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const allowed = FORUM_CATEGORIES.filter((c) => isMember || FORUM_GROUPS.find((g) => g.id === c.group)?.public)
  const asked = params.get('c') as ForumCategory | null
  const initial: ForumCategory = allowed.some((c) => c.id === asked) ? asked! : 'food'

  const [form, setForm] = useState<ForumPostInput>({
    category: initial,
    title: params.get('title') ?? '',
    body: '',
    place_name: '',
    place_area: '',
    map_url: '',
    cost_note: '',
    link_url: params.get('link') ?? '',
    deadline: params.get('deadline') ?? '',
    looking_for: '',
    is_closed: false,
    is_anonymous: initial === 'serious',
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [busy, setBusy] = useState<false | 'post' | 'photos'>(false)
  const [error, setError] = useState('')

  const isPlace = PLACE_CATEGORIES.includes(form.category)
  const hasCost = COST_CATEGORIES.includes(form.category)
  const isTeamUp = TEAMUP_CATEGORIES.includes(form.category)
  const set = <K extends keyof ForumPostInput>(k: K, v: ForumPostInput[K]) => setForm({ ...form, [k]: v })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.title.trim().length < 3) return setError('Give your post a title.')
    for (const url of [isPlace ? form.map_url : '', isTeamUp ? form.link_url : '']) {
      if (url && url.trim() && !/^https?:\/\//.test(url.trim())) return setError('Links should start with https://')
    }
    if (isTeamUp && !form.looking_for?.trim()) return setError('Say who you are looking for (e.g. "Frontend dev, designer").')

    setBusy('post')
    try {
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
      const id = await createForumPost({
        ...form,
        title: form.title.trim(),
        body: form.body.trim(),
        place_name: isPlace ? clean(form.place_name) : null,
        place_area: isPlace ? clean(form.place_area) : null,
        map_url: isPlace ? clean(form.map_url) : null,
        cost_note: hasCost ? clean(form.cost_note) : null,
        link_url: isTeamUp ? clean(form.link_url) : null,
        deadline: isTeamUp ? clean(form.deadline) : null,
        looking_for: isTeamUp ? clean(form.looking_for) : null,
      })
      let photoProblem = ''
      if (photos.length > 0 && session) {
        setBusy('photos')
        try {
          await uploadPhotos({ forum_post_id: id }, photos, session.user.id)
        } catch (err) {
          photoProblem = friendlyError(err)
        }
      }
      navigate(`/discuss/${id}`, { replace: true, state: photoProblem ? { photoProblem } : undefined })
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Breadcrumbs items={[['Discussions', '/discuss'], ['New post']]} />

      <form onSubmit={submit} className={`${card} space-y-5 p-5 sm:p-7`}>
        <h1 className="text-2xl font-bold">{isTeamUp ? 'Find teammates' : 'New post'}</h1>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Topic</legend>
          {FORUM_GROUPS.map((g) => {
            const cats = FORUM_CATEGORIES.filter((c) => c.group === g.id)
            const open = isMember || g.public
            return (
              <div key={g.id}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  {g.emoji} {g.label} {!open && <Lock size={11} />}
                </p>
                {open ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setForm({ ...form, category: c.id, is_anonymous: c.id === 'serious' ? true : form.is_anonymous })}
                        className={`rounded-xl border p-3 text-left transition ${
                          form.category === c.id ? 'border-primary bg-red-50 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-lg">{c.emoji}</span>
                        <span className={`block text-sm font-semibold leading-5 ${form.category === c.id ? 'text-primary' : ''}`}>{c.label}</span>
                        <span className="block text-xs leading-4 text-slate-500">{c.hint}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">For PPMK members.</p>
                )}
              </div>
            )
          })}
        </fieldset>

        <label className="block text-sm font-medium">
          Title
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={150}
            placeholder={PLACEHOLDER[form.category] ?? 'What do you want to talk about?'}
            className={inputClass}
          />
        </label>

        {isTeamUp && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-indigo-900">
              <Users size={16} /> Your team
            </p>
            <label className="block text-sm font-medium">
              Looking for *
              <input
                value={form.looking_for ?? ''}
                onChange={(e) => set('looking_for', e.target.value)}
                maxLength={300}
                placeholder="e.g. Frontend dev, Designer, Pitcher (separate with commas)"
                className={inputClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Sign-up deadline
                <input type="date" value={form.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-medium">
                Event / programme link
                <input type="url" value={form.link_url ?? ''} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" className={inputClass} />
              </label>
            </div>
          </div>
        )}

        {isPlace && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <MapPin size={16} /> {form.category === 'trips' ? 'Where' : 'The place'}{' '}
              <span className="font-normal text-emerald-700">(optional)</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Name
                <input value={form.place_name ?? ''} onChange={(e) => set('place_name', e.target.value)} maxLength={120} placeholder={form.category === 'trips' ? 'e.g. Gapyeong' : 'e.g. Cafe Haneul'} className={inputClass} />
              </label>
              <label className="text-sm font-medium">
                Area
                <input value={form.place_area ?? ''} onChange={(e) => set('place_area', e.target.value)} maxLength={120} placeholder="e.g. Ansan, Hongdae, Busan" className={inputClass} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              Naver / Kakao map link
              <input type="url" value={form.map_url ?? ''} onChange={(e) => set('map_url', e.target.value)} placeholder="https://naver.me/…" className={inputClass} />
            </label>
          </div>
        )}

        {hasCost && (
          <label className="block text-sm font-medium">
            <span className="flex items-center gap-1.5"><Wallet size={15} className="text-amber-600" /> Rough cost <span className="font-normal text-slate-500">(optional)</span></span>
            <input value={form.cost_note ?? ''} onChange={(e) => set('cost_note', e.target.value)} maxLength={80} placeholder="e.g. ~₩15,000 per person" className={inputClass} />
          </label>
        )}

        <label className="block text-sm font-medium">
          Details
          <textarea
            rows={6}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            maxLength={10000}
            placeholder={
              isTeamUp
                ? 'What is it, what will you build or do, what you bring, time commitment…'
                : form.category === 'trips'
                  ? 'Day by day: how to get there, where to stay, what to do, booking tips…'
                  : isPlace
                    ? 'Why is it good? Halal or not, how to get there, best time to go…'
                    : 'Share more details'
            }
            className={inputClass}
          />
        </label>

        <div className="block text-sm font-medium">
          <span className="mb-2 flex items-center gap-1.5">
            <Camera size={15} className="text-slate-500" /> Photos <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <PhotoPicker files={photos} onChange={setPhotos} />
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <AnonymousToggle value={form.is_anonymous} onChange={(v) => set('is_anonymous', v)} username={profile?.username ?? null} />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {form.is_anonymous
              ? isTeamUp
                ? 'Heads up: people will need to reply in the comments since they can’t see who you are.'
                : 'Your username is hidden from everyone, including admins in the app. You can still delete your post.'
              : `Others will see this was posted by @${profile?.username ?? 'you'}.`}
          </p>
        </div>

        <ErrorBox>{error}</ErrorBox>
        <div className="flex gap-2">
          <button type="submit" disabled={busy !== false} className={buttonPrimary}>
            <Send size={16} /> {busy === 'photos' ? 'Uploading photos…' : busy ? 'Posting…' : 'Post'}
          </button>
          <Link to="/discuss" className={buttonSecondary}>Cancel</Link>
        </div>
      </form>
    </div>
  )
}
