do $$
declare
  v_amount integer;
  v_profile record;
  v_bucket_id uuid;
  v_balance integer;
begin
  select free_grant_credits into v_amount
  from public.ai_settings
  where id = true;

  if coalesce(v_amount, 0) <= 0 then
    return;
  end if;

  for v_profile in
    select p.id as user_id, t.id as team_id
    from public.profiles p
    join public.teams t
      on t.owner_id = p.id
     and t.is_personal = true
    where p.free_ai_grant_at is not null
      and not exists (
        select 1
        from public.credit_buckets b
        where b.team_id = t.id
          and b.kind = 'free_grant'
          and b.source = 'free:' || p.id::text
      )
  loop
    insert into public.credit_buckets (
      team_id, kind, amount_initial, amount_remaining, amount_reserved,
      expires_at, source, note, created_by
    ) values (
      v_profile.team_id, 'free_grant', v_amount, v_amount, 0,
      null, 'free:' || v_profile.user_id::text, 'Free AI credits to start', null
    )
    on conflict (team_id, kind, source) where source is not null do nothing
    returning id into v_bucket_id;

    if v_bucket_id is not null then
      v_balance := public.ai_available(v_profile.team_id);
      insert into public.credit_ledger (
        team_id, user_id, bucket_id, kind, credits, balance_after, summary, meta
      ) values (
        v_profile.team_id, v_profile.user_id, v_bucket_id, 'grant', v_amount,
        v_balance, 'Free AI credits added',
        jsonb_build_object('kind', 'free_grant', 'source', 'free:' || v_profile.user_id::text)
      );
    end if;
  end loop;
end $$;
