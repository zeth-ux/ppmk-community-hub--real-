import { useEffect } from 'react'

const SITE = 'PPMK Community Hub'
const DEFAULT_DESCRIPTION =
  'Events, clubs, halal makan and hidden gems for Malaysian students in Korea. Run by PPMK and EMSU at Hanyang ERICA.'

/** Sets the browser tab title ("Clubs · PPMK Community Hub") and meta description. */
export function usePageMeta(title: string | null | undefined, description?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE}: jauh di mata, dekat di hati`
    const meta = document.querySelector('meta[name="description"]')
    meta?.setAttribute('content', (description || DEFAULT_DESCRIPTION).slice(0, 160))
  }, [title, description])
}
