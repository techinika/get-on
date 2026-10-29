"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const BOXES = 6;

export type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
};

/**
 * Six single-digit boxes. Auto-advance, backspace, paste and the browser's
 * one-time-code autofill all work. The value is always digits only.
 */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, label = "Code" }: OtpInputProps) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);
  const digits = React.useMemo(() => value.padEnd(BOXES, " ").slice(0, BOXES).split(""), [value]);

  const setDigit = (index: number, digit: string) => {
    const next = digits.map((entry, i) => (i === index ? digit : entry.trim() === "" ? " " : entry));
    const joined = next.join("").replace(/\s+$/g, "");
    onChange(joined);
    if (digit && index < BOXES - 1) refs.current[index + 1]?.focus();
    if (joined.replace(/\s/g, "").length === BOXES && onComplete) onComplete(joined.replace(/\s/g, ""));
  };

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-2">
      {Array.from({ length: BOXES }).map((_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digits[index] === " " ? "" : digits[index]}
          onChange={(event) => {
            const raw = event.target.value.replace(/\D/g, "");
            if (!raw) {
              setDigit(index, "");
              return;
            }
            if (raw.length > 1) {
              const joined = raw.slice(0, BOXES);
              onChange(joined);
              refs.current[Math.min(joined.length, BOXES - 1)]?.focus();
              if (joined.length === BOXES && onComplete) onComplete(joined);
              return;
            }
            setDigit(index, raw);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index]?.trim()) {
              event.preventDefault();
              refs.current[Math.max(0, index - 1)]?.focus();
              setDigit(Math.max(0, index - 1), "");
            }
            if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
            if (event.key === "ArrowRight" && index < BOXES - 1) refs.current[index + 1]?.focus();
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, BOXES);
            if (!pasted) return;
            onChange(pasted);
            refs.current[Math.min(pasted.length, BOXES - 1)]?.focus();
            if (pasted.length === BOXES && onComplete) onComplete(pasted);
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1} of ${BOXES}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            "h-14 w-10 rounded-xl border-[1.5px] bg-surface text-center text-2xl font-semibold text-text sm:w-12",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25",
            invalid ? "border-danger" : "border-border-strong",
          )}
        />
      ))}
    </div>
  );
}
