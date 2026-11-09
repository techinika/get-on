-- Assistant dock: conversations, messages, runs, confirmations and preferences.

alter table public.ai_settings
  add column if not exists assistant_enabled boolean not null default true,
  add column if not exists assistant_confirm_credits integer not null default 5
    check (assistant_confirm_credits between 0 and 1000),
  add column if not exists assistant_turn_cap_credits integer not null default 3
    check (assistant_turn_cap_credits between 0 and 100);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  assistant_open boolean not null default false,
  assistant_width integer not null default 400
    check (assistant_width between 320 and 720),
  assistant_tab text not null default 'assistant'
    check (assistant_tab in ('assistant', 'help')),
  assistant_draft text not null default ''
    check (char_length(assistant_draft) <= 4000),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New chat'
    check (char_length(title) between 1 and 120),
  flow_state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_conversations_team_user_idx
  on public.agent_conversations (team_id, user_id, last_message_at desc);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.agent_conversations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default ''
    check (char_length(content) <= 20000),
  tool_name text check (tool_name is null or char_length(tool_name) <= 80),
  tool_call_id text check (tool_call_id is null or char_length(tool_call_id) <= 120),
  tool_input jsonb,
  tool_output jsonb,
  request_id uuid references public.ai_requests(id) on delete set null,
  credits integer not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages (conversation_id, created_at);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.agent_conversations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'running'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  request_id uuid references public.ai_requests(id) on delete set null,
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists agent_runs_one_active_idx
  on public.agent_runs (conversation_id)
  where status in ('queued', 'running');

create index if not exists agent_runs_team_created_idx
  on public.agent_runs (team_id, created_at desc);

create table if not exists public.agent_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.agent_conversations(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null check (char_length(tool_name) between 1 and 80),
  arguments jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  risk text not null default 'medium'
    check (risk in ('low', 'medium', 'high')),
  estimated_credits integer not null default 0 check (estimated_credits >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired', 'executed', 'failed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists agent_pending_actions_conversation_idx
  on public.agent_pending_actions (conversation_id, status, created_at desc);

drop trigger if exists agent_conversations_touch_updated_at on public.agent_conversations;
create trigger agent_conversations_touch_updated_at
  before update on public.agent_conversations
  for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

alter table public.user_preferences enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_pending_actions enable row level security;

drop policy if exists "users read own preferences" on public.user_preferences;
create policy "users read own preferences"
  on public.user_preferences for select
  using (user_id = auth.uid());

drop policy if exists "users write own preferences" on public.user_preferences;
create policy "users write own preferences"
  on public.user_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users read own assistant conversations" on public.agent_conversations;
create policy "users read own assistant conversations"
  on public.agent_conversations for select
  using (
    user_id = auth.uid()
    and public.user_is_team_member(team_id)
  );

drop policy if exists "users read own assistant messages" on public.agent_messages;
create policy "users read own assistant messages"
  on public.agent_messages for select
  using (
    exists (
      select 1
      from public.agent_conversations c
      where c.id = agent_messages.conversation_id
        and c.user_id = auth.uid()
        and public.user_is_team_member(c.team_id)
    )
  );

drop policy if exists "users read own assistant runs" on public.agent_runs;
create policy "users read own assistant runs"
  on public.agent_runs for select
  using (
    exists (
      select 1
      from public.agent_conversations c
      where c.id = agent_runs.conversation_id
        and c.user_id = auth.uid()
        and public.user_is_team_member(c.team_id)
    )
  );

drop policy if exists "users read own assistant actions" on public.agent_pending_actions;
create policy "users read own assistant actions"
  on public.agent_pending_actions for select
  using (
    exists (
      select 1
      from public.agent_conversations c
      where c.id = agent_pending_actions.conversation_id
        and c.user_id = auth.uid()
        and public.user_is_team_member(c.team_id)
    )
  );

drop policy if exists tfa_required on public.user_preferences;
create policy tfa_required on public.user_preferences
  as restrictive for all to authenticated
  using ((select public.session_verified()))
  with check ((select public.session_verified()));

drop policy if exists tfa_required on public.agent_conversations;
create policy tfa_required on public.agent_conversations
  as restrictive for all to authenticated
  using ((select public.session_verified()))
  with check ((select public.session_verified()));

drop policy if exists tfa_required on public.agent_messages;
create policy tfa_required on public.agent_messages
  as restrictive for all to authenticated
  using ((select public.session_verified()))
  with check ((select public.session_verified()));

drop policy if exists tfa_required on public.agent_runs;
create policy tfa_required on public.agent_runs
  as restrictive for all to authenticated
  using ((select public.session_verified()))
  with check ((select public.session_verified()));

drop policy if exists tfa_required on public.agent_pending_actions;
create policy tfa_required on public.agent_pending_actions
  as restrictive for all to authenticated
  using ((select public.session_verified()))
  with check ((select public.session_verified()));

revoke all on public.user_preferences from anon, authenticated;
revoke all on public.agent_conversations from anon, authenticated;
revoke all on public.agent_messages from anon, authenticated;
revoke all on public.agent_runs from anon, authenticated;
revoke all on public.agent_pending_actions from anon, authenticated;

grant select, insert, update on public.user_preferences to authenticated;
grant select on public.agent_conversations to authenticated;
grant select on public.agent_messages to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.agent_pending_actions to authenticated;
grant all on public.user_preferences to service_role;
grant all on public.agent_conversations to service_role;
grant all on public.agent_messages to service_role;
grant all on public.agent_runs to service_role;
grant all on public.agent_pending_actions to service_role;

do $$
declare
  t text;
  tables text[] := array[
    'agent_conversations', 'agent_messages', 'agent_runs', 'agent_pending_actions'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array tables loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.admin_agent_set_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.staff_assert('ai.settings');
  update public.ai_settings
  set assistant_enabled = coalesce(p_enabled, false),
      updated_by = auth.uid(),
      updated_at = now()
  where id = true;

  perform public.staff_audit(
    'ai.assistant_toggled', 'ai', 'assistant', null, null, null,
    jsonb_build_object('enabled', coalesce(p_enabled, false))
  );
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end;
$$;

revoke all on function public.admin_agent_set_enabled(boolean) from public;
grant execute on function public.admin_agent_set_enabled(boolean) to authenticated, service_role;
