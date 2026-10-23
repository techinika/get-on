"use server";

import { headers } from "next/headers";
import { abuseReportAlertEmail } from "@get-on/email";
import { sendEmail } from "@/lib/email/send";
import { hashIp, verifyTimeToken } from "@/lib/spam";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSiteName, reportSchema, REPORT_REASON_LABELS } from "@/lib/report";

export type ReportResult =
  | { ok: true }
  | {
      ok: false;
      code: "VALIDATION" | "INVALID_SITE" | "RATE_LIMIT" | "SERVER";
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
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  if (!response.ok) return false;
  const result = (await response.json().catch(() => null)) as { success?: boolean } | null;
  return result?.success === true;
}

export async function submitReport(form: FormData): Promise<ReportResult> {
  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerList.get("x-real-ip")?.trim() ??
    "";

  if (text(form, "company").trim() !== "") {
    return { ok: true };
  }

  if (verifyTimeToken(text(form, "formToken")) !== "ok") {
    return { ok: false, code: "SERVER" };
  }

  if (process.env.TURNSTILE_SECRET_KEY) {
    const valid = await verifyTurnstile(text(form, "turnstileToken"), ip);
    if (!valid) return { ok: false, code: "SERVER" };
  }

  const parsed = reportSchema.safeParse({
    site: text(form, "site"),
    reason: text(form, "reason"),
    details: text(form, "details"),
    email: text(form, "email"),
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

  const siteName = normalizeSiteName(parsed.data.site);
  if (!siteName) return { ok: false, code: "INVALID_SITE" };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("[report] service role client unavailable", error);
    return { ok: false, code: "SERVER" };
  }

  const { data: project } = await admin
    .from("projects")
    .select("id, name, subdomain")
    .eq("subdomain", siteName)
    .maybeSingle();

  if (!project) return { ok: false, code: "INVALID_SITE" };

  const ipHash = hashIp(ip);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recent } = await admin
    .from("abuse_reports")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  if ((recent ?? 0) >= 3) {
    return { ok: false, code: "RATE_LIMIT" };
  }

  const { error: insertError } = await admin.from("abuse_reports").insert({
    project_id: project.id,
    site_name: String(project.subdomain),
    reason: parsed.data.reason,
    details: parsed.data.details || null,
    reporter_email: parsed.data.email || null,
    ip_hash: ipHash,
  });

  if (insertError) {
    console.error("[report] could not store report", insertError);
    return { ok: false, code: "SERVER" };
  }

  const { data: dayReports } = await admin
    .from("abuse_reports")
    .select("ip_hash")
    .eq("project_id", project.id)
    .gte("created_at", oneDayAgo);

  const distinctReporters = new Set((dayReports ?? []).map((row) => row.ip_hash));

  if (distinctReporters.size >= 3) {
    const { data: openFlag } = await admin
      .from("site_flags")
      .select("id")
      .eq("project_id", project.id)
      .eq("kind", "report")
      .is("resolved_at", null)
      .maybeSingle();

    if (!openFlag) {
      const { error: flagError } = await admin.from("site_flags").insert({
        project_id: project.id,
        kind: "report",
        reason: "3 or more reports from different people in 24 hours",
      });
      if (flagError) console.error("[report] could not add site flag", flagError);
    }

    const { error: reviewError } = await admin
      .from("projects")
      .update({ review_state: "pending", review_requested_at: new Date().toISOString() })
      .eq("id", project.id);
    if (reviewError) console.error("[report] could not mark project for review", reviewError);
  }

  const abuseEmail = process.env.TEAM_EMAIL ?? process.env.ABUSE_EMAIL ?? "team@get-on.tech";
  const alert = abuseReportAlertEmail({
    site: `${project.subdomain}.get-on.tech`,
    reason: REPORT_REASON_LABELS[parsed.data.reason] ?? parsed.data.reason,
    fields: [
      { label: "Website", value: `${project.subdomain}.get-on.tech` },
      { label: "Reason", value: REPORT_REASON_LABELS[parsed.data.reason] ?? parsed.data.reason },
      { label: "Details", value: parsed.data.details || "Not given" },
      { label: "Reporter email", value: parsed.data.email || "Not given" },
      { label: "Reports from different people in 24 hours", value: String(distinctReporters.size) },
    ],
  });
  await sendEmail({
    to: abuseEmail,
    replyTo: parsed.data.email || undefined,
    fromName: "Get-On",
    kind: "abuse_report_alert",
    subject: alert.subject,
    text: alert.text,
    html: alert.html,
  });

  return { ok: true };
}
