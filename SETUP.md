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
   - `0004_clubs_discussions.sql`: usernames, club pages & roles, club applications,
     discussion board (Explore Korea / Student life / Team up), visitor accounts,
     Explore opportunities, and the public homepage data. **Run this only after the team agrees** (it changes the shared
     database). It only adds things; existing data is untouched. After it runs, everyone
     is asked to pick a username the next time they open the app.
   - `0005_photos.sql`: photo uploads (discussion posts, club posts, club gallery).
     Creates a private storage bucket called `photos`. Every photo waits for an admin
     to approve it under **Admin → Photos to review**. Run it right after 0004.
   - `0006_organization.sql`: the PPMK page (`/ppmk`): High Committee, PPMK calendar,
     MARA/JPA officers, with a photo for each person (public storage space `org-photos`).
     Admins fill it in from the page itself (**Edit page** button).
     Names and roles are public; phone numbers and emails only show to signed-in members.
   - `0007_event_feedback.sql`: "How was it?" after an event (1–5 stars + comment) for
     people who went, open for 14 days. Organizers see the average and comments on the
     Organize page, **without names**; admins see the hub total on the Admin page.
   - `0008_qr_checkin.sql`: a check-in QR code for everyone going (on the event page).
     Organizers scan it with their normal phone camera and tap the link; that checks the
     student in. Only organizers/admins can use the codes.
   - `0009_event_reminders.sql`: "your event is tomorrow" emails (see section 8) and an
     on/off switch on the Me page. Safe to run before the Gmail is ready: nothing is
     sent until section 8 is done.
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

**Authentication → Sign In / Providers → Email**: make sure Email is enabled, and set
**Email OTP Length** to **6** (the sign-in screen has 6 boxes for the code).

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

**Design preview (no Supabase needed):** `npm run demo` opens the site with fake data
and a "Preview" bar to switch between student / organizer / admin / signed out. Nothing
is saved; reload to reset. Handy for showing the design to the team.

**First club presidents:** for clubs that existed before 0004, an admin opens
**Admin → Clubs → Edit** and picks a president. They become an organizer and can manage
the club page from then on. New clubs come in through **Clubs → Start a club**.

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
Results are saved after every question, so you can stop with Ctrl+C at any time.
Slow models (Gemma) time out after 30 s; give them longer with
`$env:AI_TIMEOUT_MS=90000` (PowerShell) before running.

## 7. Before the pilot

Supabase's built-in email only sends a **few emails per hour**. Fine for testing, but not
enough for 70 people signing in on the same day. Before the pilot, set up free custom SMTP:
Resend (free tier) → get SMTP credentials → Supabase **Authentication → Emails → SMTP
Settings**. Claude will walk you through it.

Also: Supabase free projects **pause after 7 days with no activity**. Open the site at least
once a week (a free automatic keep-alive will be added later).

## 8. Reminder emails (the day before each event)

Every day at **09:00 Korea time**, Vercel runs `api/reminders.ts`. It emails everyone who
said **Going** or **Maybe** to an event **tomorrow**, from the shared EMSU Gmail, with
the time, place and a link to their check-in QR. Nobody gets two, and students can turn
it off on their Me page. It does **not** use the Supabase `service_role` key.

You need: migration `0009` run (section 1) and the shared Gmail's **app password**
(Google Account → Security → 2-Step Verification on → App passwords).

1. On your laptop, in the project folder: `npm run reminders:secret`. It prints a secret
   and one line of SQL.
2. **Supabase → SQL Editor:** run that SQL. (It stores only a fingerprint of the secret.)
3. **Vercel → Settings → Environment Variables** (Production), add:

   | Name | Value |
   |---|---|
   | `CRON_SECRET` | the secret from step 1 |
   | `GMAIL_USER` | the shared EMSU Gmail address |
   | `GMAIL_APP_PASSWORD` | its 16-character app password |
   | `APP_URL` | `https://ppmk-community-hub-real.vercel.app` |

4. **Deployments → ⋯ → Redeploy.** Vercel → **Settings → Cron Jobs** should now list
   `/api/reminders`.
5. **Test without sending anything:** Vercel → Cron Jobs → **Run** sends for real, so first
   try a test run from a terminal (replace the secret):

   ```bash
   curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://ppmk-community-hub-real.vercel.app/api/reminders?dry=1"
   ```

   You get counts only, e.g. `{"testMode":true,"due":12,"sent":0,...}`. No names or emails.

- Until `GMAIL_USER` / `GMAIL_APP_PASSWORD` are set, the job runs in **test mode** and
  sends nothing.
- Gmail allows about 500 emails a day: plenty for EMSU/PPMK.
- Vercel's free plan runs it once a day, sometime between 09:00 and 09:59.
- Unit tests: `npm run test:reminders` (fake database and mailer, no keys needed).
