"use client";

import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FREE_SUFFIX } from "@/lib/address";
import type { AddressStatusState } from "./types";

export function StepBusinessName({
  name,
  onNameChange,
  effectiveAddress,
  customAddress,
  customAddressValue,
  addressStatus,
  onToggleCustom,
  onCustomAddressChange,
  onSelectSuggestion,
}: {
  name: string;
  onNameChange: (value: string) => void;
  effectiveAddress: string;
  customAddress: boolean;
  customAddressValue: string;
  addressStatus: AddressStatusState;
  onToggleCustom: () => void;
  onCustomAddressChange: (value: string) => void;
  onSelectSuggestion: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor="business-name">Business name</Label>
      <div className="mt-2">
        <Input
          id="business-name"
          inputSize="lg"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="For example: Rose Bakery"
          autoComplete="organization"
          autoFocus
        />
      </div>

      <div className="mt-6 rounded-info bg-surface-muted p-4">
        <p className="text-caption font-bold uppercase tracking-[0.08em] text-text-muted">
          Your web address
        </p>
        <p className="mt-1 break-all text-xl font-semibold">
          {effectiveAddress ? (
            <>
              <span className="text-primary">{effectiveAddress}</span>
              <span className="text-text-muted">{FREE_SUFFIX}</span>
            </>
          ) : (
            <span className="text-text-muted">yourbusiness.get-on.tech</span>
          )}
        </p>

        <div className="mt-2 text-sm">
          {addressStatus.status === "checking" ? (
            <p className="flex items-center gap-2 text-text-muted">
              <Spinner size={16} className="shrink-0" />
              Checking...
            </p>
          ) : null}

          {addressStatus.status === "available" ? (
            <p className="flex items-center gap-2 text-success-text">
              <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              Available! This is yours.
            </p>
          ) : null}

          {addressStatus.status === "taken" ? (
            <div className="text-danger-text">
              <p className="flex items-center gap-2">
                <XCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                That one is taken. Try one of these:
              </p>
              {addressStatus.suggestions.length > 0 ? (
                <span className="mt-2 flex flex-wrap gap-2">
                  {addressStatus.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => onSelectSuggestion(suggestion)}
                      className="-my-1 py-1"
                    >
                      <span className="inline-flex h-9 items-center rounded-pill border-[1.5px] border-border-strong px-3.5 text-sm font-semibold text-text transition-colors hover:border-primary hover:text-primary">
                        {suggestion}
                        <span className="sr-only">{FREE_SUFFIX}</span>
                      </span>
                    </button>
                  ))}
                </span>
              ) : null}
            </div>
          ) : null}

          {addressStatus.status === "invalid" ? (
            <p className="flex items-center gap-2 text-danger-text">
              <AlertCircle size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              {addressStatus.reason}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggleCustom}
          className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-2 hover:underline"
        >
          {customAddress ? "Use my business name" : "Change address"}
        </button>

        {customAddress ? (
          <div className="mt-1">
            <Label htmlFor="custom-address">Web address</Label>
            <div className="mt-2">
              <Input
                id="custom-address"
                value={customAddressValue}
                onChange={(event) => onCustomAddressChange(event.target.value)}
                suffix={FREE_SUFFIX}
                placeholder="yourbusiness"
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
              />
            </div>
            <p className="mt-1.5 text-sm text-text-muted">
              Use letters, numbers and dashes only. At least 3 characters.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
