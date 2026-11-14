// Makes the secret that lets the daily reminder job (api/reminders.ts)
// read "who has an event tomorrow" from the database.
// Run: npm run reminders:secret
//
// Prints two things:
//   1. the secret → paste into Vercel as CRON_SECRET (never commit it)
//   2. a line of SQL → run it in Supabase → SQL Editor. It stores only the
//      secret's SHA-256 fingerprint, so the database never holds the secret.
import { createHash, randomBytes } from 'node:crypto'

const secret = randomBytes(32).toString('base64url')
const hash = createHash('sha256').update(secret, 'utf8').digest('hex')

console.log(`
1) Vercel → Settings → Environment Variables → add (Production):

   CRON_SECRET = ${secret}

2) Supabase → SQL Editor → run:

   insert into private.job_secrets (name, secret_hash)
   values ('reminders', '${hash}')
   on conflict (name) do update set secret_hash = excluded.secret_hash, created_at = now();

3) Vercel → Deployments → ⋯ → Redeploy (new env vars only apply after a redeploy).

Treat the secret like a password: don't paste it in chats or screenshots.
Running this again makes a NEW secret; then update both places.
`)
