create table if not exists public.billing_account_credits (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete restrict,
  amount_cents bigint not null,
  balance_cents bigint not null,
  currency text not null default 'USD',
  source text not null default 'admin',
  note text not null default '',
  approval_id uuid references public.approval_requests(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists billing_account_credits_team_idx
  on public.billing_account_credits (team_id, created_at desc);

alter table public.billing_account_credits enable row level security;

create or replace function public.admin_credit_adjust(
  p_team uuid,
  p_amount_cents bigint,
  p_currency text default 'USD',
  p_source text default 'admin',
  p_note text default '',
  p_approval_id uuid default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_new_balance bigint;
begin
  perform public.staff_assert('billing.credit_adjust.approve');
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'CREDIT_AMOUNT_REQUIRED';
  end if;
  if not exists (select 1 from public.teams where id = p_team) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-credit:' || p_team::text, 0));

  if p_approval_id is not null and exists (
    select 1 from public.billing_account_credits
    where approval_id = p_approval_id
  ) then
    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'balance_cents', coalesce((
        select balance_cents
        from public.billing_account_credits
        where team_id = p_team
        order by created_at desc, id desc
        limit 1
      ), 0)
    );
  end if;

  select balance_cents into v_balance
  from public.billing_account_credits
  where team_id = p_team
  order by created_at desc, id desc
  limit 1;
  v_balance := coalesce(v_balance, 0);
  v_new_balance := v_balance + p_amount_cents;
  if v_new_balance < 0 then
    raise exception 'CREDIT_INSUFFICIENT';
  end if;

  insert into public.billing_account_credits (
    team_id, amount_cents, balance_cents, currency, source, note,
    approval_id, created_by
  )
  values (
    p_team, p_amount_cents, v_new_balance,
    upper(coalesce(nullif(trim(p_currency), ''), 'USD')),
    coalesce(nullif(trim(p_source), ''), 'admin'),
    coalesce(nullif(trim(p_note), ''), 'Account credit'),
    p_approval_id, p_created_by
  );

  return jsonb_build_object(
    'ok', true,
    'balance_cents', v_new_balance,
    'amount_cents', p_amount_cents
  );
end;
$$;

revoke all on function public.admin_credit_adjust(
  uuid, bigint, text, text, text, uuid, uuid
) from public;
grant execute on function public.admin_credit_adjust(
  uuid, bigint, text, text, text, uuid, uuid
) to authenticated, service_role;

create or replace function public.admin_credit_balance(p_team uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform public.staff_assert('billing.credit_adjust.approve');
  select balance_cents into v_balance
  from public.billing_account_credits
  where team_id = p_team
  order by created_at desc, id desc
  limit 1;

  return coalesce(v_balance, 0);
end;
$$;

revoke all on function public.admin_credit_balance(uuid) from public;
grant execute on function public.admin_credit_balance(uuid) to authenticated, service_role;
