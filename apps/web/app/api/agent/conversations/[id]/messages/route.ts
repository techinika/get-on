import { NextResponse } from "next/server";
import { z } from "zod";
import { aiErrorMessage } from "@get-on/ai";
import { sanitiseText } from "@/lib/ai/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseAssistant, getAgentActor } from "@/lib/agent/auth";
import {
  appendAgentMessage,
  finishAgentRun,
  getAgentBalance,
  getAgentConversation,
  getAgentProjectContext,
  startAgentRun,
} from "@/lib/agent/conversations";
import {
  normaliseAgentContext,
  type AgentPageContext,
} from "@/lib/agent/prompt";
import { getAssistantFeature } from "@/lib/agent/settings";
import { chunkText, encodeSse, type AgentStreamEvent } from "@/lib/agent/sse";
import { runAgentLoop } from "@/lib/agent/loop";
import { assistantTools } from "@/lib/agent/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  context: z
    .object({
      route: z.string().max(240).optional(),
      pageTitle: z.string().max(120).optional(),
      projectName: z.string().max(120).optional(),
      teamName: z.string().max(120).optional(),
    })
    .optional(),
});

function streamResponse(
  run: (send: (event: AgentStreamEvent, data: unknown) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  function send(event: AgentStreamEvent, data: unknown) {
    if (closed || !controller) return;
    try {
      controller.enqueue(encoder.encode(encodeSse(event, data)));
    } catch {
      closed = true;
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(next) {
      controller = next;
      void run(send)
        .catch((error) => {
          console.error("[agent] stream failed", error);
          send("error", {
            code: "AI_PROVIDER_ERROR",
            message: aiErrorMessage("AI_PROVIDER_ERROR"),
          });
        })
        .finally(() => {
          closed = true;
          try {
            controller?.close();
          } catch {
            // The client may already have closed the stream.
          }
        });
    },
    cancel() {
      closed = true;
      controller = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getAgentActor();
  if (!actor) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }
  if (!canUseAssistant(actor.role)) {
    return NextResponse.json(
      { error: "Ask an owner or admin to use the assistant." },
      { status: 403 },
    );
  }
  const feature = await getAssistantFeature();
  if (!feature.enabled) {
    return NextResponse.json({ error: "Assistant is off." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "That message is not valid." }, { status: 400 });
  }

  const message = sanitiseText(parsed.data.message, 4000).trim();
  if (!message) {
    return NextResponse.json({ error: "Please write a message first." }, { status: 400 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const conversation = await getAgentConversation(
    admin,
    id,
    actor.teamId,
    actor.userId,
  ).catch(() => null);
  if (!conversation) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const run = await startAgentRun(admin, {
    conversationId: conversation.id,
    teamId: actor.teamId,
    userId: actor.userId,
  }).catch((error) => {
    console.error("[agent] could not start run", error);
    return { ok: false as const, code: "AI_PROVIDER_ERROR" as const };
  });
  if (!run.ok) {
    const busy = run.code === "AI_BUSY";
    return NextResponse.json(
      {
        code: run.code,
        error: busy
          ? "The assistant is still answering the last message."
          : "The assistant could not start.",
      },
      { status: busy ? 409 : 500 },
    );
  }

  const projectContext =
    conversation.projectId
      ? await getAgentProjectContext(
          admin,
          actor.teamId,
          conversation.projectId,
        ).catch(() => null)
      : null;

  const baseContext: AgentPageContext = {
    route: "",
    pageTitle: conversation.title,
    projectName: projectContext?.projectName ?? conversation.title,
    teamName: actor.teamName,
  };
  let context = normaliseAgentContext(parsed.data.context, baseContext);
  if (projectContext) {
    context = {
      ...context,
      ...projectContext,
      projectName: projectContext.projectName ?? context.projectName,
    };
  }

  return streamResponse(async (send) => {
    let runFinished = false;
    try {
      const userMessage = await appendAgentMessage(admin, {
        conversationId: conversation.id,
        teamId: actor.teamId,
        userId: actor.userId,
        role: "user",
        content: message,
      });
      send("message", userMessage);
      send("status", { label: "Thinking" });

      const result = await runAgentLoop({
        conversationId: conversation.id,
        teamId: actor.teamId,
        userId: actor.userId,
        projectId: conversation.projectId,
        tools: Object.values(assistantTools),
        context: {
          route: context.route,
          pageTitle: context.pageTitle,
          projectName: context.projectName,
          teamName: context.teamName,
        },
      });

      if (!result.ok) {
        await finishAgentRun(admin, run.id, {
          status: "failed",
          requestId: result.requestId ?? null,
          errorCode: result.code,
        });
        runFinished = true;
        send("error", { code: result.code, message: result.message });
        return;
      }

      if (result.confirmation) {
        // Waiting for the user to confirm a risky action. Keep the run open so
        // the confirm endpoint can resolve it, and surface the card to the UI.
        await admin
          .from("agent_runs")
          .update({ status: "running" })
          .eq("id", run.id);
        runFinished = true;
        send("confirmation_required", {
          action: result.confirmation,
          credits: result.credits,
          requestId: result.requestId,
        });
        return;
      }

      const assistantMessage = await appendAgentMessage(admin, {
        conversationId: conversation.id,
        teamId: actor.teamId,
        userId: null,
        role: "assistant",
        content: result.text,
        credits: result.credits,
        requestId: result.requestId,
      });
      await finishAgentRun(admin, run.id, {
        status: "succeeded",
        requestId: result.requestId,
      });
      runFinished = true;

      for (const chunk of chunkText(result.text)) {
        send("delta", { text: chunk });
      }
      const balance = await getAgentBalance(admin, actor.teamId);
      send("done", {
        message: assistantMessage,
        credits: result.credits,
        requestId: result.requestId,
        balance,
        status: result.status,
      });
    } finally {
      if (!runFinished) {
        await finishAgentRun(admin, run.id, {
          status: "failed",
          errorCode: "AGENT_FAILED",
        });
      }
    }
  });
}
