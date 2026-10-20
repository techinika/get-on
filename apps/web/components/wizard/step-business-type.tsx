"use client";

import {
  Briefcase,
  Camera,
  CircleCheck,
  GraduationCap,
  Scissors,
  ShoppingBag,
  Sparkles,
  Sprout,
  Users,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRadioGroup } from "./use-radio-group";

const BUSINESS_TYPES: ReadonlyArray<{ label: string; Icon: LucideIcon }> = [
  { label: "Restaurant or cafe", Icon: UtensilsCrossed },
  { label: "Salon or beauty", Icon: Scissors },
  { label: "Shop", Icon: ShoppingBag },
  { label: "Photographer or creative", Icon: Camera },
  { label: "Consultant or freelancer", Icon: Briefcase },
  { label: "Church or community", Icon: Users },
  { label: "Repairs and services", Icon: Wrench },
  { label: "Farm or agriculture", Icon: Sprout },
  { label: "Teaching or tutoring", Icon: GraduationCap },
  { label: "Something else", Icon: Sparkles },
];

const OPTION_LABELS = BUSINESS_TYPES.map((type) => type.label);

export function StepBusinessType({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { getOptionProps } = useRadioGroup(OPTION_LABELS, value || null, onChange);

  return (
    <div
      role="radiogroup"
      aria-label="Business type"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
    >
      {BUSINESS_TYPES.map(({ label, Icon }, index) => {
        const selected = value === label;
        return (
          <div
            key={label}
            {...getOptionProps(index)}
            className={cn(
              "relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-info border-[1.5px] border-border-strong bg-surface p-4 text-center transition-colors hover:border-primary",
              selected && "border-2 border-primary bg-primary-soft",
            )}
          >
            {selected ? (
              <CircleCheck
                size={20}
                strokeWidth={2}
                aria-hidden
                className="absolute right-2 top-2 fill-primary text-on-primary"
              />
            ) : null}
            <Icon size={32} strokeWidth={1.75} aria-hidden className="text-primary" />
            <span className="text-base font-semibold leading-tight">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
