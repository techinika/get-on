"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type MenuProps = {
  /** Render prop for the trigger; must spread the given props onto the element. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  label?: string;
};

export function Menu({ trigger, children, align = "right", label }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((v) => !v),
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-40 mt-1 w-[220px] rounded-info border border-border bg-surface p-1.5 shadow-raised",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={(e) => {
            // Close after activating a menu item (unless it is disabled).
            const item = (e.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
            if (item && item.getAttribute("aria-disabled") !== "true") setOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type MenuItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  destructive?: boolean;
};

export function MenuItem({ destructive, className, children, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-base font-medium transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50",
        destructive ? "text-danger" : "text-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
