"use client";

import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { HERO_LAYOUTS } from "@get-on/blocks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  DESIGN_FEELS,
  DESIGN_SECTIONS,
  DESIGN_STYLES,
  type DesignPrefs,
} from "@/lib/ai/design-prefs";
import { cn } from "@/lib/utils";
import {
  previewWizardDesignLooks,
  type DesignLookPreview,
} from "./design-actions";

const MAX_BRIEF = 400;

const EXAMPLE_CHIPS = [
  "Modern and minimal",
  "Warm and friendly, earthy colours",
  "Dark and bold with neon accents",
  "Elegant, serif headings, lots of white space",
  "Playful and colourful",
];

const FEEL_LABELS: Record<string, string> = {
  modern: "Modern sans",
  elegant: "Classic serif",
  friendly: "Friendly rounded",
  bold: "Bold display",
  techy: "Techy mono",
  classic: "Classic",
  quirky: "Playful",
};

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-semibold transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-surface text-text hover:bg-surface-muted",
      )}
    >
      {active ? <Check size={14} strokeWidth={2.5} aria-hidden /> : null}
      {children}
    </button>
  );
}

function Swatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="relative inline-flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border-strong bg-surface">
        <span
          aria-hidden
          className="absolute inset-1 rounded-full"
          style={{ backgroundColor: value ?? "transparent" }}
        />
        {!value ? (
          <span aria-hidden className="relative text-xs font-semibold text-text-muted">
            Auto
          </span>
        ) : null}
        <input
          type="color"
          aria-label={label}
          value={value ?? "#0B6B4F"}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-text-muted">{value ?? "Let AI choose"}</p>
      </div>
      {value ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-auto text-xs font-semibold text-text-muted underline underline-offset-2 hover:text-text"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function toggle(list: string[], value: string, max?: number): string[] {
  if (list.includes(value)) return list.filter((item) => item !== value);
  if (max && list.length >= max) return list;
  return [...list, value];
}

function LookCard({
  look,
  selected,
  onSelect,
}: {
  look: DesignLookPreview;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[16px] border bg-surface transition-colors",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary",
      )}
    >
      <div className="aspect-[16/10] w-full overflow-hidden border-b border-border bg-surface-muted">
        <iframe
          title={`${look.name} preview`}
          srcDoc={look.previewHtml}
          sandbox=""
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none h-full w-full"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text">{look.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">{look.description}</p>
          </div>
          <div className="flex shrink-0 -space-x-1.5" aria-hidden>
            {look.colors.slice(0, 5).map((color) => (
              <span
                key={color}
                className="h-5 w-5 rounded-full border-2 border-surface"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-text-muted">
          <span className="rounded-pill bg-surface-muted px-2 py-1">{look.hero} hero</span>
          <span className="rounded-pill bg-surface-muted px-2 py-1">{look.header} header</span>
          <span className="rounded-pill bg-surface-muted px-2 py-1">
            {look.pages} {look.pages === 1 ? "page" : "pages"}
          </span>
        </div>
        <Button
          type="button"
          variant={selected ? "secondary" : "primary"}
          size="md"
          onClick={onSelect}
          className="mt-4 w-full"
        >
          {selected ? (
            <>
              <Check size={16} strokeWidth={2.5} aria-hidden />
              Chosen
            </>
          ) : (
            "Use this look"
          )}
        </Button>
      </div>
    </div>
  );
}

export function StepDesign({
  name,
  businessType,
  about,
  prefs,
  brief,
  looks,
  selectedIndex,
  onPrefsChange,
  onBriefChange,
  onLooksChange,
  onSelectLook,
}: {
  name: string;
  businessType: string;
  about: string;
  prefs: DesignPrefs;
  brief: string;
  looks: DesignLookPreview[];
  selectedIndex: number | null;
  onPrefsChange: (prefs: DesignPrefs) => void;
  onBriefChange: (brief: string) => void;
  onLooksChange: (looks: DesignLookPreview[]) => void;
  onSelectLook: (index: number | null, name: string | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<DesignPrefs>) => {
    onPrefsChange({ ...prefs, ...patch });
    onSelectLook(null, null);
    onLooksChange([]);
  };

  const updateBrief = (value: string) => {
    onBriefChange(value);
    onSelectLook(null, null);
    onLooksChange([]);
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await previewWizardDesignLooks({
        name,
        businessType,
        about,
        brief,
        prefs,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onLooksChange(result.looks);
      onSelectLook(null, null);
    } catch {
      setError("We could not draw those looks. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="design-brief">Describe the look you want (optional)</Label>
        <div className="relative mt-2">
          <Textarea
            id="design-brief"
            value={brief}
            maxLength={MAX_BRIEF}
            onChange={(event) => updateBrief(event.target.value.slice(0, MAX_BRIEF))}
            placeholder="For example: Modern and clean, deep green and cream, serif headings, big photo at the top, lots of white space."
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-3 text-xs text-text-muted"
          >
            {brief.length}/{MAX_BRIEF}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLE_CHIPS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => updateBrief(example)}
              className="min-h-9 rounded-pill border border-border bg-surface px-3 text-xs font-semibold text-text-muted hover:border-primary hover:text-text"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Style</p>
        <p className="mt-0.5 text-xs text-text-muted">Pick up to 3.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESIGN_STYLES.map((style) => (
            <Chip
              key={style}
              active={prefs.styles.includes(style)}
              onClick={() => update({ styles: toggle(prefs.styles, style, 3) })}
            >
              {style}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Swatch
          label="Main colour"
          value={prefs.primary}
          onChange={(primary) => update({ primary })}
        />
        <Swatch
          label="Accent colour"
          value={prefs.accent}
          onChange={(accent) => update({ accent })}
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Background</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ["auto", "Let AI choose"],
            ["light", "Light"],
            ["dark", "Dark"],
          ].map(([value, label]) => (
            <Chip
              key={value}
              active={prefs.background === value}
              onClick={() =>
                update({ background: value as DesignPrefs["background"] })
              }
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Fonts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Chip active={prefs.fontFeel === null} onClick={() => update({ fontFeel: null })}>
            Let AI choose
          </Chip>
          {DESIGN_FEELS.map((feel) => (
            <Chip
              key={feel}
              active={prefs.fontFeel === feel}
              onClick={() => update({ fontFeel: feel })}
            >
              {FEEL_LABELS[feel] ?? feel}
            </Chip>
          ))}
        </div>
        <div className="mt-3">
          <Label htmlFor="design-font">Or name a font</Label>
          <Input
            id="design-font"
            value={prefs.fontName ?? ""}
            maxLength={60}
            onChange={(event) => update({ fontName: event.target.value || null })}
            placeholder="For example: Playfair Display"
            className="mt-2"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Top of the page</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => update({ hero: null })}
            className={cn(
              "min-h-12 rounded-[12px] border px-3 text-left text-sm font-semibold",
              prefs.hero === null
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-text hover:border-primary",
            )}
          >
            Let AI choose
          </button>
          {HERO_LAYOUTS.map((hero) => (
            <button
              key={hero.id}
              type="button"
              onClick={() => update({ hero: hero.id })}
              className={cn(
                "min-h-12 rounded-[12px] border px-3 text-left text-sm font-semibold",
                prefs.hero === hero.id
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-surface text-text hover:border-primary",
              )}
            >
              {hero.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm font-semibold text-text">Spacing</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["airy", "Airy"],
              ["comfortable", "Balanced"],
              ["compact", "Compact"],
            ].map(([value, label]) => (
              <Chip
                key={value}
                active={prefs.density === value}
                onClick={() => update({ density: value as DesignPrefs["density"] })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Corners</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["round", "Round"],
              ["soft", "Soft"],
              ["sharp", "Sharp"],
            ].map(([value, label]) => (
              <Chip
                key={value}
                active={prefs.corners === value}
                onClick={() => update({ corners: value as DesignPrefs["corners"] })}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-text">Buttons</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ["pill", "Pill"],
              ["round", "Rounded"],
              ["square", "Square"],
            ].map(([value, label]) => (
              <Chip
                key={value}
                active={prefs.buttonShape === value}
                onClick={() =>
                  update({ buttonShape: value as DesignPrefs["buttonShape"] })
                }
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-text">Sections</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Include or leave out anything you like.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DESIGN_SECTIONS.map((section) => {
            const included = prefs.include.includes(section);
            const excluded = prefs.exclude.includes(section);
            return (
              <div key={section} className="flex overflow-hidden rounded-pill border border-border">
                <button
                  type="button"
                  aria-pressed={included}
                  onClick={() =>
                    update({
                      include: toggle(prefs.include, section),
                      exclude: prefs.exclude.filter((item) => item !== section),
                    })
                  }
                  className={cn(
                    "min-h-10 px-3 text-xs font-semibold",
                    included ? "bg-primary-soft text-primary" : "bg-surface text-text-muted",
                  )}
                >
                  {included ? "Include" : "Add"} {section}
                </button>
                <button
                  type="button"
                  aria-pressed={excluded}
                  onClick={() =>
                    update({
                      exclude: toggle(prefs.exclude, section),
                      include: prefs.include.filter((item) => item !== section),
                    })
                  }
                  className={cn(
                    "min-h-10 border-l border-border px-3 text-xs font-semibold",
                    excluded ? "bg-danger-soft text-danger-text" : "bg-surface text-text-muted",
                  )}
                >
                  Leave out
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-info border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="primary" size="md" onClick={generate} disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <Sparkles size={16} strokeWidth={2} aria-hidden />
            )}
            {loading ? "Drawing looks..." : "Show me 3 looks"}
          </Button>
          <p className="text-xs text-text-muted">
            You can skip this. We will use your choices and pick the first look for you.
          </p>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger-text">
            {error}
          </p>
        ) : null}
        {looks.length > 0 ? (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {looks.map((look, index) => (
              <LookCard
                key={look.key}
                look={look}
                selected={selectedIndex === index}
                onSelect={() => onSelectLook(index, look.name)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
