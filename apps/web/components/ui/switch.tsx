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
          "relative mt-0.5 h-7 w-12 shrink-0 rounded-pill border-[1.5px] transition-colors duration-150",
          checked ? "border-primary bg-primary" : "border-border-strong bg-surface-muted",
          disabled && "opacity-50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform duration-150",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
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
