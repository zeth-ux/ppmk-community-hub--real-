# Rules for AI assistants working on this repo

- Mobile-first. Test every screen at 390px wide.
- All database calls go through `src/lib/api.ts`. Pages never call `supabase` directly.
- Security lives in the database (`supabase/migrations`). Never rely on hiding UI for
  permissions. Any schema change = a NEW numbered migration file (never edit 0001),
  plus a test in `supabase/tests/test_rls.py`.
- Never put secret keys (service_role, Gemini API key) in frontend code or `VITE_*` vars.
  AI calls go through the server function `api/ai.ts` (keep it free of local imports
  so tests and the eval script can import it). Never send student personal data to the AI.
- After changing AI prompts, run `npm run test:ai` and the test set (`npm run ai:eval`).
- Dates: use `todayKst()` from `src/lib/format.ts`. Korea time, not UTC.
- Keep it simple: no new libraries without a clear reason.
- Before finishing: `npm run build` and `npm run lint` must pass.

## Team workflow (6 people)
- Read `TEAM_BRIEF.md` first. Work on a branch and open a PR; never push to `main` or force-push.
- Never edit migrations 0001–0003; add a new numbered file + tests in `supabase/tests/test_rls.py`.
- There is one shared production database until a dev project exists: prefix test data with
  `[TEST]`, keep it private (invite-only events) and delete it afterwards.
- Never commit `.env.local` or any key. Never use the Supabase service_role key.
- Don't add libraries, switch frameworks, or change Vercel/Supabase settings without the lead.
