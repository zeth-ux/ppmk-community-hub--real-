import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/format'
import { safeNext } from '../components/guards'
import {
  ErrorBox,
  Spinner,
  buttonPrimary,
  card,
  inputClass,
} from '../components/ui'

export default function LoginPage() {
  const { loading, session } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <Spinner label="Signing you in…" />
  if (session) return <Navigate to={next} replace />

  async function sendLink(event?: FormEvent) {
    event?.preventDefault()
    setError('')

    const cleaned = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setError('Please enter a valid email address.')
      return
    }

    setBusy(true)

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(next)}`,
      },
    })

    setBusy(false)

    if (otpError) {
      setError(friendlyError(otpError))
      return
    }

    setEmail(cleaned)
    setStep('code')
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault()
    setError('')

    const token = code.replace(/\s/g, '')

    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from the email (numbers only).')
      return
    }

    setBusy(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    setBusy(false)

    if (verifyError) {
      setError(friendlyError(verifyError))
    }
    // On success the auth listener picks up the session and this page
    // redirects to `next` on the next render.
  }

  return (
    <div className="mx-auto max-w-md py-4 sm:py-10">
      <div className={`${card} p-6 sm:p-8`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-primary">
          <Mail size={22} />
        </div>

        {step === 'email' ? (
          <form onSubmit={sendLink} className="mt-5 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Sign in</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                No password needed. We'll email you a sign-in link and a code.
                New here? The same step creates your account.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hanyang.ac.kr"
                className={inputClass}
              />
            </label>

            <ErrorBox>{error}</ErrorBox>

            <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-5 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                We sent a message to <strong className="text-slate-800">{email}</strong>.
                Tap the link in it, <em>or</em> type the code here. The code is
                handy if you opened this page inside KakaoTalk or WhatsApp.
              </p>
            </div>

            <label className="block text-sm font-medium">
              Code from the email
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                className={`${inputClass} text-center text-lg tracking-[0.4em]`}
              />
            </label>

            <ErrorBox>{error}</ErrorBox>

            <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
              {busy ? 'Checking…' : 'Sign in'}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError('')
                }}
                className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-primary"
              >
                <ArrowLeft size={15} />
                Change email
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void sendLink()}
                className="font-semibold text-primary disabled:opacity-50"
              >
                Resend email
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Can't find it? Check your spam folder. Codes expire after an hour.
            </p>
          </form>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck size={14} />
        Your details are only used to run PPMK/EMSU events.
      </p>
    </div>
  )
}
