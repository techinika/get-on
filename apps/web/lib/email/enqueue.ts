import { createAdminClient } from "@/lib/supabase/admin";

export type EnqueueEmailInput = {
  kind: string;
  stream?: "transactional" | "marketing" | "system";
  userId?: string | null;
  toEmail?: string | null;
  teamId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  payload: {
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    reason?: string;
    footer?: string;
    [key: string]: unknown;
  };
  scheduledFor?: string;
  expiresAt?: string | null;
  dedupeKey?: string;
};

export type EnqueueEmailResult = {
  ok: boolean;
  id: string | null;
  deduped: boolean;
};

function defaultDedupeKey(input: EnqueueEmailInput): string {
  const parts = [
    input.kind,
    input.relatedType ?? "-",
    input.relatedId ?? "-",
    input.userId ?? input.toEmail ?? input.teamId ?? "-",
  ];
  return parts.join(":");
}

/**
 * Queues an email in the notification outbox. The worker
 * (`scripts/jobs/notifications.ts`) claims due rows, re-checks suppression and
 * marketing consent, then sends. Suppression and consent are enforced at send
 * time, not enqueue time.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<EnqueueEmailResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("email_enqueue", {
    p_dedupe_key: input.dedupeKey ?? defaultDedupeKey(input),
    p_kind: input.kind,
    p_stream: input.stream ?? "transactional",
    p_user_id: input.userId ?? null,
    p_to_email: input.toEmail ?? null,
    p_team_id: input.teamId ?? null,
    p_related_type: input.relatedType ?? null,
    p_related_id: input.relatedId ?? null,
    p_payload: input.payload,
    p_scheduled_for: input.scheduledFor ?? new Date().toISOString(),
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) {
    console.error(`[email] enqueue failed for ${input.kind}:`, error.message);
    return { ok: false, id: null, deduped: false };
  }
  if (data === null || data === undefined) {
    return { ok: true, id: null, deduped: true };
  }
  return { ok: true, id: String(data), deduped: false };
}
