create or replace function public.admin_delete_account(
  p_team uuid,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams;
  v_owner_id uuid;
begin
  perform public.staff_assert('account.delete.approve');

  select * into v_team from public.teams where id = p_team;
  if v_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_owner_id := v_team.owner_id;

  if exists (
    select 1 from public.staff_members where user_id = v_owner_id
  ) then
    raise exception 'ACCOUNT_IS_STAFF';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('account-delete:' || p_team::text, 0));

  delete from public.coupon_redemptions where team_id = p_team;
  delete from public.billing_ledger where team_id = p_team;
  delete from public.refunds where team_id = p_team;
  delete from public.payment_attempts where team_id = p_team;
  delete from public.payments where team_id = p_team;
  delete from public.subscription_terms where team_id = p_team;
  delete from public.invoices where team_id = p_team;
  delete from public.account_credits where team_id = p_team;

  delete from public.teams where id = p_team;

  return jsonb_build_object(
    'ok', true,
    'team_id', p_team,
    'owner_id', v_owner_id,
    'reason', coalesce(nullif(trim(p_reason), ''), 'Account deletion')
  );
end;
$$;

revoke all on function public.admin_delete_account(uuid, text) from public;
grant execute on function public.admin_delete_account(uuid, text) to authenticated, service_role;
