import { createAdminClient } from "@/lib/supabase/admin";
import {
  consoleEmailLogger,
  emailLogger,
  type LogEntry,
} from "@/lib/observability/logger";

/* Persistent trace store. Every logged stage is written to email_trace_events
 * so a single trace id follows an email from trigger through SES send to the
 * delivery webhook. Writes are best-effort: a trace-store failure never breaks
 * sending and is itself logged. */

export type TraceEvent = {
  traceId: string;
  stage: string;
  level?: LogEntry["level"];
  template?: string;
  stream?: string;
  outboxId?: string;
  emailLogId?: string;
  reason?: string;
  code?: string;
  durationMs?: number;
  jobRun?: string;
  toMasked?: string;
  toCount?: number;
  messageId?: string;
  retryable?: boolean;
  configSet?: string;
  fromIdentity?: string;
  meta?: Record<string, unknown>;
};

const BATCH: TraceEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(admin: ReturnType<typeof createAdminClient>): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => flush(admin), 2_000);
}

async function flush(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  flushTimer = null;
  const batch = BATCH.splice(0, BATCH.length);
  if (batch.length === 0) return;
  try {
    await admin
      .from("email_trace_events")
      .insert(
        batch.map((event) => ({
          trace_id: event.traceId,
          stage: event.stage,
          level: event.level ?? "info",
          template: event.template ?? null,
          stream: event.stream ?? null,
          outbox_id: event.outboxId ?? null,
          email_log_id: event.emailLogId ?? null,
          reason: event.reason ?? null,
          code: event.code ?? null,
          duration_ms: event.durationMs ?? null,
          meta: event.meta ?? {},
        })),
      );
  } catch (error) {
    console.error("[email-trace] failed to persist trace batch", error);
  }
}

export async function recordTrace(event: TraceEvent): Promise<void> {
  // Always emit to the structured logger first (this is the authoritative log).
  emailLogger.debug({
    trace: event.traceId,
    stage: event.stage,
    template: event.template,
    stream: event.stream,
    outboxId: event.outboxId,
    emailLogId: event.emailLogId,
    reason: event.reason,
    code: event.code,
    durationMs: event.durationMs,
    meta: event.meta,
  });

  // Always write every email stage to stdout so it appears in hosting logs
  // (e.g. Vercel) regardless of EMAIL_LOG_LEVEL. This is the observable trail
  // for diagnosing why emails are not sent.
  consoleEmailLogger({
    trace: event.traceId,
    stage: event.stage,
    template: event.template,
    stream: event.stream,
    outboxId: event.outboxId,
    emailLogId: event.emailLogId,
    reason: event.reason,
    code: event.code,
    durationMs: event.durationMs,
    meta: event.meta,
  });

  // Best-effort persistent store.
  BATCH.push(event);
  const admin = createAdminClient();
  scheduleFlush(admin);
}

export function flushTraces(): Promise<void> {
  return flush(createAdminClient());
}
