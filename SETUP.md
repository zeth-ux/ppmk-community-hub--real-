# Setup guide (do this once, ~15 minutes)

Everything here is on free plans. Nothing costs money.

## 1. Create the database tables

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Run every file in `supabase/migrations/` **in number order**, each one in a new query:
   copy **all** of the file, paste, click **Run**.
   - `0001_init.sql`: tables and permission rules (run once only)
   - `0002_explicit_grants.sql`: table access for the app (needed on Supabase projects
     created in 2026; safe to run again)
   - `0003_ai.sql`: AI daily limits + saved AI announcements
3. You should see "Success. No rows returned". Check **Table Editor**: you now have
   `profiles`, `events`, `rsvps`, `event_invites`, `clubs` (with 4 starter clubs).

> Whenever a new numbered file appears in `supabase/migrations/`, run just that new file.
> If one fails, tell Claude the error message.

## 2. Connect the app to Supabase

Supabase → **Project Settings → API** (or **API Keys**). Copy:

- **Project URL**: `https://gsvedpiuiylymgqlaviv.supabase.co`
- **anon / publishable key**: the *public* one. Never use the `service_role` / secret key.

**Local:** open `.env.local` in the project folder and paste the key after
`VITE_SUPABASE_ANON_KEY=`. (This file is ignored by git, so it never gets pushed.)

**Vercel:** Project → **Settings → Environment Variables**, add both:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://gsvedpiuiylymgqlaviv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon/publishable key |

Then **Deployments → ⋯ → Redeploy** (env vars only apply to new deploys).

## 3. Login settings in Supabase

**Authentication → URL Configuration**

- **Site URL**: your Vercel address, e.g. `https://ppmk-community-hub.vercel.app`
- **Redirect URLs**: add both
  - `http://localhost:5173/**`
  - `https://YOUR-APP.vercel.app/**`

**Authentication → Sign In / Providers → Email**: make sure Email is enabled.

**Authentication → Emails (Templates) → Magic Link**: replace the body with this, so
the email has *both* a link and a code (the code is what saves people who open the
link inside KakaoTalk/WhatsApp):

```html
<h2>Sign in to PPMK Community Hub</h2>
<p><a href="{{ .ConfirmationURL }}">Tap here to sign in</a></p>
<p>Or enter this code in the app: <strong style="font-size:20px">{{ .Token }}</strong></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

Do the same for the **Confirm signup** template (new users get that one first).

## 4. Make yourself the first admin

1. Run the app, sign in with your email, and fill in your profile.
2. Supabase → SQL Editor → run (with your email):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

3. Refresh the app. You'll see **Organize** and **Admin**. From now on, promote
   other organizers from the Admin page. No more SQL needed.

## 5. Run it on your computer

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## 6. Turn on the AI features

1. Get a free key: https://aistudio.google.com → **Get API key** → **Create API key**.
   Treat it like a password: never paste it in chat, code, or anything starting with `VITE_`.
2. **Vercel** → Settings → Environment Variables → add `GEMINI_API_KEY` = your key → Save →
   Deployments → ⋯ → **Redeploy**.
3. **Local** (optional, for `npm run dev` and the test set): add this line to `.env.local`:
   ```
   GEMINI_API_KEY=your-key
   ```
4. Optional: choose the model with `GEMINI_MODEL` (default `gemini-3.5-flash-lite`).
   Other options: `gemini-3.8-flash`, or the open-source `gemma-4-26b-a4b-it`.

Daily limits per person (see `0003_ai.sql`): 40 AI form fills and 40 announcements for
organizers, 30 chatbot questions for everyone.

### Run the AI test set (for the report)

```bash
npm run ai:eval -- gemini-3.5-flash-lite gemma-4-26b-a4b-it
```

It scores each model on 24 real-style notes (English, Malay, Korean, slang, traps),
6 announcements and 16 chatbot questions (including off-topic, made-up-event and
prompt-injection tests), and saves a Markdown report in `scripts/ai-eval/results/`.
It waits between calls to stay inside the free limit, so it takes about 4 minutes per
model. Run one part only with `--only=extract`, `--only=announce` or `--only=ask`.

## 7. Before the pilot

Supabase's built-in email only sends a **few emails per hour**. Fine for testing, but not
enough for 70 people signing in on the same day. Before the pilot, set up free custom SMTP:
Resend (free tier) → get SMTP credentials → Supabase **Authentication → Emails → SMTP
Settings**. Claude will walk you through it.

Also: Supabase free projects **pause after 7 days with no activity**. Open the site at least
once a week (a free automatic keep-alive will be added later).
