import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/**
 * Six separate boxes for the 6-digit sign-in code. Typing moves to the next
 * box, Backspace goes back, and pasting the whole code (or the phone's
 * "From Messages / Mail" autofill) fills every box at once.
 */
export default function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  function setFrom(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, '')
    if (!incoming) return
    const next = (value.slice(0, index) + incoming).slice(0, length)
    onChange(next)
    refs.current[Math.min(next.length, length - 1)]?.focus()
    if (next.length === length) onComplete?.(next)
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[index]) {
        onChange(value.slice(0, index) + value.slice(index + 1))
      } else if (index > 0) {
        onChange(value.slice(0, index - 1) + value.slice(index))
        refs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    setFrom(0, e.clipboardData.getData('text'))
  }

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="6-digit code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoFocus={i === 0}
          maxLength={i === 0 ? length : 1}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setFrom(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.currentTarget.select()}
          className={`h-14 w-full min-w-0 rounded-xl border bg-surface text-center text-2xl font-bold text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-red-100 disabled:bg-slate-50 sm:h-16 ${
            digit ? 'border-slate-400' : 'border-slate-200'
          }`}
        />
      ))}
    </div>
  )
}
