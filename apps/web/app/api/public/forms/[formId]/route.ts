import { after, NextResponse } from "next/server";
import { parseHost, sha256Hex, verifyFormToken, verifyWorkerRequest } from "@get-on/site-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPublishConfig } from "@/lib/publishing/config";
import { hashIp } from "@/lib/spam";
import { normalizeSubmissionFields, type ContactFormConfig } from "@/lib/contact/validation";
import { isDuplicate, checkSubmissionRate } from "@/lib/contact/rate-limit";
import { scoreSubmission, SPAM_THRESHOLD } from "@/lib/contact/spam";
import { notifyNewMessage } from "@/lib/contact/notify";
import type { PlanId } from "@/lib/plans";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORM_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;
const MAX_BODY = 16 * 1024;

type SubmissionResult =
  | "stored"
  | "stored_spam"
  | "stored_duplicate"
  | "honeypot_dropped"
  | "rate_limited"
  | "invalid"
  | "closed"
  | "not_found"
  | "unauthorised"
  | "error";

async function logSubmission(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    projectId: string;
    formId: string;
    result: SubmissionResult;
    reason?: string;
    spamScore?: number;
    durationMs?: number;
    hostKind?: string;
  },
): Promise<void> {
  const started = input.durationMs ?? 0;
  await admin.from("form_submission_log").insert({
    project_id: input.projectId,
    form_id: input.formId,
    result: input.result,
    reason: input.reason ?? null,
    spam_score: input.spamScore ?? 0,
    duration_ms: started,
    host_kind: input.hostKind ?? null,
    trace_id: randomUUID(),
  });
}

function json(status: number, body: Record<string, unknown> = { ok: false }) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function readString(body: URLSearchParams, key: string): string {
  return body.get(key) ?? "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ formId: string }> },
) {
  const startedAt = Date.now();
  const { formId } = await context.params;
  if (!FORM_ID_RE.test(formId)) {
    await logSubmission(createAdminClient(), {
      projectId: "",
      formId,
      result: "not_found",
      reason: "bad_form_id",
      durationMs: Date.now() - startedAt,
    });
    return json(404);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    await logSubmission(createAdminClient(), {
      projectId: "",
      formId,
      result: "error",
      reason: "unsupported_content_type",
      durationMs: Date.now() - startedAt,
    });
    return json(415);
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY) {
    return json(413);
  }

  const body = new URLSearchParams(rawBody);
  const host = request.headers.get("x-gs-host") ?? "";
  const ip = request.headers.get("x-gs-ip") ?? "";
  const ua = (request.headers.get("x-gs-ua") ?? "").slice(0, 200);
  const ts = request.headers.get("x-gs-ts") ?? "";
  const sig = request.headers.get("x-gs-sig") ?? "";
  const secret = process.env.WORKER_SHARED_SECRET ?? "";
  const bodyHash = await sha256Hex(rawBody);
  const signatureOk =
    Boolean(secret) &&
    (await verifyWorkerRequest(secret, { ts, host, ip, bodyHash, sig }));
  if (!signatureOk) {
    await logSubmission(createAdminClient(), {
      projectId: "",
      formId,
      result: "unauthorised",
      reason: "bad_worker_signature",
      durationMs: Date.now() - startedAt,
      hostKind: host ? "custom" : "free",
    });
    return json(401);
  }

  const admin = createAdminClient();
  const config = readPublishConfig();
  const parsedHost =
    parseHost(host, config.rootDomain) ??
    parseHost(host, config.localRootDomain);
  if (!parsedHost.ok) {
    await logSubmission(createAdminClient(), {
      projectId: "",
      formId,
      result: "not_found",
      reason: "unknown_host",
      durationMs: Date.now() - startedAt,
      hostKind: host ? "custom" : "free",
    });
    return json(404);
  }

  let projectQuery = admin
    .from("projects")
    .select("id, name, subdomain, primary_host, status, suspended_at, review_state, team_id");

  if (parsedHost.custom) {
    const { data: address } = await admin
      .from("domain_hostnames")
      .select("project_id, domain_id, status")
      .eq("hostname", parsedHost.hostname)
      .eq("status", "live")
      .maybeSingle();
    if (!address?.project_id) return json(404);
    const { data: domain } = await admin
      .from("domains")
      .select("status")
      .eq("id", address.domain_id)
      .maybeSingle();
    if (!domain || !["live", "attention"].includes(String(domain.status))) {
      return json(404);
    }
    projectQuery = projectQuery.eq("id", address.project_id);
  } else {
    projectQuery = projectQuery.eq("subdomain", parsedHost.name);
  }

  const { data: project } = await projectQuery.maybeSingle();

  if (
    !project ||
    project.status !== "published" ||
    project.suspended_at ||
    project.review_state === "pending"
  ) {
    await logSubmission(createAdminClient(), {
      projectId: "",
      formId,
      result: "not_found",
      reason: "project_not_published",
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    return json(404);
  }

  const [{ data: install }, { data: access }, { data: live }] = await Promise.all([
    admin
      .from("plugin_installs")
      .select("state")
      .eq("project_id", project.id)
      .eq("plugin_id", "contact")
      .maybeSingle(),
    admin.rpc("billing_resolve_team", { p_team: project.team_id }),
    admin
      .from("publishes")
      .select("forms")
      .eq("project_id", project.id)
      .eq("status", "live")
      .maybeSingle(),
  ]);

  if (install?.state !== "active") {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "closed",
      reason: "contact_plugin_inactive",
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    return json(404);
  }

  const forms = Array.isArray(live?.forms) ? live.forms : [];
  const formConfig = forms.find(
    (entry: { id?: string }) => entry && String(entry.id) === formId,
  ) as ContactFormConfig | undefined;
  if (!formConfig) {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "closed",
      reason: "form_not_in_live_publish",
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    return json(404);
  }

  const configForForm: ContactFormConfig = {
    id: formId,
    pagePath: String(formConfig.pagePath ?? "/"),
    showName: formConfig.showName !== false,
    showPhone: Boolean(formConfig.showPhone),
    phoneRequired: Boolean(formConfig.phoneRequired) && Boolean(formConfig.showPhone),
  };

  const values: Record<string, string> = {
    name: readString(body, "name"),
    email: readString(body, "email"),
    phone: readString(body, "phone"),
    message: readString(body, "message"),
    _b: readString(body, "_b"),
  };

  // A filled honeypot gets the same answer as a real submission, but is
  // logged as an attempt and never stored as a message.
  if (readString(body, "company_website").trim()) {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "honeypot_dropped",
      reason: "filled_honeypot",
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    return json(200, { ok: true });
  }

  const planId = (((access ?? {}) as { plan_id?: string }).plan_id ?? "free") as PlanId;
  const ipHash = hashIp(ip);

  const secretValue = process.env.FORM_TOKEN_SECRET ?? "";
  const previous = process.env.FORM_TOKEN_SECRET_PREVIOUS;
  const tokenResult = await verifyFormToken(
    [secretValue, ...(previous ? [previous] : [])],
    readString(body, "_t"),
  );

  let spamScore = 0;
  const spamReasons: string[] = [];

  if (
    !tokenResult.ok ||
    tokenResult.payload.s !== project.id ||
    tokenResult.payload.f !== formId
  ) {
    // A tampered or missing token is stored as spam so nothing is silently
    // dropped, but no notification is sent.
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "stored_spam",
      reason: "token_invalid",
      spamScore: SPAM_THRESHOLD,
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    await admin.from("contact_messages").insert({
      project_id: project.id,
      form_id: formId,
      page_path: configForForm.pagePath,
      name: values.name,
      email: values.email,
      phone: values.phone,
      message: values.message,
      status: "spam",
      spam_score: SPAM_THRESHOLD,
      spam_reasons: ["token_invalid"],
      ip_hash: ipHash,
      user_agent: ua || null,
    });
    return json(200, { ok: true });
  }

  const tokenAge = Date.now() - tokenResult.payload.t;
  if (tokenAge < 3000) {
    spamScore += 60;
    spamReasons.push("submitted_too_fast");
  } else if (tokenAge > 24 * 60 * 60 * 1000) {
    spamScore += 30;
    spamReasons.push("old_token");
  }

  const normalized = normalizeSubmissionFields(values, configForForm);
  if (!normalized.ok) {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "invalid",
      reason: "invalid_fields",
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    return json(400);
  }

  const rate = await checkSubmissionRate(admin, {
    projectId: project.id,
    ipHash,
    planId,
  });
  if (!rate.ok) {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "rate_limited",
      reason: rate.code,
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    if (rate.code === "closed") {
      await admin
        .from("projects")
        .update({ form_limit_hit_at: new Date().toISOString() })
        .eq("id", project.id);
    }
    return json(rate.code === "rate" ? 429 : 403);
  }

  const submission = normalized.value;
  const dup = await isDuplicate(admin, {
    projectId: project.id,
    email: submission.email,
    message: submission.message,
  });
  if (dup) {
    // A repeat submitter is stored (flagged duplicate) but no notification
    // email is sent again.
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "stored_duplicate",
      reason: "duplicate_email_message",
      spamScore: 0,
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    await admin.from("contact_messages").insert({
      project_id: project.id,
      form_id: formId,
      page_path: submission.pagePath || configForForm.pagePath || "/",
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
      status: "new",
      duplicate: true,
      spam_score: 0,
      spam_reasons: [],
      ip_hash: ipHash,
      user_agent: ua || null,
    });
    return json(200, { ok: true });
  }

  const scored = scoreSubmission({
    name: submission.name,
    email: submission.email,
    message: submission.message,
  });
  spamScore += scored.score;
  spamReasons.push(...scored.reasons);

  const isSpam = spamScore >= SPAM_THRESHOLD;
  const { data: inserted, error: insertError } = await admin
    .from("contact_messages")
    .insert({
      project_id: project.id,
      form_id: formId,
      page_path: submission.pagePath || configForForm.pagePath || "/",
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
      status: isSpam ? "spam" : "new",
      spam_score: spamScore,
      spam_reasons: spamReasons,
      ip_hash: ipHash,
      user_agent: ua || null,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    await logSubmission(createAdminClient(), {
      projectId: project.id,
      formId,
      result: "error",
      reason: String(insertError?.message ?? "insert_failed"),
      durationMs: Date.now() - startedAt,
      hostKind: parsedHost.custom ? "custom" : "free",
    });
    console.error("[contact] could not store message", insertError);
    return json(500);
  }

  await logSubmission(createAdminClient(), {
    projectId: project.id,
    formId,
    result: isSpam ? "stored_spam" : "stored",
    reason: isSpam ? "spam_threshold" : undefined,
    spamScore,
    durationMs: Date.now() - startedAt,
    hostKind: parsedHost.custom ? "custom" : "free",
  });

  if (!isSpam) {
    const messageForNotify = {
      id: String(inserted.id),
      projectId: project.id,
      projectName: project.name,
      subdomain: project.subdomain,
      primaryHost:
        typeof project.primary_host === "string" ? project.primary_host : null,
      teamId: project.team_id,
      planId,
      name: submission.name,
      email: submission.email,
      phone: submission.phone,
      message: submission.message,
      pagePath: submission.pagePath || configForForm.pagePath,
      status: "new",
    };
    after(() => notifyNewMessage(admin, messageForNotify));
  }

  return json(200, { ok: true });
}
