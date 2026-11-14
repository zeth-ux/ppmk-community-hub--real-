-- =====================================================================
-- 0008: QR check-in at the door
--
-- Adds only. Run once, in Supabase → SQL Editor, after 0007.
--
-- Every RSVP gets a random, unguessable check-in code. The student's event
-- page shows it as a QR code (a link to /checkin/<code>). An organizer
-- scans it with their normal phone camera, the link opens the hub, and
-- check_in_by_code() marks the student as arrived.
--
-- Safety:
--   • Only organizers/admins can use a code (checked inside the function).
--   • Codes are random UUIDs: knowing someone's name or student ID does not
--     let you make their QR.
--   • Students can read their own code (they can already read their own
--     RSVP) but cannot change it (no column grant).
-- =====================================================================

alter table public.rsvps
  add column if not exists checkin_code uuid not null default gen_random_uuid();

create unique index if not exists rsvps_checkin_code_key on public.rsvps (checkin_code);

-- Scan → check in. Returns who it was, so the organizer sees a name and
-- photo-ID details on screen. Scanning twice is harmless: it says when the
-- person was first checked in instead of changing it.
create function public.check_in_by_code(p_code uuid)
returns table (
  event_id uuid, event_title text, event_date date,
  user_id uuid, full_name text, student_id text, batch smallint,
  status public.rsvp_status, checked_in_at timestamptz, already_checked_in boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_rsvp public.rsvps;
  v_already boolean;
begin
  if not public.is_organizer() then
    raise exception 'NOT_ALLOWED';
  end if;

  select * into v_rsvp from public.rsvps r where r.checkin_code = p_code;
  if not found then
    raise exception 'BAD_CHECKIN_CODE';
  end if;

  v_already := v_rsvp.checked_in_at is not null;
  if not v_already then
    update public.rsvps r
       set checked_in_at = now()
     where r.event_id = v_rsvp.event_id and r.user_id = v_rsvp.user_id
    returning * into v_rsvp;
  end if;

  return query
    select e.id, e.title, e.event_date,
           p.id, p.full_name, p.student_id, p.batch,
           v_rsvp.status, v_rsvp.checked_in_at, v_already
    from public.events e
    join public.profiles p on p.id = v_rsvp.user_id
    where e.id = v_rsvp.event_id;
end;
$$;

revoke execute on function public.check_in_by_code(uuid) from public, anon;
grant  execute on function public.check_in_by_code(uuid) to authenticated;
