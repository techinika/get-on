"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Plus, Sparkles, X } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { InfoBox } from "@/components/app/info-box";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { TONES } from "./tone-options";
import type { DesignPrefs } from "@/lib/ai/design-prefs";
import { LookAndFeel } from "./look-and-feel";
import { saveWritingStyle } from "./actions";

type Fact = { label: string; value: string };

type Initial = {
  tones: string[];
  audience: string;
  wordsToUse: string[];
  wordsToAvoid: string[];
  facts: Fact[];
  designPrefs: DesignPrefs;
};

function TagField({
  id,
  label,
  name,
  values,
  onChange,
  placeholder,
  helper,
  max = 10,
}: {
  id: string;
  label: string;
  name: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  helper: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim().slice(0, 24);
    setDraft("");
    if (!value || values.length >= max) return;
    if (values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex h-8 items-center gap-1 rounded-pill border border-border bg-surface-muted pl-3 pr-1.5 text-sm font-medium text-text"
            >
              {value}
              <button
                type="button"
                aria-label={`Remove ${value}`}
                onClick={() => onChange(values.filter((item) => item !== value))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-text"
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={values.length >= max ? "That is enough for now" : placeholder}
        maxLength={24}
        disabled={values.length >= max}
      />
      <p className="text-sm text-text-muted">{helper}</p>
      {values.map((value) => (
        <input key={value} type="hidden" name={name} value={value} />
      ))}
      {draft.trim() ? (
        <input type="hidden" name={name} value={draft.trim().slice(0, 24)} />
      ) : null}
    </div>
  );
}

export function WritingStyleForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: Initial;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tones, setTones] = useState<string[]>(initial.tones);
  const [audience, setAudience] = useState(initial.audience);
  const [wordsToUse, setWordsToUse] = useState<string[]>(initial.wordsToUse);
  const [wordsToAvoid, setWordsToAvoid] = useState<string[]>(initial.wordsToAvoid);
  const [facts, setFacts] = useState<Fact[]>(
    initial.facts.length > 0 ? initial.facts : [{ label: "", value: "" }],
  );

  function toggleTone(tone: string) {
    if (tones.includes(tone)) {
      setTones(tones.filter((item) => item !== tone));
      return;
    }
    if (tones.length < 3) setTones([...tones, tone]);
  }

  function updateFact(index: number, patch: Partial<Fact>) {
    setFacts(facts.map((fact, factIndex) => (factIndex === index ? { ...fact, ...patch } : fact)));
  }

  async function onSubmit(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await saveWritingStyle(projectId, formData);
    setSaving(false);
    if (result.ok) {
      setMessage("Saved. AI will use this the next time it writes.");
      toast("Saved");
    } else {
      setMessage(result.error);
    }
  }

  return (
    <form action={onSubmit} className="flex max-w-[760px] flex-col gap-6">
      <InfoBox>
        AI uses these details when it writes for you. It never makes up reviews, awards,
        prices or numbers.
      </InfoBox>

      <AppCard className="p-6">
        <h2 className="text-h3 text-text">How should it sound?</h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose up to 3. You can change this at any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TONES.map((tone) => {
            const active = tones.includes(tone);
            return (
              <button
                key={tone}
                type="button"
                aria-pressed={active}
                disabled={!active && tones.length >= 3}
                onClick={() => toggleTone(tone)}
                className={`h-11 rounded-pill border px-4 text-sm font-semibold transition-colors ${
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border-strong bg-surface text-text hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                }`}
              >
                {tone}
              </button>
            );
          })}
        </div>
        {tones.map((tone) => (
          <input key={tone} type="hidden" name="tones" value={tone} />
        ))}
      </AppCard>

      <AppCard className="p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="audience" optional>
            Who are your customers?
          </Label>
          <Textarea
            id="audience"
            name="audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
            placeholder="For example: local families who want a simple, healthy lunch"
            maxLength={200}
            className="min-h-[100px]"
          />
          <p className="text-sm text-text-muted">
            A short sentence about your customers helps AI choose the right words.
          </p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TagField
            id="words_use"
            label="Words to use"
            name="words_use"
            values={wordsToUse}
            onChange={setWordsToUse}
            placeholder="Add a word or phrase"
            helper="Press Enter after each word or phrase."
          />
          <TagField
            id="words_avoid"
            label="Words to avoid"
            name="words_avoid"
            values={wordsToAvoid}
            onChange={setWordsToAvoid}
            placeholder="Add a word or phrase"
            helper="Press Enter after each word or phrase."
          />
        </div>
      </AppCard>

      <AppCard className="p-6">
        <h2 className="text-h3 text-text">Facts AI may use</h2>
        <p className="mt-1 text-sm text-text-muted">
          AI may only use numbers and claims that you write here or in your own text.
        </p>
        <div className="mt-4 hidden gap-3 text-sm font-semibold text-text sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_44px]">
          <span>What</span>
          <span>Detail</span>
          <span className="sr-only">Remove</span>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:mt-2">
          {facts.map((fact, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_44px]">
              <Input
                aria-label={`What (fact ${index + 1})`}
                name="fact_label"
                value={fact.label}
                onChange={(event) => updateFact(index, { label: event.target.value })}
                placeholder="For example: Open since 2012"
                maxLength={40}
              />
              <Input
                aria-label={`Detail (fact ${index + 1})`}
                name="fact_value"
                value={fact.value}
                onChange={(event) => updateFact(index, { value: event.target.value })}
                placeholder="For example: Free delivery in Kigali"
                maxLength={120}
              />
              <button
                type="button"
                aria-label={`Remove fact ${index + 1}`}
                onClick={() => setFacts(facts.filter((_, factIndex) => factIndex !== index))}
                className="inline-flex h-12 w-11 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted hover:text-text"
              >
                <X size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          ))}
        </div>
        {facts.length < 20 ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => setFacts([...facts, { label: "", value: "" }])}
          >
            <Plus size={16} strokeWidth={2} aria-hidden />
            Add a fact
          </Button>
        ) : null}
      </AppCard>

      <LookAndFeel projectId={projectId} initial={initial.designPrefs} />

      <AppCard className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-text">Language</h2>
              <p className="mt-1 text-sm text-text-muted">
                English is the only language for now.
              </p>
              <Link
                href={`/dashboard/projects/${projectId}/settings/business`}
                className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                Business details
              </Link>
            </div>
            <span className="rounded-pill bg-surface-muted px-3 py-1 text-sm font-semibold text-text-muted">
              English
            </span>
          </div>
          <div className="border-t border-border pt-4">
            <Link
              href={`/dashboard/projects/${projectId}/settings/ai-history`}
              className="flex min-h-11 items-center justify-between gap-3 text-[15px] font-semibold text-primary hover:underline"
            >
              <span className="inline-flex items-center gap-2">
                <Sparkles size={18} strokeWidth={1.75} aria-hidden />
                See what AI wrote and what it cost
              </span>
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>
      </AppCard>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={saving} loadingLabel="Saving...">
          Save writing style
        </Button>
        {message ? (
          <p className="text-sm text-text-muted" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
