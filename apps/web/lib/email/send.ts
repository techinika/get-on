import { describeEmailKind, getSender, safeHeader, type EmailStream } from "@get-on/email";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailKind =
  | "contact_notification"
  | "contact_digest"
  | "recipient_verification"
  | "contact_autoreply"
  | "demo_request_alert"
  | "demo_request_ack"
  | "abuse_report_alert"
  | "admin_alert"
  | "team_invite"
  | "team_invite_reminder"
  | "member_removed"
  | "member_role_changed"
  | "team_ownership_transferred"
  | "seats_paused"
  | "invite_accepted"
  | "invite_declined"
  | "referral_reward"
  | "website_transfer"
  | "billing_receipt"
  | "billing_payment_failed"
  | "billing_renewal_reminder"
  | "billing_grace_started"
  | "billing_lapsed"
  | "billing_debt_reminder"
  | "billing_invoice_expired"
  | "billing_refund"
  | "billing_grant"
  | "auth";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  kind: EmailKind | string;
  stream?: EmailStream;
  /** @deprecated Sender names come from the stream. */
  fromName?: string;
  /** @deprecated Sender addresses come from the stream. */
  from?: string;
  relatedType?: string;
  relatedId?: string;
};

export type SendEmailResult = {
  status: "sent" | "queued" | "failed" | "suppressed";
  logId: string | null;
  messageId: string | null;
};

const CRITICAL_KINDS = new Set([
  "auth",
  "recipient_verification",
  "admin_alert",
  "team_invite",
  "team_invite_reminder",
  "member_removed",
  "member_role_changed",
  "team_ownership_transferred",
  "seats_paused",
  "invite_accepted",
  "invite_declined",
  "referral_reward",
  "website_transfer",
  "billing_receipt",
  "billing_payment_failed",
  "billing_renewal_reminder",
  "billing_grace_started",
  "billing_lapsed",
  "billing_refund",
]);
const RETRY_MINUTES = [1, 5, 30, 60];
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 8000;

type AdminClient = ReturnType<typeof createAdminClient>;

export function adminOrNull(): AdminClient | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isTransient(error: unknown): boolean {
  const value = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  const status = value?.$metadata?.httpStatusCode ?? 0;
  if (status >= 500) return true;
  if (value?.name === "ThrottlingException" || value?.name === "TooManyRequestsException") {
    return true;
  }
  if (value?.name === "TimeoutError" || value?.name === "AbortError") return true;
  const message = String((error as { message?: string })?.message ?? "");
  return /timeout|throttl|temporar|network|ECONN|ETIMEDOUT/i.test(message);
}

export async function isSuppressed(admin: AdminClient, email: string): Promise<boolean> {
  const { data } = await admin
    .from("email_suppressions")
    .select("email")
    .eq("email", normaliseEmail(email))
    .maybeSingle();
  return Boolean(data);
}

async function sentTodayCount(admin: AdminClient): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since.toISOString());
  return count ?? 0;
}

async function overDailyGuard(admin: AdminClient, kind: string): Promise<boolean> {
  const limit = Number(process.env.SES_DAILY_LIMIT ?? "");
  if (!Number.isFinite(limit) || limit <= 0) return false;
  if (CRITICAL_KINDS.has(kind)) return false;
  return (await sentTodayCount(admin)) >= Math.floor(limit * 0.9);
}

export async function sendWithTimeout(message: Parameters<ReturnType<typeof getSender>["send"]>[0]) {
  return Promise.race([
    getSender().send(message),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Email timeout")), TIMEOUT_MS),
    ),
  ]);
}

export function nextAttempt(attempts: number): string {
  const minutes = RETRY_MINUTES[Math.min(Math.max(attempts - 1, 0), RETRY_MINUTES.length - 1)] ?? 60;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

/**
 * The only entry point for platform email. It checks suppression, writes an
 * email_log row, then tries to send immediately. A temporary failure stays
 * queued for `pnpm job:email`.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = normaliseEmail(input.to);
  const subject = safeHeader(input.subject, 180);
  const stream = input.stream ?? describeEmailKind(input.kind).stream;
  const message = { ...input, to, subject, stream };
  const admin = adminOrNull();
  if (!admin) {
    try {
      const result = await sendWithTimeout(message);
      return { status: "sent", logId: null, messageId: result.id };
    } catch (error) {
      console.error("[email] send failed", error);
      return { status: "failed", logId: null, messageId: null };
    }
  }

  if (await isSuppressed(admin, to)) {
    const { data } = await admin
      .from("email_log")
      .insert({
        kind: input.kind,
        to_email: to,
        subject,
        status: "suppressed",
        attempts: 1,
        payload: input,
        related_type: input.relatedType ?? null,
        related_id: input.relatedId ?? null,
      })
      .select("id")
      .maybeSingle();
    return { status: "suppressed", logId: data?.id ? String(data.id) : null, messageId: null };
  }

  const guarded = await overDailyGuard(admin, input.kind);
  const { data: row, error: insertError } = await admin
    .from("email_log")
    .insert({
      kind: input.kind,
      to_email: to,
      subject,
      status: "queued",
      attempts: guarded ? 0 : 1,
      next_attempt_at: guarded ? new Date().toISOString() : null,
      payload: message,
      related_type: input.relatedType ?? null,
      related_id: input.relatedId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !row) {
    console.error("[email] could not write log", insertError);
    return { status: "failed", logId: null, messageId: null };
  }

  const logId = String(row.id);
  if (guarded) {
    return { status: "queued", logId, messageId: null };
  }

  try {
    const result = await sendWithTimeout(message);
    await admin
      .from("email_log")
      .update({
        status: "sent",
        ses_message_id: result.id,
        sent_at: new Date().toISOString(),
        next_attempt_at: null,
        error: null,
      })
      .eq("id", logId);
    return { status: "sent", logId, messageId: result.id };
  } catch (error) {
    const transient = isTransient(error);
    await admin
      .from("email_log")
      .update({
        status: transient ? "queued" : "failed",
        attempts: 1,
        next_attempt_at: transient ? nextAttempt(1) : null,
        error: String((error as { message?: string })?.message ?? error).slice(0, 500),
      })
      .eq("id", logId);
    return { status: transient ? "queued" : "failed", logId, messageId: null };
  }
}

/** Sends emails that were queued, with backoff and a hard attempt limit. */
export async function processEmailQueue(limit = 50): Promise<{ processed: number; sent: number }> {
  const admin = adminOrNull();
  if (!admin) return { processed: 0, sent: 0 };
  const now = new Date().toISOString();
  const { data } = await admin
    .from("email_log")
    .select("id, attempts, payload")
    .eq("status", "queued")
    .lte("next_attempt_at", now)
    .order("created_at", { ascending: true })
    .limit(limit);

  let sent = 0;
  let processed = 0;
  for (const row of data ?? []) {
    processed += 1;
    const payload = (row.payload ?? {}) as SendEmailInput;
    const attempts = Number(row.attempts ?? 0);
    if (attempts >= MAX_ATTEMPTS) {
      await admin.from("email_log").update({ status: "failed" }).eq("id", row.id);
      continue;
    }
    if (await isSuppressed(admin, String(payload.to ?? ""))) {
      await admin.from("email_log").update({ status: "suppressed" }).eq("id", row.id);
      continue;
    }
    try {
      const result = await sendWithTimeout(payload);
      sent += 1;
      await admin
        .from("email_log")
        .update({
          status: "sent",
          attempts: attempts + 1,
          ses_message_id: result.id,
          sent_at: new Date().toISOString(),
          next_attempt_at: null,
          error: null,
        })
        .eq("id", row.id);
    } catch (error) {
      const nextAttempts = attempts + 1;
      const transient = isTransient(error) && nextAttempts < MAX_ATTEMPTS;
      await admin
        .from("email_log")
        .update({
          status: transient ? "queued" : "failed",
          attempts: nextAttempts,
          next_attempt_at: transient ? nextAttempt(nextAttempts) : null,
          error: String((error as { message?: string })?.message ?? error).slice(0, 500),
        })
        .eq("id", row.id);
    }
  }
  return { processed, sent };
}

/** A readable outbox for development and tests. */
export async function readMemoryOutbox() {
  const { memorySender } = await import("@get-on/email");
  return memorySender.messages;
}

