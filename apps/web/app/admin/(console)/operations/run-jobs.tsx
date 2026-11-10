"use client";

import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { runDomainJobAction, type JobMode, type JobRunResult } from "./actions";
import { JOB_LABELS } from "./actions";

export function RunDomainJobs() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<JobMode | null>(null);
  const [last, setLast] = useState<JobRunResult | null>(null);

  async function runJob(mode: JobMode) {
    setBusy(mode);
    try {
      const result = await runDomainJobAction(mode);
      setLast(result);
      toast(
        result.ok
          ? `${JOB_LABELS[mode]}: ${result.message}`
          : `Job failed: ${result.error ?? result.message}`,
      );
    } catch (error) {
      setLast({
        ok: false,
        mode,
        count: 0,
        failed: 1,
        message: "Job failed",
        error: error instanceof Error ? error.message : String(error),
      });
      toast("Job failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppCard className="mt-5 p-5">
      <h2 className="text-[17px] font-semibold text-text">Run domain jobs</h2>
      <p className="mt-1 text-sm text-text-muted">
        Trigger a domain maintenance job now. Results are recorded under Last job runs.
      </p>
      <div className="mt-4 grid gap-2 min-[640px]:grid-cols-3">
        {Object.entries(JOB_LABELS).map(([mode, label]) => (
          <Button
            key={mode}
            type="button"
            variant={busy === mode ? "secondary" : "ghost"}
            loading={busy === mode}
            disabled={busy !== null}
            onClick={() => void runJob(mode as JobMode)}
          >
            {label}
          </Button>
        ))}
      </div>
      {last && (
        <div className="mt-4 rounded-card border border-border bg-surface p-3">
          <p className="text-[13px]">
            <span className="font-semibold text-text">{JOB_LABELS[last.mode]}</span>{" "}
            {last.ok ? (
              <span className="text-success-text">· completed · {last.count} processed</span>
            ) : (
              <span className="text-danger-text">· failed · {last.failed} failed</span>
            )}
            {last.error ? (
              <span className="block mt-1 text-[12px] text-danger-text">{last.error}</span>
            ) : null}
          </p>
        </div>
      )}
    </AppCard>
  );
}
