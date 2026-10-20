"use client";

import { FilePlus, Info, LayoutTemplate, Sparkles, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRadioGroup } from "./use-radio-group";
import type { StartChoice } from "./types";

const START_OPTIONS: ReadonlyArray<{
  value: StartChoice;
  label: string;
  description: string;
  Icon: LucideIcon;
  comingSoon: boolean;
}> = [
  {
    value: "ai",
    label: "Create it for me with AI",
    description: "Answer a few questions and we write your pages.",
    Icon: Sparkles,
    comingSoon: true,
  },
  {
    value: "template",
    label: "Pick a template",
    description: "Start from a ready-made design.",
    Icon: LayoutTemplate,
    comingSoon: true,
  },
  {
    value: "blank",
    label: "Start blank",
    description: "Begin with a simple page and build it yourself.",
    Icon: FilePlus,
    comingSoon: false,
  },
];

const START_VALUES: readonly StartChoice[] = ["ai", "template", "blank"];

export function StepStart({
  value,
  onChange,
}: {
  value: StartChoice;
  onChange: (value: StartChoice) => void;
}) {
  const { getOptionProps } = useRadioGroup(START_VALUES, value, onChange);

  return (
    <div>
      <div role="radiogroup" aria-label="Starting option" className="flex flex-col gap-3">
        {START_OPTIONS.map(({ value: optionValue, label, description, Icon, comingSoon }, index) => {
          const selected = value === optionValue;
          return (
            <div
              key={optionValue}
              {...getOptionProps(index)}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-[20px] border-[1.5px] border-border-strong bg-surface p-5 text-left transition-colors hover:border-primary",
                selected && "border-2 border-primary bg-primary-soft",
              )}
            >
              <span
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-info bg-accent-soft"
              >
                <Icon size={28} strokeWidth={1.75} className="text-accent-text" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{label}</span>
                  {comingSoon ? <Badge variant="accent">Coming very soon</Badge> : null}
                </span>
                <span className="mt-0.5 block text-sm text-text-muted">{description}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-primary bg-primary" : "border-border-strong",
                )}
              >
                {selected ? <span className="h-2.5 w-2.5 rounded-full bg-on-primary" /> : null}
              </span>
            </div>
          );
        })}
      </div>

      {value !== "blank" ? (
        <div className="mt-4 flex items-start gap-3 rounded-info bg-info-soft px-4 py-3.5">
          <Info size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-info-text" />
          <p className="text-sm text-info-text">
            This is coming very soon. For now we will set you up with a simple starter page you can
            build on.
          </p>
        </div>
      ) : null}
    </div>
  );
}
