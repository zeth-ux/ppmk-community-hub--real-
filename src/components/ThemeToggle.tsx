import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'
const KEY = 'ppmk-theme'

function current(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Sun/moon switch. Starts from the device's light/dark setting (applied by
 * the script in index.html); once tapped, the choice is remembered.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(current)

  // Follow the device setting live until the person picks one themselves.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      let saved: string | null = null
      try {
        saved = localStorage.getItem(KEY)
      } catch {
        /* storage unavailable */
      }
      if (saved) return
      document.documentElement.classList.toggle('dark', media.matches)
      setTheme(current())
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable: still switches for this visit */
    }
    setTheme(next)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
      className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
