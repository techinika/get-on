"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle,
  ChevronLeft,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CreateSiteFlowProps = {
  conversationId: string;
  onComplete: (project: {
    id: string;
    name: string;
    subdomain: string;
  }) => void;
  onClose: () => void;
};

type Step = "form" | "preview" | "success" | "error";

export function CreateSiteFlow({
  conversationId,
  onComplete,
  onClose,
}: CreateSiteFlowProps) {
  const [step, setStep] = React.useState<Step>("form");
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [actionId, setActionId] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{
    name: string;
    address: string;
    primaryAddress: string;
    template: string | null;
    credits: number;
    warnings: string[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const templateName = "Starter";

  async function createPreview() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/agent/conversations/${conversationId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "create_site",
            arguments: { name: name.trim(), address, templateSlug: "starter" },
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "We could not preview that website.",
        );
        return;
      }
      setActionId(String(data.actionId ?? ""));
      setPreview(data.preview ?? null);
      setStep("preview");
    } catch {
      setError("We could not preview that website.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirm() {
    if (!preview || !actionId) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/agent/actions/${actionId}/confirm`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof data.message === "string"
            ? data.message
            : "We could not create the website draft.",
        );
        return;
      }
      setSubmitting(false);
      setStep("success");
      onComplete(data.project ?? { id: "", name: preview.name, subdomain: preview.address });
    } catch {
      setSubmitting(false);
      setError("We could not create the website draft.");
    }
  }

  function cancel() {
    setError(null);
    setStep("form");
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
          <CheckCircle size={24} strokeWidth={2} aria-hidden />
        </div>
        <h2 className="text-h3">Draft website created</h2>
        <p className="max-w-[34ch] text-[15px] text-text-muted">
          Your website is ready as a draft. It is not published yet.
        </p>
        <div className="mt-4 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => onClose()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-input bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
          >
            <ArrowRight size={18} strokeWidth={2} aria-hidden />
            Open your website
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-input border border-border bg-surface px-5 font-semibold text-text hover:bg-surface-muted"
          >
            Back to assistant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted"
        >
          <X size={20} strokeWidth={1.75} aria-hidden />
        </button>
        <h2 className="flex-1 truncate text-base font-semibold text-text">
          {step === "form" ? "Create a website" : "Confirm your website"}
        </h2>
        <button
          type="button"
          onClick={() => setStep("form")}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-input text-text-muted hover:bg-surface-muted",
            step === "form" ? "opacity-50 pointer-events-none" : "",
          )}
        >
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {step === "form" ? (
          <CreateSiteForm
            name={name}
            setName={setName}
            address={address}
            setAddress={setAddress}
            templateName={templateName}
            disabled={submitting}
            onSubmit={createPreview}
          />
        ) : (
          <CreateSitePreview
            preview={preview ?? undefined}
            error={error}
            submitting={submitting}
            onBack={() => setStep("form")}
            onCancel={cancel}
            onConfirm={confirm}
          />
        )}
      </div>
    </div>
  );
}

function CreateSiteForm({
  name,
  setName,
  address,
  setAddress,
  templateName,
  disabled,
  onSubmit,
}: {
  name: string;
  setName: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  templateName: string;
  disabled: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[15px] text-text-muted">
        Create a draft website for your business. Choose a name and a web
        address. It will not be published until you choose to publish it.
      </p>
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-text-muted">Website name</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Acme Bakery"
          disabled={disabled}
          className="h-11 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <label className="text-xs font-semibold text-text-muted">Web address</label>
          <span className="text-xs text-text-muted">{".get-on.tech"}</span>
        </div>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="e.g. acme-bakery"
          disabled={disabled}
          className="h-11 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-base text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold text-text-muted">Template</label>
        <div className="rounded-input border border-border bg-surface px-3 py-2.5 flex items-center gap-3 text-sm text-text">
          <Sparkles size={16} strokeWidth={1.75} aria-hidden className="text-text-muted" />
          <span>{templateName}</span>
          <span className="ml-auto text-xs text-text-muted">Free</span>
        </div>
      </div>
      <p className="text-[13px] text-text-muted">
        Creating a draft costs no credits. Publishing is your choice later.
      </p>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !name.trim() || !address.trim()}
        className="w-full h-11 rounded-input bg-primary px-5 font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
      >
        {disabled ? "Preparing…" : "Continue"}
      </button>
    </div>
  );
}

function CreateSitePreview({
  preview,
  error,
  submitting,
  onBack,
  onCancel,
  onConfirm,
}: {
  preview?: {
    name: string;
    address: string;
    primaryAddress: string;
    template: string | null;
    credits: number;
    warnings: string[];
  };
  error: string | null;
  submitting: boolean;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-info bg-danger-soft p-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-text-muted">What will be created</p>
        <div className="rounded-input border border-border bg-surface p-3 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-text-muted">Name</span>
            <span className="ml-auto text-[15px] font-semibold text-text">{preview?.name}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-text-muted">Web address</span>
            <span className="ml-auto text-[15px] font-medium text-text">
              {preview?.address}{".get-on.tech"}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-text-muted">Full address</span>
            <span className="ml-auto text-[13px] text-text-muted">
              {preview?.primaryAddress}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-text-muted">Template</span>
            <span className="ml-auto text-[13px] text-text-muted">
              {preview?.template ?? "Starter"}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-text-muted">Credits</span>
            <span className="ml-auto text-[13px] text-text-muted">
              {preview?.credits ?? 0}
            </span>
          </div>
        </div>
        {preview?.warnings && preview.warnings.length > 0 ? (
          <div className="rounded-input border border-warning-border bg-warning-soft p-2.5 text-xs text-warning-text">
            {preview.warnings.join(" ")}
          </div>
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="h-11 rounded-input bg-primary px-5 font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create website"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="h-11 rounded-input border border-border bg-surface px-5 font-semibold text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-text"
      >
        <ChevronLeft size={14} strokeWidth={2} aria-hidden />
        Change details
      </button>
    </div>
  );
}
