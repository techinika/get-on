import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type AgentMessageRole = "user" | "assistant" | "tool" | "system";

export type AgentConversation = {
  id: string;
  title: string;
  projectId: string | null;
  lastMessageAt: string;
  createdAt: string;
};

export type AgentMessage = {
  id: string;
  role: AgentMessageRole;
  content: string;
  credits: number;
  requestId: string | null;
  createdAt: string;
};

type ConversationRow = {
  id: string;
  title: string;
  project_id: string | null;
  last_message_at: string;
  created_at: string;
};

type MessageRow = {
  id: string;
  role: AgentMessageRole;
  content: string;
  credits: number | null;
  request_id: string | null;
  created_at: string;
};

function conversationFromRow(row: ConversationRow): AgentConversation {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

function messageFromRow(row: MessageRow): AgentMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    credits: Number(row.credits ?? 0),
    requestId: row.request_id,
    createdAt: row.created_at,
  };
}

export function titleFromMessage(content: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

export async function listAgentConversations(
  admin: Admin,
  teamId: string,
  userId: string,
  limit = 30,
): Promise<AgentConversation[]> {
  const { data, error } = await admin
    .from("agent_conversations")
    .select("id, title, project_id, last_message_at, created_at")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as ConversationRow[]).map(conversationFromRow);
}

export async function getAgentConversation(
  admin: Admin,
  id: string,
  teamId: string,
  userId: string,
): Promise<AgentConversation | null> {
  const { data, error } = await admin
    .from("agent_conversations")
    .select("id, title, project_id, last_message_at, created_at")
    .eq("id", id)
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? conversationFromRow(data as ConversationRow) : null;
}

export async function createAgentConversation(
  admin: Admin,
  input: {
    teamId: string;
    userId: string;
    projectId?: string | null;
  },
): Promise<AgentConversation> {
  const { data, error } = await admin
    .from("agent_conversations")
    .insert({
      team_id: input.teamId,
      user_id: input.userId,
      project_id: input.projectId ?? null,
    })
    .select("id, title, project_id, last_message_at, created_at")
    .single();
  if (error || !data) throw error ?? new Error("AGENT_CONVERSATION_FAILED");
  return conversationFromRow(data as ConversationRow);
}

export async function listAgentMessages(
  admin: Admin,
  conversationId: string,
  limit = 200,
): Promise<AgentMessage[]> {
  const { data, error } = await admin
    .from("agent_messages")
    .select("id, role, content, credits, request_id, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map(messageFromRow);
}

export async function appendAgentMessage(
  admin: Admin,
  input: {
    conversationId: string;
    teamId: string;
    userId: string | null;
    role: AgentMessageRole;
    content: string;
    credits?: number;
    requestId?: string | null;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): Promise<AgentMessage> {
  const { data, error } = await admin
    .from("agent_messages")
    .insert({
      conversation_id: input.conversationId,
      team_id: input.teamId,
      user_id: input.userId,
      role: input.role,
      content: input.content.slice(0, 20000),
      credits: Math.max(0, Math.round(input.credits ?? 0)),
      request_id: input.requestId ?? null,
      tool_name: input.toolName ?? null,
      tool_input: input.toolInput ?? null,
      tool_output: input.toolOutput ?? null,
    })
    .select("id, role, content, credits, request_id, created_at")
    .single();
  if (error || !data) throw error ?? new Error("AGENT_MESSAGE_FAILED");

  const patch: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
  };
  if (input.role === "user") {
    const { data: conversation } = await admin
      .from("agent_conversations")
      .select("title")
      .eq("id", input.conversationId)
      .maybeSingle();
    if (conversation?.title === "New chat") {
      patch.title = titleFromMessage(input.content);
    }
  }
  await admin
    .from("agent_conversations")
    .update(patch)
    .eq("id", input.conversationId);

  return messageFromRow(data as MessageRow);
}

export async function startAgentRun(
  admin: Admin,
  input: {
    conversationId: string;
    teamId: string;
    userId: string;
  },
): Promise<{ ok: true; id: string } | { ok: false; code: "AI_BUSY" }> {
  const { data, error } = await admin
    .from("agent_runs")
    .insert({
      conversation_id: input.conversationId,
      team_id: input.teamId,
      user_id: input.userId,
      status: "running",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, code: "AI_BUSY" };
    throw error;
  }
  return { ok: true, id: String(data.id) };
}

export async function finishAgentRun(
  admin: Admin,
  runId: string,
  input: {
    status: "succeeded" | "failed" | "cancelled";
    requestId?: string | null;
    errorCode?: string | null;
  },
): Promise<void> {
  const { error } = await admin
    .from("agent_runs")
    .update({
      status: input.status,
      request_id: input.requestId ?? null,
      error_code: input.errorCode ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) console.error("[agent] could not finish run", runId, error);
}

export async function getAgentBalance(
  admin: Admin,
  teamId: string,
): Promise<number> {
  const { data, error } = await admin.rpc("ai_balance", { p_team: teamId });
  if (error) return 0;
  const value =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  const total = Number(value.total ?? 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

export async function verifyAgentProject(
  admin: Admin,
  teamId: string,
  projectId: string | null | undefined,
): Promise<boolean> {
  if (!projectId) return true;
  const { data } = await admin
    .from("projects")
    .select("team_id, deleted_at")
    .eq("id", projectId)
    .maybeSingle();
  return Boolean(data && data.team_id === teamId && !data.deleted_at);
}
