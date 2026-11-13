import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

/** "Home › Clubs › EMSU Badminton". The last item is the current page. */
export default function Breadcrumbs({ items }: { items: [label: string, to?: string][] }) {
  const all: [string, string?][] = [['Home', '/'], ...items]
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {all.map(([label, to], i) => {
          const last = i === all.length - 1
          return (
            <li key={`${label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden />}
              {last || !to ? (
                <span aria-current={last ? 'page' : undefined} className="max-w-[16rem] truncate font-semibold text-slate-800">
                  {label}
                </span>
              ) : (
                <Link to={to} className="hover:text-primary hover:underline">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
