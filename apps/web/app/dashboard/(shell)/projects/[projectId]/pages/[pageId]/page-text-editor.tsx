"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Undo2 } from "lucide-react";
import { AppCard } from "@/components/app/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { savePageText, writeFieldWithAi } from "./ai-actions";
import type { AiTextActionResult } from "@/lib/ai/actions";

export type PageTextField = {
  id: string;
  text: string;
  label: string;
  maxLength?: number;
};

type Props = {
  projectId: string;
  pageId: string;
  fields: PageTextField[];
};

type ActionPreset = {
  key: string;
  label: string;
  mode: "write" | "improve";
};

const PRESETS: ActionPreset[] = [
  { key: "write", label: "Write it for me", mode: "write" },
  { key: "shorter", label: "Make it shorter", mode: "improve" },
  { key: "longer", label: "Make it longer", mode: "improve" },
  { key: "fix", label: "Fix spelling and grammar", mode: "improve" },
  { key: "friendly", label: "Make it friendlier", mode: "improve" },
  { key: "pro", label: "Make it more professional", mode: "improve" },
  { key: "simple", label: "Use simpler words", mode: "improve" },
  { key: "again", label: "Write it again differently", mode: "improve" },
];

function instructionFor(preset: ActionPreset, label: string): string {
  switch (preset.key) {
    case "write":
      return `Write text for ${label}. Keep it short and natural.`;
    case "shorter":
      return `Make this shorter for ${label}. Keep it natural.`;
    case "longer":
      return `Make this longer for ${label}. Add useful detail without sounding forced.`;
    case "fix":
      return `Fix spelling and grammar for ${label}. Do not change meaning.`;
    case "friendly":
      return `Make this friendlier for ${label}. Keep it clear and plain.`;
    case "pro":
      return `Make this more professional for ${label}. Keep it plain.`;
    case "simple":
      return `Use simpler words for ${label}. Keep sentences short.`;
    case "again":
      return `Write this again differently for ${label}. Keep a similar length.`;
    default:
      return `Improve this for ${label}. Keep it short and natural.`;
  }
}

export function PageTextEditor({ projectId, pageId, fields: initial }: Props) {
  const [fields, setFields] = React.useState<PageTextField[]>(initial);
  const [history, setHistory] = React.useState<Array<Record<string, string>>>(
    [],
  );
  const [active, setActive] = React.useState<PageTextField | null>(null);
  const [custom, setCustom] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<AiTextActionResult | null>(null);
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const dirty = React.useMemo(() => {
    const base = new Map(initial.map((f) => [f.id, f.text]));
    return fields.some((f) => (base.get(f.id) ?? "") !== f.text);
  }, [fields, initial]);

  function open(field: PageTextField) {
    setActive(field);
    setCustom("");
    setResult(null);
    setBusy(false);
  }

  async function run(preset: ActionPreset) {
    if (!active) return;
    setBusy(true);
    setResult(null);
    const text = active.text.trim();
    const mode = text.length === 0 ? "write" : preset.mode;
    const instruction = preset.key === "write" && custom.trim().length > 0
      ? custom.trim()
      : instructionFor(preset, active.label);
    const res = await writeFieldWithAi({
      projectId,
      text: active.text,
      instruction,
      mode,
    });
    setResult(res);
    setBusy(false);
  }

  async function runCustom() {
    if (!active) return;
    const c = custom.trim();
    if (!c) return;
    setBusy(true);
    setResult(null);
    const text = active.text.trim();
    const mode = text.length === 0 ? "write" : "improve";
    const res = await writeFieldWithAi({
      projectId,
      text: active.text,
      instruction: c,
      mode,
    });
    setResult(res);
    setBusy(false);
  }

  function useResult() {
    if (!active || !result || !result.ok) return;
    const prev = new Map(fields.map((f) => [f.id, f.text]));
    setHistory((h) => [...h, Object.fromEntries(prev)]);
    setFields((list) =>
      list.map((f) => (f.id === active.id ? { ...f, text: result.text } : f)),
    );
    setActive(null);
    setResult(null);
    toast("Updated this field.", "success");
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setFields((list) => list.map((f) => ({ ...f, text: last[f.id] ?? f.text })));
    setHistory((h) => h.slice(0, -1));
  }

  async function save() {
    const base = new Map(initial.map((f) => [f.id, f.text]));
    const updates = fields
      .filter((f) => (base.get(f.id) ?? "") !== f.text)
      .map((f) => ({ id: f.id, text: f.text }));
    if (updates.length === 0) {
      toast("Nothing to save.", "info");
      return;
    }
    setSaving(true);
    const res = await savePageText({ projectId, pageId, updates });
    setSaving(false);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    toast("Text updated.", "success");
    setHistory([]);
    router.refresh();
  }

  if (fields.length === 0) {
    return (
      <AppCard>
        <div className="p-6">
          <p className="text-[15px] font-semibold text-text">Edit text</p>
          <p className="mt-1 text-sm text-text-muted">
            This page has no editable text fields yet.
          </p>
        </div>
      </AppCard>
    );
  }

  return (
    <>
      <AppCard>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-[15px] font-semibold text-text">Edit text</p>
            <p className="mt-1 text-sm text-text-muted">
              Change text on this page. Use AI to write or improve any field.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={history.length === 0}
              onClick={undo}
            >
              <Undo2 size={16} className="mr-1.5" aria-hidden />
              Undo last change
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={!dirty || saving}
              onClick={save}
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
        <div className="divide-y divide-border border-t border-border">
          {fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text">{field.label}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label={`Use AI for ${field.label}`}
                  onClick={() => open(field)}
                >
                  <Sparkles size={16} className="mr-1.5" aria-hidden />
                  Use AI
                </Button>
              </div>
              {field.maxLength && field.maxLength <= 80 ? (
                <Input
                  value={field.text}
                  maxLength={field.maxLength}
                  onChange={(e) =>
                    setFields((list) =>
                      list.map((f) =>
                        f.id === field.id ? { ...f, text: e.target.value } : f,
                      ),
                    )
                  }
                />
              ) : (
                <Textarea
                  value={field.text}
                  maxLength={field.maxLength}
                  rows={field.maxLength && field.maxLength <= 160 ? 3 : 5}
                  onChange={(e) =>
                    setFields((list) =>
                      list.map((f) =>
                        f.id === field.id ? { ...f, text: e.target.value } : f,
                      ),
                    )
                  }
                />
              )}
            </div>
          ))}
        </div>
      </AppCard>

      <Dialog
        open={active !== null}
        onClose={() => {
          if (busy) return;
          setActive(null);
          setResult(null);
        }}
        title={active ? `AI for ${active.label}` : "Use AI"}
        width="form"
      >
        {!result ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.key}
                  variant="secondary"
                  size="sm"
                  type="button"
                  disabled={busy}
                  onClick={() => run(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text">Tell AI what to do</label>
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. Write a headline about our service"
                disabled={busy}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  type="button"
                  disabled={busy || custom.trim().length === 0}
                  onClick={runCustom}
                >
                  {busy ? "Writing..." : "Run"}
                </Button>
              </div>
            </div>
          </div>
        ) : result.ok ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-text">Suggested text</p>
              <p className="mt-2 whitespace-pre-wrap rounded-input border border-border bg-surface-muted p-3 text-sm text-text">
                {result.text}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setResult(null);
                  setBusy(false);
                }}
              >
                Try again
              </Button>
              <Button size="sm" type="button" onClick={useResult}>
                Use this
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-danger-text">{result.message}</p>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  setResult(null);
                  setBusy(false);
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
