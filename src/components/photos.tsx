import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, ImagePlus, ShieldCheck, Trash2, X, XCircle } from 'lucide-react'

import { MAX_PHOTOS_PER_POST } from '../lib/images'
import type { Photo } from '../lib/types'

/** Choose photos before posting. Shows previews and the approval note. */
export function PhotoPicker({
  files,
  onChange,
  max = MAX_PHOTOS_PER_POST,
  label = 'Add photos',
}: {
  files: File[]
  onChange: (files: File[]) => void
  max?: number
  label?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {previews.map((url, i) => (
          <div key={url} className="relative h-20 w-20 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-24">
            <img src={url} alt={`Selected photo ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              aria-label="Remove photo"
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-xs font-semibold text-slate-500 transition hover:border-primary hover:text-primary sm:h-24 sm:w-24"
          >
            <ImagePlus size={20} />
            {files.length === 0 ? label : 'More'}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
          onChange([...files, ...picked].slice(0, max))
          e.target.value = ''
        }}
      />
      <p className="flex items-start gap-1.5 text-xs leading-5 text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-600" />
        Up to {max} photos. An admin checks every photo before others can see it, usually within a day. Please don't
        post photos of people without asking them.
      </p>
    </div>
  )
}

/**
 * Photo grid. Approved photos for everyone; your own pending/rejected ones
 * show a label so you know what's happening.
 */
export function PhotoGallery({
  photos,
  userId,
  canManage = false,
  onDelete,
  size = 'md',
}: {
  photos: Photo[]
  userId?: string | null
  canManage?: boolean
  onDelete?: (photo: Photo) => void
  size?: 'md' | 'lg'
}) {
  const [open, setOpen] = useState<number | null>(null)
  if (photos.length === 0) return null

  const approved = photos.filter((p) => p.status === 'approved')
  const single = photos.length === 1

  return (
    <>
      <div className={`grid gap-2 ${single ? 'grid-cols-1' : photos.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {photos.map((p) => {
          const mine = p.uploaded_by === userId
          return (
            <div
              key={p.id}
              className={`group relative overflow-hidden rounded-xl bg-slate-100 ${
                single ? (size === 'lg' ? 'aspect-[16/10]' : 'aspect-[16/9]') : 'aspect-square'
              }`}
            >
              <button
                type="button"
                onClick={() => p.status === 'approved' && setOpen(approved.indexOf(p))}
                className="h-full w-full"
                aria-label="Open photo"
              >
                <img
                  src={p.url}
                  alt={p.caption || (p.status === 'approved' ? 'Shared photo' : 'Your photo, waiting for approval')}
                  loading="lazy"
                  className={`h-full w-full object-cover transition ${p.status !== 'approved' ? 'opacity-50 blur-[1px]' : 'group-hover:scale-[1.02]'}`}
                />
              </button>
              {p.status === 'pending' && (
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg bg-surface/95 px-2 py-1 text-[11px] font-bold text-amber-700 ">
                  <Clock size={12} /> Waiting for admin approval
                </span>
              )}
              {p.status === 'rejected' && (
                <span className="absolute inset-x-2 bottom-2 rounded-lg bg-surface/95 px-2 py-1 text-center text-[11px] font-bold text-red-700 ">
                  <XCircle size={12} className="mr-1 inline" />
                  Not approved{p.reject_reason ? `: ${p.reject_reason}` : ''}
                </span>
              )}
              {(mine || canManage) && onDelete && (
                <button
                  type="button"
                  onClick={() => window.confirm('Delete this photo?') && onDelete(p)}
                  aria-label="Delete photo"
                  className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white opacity-90 hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {open !== null && approved[open] && (
        <Lightbox photos={approved} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  )
}

function Lightbox({
  photos,
  index,
  onIndex,
  onClose,
}: {
  photos: Photo[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length)
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length)
    }
    document.addEventListener('keydown', key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = overflow
    }
  }, [index, photos.length, onClose, onIndex])

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <img src={photos[index].url} alt={photos[index].caption || `Photo ${index + 1} of ${photos.length}`} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white hover:bg-white/25">
        <X size={22} />
      </button>
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onIndex((index - 1 + photos.length) % photos.length)
            }}
            aria-label="Previous photo"
            className="absolute left-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onIndex((index + 1) % photos.length)
            }}
            aria-label="Next photo"
            className="absolute right-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
          >
            <ChevronRight size={26} />
          </button>
          <p className="absolute bottom-4 text-sm font-semibold text-white/80">
            {index + 1} / {photos.length}
          </p>
        </>
      )}
    </div>
  )
}
