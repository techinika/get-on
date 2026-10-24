"use client";

import { useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ExportImportForm({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [downloadState, setDownloadState] = useState<"idle" | "working" | "done">("idle");

  async function onDownload() {
    setDownloadState("working");
    try {
      const response = await fetch(`/api/projects/${projectId}/exports`);
      if (!response.ok) throw new Error("EXPORT_FAILED");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "website.json";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setDownloadState("done");
      toast("File downloaded");
      window.setTimeout(() => setDownloadState("idle"), 2000);
    } catch {
      setDownloadState("idle");
      toast("We could not make your file. Please try again.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Download my website</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              A file with your pages, design and settings. Pictures are not included yet.
            </p>
          </div>
          <Button
            type="button"
            onClick={onDownload}
            loading={downloadState === "working"}
            loadingLabel="Creating file..."
          >
            {downloadState === "done" ? "File ready" : "Create file"}
          </Button>
        </div>
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-text">Bring back a website file</h2>
            <p className="mt-1 text-[14px] text-text-muted">
              Use a file made by Get-On to restore this website or add its pages. Coming soon.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => toast("Bringing back a file is coming soon")}
          >
            Choose a file
          </Button>
        </div>
      </AppCard>
    </div>
  );
}
