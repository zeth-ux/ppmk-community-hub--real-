import { useMemo } from 'react'
import { encode } from 'uqr'

/**
 * A QR code drawn as a crisp SVG (sharp at any size, works offline).
 * Always black on white with a quiet border, so phone cameras read it
 * easily, even in dark mode or a dim hall.
 */
export default function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const { path, cells } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 })
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { path: d, cells: qr.size }
  }, [value])

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <rect width={cells} height={cells} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
