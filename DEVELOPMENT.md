# Development guide

How to work on the PPMK Community Hub day to day: environments, keys, running and testing
locally, the database, the Gemini AI, and deploying. Read `TEAM_BRIEF.md` first for the what & why.

**Contents:** 1. How it fits together · 2. Keys & environment variables · 3. First-time setup ·
4. Daily workflow · 5. Running & testing locally · 6. The database · 7. Working with Gemini ·
8. Vercel & deploying · 9. Troubleshooting · 10. Checklist before a PR

---

## 1. How it fits together

```
 Browser (React app)                         Vercel                       Google
 ─────────────────────                       ──────                       ──────
 src/…  ──── all data ───────────────────────────────────────────────▶  Supabase (Postgres + Auth)
        (src/lib/api.ts, with the user's login;                        row-level security decides
         the database rules decide what they can see)                  what each user can see/do
                                                                                ▲
 src/lib/ai.ts ── POST /api/ai ──▶ api/ai.ts (server function) ────────────────┘ (checks role + daily limit)
                                         │
                                         └── GEMINI_API_KEY ──▶ Gemini API
```

There are **three places the app runs**:

| | Where | Which database | Which Gemini key | Who uses it |
|---|---|---|---|---|
| **Local** | `npm run dev` on your laptop, http://localhost:5173 | Whatever is in your `.env.local` (today: the real one, see §6) | Your own key in `.env.local` | You |
| **Preview** | Vercel builds every PR → `https://ppmk-…-git-<branch>-….vercel.app` | Real one (Vercel env vars) | The project key in Vercel | Reviewers |
| **Production** | `main` → https://ppmk-community-hub-real.vercel.app | Real one | The project key in Vercel | Students |

---

## 2. Keys & environment variables: what's needed and why

| Variable | Needed? | Secret? | Where it lives | What breaks without it |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | **Yes** | No (public) | `.env.local` + Vercel | App shows *"Almost there: connect Supabase"* |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | No (public by design) | `.env.local` + Vercel | Same as above |
| `GEMINI_API_KEY` | Only for AI features | **YES** | `.env.local` (your own key) + Vercel (project key) | AI buttons & chatbot say *"AI is not set up"*; everything else works |
| `GEMINI_MODEL` | No | No | optional | Uses `gemini-3.5-flash-lite` |
| `AI_TIMEOUT_MS`, `AI_EVAL_DELAY_MS` | No | No | set in the terminal for the test set | Defaults: 30 s timeout, 4.5 s between test calls |
| `CRON_SECRET` | Only for reminder emails | **YES** | Vercel only | The daily reminder job refuses to run (`npm run reminders:secret` makes one) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Only for reminder emails | **YES** (password) | Vercel only | Reminders run in test mode: nothing is sent |
| `APP_URL` | No | No | Vercel | Links in emails use the Vercel production URL |

**Why is the Supabase "anon" key OK to share?** It's built into the live website's JavaScript, so
anyone can already see it. It only lets someone *ask* the database; the row-level security
rules in `supabase/migrations/` decide what they're allowed to read or change. That's why every
permission lives in the database.

**Keys you do NOT need, ever:**
- ❌ **Supabase `service_role` / secret key**: bypasses all security. Not used anywhere in this
  project. If you think you need it, you're solving the problem the wrong way; ask the lead.
- ❌ **Vercel tokens**: Vercel deploys automatically from GitHub. You don't need Vercel access to develop.
- ❌ **Database password / connection string**: the app never connects directly; only through Supabase's API.

**Rules:** `VITE_` variables end up in the browser, so never put a secret in one.
`.env.local` is git-ignored; keep it that way. Each person uses **their own** free Gemini key locally;
don't share keys in chat. If a secret leaks, tell the lead immediately so it can be rotated.

---

## 3. First-time setup (≈15 min)

Install **Node.js 22 or newer** (`node -v`), **Git**, **VS Code**.

```powershell
git clone https://github.com/zeth-ux/ppmk-community-hub--real-.git
cd ppmk-community-hub--real-
npm install
Copy-Item .env.example .env.local      # macOS/Linux: cp .env.example .env.local
notepad .env.local                     # fill in the values (see §2)
npm run dev
```

Open http://localhost:5173, sign in with your email, complete your profile. Ask the lead to make you
an **organizer** if you need the organizer screens.

> Sign-in emails: until Gmail SMTP is set up (task A1), Supabase only emails **members of the
> Supabase project**. If you get *"Email address not authorized"*, that's why.

---

## 4. Daily workflow

```powershell
git checkout main
git pull                                  # get everyone's latest work
npm install                               # only needed if package.json changed
git checkout -b feat/short-description    # one branch per task (feat/…, fix/…, docs/…)

npm run dev                               # build your thing; test at 390 px wide (phone)

npm run lint                              # all of these must pass
npm run build
npm run test:ai

git add .
git commit -m "Add QR code to event page"
git push -u origin feat/short-description
```

Then on GitHub: **Open a Pull Request** → describe what & how you tested → Vercel comments a
**preview link** → test it on your phone → the lead reviews and merges → it goes live automatically.

Keep PRs small (one task). If `main` moved on while you worked: `git pull origin main` on your
branch, fix conflicts, test again.

---

## 5. Running & testing locally

| Command | What it does | Needs |
|---|---|---|
| `npm run demo` | **Every screen with fake data**: no Supabase, no keys, no login. Switch role (visitor / student / organizer / admin) in the Preview bar. Best for UI work | nothing |
| `npm run dev` | App at http://localhost:5173 **including the AI endpoint** (`/api/ai` is served locally by `vite.config.ts`) | `.env.local` |
| `npm run lint` | Code style + React rules | nothing |
| `npm run build` | Type-check + production build (what Vercel runs) | nothing |
| `npm run test:ai` | 30 unit tests for `api/ai.ts` with a **fake** Gemini and fake Supabase | nothing (no keys, no internet) |
| `npm run test:reminders` | 12 unit tests for the reminder emails (`api/reminders.ts`) with fake Gmail and database | nothing |
| `npm run reminders:preview` | Prints an example reminder email | nothing |
| `npm run ai:eval` | Scores the **real** AI on the test set (§7) | `GEMINI_API_KEY` |
| `npm run test:db` | 300+ database permission tests (§6) | local PostgreSQL + Python |
| `npm run preview` | Serve the production build locally | run `npm run build` first |

Tips:
- After changing `.env.local`, **stop and restart** `npm run dev` (Ctrl+C, then run it again).
- To check the phone layout: browser DevTools (F12) → device toolbar → iPhone 12/13 (390 px).
  Better: open `http://<your-laptop-IP>:5173` on your phone on the same Wi-Fi
  (`npm run dev -- --host`). Login links from email will point to localhost though, so use the 6-digit code.

---

## 6. The database

### What's in it
`supabase/migrations/` is the **single source of truth**, numbered and run in order:

| File | What |
|---|---|
| `0001_init.sql` | Tables (`profiles`, `events`, `rsvps`, `event_invites`, `clubs`), row-level security rules, helper functions (`set_my_rsvp`, `event_attendees`, `check_in`, `set_user_role`, `hub_stats`, `delete_my_account`…) |
| `0002_explicit_grants.sql` | Table permissions for the app (Supabase projects created in 2026 need these) |
| `0003_ai.sql` | `events.announcements`, AI usage log + daily limits (`ai_begin`), `ai_usage_stats` |
| `0004_clubs_discussions.sql` | Usernames, visitors, club pages & roles, club applications, discussions, opportunities, public homepage functions |
| `0005_photos.sql` | Photos on posts and clubs, with admin approval |
| `0006_organization.sql` | PPMK organisation page (people, calendar) |
| `0007_event_feedback.sql` | "How was it?" feedback after events |
| `0008_qr_checkin.sql` | Personal check-in QR code per RSVP |
| `0009_event_reminders.sql` | Reminder emails the day before (`reminders_due`, `mark_reminded`) |
| `0010_checkin_confirm.sql` | Only the event's creator checks people in; QR asks first when something looks wrong |
| `0011_marketplace.sql` | Marketplace listings, interests, reports |
| `0012_link_checks.sql` | Club join links and application documents must be `https://` links |
| `0013_self_checkin.sql` | Door check-in (`door_code`, `self_check_in`), walk-ins, show-up numbers (`event_show_up`, `show_up_overview`) |

All database calls from the app go through **`src/lib/api.ts`**.

### Which database should I use locally?

| Option | Status | When |
|---|---|---|
| **A. The real Supabase project** | What we do now | Small UI work. Follow the `[TEST]` rules below. |
| **B. A second free Supabase project ("dev")** | **Recommended, task B3** | Any feature that writes data or changes the schema. |
| **C. Full local Supabase (Supabase CLI + Docker)** | Not set up; ask first | Advanced; heavy on Windows. |

**Rules while using the real database (A):** name test events `[TEST] …`, set them to
"Invite specific people" (only you), delete them when done. Don't create fake accounts there,
and never edit rows by hand in the Table Editor.

**Setting up a dev project (B), done once by the backend person:**
1. supabase.com → New project (free; you can have 2) → name `ppmk-hub-dev`, region Seoul.
2. SQL Editor → run every file in `supabase/migrations/` in order.
3. Authentication → URL Configuration → Site URL `http://localhost:5173`, Redirect URLs
   `http://localhost:5173/**`. Edit the Magic Link + Confirm signup email templates to include
   `{{ .Token }}` (copy from `SETUP.md` §3).
4. Invite the team as project members (built-in email only reaches members, 2 emails/hour,
   which is fine for dev; you stay signed in).
5. Everyone puts the **dev** URL + anon key in their `.env.local`. Vercel keeps the real ones.
6. Make yourselves admin in the dev project:
   `update public.profiles set role = 'admin' where email = 'you@…';`

### Changing the database (schema, rules, functions)
1. **Never edit a migration that has already been run.** Create the next numbered file, e.g. `supabase/migrations/0013_waitlist.sql`.
   Make it safe to re-run where possible (`create … if not exists`, `create or replace function`).
2. New table? **Enable row-level security, add policies, and add explicit `grant`s**
   (see `0002` for the pattern). Without grants you get *"permission denied for table"*.
3. Add tests to `supabase/tests/test_rls.py` (who **can** and who **can't**), run `npm run test:db`.
4. Add the new calls to `src/lib/api.ts` and types to `src/lib/types.ts`.
5. In the PR, say "needs migration 00XX". After review the lead runs it on **dev**, then on **production**
   (SQL Editor), *before* merging the code that uses it.

### Database permission tests (`npm run test:db`)
These run the migrations on a **local, throwaway PostgreSQL** that imitates Supabase, then try
300+ things as different users (student, organizer, admin, visitor, signed-out).

Windows setup (once):
1. Install **PostgreSQL 16** (postgresql.org/download → Windows installer). Remember the password
   for the `postgres` user. Tick "Command Line Tools".
2. Add `C:\Program Files\PostgreSQL\16\bin` to your PATH (so `psql --version` works).
3. `pip install psycopg2-binary` (needs Python 3).

Run:
```powershell
$env:PGPASSWORD = "your-local-postgres-password"
py supabase/tests/test_rls.py            # Windows ("npm run test:db" uses python3 = macOS/Linux)
$env:MODE = "old"; py supabase/tests/test_rls.py   # also check older-style Supabase projects
```
It only creates/drops a database called `ppmk_hub_test` on your own machine, and refuses to run
against a Supabase server.

---

## 7. Working with Gemini (the AI)

### Where things are
| File | Role |
|---|---|
| `api/ai.ts` | **Everything AI**: prompts, calling Gemini, cleaning/validating the answers, the `/api/ai` endpoint. Actions: `extract` (notes → event form), `announce` (EN/MS/KO announcement), `ask` (chatbot) |
| `src/lib/ai.ts` | Browser side: `aiExtractEvent`, `aiWriteAnnouncements`, `aiAsk` (sends the user's login token) |
| `supabase/migrations/0003_ai.sql` | `ai_begin(kind)`: checks role, enforces daily limits (40 / 40 / 30), logs usage (not the text) |
| `tests/ai.test.ts` | Unit tests with fake Gemini/Supabase |
| `scripts/ai-eval/` | Test set (`cases.json`), scorer (`run.ts`), results (`results/`) |

### How a request flows
`src/lib/ai.ts` → `POST /api/ai` with the user's token → `api/ai.ts` asks the database
`ai_begin(kind)` (signed in? right role? under today's limit?) → builds the prompt (chatbot: loads
only what *that user* may see) → calls Gemini → validates/cleans the JSON → returns it. The AI
**suggests**; a human confirms before anything is saved or sent.

### Your Gemini key & limits
- Get your own free key at https://aistudio.google.com → put it in `.env.local` as `GEMINI_API_KEY`.
- Free-tier limits are per Google project; if you see *"free AI limit was reached"* (HTTP 429), wait a minute.
- Free-tier inputs may be used by Google, so **never send student personal data** (names, phones,
  student IDs) to the AI, and don't paste real data into your test notes.
- Switch models with `GEMINI_MODEL` (e.g. `gemini-3.8-flash`, open-source `gemma-4-26b-a4b-it`).

### Changing a prompt or adding an AI feature
1. Edit the prompt/logic in `api/ai.ts`. Keep the file **free of local imports** (the tests and
   the scorer import it directly).
2. New action? Add it to `handleAiRequest`, add a schema + `normalize…` function so bad AI output
   can't reach the UI, and add its kind to `ai_begin` **in a new migration** (also update the
   `kind` check on `ai_usage`).
3. `npm run test:ai`: add tests for the new behaviour (see the fake `fetch` in `tests/ai.test.ts`).
4. **Run the test set before and after** and record both in `PROGRESS.md` ("AI evaluation log"):
   ```powershell
   npm run ai:eval -- gemini-3.5-flash-lite                 # everything (~4 min)
   npm run ai:eval -- --only=ask gemini-3.5-flash-lite      # just the chatbot (or extract / announce)
   $env:AI_TIMEOUT_MS=90000; npm run ai:eval -- gemma-4-26b-a4b-it   # slow models
   ```
   Results are saved after every question in `scripts/ai-eval/results/` (Ctrl+C is safe).
5. Found a new failure? Add it to `cases.json` so it stays fixed.

---

## 8. Vercel & deploying

- **Production deploys automatically** when a PR is merged into `main`. Nobody deploys by hand.
- Every PR gets a **preview deployment**; Vercel comments the link on the PR.
- Vercel project settings (owner: lead):
  - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`
    (ticked for Production **and** Preview; mark the Gemini key **Sensitive**), plus `CRON_SECRET`,
    `GMAIL_USER`, `GMAIL_APP_PASSWORD` for reminder emails (§2). Changing one needs a **Redeploy**.
  - `vercel.json` also runs `/api/reminders` every day at 00:00 UTC (09:00 Korea time).
  - `vercel.json`: sends every page URL to the React app (except `/api/…`), plus security headers.
- **Login on preview links:** Supabase only redirects to allowed URLs. The lead adds
  `https://ppmk-community-hub-real-*.vercel.app/**` (preview URLs start with the project name)
  next to the production URL under Supabase → Authentication → URL Configuration → Redirect URLs.
  On a preview you can also always use the 6-digit code from the email.
- Vercel's free plan is single-user: if a teammate's PR shows "deployment blocked", the lead
  merging it deploys normally.
- **Preview deployments use the real database** (same env vars). Test carefully there too.
- Supabase free projects **pause after 7 days of no activity** → Supabase dashboard → "Restore
  project". Once reminder emails are set up, the daily reminder job also keeps the database awake.

---

## 9. Troubleshooting

| You see | Cause → fix |
|---|---|
| *"Almost there: connect Supabase"* | `.env.local` missing/wrong name (`.env.local.txt`?) or dev server not restarted |
| *"permission denied for table …"* | Migration `0002` (or the grants for a new table) not run on that database |
| *"This action is not allowed…"* (row-level security) | Working as designed: wrong role, profile incomplete, RSVP closed, or event not meant for you |
| Email link opens `localhost:3000` / wrong site | Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) |
| *"Email address not authorized"* | Built-in Supabase email only reaches project members → SMTP setup (A1) |
| *"Too many login emails…"* | Email rate limit; wait, or use an existing session |
| Vercel login page when opening a link | You opened a *deployment/preview* URL that's protected; use the production URL |
| *"AI is not set up… GEMINI_API_KEY is missing"* | Add the key to `.env.local` (local) or Vercel (live) and restart/redeploy |
| *"The AI model … was not found"* | Wrong `GEMINI_MODEL` name |
| *"The free AI limit was reached"* | Gemini free-tier rate limit; wait a minute |
| *"You've reached today's AI limit"* | Our own daily limit (`0003_ai.sql`); resets at midnight Korea time |
| Site loads but no data / everything fails | Supabase project paused → Restore in the dashboard |
| `npm run dev`: port in use | Another dev server is running; close it or use the port Vite suggests |

---

## 10. Checklist before you open a PR

- [ ] Branch from up-to-date `main`; one task only
- [ ] `npm run lint`, `npm run build`, `npm run test:ai`, `npm run test:reminders` pass
- [ ] Tested on a phone-sized screen (390 px), incl. loading and empty states
- [ ] No keys, `.env.local`, real student data or `console.log` left in the code
- [ ] Database change? New migration file + tests + "needs migration 000X" in the PR
- [ ] AI change? Test set run before/after, numbers in `PROGRESS.md`
- [ ] You can explain the change in two sentences
