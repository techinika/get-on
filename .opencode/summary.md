# Get-On AI Assistant Dock — session summary

## Objective
Build an in-page AI assistant dock on the right of every authenticated Get-On page with Assistant/Help tabs, credit-metered chat, persistent conversations, page awareness, confirmation-gated tools, undo, Realtime, and feature-flag rollout. Phase 0/1 complete.

## Branch / HEAD
`feat/assistant-agent-dock` from `feat/email-subdomain-contact-mfa-fixes` at `3b10d4b`. Clean tree; `.opencode/summary.md` not committed (do not commit unless asked).

## Decisions (user-approved)
- Existing DB-backed/cron-script job pattern; extend `ai_settings`; existing audit logs (`team_activity` + `security_events`); viewers read-only/no paid actions; `credit_ledger` unchanged; tag `ai_requests.task = "agent.chat"`.
- Non-negotiables: desktop resizable dock column / mobile full-screen sheet; mount once in `apps/web/app/dashboard/(shell)/layout.tsx`; server-read open/width via DB + cookie (no flash); stream replies; persist messages; one run per conversation; no service-role key on client/model; model from admin config; no raw HTML from model; confirm risky actions; private conversations; audit under user's name; no billing/payment changes; feature flag + admin kill switch; no duplicated business logic.
- Confirmation required for publish/delete/send email/invite/remove member/domain/DNS/ownership transfer/actions >5 credits; everything else runs immediately with Undo.
- Phase 1 = shell/chat/credits/Help, no tool calling, no true token streaming (app-level SSE chunking after `runTask`).

## Completed
- Migration `supabase/migrations/20261119000100_agent.sql`: `agent_conversations`, `agent_messages`, `agent_runs`, `agent_pending_actions`, `user_preferences`, `ai_settings` assistant columns, RLS (incl. restrictive `tfa_required`/`session_verified`), grants, Realtime publication, `admin_agent_set_enabled(boolean)` RPC. Verified against `ai_settings` (`updated_by` exists), `ai_balance` returns `total`, `staff_assert`/`staff_audit` signatures, `target_type='ai'` allowed.
- `agent.chat` task: `packages/ai/src/types.ts` `AiTaskId`; `packages/ai/src/tasks/registry.ts` targetCredits 1 / cap 3 / timeout 60000 / safety standard; `apps/web/lib/ai/tasks.ts` `TEXT_TASKS["agent.chat"]` writer, maxChars 4000, max output 900, moderate true; test added in `apps/web/tests/ai-tasks.test.ts`.
- Env + admin kill switch: `ASSISTANT_ENABLED=true` in `apps/web/lib/env.ts` and `.env.example`; `loadAiSettings` reads `assistantEnabled`/`assistantConfirmCredits`/`assistantTurnCapCredits`; `apps/web/lib/admin/screens.ts` `AdminAiSettings.assistantEnabled` + `setAssistantEnabled()`; `apps/web/app/admin/(console)/ai/actions.ts` `toggleAssistant`; admin page toggle card + info box.
- `apps/web/lib/agent/`: `constants.ts` (cookies, width bounds/clamp, `ASSISTANT_CHAT_CREDITS=1`), `settings.ts` (`getAssistantFeature` = env && global AI && admin flag), `auth.ts` (`getAgentActor`, `canUseAssistant`), `conversations.ts` (list/get/create/messages, run lock `agent_runs_one_active_idx`, balance via `ai_balance`, project verify), `prompt.ts` (page context + transcript), `sse.ts` (`encodeSse`, `chunkText`), `preferences-client.ts`.
- API routes: `GET/POST /api/agent/conversations`, `GET /api/agent/conversations/[id]`, `POST /api/agent/conversations/[id]/messages` (SSE: message/status/delta/done/error; starts run before stream; try/finally finishes run on failure so lock never stuck), `PATCH /api/agent/preferences` (cookies `gs_assistant/tab/width` + `user_preferences` upsert). Role gating 401/403/503.
- UI: `apps/web/components/agent/assistant-dock.tsx` (resizable desktop column / mobile full-screen sheet, keyboard `Ctrl/Cmd+J`, Escape close + return focus, Tab trap mobile, keyboard resize `←/→`, double-click reset, new chat, history, credits chip, cost-per-reply, out-of-credits disabled state + plan link, SSE optimistic user message + server replace, streaming bubble, status/remote-busy from Realtime run updates, Realtime message append dedupe by id), top-bar Assistant button beside UserMenu, Help tab refactor (`HelpContent` exported), AppShell state (server `assistant` props + cookie restore + persistence effect), layout passes `assistant`/`assistantEnabled` and right padding `--assistant-w`, bottom tabs and `get-on:help` event open dock Help tab.
- Layout/shell wired: `getShellData` reads `user_preferences` + assistant cookies; `ShellData.assistant` added.
- Tests: `apps/web/tests/agent.test.ts` (7 tests: clamp/cookie parse/prompt/SSE chunks).
- Verification: `pnpm --filter web typecheck`, `lint`, `test` (519 tests pass), `build` all succeed.

## Current State
- Phase 1 complete and verified. No external blockers.
- Next would be Phase 2 (page context/read tools → create-site flow → editing/publishing → polish), but per plan we must report after Phase 1 and wait for approval before starting Phase 2.

## Next Move
Report Phase 1 completion to user and stop, awaiting approval for Phase 2.

## Relevant Files
- `supabase/migrations/20261119000100_agent.sql`
- `apps/web/lib/agent/*.ts`
- `apps/web/app/api/agent/**`
- `apps/web/components/agent/assistant-dock.tsx`
- `apps/web/components/shell/app-shell.tsx`, `shell-top-bar.tsx`, `help-panel.tsx`, `types.ts`
- `apps/web/app/dashboard/(shell)/layout.tsx`, `lib/dashboard.ts`
- `apps/web/lib/ai/tasks.ts`, `lib/ai/settings.ts`, `lib/env.ts`, `lib/admin/screens.ts`
- `apps/web/app/admin/(console)/ai/page.tsx`, `actions.ts`
- `packages/ai/src/types.ts`, `packages/ai/src/tasks/registry.ts`
- `apps/web/tests/agent.test.ts`, `apps/web/tests/ai-tasks.test.ts`