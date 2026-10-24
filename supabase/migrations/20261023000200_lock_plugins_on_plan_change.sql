-- Lock excess plugins when a team's plan changes (downgrades)
create or replace function public.lock_excess_plugins_for_team(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proj record;
begin
  if p_team_id is null then
    return jsonb_build_object('ok', true);
  end if;
  for v_proj in
    select id from public.projects where team_id = p_team_id
  loop
    perform public.lock_excess_plugins(v_proj.id);
  end loop;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.handle_team_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.plan_id is distinct from new.plan_id then
    perform public.lock_excess_plugins_for_team(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_team_plan_change on public.teams;
create trigger on_team_plan_change
  after update of plan_id on public.teams
  for each row
  execute function public.handle_team_plan_change();

revoke all on function public.lock_excess_plugins_for_team(uuid) from public;
grant execute on function public.lock_excess_plugins_for_team(uuid) to service_role;
