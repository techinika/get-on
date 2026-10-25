"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { AiHistoryChange } from "@/lib/ai/history";
import { undoAiRequest } from "./actions";

export type AiHistoryItem = {
  id: string;
  summary: string;
  meta: string;
  statusLabel: string;
  statusVariant: "neutral" | "draft" | "live" | "primary" | "accent" | "info" | "danger";
  error: string | null;
  changes: AiHistoryChange[];
  canUndo: boolean;
  undone: boolean;
};

type Props = {
  projectId: string;
  items: AiHistoryItem[];
};

export function AiHistoryList({ projectId, items }: Props) {
  const [selected, setSelected] = React.useState<AiHistoryItem | null>(null);
  const [undoing, setUndoing] = React.useState<AiHistoryItem | null>(null);
  const [working, setWorking] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  async function undo() {
    if (!undoing) return;
    setWorking(true);
    const result = await undoAiRequest(undoing.id, projectId);
    setWorking(false);
    setUndoing(null);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    toast("Your previous text is back.", "success");
    router.refresh();
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Sparkles size={17} strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-text">{item.summary}</span>
                  <Badge variant={item.statusVariant}>{item.statusLabel}</Badge>
                  {item.undone ? <Badge variant="neutral">Undone</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-text-muted">{item.meta}</p>
                {item.error ? (
                  <p className="mt-1 text-sm text-danger-text">{item.error}</p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setSelected(item)}
              >
                Show what changed
              </Button>
              {item.canUndo && !item.undone ? (
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setUndoing(item)}
                >
                  Undo
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="What changed"
        width="form"
        footer={
          <Button variant="secondary" size="md" type="button" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && selected.changes.length > 0 ? (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {selected.changes.map((change, index) => (
              <div
                key={`${change.label}-${index}`}
                className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0"
              >
                <p className="text-sm font-semibold text-text">{change.label}</p>
                <div className="mt-2 grid gap-3 min-[520px]:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                      Before
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">
                      {change.before || "Empty"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                      After
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-text">
                      {change.after || "Empty"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            The details for this AI change are no longer available. AI content is kept for 30
            days.
          </p>
        )}
      </Dialog>

      <ConfirmDialog
        open={undoing !== null}
        title="Undo this AI change?"
        description="Your pages go back to how they were before this AI change."
        confirmLabel="Undo"
        loading={working}
        onConfirm={undo}
        onClose={() => setUndoing(null)}
      />
    </>
  );
}
