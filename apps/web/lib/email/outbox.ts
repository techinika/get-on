import {
  emailLayout,
  emailKindUsesConsent,
  escapeHtml,
  marketingCampaignEmail,
  type EmailStream,
  type MarketingContent,
} from "@get-on/email";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSuppressed,
  isTransient,
  nextAttempt,
  sendWithTimeout,
} from "@/lib/email/send";

const MAX_ATTEMPTS = 5;

type AdminClient = ReturnType<typeof createAdminClient>;

export type OutboxRow = {
  id: string;
  dedupe_key: string;
  kind: string;
  stream: string;
  user_id: string | null;
  to_email: string | null;
  team_id: string | null;
  related_type: string | null;
  related_id: string | null;
  locale: string;
  payload: Record<string, unknown> | null;
  status: string;
  attempts: number;
  scheduled_for: string;
  next_attempt_at: string | null;
  last_error: string | null;
  ses_message_id: string | null;
  created_at: string;
  sent_at: string | null;
  expires_at: string | null;
};

export type OutboxResult = {
  processed: number;
  sent: number;
  failed: number;
  suppressed: number;
  deferred: number;
};

class PayloadError extends Error {}

function payloadText(payload: Record<string, unknown>, key: string, max: number): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function resolveEmail(admin: AdminClient, row: OutboxRow): Promise<string | null> {
  const direct = row.to_email?.trim().toLowerCase();
  if (direct) return direct;
  if (!row.user_id) return null;
  const { data, error } = await admin.auth.admin.getUserById(row.user_id);
  if (error) return null;
  const email = data.user?.email?.trim().toLowerCase();
  return email || null;
}

async function marketingStatus(admin: AdminClient) {
  const [{ data: settings }, { data: emailSettings }] = await Promise.all([
    admin
      .from("marketing_settings")
      .select("paused,pause_reason,unsubscribe_base,physical_address")
      .eq("id", true)
      .maybeSingle(),
    admin.from("email_settings").select("marketing_paused").eq("id", true).maybeSingle(),
  ]);
  return {
    paused: Boolean(settings?.paused || emailSettings?.marketing_paused),
    pauseReason: String(settings?.pause_reason ?? "Marketing email is paused."),
    unsubscribeBase: String(
      settings?.unsubscribe_base ?? "https://get-on.tech/email/unsubscribe",
    ),
    physicalAddress: settings?.physical_address ? String(settings.physical_address) : null,
  };
}

async function latestMarketingConsent(admin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("email_preferences")
    .select("marketing_opt_in")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.marketing_opt_in) return false;
  const { data: consent } = await admin
    .from("consent_records")
    .select("granted")
    .eq("user_id", userId)
    .eq("kind", "marketing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return consent ? Boolean(consent.granted) : true;
}

async function buildMessage(
  admin: AdminClient,
  row: OutboxRow,
  to: string,
): Promise<{ stream: EmailStream; kind: string; message: Parameters<typeof sendWithTimeout>[0] }> {
  const payload = row.payload ?? {};
  const stream = (row.stream === "system" ? "transactional" : row.stream) as EmailStream;
  const isMarketing =
    stream === "marketing" || emailKindUsesConsent(row.kind) || row.kind === "marketing_campaign";

  if (isMarketing) {
    if (!row.user_id || !(await latestMarketingConsent(admin, row.user_id))) {
      throw new PayloadError("MARKETING_CONSENT_MISSING");
    }
    const settings = await marketingStatus(admin);
    if (settings.paused) throw new PayloadError("MARKETING_PAUSED");
    const { data: pref } = await admin
      .from("email_preferences")
      .select("unsubscribe_token")
      .eq("user_id", row.user_id)
      .maybeSingle();
    if (!pref?.unsubscribe_token) throw new PayloadError("UNSUBSCRIBE_TOKEN_MISSING");
    const unsubscribeUrl = `${settings.unsubscribeBase}?token=${encodeURIComponent(
      String(pref.unsubscribe_token),
    )}`;
    const subject = payloadText(payload, "subject", 60);
    if (!subject) throw new PayloadError("SUBJECT_MISSING");
    const content = (payload.content ?? {}) as MarketingContent;
    const rendered = marketingCampaignEmail({
      subject,
      preheader: payloadText(payload, "preheader", 110),
      content,
      unsubscribeUrl,
      physicalAddress: settings.physicalAddress,
    });
    return {
      stream: "marketing",
      kind: row.kind,
      message: {
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        kind: row.kind,
        stream: "marketing",
        relatedType: row.related_type ?? undefined,
        relatedId: row.related_id ?? undefined,
      },
    };
  }

  const subject = payloadText(payload, "subject", 180);
  if (!subject) throw new PayloadError("SUBJECT_MISSING");
  const replyTo = payloadText(payload, "replyTo", 254) || undefined;
  const html = payloadText(payload, "html", 100_000);
  const text = payloadText(payload, "text", 100_000);
  if (!text) throw new PayloadError("BODY_MISSING");

  if (html) {
    return {
      stream,
      kind: row.kind,
      message: {
        to,
        subject,
        html,
        text,
        replyTo,
        kind: row.kind,
        stream,
        relatedType: row.related_type ?? undefined,
        relatedId: row.related_id ?? undefined,
      },
    };
  }

  const reason = payloadText(payload, "reason", 200);
  const footer = payloadText(payload, "footer", 300);
  return {
    stream,
    kind: row.kind,
    message: {
      to,
      subject,
      html: emailLayout({
        title: subject,
        preheader: payloadText(payload, "preheader", 110) || undefined,
        body: `<p style="margin:0;white-space:pre-wrap;">${escapeHtml(text)}</p>`,
        footer: footer || undefined,
        reason: reason || undefined,
      }),
      text,
      replyTo,
      kind: row.kind,
      stream,
      relatedType: row.related_type ?? undefined,
      relatedId: row.related_id ?? undefined,
    },
  };
}

async function writeLog(
  admin: AdminClient,
  row: OutboxRow,
  input: {
    status: "sent" | "failed" | "queued" | "suppressed";
    to: string | null;
    subject: string;
    attempts: number;
    messageId?: string | null;
    error?: string | null;
  },
) {
  await admin.from("email_log").insert({
    kind: row.kind,
    stream: row.stream,
    to_email: input.to,
    subject: input.subject.slice(0, 180),
    status: input.status,
    attempts: input.attempts,
    ses_message_id: input.messageId ?? null,
    error: input.error ? input.error.slice(0, 500) : null,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
    outbox_id: row.id,
    campaign_id: row.related_type === "campaign" ? row.related_id : null,
    related_type: row.related_type,
    related_id: row.related_id,
    payload:
      row.stream === "marketing"
        ? { campaign_id: row.related_id }
        : { subject: input.subject, kind: row.kind },
  });
}

async function deliverRow(
  admin: AdminClient,
  row: OutboxRow,
  result: OutboxResult,
  marketing: Awaited<ReturnType<typeof marketingStatus>>,
): Promise<void> {
  result.processed += 1;
  const payload = row.payload ?? {};
  const subject = payloadText(payload, "subject", 180) || row.kind;

  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    await admin.rpc("email_mark_failed", { p_id: row.id, p_error: "EXPIRED", p_retry_at: null });
    await writeLog(admin, row, {
      status: "failed",
      to: row.to_email,
      subject,
      attempts: row.attempts,
      error: "EXPIRED",
    });
    result.failed += 1;
    return;
  }

  const isMarketingRow = row.stream === "marketing" || emailKindUsesConsent(row.kind);
  if (isMarketingRow && marketing.paused) {
    const retryAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await admin.rpc("email_defer", { p_id: row.id, p_retry_at: retryAt });
    result.deferred += 1;
    return;
  }

  const to = await resolveEmail(admin, row);
  if (!to) {
    await admin.rpc("email_mark_failed", {
      p_id: row.id,
      p_error: "NO_RECIPIENT",
      p_retry_at: null,
    });
    await writeLog(admin, row, {
      status: "failed",
      to: null,
      subject,
      attempts: row.attempts,
      error: "NO_RECIPIENT",
    });
    result.failed += 1;
    return;
  }

  if (await isSuppressed(admin, to)) {
    await admin.rpc("email_mark_suppressed", { p_id: row.id, p_reason: "SUPPRESSED" });
    await writeLog(admin, row, {
      status: "suppressed",
      to,
      subject,
      attempts: row.attempts,
      error: "SUPPRESSED",
    });
    result.suppressed += 1;
    return;
  }

  let built: Awaited<ReturnType<typeof buildMessage>>;
  try {
    built = await buildMessage(admin, row, to);
  } catch (error) {
    const reason = String((error as { message?: string })?.message ?? error);
    const retry = reason === "MARKETING_PAUSED";
    const retryAt = retry ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null;
    await admin.rpc(retry ? "email_defer" : "email_mark_failed", {
      p_id: row.id,
      ...(retry ? { p_retry_at: retryAt } : { p_error: reason, p_retry_at: null }),
    });
    if (retry) {
      result.deferred += 1;
    } else {
      await writeLog(admin, row, {
        status: "failed",
        to,
        subject,
        attempts: row.attempts,
        error: reason,
      });
      result.failed += 1;
    }
    return;
  }

  try {
    const sent = await sendWithTimeout(built.message);
    await admin.rpc("email_mark_sent", { p_id: row.id, p_ses_message_id: sent.id });
    await writeLog(admin, row, {
      status: "sent",
      to,
      subject: built.message.subject,
      attempts: row.attempts,
      messageId: sent.id,
    });
    result.sent += 1;
  } catch (error) {
    const reason = String((error as { message?: string })?.message ?? error);
    const transient = isTransient(error) && row.attempts < MAX_ATTEMPTS;
    const retryAt = transient ? nextAttempt(row.attempts) : null;
    await admin.rpc("email_mark_failed", {
      p_id: row.id,
      p_error: reason,
      p_retry_at: retryAt,
    });
    await writeLog(admin, row, {
      status: transient ? "queued" : "failed",
      to,
      subject: built.message.subject,
      attempts: row.attempts,
      error: reason,
    });
    if (transient) {
      result.deferred += 1;
    } else {
      result.failed += 1;
    }
  }
}

/**
 * Claims due outbox rows and sends them. Marketing rows are skipped while
 * marketing is paused and consent is re-checked at send time.
 */
export async function processNotificationOutbox(limit = 50): Promise<OutboxResult> {
  const admin = createAdminClient();
  const result: OutboxResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    suppressed: 0,
    deferred: 0,
  };
  const { data, error } = await admin.rpc("email_claim", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return result;
  const marketing = await marketingStatus(admin);
  for (const row of rows) {
    try {
      await deliverRow(admin, row, result, marketing);
    } catch (error) {
      console.error(`[notifications] row ${row.id} failed unexpectedly`, error);
      result.failed += 1;
    }
  }
  return result;
}
