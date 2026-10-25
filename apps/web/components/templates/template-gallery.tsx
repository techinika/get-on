"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, RotateCcw } from "lucide-react";
import type { TemplateCatalogItem } from "@get-on/templates/catalog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  applyTemplateAction,
  fillTemplateTextAction,
  restoreTemplateAction,
} from "@/app/dashboard/(shell)/projects/[projectId]/templates/actions";

export type GalleryTemplate = TemplateCatalogItem & {
  available: boolean;
  requiredPlan?: string;
};

type ProjectOption = { id: string; name: string };

type Props = {
  items: GalleryTemplate[];
  mode: "dashboard" | "public" | "project";
  projectId?: string;
  projects?: ProjectOption[];
  currentSlug?: string;
  canRestore?: boolean;
  projectName?: string;
  aiEnabled?: boolean;
  aiCredits?: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All designs",
  starter: "Starter",
  software: "Software",
  professional: "Professional",
  restaurant: "Restaurant",
  portfolio: "Portfolio",
};

export function TemplateGallery({
  items,
  mode,
  projectId,
  projects = [],
  currentSlug,
  canRestore = false,
  projectName,
  aiEnabled = false,
  aiCredits,
}: Props) {
  const [category, setCategory] = React.useState("all");
  const [pending, setPending] = React.useState<GalleryTemplate | null>(null);
  const [applying, setApplying] = React.useState<GalleryTemplate | null>(null);
  const [targetProjectId, setTargetProjectId] = React.useState(projects[0]?.id ?? "");
  const [restoring, setRestoring] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "design" | "text">("idle");
  const [aiText, setAiText] = React.useState(false);
  const [aiNotes, setAiNotes] = React.useState("");
  const router = useRouter();
  const { toast } = useToast();

  const categories = ["all", ...Array.from(new Set(items.map((item) => item.category)))];
  const visible = category === "all" ? items : items.filter((item) => item.category === category);
  const estimate = pending && pending.pageCount > 3 ? 12 : 5;
  const canUseAi =
    aiEnabled && (typeof aiCredits !== "number" || aiCredits >= estimate);
  const targetName = projectName ?? "your website";

  function closePending() {
    if (working) return;
    setPending(null);
    setAiText(false);
    setAiNotes("");
  }

  async function apply() {
    if (!pending || !projectId) return;
    setWorking(true);
    setPhase("design");
    const result = await applyTemplateAction(projectId, pending.slug, "full");
    if (!result.ok) {
      setWorking(false);
      setPhase("idle");
      setPending(null);
      toast(result.message, "error");
      return;
    }

    if (aiText) {
      setPhase("text");
      const aiResult = await fillTemplateTextAction(projectId, aiNotes);
      setWorking(false);
      setPhase("idle");
      setPending(null);
      setAiText(false);
      setAiNotes("");
      if (!aiResult.ok) {
        toast(
          `Your design is ready, but AI could not write the text. ${aiResult.message}`,
          "error",
        );
      } else if (aiResult.changed === 0) {
        toast(
          "Your design is ready. AI did not find any text it could safely replace.",
          "error",
        );
      } else {
        toast(
          `Your website now uses the ${pending.name} design and AI wrote your words. You can change anything you like.`,
          "success",
        );
      }
      router.refresh();
      return;
    }

    setWorking(false);
    setPhase("idle");
    setPending(null);
    toast(`Your website now uses the ${pending.name} design. You can change anything you like.`, "success");
    router.refresh();
  }

  async function applyToExisting() {
    if (!applying || !targetProjectId) return;
    setWorking(true);
    const result = await applyTemplateAction(targetProjectId, applying.slug, "full");
    setWorking(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    const name = applying.name;
    setApplying(null);
    toast(`The ${name} design is now on that website. You can change anything you like.`, "success");
    router.push(`/dashboard/projects/${targetProjectId}`);
  }

  async function restore() {
    if (!projectId) return;
    setRestoring(true);
    const result = await restoreTemplateAction(projectId);
    setRestoring(false);
    if (!result.ok) {
      toast(result.message, "error");
      return;
    }
    toast("Your previous pages and design are back.", "success");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Filter designs">
        {categories.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            aria-pressed={category === value}
            className={cn(
              "inline-flex min-h-11 items-center rounded-pill border px-4 text-sm font-semibold transition-colors",
              category === value
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-text-muted hover:bg-surface-muted hover:text-text",
            )}
          >
            {CATEGORY_LABELS[value] ?? value}
          </button>
        ))}
      </div>

      {canRestore && mode === "project" ? (
        <div className="mb-5 flex flex-col gap-3 rounded-card border border-border bg-surface-muted p-4 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
          <div>
            <p className="font-semibold text-text">Changed your mind?</p>
            <p className="mt-0.5 text-sm text-text-muted">
              You can bring back the pages and design you had before your last change.
            </p>
          </div>
          <Button variant="secondary" size="md" onClick={restore} loading={restoring}>
            <RotateCcw size={18} strokeWidth={1.75} aria-hidden />
            Undo last change
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
        {visible.map((item) => {
          const inUse = mode === "project" && currentSlug === item.slug;
          return (
            <article
              key={item.slug}
              className="flex flex-col overflow-hidden rounded-card border border-border bg-surface"
            >
              <TemplateArtwork item={item} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-text">{item.name}</h3>
                  {item.featured ? <Badge variant="accent">Popular</Badge> : null}
                  {inUse ? <Badge variant="live" dot>In use</Badge> : null}
                  {!item.available ? (
                    <Badge variant="neutral">{item.requiredPlan ?? "Basic"}+</Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 text-sm leading-6 text-text-muted">{item.tagline}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                  {item.pageCount} pages
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href={`/templates/${item.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "secondary", size: "md" })}
                  >
                    <Eye size={18} strokeWidth={1.75} aria-hidden />
                    Preview
                  </Link>
                  {mode === "project" ? (
                    item.available ? (
                      <Button variant={inUse ? "secondary" : "primary"} size="md" onClick={() => setPending(item)}>
                        {inUse ? "Use again" : "Use this design"}
                        {!inUse ? <ArrowRight size={18} strokeWidth={1.75} aria-hidden /> : null}
                      </Button>
                    ) : (
                      <Link href="/dashboard/plan" className={buttonVariants({ variant: "primary", size: "md" })}>
                        See plans
                      </Link>
                    )
                  ) : item.available ? (
                    <>
                      <Link
                        href={`/dashboard/new?template=${item.slug}`}
                        className={buttonVariants({ variant: "primary", size: "md" })}
                      >
                        Use this design
                        <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
                      </Link>
                      {mode === "dashboard" && projects.length > 0 ? (
                        <Button variant="secondary" size="md" onClick={() => setApplying(item)}>
                          Use on existing website
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <Link href="/dashboard/plan" className={buttonVariants({ variant: "primary", size: "md" })}>
                      See plans
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {mode === "project" && currentSlug ? (
        <p className="mt-5 flex items-center gap-2 text-sm text-text-muted">
          <Check size={16} strokeWidth={2} aria-hidden />
          Changing the design never publishes your website. You choose when to publish.
        </p>
      ) : null}

      <Dialog
        open={pending !== null}
        onClose={closePending}
        title={`Use the ${pending?.name ?? ""} design?`}
        width="form"
        dismissible={!working}
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={closePending}
              disabled={working}
              type="button"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={apply}
              loading={working}
              loadingLabel={phase === "text" ? "Writing your words..." : "Applying design..."}
              type="button"
            >
              {phase === "text" ? "Writing your words..." : "Use this design"}
            </Button>
          </>
        }
      >
        <p className="text-base leading-6 text-text-muted">
          Your pages and text will be replaced with this design. The colours and fonts will
          change too. Your current pages are saved for 30 days, so you can undo this.
        </p>

        {aiEnabled ? (
          <div className="mt-5 rounded-card border border-border bg-surface-muted p-4">
            <Switch
              checked={aiText}
              onCheckedChange={setAiText}
              disabled={!canUseAi || working}
              label="Let AI write my text"
              description={`AI replaces the sample words with words about ${targetName}. It uses your Writing style and business facts.`}
            />
            {!canUseAi ? (
              <p className="mt-2 text-sm text-danger-text">
                You need about {estimate} credits.{" "}
                <Link href="/dashboard/plan" className="font-semibold underline">
                  See plans
                </Link>
              </p>
            ) : null}
            {aiText ? (
              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="template-ai-notes" optional>
                    Anything AI should know?
                  </Label>
                  <Textarea
                    id="template-ai-notes"
                    value={aiNotes}
                    onChange={(event) => setAiNotes(event.target.value)}
                    maxLength={2000}
                    disabled={working}
                    className="mt-2 min-h-[96px]"
                    placeholder="For example: we deliver in Leeds and offer free quotes."
                  />
                </div>
                <p className="text-sm text-text-muted">
                  About {estimate} credits. AI never makes up reviews, numbers or contact
                  details.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={applying !== null}
        onClose={() => setApplying(null)}
        title="Choose a website"
        width="form"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setApplying(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={applyToExisting}
              loading={working}
              disabled={!targetProjectId}
            >
              Use this design
            </Button>
          </>
        }
      >
        <p className="text-sm leading-6 text-text-muted">
          The {applying?.name ?? ""} design will replace the pages and design of the website you
          choose. Its current pages are saved for 30 days, so you can undo this.
        </p>
        <label htmlFor="template-project" className="mt-5 block text-sm font-semibold text-text">
          Website
        </label>
        <select
          id="template-project"
          value={targetProjectId}
          onChange={(event) => setTargetProjectId(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-input border border-border bg-surface px-3 text-base text-text"
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Dialog>
    </div>
  );
}

function TemplateArtwork({ item }: { item: TemplateCatalogItem }) {
  const { colors, preview } = item;
  return (
    <div
      className="relative min-h-[190px] overflow-hidden border-b border-border p-5"
      style={{ backgroundColor: colors.background, color: colors.text }}
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: colors.primary }}>
          {preview.eyebrow}
        </span>
        <span className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.primary }} />
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.accent }} />
        </span>
      </div>
      <p className="mt-4 max-w-[22ch] text-[22px] font-bold leading-[1.15] tracking-tight">
        {preview.heading}
      </p>
      <p className="mt-2 line-clamp-2 max-w-[34ch] text-[12px] leading-5 opacity-75">
        {preview.subheading}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {preview.items.map((text, index) => (
          <span
            key={text}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={{
              backgroundColor: index === 0 ? colors.primary : colors.soft,
              color: index === 0 ? colors.background : colors.text,
            }}
          >
            {text}
          </span>
        ))}
      </div>
      <span
        className="absolute -bottom-8 -right-6 h-24 w-24 rounded-full opacity-20"
        style={{ backgroundColor: colors.accent }}
      />
    </div>
  );
}
