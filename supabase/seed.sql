insert into public.plans (
  id,
  name,
  price_usd_monthly,
  max_websites,
  max_pages_per_site,
  max_members,
  max_plugins,
  ai_monthly_credits,
  ai_daily_actions,
  storage_mb,
  monthly_emails,
  custom_domain_allowed,
  custom_domains_per_site,
  watermark_required
)
values
  ('free', 'Free', 0, 1, 1, 1, 1, 0, 30, 100, 100, false, 0, true),
  ('basic', 'Basic', 7.99, 3, 10, 3, 5, 100, 100, 500, 500, true, 1, false),
  ('pro', 'Pro', 13.99, 10, 50, 10, 15, 400, 300, 2048, 2000, true, 3, false),
  ('enterprise', 'Enterprise', 59.99, null, null, null, null, 1500, 1000, 10240, 10000, true, 10, false)
on conflict (id) do update
set
  name = excluded.name,
  price_usd_monthly = excluded.price_usd_monthly,
  max_websites = excluded.max_websites,
  max_pages_per_site = excluded.max_pages_per_site,
  max_members = excluded.max_members,
  max_plugins = excluded.max_plugins,
  ai_monthly_credits = excluded.ai_monthly_credits,
  ai_daily_actions = excluded.ai_daily_actions,
  storage_mb = excluded.storage_mb,
  monthly_emails = excluded.monthly_emails,
  custom_domain_allowed = excluded.custom_domain_allowed,
  custom_domains_per_site = excluded.custom_domains_per_site,
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
  ('dashboard'),
  ('dashboard'),
  ('dev'),
  ('test'),
  ('staging'),
  ('beta'),
  ('alpha'),
  ('demo'),
  ('portal'),
  ('login'),
  ('register'),
  ('signup'),
  ('secure'),
  ('cdn'),
  ('static'),
  ('media')
on conflict (name) do nothing;
