# Progress

Last updated: 2026-10-27 (week 9)

## Plan

| Week | Dates | Goal | Status |
|---|---|---|---|
| 8 | Oct 20–26 | Database, permissions, magic-link login, one-time profile, real roles | ✅ Live on Vercel |
| 9 | Oct 27–Nov 2 | Core loop: create event → share link → one-tap RSVP → attendee list → CSV | ✅ Built, testing with friends |
| 10 | Nov 3–9 | AI invitation writer (EN/MS/KO, Gemini) + test set; custom SMTP; dry run | ✅ AI built early, run the test set |
| 11 | Nov 10–16 | "Ask the Hub" chatbot + its test set; fixes from dry run | ✅ Chatbot built early; next: pilot prep |
| 12 | Nov 17–23 | Real EMSU pilot event + feedback survey | |
| 13–14 | Nov 24–Dec 7 | Polish, numbers for the report, demo video | |
| 15 | Dec 8+ | Presentation | |

## Done

- Real database (Supabase): profiles, events, RSVPs, invites, clubs
- Permission rules in the database + 56 automated tests (all passing, old and new Supabase)
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

- **AI (week 10, done early):**
  - "Fill with AI": organizer types rough notes (EN/MS/KO, slang OK) → event form filled in
  - 3-language announcement writer (English, Malaysian Malay, Korean), tone choice, editable,
    saved on the event, warns when the event changed afterwards
  - Runs on the server (`api/ai.ts`); key never in the browser; organizers only;
    40 uses per feature per day; only event info is sent to the AI
  - 17 unit tests (`npm run test:ai`) + AI test set with scoring (`npm run ai:eval`)
  - Admin page shows AI usage numbers
- **"Ask the Hub" chatbot (week 11, done early):**
  - Students ask in English / Malay / Korean about events, clubs and their own RSVPs
  - Answers only from hub data (events the student can see, clubs, their own RSVP answers);
    shows tappable event cards with RSVP status; says so when it doesn't know
  - Refuses off-topic requests and never reveals other students' data
  - 30 questions per student per day; conversation kept while browsing
  - 6 more unit tests (23 total) + 16 chatbot questions in the test set

## Decisions

- Kept Vite + React from the demo (solo project; no reason to switch to Next.js).
- Organizers can see the full details (incl. phone) of people who RSVP to their event,
  exactly what a Google Form gave them. They cannot browse everyone's phone numbers.
- Login uses the "implicit" flow so the email link works across browsers.
- Dates/deadlines use Korea time (Asia/Seoul) in both the app and the database.

- AI: Gemini API free tier instead of a self-hosted Hugging Face model (free, strong in
  Malay/Korean, no server to run). Trade-off: Google may use free-tier inputs, so only event
  info is ever sent (plus, for the chatbot, the asking student's own RSVP answers, a choice
  made on 27 Oct for a more useful assistant; name/phone/student ID are never sent). Model is switchable (`GEMINI_MODEL`), so Gemini vs open-source Gemma can
  be compared on the same test set.
- The AI only suggests; a human always checks before saving/sending.

## Known limits / to do

- Explore page still shows sample listings (week 11).
- Run the AI test set with a real key and put the numbers in the report.
- Supabase built-in email is limited to a few per hour → set up Resend SMTP before pilot.
- SURVEY_URL and CONTACT_EMAIL in `src/config.ts` are placeholders.
