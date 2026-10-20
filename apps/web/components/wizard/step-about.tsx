"use client";

import { Label, Textarea } from "@/components/ui/input";

const MAX_ABOUT = 300;

export function StepAbout({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="about">About your business (optional)</Label>
      <div className="relative mt-2">
        <Textarea
          id="about"
          value={value}
          maxLength={MAX_ABOUT}
          onChange={(event) => onChange(event.target.value.slice(0, MAX_ABOUT))}
          placeholder="For example: We bake fresh bread and cakes every morning and deliver across town."
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-2 right-3 text-xs text-text-muted"
        >
          {value.length}/{MAX_ABOUT}
        </span>
      </div>
    </div>
  );
}
