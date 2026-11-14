import { useState, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { usePageMeta } from '../lib/usePageMeta'

import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/format'
import { safeNext } from '../components/guards'
import CodeInput from '../components/CodeInput'
import {
  ErrorBox,
  Spinner,
  buttonPrimary,
  card,
  inputClass,
} from '../components/ui'

export default function LoginPage() {
  const { t } = useLanguage()
  usePageMeta(t('login.title'), t('login.meta'))
  const { loading, session } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (loading) return <Spinner label={t('login.signingIn')} />
  if (session) return <Navigate to={next} replace />

  async function sendLink(event?: FormEvent) {
    event?.preventDefault()
    setError('')

    const cleaned = email.trim().toLowerCase()

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setError(t('login.invalidEmail'))
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

  async function verifyCode(event?: FormEvent, typed = code) {
    event?.preventDefault()
    setError('')

    const token = typed.replace(/\s/g, '')

    if (!/^\d{6}$/.test(token)) {
      setError(t('login.invalidCode'))
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
              <h1 className="text-2xl font-bold">{t('login.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t('login.intro')}
              </p>
            </div>

            <label className="block text-sm font-medium">
              {t('login.email')}
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
              {busy ? t('login.sending') : t('login.sendLink')}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-5 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">{t('login.checkEmail')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {t('login.sentTo')}{' '}<strong className="text-slate-800">{email}</strong>.{' '}
                {t('login.codeInstructions')}
              </p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('login.codeLabel')}</p>
              <CodeInput
                value={code}
                onChange={(v) => {
                  setCode(v)
                  setError('')
                }}
                onComplete={(v) => void verifyCode(undefined, v)}
                disabled={busy}
              />
            </div>

            <ErrorBox>{error}</ErrorBox>

            <button type="submit" disabled={busy || code.length !== 6} className={`${buttonPrimary} w-full`}>
              {busy ? t('login.checking') : t('login.title')}
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
                {t('login.changeEmail')}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => void sendLink()}
                className="font-semibold text-primary disabled:opacity-50"
              >
                {t('login.resend')}
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {t('login.spamHint')}
            </p>
          </form>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <ShieldCheck size={14} />
        {t('login.privacyNote')}
      </p>
    </div>
  )
}
