-- =====================================================================
-- 0005: photos (discussion posts, club posts, club gallery)
--
-- Every photo needs an admin's approval before anyone else can see it.
-- Until then only the person who uploaded it (and admins) can view it.
--
--   • storage bucket "photos" (PRIVATE: files are only served to people
--     the rules below allow, via short-lived signed links)
--   • public.photos            one row per photo, with its review status
--   • review_photo()           admins approve or reject (with a reason)
--
-- Needs 0004. Run once, in Supabase → SQL Editor.
-- =====================================================================

-- ---------- Storage bucket ---------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------- Photos table -----------------------------------------------

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  -- Storage path: "<uploader id>/<random>.jpg"
  path          text not null unique check (char_length(path) <= 200),
  uploaded_by   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Exactly one of these says what the photo belongs to. Deleting the
  -- post or club deletes its photo rows too.
  forum_post_id uuid references public.forum_posts (id) on delete cascade,
  club_post_id  uuid references public.club_posts (id) on delete cascade,
  club_id       uuid references public.clubs (id) on delete cascade,
  caption       text not null default '' check (char_length(caption) <= 200),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text not null default '' check (char_length(reject_reason) <= 300),
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint photos_one_target check (num_nonnulls(forum_post_id, club_post_id, club_id) = 1)
);

create index photos_forum_post_idx on public.photos (forum_post_id) where forum_post_id is not null;
create index photos_club_post_idx  on public.photos (club_post_id)  where club_post_id  is not null;
create index photos_club_idx       on public.photos (club_id)       where club_id       is not null;
create index photos_pending_idx    on public.photos (created_at)    where status = 'pending';

-- Could the signed-in person (or a signed-out visitor) see what this photo
-- is attached to? Photos are never more visible than their post or club.
create function public.can_see_photo_target(p_forum_post uuid, p_club_post uuid, p_club uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_forum_post is not null then public.can_see_forum_post(p_forum_post)
    when p_club_post is not null then coalesce((
      select public.is_club_member(cp.club_id)
          or (public.is_member() and cp.visibility = 'everyone' and c.posts_visibility = 'everyone')
      from public.club_posts cp join public.clubs c on c.id = cp.club_id
      where cp.id = p_club_post), false)
    when p_club is not null then public.is_member()
    else false
  end
$$;

-- May the signed-in person attach photos here? Authors to their own posts;
-- club leaders to their club's posts and gallery.
create function public.can_add_photo_to(p_forum_post uuid, p_club_post uuid, p_club uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and case
    when p_forum_post is not null then exists (
      select 1 from public.forum_posts where id = p_forum_post and author_id = auth.uid())
    when p_club_post is not null then exists (
      select 1 from public.club_posts cp
      where cp.id = p_club_post and (cp.author_id = auth.uid() or public.is_club_leader(cp.club_id)))
    when p_club is not null then public.is_club_leader(p_club)
    else false
  end
$$;

-- Limits: 6 photos per post or gallery batch target, 30 uploads a day each.
create function public.photos_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.photos
      where uploaded_by = new.uploaded_by and created_at > now() - interval '1 day') >= 30 then
    raise exception 'PHOTO_DAILY_LIMIT';
  end if;
  if new.club_id is null and (select count(*) from public.photos
      where forum_post_id is not distinct from new.forum_post_id
        and club_post_id is not distinct from new.club_post_id
        and status <> 'rejected') >= 6 then
    raise exception 'PHOTO_POST_LIMIT';
  end if;
  return new;
end;
$$;

create trigger photos_limits before insert on public.photos
  for each row execute function public.photos_limits();

alter table public.photos enable row level security;

-- Everyone else only ever sees APPROVED photos, and only where they can
-- see the post/club. Uploaders see their own (pending/rejected too).
create policy "photos: approved and visible, own, or admin" on public.photos
  for select to anon, authenticated using (
    (status = 'approved' and public.can_see_photo_target(forum_post_id, club_post_id, club_id))
    or uploaded_by = auth.uid()
    or public.is_admin()
  );

create policy "photos: add to own posts / led clubs" on public.photos
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and status = 'pending'
    and split_part(path, '/', 1) = auth.uid()::text
    and public.can_add_photo_to(forum_post_id, club_post_id, club_id)
  );

create policy "photos: uploader, club leader or admin delete" on public.photos
  for delete to authenticated using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or (club_id is not null and public.is_club_leader(club_id))
  );

revoke all on public.photos from anon, authenticated;
grant select on public.photos to anon, authenticated;
-- Uploaders can't set status / review fields (admins use review_photo()).
grant insert (path, forum_post_id, club_post_id, club_id, caption) on public.photos to authenticated;
grant delete on public.photos to authenticated;
grant select, insert, update, delete on public.photos to service_role;

-- Admins: approve or reject.
create function public.review_photo(p_id uuid, p_approve boolean, p_reason text default '')
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  update public.photos
  set status = case when p_approve then 'approved' else 'rejected' end,
      reject_reason = case when p_approve then '' else left(coalesce(p_reason, ''), 300) end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_id;
end;
$$;

-- ---------- Storage rules ----------------------------------------------
-- Files follow the photos table: you can download a file only if you are
-- allowed to see its photos row.

create function public.can_view_photo_file(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.photos p
    where p.path = p_path
      and ((p.status = 'approved' and public.can_see_photo_target(p.forum_post_id, p.club_post_id, p.club_id))
           or p.uploaded_by = auth.uid()
           or public.is_admin())
  )
$$;

create policy "photos bucket: upload into own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos bucket: view if allowed" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos' and public.can_view_photo_file(name));

create policy "photos bucket: delete own or admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------- Function permissions ---------------------------------------

revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
-- Signed-out readers of Explore Korea also see its approved photos.
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
