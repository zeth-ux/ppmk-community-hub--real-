-- =====================================================================
-- PPMK Community Hub: initial database schema
--
-- How to run: Supabase dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. Run it ONCE on a fresh project.
--
-- Who can see what (enforced by the database, not just the UI):
--   student    -> their own profile and RSVPs; events meant for them;
--                 RSVP counts; clubs
--   organizer  -> everything a student can, plus create/edit/delete
--                 events, invite people, and see the attendee details
--                 (incl. phone) of people who RSVP'd to an event
--   admin      -> everything, plus the full member directory, roles
--                 and clubs
-- =====================================================================

-- ---------- Types ------------------------------------------------------

create type public.app_role as enum ('student', 'organizer', 'admin');
create type public.rsvp_status as enum ('attending', 'maybe', 'not_attending');
create type public.event_audience as enum ('everyone', 'batch', 'custom');

-- ---------- Tables -----------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  student_id  text,
  full_name   text,
  batch       smallint,
  age         smallint,
  phone       text,
  course      text,
  residence   text,
  role        public.app_role not null default 'student',
  consent_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint profiles_student_id_len check (student_id is null or char_length(student_id) between 3 and 30),
  constraint profiles_full_name_len  check (full_name  is null or char_length(full_name)  between 2 and 100),
  constraint profiles_batch_range    check (batch      is null or batch between 2000 and 2100),
  constraint profiles_age_range      check (age        is null or age between 15 and 99),
  constraint profiles_phone_len      check (phone      is null or char_length(phone) between 8 and 20),
  constraint profiles_course_len     check (course     is null or char_length(course) between 2 and 100),
  constraint profiles_residence_len  check (residence  is null or char_length(residence) between 2 and 60)
);

create unique index profiles_student_id_key on public.profiles (student_id) where student_id is not null;

create table public.clubs (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 2 and 100),
  category        text not null default 'Social',
  description     text not null default '',
  leader_name     text,
  leader_contact  text,
  logo_url        text,
  join_url        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (char_length(title) between 3 and 120),
  category          text not null check (category in ('Sports', 'Social', 'Academic', 'Career', 'Cultural', 'Religious')),
  event_date        date not null,
  start_time        time not null,
  end_time          time,
  location          text not null check (char_length(location) between 2 and 200),
  description       text not null default '',
  bring             text not null default '',
  notes             text not null default '',
  capacity          integer check (capacity is null or capacity > 0),
  rsvp_deadline     date,
  image_url         text,
  club_id           uuid references public.clubs (id) on delete set null,
  audience          public.event_audience not null default 'everyone',
  audience_batches  smallint[] not null default '{}',
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint events_deadline_before_event check (rsvp_deadline is null or rsvp_deadline <= event_date),
  constraint events_batch_audience check (audience <> 'batch' or cardinality(audience_batches) > 0)
);

create index events_event_date_idx on public.events (event_date);

create table public.event_invites (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  invited_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_invites_user_idx on public.event_invites (user_id);

create table public.rsvps (
  event_id       uuid not null references public.events (id) on delete cascade,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status         public.rsvp_status not null,
  comment        text not null default '' check (char_length(comment) <= 500),
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index rsvps_user_idx on public.rsvps (user_id);

-- ---------- Helper functions (used by the permission rules) ------------
-- SECURITY DEFINER lets these read the profiles table without tripping
-- over its own row-level rules. Each one only ever answers about the
-- person who is signed in.

create function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.is_organizer()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.my_role() in ('organizer', 'admin'), false)
$$;

create function public.my_batch()
returns smallint
language sql stable security definer set search_path = ''
as $$
  select batch from public.profiles where id = auth.uid()
$$;

create function public.my_profile_is_complete()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select student_id is not null and full_name is not null and batch is not null
       and age is not null and phone is not null and course is not null
       and residence is not null and consent_at is not null
    from public.profiles where id = auth.uid()
  ), false)
$$;

create function public.is_invited(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_invites
    where event_id = p_event_id and user_id = auth.uid()
  )
$$;

-- Today's date in Korea (the database clock runs on UTC).
create function public.today_kst()
returns date
language sql stable set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date
$$;

create function public.can_see_event(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        public.is_organizer()
        or e.audience = 'everyone'
        or (e.audience = 'batch'  and public.my_batch() = any (e.audience_batches))
        or (e.audience = 'custom' and public.is_invited(e.id))
      )
  )
$$;

create function public.rsvp_is_open(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and public.today_kst() <= coalesce(e.rsvp_deadline, e.event_date)
  )
$$;

-- ---------- Triggers ---------------------------------------------------

-- Keep updated_at fresh.
create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger clubs_touch    before update on public.clubs    for each row execute function public.touch_updated_at();
create trigger events_touch   before update on public.events   for each row execute function public.touch_updated_at();
create trigger rsvps_touch    before update on public.rsvps    for each row execute function public.touch_updated_at();

-- Every new sign-in account gets an (empty) profile row automatically.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the profile email in sync if someone changes their login email.
create function public.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Refuse an "attending" RSVP when the event is already full.
create function public.enforce_capacity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_capacity integer;
  v_taken    integer;
begin
  if new.status <> 'attending' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'attending' then
    return new;
  end if;

  -- Lock the event row so two people can't grab the last seat at once.
  select capacity into v_capacity from public.events where id = new.event_id for update;

  if v_capacity is null then
    return new;
  end if;

  select count(*) into v_taken
  from public.rsvps
  where event_id = new.event_id and status = 'attending' and user_id <> new.user_id;

  if v_taken >= v_capacity then
    raise exception 'EVENT_FULL' using hint = 'This event has reached its capacity.';
  end if;

  return new;
end;
$$;

create trigger rsvps_enforce_capacity
  before insert or update of status on public.rsvps
  for each row execute function public.enforce_capacity();

-- ---------- Row-level security ----------------------------------------

alter table public.profiles      enable row level security;
alter table public.clubs         enable row level security;
alter table public.events        enable row level security;
alter table public.event_invites enable row level security;
alter table public.rsvps         enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles: admins read all" on public.profiles
  for select to authenticated using (public.is_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- clubs
create policy "clubs: signed-in users read" on public.clubs
  for select to authenticated using (true);

create policy "clubs: admins insert" on public.clubs
  for insert to authenticated with check (public.is_admin());

create policy "clubs: admins update" on public.clubs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "clubs: admins delete" on public.clubs
  for delete to authenticated using (public.is_admin());

-- events
create policy "events: read if meant for you" on public.events
  for select to authenticated using (
    public.is_organizer()
    or audience = 'everyone'
    or (audience = 'batch'  and public.my_batch() = any (audience_batches))
    or (audience = 'custom' and public.is_invited(id))
  );

create policy "events: organizers insert" on public.events
  for insert to authenticated with check (public.is_organizer());

create policy "events: organizers update" on public.events
  for update to authenticated using (public.is_organizer()) with check (public.is_organizer());

create policy "events: organizers delete" on public.events
  for delete to authenticated using (public.is_organizer());

-- event_invites
create policy "invites: read own or organizer" on public.event_invites
  for select to authenticated using (user_id = auth.uid() or public.is_organizer());

create policy "invites: organizers insert" on public.event_invites
  for insert to authenticated with check (public.is_organizer());

create policy "invites: organizers delete" on public.event_invites
  for delete to authenticated using (public.is_organizer());

-- rsvps
create policy "rsvps: read own or organizer" on public.rsvps
  for select to authenticated using (user_id = auth.uid() or public.is_organizer());

create policy "rsvps: insert own while open" on public.rsvps
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.my_profile_is_complete()
    and public.can_see_event(event_id)
    and public.rsvp_is_open(event_id)
  );

create policy "rsvps: update own while open" on public.rsvps
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.rsvp_is_open(event_id));

create policy "rsvps: delete own" on public.rsvps
  for delete to authenticated using (user_id = auth.uid());

-- ---------- Table and column privileges --------------------------------
-- Visitors who are not signed in (anon) get nothing at all.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Students may only edit their own details, never their role or email.
revoke insert, update, delete on public.profiles from authenticated;
grant update (student_id, full_name, batch, age, phone, course, residence, consent_at)
  on public.profiles to authenticated;

-- Students may only set status/comment on an RSVP. Check-in is done by
-- organizers through check_in() further down.
revoke insert, update on public.rsvps from authenticated;
grant insert (event_id, user_id, status, comment) on public.rsvps to authenticated;
grant update (status, comment) on public.rsvps to authenticated;

-- ---------- Functions the app calls (RPC) ------------------------------

-- RSVP totals for every event the caller can see. Students can't read
-- other people's RSVPs, so they get numbers only.
create function public.event_rsvp_counts()
returns table (event_id uuid, attending bigint, maybe bigint, not_attending bigint)
language sql stable security definer set search_path = ''
as $$
  select r.event_id,
         count(*) filter (where r.status = 'attending'),
         count(*) filter (where r.status = 'maybe'),
         count(*) filter (where r.status = 'not_attending')
  from public.rsvps r
  where public.can_see_event(r.event_id)
  group by r.event_id
$$;

-- One-tap RSVP: create or change the caller's own RSVP. Runs with the
-- caller's own permissions (SECURITY INVOKER), so every rule above
-- still applies: complete profile, event visible, deadline, capacity.
create function public.set_my_rsvp(p_event_id uuid, p_status public.rsvp_status, p_comment text default '')
returns public.rsvps
language plpgsql security invoker set search_path = ''
as $$
declare
  v_row public.rsvps;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  update public.rsvps
     set status = p_status, comment = coalesce(p_comment, '')
   where event_id = p_event_id and user_id = auth.uid()
  returning * into v_row;

  if not found then
    insert into public.rsvps (event_id, user_id, status, comment)
    values (p_event_id, auth.uid(), p_status, coalesce(p_comment, ''))
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- Attendee list for one event (organizers only). This is the "Google
-- Form replacement": everything an organizer used to collect.
create function public.event_attendees(p_event_id uuid)
returns table (
  user_id uuid, full_name text, student_id text, batch smallint, course text,
  residence text, phone text, email text, status public.rsvp_status,
  comment text, responded_at timestamptz, checked_in_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select p.id, p.full_name, p.student_id, p.batch, p.course, p.residence,
           p.phone, p.email, r.status, r.comment, r.updated_at, r.checked_in_at
    from public.rsvps r
    join public.profiles p on p.id = r.user_id
    where r.event_id = p_event_id
    order by r.status, p.full_name;
end;
$$;

-- Member list for building invites (organizers only). No phone numbers.
create function public.list_members()
returns table (id uuid, full_name text, batch smallint, course text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select p.id, p.full_name, p.batch, p.course
    from public.profiles p
    where p.full_name is not null and p.consent_at is not null
    order by p.full_name;
end;
$$;

-- Replace the custom invite list for an event (organizers only).
create function public.set_event_invites(p_event_id uuid, p_user_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  delete from public.event_invites where event_id = p_event_id;

  insert into public.event_invites (event_id, user_id, invited_by)
  select p_event_id, u, auth.uid()
  from unnest(coalesce(p_user_ids, '{}')) as u
  where exists (select 1 from public.profiles where id = u)
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Mark someone as arrived / not arrived (organizers only).
create function public.check_in(p_event_id uuid, p_user_id uuid, p_checked_in boolean default true)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.rsvps
     set checked_in_at = case when p_checked_in then now() else null end
   where event_id = p_event_id and user_id = p_user_id
  returning checked_in_at into v_at;

  if not found then
    raise exception 'NO_RSVP';
  end if;

  return v_at;
end;
$$;

-- Change someone's role (admins only). The last admin can't demote
-- themselves, so the hub can never end up with nobody in charge.
create function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- Numbers for the admin page and the course report (admins only).
create function public.hub_stats()
returns table (
  members bigint, complete_profiles bigint, organizers bigint,
  events bigint, upcoming_events bigint, rsvps bigint, check_ins bigint
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where consent_at is not null and full_name is not null),
    (select count(*) from public.profiles where role in ('organizer', 'admin')),
    (select count(*) from public.events),
    (select count(*) from public.events where event_date >= public.today_kst()),
    (select count(*) from public.rsvps),
    (select count(*) from public.rsvps where checked_in_at is not null);
end;
$$;

-- "Delete my data": removes the login account, which cascades to the
-- profile, RSVPs and invites.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if public.is_admin()
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'LAST_ADMIN';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

-- Nobody signed-out may call any function; signed-in users may call
-- them (each function checks the caller's role itself).
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;

-- ---------- Starter data -----------------------------------------------

-- Profiles for any accounts that already existed before this script.
insert into public.profiles (id, email)
select id, coalesce(email, '') from auth.users
on conflict (id) do nothing;

insert into public.clubs (name, category, description) values
  ('PPMK Sports Club',         'Sports',   'Friendly sports activities including futsal, badminton and casual games.'),
  ('Malaysian Cultural Club',  'Cultural', 'Celebrate Malaysian food, traditions, festivals and culture together.'),
  ('Academic & Study Club',    'Academic', 'Study groups, peer support and academic sharing among Malaysian students.'),
  ('Career & Alumni Network',  'Career',   'Connect with Malaysian alumni and exchange internship and career advice.');
