"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FREE_SUFFIX } from "@/lib/address";
import { cn } from "@/lib/utils";

const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#F5A524", "#E8743B"],
  ["#0B6B4F", "#3DBE8B"],
  ["#6D5DD3", "#A18BFF"],
  ["#E8743B", "#F5A524"],
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function SummaryRow({
  label,
  children,
  onEdit,
  editLabel,
}: {
  label: string;
  children: ReactNode;
  onEdit: () => void;
  editLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3">
      <span className="shrink-0 text-sm text-text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 truncate text-base font-semibold">{children}</span>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          Edit
          <span className="sr-only"> {editLabel}</span>
        </button>
      </span>
    </div>
  );
}

export function StepReview({
  name,
  address,
  businessType,
  submitError,
  limitReached,
  onEditStep,
}: {
  name: string;
  address: string;
  businessType: string;
  submitError: string | null;
  limitReached: boolean;
  onEditStep: (step: number) => void;
}) {
  const [from, to] = GRADIENTS[hashString(name || "get-on") % GRADIENTS.length] ?? ["#F5A524", "#E8743B"];

  if (limitReached) {
    return (
      <div className="rounded-[20px] border border-warning-border bg-warning-soft p-6">
        <Lock size={24} strokeWidth={1.75} aria-hidden className="text-warning-text" />
        <h3 className="mt-3 text-h3">Your Free plan includes 1 website</h3>
        <p className="mt-2 text-base">To add another website, you will need a bigger plan.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/#pricing" className={cn(buttonVariants({ variant: "primary", size: "md" }))}>
            See plans
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "secondary", size: "md" }))}
          >
            Back to my websites
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Card className="rounded-dialog p-6">
        <div
          className="relative aspect-video w-full overflow-hidden rounded-[20px]"
          style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
          aria-hidden
        >
          <div className="absolute inset-4 overflow-hidden rounded-[10px] bg-white/[0.92]">
            <div className="flex h-5 items-center gap-1.5 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#E8DFD0]" />
            </div>
            <div className="flex h-[calc(100%_-_1.25rem)] items-center justify-center px-4">
              <p className="max-w-full truncate font-heading text-[32px] font-bold text-[#1F1A17]">
                {name || "Your business"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <SummaryRow
            label="Business name"
            onEdit={() => onEditStep(1)}
            editLabel="business name"
          >
            {name || "—"}
          </SummaryRow>
          <SummaryRow label="Web address" onEdit={() => onEditStep(1)} editLabel="web address">
            <span className="text-primary">
              {address || "—"}
              {address ? FREE_SUFFIX : ""}
            </span>
          </SummaryRow>
          <SummaryRow
            label="Business type"
            onEdit={() => onEditStep(2)}
            editLabel="business type"
          >
            {businessType || "—"}
          </SummaryRow>
        </div>
      </Card>

      {submitError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-danger-border bg-danger-soft px-3.5 py-3 text-sm text-danger-text"
        >
          <AlertCircle
            size={18}
            strokeWidth={1.75}
            aria-hidden
            className="mt-0.5 shrink-0 text-danger"
          />
          <span>{submitError}</span>
        </div>
      ) : null}
    </div>
  );
}
