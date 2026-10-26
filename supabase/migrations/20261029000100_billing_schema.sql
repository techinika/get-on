-- Billing schema: catalogue, prepaid terms, invoices, payments, coupons,
-- grants and the append-only ledger. No provider secrets live in these tables.

-- 1. Catalogue -------------------------------------------------------------

alter table public.plans add column if not exists rank int not null default 0;
alter table public.plans add column if not exists max_templates int;
alter table public.plans add column if not exists max_redirects int not null default 3;
alter table public.plans add column if not exists max_preview_links int not null default 0;
alter table public.plans add column if not exists forms_monthly int not null default 50;
alter table public.plans add column if not exists backup_auto_frequency text not null default 'weekly';
alter table public.plans add column if not exists backup_auto_keep int not null default 1;
alter table public.plans add column if not exists backup_manual_max int not null default 1;
alter table public.plans add column if not exists backup_storage_mb int not null default 100;
alter table public.plans add column if not exists exports_per_day int not null default 3;
alter table public.plans add column if not exists support_priority text not null default 'standard';

do $$ begin
  alter table public.plans add constraint plans_backup_frequency_check
    check (backup_auto_frequency in ('weekly','daily'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.plans add constraint plans_support_priority_check
    check (support_priority in ('standard','priority','highest'));
exception when duplicate_object then null;
end $$;

update public.plans set
  price_usd_monthly = 0,
  rank = 0,
  max_websites = 1,
  max_pages_per_site = 1,
  max_members = 1,
  max_plugins = 1,
  max_templates = 1,
  ai_monthly_credits = 0,
  ai_daily_actions = 30,
  storage_mb = 100,
  monthly_emails = 100,
  custom_domain_allowed = false,
  custom_domains_per_site = 0,
  watermark_required = true,
  max_deleted_pending = 2,
  max_redirects = 3,
  max_preview_links = 0,
  forms_monthly = 50,
  backup_auto_frequency = 'weekly',
  backup_auto_keep = 1,
  backup_manual_max = 1,
  backup_storage_mb = 100,
  exports_per_day = 3,
  support_priority = 'standard'
where id = 'free';

update public.plans set
  price_usd_monthly = 7.99,
  rank = 1,
  max_websites = 2,
  max_pages_per_site = 5,
  max_members = 1,
  max_plugins = 2,
  max_templates = 3,
  ai_monthly_credits = 100,
  ai_daily_actions = 100,
  storage_mb = 1024,
  monthly_emails = 1000,
  custom_domain_allowed = true,
  custom_domains_per_site = 1,
  watermark_required = false,
  max_deleted_pending = 3,
  max_redirects = 25,
  max_preview_links = 1,
  forms_monthly = 500,
  backup_auto_frequency = 'daily',
  backup_auto_keep = 7,
  backup_manual_max = 3,
  backup_storage_mb = 1024,
  exports_per_day = 5,
  support_priority = 'standard'
where id = 'basic';

update public.plans set
  price_usd_monthly = 13.99,
  rank = 2,
  max_websites = 5,
  max_pages_per_site = null,
  max_members = 5,
  max_plugins = 5,
  max_templates = 20,
  ai_monthly_credits = 400,
  ai_daily_actions = 300,
  storage_mb = 5120,
  monthly_emails = 5000,
  custom_domain_allowed = true,
  custom_domains_per_site = 3,
  watermark_required = false,
  max_deleted_pending = 5,
  max_redirects = 100,
  max_preview_links = 10,
  forms_monthly = 5000,
  backup_auto_frequency = 'daily',
  backup_auto_keep = 14,
  backup_manual_max = 10,
  backup_storage_mb = 5120,
  exports_per_day = 10,
  support_priority = 'priority'
where id = 'pro';

update public.plans set
  price_usd_monthly = 59.99,
  rank = 3,
  max_websites = null,
  max_pages_per_site = null,
  max_members = null,
  max_plugins = null,
  max_templates = null,
  ai_monthly_credits = 1500,
  ai_daily_actions = 1000,
  storage_mb = 25600,
  monthly_emails = 25000,
  custom_domain_allowed = true,
  custom_domains_per_site = 10,
  watermark_required = false,
  max_deleted_pending = 10,
  max_redirects = 500,
  max_preview_links = 1000,
  forms_monthly = 50000,
  backup_auto_frequency = 'daily',
  backup_auto_keep = 30,
  backup_manual_max = 25,
  backup_storage_mb = 25600,
  exports_per_day = 20,
  support_priority = 'highest'
where id = 'enterprise';

-- 2. Settings, terms, currencies and tax ----------------------------------

create table if not exists public.billing_settings (
  id int primary key default 1,
  default_currency text not null default 'USD',
  grace_days int not null default 7,
  reminder_days int[] not null default array[30, 7, 1],
  invoice_expiry_days int not null default 14,
  max_unpaid_invoices int not null default 3,
  tax_rate_bps int not null default 0,
  pesapal_ipn_id text,
  updated_at timestamptz not null default now(),
  constraint billing_settings_singleton check (id = 1),
  constraint billing_settings_currency_check check (default_currency = upper(default_currency) and length(default_currency) = 3),
  constraint billing_settings_grace_check check (grace_days between 0 and 365),
  constraint billing_settings_tax_check check (tax_rate_bps between 0 and 10000)
);

insert into public.billing_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.billing_terms (
  months int primary key,
  discount_bps int not null default 0,
  label text not null,
  active boolean not null default true,
  sort int not null default 0,
  constraint billing_terms_months_check check (months in (1, 6, 12, 24, 36, 48, 60)),
  constraint billing_terms_discount_check check (discount_bps between 0 and 10000)
);

insert into public.billing_terms (months, discount_bps, label, active, sort) values
  (1, 0, '1 month', true, 1),
  (6, 500, '6 months', true, 2),
  (12, 1000, '1 year', true, 3),
  (24, 1500, '2 years', true, 4),
  (36, 2000, '3 years', true, 5),
  (48, 2500, '4 years', true, 6),
  (60, 3000, '5 years', true, 7)
on conflict (months) do nothing;

create table if not exists public.exchange_rates (
  currency text not null,
  rate_from_usd numeric(18, 8) not null,
  effective_at timestamptz not null default now(),
  primary key (currency, effective_at),
  constraint exchange_rates_currency_check check (currency = upper(currency) and length(currency) = 3),
  constraint exchange_rates_rate_check check (rate_from_usd > 0)
);

insert into public.exchange_rates (currency, rate_from_usd)
values ('USD', 1)
on conflict do nothing;

create table if not exists public.tax_rules (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  region_code text,
  rate_bps int not null default 0,
  inclusive boolean not null default false,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  constraint tax_rules_rate_check check (rate_bps between 0 and 10000)
);

-- 3. Per-team billing state ------------------------------------------------

create table if not exists public.team_billing (
  team_id uuid primary key references public.teams(id) on delete cascade,
  status text not null default 'free',
  effective_plan_id text not null default 'free' references public.plans(id),
  paid_through timestamptz,
  grace_ends_at timestamptz,
  lapsed_at timestamptz,
  debt_cents bigint not null default 0,
  debt_paid_cents bigint not null default 0,
  currency text not null default 'USD',
  billing_email text,
  billing_name text,
  country_code text,
  last_payment_at timestamptz,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_billing_status_check check (status in ('free','active','grace','lapsed')),
  constraint team_billing_debt_check check (debt_cents >= 0 and debt_paid_cents >= 0)
);

create index if not exists team_billing_status_idx on public.team_billing (status, paid_through);

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  plan_id text not null references public.plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  source text not null default 'support',
  note text,
  created_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  created_at timestamptz not null default now(),
  constraint access_grants_source_check check (source in ('referral','support','promotion','migration')),
  constraint access_grants_dates_check check (ends_at is null or ends_at > starts_at)
);

create index if not exists access_grants_team_idx on public.access_grants (team_id, starts_at, ends_at);

-- 4. Invoices, terms, payments and refunds ---------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  number text not null unique,
  status text not null default 'open',
  kind text not null default 'subscription',
  plan_id text references public.plans(id),
  months int,
  currency text not null default 'USD',
  exchange_rate numeric(18, 8) not null default 1,
  subtotal_cents bigint not null,
  discount_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null,
  amount_paid_cents bigint not null default 0,
  coverage_start timestamptz,
  coverage_end timestamptz,
  due_at timestamptz,
  expires_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  coupon_code text,
  billing_email text,
  billing_name text,
  country_code text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check check (status in ('draft','open','payment_pending','paid','void','expired','refunded','partly_refunded')),
  constraint invoices_kind_check check (kind in ('subscription','renewal','upgrade','debt','manual')),
  constraint invoices_months_check check (months is null or months in (1, 6, 12, 24, 36, 48, 60)),
  constraint invoices_amounts_check check (
    subtotal_cents >= 0 and discount_cents >= 0 and tax_cents >= 0 and total_cents >= 0
    and amount_paid_cents >= 0 and amount_paid_cents <= total_cents
  ),
  constraint invoices_total_check check (total_cents = subtotal_cents - discount_cents + tax_cents),
  constraint invoices_currency_check check (currency = upper(currency) and length(currency) = 3),
  constraint invoices_exchange_check check (exchange_rate > 0),
  constraint invoices_dates_check check (coverage_end is null or coverage_start is null or coverage_end > coverage_start)
);

create index if not exists invoices_team_created_idx on public.invoices (team_id, created_at desc);
create index if not exists invoices_team_status_idx on public.invoices (team_id, status, created_at desc);
create index if not exists invoices_open_idx on public.invoices (status, expires_at) where status in ('open','payment_pending');

create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity int not null default 1,
  unit_amount_cents bigint not null,
  amount_cents bigint not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_lines_quantity_check check (quantity > 0),
  constraint invoice_lines_amounts_check check (unit_amount_cents >= 0 and amount_cents >= 0)
);

create index if not exists invoice_lines_invoice_idx on public.invoice_lines (invoice_id, sort);

create table if not exists public.subscription_terms (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid unique references public.invoices(id) on delete set null,
  plan_id text not null references public.plans(id),
  months int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  constraint subscription_terms_months_check check (months in (1, 6, 12, 24, 36, 48, 60)),
  constraint subscription_terms_status_check check (status in ('upcoming','active','ended','cancelled')),
  constraint subscription_terms_dates_check check (ends_at > starts_at)
);

create index if not exists subscription_terms_team_idx on public.subscription_terms (team_id, starts_at, ends_at);
create index if not exists subscription_terms_active_idx on public.subscription_terms (team_id, ends_at) where status in ('active','upcoming');

create table if not exists public.invoice_counters (
  year int primary key,
  last_number int not null default 0,
  constraint invoice_counters_number_check check (last_number >= 0)
);

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  provider text not null,
  merchant_reference text not null unique,
  provider_reference text unique,
  amount_cents bigint not null,
  currency text not null,
  status text not null default 'pending',
  redirect_url text,
  error_code text,
  error_message text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint payment_attempts_status_check check (status in ('pending','redirected','confirmed','failed','cancelled','expired')),
  constraint payment_attempts_amount_check check (amount_cents > 0),
  constraint payment_attempts_currency_check check (currency = upper(currency) and length(currency) = 3)
);

create index if not exists payment_attempts_invoice_idx on public.payment_attempts (invoice_id, created_at desc);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  attempt_id uuid references public.payment_attempts(id) on delete set null,
  provider text not null,
  provider_reference text not null unique,
  merchant_reference text not null,
  amount_cents bigint not null,
  currency text not null,
  status text not null default 'confirmed',
  method text,
  confirmation_code text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  summary jsonb not null default '{}'::jsonb,
  constraint payments_status_check check (status in ('confirmed','reversed','refunded','partly_refunded')),
  constraint payments_amount_check check (amount_cents > 0),
  constraint payments_currency_check check (currency = upper(currency) and length(currency) = 3)
);

create index if not exists payments_invoice_idx on public.payments (invoice_id, created_at desc);
create index if not exists payments_team_idx on public.payments (team_id, paid_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_key text not null,
  event_type text not null,
  order_tracking_id text,
  merchant_reference text,
  status_received text,
  payload_summary jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_key)
);

create index if not exists payment_events_reference_idx on public.payment_events (provider, order_tracking_id);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_cents bigint not null,
  currency text not null,
  reason text not null,
  status text not null default 'requested',
  provider_reference text,
  created_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint refunds_status_check check (status in ('requested','processed','failed','cancelled')),
  constraint refunds_amount_check check (amount_cents > 0)
);

create index if not exists refunds_payment_idx on public.refunds (payment_id, created_at desc);

create table if not exists public.billing_ledger (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  kind text not null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists billing_ledger_team_idx on public.billing_ledger (team_id, created_at desc);
create index if not exists billing_ledger_invoice_idx on public.billing_ledger (invoice_id, created_at desc);

-- 5. Coupons, grants and notifications -------------------------------------

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  active boolean not null default true,
  percent_off_bps int,
  amount_off_cents bigint,
  plan_ids text[],
  min_months int,
  first_purchase_only boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions int,
  per_team_limit int,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint coupons_code_check check (code = upper(code) and length(code) between 2 and 40),
  constraint coupons_percent_check check (percent_off_bps is null or percent_off_bps between 1 and 10000),
  constraint coupons_amount_check check (amount_off_cents is null or amount_off_cents > 0),
  constraint coupons_one_discount_check check (
    (percent_off_bps is not null and amount_off_cents is null)
    or (percent_off_bps is null and amount_off_cents is not null)
  ),
  constraint coupons_min_months_check check (min_months is null or min_months in (1, 6, 12, 24, 36, 48, 60)),
  constraint coupons_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  team_id uuid not null references public.teams(id) on delete restrict,
  invoice_id uuid not null unique references public.invoices(id) on delete cascade,
  status text not null default 'reserved',
  reserved_at timestamptz not null default now(),
  redeemed_at timestamptz,
  released_at timestamptz,
  constraint coupon_redemptions_status_check check (status in ('reserved','redeemed','released'))
);

create index if not exists coupon_redemptions_team_idx on public.coupon_redemptions (team_id, coupon_id);

create table if not exists public.coupon_attempts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid,
  success boolean not null default false,
  reason text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists coupon_attempts_team_idx on public.coupon_attempts (team_id, created_at desc);

create table if not exists public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null,
  dedupe_key text not null,
  sent_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (team_id, dedupe_key)
);

create table if not exists public.billing_review_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_event_id uuid references public.payment_events(id) on delete set null,
  kind text not null,
  status text not null default 'open',
  details jsonb not null default '{}'::jsonb,
  note text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_review_status_check check (status in ('open','ignored','resolved'))
);

create index if not exists billing_review_open_idx on public.billing_review_items (status, created_at) where status = 'open';

-- 6. Permissions and activity category -------------------------------------

insert into public.permission_matrix (action, owner, admin, editor, viewer) values
  ('billing.invoices', true, true, false, false),
  ('billing.pay', true, false, false, false),
  ('billing.notices', true, true, false, false)
on conflict (action) do update set
  owner = excluded.owner,
  admin = excluded.admin,
  editor = excluded.editor,
  viewer = excluded.viewer;

alter table public.team_activity drop constraint if exists team_activity_category_check;
alter table public.team_activity add constraint team_activity_category_check
  check (category in ('website','page','design','pictures','settings','domain','plugin','template','backup','ai','member','invitation','team','referral','security','billing'));

-- 7. RLS -------------------------------------------------------------------

alter table public.billing_settings enable row level security;
alter table public.billing_terms enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.tax_rules enable row level security;
alter table public.team_billing enable row level security;
alter table public.access_grants enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.subscription_terms enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.billing_ledger enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_attempts enable row level security;
alter table public.billing_notifications enable row level security;
alter table public.billing_review_items enable row level security;

drop policy if exists "billing terms readable by everyone" on public.billing_terms;
create policy "billing terms readable by everyone"
  on public.billing_terms for select using (true);

drop policy if exists "team billing visible to billing readers" on public.team_billing;
create policy "team billing visible to billing readers"
  on public.team_billing for select
  using (public.team_can(team_id, 'billing.invoices') or public.team_can(team_id, 'plan.view'));

drop policy if exists "access grants visible to plan readers" on public.access_grants;
create policy "access grants visible to plan readers"
  on public.access_grants for select
  using (public.team_can(team_id, 'plan.view'));

drop policy if exists "invoices visible to billing readers" on public.invoices;
create policy "invoices visible to billing readers"
  on public.invoices for select
  using (public.team_can(team_id, 'billing.invoices'));

drop policy if exists "invoice lines visible to billing readers" on public.invoice_lines;
create policy "invoice lines visible to billing readers"
  on public.invoice_lines for select
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and public.team_can(i.team_id, 'billing.invoices')
  ));

drop policy if exists "subscription terms visible to plan readers" on public.subscription_terms;
create policy "subscription terms visible to plan readers"
  on public.subscription_terms for select
  using (public.team_can(team_id, 'plan.view'));

drop policy if exists "payment attempts visible to payers" on public.payment_attempts;
create policy "payment attempts visible to payers"
  on public.payment_attempts for select
  using (public.team_can(team_id, 'billing.pay'));

drop policy if exists "payments visible to billing readers" on public.payments;
create policy "payments visible to billing readers"
  on public.payments for select
  using (public.team_can(team_id, 'billing.invoices'));

drop policy if exists "refunds visible to billing readers" on public.refunds;
create policy "refunds visible to billing readers"
  on public.refunds for select
  using (public.team_can(team_id, 'billing.invoices'));

drop policy if exists "ledger visible to billing readers" on public.billing_ledger;
create policy "ledger visible to billing readers"
  on public.billing_ledger for select
  using (public.team_can(team_id, 'billing.invoices'));

drop policy if exists "coupon redemptions visible to billing readers" on public.coupon_redemptions;
create policy "coupon redemptions visible to billing readers"
  on public.coupon_redemptions for select
  using (public.team_can(team_id, 'billing.invoices'));

drop policy if exists "billing notices visible to notice readers" on public.billing_notifications;
create policy "billing notices visible to notice readers"
  on public.billing_notifications for select
  using (public.team_can(team_id, 'billing.notices'));
