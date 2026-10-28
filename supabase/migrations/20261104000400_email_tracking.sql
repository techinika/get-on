-- Atomic email tracking writes. The endpoints use the service role, so these
-- functions are not exposed to customers or staff.

create or replace function public.email_track_click(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  update public.email_tracking_links
    set clicks = clicks + 1,
        first_clicked_at = coalesce(first_clicked_at, now())
    where token = p_token
    returning url into v_url;

  return v_url;
end;
$$;

create or replace function public.email_track_open(p_outbox uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.notification_outbox where id = p_outbox) then
    return false;
  end if;

  insert into public.email_tracking_opens (outbox_id)
    values (p_outbox)
  on conflict (outbox_id) do update
    set opens = public.email_tracking_opens.opens + 1;

  return true;
end;
$$;

revoke all on function public.email_track_click(text) from public;
revoke all on function public.email_track_open(uuid) from public;
grant execute on function public.email_track_click(text) to service_role;
grant execute on function public.email_track_open(uuid) to service_role;
