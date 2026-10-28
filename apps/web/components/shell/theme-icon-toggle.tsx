"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const CHANGE_EVENT = "get-on-theme-change";

function readChoice(): ThemeChoice {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${THEME_COOKIE}=([^;]+)`));
  const value = match?.[1];
  return value === "light" || value === "dark" ? value : "system";
}

function apply(choice: ThemeChoice) {
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  const root = document.documentElement;
  if (choice === "light" || choice === "dark") {
    root.setAttribute("data-theme", choice);
  } else {
    root.removeAttribute("data-theme");
  }
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Compact theme segmented control used in the avatar menu (spec §5.10). */
export function ThemeIconToggle({ className }: { className?: string }) {
  const choice = React.useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      return () => window.removeEventListener(CHANGE_EVENT, onChange);
    },
    readChoice,
    () => "system" as ThemeChoice,
  );

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("flex items-center gap-1 rounded-input bg-surface-muted p-1", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={label}
          title={label}
          onClick={() => apply(value)}
          className={cn(
            "flex h-8 w-9 items-center justify-center rounded-[8px] transition-colors",
            choice === value
              ? "bg-surface text-primary shadow-card"
              : "text-text-muted hover:text-text",
          )}
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden />
        </button>
      ))}
    </div>
  );
}
