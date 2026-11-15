-- =====================================================================
-- 0010: check-in rules
--
-- Changes check_in_by_code() from 0008 and check_in() from 0001.
-- Run once, in Supabase → SQL Editor, after 0009.
-- Run it BEFORE the matching website update goes live.
--
-- 1. Only the event's creator (or an admin) can check people in.
--    Before, any organizer could check anyone in for any event. Now the
--    database refuses with NOT_EVENT_ORGANIZER. Events whose creator has
--    since deleted their account (created_by is empty) can only be checked
--    in by an admin.
--
-- 2. QR check-in asks first when something looks wrong.
--    Before: scanning a QR checked the person in straight away, and the page
--    only warned afterwards ("this is for another day", "they said Can't
--    go"). The organizer then had to press Undo.
--    Now the database looks first. If the QR is for an event that is not
--    today, or the person's RSVP is not "Going", nothing is saved. The
--    function returns what is wrong in `problems`, and the organizer
--    confirms by scanning again with p_force = true ("Check in anyway").
--
--      problems = {}                      all fine → checked in
--      problems = {NOT_TODAY}             event is on another day
--      problems = {NOT_GOING}             RSVP is Maybe or Can't go
--      problems = {NOT_TODAY,NOT_GOING}   both
--
--    Scanning someone who is already checked in is still harmless: it
--    reports the first check-in time and changes nothing.
--
-- The manual "Check in" button (check_in) has the creator rule only. A
-- person ticking someone off the attendee list has seen the list and chosen,
-- so no "are you sure" step is needed there.
-- =====================================================================

-- May the signed-in person check people in for this event?
create function public.can_check_in(p_event_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or (public.is_organizer()
          and exists (select 1 from public.events e
                      where e.id = p_event_id and e.created_by = auth.uid()))
$$;

-- Manual check-in / undo from the attendee list (replaces the 0001 version).
create or replace function public.check_in(p_event_id uuid, p_user_id uuid, p_checked_in boolean default true)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;
  if not public.can_check_in(p_event_id) then
    raise exception 'NOT_EVENT_ORGANIZER';
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

drop function public.check_in_by_code(uuid);

create function public.check_in_by_code(p_code uuid, p_force boolean default false)
returns table (
  event_id uuid, event_title text, event_date date,
  user_id uuid, full_name text, student_id text, batch smallint,
  status public.rsvp_status, checked_in_at timestamptz, already_checked_in boolean,
  checked_in boolean, problems text[]
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_event_date date;
  v_already boolean;
  v_problems text[] := '{}';
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_rsvp from public.rsvps r where r.checkin_code = p_code;
  if not found then
    raise exception 'BAD_CHECKIN_CODE';
  end if;

  if not public.can_check_in(v_rsvp.event_id) then
    raise exception 'NOT_EVENT_ORGANIZER';
  end if;

  select e.event_date into v_event_date from public.events e where e.id = v_rsvp.event_id;

  v_already := v_rsvp.checked_in_at is not null;

  if not v_already then
    if v_event_date <> public.today_kst() then
      v_problems := array_append(v_problems, 'NOT_TODAY');
    end if;
    if v_rsvp.status <> 'attending' then
      v_problems := array_append(v_problems, 'NOT_GOING');
    end if;

    -- Only save when nothing is wrong, or the organizer confirmed.
    if cardinality(v_problems) = 0 or p_force then
      update public.rsvps r
         set checked_in_at = now()
       where r.event_id = v_rsvp.event_id and r.user_id = v_rsvp.user_id
      returning * into v_rsvp;
    end if;
  end if;

  return query
    select e.id, e.title, e.event_date,
           p.id, p.full_name, p.student_id, p.batch,
           v_rsvp.status, v_rsvp.checked_in_at, v_already,
           v_rsvp.checked_in_at is not null,
           case when v_rsvp.checked_in_at is not null then '{}'::text[] else v_problems end
    from public.events e
    join public.profiles p on p.id = v_rsvp.user_id
    where e.id = v_rsvp.event_id;
end;
$$;

revoke execute on function public.can_check_in(uuid) from public, anon;
grant  execute on function public.can_check_in(uuid) to authenticated;
revoke execute on function public.check_in_by_code(uuid, boolean) from public, anon;
grant  execute on function public.check_in_by_code(uuid, boolean) to authenticated;
