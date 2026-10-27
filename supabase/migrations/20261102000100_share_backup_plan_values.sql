-- Align download and tracked-link allowances with docs/ui-spec-share-backup.md.
-- The plan-limit RPC reads these columns, so no function change is needed.

update public.plans
set
  site_zip_allowed = case id
    when 'free' then false
    when 'basic' then true
    when 'pro' then true
    when 'enterprise' then true
    else site_zip_allowed
  end,
  site_zip_per_day = case id
    when 'free' then 0
    when 'basic' then 3
    when 'pro' then 10
    when 'enterprise' then 30
    else site_zip_per_day
  end,
  tracked_links_max = case id
    when 'free' then 3
    when 'basic' then 20
    when 'pro' then 100
    when 'enterprise' then 1000
    else tracked_links_max
  end
where id in ('free', 'basic', 'pro', 'enterprise');
