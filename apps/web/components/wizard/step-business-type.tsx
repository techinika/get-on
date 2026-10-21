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
import { BUSINESS_TYPE_LABELS, type BusinessTypeLabel } from "@/lib/business-types";
import { useRadioGroup } from "./use-radio-group";

const BUSINESS_TYPE_ICONS: Record<BusinessTypeLabel, LucideIcon> = {
  "Restaurant or cafe": UtensilsCrossed,
  "Salon or beauty": Scissors,
  Shop: ShoppingBag,
  "Photographer or creative": Camera,
  "Consultant or freelancer": Briefcase,
  "Church or community": Users,
  "Repairs and services": Wrench,
  "Farm or agriculture": Sprout,
  "Teaching or tutoring": GraduationCap,
  "Something else": Sparkles,
};

const BUSINESS_TYPES: ReadonlyArray<{ label: BusinessTypeLabel; Icon: LucideIcon }> =
  BUSINESS_TYPE_LABELS.map((label) => ({ label, Icon: BUSINESS_TYPE_ICONS[label] }));

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
