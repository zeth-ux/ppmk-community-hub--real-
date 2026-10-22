# Progress

Last updated: 2026-10-20 (week 8)

## Plan

| Week | Dates | Goal | Status |
|---|---|---|---|
| 8 | Oct 20–26 | Database, permissions, magic-link login, one-time profile, real roles | ✅ Built (needs setup + first deploy) |
| 9 | Oct 27–Nov 2 | Core loop: create event → share link → one-tap RSVP → attendee list → CSV | ✅ Built early, test with friends |
| 10 | Nov 3–9 | AI invitation writer (EN/MS/KO, Gemini) + test set; QR check-in; custom SMTP; dry run | Next |
| 11 | Nov 10–16 | Fixes from dry run; Explore board (AI event extractor); announcements | |
| 12 | Nov 17–23 | Real EMSU pilot event + feedback survey | |
| 13–14 | Nov 24–Dec 7 | Polish, numbers for the report, demo video | |
| 15 | Dec 8+ | Presentation | |

## Done

- Real database (Supabase): profiles, events, RSVPs, invites, clubs
- Permission rules in the database + 42 automated tests (all passing)
- Email sign-in with link **or** 6-digit code (works inside KakaoTalk/WhatsApp browsers)
- One-time profile with consent; "delete my account" removes everything
- Events: list, calendar, past events, search, categories, audience (everyone / batch / invite list)
- One-tap RSVP (Going / Maybe / Can't go) + note, deadline (Korea time) and capacity enforced
- Organizer: create/edit/delete events, copy-paste announcement with link, live responses,
  check-in button, CSV export (opens correctly in Excel)
- Admin: stats, member list, change roles, manage clubs
- Clubs page with leader contact and upcoming club events
- Privacy notice rewritten to match how the app really works
- Images compressed ~90% (faster on mobile data)

## Decisions

- Kept Vite + React from the demo (solo project; no reason to switch to Next.js).
- Organizers can see the full details (incl. phone) of people who RSVP to their event,
  exactly what a Google Form gave them. They cannot browse everyone's phone numbers.
- Login uses the "implicit" flow so the email link works across browsers.
- Dates/deadlines use Korea time (Asia/Seoul) in both the app and the database.

## Known limits / to do

- Explore page still shows sample listings (week 11).
- Announcement text is a template; AI version comes in week 10.
- Supabase built-in email is limited to a few per hour → set up Resend SMTP before pilot.
- SURVEY_URL and CONTACT_EMAIL in `src/config.ts` are placeholders.
