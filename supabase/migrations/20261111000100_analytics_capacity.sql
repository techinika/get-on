-- Analytics and capacity: add long-term stats history, priority classes, and labels

-- Add stats_history_days and priority fields to projects table
alter table public.projects
  add column if not exists stats_history_days integer null;

alter table public.projects
  add column if not exists priority_class text not null default 'free'
    check (priority_class in ('free','basic','pro','enterprise'));

alter table public.projects
  add column if not exists priority_label text;

-- Set history retention based on plan:
-- Free: 90 days, Basic: 365 days, Pro: 730 days, Enterprise: null (unlimited)
-- Applied in the stats reader (lib/stats/reader.ts) via plan lookup.

-- Update plans table: add priority_class and priority_label columns
-- so the plan comparison and landing page can read them.
alter table public.plans
  add column if not exists priority_class text not null default 'free'
    check (priority_class in ('free','basic','pro','enterprise'));

alter table public.plans
  add column if not exists priority_label text;

-- Seed priority_class and priority_label for existing plans based on their name/price:
-- Free: class='free', label='Standard'
-- Basic: class='basic', label='Priority'
-- Pro: class='pro', label='High priority'
-- Enterprise: class='enterprise', label='Highest priority'

update public.plans
set priority_class = case
  when name = 'Free' then 'free'
  when name = 'Basic' then 'basic'
  when name = 'Pro' then 'pro'
  when name = 'Enterprise' then 'enterprise'
  else priority_class
end,
priority_label = case
  when name = 'Free' then 'Standard'
  when name = 'Basic' then 'Priority'
  when name = 'Pro' then 'High priority'
  when name = 'Enterprise' then 'Highest priority'
  else priority_label
end;

-- Apply history days based on the team's effective plan.
-- This is a one-time migration; ongoing logic uses the reader's plan lookup.
-- Join through teams since plan_id lives on the teams table.
update public.projects p
set stats_history_days = case
  when pl.name = 'Free' then 90
  when pl.name = 'Basic' then 365
  when pl.name = 'Pro' then 730
  when pl.name = 'Enterprise' then null
  else 90
end
from public.teams t
join public.plans pl on t.plan_id = pl.id
where p.team_id = t.id
  and p.stats_history_days is null;

-- Add comment
comment on column public.projects.stats_history_days is 'Free: 90, Basic: 365, Pro: 730, Enterprise: null (unlimited)';
comment on column public.projects.priority_class is 'Each plan''s class: free, basic, pro, enterprise';
comment on column public.projects.priority_label is '"Standard", "Priority", "High priority", "Highest priority"';
comment on column public.plans.priority_class is 'Each plan''s class: free, basic, pro, enterprise';
comment on column public.plans.priority_label is '"Standard", "Priority", "High priority", "Highest priority"';