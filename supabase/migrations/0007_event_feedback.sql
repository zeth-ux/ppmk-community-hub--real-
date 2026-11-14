-- =====================================================================
-- 0007: post-event feedback ("How was it?")
--
-- Adds only. Run once, in Supabase → SQL Editor, after 0001–0006.
--
--   • event_feedback        one rating (1–5) + optional comment per person
--                           per event
--   • set_my_feedback       students give / change their own feedback
--   • event_feedback_summary  organizers: count, average, 1–5 breakdown
--   • event_feedback_comments organizers: the comments, WITHOUT names
--   • feedback_overview     admins: totals for the course report
--
-- Who may give feedback: a member who said "I'm going" or was checked in,
-- from the day of the event until 14 days after it.
--
-- Anonymous to organizers: they can never read the table directly, only
-- through the two functions above, which leave out who wrote what.
-- =====================================================================

create table public.event_feedback (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_feedback_user_idx on public.event_feedback (user_id);

create trigger event_feedback_touch before update on public.event_feedback
  for each row execute function public.touch_updated_at();

alter table public.event_feedback enable row level security;

-- Everyone reads only their own answer. Organizers use the functions below.
create policy "event_feedback: read own" on public.event_feedback
  for select to authenticated using (user_id = auth.uid());

create policy "members only" on public.event_feedback
  as restrictive for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- No direct writes at all: everything goes through set_my_feedback().
revoke all on public.event_feedback from anon, authenticated;
grant select on public.event_feedback to authenticated;
grant select, insert, update, delete on public.event_feedback to service_role;

-- Can the signed-in person rate this event right now?
create function public.can_give_feedback(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_member() and exists (
    select 1
    from public.events e
    join public.rsvps r on r.event_id = e.id and r.user_id = auth.uid()
    where e.id = p_event_id
      and (r.status = 'attending' or r.checked_in_at is not null)
      and public.today_kst() between e.event_date and e.event_date + 14
  )
$$;

-- Give or change your own feedback.
create function public.set_my_feedback(p_event_id uuid, p_rating smallint, p_comment text default '')
returns public.event_feedback
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.event_feedback;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;
  if not public.can_give_feedback(p_event_id) then
    raise exception 'FEEDBACK_CLOSED';
  end if;

  insert into public.event_feedback (event_id, user_id, rating, comment)
  values (p_event_id, auth.uid(), p_rating, left(coalesce(trim(p_comment), ''), 1000))
  on conflict (event_id, user_id)
  do update set rating = excluded.rating, comment = excluded.comment
  returning * into v_row;

  return v_row;
end;
$$;

-- Numbers for one event (organizers only).
create function public.event_feedback_summary(p_event_id uuid)
returns table (responses bigint, average numeric, stars_1 bigint, stars_2 bigint,
               stars_3 bigint, stars_4 bigint, stars_5 bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select count(*),
           round(avg(f.rating), 1),
           count(*) filter (where f.rating = 1),
           count(*) filter (where f.rating = 2),
           count(*) filter (where f.rating = 3),
           count(*) filter (where f.rating = 4),
           count(*) filter (where f.rating = 5)
    from public.event_feedback f
    where f.event_id = p_event_id;
end;
$$;

-- The written comments for one event (organizers only). No names, no IDs,
-- and only the date (not the time) so nobody can be matched by timing.
create function public.event_feedback_comments(p_event_id uuid)
returns table (rating smallint, comment text, given_on date)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select f.rating, f.comment, (f.created_at at time zone 'Asia/Seoul')::date
    from public.event_feedback f
    where f.event_id = p_event_id and f.comment <> ''
    order by f.created_at desc;
end;
$$;

-- Totals across the hub (admins only), for the admin page and the report.
create function public.feedback_overview()
returns table (responses bigint, average numeric, events_rated bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select count(*), round(avg(f.rating), 2), count(distinct f.event_id)
    from public.event_feedback f;
end;
$$;

-- Signed-in users only (each function checks the caller itself).
revoke execute on function public.can_give_feedback(uuid)                  from public, anon;
revoke execute on function public.set_my_feedback(uuid, smallint, text)    from public, anon;
revoke execute on function public.event_feedback_summary(uuid)             from public, anon;
revoke execute on function public.event_feedback_comments(uuid)            from public, anon;
revoke execute on function public.feedback_overview()                      from public, anon;
grant  execute on function public.can_give_feedback(uuid)                  to authenticated;
grant  execute on function public.set_my_feedback(uuid, smallint, text)    to authenticated;
grant  execute on function public.event_feedback_summary(uuid)             to authenticated;
grant  execute on function public.event_feedback_comments(uuid)            to authenticated;
grant  execute on function public.feedback_overview()                      to authenticated;
