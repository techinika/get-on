"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles, X } from "lucide-react";
import { DESIGN_OPTIONS, HERO_LAYOUTS } from "@get-on/blocks";
import { FONT_CATALOGUE } from "@get-on/ai";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  DESIGN_FEELS,
  DESIGN_SECTIONS,
  DESIGN_STYLES,
  type DesignPrefs,
} from "@/lib/ai/design-prefs";
import {
  applyDesignRestyle,
  previewDesignRestyle,
  type RestylePreview,
} from "./design-actions";

const FEEL_LABELS: Record<string, string> = {
  modern: "Modern and clean",
  elegant: "Elegant and refined",
  friendly: "Friendly and warm",
  bold: "Bold and loud",
  classic: "Classic and traditional",
  techy: "Technical and precise",
  quirky: "Playful and creative",
};

function ToggleChip({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-surface text-text hover:bg-surface-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {active ? <Check size={15} strokeWidth={2.5} aria-hidden /> : null}
      {children}
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  allowAuto = true,
}: {
  label: string;
  value: T | null;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T | null) => void;
  allowAuto?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text">{label}</span>
      <div className="flex flex-wrap gap-2">
        {allowAuto ? (
          <ToggleChip active={value === null} onClick={() => onChange(null)}>
            Let AI choose
          </ToggleChip>
        ) : null}
        {options.map((option) => (
          <ToggleChip
            key={option.id}
            active={value === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

function HeroSketch({ id }: { id: string }) {
  const bar = "rounded-sm bg-border-strong";
  return (
    <span className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-md bg-surface-muted p-2" aria-hidden>
      {id === "split" ? (
        <span className="flex w-full items-center gap-2">
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn(bar, "h-1.5 w-3/4")} />
            <span className={cn(bar, "h-1 w-full opacity-60")} />
            <span className={cn(bar, "h-1 w-2/3 opacity-60")} />
          </span>
          <span className="h-9 flex-1 rounded bg-primary/25" />
        </span>
      ) : id === "centered" ? (
        <span className="flex w-full flex-col items-center gap-1">
          <span className={cn(bar, "h-1.5 w-1/2")} />
          <span className={cn(bar, "h-1 w-3/4 opacity-60")} />
          <span className="mt-1 h-3 w-2/3 rounded bg-primary/25" />
        </span>
      ) : id === "fullbleed" ? (
        <span className="absolute inset-0 bg-primary/25">
          <span className="absolute inset-x-3 top-3 flex flex-col gap-1">
            <span className="h-1.5 w-1/2 rounded-sm bg-surface" />
            <span className="h-1 w-2/3 rounded-sm bg-surface/70" />
          </span>
        </span>
      ) : id === "editorial" ? (
        <span className="flex w-full flex-col gap-1">
          <span className="h-0.5 w-8 bg-primary" />
          <span className={cn(bar, "h-2 w-3/4")} />
          <span className={cn(bar, "h-2 w-1/2")} />
          <span className="mt-1 h-2.5 w-full rounded-sm bg-primary/20" />
        </span>
      ) : id === "card-over-image" ? (
        <span className="absolute inset-0 bg-primary/20">
          <span className="absolute bottom-1.5 left-2 right-2 rounded bg-surface p-1.5 shadow-sm">
            <span className={cn(bar, "block h-1 w-2/3")} />
            <span className={cn(bar, "mt-1 block h-1 w-full opacity-60")} />
          </span>
        </span>
      ) : id === "minimal" ? (
        <span className="flex w-full flex-col gap-1.5 px-2">
          <span className="h-0.5 w-6 bg-primary" />
          <span className={cn(bar, "h-1.5 w-2/3")} />
          <span className={cn(bar, "h-1 w-1/2 opacity-60")} />
        </span>
      ) : id === "offset-frame" ? (
        <span className="flex w-full items-center gap-2">
          <span className="relative h-9 flex-1">
            <span className="absolute inset-1 rounded-sm border-2 border-primary" />
            <span className="absolute inset-0 rounded-sm bg-primary/20" />
          </span>
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn(bar, "h-1.5 w-3/4")} />
            <span className={cn(bar, "h-1 w-full opacity-60")} />
          </span>
        </span>
      ) : id === "diagonal" ? (
        <span className="flex w-full items-center gap-2">
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn(bar, "h-1.5 w-3/4")} />
            <span className={cn(bar, "h-1 w-full opacity-60")} />
          </span>
          <span className="h-10 flex-1 rounded-sm bg-primary/30 [clip-path:polygon(20%_0,100%_0,100%_100%,0_100%)]" />
        </span>
      ) : id === "product-shot" ? (
        <span className="flex h-10 w-full items-center justify-center rounded border border-border-strong bg-surface">
          <span className="h-1 w-2/3 rounded-sm bg-primary/30" />
        </span>
      ) : id === "arch" ? (
        <span className="flex w-full items-center gap-2">
          <span className="h-10 flex-1 rounded-t-full bg-primary/25" />
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn(bar, "h-1.5 w-3/4")} />
            <span className={cn(bar, "h-1 w-full opacity-60")} />
          </span>
        </span>
      ) : (
        <span className={cn(bar, "h-1.5 w-1/2")} />
      )}
    </span>
  );
}

function RestyleDialog({
  projectId,
  onApplied,
}: {
  projectId: string;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<RestylePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  function close() {
    if (loading || applying) return;
    setOpen(false);
    setError(null);
    setPreview(null);
    setInstruction("");
  }

  async function getPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    const result = await previewDesignRestyle({ projectId, instruction });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(result.preview);
  }

  async function apply() {
    if (!preview) return;
    setApplying(true);
    const result = await applyDesignRestyle({ previewId: preview.id });
    setApplying(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast("New look applied. Publish when you are ready.", "success");
    close();
    onApplied();
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles size={17} strokeWidth={1.75} aria-hidden />
        Restyle with AI
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Restyle with AI"
        width="form"
        dismissible={!loading && !applying}
        initialFocusRef={textareaRef}
        footer={
          preview ? (
            <>
              <Button type="button" variant="ghost" onClick={close} disabled={applying}>
                Keep current look
              </Button>
              <Button type="button" loading={applying} loadingLabel="Applying..." onClick={apply}>
                Use the new look
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={close} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="button"
                loading={loading}
                loadingLabel="Preparing..."
                onClick={getPreview}
                disabled={instruction.trim().length < 3}
              >
                Preview change
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="restyle-instruction">What should change?</Label>
            <Textarea
              id="restyle-instruction"
              ref={textareaRef}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value.slice(0, 300))}
              placeholder="For example: warmer colours, softer corners and a calm, airy feel."
              maxLength={300}
              disabled={loading || applying}
              className="min-h-[110px]"
            />
            <p className="text-sm text-text-muted">
              {instruction.length}/300. This changes the look only, never your words or pages.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "Warmer and friendlier",
              "More premium",
              "Bolder and brighter",
              "Calmer and simpler",
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setInstruction(idea)}
                disabled={loading || applying}
                className="min-h-9 rounded-pill border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-muted"
              >
                {idea}
              </button>
            ))}
          </div>

          {error ? (
            <p role="alert" className="rounded-input bg-danger-soft px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="flex flex-col gap-3 rounded-input border border-border bg-surface-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text">
                  {preview.changes.length > 0
                    ? `${preview.changes.length} ${preview.changes.length === 1 ? "change" : "changes"}`
                    : "No visible change"}
                </p>
                <span className="rounded-pill bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted">
                  {Math.round(preview.report.accuracy * 100)}% match
                </span>
              </div>
              {preview.changes.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {preview.changes.map((change) => (
                    <li key={`${change.area}-${change.from}-${change.to}`} className="text-sm text-text">
                      <span className="font-semibold capitalize">{change.area}</span>
                      {change.from && change.to ? (
                        <span className="text-text-muted">: {change.from} to {change.to}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">
                  Try a more specific request, such as a colour or a different hero.
                </p>
              )}
              {preview.unsupported.length > 0 ? (
                <div className="border-t border-border pt-2">
                  <p className="text-sm font-semibold text-text">We could not do this:</p>
                  {preview.unsupported.map((item) => (
                    <p key={item.text} className="text-sm text-text-muted">
                      {item.text}
                      {item.nearest ? ` Try: ${item.nearest}` : ""}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-text-muted">
                Preview is saved for you. Nothing changes until you choose the new look.
                {preview.credits > 0 ? ` Used ${preview.credits} credits.` : " No credits used."}
              </p>
            </div>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export function LookAndFeel({
  projectId,
  initial,
}: {
  projectId: string;
  initial: DesignPrefs;
}) {
  const [prefs, setPrefs] = useState<DesignPrefs>(initial);
  const router = useRouter();

  function update<K extends keyof DesignPrefs>(key: K, value: DesignPrefs[K]) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  function toggleStyle(style: string) {
    setPrefs((current) => {
      if (current.styles.includes(style)) {
        return { ...current, styles: current.styles.filter((item) => item !== style) };
      }
      if (current.styles.length >= 3) return current;
      return { ...current, styles: [...current.styles, style] };
    });
  }

  function toggleSection(section: string, group: "include" | "exclude") {
    setPrefs((current) => {
      const list = current[group];
      const active = list.includes(section);
      const next = active
        ? list.filter((item) => item !== section)
        : [...list, section];
      const other = group === "include" ? "exclude" : "include";
      return {
        ...current,
        [group]: next,
        [other]: current[other].filter((item) => item !== section),
      };
    });
  }

  return (
    <AppCard className="p-6">
      <input type="hidden" name="design_prefs" value={JSON.stringify(prefs)} />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">Look and feel</h2>
            <p className="mt-1 max-w-xl text-sm text-text-muted">
              Set a starting point for colours, type and spacing. These are defaults,
              not rules; you can change any of them later.
            </p>
          </div>
          <RestyleDialog
            projectId={projectId}
            onApplied={() => router.refresh()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">Style words</span>
          <div className="flex flex-wrap gap-2">
            {DESIGN_STYLES.map((style) => (
              <ToggleChip
                key={style}
                active={prefs.styles.includes(style)}
                onClick={() => toggleStyle(style)}
                disabled={!prefs.styles.includes(style) && prefs.styles.length >= 3}
              >
                {style}
              </ToggleChip>
            ))}
          </div>
          <p className="text-xs text-text-muted">Choose up to 3.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-primary">Main colour</Label>
            <div className="flex items-center gap-2">
              <input
                id="design-primary"
                type="color"
                value={prefs.primary ?? "#0f766e"}
                onChange={(event) => update("primary", event.target.value)}
                className="h-11 w-14 cursor-pointer rounded-input border border-border bg-surface p-1"
              />
              <span className="text-sm text-text-muted">
                {prefs.primary ? prefs.primary.toUpperCase() : "Let AI choose"}
              </span>
              {prefs.primary ? (
                <button
                  type="button"
                  onClick={() => update("primary", null)}
                  className="ml-auto inline-flex h-9 items-center gap-1 rounded-input px-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
                >
                  <X size={14} strokeWidth={2} aria-hidden />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-accent">Accent colour</Label>
            <div className="flex items-center gap-2">
              <input
                id="design-accent"
                type="color"
                value={prefs.accent ?? "#f59e0b"}
                onChange={(event) => update("accent", event.target.value)}
                className="h-11 w-14 cursor-pointer rounded-input border border-border bg-surface p-1"
              />
              <span className="text-sm text-text-muted">
                {prefs.accent ? prefs.accent.toUpperCase() : "Let AI choose"}
              </span>
              {prefs.accent ? (
                <button
                  type="button"
                  onClick={() => update("accent", null)}
                  className="ml-auto inline-flex h-9 items-center gap-1 rounded-input px-2 text-sm font-semibold text-text-muted hover:bg-surface-muted"
                >
                  <X size={14} strokeWidth={2} aria-hidden />
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <Segmented
          label="Background"
          value={prefs.background === "auto" ? null : prefs.background}
          options={[
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
          ]}
          onChange={(value) => update("background", value ?? "auto")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-feel">Font mood</Label>
            <select
              id="design-feel"
              value={prefs.fontFeel ?? ""}
              onChange={(event) =>
                update("fontFeel", (event.target.value || null) as DesignPrefs["fontFeel"])
              }
              className="h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-base text-text"
            >
              <option value="">Let AI choose</option>
              {DESIGN_FEELS.map((feel) => (
                <option key={feel} value={feel}>
                  {FEEL_LABELS[feel]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="design-font">A font you like</Label>
            <Input
              id="design-font"
              list="design-font-options"
              value={prefs.fontName ?? ""}
              onChange={(event) => update("fontName", event.target.value.trim() || null)}
              placeholder="Optional, for example Fraunces"
              maxLength={60}
            />
            <datalist id="design-font-options">
              {FONT_CATALOGUE.map((font) => (
                <option key={font.id} value={font.id} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">Hero</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button
              type="button"
              aria-pressed={prefs.hero === null}
              onClick={() => update("hero", null)}
              className={cn(
                "flex flex-col gap-2 rounded-input border p-2 text-left transition-colors",
                prefs.hero === null
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-surface hover:bg-surface-muted",
              )}
            >
              <span className="flex h-14 w-full items-center justify-center rounded-md bg-surface-muted text-sm font-semibold text-text-muted">
                Let AI choose
              </span>
              <span className="text-sm font-semibold text-text">Auto</span>
            </button>
            {HERO_LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                type="button"
                aria-pressed={prefs.hero === layout.id}
                onClick={() => update("hero", layout.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-input border p-2 text-left transition-colors",
                  prefs.hero === layout.id
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:bg-surface-muted",
                )}
              >
                <HeroSketch id={layout.id} />
                <span className="text-sm font-semibold text-text">{layout.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Segmented
            label="Spacing"
            value={prefs.density}
            options={DESIGN_OPTIONS.density.map((item) => ({ id: item.id as DesignPrefs["density"] & string, label: item.label }))}
            onChange={(value) => update("density", value)}
          />
          <Segmented
            label="Corners"
            value={prefs.corners}
            options={DESIGN_OPTIONS.corners.map((item) => ({ id: item.id as DesignPrefs["corners"] & string, label: item.label }))}
            onChange={(value) => update("corners", value)}
          />
        </div>

        <Segmented
          label="Buttons"
          value={prefs.buttonShape}
          options={DESIGN_OPTIONS.buttons.map((item) => ({ id: item.id as DesignPrefs["buttonShape"] & string, label: item.label }))}
          onChange={(value) => update("buttonShape", value)}
        />

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text">Must include</span>
            <div className="flex flex-wrap gap-2">
              {DESIGN_SECTIONS.map((section) => (
                <ToggleChip
                  key={`include-${section}`}
                  active={prefs.include.includes(section)}
                  onClick={() => toggleSection(section, "include")}
                >
                  {section}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text">Leave out</span>
            <div className="flex flex-wrap gap-2">
              {DESIGN_SECTIONS.map((section) => (
                <ToggleChip
                  key={`exclude-${section}`}
                  active={prefs.exclude.includes(section)}
                  onClick={() => toggleSection(section, "exclude")}
                >
                  {section}
                </ToggleChip>
              ))}
            </div>
          </div>
          <p className="text-xs text-text-muted">
            Section choices apply the next time AI builds or restyles a page.
          </p>
        </div>
      </div>
    </AppCard>
  );
}
