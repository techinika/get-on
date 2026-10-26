-- Trimming old activity is the only delete path. Logs survive website purges.
create or replace function public.trim_team_activity(p_before timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.role() <> 'service_role' then
    raise exception 'NOT_ALLOWED';
  end if;

  perform set_config('app.activity_trim', 'on', true);

  with removed as (
    delete from public.team_activity a
    using public.teams t
    join public.plans p on p.id = t.plan_id
    where a.team_id = t.id
      and a.occurred_at < coalesce(p_before, now() - make_interval(days => coalesce(p.activity_retention_days, 730)))
    returning 1
  )
  select count(*) into v_count from removed;

  perform set_config('app.activity_trim', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.trim_team_activity(timestamptz) from public;
grant execute on function public.trim_team_activity(timestamptz) to service_role;
