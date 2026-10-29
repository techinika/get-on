import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ApprovalKind } from "@get-on/permissions";
import { requestApprovalHref } from "@/lib/admin/approval-request";

export function RequestApprovalLink({
  kind,
  targetId,
  amountUsd,
  planId,
  versionId,
  decision,
  label = "Request approval",
  variant = "secondary",
  size = "md",
  className,
}: {
  kind: ApprovalKind;
  targetId?: string;
  amountUsd?: number;
  planId?: string;
  versionId?: string;
  decision?: "approve" | "reject";
  label?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Link
      href={requestApprovalHref({ kind, targetId, amountUsd, planId, versionId, decision })}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {label}
    </Link>
  );
}
