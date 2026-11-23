"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

type OperationsTabId = "overview" | "jobs";

const TABS: Array<{ id: OperationsTabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "jobs", label: "Background Jobs" },
];

export function OperationsTabs({
  overview,
  jobsMonitor,
  errorCount = 0,
  runningCount = 0,
}: {
  overview: React.ReactNode;
  jobsMonitor: React.ReactNode;
  errorCount?: number;
  runningCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab: OperationsTabId =
    searchParams.get("tab") === "jobs" ? "jobs" : "overview";

  function selectTab(next: OperationsTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "jobs") {
      params.set("tab", "jobs");
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <>
      <PageHeader
        title="Operations"
        description="Domain provider health, pending hostnames and background job monitors."
        tabs={
          <div role="tablist" aria-label="Operations sections" className="flex gap-1 overflow-x-auto">
            {TABS.map((item) => {
              const selected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(item.id)}
                  className={cn(
                    "relative flex h-12 shrink-0 items-center gap-2 px-3 text-[15px] font-semibold transition-colors",
                    selected ? "text-primary" : "text-text-muted hover:text-text",
                  )}
                >
                  <span>{item.label}</span>
                  {item.id === "jobs" && runningCount > 0 ? (
                    <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
                      {runningCount} running
                    </span>
                  ) : null}
                  {item.id === "jobs" && errorCount > 0 ? (
                    <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger-text">
                      {errorCount}
                    </span>
                  ) : null}
                  {selected ? (
                    <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        }
      />

      <div role="tabpanel" hidden={activeTab !== "overview"}>
        {activeTab === "overview" ? overview : null}
      </div>
      <div role="tabpanel" hidden={activeTab !== "jobs"}>
        {activeTab === "jobs" ? jobsMonitor : null}
      </div>
    </>
  );
}
