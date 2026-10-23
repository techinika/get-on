"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ShellMenuTriggerProps = {
  ref: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
};

export type ShellMenuProps = {
  /** Render prop for the trigger; spread the given props onto the button. */
  trigger: (props: ShellMenuTriggerProps) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: number;
  label?: string;
  className?: string;
};

/** Dropdown menu used by the top bar and the sidebars (spec §5.8, §5.10). */
export function ShellMenu({
  trigger,
  children,
  align = "left",
  width = 280,
  label,
  className,
}: ShellMenuProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((value) => !value),
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-1.5 rounded-info border border-border bg-surface p-1.5 shadow-raised",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ width }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type ShellMenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export function ShellMenuItem({ destructive, className, children, ...props }: ShellMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] font-medium transition-colors hover:bg-row-hover disabled:pointer-events-none disabled:opacity-50",
        destructive ? "text-danger-text" : "text-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
