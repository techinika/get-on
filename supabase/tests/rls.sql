-- Run with: supabase db test supabase/tests/rls.sql

begin;

select plan(2);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000111', 'owner-one@example.com'),
  ('00000000-0000-0000-0000-000000000222', 'owner-two@example.com');

insert into public.teams (id, name, owner_id, plan_id, is_personal)
values
  ('10000000-0000-0000-0000-000000000001', 'One Team', '00000000-0000-0000-0000-000000000111', 'free', true),
  ('20000000-0000-0000-0000-000000000001', 'Two Team', '00000000-0000-0000-0000-000000000222', 'free', true);

insert into public.team_members (team_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000111', 'owner'),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000222', 'owner');

insert into public.projects (team_id, name, subdomain, status)
values
  ('10000000-0000-0000-0000-000000000001', 'One Site', 'one-site-local', 'draft'),
  ('20000000-0000-0000-0000-000000000001', 'Two Site', 'two-site-local', 'draft');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000111';

select is(
  (select count(*) from public.projects),
  1::bigint,
  'user one sees only own team projects'
);

set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000222';

select is(
  (select count(*) from public.projects),
  1::bigint,
  'user two sees only own team projects'
);

select * from finish();
rollback;
