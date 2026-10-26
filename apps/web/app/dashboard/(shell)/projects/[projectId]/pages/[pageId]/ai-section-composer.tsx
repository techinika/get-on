"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { blockLabel, blockSummary } from "@get-on/blocks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { appendAiSections, writeSectionWithAi } from "./ai-actions";

export function AiSectionComposer({
  projectId,
  pageId,
}: {
  projectId: string;
  pageId: string;
}) {
  const router = useRouter();
  const [brief, setBrief] = React.useState("");
  const [blocks, setBlocks] = React.useState<unknown[] | null>(null);
  const [credits, setCredits] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [adding, setAdding] = React.useState(false);

  async function generate() {
    if (!brief.trim() || loading) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setBlocks(null);
    try {
      const result = await writeSectionWithAi({ projectId, brief: brief.trim() });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const data = Array.isArray(result.data) ? result.data : null;
      if (!data || data.length === 0) {
        setError("AI could not make a section. Please try again.");
        return;
      }
      setBlocks(data);
      setCredits(result.credits);
    } catch {
      setError(friendlyError("NETWORK_ERROR"));
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!blocks || adding) return;
    setAdding(true);
    setError(null);
    setNotice(null);
    try {
      const result = await appendAiSections({ projectId, pageId, blocks });
      if (!result.ok) {
        setError(friendlyError(result.code));
        return;
      }
      setNotice("Added to your page.");
      setBlocks(null);
      setBrief("");
      router.refresh();
    } catch {
      setError(friendlyError("NETWORK_ERROR"));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-soft text-accent-text"
        >
          <Sparkles size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-h3">Write a section with AI</h2>
          <p className="mt-1 text-sm text-text-muted">
            Say what the section should do. AI writes a draft you can add to this page.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Label htmlFor="ai-section-brief">What should this section say?</Label>
        <Textarea
          id="ai-section-brief"
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          maxLength={2000}
          placeholder="For example: explain why people should choose us, with three short reasons."
          className="mt-1.5 min-h-[110px]"
        />
        <p className="mt-1 text-xs text-text-muted">
          {brief.length} of 2,000 characters. AI can make mistakes, so check it before publishing.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={generate}
          loading={loading}
          loadingLabel="Writing..."
          disabled={!brief.trim()}
        >
          <Sparkles size={18} strokeWidth={1.75} aria-hidden />
          Write with AI
        </Button>
        {blocks ? (
          <span className="text-sm text-text-muted">Used {credits} AI credits.</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger-text">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mt-4 text-sm text-success-text">
          {notice}
        </p>
      ) : null}

      {blocks ? (
        <div className="mt-5 rounded-card border border-border bg-surface-muted p-4">
          <p className="text-sm font-semibold text-text">Ready to add</p>
          <ul className="mt-2 flex flex-col gap-2">
            {blocks.map((block, index) => {
              const type =
                block && typeof block === "object" && typeof (block as { type?: unknown }).type === "string"
                  ? String((block as { type: string }).type)
                  : "section";
              return (
                <li key={index} className="text-sm text-text-muted">
                  <span className="font-semibold text-text">{blockLabel(type)}</span>
                  {" — "}
                  {blockSummary(block)}
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="primary" size="md" onClick={add} loading={adding} loadingLabel="Adding...">
              Add to page
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={generate} disabled={loading || adding}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
