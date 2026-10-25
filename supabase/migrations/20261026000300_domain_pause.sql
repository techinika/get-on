alter table public.domains
  drop constraint if exists domains_status_check;

alter table public.domains
  add column if not exists pause_previous_status text;

alter table public.domains
  add constraint domains_status_check check (status in (
    'draft','awaiting_txt','verified','connecting','live','attention','stalled',
    'plan_lapsed','paused','unassigned','removing','removed','failed'
  ));
