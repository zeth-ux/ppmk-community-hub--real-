/**
 * Thin-line pattern inspired by songket weaving: nested diamonds on a
 * lattice. Drawn in gold at low opacity as the hero's backdrop, PPMK's own
 * stand-in for a photo. Decorative only.
 */
export default function Songket({ className = '' }: { className?: string }) {
  const cell = 34
  const cols = 14
  const rows = 24
  const diamonds = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell + (r % 2 ? cell / 2 : 0)
      const y = r * (cell / 2)
      const d = (s: number) => `M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y} Z`
      diamonds.push(
        <g key={`${r}-${c}`}>
          <path d={d(cell / 2)} />
          <path d={d(cell / 3.4)} />
          {(r + c) % 3 === 0 && <path d={d(cell / 9)} className="fill-current" />}
        </g>,
      )
    }
  }
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${cols * cell} ${(rows * cell) / 2}`}
      className={`pointer-events-none text-gold ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.8"
      preserveAspectRatio="xMaxYMid slice"
    >
      {diamonds}
    </svg>
  )
}
