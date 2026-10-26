-- =====================================================================
-- 0002: explicit table permissions
--
-- Since 2026, new Supabase projects no longer give the app automatic
-- access to new tables. Each table needs its own GRANT, otherwise the
-- app gets "permission denied for table ...".
--
-- These grants only say which KIND of action a signed-in user may try.
-- The row-level security rules from 0001 still decide WHICH rows they
-- can see or change. Signed-out visitors (anon) still get nothing.
--
-- Safe to run more than once.
-- =====================================================================

grant usage on schema public to authenticated, service_role;

-- profiles: read (RLS: own row, or all for admins);
-- update only the personal-detail columns (granted in 0001), never role/email.
grant select on public.profiles to authenticated;
grant update (student_id, full_name, batch, age, phone, course, residence, consent_at)
  on public.profiles to authenticated;

-- events and clubs: RLS limits writes to organizers / admins.
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.clubs  to authenticated;

-- invites: RLS limits writes to organizers.
grant select, insert, delete on public.event_invites to authenticated;

-- rsvps: students may only set status/comment (check-in goes through
-- the check_in() function).
grant select, delete on public.rsvps to authenticated;
grant insert (event_id, user_id, status, comment) on public.rsvps to authenticated;
grant update (status, comment) on public.rsvps to authenticated;

-- service_role (server-side tools / the dashboard) keeps full access.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- The app's functions (each checks the caller's role itself).
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema public from anon, public;
