"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import { ShellMenu, ShellMenuItem } from "@/components/shell/shell-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PLAN_BADGE } from "@/components/shell/plan-badge";
import type { ShellTeam } from "@/components/shell/types";
import { cn } from "@/lib/utils";

export const TEAM_COOKIE = "gs_team";

export type TeamSwitcherProps = {
  teams: ShellTeam[];
  currentTeamId: string;
  /** Compact form used on small screens. */
  compact?: boolean;
};

export function TeamSwitcher({ teams, currentTeamId, compact = false }: TeamSwitcherProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);
  const [pendingTeamId, setPendingTeamId] = React.useState<string | null>(null);
  const handledTeam = React.useRef<string | null>(null);
  const current = teams.find((team) => team.id === currentTeamId) ?? teams[0];

  React.useEffect(() => {
    if (!pendingTeamId || handledTeam.current === pendingTeamId) return;
    handledTeam.current = pendingTeamId;
    document.cookie = `${TEAM_COOKIE}=${pendingTeamId}; path=/; max-age=31536000; samesite=lax`;
    router.push("/dashboard");
    router.refresh();
  }, [pendingTeamId, router]);

  function selectTeam(teamId: string) {
    setPendingTeamId(teamId);
  }

  if (!current) return null;

  return (
    <>
      <ShellMenu
        label="Your teams"
        width={280}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={cn(
              "flex h-10 items-center gap-2 rounded-input px-2 transition-colors hover:bg-row-hover",
              compact ? "max-w-[190px]" : "max-w-[240px]",
            )}
          >
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text"
            >
              <Users size={14} strokeWidth={1.75} />
            </span>
            <span className="truncate text-[15px] font-semibold text-text">{current.name}</span>
            <ChevronsUpDown size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
          </button>
        )}
      >
        <p className="px-3 py-2 text-label-caps">Your teams</p>
        {teams.map((team) => {
          const active = team.id === currentTeamId;
          const badge = PLAN_BADGE[team.planId];
          return (
            <button
              key={team.id}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => selectTeam(team.id)}
              className={cn(
                "flex min-h-[52px] w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-row-hover",
                active && "bg-primary-soft",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-text">
                  {team.name}
                </span>
                {team.isPersonal ? (
                  <span className="block text-xs text-text-muted">Personal</span>
                ) : null}
              </span>
              <Badge variant={badge.variant} className="shrink-0">
                {badge.label}
              </Badge>
              {active ? (
                <Check size={16} strokeWidth={2} aria-hidden className="shrink-0 text-primary" />
              ) : null}
            </button>
          );
        })}
        <div role="separator" className="my-1 h-px bg-border" />
        <ShellMenuItem onClick={() => setAddOpen(true)}>
          <Plus size={18} strokeWidth={1.75} aria-hidden />
          Add another team
        </ShellMenuItem>
      </ShellMenu>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add another team"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setAddOpen(false)}>
              Close
            </Button>
            <Button variant="primary" size="md" onClick={() => router.push("/dashboard/plan")}>
              See plans
            </Button>
          </>
        }
      >
        <p className="text-base leading-6 text-text-muted">
          Every account includes one free team. Extra teams need a paid plan, and payments are
          coming soon.
        </p>
      </Dialog>
    </>
  );
}
