-- Reference data the app needs: the plan list and the reserved web addresses.
-- These used to live only in supabase/seed.sql, which runs on `supabase db
-- reset` but not on `supabase db push`. Without them a fresh database has no
-- 'free' plan and the sign-up trigger cannot create a personal team.

insert into public.plans (
  id,
  name,
  price_usd_monthly,
  max_websites,
  max_pages_per_site,
  max_members,
  max_plugins,
  ai_credits_monthly,
  storage_mb,
  monthly_emails,
  custom_domain_allowed,
  watermark_required
)
values
  ('free', 'Free', 0, 1, 1, 1, 1, 10, 100, 0, false, true),
  ('basic', 'Basic', 7.99, 2, 5, 1, 2, 100, 1024, 1000, true, false),
  ('pro', 'Pro', 13.99, 5, null, 5, 5, 400, 5120, 5000, true, false),
  ('enterprise', 'Enterprise', 59.99, null, null, null, null, 1500, 25600, 25000, true, false)
on conflict (id) do update
set
  name = excluded.name,
  price_usd_monthly = excluded.price_usd_monthly,
  max_websites = excluded.max_websites,
  max_pages_per_site = excluded.max_pages_per_site,
  max_members = excluded.max_members,
  max_plugins = excluded.max_plugins,
  ai_credits_monthly = excluded.ai_credits_monthly,
  storage_mb = excluded.storage_mb,
  monthly_emails = excluded.monthly_emails,
  custom_domain_allowed = excluded.custom_domain_allowed,
  watermark_required = excluded.watermark_required;

insert into public.reserved_subdomains (name)
values
  ('www'),
  ('app'),
  ('admin'),
  ('api'),
  ('mail'),
  ('support'),
  ('billing'),
  ('status'),
  ('help'),
  ('blog'),
  ('ftp'),
  ('dashboard')
on conflict (name) do nothing;
