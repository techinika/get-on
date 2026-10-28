import Link from "next/link";
import { notFound } from "next/navigation";
import type { StaffAction } from "@get-on/permissions";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { listStaff } from "@/lib/admin/access";
import {
  getApprovalPolicies,
  getApprovalRequest,
  type ApprovalRequest,
} from "@/lib/admin/approvals";
import {
  approvalAmount,
  approvalHasExecutor,
  approvalKindLabel,
  approvalPayloadLines,
  approvalSummary,
  approvalTarget,
  approvalThreshold,
} from "@/lib/admin/approval-summary";
import { canStaff, requireStaff } from "@/lib/admin/staff";
import { cn } from "@/lib/utils";
import { ApprovalActions } from "./approval-actions";

export const dynamic = "force-dynamic";

function exact(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function statusLabel(request: ApprovalRequest): string {
  switch (request.status) {
    case "pending":
      return request.first_approved_by ? "Waiting for a second Super admin" : "Waiting for a decision";
    case "approved":
      return "Ready to run";
    case "executed":
      return "Done";
    case "failed":
      return "Could not finish";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
  }
}

function hasExpired(value: string): boolean {
  return new Date(value).getTime() <= Date.now();
}

function statusTone(request: ApprovalRequest) {
  if (request.status === "executed") return "live" as const;
  if (request.status === "failed" || request.status === "expired") return "danger" as const;
  if (request.status === "approved") return "primary" as const;
  if (request.status === "pending") return "draft" as const;
  return "neutral" as const;
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const staff = await requireStaff();
  const { requestId } = await params;
  const [request, policies, directory] = await Promise.all([
    getApprovalRequest(requestId),
    getApprovalPolicies(),
    listStaff().catch(() => []),
  ]);
  if (!request) notFound();

  const policy = policies.find((row) => row.kind === request.kind) ?? null;
  const names = new Map(
    (directory as Array<{ user_id?: string; name?: string | null }>).map((member) => [
      String(member.user_id),
      String(member.name ?? "Staff member"),
    ] as const),
  );
  const name = (id: string | null) =>
    !id ? "—" : id === staff.userId ? "You" : names.get(id) ?? "Staff member";

  const expired = hasExpired(request.expires_at);
  const isRequester = request.requested_by === staff.userId;
  const canApprovePolicy =
    policy !== null && canStaff(staff.role, policy.approve_permission as StaffAction);
  const alreadyApproved = request.first_approved_by === staff.userId;
  const canDecide =
    request.status === "pending" &&
    !expired &&
    canApprovePolicy &&
    !isRequester &&
    !alreadyApproved;
  const awaitingSecond =
    request.status === "pending" && request.first_approved_by !== null;
  const canCancel = request.status === "pending" && isRequester;
  const canExecute = request.status === "approved" && staff.role === "super_admin";
  const canRetry = request.status === "failed" && staff.role === "super_admin";
  const supported = approvalHasExecutor(request.kind);
  const payloadLines = approvalPayloadLines(request);

  const timeline = [
    {
      label: "Requested",
      who: name(request.requested_by),
      when: request.requested_at,
      detail: request.reason,
    },
    request.first_approved_by
      ? {
          label: "First approval",
          who: name(request.first_approved_by),
          when: request.first_approved_at,
          detail: request.decision_reason,
        }
      : null,
    request.decided_by
      ? {
          label: request.status === "rejected" ? "Rejected" : "Approved",
          who: name(request.decided_by),
          when: request.decided_at,
          detail: request.decision_reason,
        }
      : null,
    request.executed_at
      ? {
          label: request.status === "failed" ? "Tried to run" : "Ran",
          who: "Staff console",
          when: request.executed_at,
          detail: request.execution_error,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <AppPage width="default">
      <PageHeader
        breadcrumbs={[
          { label: "Approvals", href: "/admin/approvals" },
          { label: approvalKindLabel(request.kind) },
        ]}
        title={approvalKindLabel(request.kind)}
        description={approvalTarget(request)}
        actions={
          <Link
            href="/admin/approvals"
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            Back to approvals
          </Link>
        }
      />

      <AppCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[17px] font-semibold text-text">{approvalSummary(request)}</p>
            <p className="mt-1 text-sm text-text-muted">
              Requested {exact(request.requested_at)} · expires {exact(request.expires_at)}
            </p>
          </div>
          <Badge variant={statusTone(request)}>{statusLabel(request)}</Badge>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 min-[720px]:grid-cols-3">
          <Fact label="Amount or impact" value={approvalAmount(request)} />
          <Fact label="Requester" value={name(request.requested_by)} />
          <Fact
            label="Approver"
            value={
              request.decided_by
                ? name(request.decided_by)
                : request.first_approved_by
                  ? `${name(request.first_approved_by)} (first)`
                  : "Not decided yet"
            }
          />
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-text">Reason</h2>
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-6 text-text-muted">
            {request.reason}
          </p>
        </div>

        {expired && request.status === "pending" ? (
          <p className="mt-5 rounded-card bg-danger-soft p-3 text-sm text-danger-text">
            This request has expired. Ask for a new approval.
          </p>
        ) : null}
        {request.status === "failed" ? (
          <p className="mt-5 rounded-card bg-danger-soft p-3 text-sm text-danger-text">
            {request.execution_error || "We could not finish this action."}
          </p>
        ) : null}
        {!supported ? (
          <p className="mt-5 rounded-card bg-warning-soft p-3 text-sm text-warning-text">
            This kind of request is not connected to the staff console yet. Approving it will not change customer data.
          </p>
        ) : null}

        <div className="mt-6">
          <ApprovalActions
            requestId={request.id}
            canDecide={canDecide}
            canCancel={canCancel}
            canExecute={canExecute}
            canRetry={canRetry}
            awaitingSecond={awaitingSecond}
            requesterOnly={request.status === "pending" && isRequester}
          />
        </div>
      </AppCard>

      <div className="mt-8 grid grid-cols-1 gap-8 min-[900px]:grid-cols-2">
        <Section title="What was approved">
          <AppCard className="p-5">
            {payloadLines.length === 0 ? (
              <p className="text-sm text-text-muted">
                No extra details were recorded for this request.
              </p>
            ) : (
              <dl className="flex flex-col gap-3">
                {payloadLines.map((line) => (
                  <div
                    key={line.label}
                    className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
                  >
                    <dt className="text-sm text-text-muted">{line.label}</dt>
                    <dd className="text-right text-sm font-medium text-text">{line.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </AppCard>
        </Section>

        <Section title="Safety check">
          <AppCard className="p-5">
            <dl className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                <dt className="text-sm text-text-muted">Approval rule</dt>
                <dd className="max-w-[28ch] text-right text-sm font-medium text-text">
                  {approvalThreshold(policy, { singleOperator: request.single_operator })}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
                <dt className="text-sm text-text-muted">Record check</dt>
                <dd className="max-w-[28ch] text-right text-sm font-medium text-text">
                  {request.state_hash
                    ? "Rechecked against live records before any change."
                    : "The action checks the live record before any change."}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-sm text-text-muted">Decision reason</dt>
                <dd className="max-w-[28ch] text-right text-sm text-text">
                  {request.decision_reason || "—"}
                </dd>
              </div>
            </dl>
          </AppCard>
        </Section>
      </div>

      <Section title="Timeline">
        <AppCard className="p-5">
          <ol className="flex flex-col gap-4">
            {timeline.map((item) => (
              <li key={`${item.label}-${item.when}`} className="flex gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    item.label === "Rejected" || item.label === "Tried to run"
                      ? "bg-danger"
                      : "bg-primary",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">
                    {item.label} · {item.who}
                  </p>
                  <p className="text-[13px] text-text-muted">{exact(item.when)}</p>
                  {item.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">
                      {item.detail}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </AppCard>
      </Section>
    </AppPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface-muted p-3">
      <p className="text-label-caps text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text">{value}</p>
    </div>
  );
}
