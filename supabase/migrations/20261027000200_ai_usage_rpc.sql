create or replace function public.ai_record_usage(
  p_team uuid,
  p_credits integer,
  p_neurons bigint,
  p_requests integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'AI_FORBIDDEN';
  end if;
  if p_credits < 0 or p_neurons < 0 or p_requests < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  insert into public.ai_usage_daily (day, team_id, credits, neurons, requests)
  values ((now() at time zone 'utc')::date, p_team, p_credits, p_neurons, p_requests)
  on conflict (day, team_id) do update
  set credits = public.ai_usage_daily.credits + excluded.credits,
      neurons = public.ai_usage_daily.neurons + excluded.neurons,
      requests = public.ai_usage_daily.requests + excluded.requests;
end;
$$;

revoke all on function public.ai_record_usage(uuid, integer, bigint, integer) from public;
grant execute on function public.ai_record_usage(uuid, integer, bigint, integer) to service_role;
