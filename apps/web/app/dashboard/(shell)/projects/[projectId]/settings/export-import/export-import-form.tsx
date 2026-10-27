"use client";

import { useRef, useState } from "react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function ExportImportForm({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [downloadState, setDownloadState] = useState<"idle" | "working" | "done">("idle");
  const [importFile, setImportFile] = useState<File | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function handleDownload(kind: "content" | "backup" | "site_zip") {
    setDownloadState("working");
    try {
      const res = await fetch(`/api/projects/${projectId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (res.status === 403) {
        toast(kind === "site_zip" ? "Your plan does not include downloading your full website." : "Not allowed.");
        setDownloadState("idle");
        return;
      }
      if (!res.ok) throw new Error("EXPORT_FAILED");
      const data = (await res.json()) as { downloadUrl: string; fileName?: string };
      const link = document.createElement("a");
      link.href = data.downloadUrl;
      link.download = data.fileName ?? "download";
      link.click();
      setDownloadState("done");
      toast("Download started.");
      window.setTimeout(() => setDownloadState("idle"), 3000);
    } catch {
      setDownloadState("idle");
      toast("Something went wrong. Please try again.");
    }
  }

  async function handleImport() {
    if (!importFile) {
      toast("Please choose a file first.");
      return;
    }
    if (!importFile.name.endsWith(".json")) {
      toast("Please choose a file ending in .json.");
      return;
    }
    if (importFile.size > 10 * 1024 * 1024) {
      toast("That file is too big. The limit is 10 MB.");
      return;
    }
    try {
      const text = await importFile.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        toast("We could not read that file.");
        return;
      }
      const uploadRes = await fetch(`/api/imports/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: importFile.name, body: parsed }),
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (uploadRes.ok && uploadData.importId) {
        toast("File read. Apply it in the steps below when ready.");
      } else {
        toast(uploadData.error ? String(uploadData.error) : "Something went wrong.");
      }
    } catch {
      toast("Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AppCard className="max-w-[760px] p-6">
        <h2 className="text-[17px] font-semibold text-text">Download my website</h2>
        <p className="mt-1 text-[14px] text-text-muted">Keep your own copy and bring it back any time. Pictures and tracked links are kept separately.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
          <div className="rounded-info border border-border bg-surface-muted p-4">
            <div className="text-sm font-semibold text-text">Content (JSON)</div>
            <p className="mt-1 text-xs text-text-muted">Pages, text, settings and design.</p>
            <Button size="sm" className="mt-3" onClick={() => handleDownload("content")}>Download content</Button>
          </div>
          <div className="rounded-info border border-border bg-surface-muted p-4">
            <div className="text-sm font-semibold text-text">Full backup (ZIP)</div>
            <p className="mt-1 text-xs text-text-muted">Everything: content, pictures and files.</p>
            <Button size="sm" className="mt-3" onClick={() => handleDownload("backup")}>Download backup</Button>
          </div>
          <div className="rounded-info border border-border bg-surface-muted p-4">
            <div className="text-sm font-semibold text-text">Website ZIP (paid)</div>
            <p className="mt-1 text-xs text-text-muted">A ready-to-host copy of your published website.</p>
            <Button size="sm" className="mt-3" onClick={() => handleDownload("site_zip")}>Download ZIP</Button>
          </div>
        </div>
        {downloadState === "working" && (
          <div className="mt-3 rounded-input border border-border-strong bg-surface-muted p-3 text-sm text-text-muted">Preparing your download...</div>
        )}
        {downloadState === "done" && (
          <div className="mt-3 rounded-input border border-border-strong bg-surface-muted p-3 text-sm text-text-muted">Ready. It may take a moment to start.</div>
        )}
      </AppCard>
      <AppCard className="max-w-[760px] p-6">
        <h2 className="text-[17px] font-semibold text-text">Bring back a website file</h2>
        <p className="mt-1 text-[14px] text-text-muted">Only content JSON files made by Get-On can be imported. ZIP backups keep your pictures and files.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[16rem]">
            <Label htmlFor="import-file">Choose a .json file</Label>
            <input
              id="import-file"
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="mt-1.5 block w-full text-sm text-text file:mr-3 file:h-9 file:rounded-input file:border-[1.5px] file:border-border-strong file:bg-surface file:px-3 file:text-sm file:text-text file:transition-colors hover:file:bg-row-hover"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button size="md" onClick={handleImport}>Read file</Button>
        </div>
        <p className="mt-2 text-xs text-text-muted">Up to 10 MB. We check the file before changing anything.</p>
      </AppCard>
    </div>
  );
}
