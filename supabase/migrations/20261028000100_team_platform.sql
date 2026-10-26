-- Team platform: permissions/quotas/activity/invitations/referrals

alter table plans add column if not exists max_deleted_pending int not null default 2;
alter table plans add column if not exists activity_retention_days int not null default 730;

update plans set max_deleted_pending = 2 where code = 'free';
update plans set max_deleted_pending = 3 where code = 'basic';
update plans set max_deleted_pending = 5 where code = 'pro';
update plans set max_deleted_pending = 10 where code = 'enterprise';

update plans set activity_retention_days = 730 where activity_retention_days is null or activity_retention_days = 0;

alter table teams add column if not exists plan_source text not null default 'default';
do $$ begin
  alter table teams add constraint teams_plan_source_check check (plan_source in ('default','manual','billing'));
exception when duplicate_object then null;
end $$;
alter table teams add column if not exists owner_changed_at timestamptz;

alter table team_members add column if not exists status text not null default 'active';
do $$ begin
  alter table team_members add constraint team_members_status_check check (status in ('active','paused'));
exception when duplicate_object then null;
end $$;
alter table team_members add column if not exists invited_by uuid;
alter table team_members add column if not exists joined_at timestamptz not null default now();
alter table team_members add column if not exists paused_at timestamptz;
alter table team_members add column if not exists paused_reason text;

create unique index if not exists team_members_one_owner_idx on team_members (team_id) where role = 'owner' and status = 'active';

create table if not exists team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null unique,
  status text not null default 'pending',
  invited_by uuid,
  message text,
  expires_at timestamptz not null,
  send_count int not null default 1,
  last_sent_at timestamptz not null default now(),
  reminded_at timestamptz,
  email_state text not null default 'queued',
  accepted_by uuid,
  accepted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint team_invitations_role_check check (role in ('admin','editor','viewer')),
  constraint team_invitations_status_check check (status in ('pending','accepted','declined','revoked','expired')),
  constraint team_invitations_email_state_check check (email_state in ('queued','sent','suppressed','failed'))
);
create unique index if not exists team_invitations_pending_email_idx on team_invitations (team_id, lower(email)) where status = 'pending';

alter table projects add column if not exists created_by uuid;
alter table projects add column if not exists created_via text;
do $$ begin
  alter table projects add constraint projects_created_via_check check (created_via in ('wizard','template','ai','import','transfer_in','duplicate','support'));
exception when duplicate_object then null;
end $$;
alter table projects add column if not exists last_edited_by uuid;
alter table projects add column if not exists last_edited_at timestamptz;
alter table projects add column if not exists deleted_by uuid;
alter table projects add column if not exists restored_at timestamptz;

alter table pages add column if not exists updated_by uuid;

alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid;
alter table profiles add column if not exists referred_at timestamptz;

create table if not exists team_activity (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  count int not null default 1,
  actor_user_id uuid,
  actor_name text not null,
  actor_role text,
  actor_kind text not null,
  category text not null,
  event text not null,
  summary text not null,
  project_id uuid,
  project_name text,
  target_type text,
  target_id uuid,
  target_name text,
  coalesce_key text,
  meta jsonb not null default '{}'::jsonb,
  client text,
  visibility text not null default 'team',
  constraint team_activity_actor_kind_check check (actor_kind in ('user','system','support')),
  constraint team_activity_category_check check (category in ('website','page','design','pictures','settings','domain','plugin','template','backup','ai','member','invitation','team','referral','security'))
);
create index if not exists team_activity_team_occurred_idx on team_activity (team_id, occurred_at desc);
create index if not exists team_activity_team_category_idx on team_activity (team_id, category, occurred_at desc);
create index if not exists team_activity_team_project_idx on team_activity (team_id, project_id, occurred_at desc);
create index if not exists team_activity_team_actor_idx on team_activity (team_id, actor_user_id, occurred_at desc);
create unique index if not exists team_activity_coalesce_idx on team_activity (team_id, coalesce_key) where coalesce_key is not null;

alter table team_activity enable row level security;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null,
  referee_user_id uuid not null unique,
  source text not null,
  status text not null default 'signed_up',
  reason text,
  ip_hash text,
  ua_hash text,
  email_base_hash text,
  signed_up_at timestamptz not null default now(),
  verified_at timestamptz,
  published_at timestamptz,
  qualified_at timestamptz,
  held_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  constraint referrals_source_check check (source in ('link','code','badge')),
  constraint referrals_status_check check (status in ('signed_up','verified','published','qualified','held','rejected','revoked'))
);

create table if not exists referral_ladder (
  id uuid primary key default gen_random_uuid(),
  milestone int not null,
  reward_type text not null,
  amount numeric not null default 0,
  label text not null,
  active boolean not null default true,
  sort int not null default 0,
  constraint referral_ladder_reward_check check (reward_type in ('ai_credits','email_credits','free_month','ai_bonus_percent'))
);

create table if not exists referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  team_id uuid,
  ladder_id uuid references referral_ladder(id),
  milestone int not null,
  reward_type text not null,
  amount numeric not null default 0,
  status text not null default 'applied',
  applied_at timestamptz,
  ledger_ref text,
  note text,
  created_at timestamptz not null default now(),
  constraint referral_rewards_status_check check (status in ('applied','saved','revoked')),
  constraint referral_rewards_type_check check (reward_type in ('ai_credits','email_credits','free_month','ai_bonus_percent'))
);

create table if not exists referral_settings (
  id int primary key default 1,
  qualify_hours int not null default 24,
  monthly_cap int not null default 50,
  referred_bonus_credits int not null default 10,
  velocity_hold_per_day int not null default 5,
  enabled boolean not null default true,
  constraint referral_settings_singleton check (id = 1)
);
insert into referral_settings (id) values (1) on conflict do nothing;

create table if not exists disposable_email_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  created_at timestamptz not null default now()
);

insert into referral_ladder (milestone, reward_type, amount, label, active, sort)
values
  (1, 'ai_credits', 25, 'Invite 1 friend: 25 AI credits', true, 1),
  (3, 'email_credits', 1000, 'Invite 3 friends: 1,000 extra emails', true, 2),
  (5, 'free_month', 1, 'Invite 5 friends: 1 free month', true, 3),
  (10, 'free_month', 3, 'Invite 10 friends: 3 free months', true, 4),
  (10, 'ai_bonus_percent', 10, 'Invite 10 friends: +10 percent AI monthly credits', true, 5)
on conflict do nothing;

alter table referrals enable row level security;
alter table referral_rewards enable row level security;
alter table referral_ladder enable row level security;
alter table referral_settings enable row level security;
alter table disposable_email_domains enable row level security;
