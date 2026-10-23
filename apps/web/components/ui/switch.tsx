"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  className,
  id,
}: SwitchProps) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  const descriptionId = description ? `${switchId}-description` : undefined;

  return (
    <div className={cn("flex min-h-11 items-start gap-3", className)}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "group relative mt-0.5 h-[26px] w-[46px] shrink-0 rounded-pill border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          checked
            ? "border-primary bg-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]"
            : "border-border-strong bg-surface-muted",
          disabled && "cursor-not-allowed opacity-40",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(16,24,40,0.12),0_1px_1px_rgba(16,24,40,0.08)] transition-transform duration-200 will-change-transform",
            checked ? "translate-x-[20px]" : "translate-x-0",
          )}
        />
      </button>
      <div className="min-w-0">
        <p className="text-base font-semibold text-text">{label}</p>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-sm text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
