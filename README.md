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

## Getting started

See **[SETUP.md](SETUP.md)** for the one-time setup (database, keys, login emails, first admin).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run lint
```

## How it's organised

```
src/
  lib/            supabase client, all database calls (api.ts), types, formatting
  context/        AuthContext: who is signed in + their profile and role
  components/     layout, route guards, event card, organizer tools
  pages/          one file per screen
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

The permission rules are covered by 42 automated tests in `supabase/tests/test_rls.py`.
