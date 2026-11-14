import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, Lock, MapPin, Send, Users, Wallet } from 'lucide-react'
import Breadcrumbs from '../components/Breadcrumbs'
import { usePageMeta } from '../lib/usePageMeta'

import { useAuth } from '../context/AuthContext'
import { useLanguage, type TranslationKey } from '../context/LanguageContext'
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

export default function DiscussNewPage() {
  const { t } = useLanguage()
  usePageMeta(t('discussNew.title'))
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
  const groupKeys: Record<string, TranslationKey> = {
    explore: 'discuss.groupExplore',
    life: 'discuss.groupLife',
    teamup: 'discuss.groupTeamup',
  }
  const categoryKeys: Record<ForumCategory, [TranslationKey, TranslationKey]> = {
    food: ['discuss.categoryFood', 'discussNew.hintFood'],
    hidden_gems: ['discuss.categoryHiddenGems', 'discussNew.hintHiddenGems'],
    hangout: ['discuss.categoryHangout', 'discussNew.hintHangout'],
    trips: ['discuss.categoryTrips', 'discussNew.hintTrips'],
    budget: ['discuss.categoryBudget', 'discussNew.hintBudget'],
    study: ['discuss.categoryStudy', 'discussNew.hintStudy'],
    serious: ['discuss.categorySerious', 'discussNew.hintSerious'],
    career: ['discuss.categoryCareer', 'discussNew.hintCareer'],
    general: ['discuss.categoryGeneral', 'discussNew.hintGeneral'],
    hackathon: ['discuss.categoryHackathon', 'discussNew.hintHackathon'],
    startup: ['discuss.categoryStartup', 'discussNew.hintStartup'],
    activities: ['discuss.categoryActivities', 'discussNew.hintActivities'],
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.title.trim().length < 3) return setError(t('discussNew.giveTitle'))
    for (const url of [isPlace ? form.map_url : '', isTeamUp ? form.link_url : '']) {
      if (url && url.trim() && !/^https?:\/\//.test(url.trim())) return setError(t('discussNew.linksHttps'))
    }
    if (isTeamUp && !form.looking_for?.trim()) return setError(t('discussNew.sayWho'))

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
      <Breadcrumbs items={[[t('discuss.title'), '/discuss'], [t('discussNew.title')]]} />

      <form onSubmit={submit} className={`${card} space-y-5 p-5 sm:p-7`}>
        <h1 className="text-2xl font-bold">{isTeamUp ? t('discussNew.findTeammates') : t('discussNew.title')}</h1>

        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">{t('discussNew.topic')}</legend>
          {FORUM_GROUPS.map((g) => {
            const cats = FORUM_CATEGORIES.filter((c) => c.group === g.id)
            const open = isMember || g.public
            return (
              <div key={g.id}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                  {g.emoji} {t(groupKeys[g.id])} {!open && <Lock size={11} />}
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
                        <span className={`block text-sm font-semibold leading-5 ${form.category === c.id ? 'text-primary' : ''}`}>{t(categoryKeys[c.id][0])}</span>
                        <span className="block text-xs leading-4 text-slate-500">{t(categoryKeys[c.id][1])}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{t('discussNew.forMembers')}</p>
                )}
              </div>
            )
          })}
        </fieldset>

        <label className="block text-sm font-medium">
          {t('discussNew.postTitle')}
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={150}
            placeholder={t('discussNew.titlePlaceholder')}
            className={inputClass}
          />
        </label>

        {isTeamUp && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-indigo-900">
              <Users size={16} /> {t('discussNew.yourTeam')}
            </p>
            <label className="block text-sm font-medium">
              {t('discussNew.lookingFor')}
              <input
                value={form.looking_for ?? ''}
                onChange={(e) => set('looking_for', e.target.value)}
                maxLength={300}
                placeholder={t('discussNew.lookingPlaceholder')}
                className={inputClass}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                {t('discussNew.signupDeadline')}
                <input type="date" value={form.deadline ?? ''} onChange={(e) => set('deadline', e.target.value)} className={inputClass} />
              </label>
              <label className="text-sm font-medium">
                {t('discussNew.eventLink')}
                <input type="url" value={form.link_url ?? ''} onChange={(e) => set('link_url', e.target.value)} placeholder="https://" className={inputClass} />
              </label>
            </div>
          </div>
        )}

        {isPlace && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <MapPin size={16} /> {form.category === 'trips' ? t('discussNew.where') : t('discussNew.thePlace')}{' '}
              <span className="font-normal text-emerald-700">{t('discussNew.optional')}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                {t('discussNew.name')}
                <input value={form.place_name ?? ''} onChange={(e) => set('place_name', e.target.value)} maxLength={120} placeholder={form.category === 'trips' ? 'e.g. Gapyeong' : 'e.g. Cafe Haneul'} className={inputClass} />
              </label>
              <label className="text-sm font-medium">
                {t('discussNew.area')}
                <input value={form.place_area ?? ''} onChange={(e) => set('place_area', e.target.value)} maxLength={120} placeholder={t('discussNew.placeAreaPlaceholder')} className={inputClass} />
              </label>
            </div>
            <label className="block text-sm font-medium">
              {t('discussNew.mapLink')}
              <input type="url" value={form.map_url ?? ''} onChange={(e) => set('map_url', e.target.value)} placeholder="https://naver.me/…" className={inputClass} />
            </label>
          </div>
        )}

        {hasCost && (
          <label className="block text-sm font-medium">
            <span className="flex items-center gap-1.5"><Wallet size={15} className="text-amber-600" /> {t('discussNew.roughCost')} <span className="font-normal text-slate-500">{t('discussNew.optional')}</span></span>
            <input value={form.cost_note ?? ''} onChange={(e) => set('cost_note', e.target.value)} maxLength={80} placeholder={t('discussNew.costPlaceholder')} className={inputClass} />
          </label>
        )}

        <label className="block text-sm font-medium">
          {t('discussNew.details')}
          <textarea
            rows={6}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            maxLength={10000}
            placeholder={
              isTeamUp
                ? t('discussNew.teamDetails')
                : form.category === 'trips'
                  ? t('discussNew.tripDetails')
                  : isPlace
                    ? t('discussNew.placeDetails')
                    : t('discussNew.shareDetails')
            }
            className={inputClass}
          />
        </label>

        <div className="block text-sm font-medium">
          <span className="mb-2 flex items-center gap-1.5">
            <Camera size={15} className="text-slate-500" /> {t('discussNew.photos')} <span className="font-normal text-slate-500">{t('discussNew.optional')}</span>
          </span>
          <PhotoPicker files={photos} onChange={setPhotos} />
        </div>

        <div className="rounded-xl bg-slate-50 p-4">
          <AnonymousToggle value={form.is_anonymous} onChange={(v) => set('is_anonymous', v)} username={profile?.username ?? null} />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {form.is_anonymous
              ? isTeamUp
              ? t('discussNew.teamAnonymousHint')
              : t('discussNew.anonymousHint')
              : t('discussNew.publicBy').replace('{name}', profile?.username ?? 'you')}
          </p>
        </div>

        <ErrorBox>{error}</ErrorBox>
        <div className="flex gap-2">
          <button type="submit" disabled={busy !== false} className={buttonPrimary}>
            <Send size={16} /> {busy === 'photos' ? t('discussNew.uploadingPhotos') : busy ? t('discussNew.posting') : t('discussNew.post')}
          </button>
          <Link to="/discuss" className={buttonSecondary}>{t('discussNew.cancel')}</Link>
        </div>
      </form>
    </div>
  )
}
