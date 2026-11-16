import { useEffect, useState } from 'react'
import {
  BookOpen,
  Copy,
  ExternalLink,
  Flag,
  HandHeart,
  MapPin,
  MessageCircle,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import {
  askMarketContact,
  deleteMarketListing,
  deletePhoto,
  listMarketInterests,
  renewMarketListing,
  reportMarketListing,
  setMarketListingStatus,
  withdrawMarketInterest,
} from '../../lib/api'
import { friendlyError, timeAgo } from '../../lib/format'
import { MARKET_CATEGORIES, type MarketInterest, type MarketListing, type MarketStatus, type Photo } from '../../lib/types'
import { ErrorBox, buttonPrimary, buttonSecondary, inputClass } from '../ui'
import { PhotoGallery } from '../photos'
import { CATEGORY_KEYS, CONDITION_KEYS, contactLink, formatPrice, type Translate } from './shared'

export default function ListingDetail({
  listing,
  photos,
  onClose,
  onChanged,
  onEdit,
}: {
  /** Undefined when the link points to something you can't see (sold, removed). */
  listing: MarketListing | undefined
  photos: Photo[]
  onClose: () => void
  onChanged: () => Promise<void>
  onEdit: (l: MarketListing) => void
}) {
  const { t, language } = useLanguage()

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label={listing?.title ?? t('market.notFound')} className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label={t('market.close')} className="absolute right-3 top-3 z-10 rounded-full bg-surface/90 p-2 text-slate-500 hover:bg-slate-100">
          <X size={20} />
        </button>
        {listing ? (
          <Body listing={listing} photos={photos} t={t} language={language} onChanged={onChanged} onEdit={onEdit} onClose={onClose} />
        ) : (
          <div className="py-10 text-center">
            <p className="font-semibold">{t('market.notFound')}</p>
            <p className="mt-1 text-sm text-slate-500">{t('market.notFoundHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Body({
  listing: l,
  photos,
  t,
  language,
  onChanged,
  onEdit,
  onClose,
}: {
  listing: MarketListing
  photos: Photo[]
  t: Translate
  language: string
  onChanged: () => Promise<void>
  onEdit: (l: MarketListing) => void
  onClose: () => void
}) {
  const { session, isAdmin } = useAuth()
  const userId = session?.user.id ?? null
  const [error, setError] = useState('')

  async function act(fn: () => Promise<unknown>) {
    setError('')
    try {
      await fn()
      await onChanged()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  return (
    <div className="space-y-5">
      {photos.length > 0 ? (
        <div className="pr-8">
          <PhotoGallery photos={photos} userId={userId} canManage={isAdmin} onDelete={(p) => act(() => deletePhoto(p))} />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center rounded-xl bg-slate-100 text-6xl">{MARKET_CATEGORIES[l.category].emoji}</div>
      )}

      <div>
        <p className={`text-2xl font-bold ${l.kind === 'free' ? 'text-green-700' : ''}`}>{formatPrice(l, t, language)}</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">{l.title}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{MARKET_CATEGORIES[l.category].emoji} {t(CATEGORY_KEYS[l.category])}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t(CONDITION_KEYS[l.condition])}</span>
          {l.status === 'reserved' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{t('market.statusReserved')}</span>}
          {l.status === 'done' && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-white">{t('market.statusDone')}</span>}
          {l.expired && l.status !== 'done' && <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">{t('market.expired')}</span>}
        </div>
      </div>

      {l.category === 'textbook' && (l.course || l.subject_code || l.for_year) && (
        <div className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
          <p className="flex items-center gap-2 font-semibold"><BookOpen size={15} /> {t('market.passTheBook')}</p>
          <p className="mt-1">
            {[l.subject_code, l.course, l.for_year ? `${t('market.year')} ${l.for_year}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {l.description && <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{l.description}</p>}

      <div className="space-y-1 text-sm text-slate-600">
        {l.area && <p className="flex items-center gap-2"><MapPin size={15} className="shrink-0 text-slate-400" /> {l.area}</p>}
        <p className="text-xs text-slate-500">
          @{l.seller_username ?? '…'} · {t('market.listed')} {timeAgo(l.bumped_at)}
        </p>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {l.is_mine ? (
        <SellerTools l={l} t={t} act={act} onEdit={onEdit} />
      ) : (
        <BuyerTools l={l} t={t} userId={userId} act={act} />
      )}

      {!l.is_mine && <ReportBox l={l} t={t} />}

      {isAdmin && !l.is_mine && (
        <button
          onClick={() =>
            window.confirm(t('market.deleteConfirm')) &&
            act(async () => {
              await deleteMarketListing(l.id)
              onClose()
            })
          }
          className="inline-flex items-center gap-1 text-sm font-semibold text-red-600"
        >
          <Trash2 size={15} /> {t('market.adminRemove')}
        </button>
      )}

      <details className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-slate-700">
          <ShieldCheck size={14} className="text-green-600" /> {t('market.safetyTitle')}
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('market.safety1')}</li>
          <li>{t('market.safety2')}</li>
          <li>{t('market.safety3')}</li>
          <li>{t('market.safety4')}</li>
        </ul>
      </details>
    </div>
  )
}

function ContactBox({ contact, t }: { contact: string; t: Translate }) {
  const link = contactLink(contact)
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-green-800">{t('market.contactSeller')}</p>
      {link ? (
        <a href={link} target="_blank" rel="noreferrer" className={`${buttonPrimary} mt-2 w-full`}>
          <MessageCircle size={16} /> {t('market.openChat')} <ExternalLink size={14} />
        </a>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="break-all font-semibold text-green-900">{contact}</p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(contact)
                setCopied(true)
              } catch {
                // Clipboard blocked (some in-app browsers): the text is still on screen.
              }
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-green-800"
          >
            <Copy size={13} /> {copied ? t('market.copied') : t('market.copy')}
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-green-800">{t('market.contactNext')}</p>
    </div>
  )
}

function BuyerTools({
  l,
  t,
  userId,
  act,
}: {
  l: MarketListing
  t: Translate
  userId: string | null
  act: (fn: () => Promise<unknown>) => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (l.i_asked && l.contact) {
    return (
      <div className="space-y-2">
        <ContactBox contact={l.contact} t={t} />
        {userId && (
          <button
            onClick={() => window.confirm(t('market.withdrawConfirm')) && act(() => withdrawMarketInterest(l.id, userId))}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            {t('market.withdraw')}
          </button>
        )}
      </div>
    )
  }

  if (l.status === 'done') return <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-600">{t('market.alreadyGone')}</p>

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <label className="block text-sm font-medium">
        {t('market.messageLabel')}
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder={l.kind === 'free' ? t('market.messagePlaceholderFree') : t('market.messagePlaceholder')}
          className={inputClass}
        />
      </label>
      <p className="text-xs leading-5 text-slate-500">{t('market.sharedWithSeller')}</p>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await act(() => askMarketContact(l.id, message))
          setBusy(false)
        }}
        className={`${buttonPrimary} w-full`}
      >
        <HandHeart size={16} /> {busy ? t('market.saving') : t('market.interested')}
      </button>
      {l.status === 'reserved' && <p className="text-xs text-amber-700">{t('market.reservedHint')}</p>}
    </div>
  )
}

function SellerTools({
  l,
  t,
  act,
  onEdit,
}: {
  l: MarketListing
  t: Translate
  act: (fn: () => Promise<unknown>) => Promise<void>
  onEdit: (l: MarketListing) => void
}) {
  const [interests, setInterests] = useState<MarketInterest[] | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    listMarketInterests(l.id).then(
      (rows) => !cancelled && setInterests(rows),
      (err: unknown) => !cancelled && setLoadError(friendlyError(err)),
    )
    return () => {
      cancelled = true
    }
  }, [l.id])

  const statuses: { value: MarketStatus; label: string }[] = [
    { value: 'available', label: t('market.statusAvailable') },
    { value: 'reserved', label: t('market.statusReserved') },
    { value: 'done', label: l.kind === 'free' ? t('market.statusGiven') : t('market.statusSold') },
  ]

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="text-sm font-semibold">{t('market.status')}</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {statuses.map((s) => (
            <button
              key={s.value}
              aria-pressed={l.status === s.value}
              onClick={() => l.status !== s.value && act(() => setMarketListingStatus(l.id, s.value))}
              className={`rounded-lg px-2 py-2 text-xs font-bold transition ${
                l.status === s.value ? 'bg-ink text-on-ink' : 'border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {l.expired && l.status !== 'done' && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p>{t('market.expiredHint')}</p>
          <button onClick={() => act(() => renewMarketListing(l.id))} className="mt-2 inline-flex items-center gap-1 font-bold text-amber-900">
            <RefreshCw size={14} /> {t('market.renew')}
          </button>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold">
          {t('market.interestedPeople')} {interests ? `(${interests.length})` : ''}
        </p>
        <ErrorBox>{loadError}</ErrorBox>
        {interests && interests.length === 0 && <p className="mt-1 text-sm text-slate-500">{t('market.noInterestYet')}</p>}
        {interests && interests.length > 0 && (
          <ul className="mt-2 space-y-2">
            {interests.map((i, n) => (
              <li key={n} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold">
                  {i.full_name ?? '—'} <span className="font-normal text-slate-500">@{i.username ?? '…'}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {[i.batch ? `${t('market.batch')} ${i.batch}` : null, i.course].filter(Boolean).join(' · ')} · {timeAgo(i.created_at)}
                </p>
                {i.message && <p className="mt-1 text-slate-700">“{i.message}”</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">{t('market.theyWillContact')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => onEdit(l)} className={buttonSecondary}>
          <Pencil size={15} /> {t('market.editPhotos')}
        </button>
      </div>
    </div>
  )
}

function ReportBox({ l, t }: { l: MarketListing; t: Translate }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  if (done) return <p className="text-xs font-semibold text-slate-500">{t('market.reported')}</p>
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-600">
        <Flag size={13} /> {t('market.report')}
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/50 p-3">
      <label className="block text-xs font-semibold">
        {t('market.reportWhy')}
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputClass} />
      </label>
      <ErrorBox>{error}</ErrorBox>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            setError('')
            if (reason.trim().length < 3) return setError(t('market.reportTooShort'))
            try {
              await reportMarketListing(l.id, reason.trim())
              setDone(true)
            } catch (err) {
              setError(friendlyError(err))
            }
          }}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white"
        >
          {t('market.sendReport')}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600">
          {t('market.cancel')}
        </button>
      </div>
    </div>
  )
}
