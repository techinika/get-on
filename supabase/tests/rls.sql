-- Run with: supabase db test supabase/tests/rls.sql

begin;

select plan(7);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000111', 'owner-one@example.com'),
  ('00000000-0000-0000-0000-000000000222', 'owner-two@example.com');

-- The sign-up trigger already gives every user a personal team and a
-- membership row, so the test only has to add the projects.

insert into public.projects (team_id, name, subdomain, status)
select tm.team_id, 'One Site', 'one-site-local', 'draft'
from public.team_members tm
where tm.user_id = '00000000-0000-0000-0000-000000000111';

insert into public.projects (team_id, name, subdomain, status)
select tm.team_id, 'Two Site', 'two-site-local', 'draft'
from public.team_members tm
where tm.user_id = '00000000-0000-0000-0000-000000000222';

insert into public.publishes (project_id, status, content_revision, pages_count, size_bytes)
select p.id, 'live', 1, 1, 2048
from public.projects p
where p.subdomain = 'one-site-local';

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000111';

select is(
  (select count(*) from public.projects),
  1::bigint,
  'user one sees only own team projects'
);

select is(
  (select count(*) from public.team_members),
  1::bigint,
  'user one sees only own team memberships'
);

select is(
  (select count(*) from public.publishes),
  1::bigint,
  'the owner sees the publish history'
);

select is(
  (
    select count(*) from public.site_flags
  ) + (
    select count(*) from public.abuse_reports
  ) + (
    select count(*) from public.admin_audit_log
  ),
  0::bigint,
  'moderation data is hidden from owners'
);

select throws_ok(
  $$ update public.projects set review_state = 'pending' where subdomain = 'one-site-local' $$,
  'P0001',
  'not_authorized',
  'an owner cannot change the review state'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000222';

select is(
  (select count(*) from public.projects),
  1::bigint,
  'user two sees only own team projects'
);

select is(
  (select count(*) from public.publishes),
  0::bigint,
  'a non-member cannot see another team publish history'
);

select * from finish();
rollback;
