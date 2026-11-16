import { useState, type FormEvent } from 'react'
import { Trash2 } from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { deleteMarketListing, deletePhoto, saveMarketListing, uploadPhotos } from '../../lib/api'
import { MAX_PHOTOS_PER_POST } from '../../lib/images'
import { friendlyError } from '../../lib/format'
import {
  MARKET_CATEGORIES,
  type MarketCategory,
  type MarketCondition,
  type MarketListing,
  type MarketListingInput,
  type Photo,
} from '../../lib/types'
import { ErrorBox, buttonPrimary, buttonSecondary, card, inputClass } from '../ui'
import { PhotoGallery, PhotoPicker } from '../photos'
import { CATEGORY_KEYS, CONDITION_KEYS } from './shared'

const CONDITIONS: MarketCondition[] = ['new', 'like_new', 'good', 'fair']

export default function ListingForm({
  initial,
  preset,
  initialPhotos,
  onDone,
  onDeleted,
  onCancel,
}: {
  initial: MarketListing | null
  /** 'book': start as a free textbook for juniors (Pass the Book). */
  preset: 'book' | null
  initialPhotos: Photo[]
  onDone: (id: string, isNew: boolean) => Promise<void>
  onDeleted: () => Promise<void>
  onCancel: () => void
}) {
  const { t } = useLanguage()
  const { session, profile } = useAuth()
  const userId = session?.user.id ?? ''

  const [form, setForm] = useState<MarketListingInput>(() =>
    initial
      ? {
          kind: initial.kind,
          category: initial.category,
          title: initial.title,
          description: initial.description,
          price_krw: initial.price_krw,
          condition: initial.condition,
          area: initial.area,
          contact: initial.contact ?? '',
          course: initial.course,
          subject_code: initial.subject_code,
          for_year: initial.for_year,
        }
      : {
          kind: preset === 'book' ? 'free' : 'sell',
          category: preset === 'book' ? 'textbook' : 'other',
          title: '',
          description: '',
          price_krw: null,
          condition: 'good',
          area: '',
          contact: '',
          course: preset === 'book' ? (profile?.course ?? null) : null,
          subject_code: null,
          for_year: preset === 'book' ? 1 : null,
        },
  )
  const [price, setPrice] = useState(initial?.price_krw != null ? String(initial.price_krw) : '')
  const [files, setFiles] = useState<File[]>([])
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof MarketListingInput>(k: K, v: MarketListingInput[K]) => setForm((f) => ({ ...f, [k]: v }))
  const isBook = form.category === 'textbook'
  const roomForPhotos = MAX_PHOTOS_PER_POST - photos.filter((p) => p.status !== 'rejected').length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const priceNumber = Number(price.replace(/[^\d]/g, ''))
    if (form.title.trim().length < 3) return setError(t('market.errorTitle'))
    if (form.kind === 'sell' && (!price.trim() || !Number.isFinite(priceNumber))) return setError(t('market.errorPrice'))
    if (form.kind === 'sell' && priceNumber > 10_000_000) return setError(t('market.errorPriceHigh'))
    if (form.contact.trim().length < 3) return setError(t('market.errorContact'))

    const clean = (v: string | null) => (v && v.trim() ? v.trim() : null)
    const input: MarketListingInput = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      area: form.area.trim(),
      contact: form.contact.trim(),
      price_krw: form.kind === 'sell' ? priceNumber : null,
      course: isBook ? clean(form.course) : null,
      subject_code: isBook ? clean(form.subject_code)?.toUpperCase() ?? null : null,
      for_year: isBook ? form.for_year : null,
    }

    setBusy(true)
    try {
      const id = await saveMarketListing(input, initial?.id)
      if (files.length) {
        try {
          await uploadPhotos({ listing_id: id }, files, userId)
        } catch (err) {
          // The listing is saved; tell them the photos didn't make it.
          window.alert(`${t('market.photoUploadFailed')} ${friendlyError(err)}`)
        }
      }
      await onDone(id, !initial)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-5 p-5 sm:p-6`}>
      <div>
        <h2 className="text-lg font-bold">{initial ? t('market.editTitle') : isBook ? t('market.giveBook') : t('market.listItem')}</h2>
        <p className="text-sm text-slate-500">{t('market.formHint')}</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">{t('market.whatToDo')}</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(['sell', 'free'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={form.kind === k}
              onClick={() => set('kind', k)}
              className={`rounded-[10px] border px-3 py-3 text-sm font-semibold transition ${
                form.kind === k ? 'border-primary bg-red-50 text-primary' : 'border-slate-200 bg-surface text-slate-700'
              }`}
            >
              {k === 'sell' ? `💸 ${t('market.kindSell')}` : `🎁 ${t('market.kindFree')}`}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t('market.category')}
          <select
            value={form.category}
            onChange={(e) => {
              const category = e.target.value as MarketCategory
              setForm((f) => ({
                ...f,
                category,
                course: category === 'textbook' ? (f.course ?? profile?.course ?? null) : f.course,
                for_year: category === 'textbook' ? (f.for_year ?? 1) : f.for_year,
              }))
            }}
            className={inputClass}
          >
            {(Object.keys(MARKET_CATEGORIES) as MarketCategory[]).map((c) => (
              <option key={c} value={c}>{MARKET_CATEGORIES[c].emoji} {t(CATEGORY_KEYS[c])}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t('market.condition')}
          <select value={form.condition} onChange={(e) => set('condition', e.target.value as MarketCondition)} className={inputClass}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{t(CONDITION_KEYS[c])}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium sm:col-span-2">
          {t('market.titleLabel')} *
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={120}
            placeholder={isBook ? t('market.titlePlaceholderBook') : t('market.titlePlaceholder')}
            className={inputClass}
          />
        </label>

        {form.kind === 'sell' && (
          <label className="text-sm font-medium">
            {t('market.price')} *
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-sm text-slate-400">₩</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d,]/g, ''))}
                inputMode="numeric"
                placeholder="15,000"
                className={`${inputClass} pl-7`}
              />
            </div>
          </label>
        )}

        {isBook && (
          <>
            <label className="text-sm font-medium">
              {t('market.course')}
              <input
                value={form.course ?? ''}
                onChange={(e) => set('course', e.target.value)}
                maxLength={100}
                placeholder={t('market.coursePlaceholder')}
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              {t('market.subjectCode')}
              <input
                value={form.subject_code ?? ''}
                onChange={(e) => set('subject_code', e.target.value)}
                maxLength={30}
                placeholder="MAT1001"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              {t('market.forYear')}
              <select
                value={form.for_year ?? ''}
                onChange={(e) => set('for_year', e.target.value ? Number(e.target.value) : null)}
                className={inputClass}
              >
                <option value="">{t('market.anyYear')}</option>
                {[1, 2, 3, 4].map((y) => (
                  <option key={y} value={y}>{t('market.year')} {y}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="text-sm font-medium sm:col-span-2">
          {t('market.description')}
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={2000}
            placeholder={isBook ? t('market.descriptionPlaceholderBook') : t('market.descriptionPlaceholder')}
            className={inputClass}
          />
        </label>

        <label className="text-sm font-medium">
          {t('market.area')}
          <input value={form.area} onChange={(e) => set('area', e.target.value)} maxLength={80} placeholder={t('market.areaPlaceholder')} className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          {t('market.contact')} *
          <input
            value={form.contact}
            onChange={(e) => set('contact', e.target.value)}
            maxLength={200}
            placeholder={t('market.contactPlaceholder')}
            className={inputClass}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">{t('market.contactHint')}</span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('market.photos')}</p>
        {photos.length > 0 && (
          <PhotoGallery
            photos={photos}
            userId={userId}
            onDelete={async (p) => {
              await deletePhoto(p)
              setPhotos((list) => list.filter((x) => x.id !== p.id))
            }}
          />
        )}
        {roomForPhotos > 0 && <PhotoPicker files={files} onChange={setFiles} max={roomForPhotos} />}
      </div>

      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={buttonPrimary}>
          {busy ? t('market.saving') : initial ? t('market.save') : t('market.post')}
        </button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>{t('market.cancel')}</button>
        {initial && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm(t('market.deleteConfirm'))) return
              try {
                await deleteMarketListing(initial.id)
                await onDeleted()
              } catch (err) {
                setError(friendlyError(err))
              }
            }}
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-red-600"
          >
            <Trash2 size={15} /> {t('market.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
