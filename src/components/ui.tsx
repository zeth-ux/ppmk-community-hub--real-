import type { ReactNode } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

export const inputClass =
  'mt-1.5 w-full rounded-[10px] border border-slate-200 bg-surface px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-red-100 disabled:bg-slate-50 disabled:text-slate-500'

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-container active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-500 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50'

export const card = 'rounded-xl border border-slate-200 bg-surface'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"
    >
      <Loader2 className="animate-spin text-primary" size={20} />
      {label}
    </div>
  )
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 shrink-0" size={16} />
      <div>{children}</div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  /** No longer shown (the big headline already says where you are). */
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-6 text-slate-600">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}
