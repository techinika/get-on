"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/logo";
import { TOTAL_STEPS } from "./types";

export function WizardTopBar({ onExit }: { onExit: () => void }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <span className="inline-flex items-center gap-2">
        <Wordmark className="h-7 w-auto" />
      </span>
      <Button type="button" variant="ghost" size="md" onClick={onExit}>
        <X size={18} strokeWidth={1.75} aria-hidden />
        Save and exit
      </Button>
    </header>
  );
}

export function WizardProgress({ step }: { step: number }) {
  const percent = Math.round((step / TOTAL_STEPS) * 100);
  return (
    <div
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      aria-valuenow={step}
      className="h-1 w-full shrink-0 bg-border"
    >
      <div
        className="h-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function WizardActions({
  showBack,
  onBack,
  onContinue,
  continueDisabled,
  continueLabel = "Continue",
  continueLoading = false,
  continueLoadingLabel,
}: {
  showBack: boolean;
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
  continueLoading?: boolean;
  continueLoadingLabel?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-5 pt-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] md:static md:z-auto md:mt-10 md:border-t-0 md:bg-transparent md:px-0 md:pt-0 md:pb-0">
      <div className="flex h-12 items-center gap-3 md:h-auto">
        {showBack ? (
          <Button type="button" variant="ghost" size="md" onClick={onBack} className="shrink-0">
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={onContinue}
          disabled={continueDisabled}
          loading={continueLoading}
          loadingLabel={continueLoadingLabel}
          className="min-w-0 flex-1 md:ml-auto md:min-w-40 md:flex-none"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
