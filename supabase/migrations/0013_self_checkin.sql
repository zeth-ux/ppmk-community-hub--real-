-- =====================================================================
-- 0013: students check themselves in at the door, and show-up numbers
--
-- Run once, in Supabase → SQL Editor, after 0012.
-- Run it BEFORE the matching website update goes live.
--
-- 1. Door check-in
--    Until now the organizer scanned every student's QR, one by one. With
--    50 people at the door that's a queue. Now the organizer can open a
--    "door screen" (Organize → event → Door check-in) that shows ONE QR
--    code and a 6-digit code for the whole event. Each student scans it with
--    their own phone (or types the 6 digits on the event page) and is
--    checked in.
--
--    The code is made from a secret only the database knows plus the
--    current minute, so it changes every minute. A code is accepted for
--    10 minutes (time to sign in on a slow phone), then it stops working:
--    a photo of the QR sent to a friend at home soon becomes useless.
--    Wrong codes are counted: 10 wrong tries in an hour and that person is
--    told to ask the organizer instead (so nobody can guess codes).
--
--    It only works on the day of the event (Korea time), for people who
--    can see the event and have a complete profile. If someone said
--    "Maybe" or "Can't go" (or never answered) but turns up, they become
--    "Going" and are counted as a WALK-IN, so the show-up numbers stay
--    honest. A full event stays full: walk-ins then go to the organizer.
--
-- 2. Show-up numbers
--    event_show_up(event)  for the event's organizers: how many said
--                          Going, how many of them came, no-shows,
--                          walk-ins, and how many checked themselves in.
--    show_up_overview()    for admins: the same for every past event
--                          (the numbers for the pilot report).
--
-- New columns on rsvps (set only by the database; nobody can edit them):
--    walk_in          came without a "Going" answer beforehand
--    self_checked_in  checked in at the door screen (not by an organizer)
-- =====================================================================

-- ---------- New columns ------------------------------------------------

alter table public.rsvps add column if not exists walk_in boolean not null default false;
alter table public.rsvps add column if not exists self_checked_in boolean not null default false;

-- Organizer "undo" (check_in(..., false)) clears the self check-in mark too.
create or replace function public.rsvps_clear_self_checkin()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.checked_in_at is null then
    new.self_checked_in := false;
  end if;
  return new;
end;
$$;

drop trigger if exists rsvps_clear_self_checkin on public.rsvps;
create trigger rsvps_clear_self_checkin before update of checked_in_at on public.rsvps
  for each row execute function public.rsvps_clear_self_checkin();

-- ---------- Private: door secrets and wrong tries -----------------------
-- (schema `private` comes from 0009; nobody outside the database can read it)

create table if not exists private.event_door_secrets (
  event_id    uuid primary key references public.events (id) on delete cascade,
  secret      uuid not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);
revoke all on private.event_door_secrets from public, anon, authenticated;

create table if not exists private.door_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  tried_at   timestamptz not null default now()
);
create index if not exists door_attempts_user_idx on private.door_attempts (user_id, tried_at);
revoke all on private.door_attempts from public, anon, authenticated;

-- The 6-digit code for one event and one minute.
create or replace function private.door_code_at(p_secret uuid, p_minute bigint)
returns text
language sql immutable set search_path = ''
as $$
  select lpad(
    ((('x' || substr(encode(sha256(convert_to(p_secret::text || ':' || p_minute::text, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint)
      % 1000000)::text,
    6, '0')
$$;
revoke execute on function private.door_code_at(uuid, bigint) from public, anon, authenticated;

-- ---------- For the door screen (event creator or admin) ----------------

create or replace function public.door_code(p_event_id uuid)
returns table (code text, seconds_left integer, event_date date, is_today boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_secret uuid;
  v_minute bigint := floor(extract(epoch from now()) / 60);
  v_date date;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.can_check_in(p_event_id) then
    raise exception 'NOT_EVENT_ORGANIZER';
  end if;

  select e.event_date into v_date from public.events e where e.id = p_event_id;

  insert into private.event_door_secrets (event_id) values (p_event_id)
  on conflict (event_id) do nothing;
  select s.secret into v_secret from private.event_door_secrets s where s.event_id = p_event_id;

  return query select
    private.door_code_at(v_secret, v_minute),
    (60 - floor(extract(epoch from now()))::bigint % 60)::integer,
    v_date,
    v_date = public.today_kst();
end;
$$;

-- ---------- For students: check myself in -----------------------------
-- Returns a status instead of raising for a wrong code, so the wrong try is
-- remembered (an error would undo the record of it).
--   CHECKED_IN      done
--   ALREADY         was already checked in (nothing changed)
--   BAD_CODE        wrong or expired code
--   TOO_MANY_TRIES  10 wrong codes in the last hour: ask the organizer
-- Raises: NOT_ALLOWED (can't see the event), PROFILE_INCOMPLETE,
--         NOT_TODAY, EVENT_FULL (walk-in to a full event).

create or replace function public.self_check_in(p_event_id uuid, p_code text)
returns table (status text, event_title text, checked_in_at timestamptz, walk_in boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_secret uuid;
  v_minute bigint := floor(extract(epoch from now()) / 60);
  v_code text := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');
  v_ok boolean := false;
  v_rsvp public.rsvps;
  v_walk_in boolean;
begin
  if v_uid is null or not public.can_see_event(p_event_id) then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.my_profile_is_complete() then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select * into v_event from public.events e where e.id = p_event_id;
  if v_event.event_date <> public.today_kst() then
    raise exception 'NOT_TODAY';
  end if;

  -- Already in? Say so, whatever the code.
  select * into v_rsvp from public.rsvps r where r.event_id = p_event_id and r.user_id = v_uid;
  if found and v_rsvp.checked_in_at is not null then
    return query select 'ALREADY'::text, v_event.title, v_rsvp.checked_in_at, v_rsvp.walk_in;
    return;
  end if;

  if (select count(*) from private.door_attempts a
      where a.user_id = v_uid and a.tried_at > now() - interval '1 hour') >= 10 then
    return query select 'TOO_MANY_TRIES'::text, v_event.title, null::timestamptz, false;
    return;
  end if;

  select s.secret into v_secret from private.event_door_secrets s where s.event_id = p_event_id;
  if v_secret is not null and char_length(v_code) = 6 then
    -- This minute and the 10 before it.
    select exists (
      select 1 from generate_series(0, 10) as g(back)
      where private.door_code_at(v_secret, v_minute - g.back) = v_code
    ) into v_ok;
  end if;

  if not v_ok then
    insert into private.door_attempts (user_id, event_id) values (v_uid, p_event_id);
    return query select 'BAD_CODE'::text, v_event.title, null::timestamptz, false;
    return;
  end if;

  v_walk_in := v_rsvp.status is distinct from 'attending'::public.rsvp_status;

  -- The capacity trigger still applies: a walk-in to a full event gets EVENT_FULL.
  insert into public.rsvps as r (event_id, user_id, status, checked_in_at, walk_in, self_checked_in)
  values (p_event_id, v_uid, 'attending', now(), v_walk_in, true)
  on conflict (event_id, user_id) do update
    set status = 'attending',
        checked_in_at = now(),
        walk_in = r.walk_in or excluded.walk_in,
        self_checked_in = true
  returning * into v_rsvp;

  return query select 'CHECKED_IN'::text, v_event.title, v_rsvp.checked_in_at, v_rsvp.walk_in;
end;
$$;

-- ---------- Show-up numbers --------------------------------------------
-- said_going   answered "Going" before the event (walk-ins not included)
-- came         of those, how many were checked in
-- no_shows     said Going, not checked in (only counted once the day is over)
-- walk_ins     came without a "Going" answer beforehand
-- self_checked_in  checked themselves in at the door screen

create or replace function public.event_show_up(p_event_id uuid)
returns table (said_going integer, came integer, no_shows integer, walk_ins integer,
               self_checked_in integer, event_over boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_over boolean;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  select e.event_date < public.today_kst() into v_over from public.events e where e.id = p_event_id;

  return query
    select
      count(*) filter (where r.status = 'attending' and not r.walk_in)::integer,
      count(*) filter (where r.status = 'attending' and not r.walk_in and r.checked_in_at is not null)::integer,
      case when v_over
        then count(*) filter (where r.status = 'attending' and not r.walk_in and r.checked_in_at is null)::integer
        else 0 end,
      count(*) filter (where r.walk_in and r.checked_in_at is not null)::integer,
      count(*) filter (where r.self_checked_in)::integer,
      coalesce(v_over, false)
    from public.rsvps r
    where r.event_id = p_event_id;
end;
$$;

create or replace function public.show_up_overview()
returns table (event_id uuid, title text, event_date date, said_going integer, came integer,
               walk_ins integer, self_checked_in integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select e.id, e.title, e.event_date,
      count(r.*) filter (where r.status = 'attending' and not r.walk_in)::integer,
      count(r.*) filter (where r.status = 'attending' and not r.walk_in and r.checked_in_at is not null)::integer,
      count(r.*) filter (where r.walk_in and r.checked_in_at is not null)::integer,
      count(r.*) filter (where r.self_checked_in)::integer
    from public.events e
    left join public.rsvps r on r.event_id = e.id
    where e.event_date <= public.today_kst()
    group by e.id
    order by e.event_date desc, e.start_time desc
    limit 100;
end;
$$;

-- ---------- Permissions ------------------------------------------------

revoke execute on function public.rsvps_clear_self_checkin() from public, anon, authenticated;
revoke execute on function public.door_code(uuid) from public, anon;
grant  execute on function public.door_code(uuid) to authenticated;
revoke execute on function public.self_check_in(uuid, text) from public, anon;
grant  execute on function public.self_check_in(uuid, text) to authenticated;
revoke execute on function public.event_show_up(uuid) from public, anon;
grant  execute on function public.event_show_up(uuid) to authenticated;
revoke execute on function public.show_up_overview() from public, anon;
grant  execute on function public.show_up_overview() to authenticated;
