import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, Home, MessagesSquare } from 'lucide-react'

import { usePageMeta } from '../lib/usePageMeta'
import { buttonPrimary, buttonSecondary } from '../components/ui'
import Songket from '../components/Songket'

export default function NotFoundPage() {
  usePageMeta('Page not found')
  const location = useLocation()

  return (
    <section className="relative overflow-hidden py-10 sm:py-16">
      <Songket className="absolute right-0 top-0 hidden h-full w-1/2 opacity-20 [mask-image:linear-gradient(to_left,black_20%,transparent)] md:block" />
      <div className="relative max-w-2xl">
        <p className="font-display text-[7rem] text-gold sm:text-[10rem]">404</p>
        <h1 className="font-display text-5xl sm:text-6xl">Sesat jalan?</h1>
        <p className="mt-4 text-[17px] leading-7 text-slate-600">
          There's no page at <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[15px]">{location.pathname}</code>.
          The link may be old, or the post or event was removed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/" className={buttonPrimary}>
            <Home size={16} /> Go home
          </Link>
          <Link to="/discuss" className={buttonSecondary}>
            <MessagesSquare size={16} /> Discussions
          </Link>
          <Link to="/explore" className={buttonSecondary}>
            <Compass size={16} /> Opportunities
          </Link>
          <button type="button" onClick={() => window.history.back()} className={buttonSecondary}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </div>
    </section>
  )
}
