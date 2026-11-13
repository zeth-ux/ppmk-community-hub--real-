import { clubGradient } from '../lib/format'
import type { Club } from '../lib/types'

/** Logo if the club has one, otherwise coloured initials. */
export default function ClubAvatar({
  club,
  size = 'md',
}: {
  club: Pick<Club, 'name' | 'logo_url'>
  size?: 'md' | 'lg'
}) {
  const dims = size === 'lg' ? 'h-20 w-20 text-2xl rounded-2xl' : 'h-12 w-12 text-base rounded-xl'
  const initials = club.name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

  if (club.logo_url) {
    return <img src={club.logo_url} alt={`${club.name} logo`} className={`${dims} shrink-0 border-2 border-white object-cover `} />
  }
  return (
    <div className={`${dims} flex shrink-0 items-center justify-center bg-gradient-to-br font-extrabold text-white  ${clubGradient(club)}`}>
      {initials}
    </div>
  )
}
