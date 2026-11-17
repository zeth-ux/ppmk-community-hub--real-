-- =====================================================================
-- 0012: only real web links in link fields
--
-- Run once, in Supabase → SQL Editor, after 0011. Safe to run before or
-- after the matching website update (the website already sends https://
-- links; this makes the database refuse anything else).
--
-- Forum, opportunity and calendar links already had this rule (0004, 0006).
-- Two link fields did not:
--   • clubs.join_url                    (the "Join" button on a club page)
--   • club_applications.documents       (links the admin opens when
--                                         reviewing a club application)
-- A link like `javascript:…` or `data:…` typed there could trick the
-- person who clicks it. React already blocks `javascript:` links, so this
-- is a second lock on the door, kept in the database where it can't be
-- skipped by calling the API directly.
--
-- NOT VALID: rows that already exist are not checked (so this can never
-- fail on the live database); every new or edited row is.
-- =====================================================================

-- True when every value in a { "name": "link" } object is an empty string
-- or an http(s) link of at most 500 characters.
create or replace function public.jsonb_links_ok(p_links jsonb)
returns boolean
language sql immutable set search_path = ''
as $$
  select jsonb_typeof(p_links) = 'object'
     and not exists (
       select 1 from jsonb_each(p_links) as d(key, value)
       where jsonb_typeof(d.value) <> 'string'
          or not (d.value #>> '{}' = ''
                  or (char_length(d.value #>> '{}') <= 500 and d.value #>> '{}' ~* '^https?://'))
     )
$$;

alter table public.clubs
  add constraint clubs_join_url_is_link
  check (join_url is null or join_url = '' or (char_length(join_url) <= 500 and join_url ~* '^https?://'))
  not valid;

alter table public.club_applications
  add constraint club_applications_documents_are_links
  check (public.jsonb_links_ok(documents))
  not valid;
