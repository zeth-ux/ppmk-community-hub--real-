import { useState } from 'react'
import { BellRing } from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { setEmailReminders } from '../lib/api'
import { friendlyError } from '../lib/format'
import { ErrorBox, card } from './ui'

/** Me page: switch "your event is tomorrow" emails on or off. */
export default function EmailRemindersToggle() {
  const { session, profile, setProfile } = useAuth()
  const { t } = useLanguage()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Hidden until the reminders database update (0009) is installed.
  if (!session || !profile || profile.email_reminders === undefined) return null
  const on = profile.email_reminders

  async function toggle() {
    setSaving(true)
    setError('')
    try {
      setProfile(await setEmailReminders(session!.user.id, !on))
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 shrink-0 text-primary" size={21} />
          <div>
            <h2 id="reminders-label" className="font-bold">{t('reminders.title')}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t('reminders.body').replace('{email}', profile.email)}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="reminders-label"
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${on ? 'bg-primary' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
          />
        </button>
      </div>
      <div className="mt-3">
        <ErrorBox>{error}</ErrorBox>
      </div>
    </section>
  )
}
