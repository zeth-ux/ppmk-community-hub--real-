/** PPMK mark: a songket diamond in Jalur Gemilang gold on PPMK red. */
export default function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#AC0024" />
      <path d="M32 11 53 32 32 53 11 32Z" fill="none" stroke="#F2B33D" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M32 23 41 32 32 41 23 32Z" fill="#F2B33D" />
    </svg>
  )
}
