// Design-preview stand-in for src/lib/supabase.ts (used only by `npm run demo`).
// A tiny fake client: you are always signed in, nothing goes over the network.
import { DEMO_USER_ID, demoProfile } from './data'

export const supabaseConfigured = true

export const demoSession = {
  access_token: 'demo-token',
  refresh_token: 'demo-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: DEMO_USER_ID, email: demoProfile.email },
}

const ok = <T>(data: T) => Promise.resolve({ data, error: null })

export const supabase = {
  auth: {
    getSession: () => ok({ session: demoSession }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOtp: () => ok({}),
    verifyOtp: () => {
      // Any 6 digits work in the preview.
      window.dispatchEvent(new Event('demo-sign-in'))
      return ok({ session: demoSession })
    },
    signOut: () => ok(null),
  },
}
