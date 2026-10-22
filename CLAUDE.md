# Rules for AI assistants working on this repo

- Mobile-first. Test every screen at 390px wide.
- All database calls go through `src/lib/api.ts`. Pages never call `supabase` directly.
- Security lives in the database (`supabase/migrations`). Never rely on hiding UI for
  permissions. Any schema change = a NEW numbered migration file (never edit 0001),
  plus a test in `supabase/tests/test_rls.py`.
- Never put secret keys (service_role, Gemini API key) in frontend code or `VITE_*` vars.
  AI calls go through a server function (`/api`).
- Dates: use `todayKst()` from `src/lib/format.ts`. Korea time, not UTC.
- Keep it simple: no new libraries without a clear reason.
- Before finishing: `npm run build` and `npm run lint` must pass.
