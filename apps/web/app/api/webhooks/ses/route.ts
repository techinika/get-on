import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { topicMatches, verifySnsEnvelope, type SnsEnvelope } from "@/lib/email/sns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SesEvent = {
  eventType?: string;
  notificationType?: string;
  mail?: { messageId?: string; destination?: string[] };
  delivery?: { recipients?: string[] };
  bounce?: {
    bounceType?: string;
    bouncedRecipients?: Array<{ emailAddress?: string }>;
  };
  complaint?: {
    complainedRecipients?: Array<{ emailAddress?: string }>;
  };
  reject?: { reason?: string };
};

function emailsOf(event: SesEvent): string[] {
  const list = [
    ...(event.bounce?.bouncedRecipients ?? []).map((item) => item.emailAddress),
    ...(event.complaint?.complainedRecipients ?? []).map((item) => item.emailAddress),
    ...(event.delivery?.recipients ?? []),
    ...(event.mail?.destination ?? []),
  ];
  return [...new Set(list.filter((email): email is string => Boolean(email)).map((email) => email.toLowerCase()))];
}

export async function POST(request: Request) {
  let envelope: SnsEnvelope;
  try {
    envelope = (await request.json()) as SnsEnvelope;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!envelope?.Type || !envelope?.Message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const valid = await verifySnsEnvelope(envelope);
  if (!valid || !topicMatches(envelope)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (envelope.Type === "SubscriptionConfirmation") {
    const confirmUrl = envelope.SubscribeURL ? new URL(envelope.SubscribeURL) : null;
    if (confirmUrl && confirmUrl.protocol === "https:" && /(^|\.)amazonaws\.com$/i.test(confirmUrl.hostname)) {
      await fetch(confirmUrl, { cache: "no-store" }).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  }

  if (envelope.Type !== "Notification") {
    return NextResponse.json({ ok: true });
  }

  let event: SesEvent;
  try {
    event = JSON.parse(envelope.Message) as SesEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rawType = (event.eventType ?? event.notificationType ?? "").toLowerCase();
  const type =
    rawType === "delivery"
      ? "delivery"
      : rawType === "bounce"
        ? "bounce"
        : rawType === "complaint"
          ? "complaint"
          : rawType === "reject"
            ? "reject"
            : "other";

  const messageId = event.mail?.messageId;
  if (!messageId) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const emails = emailsOf(event);
  await admin.from("email_events").upsert(
    {
      ses_message_id: messageId,
      type,
      email: emails[0] ?? null,
      detail: event,
    },
    { onConflict: "ses_message_id,type", ignoreDuplicates: true },
  );

  if (type === "bounce" || type === "complaint") {
    const permanent =
      type === "complaint" || (event.bounce?.bounceType ?? "Permanent") === "Permanent";
    if (permanent) {
      for (const email of emails) {
        await admin.from("email_suppressions").upsert(
          {
            email,
            reason: type === "complaint" ? "complaint" : "bounce",
            detail: JSON.stringify(event).slice(0, 1000),
          },
          { onConflict: "email", ignoreDuplicates: true },
        );
      }
      await admin.from("email_log").update({ status: "failed" }).eq("ses_message_id", messageId);
    }
  }

  return NextResponse.json({ ok: true });
}
