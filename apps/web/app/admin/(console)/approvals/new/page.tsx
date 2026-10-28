import Link from "next/link";
import { AppPage } from "@/components/app/app-page";
import { AppCard } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  APPROVAL_REQUEST_KINDS,
  type ApprovalRequestKind,
} from "@/lib/admin/approval-request";
import { getApprovalPolicies } from "@/lib/admin/approvals";
import { canStaff, requireStaff } from "@/lib/admin/staff";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import type { StaffAction } from "@get-on/permissions";
import { NewApprovalRequestForm } from "./new-request-form";

export const dynamic = "force-dynamic";

export default async function NewApprovalRequestPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    target_id?: string;
    amount_usd?: string;
    team_id?: string;
    monthly_credits?: string;
    plan_id?: string;
    decision?: string;
  }>;
}) {
  const staff = await requireStaff();
  const params = await searchParams;
  const policies = await getApprovalPolicies();

  const kinds: ApprovalRequestKind[] = APPROVAL_REQUEST_KINDS.filter((config) => {
    const policy = policies.find((item) => item.kind === config.kind);
    return Boolean(
      policy?.active &&
        canStaff(staff.role, policy.request_permission as StaffAction),
    );
  });

  const plans = PLAN_DEFINITIONS.map((plan) => ({ id: plan.id, name: plan.name }));
  const initialKind = kinds.some((config) => config.kind === params.kind)
    ? params.kind
    : undefined;
  const initialPlan = plans.some((plan) => plan.id === params.plan_id)
    ? params.plan_id
    : undefined;

  return (
    <AppPage width="form">
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Approvals", href: "/admin/approvals" },
          { label: "New request" },
        ]}
        title="New request"
        description="Ask another Super admin to approve a sensitive change."
        actions={
          <Link
            href="/admin/approvals"
            className={buttonVariants({ variant: "ghost", size: "md" })}
          >
            Back to approvals
          </Link>
        }
      />

      {kinds.length === 0 ? (
        <AppCard className="p-6">
          <p className="text-[17px] font-semibold text-text">
            You cannot request any of these changes.
          </p>
          <p className="mt-1 text-sm text-text-muted">
            Ask a Super admin if you need one of these actions.
          </p>
        </AppCard>
      ) : (
        <NewApprovalRequestForm
          kinds={kinds}
          plans={plans}
          initial={{
            kind: initialKind,
            targetId: params.target_id ?? "",
            amountUsd: params.amount_usd ?? "",
            teamId: params.team_id ?? "",
            monthlyCredits: params.monthly_credits ?? "",
            planId: initialPlan,
            decision:
              params.decision === "reject" || params.decision === "approve"
                ? params.decision
                : undefined,
          }}
        />
      )}
    </AppPage>
  );
}
