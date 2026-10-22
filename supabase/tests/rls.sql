-- Run with: supabase db test supabase/tests/rls.sql

begin;

select plan(3);

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

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000222';

select is(
  (select count(*) from public.projects),
  1::bigint,
  'user two sees only own team projects'
);

select * from finish();
rollback;
