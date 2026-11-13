-- =====================================================================
-- 0006: PPMK organisation page
--
--   • org_people     High Committee members and scholarship-sponsor
--                    officers (MARA, JPA, ...), with contact details
--   • org-photos     storage for their profile photos (admins upload;
--                    public, like the names)
--   • org_calendar   the PPMK calendar (AGM, festive events,
--                    sports carnival, deadlines, ...)
--
-- Who sees what:
--   • Everyone (even signed out): names, roles, the calendar.
--   • Signed-in PPMK members: also phone, email, WhatsApp, Instagram.
--   • Admins: add, edit and remove entries.
-- Contact details are only readable through list_org_people(), which
-- blanks them for non-members, so they can't be scraped from the table.
--
-- Needs 0004 (is_member). Run once, in Supabase → SQL Editor.
-- =====================================================================

create table public.org_people (
  id          uuid primary key default gen_random_uuid(),
  -- 'committee' = High Committee; 'sponsor' = MARA / JPA / other officer
  kind        text not null default 'committee' check (kind in ('committee', 'sponsor')),
  sponsor     text check (sponsor is null or char_length(sponsor) <= 40),   -- 'MARA', 'JPA', ...
  role        text not null check (char_length(role) between 2 and 80),
  -- Committee hierarchy: 1 President, 2 Vice Presidents, 3 Secretariat &
  -- Treasury, 4 Bureau heads, 5 Committee members (AJK).
  tier        smallint not null default 4 check (tier between 1 and 5),
  name        text not null check (char_length(name) between 2 and 100),
  detail      text not null default '' check (char_length(detail) <= 200),  -- university, office, area of help
  session     text not null default '' check (char_length(session) <= 20),  -- '2026/2027'
  email       text check (email is null or (char_length(email) <= 120 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone       text check (phone is null or char_length(phone) between 6 and 30),
  whatsapp    text check (whatsapp is null or whatsapp ~ '^\+?[0-9]{8,15}$'),
  instagram   text check (instagram is null or char_length(instagram) <= 40),
  -- Path in the "org-photos" bucket, e.g. "<person id>/<random>.jpg"
  photo_path  text check (photo_path is null or char_length(photo_path) <= 200),
  sort_order  smallint not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint org_people_sponsor_named check (kind <> 'sponsor' or sponsor is not null)
);

create index org_people_kind_idx on public.org_people (kind, sort_order);

create trigger org_people_touch before update on public.org_people
  for each row execute function public.touch_updated_at();

create table public.org_calendar (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 2 and 120),
  category    text not null default 'event' check (category in ('event', 'festive', 'sports', 'academic', 'deadline', 'meeting')),
  start_date  date not null,
  end_date    date,
  location    text not null default '' check (char_length(location) <= 200),
  description text not null default '' check (char_length(description) <= 1000),
  url         text check (url is null or (char_length(url) <= 500 and url ~ '^https?://')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint org_calendar_dates check (end_date is null or end_date >= start_date)
);

create index org_calendar_date_idx on public.org_calendar (start_date);

create trigger org_calendar_touch before update on public.org_calendar
  for each row execute function public.touch_updated_at();

alter table public.org_people   enable row level security;
alter table public.org_calendar enable row level security;

-- org_people: direct table access is for admins only (it holds contacts).
create policy "org_people: admins read" on public.org_people
  for select to authenticated using (public.is_admin());
create policy "org_people: admins write" on public.org_people
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- org_calendar: public to read, admins write.
create policy "org_calendar: everyone reads" on public.org_calendar
  for select to anon, authenticated using (true);
create policy "org_calendar: admins write" on public.org_calendar
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.org_people, public.org_calendar from anon, authenticated;
grant select, insert, update, delete on public.org_people to authenticated;
grant select on public.org_calendar to anon, authenticated;
grant insert, update, delete on public.org_calendar to authenticated;
grant select, insert, update, delete on public.org_people, public.org_calendar to service_role;

-- Profile photos: public files (like the names), only admins upload or
-- remove them. Shrunk and cropped in the browser before upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-photos', 'org-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "org-photos: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'org-photos' and public.is_admin());
create policy "org-photos: admins replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'org-photos' and public.is_admin())
  with check (bucket_id = 'org-photos' and public.is_admin());
create policy "org-photos: admins remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'org-photos' and public.is_admin());
create policy "org-photos: anyone can view" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'org-photos');

-- Names and roles for everyone; contact details only for members.
create function public.list_org_people()
returns table (
  id uuid, kind text, sponsor text, role text, tier smallint, name text, detail text,
  session text, email text, phone text, whatsapp text, instagram text,
  photo_path text, sort_order smallint, contacts_hidden boolean
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.kind, p.sponsor, p.role, p.tier, p.name, p.detail, p.session,
         case when public.is_member() then p.email end,
         case when public.is_member() then p.phone end,
         case when public.is_member() then p.whatsapp end,
         p.instagram,  -- public social handle
         p.photo_path, -- public, like the name
         p.sort_order,
         not public.is_member() and (p.email is not null or p.phone is not null or p.whatsapp is not null)
  from public.org_people p
  order by p.kind, p.tier, p.sponsor nulls first, p.sort_order, p.role
$$;

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
grant  execute on function public.list_org_people() to anon;
-- (re-grant what earlier migrations opened to signed-out visitors)
grant  execute on function public.can_see_photo_target(uuid, uuid, uuid) to anon;
grant  execute on function public.can_view_photo_file(text) to anon;
grant  execute on function public.can_see_forum_post(uuid) to anon;
grant  execute on function public.can_see_forum_category(text) to anon;
grant  execute on function public.forum_category_is_public(text) to anon;
grant  execute on function public.is_member() to anon;
grant  execute on function public.is_organizer() to anon;
grant  execute on function public.is_admin() to anon;
grant  execute on function public.is_club_member(uuid) to anon;
grant  execute on function public.my_role() to anon;
grant  execute on function public.my_club_role(uuid) to anon;
grant  execute on function public.my_profile_is_complete() to anon;
grant  execute on function public.public_club_directory() to anon;
grant  execute on function public.public_upcoming_events() to anon;
grant  execute on function public.public_hub_stats() to anon;
grant  execute on function public.list_forum_posts(text, text, text, integer, integer) to anon;
grant  execute on function public.get_forum_post(uuid) to anon;
grant  execute on function public.list_forum_comments(uuid) to anon;
