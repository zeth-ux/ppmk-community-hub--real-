-- =====================================================================
-- 0004: usernames, club pages & roles, club applications, discussions
--
-- Adds only. Nothing existing is removed or renamed, so the live app keeps
-- working while this runs. Run once, in Supabase → SQL Editor.
--
--   • profiles.username         public display name (instead of full name)
--   • clubs: page details + settings (who can post, who can see posts)
--   • club_members              president / vice president / committee / member
--   • club_posts                activities, regular meetings, updates
--   • club_applications         "start a new club under PPMK" (admins approve)
--   • forum_posts / comments / votes   Reddit-style discussion board,
--                               with optional anonymous posting and a
--                               "Team up" section for hackathons/startups
--   • profiles.account_type     'member' (PPMK student) or 'visitor'
--                               (anyone else: may only use the public
--                               "Explore Korea" topics of the board)
--   • opportunities             Explore: external events & programmes
--                               (Korea / Asia / global / online)
--   • public_* functions        what the homepage shows before sign-in
--
-- Security model (same as 0001): row-level security decides who sees and
-- changes what. Anything that must hide who wrote it (anonymous posts) is
-- read ONLY through functions that blank out the author.
-- =====================================================================

-- ---------- Usernames --------------------------------------------------

alter table public.profiles add column if not exists username text;

alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_.]{3,20}$');

create unique index if not exists profiles_username_key
  on public.profiles (username) where username is not null;

grant update (username) on public.profiles to authenticated;

-- ---------- Members and visitors -------------------------------------
-- Visitors (tourists, friends, non-PPMK students) sign in with just an
-- email, a username and consent. They can use the public "Explore Korea"
-- topics on the board and nothing else.

alter table public.profiles add column if not exists account_type text not null default 'member';
alter table public.profiles add constraint profiles_account_type_check
  check (account_type in ('member', 'visitor'));

grant update (account_type) on public.profiles to authenticated;

-- A PPMK member with a complete student profile (organizers/admins always).
create function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_organizer()
      or coalesce((select account_type = 'member' from public.profiles where id = auth.uid()), false)
         and public.my_profile_is_complete()
$$;

-- Members-only areas. RESTRICTIVE policies are ANDed with every existing
-- rule, so these close events, RSVPs and clubs to visitors without
-- touching the rules in 0001.
create policy "members only" on public.events        as restrictive for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.event_invites as restrictive for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.rsvps         as restrictive for all to authenticated using (public.is_member()) with check (public.is_member());
create policy "members only" on public.clubs         as restrictive for all to authenticated using (public.is_member()) with check (public.is_member());

create function public.my_username()
returns text
language sql stable security definer set search_path = ''
as $$
  select username from public.profiles where id = auth.uid()
$$;

-- Lets the sign-up form say "taken" before saving.
create function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(p_username) and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000')
  )
$$;

-- Usernames are public inside the hub (that is their purpose); this never
-- returns names, phones or emails.
create function public.public_usernames(p_ids uuid[])
returns table (id uuid, username text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username from public.profiles p where p.id = any (p_ids)
$$;

-- ---------- Clubs: page details and settings ---------------------------

alter table public.clubs
  add column if not exists status        text not null default 'active',
  add column if not exists tagline       text not null default '',
  add column if not exists about         text not null default '',
  add column if not exists meeting_info  text not null default '',
  add column if not exists instagram     text,
  add column if not exists cover_url     text,
  add column if not exists join_policy   text not null default 'approval',
  add column if not exists who_can_post  text not null default 'leaders',
  add column if not exists posts_visibility text not null default 'everyone';

alter table public.clubs
  add constraint clubs_status_check       check (status in ('active', 'inactive')),
  add constraint clubs_tagline_len        check (char_length(tagline) <= 140),
  add constraint clubs_about_len          check (char_length(about) <= 5000),
  add constraint clubs_meeting_len        check (char_length(meeting_info) <= 300),
  add constraint clubs_join_policy_check  check (join_policy in ('open', 'approval')),
  add constraint clubs_who_can_post_check check (who_can_post in ('leaders', 'members')),
  add constraint clubs_posts_vis_check    check (posts_visibility in ('everyone', 'members'));

create type public.club_role as enum ('president', 'vice_president', 'committee', 'member');

create table public.club_members (
  club_id     uuid not null references public.clubs (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role        public.club_role not null default 'member',
  status      text not null default 'pending' check (status in ('pending', 'active')),
  message     text not null default '' check (char_length(message) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

create index club_members_user_idx on public.club_members (user_id);

create trigger club_members_touch before update on public.club_members
  for each row execute function public.touch_updated_at();

-- My active role in a club (null if not an active member).
create function public.my_club_role(p_club_id uuid)
returns public.club_role
language sql stable security definer set search_path = ''
as $$
  select role from public.club_members
  where club_id = p_club_id and user_id = auth.uid() and status = 'active'
$$;

-- President or vice president (or a hub admin).
create function public.is_club_leader(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or coalesce(public.my_club_role(p_club_id) in ('president', 'vice_president'), false)
$$;

create function public.is_club_member(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.my_club_role(p_club_id) is not null
$$;

-- Leaders and committee can always post; ordinary members only when the
-- club's setting allows it.
create function public.can_post_in_club(p_club_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or coalesce(public.my_club_role(p_club_id) in ('president', 'vice_president', 'committee'), false)
      or (public.my_club_role(p_club_id) = 'member'
          and (select who_can_post from public.clubs where id = p_club_id) = 'members')
$$;

-- Club leaders may now edit their own club's page. Only admins may change
-- a club's status (active / inactive) or delete it (policies from 0001).
create policy "clubs: leaders update own club" on public.clubs
  for update to authenticated
  using (public.is_club_leader(id)) with check (public.is_club_leader(id));

create function public.clubs_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() and new.status is distinct from old.status then
    raise exception 'ONLY_ADMINS_CHANGE_STATUS';
  end if;
  return new;
end;
$$;

create trigger clubs_guard before update on public.clubs
  for each row execute function public.clubs_guard();

alter table public.club_members enable row level security;
create policy "members only" on public.club_members as restrictive for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- Direct reads: your own memberships, or a club you lead. Everyone else
-- reads member lists through list_club_members() (usernames only).
create policy "club_members: read own or leader" on public.club_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_club_leader(club_id));

revoke all on public.club_members from anon, authenticated;
grant select on public.club_members to authenticated;
-- All writes go through the functions below.

-- Ask to join (or join straight away when the club is open).
create function public.join_club(p_club_id uuid, p_message text default '')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_policy text;
  v_status text;
begin
  if not public.my_profile_is_complete() then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select join_policy into v_policy from public.clubs where id = p_club_id and status = 'active';
  if v_policy is null then
    raise exception 'CLUB_NOT_FOUND';
  end if;

  v_status := case when v_policy = 'open' then 'active' else 'pending' end;

  insert into public.club_members (club_id, user_id, role, status, message)
  values (p_club_id, auth.uid(), 'member', v_status, left(coalesce(p_message, ''), 500))
  on conflict (club_id, user_id) do update
    set message = excluded.message
    where public.club_members.status = 'pending';

  return (select status from public.club_members where club_id = p_club_id and user_id = auth.uid());
end;
$$;

create function public.leave_club(p_club_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.my_club_role(p_club_id) = 'president'
     and (select count(*) from public.club_members
          where club_id = p_club_id and role = 'president' and status = 'active') <= 1 then
    raise exception 'LAST_PRESIDENT';
  end if;

  delete from public.club_members where club_id = p_club_id and user_id = auth.uid();
end;
$$;

-- Leaders: accept or decline a join request.
create function public.decide_club_request(p_club_id uuid, p_user_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_leader(p_club_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_accept then
    update public.club_members set status = 'active'
    where club_id = p_club_id and user_id = p_user_id and status = 'pending';
  else
    delete from public.club_members
    where club_id = p_club_id and user_id = p_user_id and status = 'pending';
  end if;
end;
$$;

-- Leaders: change someone's role. Only the president (or an admin) can
-- appoint a president or vice president.
create function public.set_club_member_role(p_club_id uuid, p_user_id uuid, p_role public.club_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.club_role;
begin
  if not public.is_club_leader(p_club_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  select role into v_old from public.club_members
  where club_id = p_club_id and user_id = p_user_id and status = 'active';
  if v_old is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  if (p_role in ('president', 'vice_president') or v_old in ('president', 'vice_president'))
     and not (public.is_admin() or public.my_club_role(p_club_id) = 'president') then
    raise exception 'ONLY_PRESIDENT';
  end if;

  if v_old = 'president' and p_role <> 'president'
     and (select count(*) from public.club_members
          where club_id = p_club_id and role = 'president' and status = 'active') <= 1 then
    raise exception 'LAST_PRESIDENT';
  end if;

  update public.club_members set role = p_role
  where club_id = p_club_id and user_id = p_user_id;

  -- Club presidents and vice presidents run events, so they get the
  -- hub's organizer role (never lowers anyone's role).
  if p_role in ('president', 'vice_president') then
    update public.profiles set role = 'organizer'
    where id = p_user_id and role = 'student';
  end if;
end;
$$;

create function public.remove_club_member(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_club_leader(p_club_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  if (select role from public.club_members where club_id = p_club_id and user_id = p_user_id)
       in ('president', 'vice_president')
     and not (public.is_admin() or public.my_club_role(p_club_id) = 'president') then
    raise exception 'ONLY_PRESIDENT';
  end if;

  if (select role from public.club_members where club_id = p_club_id and user_id = p_user_id) = 'president'
     and (select count(*) from public.club_members
          where club_id = p_club_id and role = 'president' and status = 'active') <= 1 then
    raise exception 'LAST_PRESIDENT';
  end if;

  delete from public.club_members where club_id = p_club_id and user_id = p_user_id;
end;
$$;

-- Member list: usernames and roles. Leaders also see pending requests
-- (with the message the student wrote).
create function public.list_club_members(p_club_id uuid)
returns table (
  user_id uuid, username text, role public.club_role, status text,
  message text, batch smallint, joined_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.username, m.role, m.status,
         case when public.is_club_leader(p_club_id) then m.message else '' end,
         p.batch, m.created_at
  from public.club_members m
  join public.profiles p on p.id = m.user_id
  where m.club_id = p_club_id
    and public.is_member()
    and (m.status = 'active' or public.is_club_leader(p_club_id) or m.user_id = auth.uid())
  order by array_position(array['president','vice_president','committee','member']::text[], m.role::text),
           p.username
$$;

-- Clubs with member counts, for the directory.
create function public.club_member_counts()
returns table (club_id uuid, members bigint, pending bigint)
language sql stable security definer set search_path = ''
as $$
  select c.id,
         count(m.user_id) filter (where m.status = 'active'),
         case when public.is_club_leader(c.id)
              then count(m.user_id) filter (where m.status = 'pending') else 0 end
  from public.clubs c
  left join public.club_members m on m.club_id = c.id
  where public.is_member()
  group by c.id
$$;

-- ---------- Club posts (activities, regular meetings, updates) ---------

create table public.club_posts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs (id) on delete cascade,
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  kind        text not null default 'update' check (kind in ('update', 'activity', 'meeting')),
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null default '' check (char_length(body) <= 4000),
  meeting_at  timestamptz,
  location    text not null default '' check (char_length(location) <= 200),
  visibility  text not null default 'everyone' check (visibility in ('everyone', 'members')),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index club_posts_club_idx on public.club_posts (club_id, created_at desc);

create trigger club_posts_touch before update on public.club_posts
  for each row execute function public.touch_updated_at();

alter table public.club_posts enable row level security;
create policy "members only" on public.club_posts as restrictive for all to authenticated
  using (public.is_member()) with check (public.is_member());

create policy "club_posts: read if visible" on public.club_posts
  for select to authenticated using (
    public.is_club_member(club_id)
    or (visibility = 'everyone'
        and (select posts_visibility from public.clubs where id = club_id) = 'everyone')
  );

create policy "club_posts: allowed members insert" on public.club_posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_post_in_club(club_id));

create policy "club_posts: author or leader update" on public.club_posts
  for update to authenticated
  using (author_id = auth.uid() or public.is_club_leader(club_id))
  with check (public.can_post_in_club(club_id) or public.is_club_leader(club_id));

create policy "club_posts: author or leader delete" on public.club_posts
  for delete to authenticated
  using (author_id = auth.uid() or public.is_club_leader(club_id));

revoke all on public.club_posts from anon, authenticated;
grant select, delete on public.club_posts to authenticated;
grant insert (club_id, kind, title, body, meeting_at, location, visibility, pinned)
  on public.club_posts to authenticated;
grant update (kind, title, body, meeting_at, location, visibility, pinned)
  on public.club_posts to authenticated;

-- ---------- Applications to start a new club ---------------------------

create table public.club_applications (
  id               uuid primary key default gen_random_uuid(),
  applicant_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  club_name        text not null check (char_length(club_name) between 2 and 100),
  category         text not null default 'Social',
  tagline          text not null default '' check (char_length(tagline) <= 140),
  description      text not null check (char_length(description) between 20 and 3000),
  objectives       text not null default '' check (char_length(objectives) <= 3000),
  activities_plan  text not null default '' check (char_length(activities_plan) <= 3000),
  advisor_name     text not null default '' check (char_length(advisor_name) <= 100),
  founding_members text not null default '' check (char_length(founding_members) <= 2000),
  -- { "constitution": "https://drive...", "member_list": "...", ... }
  documents        jsonb not null default '{}'::jsonb,
  status           text not null default 'pending'
                   check (status in ('pending', 'needs_changes', 'approved', 'rejected')),
  admin_note       text not null default '' check (char_length(admin_note) <= 1000),
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  club_id          uuid references public.clubs (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger club_applications_touch before update on public.club_applications
  for each row execute function public.touch_updated_at();

-- When an applicant fixes an application that needed changes, it goes
-- back to the admins' queue automatically.
create function public.club_applications_resubmit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() and old.status = 'needs_changes' then
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger club_applications_resubmit before update on public.club_applications
  for each row execute function public.club_applications_resubmit();

alter table public.club_applications enable row level security;
create policy "members only" on public.club_applications as restrictive for all to authenticated
  using (public.is_member()) with check (public.is_member());

create policy "club_applications: read own or admin" on public.club_applications
  for select to authenticated using (applicant_id = auth.uid() or public.is_admin());

create policy "club_applications: insert own" on public.club_applications
  for insert to authenticated
  with check (applicant_id = auth.uid() and status = 'pending' and public.my_profile_is_complete());

create policy "club_applications: edit own while open" on public.club_applications
  for update to authenticated
  using (applicant_id = auth.uid() and status in ('pending', 'needs_changes'))
  with check (applicant_id = auth.uid());

create policy "club_applications: withdraw own while open" on public.club_applications
  for delete to authenticated
  using (applicant_id = auth.uid() and status in ('pending', 'needs_changes'));

-- Applicants never touch status / admin_note / club_id (column grants).
revoke all on public.club_applications from anon, authenticated;
grant select, delete on public.club_applications to authenticated;
grant insert (club_name, category, tagline, description, objectives, activities_plan,
              advisor_name, founding_members, documents)
  on public.club_applications to authenticated;
grant update (club_name, category, tagline, description, objectives, activities_plan,
              advisor_name, founding_members, documents)
  on public.club_applications to authenticated;

-- Admins: approve (creates the club, makes the applicant its president
-- and an organizer so they can run events), ask for changes, or reject.
create function public.review_club_application(p_id uuid, p_decision text, p_note text default '')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_app public.club_applications;
  v_club uuid;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_decision not in ('approved', 'needs_changes', 'rejected') then
    raise exception 'BAD_DECISION';
  end if;

  select * into v_app from public.club_applications where id = p_id for update;
  if v_app.id is null then
    raise exception 'NOT_FOUND';
  end if;
  if v_app.status in ('approved', 'rejected') then
    raise exception 'ALREADY_DECIDED';
  end if;

  if p_decision = 'approved' then
    insert into public.clubs (name, category, description, tagline, about)
    values (v_app.club_name, v_app.category, v_app.description, v_app.tagline,
            trim(v_app.objectives || E'\n\n' || v_app.activities_plan))
    returning id into v_club;

    insert into public.club_members (club_id, user_id, role, status)
    values (v_club, v_app.applicant_id, 'president', 'active');

    update public.profiles set role = 'organizer'
    where id = v_app.applicant_id and role = 'student';
  end if;

  update public.club_applications
  set status = p_decision, admin_note = left(coalesce(p_note, ''), 1000),
      reviewed_by = auth.uid(), reviewed_at = now(), club_id = v_club
  where id = p_id;

  return v_club;
end;
$$;

-- Admins: put a club's first president in place (for the 4 starter clubs).
create function public.admin_set_club_president(p_club_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into public.club_members (club_id, user_id, role, status)
  values (p_club_id, p_user_id, 'president', 'active')
  on conflict (club_id, user_id) do update set role = 'president', status = 'active';

  update public.profiles set role = 'organizer' where id = p_user_id and role = 'student';
end;
$$;

-- ---------- Discussion board -------------------------------------------

create table public.forum_posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category      text not null check (category in (
                  -- Explore Korea (open to visitors and readable signed-out)
                  'food', 'hidden_gems', 'hangout', 'trips', 'budget',
                  -- Student life (members)
                  'study', 'serious', 'career', 'general',
                  -- Team up (members): find people for external activities
                  'hackathon', 'startup', 'activities')),
  title         text not null check (char_length(title) between 3 and 150),
  body          text not null default '' check (char_length(body) <= 10000),
  place_name    text check (place_name is null or char_length(place_name) <= 120),
  place_area    text check (place_area is null or char_length(place_area) <= 120),
  map_url       text check (map_url is null or (char_length(map_url) <= 500 and map_url ~ '^https?://')),
  cost_note     text check (cost_note is null or char_length(cost_note) <= 80),
  -- Team up posts
  link_url      text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https?://')),
  deadline      date,
  looking_for   text check (looking_for is null or char_length(looking_for) <= 300),
  is_closed     boolean not null default false,
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index forum_posts_created_idx on public.forum_posts (created_at desc);

create table public.forum_comments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.forum_posts (id) on delete cascade,
  parent_id     uuid references public.forum_comments (id) on delete cascade,
  author_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 4000),
  is_anonymous  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index forum_comments_post_idx on public.forum_comments (post_id, created_at);

create table public.forum_votes (
  post_id     uuid not null references public.forum_posts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create trigger forum_posts_touch before update on public.forum_posts
  for each row execute function public.touch_updated_at();
create trigger forum_comments_touch before update on public.forum_comments
  for each row execute function public.touch_updated_at();

alter table public.forum_posts    enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_votes    enable row level security;

-- Topics anyone may read, and visitors may post in.
create function public.forum_category_is_public(p_category text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_category in ('food', 'hidden_gems', 'hangout', 'trips', 'budget')
$$;

create function public.can_see_forum_category(p_category text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.forum_category_is_public(p_category) or public.is_member()
$$;

create function public.can_see_forum_post(p_post_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select public.can_see_forum_category(category) from public.forum_posts where id = p_post_id), false)
$$;

-- Direct table reads only return your OWN rows, so an anonymous author can
-- never be found by reading the table. Everyone reads the board through
-- list_forum_posts() / get_forum_post() / list_forum_comments().
create policy "forum_posts: read own" on public.forum_posts
  for select to authenticated using (author_id = auth.uid());
create policy "forum_posts: insert own (with username)" on public.forum_posts
  for insert to authenticated
  with check (author_id = auth.uid() and public.my_username() is not null
              and public.can_see_forum_category(category));
create policy "forum_posts: update own" on public.forum_posts
  for update to authenticated using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.can_see_forum_category(category));
create policy "forum_posts: delete own" on public.forum_posts
  for delete to authenticated using (author_id = auth.uid());

create policy "forum_comments: read own" on public.forum_comments
  for select to authenticated using (author_id = auth.uid());
create policy "forum_comments: insert own (with username)" on public.forum_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.my_username() is not null
              and public.can_see_forum_post(post_id));
create policy "forum_comments: update own" on public.forum_comments
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "forum_comments: delete own" on public.forum_comments
  for delete to authenticated using (author_id = auth.uid());

create policy "forum_votes: own" on public.forum_votes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.forum_posts, public.forum_comments, public.forum_votes from anon, authenticated;
grant select, delete on public.forum_posts to authenticated;
grant insert (category, title, body, place_name, place_area, map_url, cost_note,
              link_url, deadline, looking_for, is_closed, is_anonymous)
  on public.forum_posts to authenticated;
grant update (category, title, body, place_name, place_area, map_url, cost_note,
              link_url, deadline, looking_for, is_closed, is_anonymous)
  on public.forum_posts to authenticated;

grant select, delete on public.forum_comments to authenticated;
grant insert (post_id, parent_id, body, is_anonymous) on public.forum_comments to authenticated;
grant update (body) on public.forum_comments to authenticated;

grant select, insert, update, delete on public.forum_votes to authenticated;

-- Board listing. author_username is null when the post is anonymous.
create function public.list_forum_posts(
  p_category text default null,
  p_sort     text default 'hot',
  p_search   text default null,
  p_limit    integer default 30,
  p_offset   integer default 0
)
returns table (
  id uuid, category text, title text, body text,
  place_name text, place_area text, map_url text, cost_note text,
  link_url text, deadline date, looking_for text, is_closed boolean,
  is_anonymous boolean, author_username text, is_mine boolean,
  score bigint, my_vote smallint, comment_count bigint,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  with base as (
    select f.*,
           coalesce((select sum(v.value) from public.forum_votes v where v.post_id = f.id), 0) as score,
           (select v.value from public.forum_votes v where v.post_id = f.id and v.user_id = auth.uid()) as my_vote,
           (select count(*) from public.forum_comments c where c.post_id = f.id) as comment_count
    from public.forum_posts f
    where public.can_see_forum_category(f.category)
      and (p_category is null or f.category = p_category
           or (p_category = 'group:explore' and f.category in ('food', 'hidden_gems', 'hangout', 'trips', 'budget'))
           or (p_category = 'group:life' and f.category in ('study', 'serious', 'career', 'general'))
           or (p_category = 'group:teamup' and f.category in ('hackathon', 'startup', 'activities')))
      and (p_search is null or f.title ilike '%' || p_search || '%'
           or f.body ilike '%' || p_search || '%' or f.place_name ilike '%' || p_search || '%'
           or f.place_area ilike '%' || p_search || '%')
  )
  select b.id, b.category, b.title, b.body, b.place_name, b.place_area, b.map_url, b.cost_note,
         b.link_url, b.deadline, b.looking_for, b.is_closed,
         b.is_anonymous,
         case when b.is_anonymous then null else p.username end,
         coalesce(b.author_id = auth.uid(), false),
         b.score, b.my_vote, b.comment_count, b.created_at, b.updated_at
  from base b
  left join public.profiles p on p.id = b.author_id
  order by
    case when p_sort = 'top' then b.score end desc nulls last,
    case when p_sort = 'hot'
         then (b.score + 1) / power(extract(epoch from (now() - b.created_at)) / 3600 + 2, 1.5) end desc nulls last,
    b.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

create function public.get_forum_post(p_id uuid)
returns table (
  id uuid, category text, title text, body text,
  place_name text, place_area text, map_url text, cost_note text,
  link_url text, deadline date, looking_for text, is_closed boolean,
  is_anonymous boolean, author_username text, is_mine boolean,
  score bigint, my_vote smallint, comment_count bigint,
  created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select f.id, f.category, f.title, f.body, f.place_name, f.place_area, f.map_url, f.cost_note,
         f.link_url, f.deadline, f.looking_for, f.is_closed,
         f.is_anonymous,
         case when f.is_anonymous then null else p.username end,
         coalesce(f.author_id = auth.uid(), false),
         coalesce((select sum(v.value) from public.forum_votes v where v.post_id = f.id), 0),
         (select v.value from public.forum_votes v where v.post_id = f.id and v.user_id = auth.uid()),
         (select count(*) from public.forum_comments c where c.post_id = f.id),
         f.created_at, f.updated_at
  from public.forum_posts f
  left join public.profiles p on p.id = f.author_id
  where f.id = p_id and public.can_see_forum_category(f.category)
$$;

-- Comments. is_op only shows when it can't unmask an anonymous post.
create function public.list_forum_comments(p_post_id uuid)
returns table (
  id uuid, parent_id uuid, body text, is_anonymous boolean,
  author_username text, is_mine boolean, is_op boolean, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.parent_id, c.body, c.is_anonymous,
         case when c.is_anonymous then null else p.username end,
         coalesce(c.author_id = auth.uid(), false),
         c.author_id = f.author_id and (not f.is_anonymous or c.is_anonymous),
         c.created_at
  from public.forum_comments c
  join public.forum_posts f on f.id = c.post_id
  left join public.profiles p on p.id = c.author_id
  where c.post_id = p_post_id and public.can_see_forum_category(f.category)
  order by c.created_at
$$;

-- Up / down / clear (0) a vote. Returns the new score.
create function public.vote_forum_post(p_post_id uuid, p_value smallint)
returns bigint
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  if not public.can_see_forum_post(p_post_id) then
    raise exception 'NOT_ALLOWED';
  end if;

  if p_value = 0 then
    delete from public.forum_votes where post_id = p_post_id and user_id = auth.uid();
  elsif p_value in (-1, 1) then
    insert into public.forum_votes (post_id, user_id, value) values (p_post_id, auth.uid(), p_value)
    on conflict (post_id, user_id) do update set value = excluded.value;
  else
    raise exception 'BAD_VOTE';
  end if;

  return coalesce((select sum(value) from public.forum_votes where post_id = p_post_id), 0);
end;
$$;

-- Admins: remove a post or comment (moderation) without ever seeing who
-- wrote an anonymous one.
create function public.admin_remove_forum_item(p_kind text, p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_kind = 'post' then
    delete from public.forum_posts where id = p_id;
  elsif p_kind = 'comment' then
    delete from public.forum_comments where id = p_id;
  else
    raise exception 'BAD_KIND';
  end if;
end;
$$;

-- ---------- Explore: opportunities beyond PPMK -------------------------
-- External events and programmes (e.g. AYNK, embassy, university or
-- government programmes, hackathons). Organizers publish; members can
-- suggest one for organizers to check. Published ones are public.

create table public.opportunities (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 3 and 150),
  organizer       text not null default '' check (char_length(organizer) <= 120),
  kind            text not null default 'other' check (kind in (
                    'conference', 'culture', 'competition', 'scholarship',
                    'volunteer', 'career', 'sports', 'other')),
  scope           text not null default 'korea' check (scope in ('korea', 'asia', 'global', 'online')),
  location        text not null default '' check (char_length(location) <= 200),
  start_date      date,
  end_date        date,
  apply_deadline  date,
  url             text check (url is null or (char_length(url) <= 500 and url ~ '^https?://')),
  description     text not null default '' check (char_length(description) <= 3000),
  status          text not null default 'suggested' check (status in ('suggested', 'published', 'archived')),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint opportunities_dates check (end_date is null or start_date is null or end_date >= start_date)
);

create index opportunities_start_idx on public.opportunities (start_date);

create trigger opportunities_touch before update on public.opportunities
  for each row execute function public.touch_updated_at();

alter table public.opportunities enable row level security;

create policy "opportunities: published are public" on public.opportunities
  for select to anon, authenticated
  using (status = 'published' or created_by = auth.uid() or public.is_organizer());

-- Members suggest; organizers publish directly.
create policy "opportunities: members suggest, organizers publish" on public.opportunities
  for insert to authenticated
  with check (created_by = auth.uid() and public.is_member()
              and (status = 'suggested' or public.is_organizer()));

create policy "opportunities: organizers edit" on public.opportunities
  for update to authenticated using (public.is_organizer()) with check (public.is_organizer());

create policy "opportunities: organizers or suggester delete" on public.opportunities
  for delete to authenticated
  using (public.is_organizer() or (created_by = auth.uid() and status = 'suggested'));

revoke all on public.opportunities from anon, authenticated;
grant select on public.opportunities to anon, authenticated;
grant insert (title, organizer, kind, scope, location, start_date, end_date, apply_deadline, url, description, status)
  on public.opportunities to authenticated;
grant update (title, organizer, kind, scope, location, start_date, end_date, apply_deadline, url, description, status)
  on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;

-- ---------- Homepage (visible before sign-in) --------------------------

-- Upcoming events open to everyone: title, date, place and club only.
create function public.public_upcoming_events()
returns table (id uuid, title text, category text, event_date date, start_time time,
               location text, club_name text)
language sql stable security definer set search_path = ''
as $$
  select e.id, e.title, e.category, e.event_date, e.start_time, e.location, c.name
  from public.events e
  left join public.clubs c on c.id = e.club_id
  where e.audience = 'everyone' and e.event_date >= public.today_kst()
  order by e.event_date, e.start_time
  limit 6
$$;

-- Headline numbers for the homepage.
create function public.public_hub_stats()
returns table (members bigint, clubs bigint, events_this_year bigint)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.profiles where account_type = 'member' and consent_at is not null and full_name is not null),
    (select count(*) from public.clubs where status = 'active'),
    (select count(*) from public.events where extract(year from event_date) = extract(year from public.today_kst()))
$$;

-- ---------- Landing page (visible before sign-in) ----------------------
-- Only club names and short taglines: nothing personal.
create function public.public_club_directory()
returns table (id uuid, name text, category text, tagline text, members bigint)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.name, c.category, c.tagline,
         (select count(*) from public.club_members m where m.club_id = c.id and m.status = 'active')
  from public.clubs c
  where c.status = 'active'
  order by c.name
$$;

-- ---------- Function permissions ---------------------------------------

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
grant  execute on function public.public_club_directory() to anon;
grant  execute on function public.public_upcoming_events() to anon;
grant  execute on function public.public_hub_stats() to anon;
-- Signed-out visitors may READ the public "Explore Korea" topics.
grant  execute on function public.list_forum_posts(text, text, text, integer, integer) to anon;
grant  execute on function public.get_forum_post(uuid) to anon;
grant  execute on function public.list_forum_comments(uuid) to anon;
grant  execute on function public.forum_category_is_public(text) to anon;
grant  execute on function public.can_see_forum_category(text) to anon;
grant  execute on function public.is_member() to anon;
grant  execute on function public.is_organizer() to anon;
grant  execute on function public.my_role() to anon;
grant  execute on function public.my_profile_is_complete() to anon;

grant select, insert, update, delete on all tables in schema public to service_role;
