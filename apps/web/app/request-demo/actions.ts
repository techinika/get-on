"use server";

import { headers } from "next/headers";
import { demoRequestSchema, RATE_LIMIT_PER_DAY, RATE_LIMIT_PER_HOUR } from "@/lib/demo-request";
import { demoRequestAckEmail, demoRequestAlertEmail } from "@get-on/email";
import { sendEmail } from "@/lib/email/send";
import { hashIp, verifyTimeToken } from "@/lib/spam";
import { createAdminClient } from "@/lib/supabase/admin";
import env from "@/lib/env";

export type DemoRequestResult =
  | { ok: true }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMIT" | "SERVER";
      fieldErrors?: Record<string, string>;
    };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  if (!response.ok) return false;
  const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
  return result?.success === true;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName.trim();
}

/** Stores a demo request and emails the team and the requester. */
export async function submitDemoRequest(form: FormData): Promise<DemoRequestResult> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip")?.trim() ??
    "";
  const userAgent = headerList.get("user-agent") ?? "";

  // Spam bots fill the hidden field. Pretend everything worked.
  if (text(form, "website").trim() !== "") {
    return { ok: true };
  }

  const tokenState = verifyTimeToken(text(form, "formToken"));
  if (tokenState !== "ok") {
    return { ok: false, code: "SERVER" };
  }

  const turnstileToken = text(form, "turnstileToken");
  if (process.env.TURNSTILE_SECRET_KEY) {
    const valid = await verifyTurnstile(turnstileToken, ip);
    if (!valid) {
      return { ok: false, code: "SERVER" };
    }
  }

  const parsed = demoRequestSchema.safeParse({
    fullName: text(form, "fullName"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    businessName: text(form, "businessName"),
    businessType: text(form, "businessType"),
    websitesNeeded: text(form, "websitesNeeded"),
    meetingMethod: text(form, "meetingMethod"),
    preferredTime: text(form, "preferredTime"),
    timezone: text(form, "timezone"),
    message: text(form, "message"),
    consent: text(form, "consent") === "true" || form.get("consent") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { ok: false, code: "VALIDATION", fieldErrors };
  }

  const input = parsed.data;
  const ipHash = hashIp(ip);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[demo-request] service role client unavailable", error);
    return { ok: false, code: "SERVER" };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: ipCount }, { count: emailCount }] = await Promise.all([
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", oneHourAgo),
    admin
      .from("demo_requests")
      .select("id", { count: "exact", head: true })
      .eq("email", input.email)
      .gte("created_at", oneDayAgo),
  ]);

  if ((ipCount ?? 0) >= RATE_LIMIT_PER_HOUR || (emailCount ?? 0) >= RATE_LIMIT_PER_DAY) {
    return { ok: false, code: "RATE_LIMIT" };
  }

  const { error: insertError } = await admin.from("demo_requests").insert({
    full_name: input.fullName,
    email: input.email,
    phone: input.phone ?? null,
    business_name: input.businessName,
    business_type: input.businessType ?? null,
    websites_needed: input.websitesNeeded,
    meeting_method: input.meetingMethod,
    preferred_time: input.preferredTime,
    timezone: input.timezone ?? null,
    message: input.message ?? null,
    interest: text(form, "interest").trim() || null,
    consent: true,
    source_page: text(form, "sourcePage").trim() || null,
    ip_hash: ipHash,
    user_agent: userAgent.slice(0, 400),
  });

  if (insertError) {
    console.error("[demo-request] could not store request", insertError);
    return { ok: false, code: "SERVER" };
  }

  const supportEmail = env.supportEmail;
  const rows = [
    { label: "Name", value: input.fullName },
    { label: "Email", value: input.email },
    { label: "Phone or WhatsApp", value: input.phone || "Not given" },
    { label: "Business", value: input.businessName },
    { label: "Type of business", value: input.businessType || "Not given" },
    { label: "Websites needed", value: input.websitesNeeded },
    { label: "Meeting", value: input.meetingMethod },
    { label: "Best time", value: input.preferredTime },
    { label: "Time zone", value: input.timezone || "Not given" },
    { label: "Message", value: input.message || "Not given" },
    { label: "Interest", value: text(form, "interest").trim() || "Not given" },
  ];

  const alert = demoRequestAlertEmail({ businessName: input.businessName, fields: rows });
  await sendEmail({
    to: supportEmail,
    replyTo: input.email,
    fromName: "Get-On",
    kind: "demo_request_alert",
    subject: alert.subject,
    text: alert.text,
    html: alert.html,
  });

  const ack = demoRequestAckEmail({ firstName: firstName(input.fullName), email: input.email });
  await sendEmail({
    to: input.email,
    replyTo: supportEmail,
    fromName: "Get-On",
    kind: "demo_request_ack",
    subject: ack.subject,
    text: `${ack.text}\n\nYou asked us to contact you, so we will only use your details to arrange your demo. Read our Privacy Policy: ${env.siteUrl}/privacy`,
    html: ack.html,
  });

  return { ok: true };
}
