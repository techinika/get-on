import { staffCan, type StaffRole } from "@get-on/permissions";
import { teamNoticeEmail } from "@get-on/email";
import { createAdminClient } from "@/lib/supabase/admin";
import env from "@/lib/env";
import {
  approvalAmount,
  approvalKindLabel,
  approvalTarget,
} from "@/lib/admin/approval-summary";
import type { ApprovalRequest } from "@/lib/admin/approvals";

type AdminClient = ReturnType<typeof createAdminClient>;

type StaffRow = {
  user_id: string;
  role: StaffRole;
};

type Identity = {
  name: string;
  email: string | null;
};

function baseUrl(): string {
  return (env.siteUrl || env.appOrigin || "https://get-on.tech").replace(/\/$/, "");
}

function approvalUrl(requestId: string): string {
  return `${baseUrl()}/admin/approvals/${requestId}`;
}

function dateTime(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(parsed)} UTC`;
}

async function loadRequest(
  admin: AdminClient,
  requestId: string,
): Promise<ApprovalRequest | null> {
  const { data } = await admin
    .from("approval_requests")
    .select(
      "id, kind, target_type, target_id, requested_by, requested_at, reason, payload, status, requires_second, single_operator, expires_at, state_hash, first_approved_by, first_approved_at, decided_by, decided_at, decision_reason, executed_at, execution_error",
    )
    .eq("id", requestId)
    .maybeSingle();
  return (data as ApprovalRequest | null) ?? null;
}

async function identity(admin: AdminClient, userId: string): Promise<Identity> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const user = data.user;
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    user?.email ||
    "A staff member";
  return { name, email: user?.email?.trim().toLowerCase() || null };
}

async function approvers(
  admin: AdminClient,
  permission: string,
): Promise<StaffRow[]> {
  const { data } = await admin
    .from("platform_staff")
    .select("user_id, role")
    .eq("status", "active");
  return ((data ?? []) as StaffRow[]).filter((row) =>
    staffCan(row.role, permission as Parameters<typeof staffCan>[1]),
  );
}

async function enqueue(
  admin: AdminClient,
  input: {
    requestId: string;
    recipientId: string;
    kind: "approval_requested" | "approval_decided" | "approval_expired";
    dedupe: string;
    mail: { subject: string; html: string; text: string };
    expiresAt?: string | null;
  },
): Promise<void> {
  const { error } = await admin.rpc("email_enqueue", {
    p_dedupe_key: input.dedupe,
    p_kind: input.kind,
    p_stream: "transactional",
    p_user_id: input.recipientId,
    p_to_email: null,
    p_team_id: null,
    p_related_type: "approval",
    p_related_id: input.requestId,
    p_payload: {
      subject: input.mail.subject,
      html: input.mail.html,
      text: input.mail.text,
      replyTo: env.teamEmail,
    },
    p_scheduled_for: new Date().toISOString(),
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) {
    console.error("[approvals] could not queue email", error.message);
  }
}

function details(request: ApprovalRequest): Array<{ label: string; value: string }> {
  const rows = [
    { label: "Action", value: approvalKindLabel(request.kind) },
    { label: "Target", value: approvalTarget(request) },
  ];
  const amount = approvalAmount(request);
  if (amount !== "—") rows.push({ label: "Amount or impact", value: amount });
  return rows;
}

async function notifyApprovers(
  admin: AdminClient,
  request: ApprovalRequest,
  permission: string,
  exclude: string[],
  copy: (firstApprover: string | null) => {
    subject: string;
    intro: string;
    details: Array<{ label: string; value: string }>;
    footer: string;
  },
): Promise<void> {
  const recipients = (await approvers(admin, permission)).filter(
    (row) => !exclude.includes(row.user_id),
  );
  if (recipients.length === 0) return;

  let firstApprover: string | null = null;
  if (request.first_approved_by) {
    firstApprover = (await identity(admin, request.first_approved_by)).name;
  }

  const content = copy(firstApprover);
  const mail = teamNoticeEmail({
    title: content.subject,
    intro: content.intro,
    details: content.details,
    actionUrl: approvalUrl(request.id),
    actionLabel: "Open approvals",
    footer: content.footer,
  });

  for (const recipient of recipients) {
    await enqueue(admin, {
      requestId: request.id,
      recipientId: recipient.user_id,
      kind:
        request.status === "pending" && request.first_approved_by
          ? "approval_decided"
          : "approval_requested",
      dedupe: `approval:${request.id}:${request.status}:${recipient.user_id}`,
      mail,
      expiresAt: request.expires_at,
    });
  }
}

export async function queueApprovalRequested(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request || request.status !== "pending") return;

    const { data: policy } = await admin
      .from("approval_policies")
      .select("approve_permission")
      .eq("kind", request.kind)
      .maybeSingle();
    const permission = String(policy?.approve_permission ?? "staff.manage");
    const requester = await identity(admin, request.requested_by);

    await notifyApprovers(admin, request, permission, [request.requested_by], () => ({
      subject: `Approval needed: ${approvalKindLabel(request.kind)}`,
      intro: `${requester.name} asked for approval. Open the staff console to review it.`,
      details: [
        ...details(request),
        { label: "Requested by", value: requester.name },
        { label: "Expires", value: dateTime(request.expires_at) },
      ],
      footer: "You receive this because you can approve this kind of change.",
    }));
  } catch (error) {
    console.error("[approvals] requested email failed", error);
  }
}

export async function queueApprovalOutcome(requestId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const request = await loadRequest(admin, requestId);
    if (!request) return;

    if (request.status === "pending" && request.first_approved_by) {
      const { data: policy } = await admin
        .from("approval_policies")
        .select("approve_permission")
        .eq("kind", request.kind)
        .maybeSingle();
      const permission = String(policy?.approve_permission ?? "staff.manage");

      await notifyApprovers(
        admin,
        request,
        permission,
        [request.requested_by, request.first_approved_by],
        (firstApprover) => ({
          subject: `Second approval needed: ${approvalKindLabel(request.kind)}`,
          intro: "A first approval was given. This request needs one more Super admin before it can run.",
          details: [
            ...details(request),
            { label: "First approved by", value: firstApprover ?? "A Super admin" },
            { label: "Expires", value: dateTime(request.expires_at) },
          ],
          footer: "You receive this because you can give the second approval.",
        }),
      );
      return;
    }

    if (!["approved", "rejected", "executed", "failed", "expired"].includes(request.status)) {
      return;
    }

    const requesterId = request.requested_by;
    const copy =
      request.status === "executed"
        ? {
            subject: `Approved and done: ${approvalKindLabel(request.kind)}`,
            intro: "Your request was approved and the action finished.",
            kind: "approval_decided" as const,
          }
        : request.status === "failed"
          ? {
              subject: `Approved, but not finished: ${approvalKindLabel(request.kind)}`,
              intro: "Your request was approved, but the action could not finish. Open it to see what to do next.",
              kind: "approval_decided" as const,
            }
          : request.status === "rejected"
            ? request.decision_reason?.startsWith("Changes requested:")
              ? {
                  subject: `Changes requested: ${approvalKindLabel(request.kind)}`,
                  intro: request.decision_reason.replace("Changes requested:", "A Super admin asked for a change:"),
                  kind: "approval_decided" as const,
                }
              : {
                  subject: `Request rejected: ${approvalKindLabel(request.kind)}`,
                  intro: request.decision_reason
                    ? `Your request was rejected: ${request.decision_reason}`
                    : "Your request was rejected. Open it to see the decision.",
                  kind: "approval_decided" as const,
                }
            : request.status === "expired"
              ? {
                  subject: `Request expired: ${approvalKindLabel(request.kind)}`,
                  intro: "This request expired before it was fully approved. Ask again if it is still needed.",
                  kind: "approval_expired" as const,
                }
              : {
                  subject: `Request approved: ${approvalKindLabel(request.kind)}`,
                  intro: "Your request was approved and is ready to run.",
                  kind: "approval_decided" as const,
                };

    const mail = teamNoticeEmail({
      title: copy.subject,
      intro: copy.intro,
      details: details(request),
      actionUrl: approvalUrl(request.id),
      actionLabel: "Open request",
      footer: "You receive this because you made the request.",
    });

    await enqueue(admin, {
      requestId: request.id,
      recipientId: requesterId,
      kind: copy.kind,
      dedupe: `approval:${request.id}:${request.status}:${requesterId}`,
      mail,
    });
  } catch (error) {
    console.error("[approvals] outcome email failed", error);
  }
}
