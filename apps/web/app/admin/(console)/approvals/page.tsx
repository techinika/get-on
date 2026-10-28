import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  getApprovalPolicies,
  listApprovalRequests,
  type ApprovalRequest,
  type ApprovalStatus,
  type ApprovalTab,
} from "@/lib/admin/approvals";
import { listStaff } from "@/lib/admin/access";
import { APPROVAL_REQUEST_KINDS } from "@/lib/admin/approval-request";
import { canStaff } from "@/lib/admin/staff";
import type { StaffAction } from "@get-on/permissions";
import {
  approvalAmount,
  approvalKindLabel,
  approvalTarget,
} from "@/lib/admin/approval-summary";
import { requireStaff } from "@/lib/admin/staff";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS: { id: ApprovalTab; label: string }[] = [
  { id: "waiting", label: "Waiting for me" },
  { id: "mine", label: "My requests" },
  { id: "open", label: "All open" },
  { id: "closed", label: "Closed" },
];

function tabFrom(value: string | undefined): ApprovalTab {
  return TABS.some((tab) => tab.id === value) ? (value as ApprovalTab) : "waiting";
}

function relative(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function expires(value: string): string {
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return `in ${hours} h`;
  return `in ${Math.ceil(hours / 24)} d`;
}

function ageHours(value: string): number {
  return (Date.now() - new Date(value).getTime()) / 3_600_000;
}

function statusLabel(request: ApprovalRequest): string {
  switch (request.status) {
    case "pending":
      return request.first_approved_by ? "Waiting for second" : "Waiting";
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

function statusVariant(status: ApprovalStatus): BadgeProps["variant"] {
  if (status === "executed" || status === "approved") return "live";
  if (status === "failed" || status === "expired") return "danger";
  if (status === "pending") return "draft";
  return "neutral";
}

function empty(tab: ApprovalTab): string {
  if (tab === "waiting") return "Nothing is waiting for you.";
  if (tab === "mine") return "You have not requested anything.";
  if (tab === "open") return "No open approvals.";
  return "No closed approvals yet.";
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const tab = tabFrom(params.tab);
  const [requests, directory, policies] = await Promise.all([
    listApprovalRequests({ tab, userId: staff.userId, role: staff.role }),
    listStaff().catch(() => []),
    getApprovalPolicies().catch(() => []),
  ]);

  const canRequest = APPROVAL_REQUEST_KINDS.some((config) => {
    const policy = policies.find((item) => item.kind === config.kind);
    return Boolean(
      policy?.active &&
        canStaff(staff.role, policy.request_permission as StaffAction),
    );
  });

  const names = new Map(
    (directory as Array<{ user_id?: string; name?: string | null }>).map((member) => [
      String(member.user_id),
      String(member.name ?? "Staff member"),
    ] as const),
  );

  return (
    <AppPage width="wide">
      <PageHeader
        title="Approvals"
        description="Changes that need a second person."
        actions={
          <>
            {canRequest ? (
              <Link
                href="/admin/approvals/new"
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                New request
              </Link>
            ) : null}
            <Link
              href="/admin"
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              Back to admin
            </Link>
          </>
        }
        tabs={
          <nav aria-label="Approval views" className="flex gap-1 overflow-x-auto">
            {TABS.map((item) => (
              <Link
                key={item.id}
                href={`/admin/approvals?tab=${item.id}`}
                aria-current={tab === item.id ? "page" : undefined}
                className={cn(
                  "border-b-[3px] px-3 pb-3 pt-1 text-sm font-semibold whitespace-nowrap",
                  tab === item.id
                    ? "border-primary text-text"
                    : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        }
      />

      <AppCard className="overflow-x-auto">
        {requests.length === 0 ? (
          <p className="p-6 text-sm text-text-muted">{empty(tab)}</p>
        ) : (
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Action</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Amount or impact</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Requester</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Age</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Expires</th>
                <th className="px-4 py-3 text-left text-label-caps text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const old = ageHours(request.requested_at) > 24;
                const gone = expires(request.expires_at) === "Expired";
                return (
                  <tr key={request.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/approvals/${request.id}`}
                        className="font-semibold text-text hover:underline"
                      >
                        {approvalKindLabel(request.kind)}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-text-muted">
                        {approvalTarget(request)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{approvalAmount(request)}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {request.requested_by === staff.userId
                        ? "You"
                        : names.get(request.requested_by) ?? "Staff member"}
                    </td>
                    <td className="px-4 py-3">
                      {old && !gone ? (
                        <Badge variant="draft">{relative(request.requested_at)}</Badge>
                      ) : (
                        <span className="text-text-muted">{relative(request.requested_at)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{expires(request.expires_at)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(request.status)}>
                        {statusLabel(request)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AppCard>
    </AppPage>
  );
}
