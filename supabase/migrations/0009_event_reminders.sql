-- =====================================================================
-- 0009: "Your event is tomorrow" reminder emails
--
-- Adds only. Run once, in Supabase → SQL Editor, after 0008.
--
-- Every morning a scheduled job on Vercel (api/reminders.ts, 09:00 Korea
-- time) asks the database who needs a reminder, emails them from the
-- shared EMSU Gmail, and marks them as reminded so nobody gets two.
--
-- How the job proves who it is, WITHOUT the service_role key:
--   The job knows a long random secret (Vercel env var CRON_SECRET). The
--   database only stores its SHA-256 fingerprint, in a schema the website
--   API can't reach. reminders_due() and mark_reminded() refuse to work
--   unless they're given the matching secret. Set it up with
--   `npm run reminders:secret` (see SETUP.md).
--
--   • private.reminders_sent     who was reminded about which event (kept
--                                apart from rsvps so "responded at" times in
--                                the attendee list don't change)
--   • profiles.email_reminders   students can turn reminders off (Me page)
-- =====================================================================

alter table public.profiles add column if not exists email_reminders boolean not null default true;

-- Students may switch their own reminders on/off (the existing
-- "profiles: update own" rule limits it to their own row).
grant update (email_reminders) on public.profiles to authenticated;

-- ---------- Job secret (not reachable through the website API) ---------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.job_secrets (
  name         text primary key,
  secret_hash  text not null,          -- hex SHA-256 of the secret, never the secret itself
  created_at   timestamptz not null default now()
);
revoke all on private.job_secrets from public, anon, authenticated;

create table if not exists private.reminders_sent (
  event_id  uuid not null references public.events (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  sent_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);
revoke all on private.reminders_sent from public, anon, authenticated;

create function private.job_secret_ok(p_name text, p_secret text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(length(p_secret) >= 32, false) and exists (
    select 1 from private.job_secrets s
    where s.name = p_name
      and s.secret_hash = encode(sha256(convert_to(p_secret, 'UTF8')), 'hex')
  )
$$;
revoke execute on function private.job_secret_ok(text, text) from public, anon, authenticated;

-- ---------- What the job calls ----------------------------------------

-- Who should get a reminder today: people going / maybe to an event that
-- is TOMORROW (Korea time), not reminded yet, reminders switched on.
-- Returns only what the email needs.
create function public.reminders_due(p_secret text)
returns table (
  event_id uuid, user_id uuid, email text, full_name text, status public.rsvp_status,
  title text, event_date date, start_time time, end_time time, location text, bring text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.job_secret_ok('reminders', p_secret) then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select e.id, p.id, p.email, p.full_name, r.status,
           e.title, e.event_date, e.start_time, e.end_time, e.location, e.bring
    from public.rsvps r
    join public.events e   on e.id = r.event_id
    join public.profiles p on p.id = r.user_id
    where e.event_date = public.today_kst() + 1
      and r.status in ('attending', 'maybe')
      and not exists (select 1 from private.reminders_sent s
                      where s.event_id = r.event_id and s.user_id = r.user_id)
      and p.email_reminders
      and p.email <> ''
    order by e.start_time, e.id, p.full_name;
end;
$$;

-- Called after each email is sent, so a re-run never sends it twice.
create function public.mark_reminded(p_secret text, p_event_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.job_secret_ok('reminders', p_secret) then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into private.reminders_sent (event_id, user_id)
  values (p_event_id, p_user_id)
  on conflict do nothing;
end;
$$;

-- The job has no user login, so it calls as "anon"; the secret is the lock.
revoke execute on function public.reminders_due(text)            from public;
revoke execute on function public.mark_reminded(text, uuid, uuid) from public;
grant  execute on function public.reminders_due(text)            to anon, authenticated;
grant  execute on function public.mark_reminded(text, uuid, uuid) to anon, authenticated;
