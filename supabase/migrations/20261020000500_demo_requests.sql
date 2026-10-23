-- Demo requests from the public /request-demo form.
-- Rows are written by the server with the service role only. No policies are
-- created for the anon or authenticated roles, so nobody can read or write
-- these rows from the browser.

create table if not exists public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  business_name text not null,
  business_type text,
  websites_needed text not null
    check (websites_needed in ('1', '2-5', '6-20', '20+')),
  meeting_method text not null
    check (meeting_method in ('video', 'phone', 'whatsapp')),
  preferred_time text not null
    check (preferred_time in ('morning', 'afternoon', 'evening', 'any')),
  timezone text,
  message text check (char_length(message) <= 500),
  interest text,
  consent boolean not null check (consent),
  status text not null default 'new'
    check (status in ('new', 'contacted', 'scheduled', 'closed')),
  user_id uuid references auth.users (id) on delete set null,
  source_page text,
  ip_hash text,
  user_agent text
);

create index if not exists demo_requests_ip_created_idx
  on public.demo_requests (ip_hash, created_at desc);

create index if not exists demo_requests_email_created_idx
  on public.demo_requests (email, created_at desc);

alter table public.demo_requests enable row level security;
