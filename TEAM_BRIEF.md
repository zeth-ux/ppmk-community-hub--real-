# PPMK Community Hub: Team Brief

_Last updated: 27 Oct 2026 (week 9) · Lead: Imran · Read this whole page before you write any code._

---

## 1. The idea (30 seconds)

**Fill in your details once. Join every event with one tap.**

Every PPMK/EMSU event used to start with a new Google Form asking the same things again
(name, student ID, batch, phone…). The Hub replaces that:

1. A student signs in once (email link or code, no password) and fills in a profile (~2 min).
2. An organizer creates an event and shares **one link** in KakaoTalk / WhatsApp.
3. Students tap the link → **"I'm going"**. Their details are already there.
4. The organizer sees a live attendee list, checks people in, and exports a CSV.

We pilot with **EMSU (~70 students)**, then PPMK (~500). **Success = one real EMSU event run fully
on the Hub in week 12 (Nov 17–23).** This is our AI+X course final project, so AI is part of
the loop: it suggests, and a human always approves.

**Live site:** https://ppmk-community-hub-real.vercel.app
**Repo:** https://github.com/zeth-ux/ppmk-community-hub--real-

---

## 2. Where we are

The core product is **built, deployed and working**. We are ahead of schedule.

| Week | Dates | Goal | Status |
|---|---|---|---|
| 8 | Oct 20–26 | Database, permissions, login, profile, roles | ✅ Live |
| 9 | Oct 27–Nov 2 | Core loop: event → link → RSVP → attendee list → CSV | ✅ Done, testing |
| 10 | Nov 3–9 | AI event writer + announcements + test set | ✅ Done early |
| 11 | Nov 10–16 | "Ask the Hub" chatbot | ✅ Done early |
| **10–11** | **now → Nov 16** | **Pilot preparation (section 6): this is where you come in** | 🔜 |
| 12 | Nov 17–23 | **Real EMSU pilot event** + feedback survey | |
| 13–14 | Nov 24–Dec 7 | Fixes, numbers for the report, demo video | |
| 15 | Dec 8+ | Presentation | |

---

## 3. What already works

### For students
- **Sign in** with email: a magic link *or* a 6-digit code (the code works inside KakaoTalk/WhatsApp browsers).
- **One-time profile** (student ID, name, batch, age, phone, course, residence) with consent.
  **Delete my account** removes everything.
- **Events**: list, calendar, past events, search, categories. Students only see events meant for them
  (everyone / their batch / invited).
- **One-tap RSVP**: Going / Maybe / Can't go + optional note. Deadline (Korea time) and capacity are enforced.
- **Clubs** page with leader contact and upcoming club events.
- **Ask the Hub** (AI chatbot): *"Ada event apa minggu ni?"*, *"What am I going to?"*, *"이번 주 행사 뭐 있어?"*.
  Answers only from Hub data and links to the events.

### For organizers
- Create / edit / delete events; choose who it's for.
- **Fill with AI**: type rough notes (*"futsal jumaat ni 8-10mlm erica sports complex max 20"*) → form filled.
- **AI announcement** in **English, Malay and Korean**, tone choice, editable, ready to paste with the RSVP link.
- Live responses, **check-in** button, **CSV export** (opens correctly in Excel).

### For admins
- Stats (members, events, RSVPs, check-ins, AI usage), member list, change roles, manage clubs.

### Quality
- **Permissions are enforced by the database** (row-level security), not just hidden buttons.
  56 automated permission tests.
- 30 unit tests for the AI server code (fake AI, no key needed).
- An **AI test set** (24 event notes, 6 announcements, 16 chatbot questions, incl. traps and
  prompt-injection) with a scoring script. Baseline: Gemini Flash-Lite 99% field accuracy at 1.3 s;
  open-source Gemma equally accurate but 24× slower → we use Gemini. See `PROGRESS.md`.

---

## 4. The stack (all free)

| Part | Tool | Notes |
|---|---|---|
| App | **Vite + React + TypeScript + Tailwind CSS** | Mobile-first web app, no app store |
| Database, login, permissions | **Supabase** (Postgres + row-level security) | Free plan; **pauses after 7 days without activity** |
| Hosting | **Vercel** (Hobby) | Every push to `main` deploys to the live site; every PR gets a preview link |
| AI | **Google Gemini API** (free tier), model `gemini-3.5-flash-lite` | Called only from the server function `api/ai.ts` |
| Code | **GitHub** | |

> We are **not** using Next.js (the original brief said Next.js; we kept the Vite demo because it was
> faster). Don't migrate.

### Project map

```
src/
  pages/          one file per screen (EventsPage, MePage, OrganizerPage, AskPage…)
  components/     layout, route guards, event card, organizer tools
  lib/api.ts      ALL database calls live here
  lib/ai.ts       browser side of the AI features
  lib/format.ts   dates (Korea time), labels, friendly error messages
  context/        AuthContext: who is signed in + their role
api/ai.ts         server function for all AI features (runs on Vercel, holds the Gemini key)
supabase/
  migrations/     the database, in numbered SQL files (0001, 0002, 0003…)
  tests/          database permission tests
scripts/ai-eval/  AI test set + scoring script + results
tests/            unit tests for the AI server code
```

Other docs: `README.md` (overview), `SETUP.md` (setup steps), `PROGRESS.md` (detailed log +
AI evaluation), `CLAUDE.md` (rules your AI coding tool must follow: tell it to read this file).

---

## 5. Get it running on your laptop (≈15 min)

You need **Node.js 22+**, **Git** and **VS Code**.

```bash
git clone https://github.com/zeth-ux/ppmk-community-hub--real-.git
cd ppmk-community-hub--real-
npm install
```

Create a file called **`.env.local`** in the project folder (copy `.env.example`). In PowerShell:
`Copy-Item .env.example .env.local`

```
VITE_SUPABASE_URL=https://gsvedpiuiylymgqlaviv.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase → Project Settings → API Keys → anon / publishable key>
GEMINI_API_KEY=<your OWN free key from https://aistudio.google.com → Get API key>
```

- Use your **own** Gemini key for local work; don't share keys. The live site's key is only in Vercel.
- **Never** use or copy the Supabase `service_role` / secret key.

Then:

```bash
npm run dev        # http://localhost:5173
npm run lint       # must pass before you open a PR
npm run build      # must pass before you open a PR
npm run test:ai    # AI server unit tests
```

To try organizer features, sign in once, then ask Imran to make you an **organizer** (Admin page).

> ⚠️ **There is only one database right now: the real one.** Anything you create locally appears on
> the live site. Until we have a separate dev database (task B3), prefix test events with
> **`[TEST]`**, make them "Invite specific people → only you", and **delete them when done**.

---

## 6. What's left: pick your tasks

Roles follow the original team brief. Cover pairs: **2↔3, 4↔5, 1↔6**.

### 🔴 Must-do before the pilot (deadline **Sun 15 Nov**)

| # | Task | Owner | Notes |
|---|---|---|---|
| A1 | **Gmail sending in Supabase** (custom SMTP). **BLOCKER:** without it, sign-in emails only reach Supabase team members | 1 Lead + 2 Backend | Shared EMSU Gmail + App Password → Supabase → Authentication → Emails → SMTP; raise email rate limit |
| A2 | **Shared EMSU email**: put it in `src/config.ts` (`CONTACT_EMAIL`), use it for SMTP | 1 Lead | Handover plan: accounts must not depend on one person |
| A3 | **Feedback survey**: anonymous Google Form (ease of use, time saved vs Google Forms, AI usefulness, 1–5 ratings); put link in `SURVEY_URL` | 6 QA/Pilot | No names/IDs/phones in the survey |
| A4 | **Dry run** with 5–10 friends (sign up → RSVP → check-in → CSV → chatbot). Write a bug list as GitHub Issues | 6 QA + everyone | Test on iPhone **and** Android, inside the **KakaoTalk and WhatsApp in-app browsers** |
| A5 | **Pilot event plan** with EMSU: which event, who organizes, when the link goes out, who does check-in at the door | 1 Lead | Get the "before" numbers too: how many Google Forms last semester, how long one took |
| A6 | **AI test set, run 2** (after the 27 Oct fixes), add numbers to `PROGRESS.md` | 4 AI | `npm run ai:eval -- gemini-3.5-flash-lite` |
| A7 | **Weekly keep-alive**: a free GitHub Action that pings Supabase so it never pauses before the demo | 2 Backend | |

### 🟡 Should-do (only after section A is done)

| # | Task | Owner | Notes |
|---|---|---|---|
| B1 | **QR check-in**: student shows a QR on the event page; organizer scans | 3 Events | The manual check-in button already works; this is a nicer door flow |
| B2 | **Add to calendar** (.ics download / Google Calendar link) on the event page | 3 Events | |
| B3 | **Separate dev database**: second free Supabase project + seed script with fake data | 2 Backend | Then local `.env.local` points to dev, not production |
| B4 | **Installable app (PWA)**: manifest + icons so it can be added to the home screen | 5 Frontend | |
| B5 | **UI polish pass** on every screen at 390 px; loading/empty states; accessibility | 5 Frontend | |
| B6 | **Automated checks on every PR**: GitHub Actions running `lint`, `build`, `test:ai`; Playwright tests for the main flow | 6 QA | |
| B7 | **Explore board**: replace the sample listings with real ones, or hide the page | 4 AI + 3 Events | AI "poster/link → listing" extractor is an option |
| B8 | **"New academic year" admin action**: archive old events, clean up graduated students | 2 Backend | From the handover plan |

### 🟢 Deliverables (weeks 13–15)

| # | Task | Owner |
|---|---|---|
| C1 | Course report (problem → POV → solution → AI design → evaluation → pilot results) | Everyone, 6 edits |
| C2 | Demo video (2–3 min) | 5 Frontend + 6 QA |
| C3 | Presentation slides | 1 Lead |
| C4 | **Runbook** for the next EMSU team: run an event, add an admin, rotate keys, site is down | 2 Backend + 6 QA |

---

## 7. How we work

- **Never push to `main` directly.** Make a branch (`feat/qr-checkin`, `fix/login-error`), open a
  **Pull Request**, and Imran reviews and merges. Vercel posts a **preview link** on every PR, so test it there.
- **One task = one branch = one small PR.** Link the GitHub Issue.
- **Before you open a PR:** `npm run lint` and `npm run build` pass, and you tested on a phone-sized screen.
- **The rule:** don't open a PR for code you can't explain in two sentences.
- **Vibe-coding:** tell your AI tool to *read `CLAUDE.md` and `TEAM_BRIEF.md` first*. Small prompts,
  one feature at a time, commit after every working step, paste full error messages.
- **Weekly:** Monday 20-min plan call · Thursday status in the group chat (*Done / Doing / Blocked*;
  no post counts as blocked) · Friday demo on the preview link.
- **Database changes:** only as a **new numbered file** in `supabase/migrations/` (e.g.
  `0004_qr_checkin.sql`) **plus tests** in `supabase/tests/test_rls.py`. Imran runs it on Supabase
  after review.

---

## 8. Do NOT do these

**Secrets and data**
- ❌ Don't commit `.env.local`, API keys or passwords, or paste them in chats/screenshots.
- ❌ Don't put any secret in a `VITE_…` variable or in `src/`. Anything in `src/` is public.
- ❌ Don't use the Supabase **service_role / secret** key anywhere.
- ❌ Don't send students' personal data (names, phones, student IDs) to the AI.
- ❌ Don't use real student data in screenshots, the report, test files or demo videos. Use fake people.

**Shared services (we're all collaborators, so one click affects everyone)**
- ❌ Don't change **Vercel** settings or environment variables, or **Supabase** settings (Auth URLs,
  email templates, SMTP, API keys) without telling Imran first.
- ❌ Don't edit or delete tables/rows in the **Supabase Table Editor** by hand, and never edit an old
  migration file (0001–0003). Changes go in a new migration (section 7).
- ❌ Don't delete or "clean up" other people's events, users or data on the live site.
- ❌ Don't upgrade anything to a paid plan. The budget is $0.

**Code**
- ❌ Don't push to `main`. Don't force-push.
- ❌ Don't add new libraries or frameworks without asking, and don't migrate to Next.js.
- ❌ Don't call Supabase directly from a page. Add a function to `src/lib/api.ts`.
- ❌ Don't hide a button and call it "permissions". Real permissions live in the database rules.
- ❌ Don't change AI prompts in `api/ai.ts` without running `npm run test:ai` **and** the AI test set
  before/after, and noting the result in `PROGRESS.md`.

**Scope: not in this project** (from the original brief)
- ❌ Native iOS/Android app, payments/ticketing, chat between students, document repository,
  resource board (jobs/housing), volunteer sign-ups. Good ideas, but after the course.

---

## 9. Who to ask

| Topic | Ask |
|---|---|
| Access to GitHub / Vercel / Supabase, roles in the app, merges | Imran (lead) |
| "Is this in scope?" | Imran, and check section 8 first |
| How something works | Read `README.md` / `PROGRESS.md` / the code comments, then ask in the group chat |

**First steps this week:** ☐ read this page · ☐ run the app locally (section 5) · ☐ sign up on the
live site and complete your profile · ☐ claim a task from section 6 in the group chat ·
☐ tell Imran your midterm dates.
