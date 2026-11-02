create or replace function public.admin_ai_grant_credits(
  p_team uuid,
  p_credits integer,
  p_reason text,
  p_expires timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_id uuid;
  v_balance integer;
  v_reason text := trim(coalesce(p_reason, ''));
  v_source text;
begin
  perform public.staff_assert('ai.credits.direct');

  if p_credits is null or p_credits <= 0 or p_credits > 1000000 then
    raise exception 'CREDIT_AMOUNT';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_expires is not null and p_expires <= now() then
    raise exception 'EXPIRY_INVALID';
  end if;
  if not exists (select 1 from public.teams where id = p_team) then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  v_source := 'admin:' || gen_random_uuid()::text;

  insert into public.credit_buckets (
    team_id, kind, amount_initial, amount_remaining, amount_reserved,
    expires_at, source, note, created_by
  ) values (
    p_team, 'admin', p_credits, p_credits, 0,
    p_expires, v_source, v_reason, auth.uid()
  )
  returning id into v_bucket_id;

  v_balance := public.ai_available(p_team);

  insert into public.credit_ledger (
    team_id, user_id, bucket_id, kind, credits, balance_after, summary, meta
  ) values (
    p_team, null, v_bucket_id, 'grant', p_credits, v_balance,
    'AI credits added by support',
    jsonb_build_object(
      'kind', 'admin',
      'source', v_source,
      'reason', v_reason,
      'expiresAt', p_expires
    )
  );

  perform public.staff_audit(
    'ai.credits_granted', 'team', p_team::text, null, v_reason, null,
    jsonb_build_object(
      'credits', p_credits,
      'bucket_id', v_bucket_id,
      'expires_at', p_expires
    )
  );

  return jsonb_build_object(
    'ok', true,
    'bucket_id', v_bucket_id,
    'balance', v_balance
  );
end;
$$;

revoke all on function public.admin_ai_grant_credits(uuid, integer, text, timestamptz) from public;
grant execute on function public.admin_ai_grant_credits(uuid, integer, text, timestamptz) to authenticated, service_role;
