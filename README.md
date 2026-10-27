# PPMK Community Hub

**Fill in your details once. Join every event with one tap.**

A mobile-first web app for Malaysian students at Hanyang University ERICA (pilot: EMSU,
~70 students). Students make one profile; organizers create an event, share one link in
KakaoTalk/WhatsApp, and get a live attendee list with CSV export, with no new Google Form
for every event.

AI+X course final project · 2026.

## Stack (all free tiers)

| Part | Tool |
|---|---|
| App | Vite + React + TypeScript + Tailwind CSS |
| Database, login, permissions | Supabase (Postgres + row-level security) |
| Hosting | Vercel |
| Login | Email magic link + one-time code (no passwords) |
| AI | Google Gemini API (free tier), via a server function in `api/ai.ts` |

## Getting started

See **[SETUP.md](SETUP.md)** for the one-time setup (database, keys, login emails, first admin).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run lint
npm run test:ai    # AI endpoint unit tests (fake AI, no key needed)
npm run test:db    # database permission tests (needs a local Postgres)
npm run ai:eval    # score real AI models on the test set (needs GEMINI_API_KEY)
```

## AI features

- **Fill with AI**: organizers describe an event in their own words (English, Malay or
  Korean, slang welcome) and the AI fills in the event form.
- **Announcement writer**: one tap writes the group-chat announcement in English,
  Malaysian Malay and Korean, ready to paste with the RSVP link.
- **Ask the Hub**: a chatbot for students: "Ada event apa minggu ni?", "What am I going to?".
  It answers only from the hub's events, clubs and the student's own RSVPs, and links to
  the events so they can RSVP.

Design rules: the AI only *suggests* (a human checks everything), only event information is
sent (plus the asking student's own RSVP answers for the chatbot; never names, phones or
anyone else's data), the key stays on the server, and everyone has a daily limit.
Accuracy is measured with a test set in `scripts/ai-eval/`.

## How it's organised

```
src/
  lib/            supabase client, all database calls (api.ts), types, formatting
  context/        AuthContext: who is signed in + their profile and role
  components/     layout, route guards, event card, organizer tools
  pages/          one file per screen
api/
  ai.ts           server function for the AI features (runs on Vercel)
scripts/ai-eval/  AI test set + scoring script
tests/            unit tests
supabase/
  migrations/     the database: tables, permission rules, functions
  tests/          automated permission tests (run against a local Postgres)
```

## Who can see what

Enforced inside the database, not just hidden in the UI:

| Role | Can do |
|---|---|
| Student | Own profile & RSVPs; sees events meant for them (everyone / their batch / invited); RSVP counts only |
| Organizer | + create/edit/delete events, invite people, see details of people who RSVP'd, check people in, export CSV |
| Admin | + member directory, change roles, manage clubs, hub statistics |
| Not signed in | Nothing |

The permission rules are covered by 56 automated tests in `supabase/tests/test_rls.py`.
