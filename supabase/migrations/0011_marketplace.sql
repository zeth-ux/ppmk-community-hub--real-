-- =====================================================================
-- 0011: Market (preloved items) and Pass the Book (textbooks for juniors)
--
-- Adds only. Run once, in Supabase → SQL Editor, after 0010.
--
-- Members list things they no longer need: sell them (price in won) or
-- give them away for free. "Pass the Book" is the textbook category:
-- seniors pass their books to juniors in the same course.
--
--   • market_listings    one row per item (photos use the existing
--                        admin-approved photos table, see below)
--   • market_interests   "I'm interested": the buyer's request. Making one
--                        reveals the seller's contact to that buyer, and
--                        the seller sees who asked.
--   • market_reports     members flag a listing; admins see the reports
--
-- No money goes through the hub. Buyer and seller agree and pay each
-- other directly (bank transfer or cash when they meet).
--
-- Privacy:
--   • Members only (no visitors, nothing signed-out).
--   • The seller's contact (KakaoTalk ID / WhatsApp link / …) is never in
--     the public list. Only the seller, admins, and people who pressed
--     "I'm interested" get it (list_market_listings blanks it otherwise).
--   • The seller sees the username, name, batch and course of the people
--     who asked (they asked to be contacted). Never phone, email or ID.
--   • Listings disappear from the list 60 days after they were posted or
--     last renewed, so old items don't pile up.
-- =====================================================================

-- ---------- Listings ---------------------------------------------------

create table public.market_listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind          text not null default 'sell' check (kind in ('sell', 'free')),
  category      text not null default 'other' check (category in (
                  'textbook', 'electronics', 'kitchen', 'furniture', 'clothing', 'other')),
  title         text not null check (char_length(title) between 3 and 120),
  description   text not null default '' check (char_length(description) <= 2000),
  price_krw     integer,
  condition     text not null default 'good' check (condition in ('new', 'like_new', 'good', 'fair')),
  area          text not null default '' check (char_length(area) <= 80),
  -- How to reach the seller. Hidden until someone presses "I'm interested".
  contact       text not null check (char_length(contact) between 3 and 200),
  -- Pass the Book (textbooks only)
  course        text check (course is null or char_length(course) <= 100),
  subject_code  text check (subject_code is null or char_length(subject_code) <= 30),
  for_year      smallint check (for_year is null or for_year between 1 and 6),
  -- 'done' = sold or given away
  status        text not null default 'available' check (status in ('available', 'reserved', 'done')),
  bumped_at     timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint market_listings_price check (
    (kind = 'free' and price_krw is null)
    or (kind = 'sell' and price_krw is not null and price_krw between 0 and 10000000)),
  constraint market_listings_book_fields check (
    category = 'textbook' or (course is null and subject_code is null and for_year is null))
);

create index market_listings_bumped_idx on public.market_listings (bumped_at desc);
create index market_listings_seller_idx on public.market_listings (seller_id);

create trigger market_listings_touch before update on public.market_listings
  for each row execute function public.touch_updated_at();

-- Limits: 10 new listings a day, 30 open (not done) listings at a time.
create function public.market_listings_limits()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.market_listings
      where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'MARKET_DAILY_LIMIT';
  end if;
  if (select count(*) from public.market_listings
      where seller_id = new.seller_id and status <> 'done') >= 30 then
    raise exception 'MARKET_OPEN_LIMIT';
  end if;
  return new;
end;
$$;

create trigger market_listings_limits before insert on public.market_listings
  for each row execute function public.market_listings_limits();

alter table public.market_listings enable row level security;

-- The table itself: only your own listings (admins: all, to moderate).
-- Everyone else reads through list_market_listings(), which hides contacts.
create policy "market: own or admin read" on public.market_listings
  for select to authenticated using (seller_id = auth.uid() or public.is_admin());

create policy "market: members list items" on public.market_listings
  for insert to authenticated with check (seller_id = auth.uid() and public.is_member());

create policy "market: seller edits" on public.market_listings
  for update to authenticated
  using (seller_id = auth.uid()) with check (seller_id = auth.uid() and public.is_member());

create policy "market: seller or admin delete" on public.market_listings
  for delete to authenticated using (seller_id = auth.uid() or public.is_admin());

revoke all on public.market_listings from anon, authenticated;
grant select, delete on public.market_listings to authenticated;
grant insert (kind, category, title, description, price_krw, condition, area, contact, course, subject_code, for_year)
  on public.market_listings to authenticated;
-- No bumped_at here: renewing goes through renew_market_listing().
grant update (kind, category, title, description, price_krw, condition, area, contact, course, subject_code, for_year, status)
  on public.market_listings to authenticated;

-- ---------- "I'm interested" -------------------------------------------

create table public.market_interests (
  listing_id  uuid not null references public.market_listings (id) on delete cascade,
  buyer_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message     text not null default '' check (char_length(message) <= 300),
  created_at  timestamptz not null default now(),
  primary key (listing_id, buyer_id)
);

create index market_interests_buyer_idx on public.market_interests (buyer_id, created_at);

alter table public.market_interests enable row level security;

-- Buyers see and withdraw their own requests. Requests are made only
-- through ask_market_contact() (checks and daily limit in one place).
create policy "market interests: own read" on public.market_interests
  for select to authenticated using (buyer_id = auth.uid());

create policy "market interests: own withdraw" on public.market_interests
  for delete to authenticated using (buyer_id = auth.uid());

revoke all on public.market_interests from anon, authenticated;
grant select, delete on public.market_interests to authenticated;

-- ---------- Reports ----------------------------------------------------

create table public.market_reports (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.market_listings (id) on delete cascade,
  reporter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason       text not null check (char_length(reason) between 3 and 300),
  created_at   timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

alter table public.market_reports enable row level security;

-- ---------- Who can see a listing --------------------------------------

-- Members see open listings from the last 60 days. Sellers always see
-- their own; people who asked keep seeing the item; admins see all.
create function public.market_listing_visible(p_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member() and exists (
    select 1 from public.market_listings l
    where l.id = p_id
      and (l.seller_id = auth.uid()
           or public.is_admin()
           or exists (select 1 from public.market_interests i
                      where i.listing_id = l.id and i.buyer_id = auth.uid())
           or (l.status <> 'done' and l.bumped_at > now() - interval '60 days'))
  )
$$;

create policy "market reports: members report what they can see" on public.market_reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and public.market_listing_visible(listing_id));

create policy "market reports: admins and reporter read" on public.market_reports
  for select to authenticated using (public.is_admin() or reporter_id = auth.uid());

create policy "market reports: admins dismiss" on public.market_reports
  for delete to authenticated using (public.is_admin());

revoke all on public.market_reports from anon, authenticated;
grant select, delete on public.market_reports to authenticated;
grant insert (listing_id, reason) on public.market_reports to authenticated;

-- ---------- What the app calls -----------------------------------------

-- The market list. `contact` is filled in only for the seller, admins and
-- people who already asked; `interest_count` only for the seller/admins.
create function public.list_market_listings()
returns table (
  id uuid, kind text, category text, title text, description text, price_krw integer,
  condition text, area text, course text, subject_code text, for_year smallint,
  status text, bumped_at timestamptz, created_at timestamptz,
  seller_username text, is_mine boolean, i_asked boolean, contact text,
  interest_count bigint, expired boolean
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'MEMBERS_ONLY';
  end if;

  return query
    select l.id, l.kind, l.category, l.title, l.description, l.price_krw,
           l.condition, l.area, l.course, l.subject_code, l.for_year,
           l.status, l.bumped_at, l.created_at,
           p.username,
           l.seller_id = auth.uid(),
           a.asked,
           case when l.seller_id = auth.uid() or a.asked or public.is_admin() then l.contact end,
           case when l.seller_id = auth.uid() or public.is_admin()
                then (select count(*) from public.market_interests i where i.listing_id = l.id) end,
           l.bumped_at <= now() - interval '60 days'
    from public.market_listings l
    join public.profiles p on p.id = l.seller_id
    cross join lateral (
      select exists (select 1 from public.market_interests i
                     where i.listing_id = l.id and i.buyer_id = auth.uid()) as asked
    ) a
    where public.market_listing_visible(l.id)
    order by (l.status = 'done'), l.bumped_at desc;
end;
$$;

-- "I'm interested": records the request and returns the seller's contact.
-- Asking again just returns the contact (and updates the message).
create function public.ask_market_contact(p_listing uuid, p_message text default '')
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v public.market_listings;
  v_message text := left(btrim(coalesce(p_message, '')), 300);
begin
  if not public.is_member() then
    raise exception 'MEMBERS_ONLY';
  end if;

  select * into v from public.market_listings where id = p_listing;
  if not found or not public.market_listing_visible(p_listing) then
    raise exception 'LISTING_NOT_FOUND';
  end if;

  if v.seller_id = auth.uid() then
    return v.contact;
  end if;

  if exists (select 1 from public.market_interests
             where listing_id = p_listing and buyer_id = auth.uid()) then
    if v_message <> '' then
      update public.market_interests set message = v_message
      where listing_id = p_listing and buyer_id = auth.uid();
    end if;
    return v.contact;
  end if;

  if v.status = 'done' then
    raise exception 'LISTING_CLOSED';
  end if;

  if (select count(*) from public.market_interests
      where buyer_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'MARKET_DAILY_LIMIT';
  end if;

  insert into public.market_interests (listing_id, buyer_id, message)
  values (p_listing, auth.uid(), v_message);

  return v.contact;
end;
$$;

-- Seller (or admin): who pressed "I'm interested".
create function public.market_listing_interests(p_listing uuid)
returns table (username text, full_name text, batch smallint, course text, message text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (public.is_admin() or exists (
    select 1 from public.market_listings where id = p_listing and seller_id = auth.uid())) then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select p.username, p.full_name, p.batch, p.course, i.message, i.created_at
    from public.market_interests i
    join public.profiles p on p.id = i.buyer_id
    where i.listing_id = p_listing
    order by i.created_at;
end;
$$;

-- Seller: "still available", moves the listing back to the top for 60 days.
create function public.renew_market_listing(p_listing uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.market_listings
     set bumped_at = now()
   where id = p_listing and seller_id = auth.uid() and status <> 'done';
  if not found then
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

-- ---------- Photos on listings -----------------------------------------
-- Same table, bucket and admin approval as the other photos (0005).

alter table public.photos
  add column if not exists listing_id uuid references public.market_listings (id) on delete cascade;

create index if not exists photos_listing_idx on public.photos (listing_id) where listing_id is not null;

alter table public.photos drop constraint photos_one_target;
alter table public.photos add constraint photos_one_target
  check (num_nonnulls(forum_post_id, club_post_id, club_id, listing_id) = 1);

grant insert (listing_id) on public.photos to authenticated;

drop policy "photos: approved and visible, own, or admin" on public.photos;
create policy "photos: approved and visible, own, or admin" on public.photos
  for select to anon, authenticated using (
    (status = 'approved' and (
       (listing_id is null and public.can_see_photo_target(forum_post_id, club_post_id, club_id))
       or (listing_id is not null and public.market_listing_visible(listing_id))))
    or uploaded_by = auth.uid()
    or public.is_admin()
  );

drop policy "photos: add to own posts / led clubs" on public.photos;
create policy "photos: add to own posts, led clubs, own listings" on public.photos
  for insert to authenticated with check (
    uploaded_by = auth.uid()
    and status = 'pending'
    and split_part(path, '/', 1) = auth.uid()::text
    and ((photos.listing_id is null and public.can_add_photo_to(forum_post_id, club_post_id, club_id))
         or (photos.listing_id is not null and exists (
               select 1 from public.market_listings l
               where l.id = photos.listing_id and l.seller_id = auth.uid())))
  );

-- 6 photos per listing, like posts (counted per listing, not across them).
create or replace function public.photos_limits()
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
        and listing_id is not distinct from new.listing_id
        and club_id is null
        and status <> 'rejected') >= 6 then
    raise exception 'PHOTO_POST_LIMIT';
  end if;
  return new;
end;
$$;

-- Files follow the photos table (now including listing photos).
create or replace function public.can_view_photo_file(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.photos p
    where p.path = p_path
      and ((p.status = 'approved'
            and ((p.listing_id is null and public.can_see_photo_target(p.forum_post_id, p.club_post_id, p.club_id))
                 or (p.listing_id is not null and public.market_listing_visible(p.listing_id))))
           or p.uploaded_by = auth.uid()
           or public.is_admin())
  )
$$;

-- ---------- Function permissions ---------------------------------------

revoke execute on function public.market_listings_limits()                from public, anon;
revoke execute on function public.market_listing_visible(uuid)            from public;
revoke execute on function public.list_market_listings()                  from public, anon;
revoke execute on function public.ask_market_contact(uuid, text)          from public, anon;
revoke execute on function public.market_listing_interests(uuid)          from public, anon;
revoke execute on function public.renew_market_listing(uuid)              from public, anon;

grant execute on function public.market_listing_visible(uuid)             to anon, authenticated;
grant execute on function public.list_market_listings()                   to authenticated;
grant execute on function public.ask_market_contact(uuid, text)           to authenticated;
grant execute on function public.market_listing_interests(uuid)           to authenticated;
grant execute on function public.renew_market_listing(uuid)               to authenticated;

grant select, insert, update, delete on public.market_listings, public.market_interests, public.market_reports
  to service_role;
