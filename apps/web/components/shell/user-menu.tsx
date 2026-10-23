"use client";

import * as React from "react";
import Link from "next/link";
import { LifeBuoy, LogOut, UserCircle } from "lucide-react";
import { ShellMenu, ShellMenuItem } from "@/components/shell/shell-menu";
import { ThemeIconToggle } from "@/components/shell/theme-icon-toggle";
import type { ShellUser } from "@/components/shell/types";
import { cn } from "@/lib/utils";

export type UserMenuProps = {
  user: ShellUser;
  /** Opens the help panel (only offered inside the menu on small screens). */
  onOpenHelp: () => void;
  /** True on small screens, where Help lives in the menu instead of the top bar. */
  showHelpInMenu: boolean;
};

/** Avatar menu (spec §5.10). */
export function UserMenu({ user, onOpenHelp, showHelpInMenu }: UserMenuProps) {
  return (
    <ShellMenu
      label="Account"
      align="right"
      width={280}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Account menu for ${user.name}`}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-text",
            "min-[640px]:h-10 min-[640px]:w-10",
          )}
        >
          {user.initials}
        </button>
      )}
    >
      <div className="border-b border-border px-3 py-3">
        <p className="truncate text-[15px] font-semibold text-text">{user.name}</p>
        <p className="truncate text-sm text-text-muted">{user.email}</p>
      </div>

      <div className="py-1">
        <Link
          href="/dashboard/account"
          role="menuitem"
          className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium text-text transition-colors hover:bg-row-hover"
        >
          <UserCircle size={20} strokeWidth={1.75} aria-hidden />
          Account
        </Link>
        {showHelpInMenu ? (
          <ShellMenuItem onClick={onOpenHelp}>
            <LifeBuoy size={20} strokeWidth={1.75} aria-hidden />
            Help
          </ShellMenuItem>
        ) : null}
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="text-[15px] font-medium text-text">Theme</span>
          <ThemeIconToggle />
        </div>
      </div>

      <div className="border-t border-border pt-1">
        <form action="/auth/logout" method="post">
          <button
            type="submit"
            role="menuitem"
            className="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[15px] font-medium text-danger-text transition-colors hover:bg-row-hover"
          >
            <LogOut size={20} strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </form>
      </div>

      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs text-text-muted">
        <Link href="/terms" className="hover:underline">
          Terms
        </Link>
        <span aria-hidden>·</span>
        <Link href="/privacy" className="hover:underline">
          Privacy
        </Link>
      </div>
    </ShellMenu>
  );
}
