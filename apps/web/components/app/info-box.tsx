import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type InfoBoxVariant = "info" | "warning" | "danger" | "success";

const VARIANTS: Record<
  InfoBoxVariant,
  { wrapper: string; icon: React.ReactNode; label: string }
> = {
  info: {
    wrapper: "bg-info-soft text-info-text",
    icon: <Info size={18} strokeWidth={1.75} aria-hidden />,
    label: "Information",
  },
  warning: {
    wrapper: "bg-warning-soft text-warning-text",
    icon: <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />,
    label: "Warning",
  },
  danger: {
    wrapper: "bg-danger-soft text-danger-text",
    icon: <ShieldAlert size={18} strokeWidth={1.75} aria-hidden />,
    label: "Problem",
  },
  success: {
    wrapper: "bg-success-soft text-success-text",
    icon: <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden />,
    label: "Done",
  },
};

export type InfoBoxProps = {
  variant?: InfoBoxVariant;
  children: React.ReactNode;
  className?: string;
};

/** Highlighted message box (spec §5.11). */
export function InfoBox({ variant = "info", children, className }: InfoBoxProps) {
  const v = VARIANTS[variant];
  return (
    <div
      role="note"
      aria-label={v.label}
      className={cn(
        "flex items-start gap-3 rounded-info border border-transparent p-4 text-sm leading-5",
        v.wrapper,
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 shrink-0">
        {v.icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
