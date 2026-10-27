-- =====================================================================
-- 0003: AI features
--   * events.announcements: AI-written announcements (EN / MS / KO),
--     saved so organizers can come back and copy them.
--   * ai_usage + ai_begin(): a per-person daily limit on AI calls, so
--     nobody can use up the free Gemini quota. Only WHO / WHEN / WHAT KIND
--     is logged, never the text that was sent to the AI.
--
-- Run once, after 0001 and 0002.
-- =====================================================================

alter table public.events add column if not exists announcements jsonb;

create table if not exists public.ai_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('extract', 'announce', 'ask')),
  created_at  timestamptz not null default now()
);

create index if not exists ai_usage_user_day_idx on public.ai_usage (user_id, kind, created_at);

-- Nobody reads or writes this table directly; only through the functions below.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Called by the server before every AI request. Checks the caller is
-- allowed to use this AI feature, enforces the daily limit (Korea time),
-- records the call, and returns how many calls are left today.
create or replace function public.ai_begin(p_kind text)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_limit integer;
  v_used  integer;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  if p_kind in ('extract', 'announce') then
    if not public.is_organizer() then
      raise exception 'NOT_ALLOWED';
    end if;
    v_limit := 40;
  elsif p_kind = 'ask' then
    if not public.my_profile_is_complete() then
      raise exception 'NOT_ALLOWED';
    end if;
    v_limit := 30;
  else
    raise exception 'BAD_KIND';
  end if;

  select count(*) into v_used
  from public.ai_usage
  where user_id = auth.uid()
    and kind = p_kind
    and (created_at at time zone 'Asia/Seoul')::date = public.today_kst();

  if v_used >= v_limit then
    raise exception 'AI_DAILY_LIMIT';
  end if;

  insert into public.ai_usage (user_id, kind) values (auth.uid(), p_kind);

  return v_limit - v_used - 1;
end;
$$;

-- AI usage totals for the admin page and the course report (admins only).
create or replace function public.ai_usage_stats()
returns table (kind text, total bigint, last_7_days bigint, people bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
    select u.kind,
           count(*),
           count(*) filter (where u.created_at > now() - interval '7 days'),
           count(distinct u.user_id)
    from public.ai_usage u
    group by u.kind
    order by u.kind;
end;
$$;

revoke execute on function public.ai_begin(text)   from public, anon;
revoke execute on function public.ai_usage_stats() from public, anon;
grant  execute on function public.ai_begin(text)   to authenticated;
grant  execute on function public.ai_usage_stats() to authenticated;
