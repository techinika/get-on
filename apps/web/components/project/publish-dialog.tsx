"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CircleAlert, Copy, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { displayAddress } from "@/lib/publishing/status";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Checking your pages", progress: 12 },
  { label: "Getting your pictures ready", progress: 32 },
  { label: "Building your website", progress: 58 },
  { label: "Uploading your pages", progress: 82 },
  { label: "Almost there", progress: 94 },
] as const;

type PublishResult = {
  publishId: string;
  status: string;
  url: string;
  warnings: string[];
  pagesCount: number;
  sizeBytes: number;
};

export type PublishDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  name: string;
  address: string;
  hasLiveVersion: boolean;
  pagesCount: number;
  homepageReady: boolean;
  detailsReady: boolean;
  contactFormPluginOff: boolean;
  sampleContentCount?: number;
  blockedReason: "review" | "suspended" | null;
  onPublished: () => void;
};

type Stage = "checking" | "summary" | "progress" | "success" | "no_changes" | "error";

export function PublishDialog({
  open,
  onClose,
  projectId,
  name,
  address,
  hasLiveVersion,
  pagesCount,
  homepageReady,
  detailsReady,
  contactFormPluginOff,
  sampleContentCount = 0,
  blockedReason,
  onPublished,
}: PublishDialogProps) {
  const { toast } = useToast();
  const [stage, setStage] = React.useState<Stage>("checking");
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState<PublishResult | null>(null);
  const [errorCode, setErrorCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setStage("summary"), 450);
    return () => window.clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (stage !== "progress") return;
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    }, 900);
    return () => window.clearInterval(timer);
  }, [stage]);

  const blockers = blockedReason
    ? [blockedReason === "review" ? "Your website is under review." : "Your website has been taken offline."]
    : [];

  async function publish() {
    setStage("progress");
    setStep(0);
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | (Partial<PublishResult> & { error?: string })
        | null;
      if (!res.ok || body?.error) {
        setErrorCode(body?.error ?? "UNKNOWN");
        setStage("error");
        return;
      }
      if (body?.status === "no_changes") {
        setStage("no_changes");
        onPublished();
        return;
      }
      setResult(body as PublishResult);
      setStage("success");
      onPublished();
    } catch {
      setErrorCode("NETWORK_ERROR");
      setStage("error");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result?.url ?? address);
      toast("Address copied.", "success");
    } catch {
      toast("We could not copy that. Please copy it by hand.", "error");
    }
  }

  const heading =
    stage === "success"
      ? hasLiveVersion
        ? "Your changes are live"
        : "Your website is live"
      : stage === "no_changes"
        ? "Everything is up to date"
        : hasLiveVersion
          ? "Publish changes"
          : "Publish your website";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={heading}
      width="form"
      dismissible={stage !== "progress"}
      footer={
        stage === "summary" ? (
          <>
            <Button variant="secondary" size="md" type="button" onClick={onClose}>
              Not now
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={() => void publish()}
              disabled={blockers.length > 0}
            >
              {hasLiveVersion ? "Publish changes" : "Publish website"}
            </Button>
          </>
        ) : stage === "success" || stage === "no_changes" ? (
          <Button variant="primary" size="md" type="button" onClick={onClose}>
            Done
          </Button>
        ) : stage === "error" ? (
          <>
            <Button variant="secondary" size="md" type="button" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="md" type="button" onClick={() => setStage("summary")}>
              Try again
            </Button>
          </>
        ) : undefined
      }
    >
      {stage === "checking" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <p className="text-base text-text-muted">Getting everything ready…</p>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-input bg-surface-muted" />
            ))}
          </div>
        </div>
      ) : null}

      {stage === "summary" ? (
        <div className="flex flex-col gap-4">
          <p className="text-base leading-6 text-text-muted">
            We will put your website at the address below. Your current website stays online
            until the new one is ready.
          </p>

          {blockers.length > 0 || contactFormPluginOff || sampleContentCount > 0 ? (
            <div className="rounded-info bg-warning-soft p-4 text-sm leading-5 text-warning-text">
              {blockers.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {contactFormPluginOff ? (
                <p>
                  Your contact form is turned off, so visitors cannot send you messages.{" "}
                  <Link
                    href={`/dashboard/projects/${projectId}/plugins?enable=contact`}
                    onClick={onClose}
                    className="font-semibold underline"
                  >
                    Turn it on
                  </Link>
                </p>
              ) : null}
              {sampleContentCount > 0 ? (
                <p>
                  {sampleContentCount} section{sampleContentCount === 1 ? "" : "s"} still use
                  sample words, such as reviews, prices, team or projects. Replace them before
                  you share the address.{" "}
                  <Link
                    href={`/dashboard/projects/${projectId}/pages`}
                    onClick={onClose}
                    className="font-semibold underline"
                  >
                    Review pages
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-info border border-border p-4">
            <p className="text-label-caps">Your web address</p>
            <p className="mt-1 break-all text-[15px] font-semibold text-primary">
              {displayAddress(address)}
            </p>
          </div>

          <ul className="flex flex-col gap-2.5">
            <CheckRow ok={pagesCount > 0} label={`${pagesCount} page${pagesCount === 1 ? "" : "s"} ready`} />
            <CheckRow ok={homepageReady} label="Your homepage has content" />
            <CheckRow
              ok={detailsReady}
              label="Your logo and business details"
              hint={detailsReady ? undefined : "You can still publish without these."}
              warning
            />
            {sampleContentCount > 0 ? (
              <CheckRow
                ok={false}
                label={`${sampleContentCount} section${sampleContentCount === 1 ? "" : "s"} with sample words`}
                hint="You can still publish, but visitors will see them."
                warning
              />
            ) : null}
            {contactFormPluginOff ? (
              <CheckRow
                ok={false}
                label="Your contact form is on"
                hint="You can turn it on in Plugins, then publish again."
                warning
              />
            ) : null}
          </ul>

          <p className="text-sm leading-5 text-text-muted">
            {hasLiveVersion
              ? "Publishing changes replaces what visitors see right away."
              : `When this finishes, anyone with the link can visit ${name}.`}
          </p>
        </div>
      ) : null}

      {stage === "progress" ? (
        <div className="flex flex-col gap-5" aria-live="polite">
          <Progress value={STEPS[step]?.progress ?? 10} label="Publishing" />
          <ul className="flex flex-col gap-3">
            {STEPS.map((item, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <li key={item.label} className="flex items-center gap-3 text-base">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                      done
                        ? "border-success bg-success text-white"
                        : active
                          ? "border-primary text-primary"
                          : "border-border-strong",
                    )}
                  >
                    {done ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : active ? (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    ) : null}
                  </span>
                  <span className={done || active ? "text-text" : "text-text-muted"}>{item.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-text-muted">This can take up to a minute. Please keep this open.</p>
        </div>
      ) : null}

      {stage === "success" && result ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center py-1">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-text">
              <Globe size={28} strokeWidth={1.75} aria-hidden />
            </span>
          </div>
          <p className="text-center text-base leading-6 text-text-muted">
            {result.pagesCount} page{result.pagesCount === 1 ? "" : "s"} are now online at
          </p>
          <p className="break-all text-center text-[15px] font-semibold text-primary">
            {displayAddress(result.url)}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => void copy()}>
              <Copy size={16} strokeWidth={1.75} aria-hidden />
              Copy address
            </Button>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
            >
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
              Open website
            </a>
          </div>
          <p className="text-center text-sm text-text-muted">
            It may take a minute for everyone to see it.
          </p>
        </div>
      ) : null}

      {stage === "no_changes" ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center py-1">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success-text">
              <Check size={28} strokeWidth={2} aria-hidden />
            </span>
          </div>
          <p className="text-center text-base leading-6 text-text-muted">
            Your website already shows your latest changes.
          </p>
          <div className="flex justify-center">
            <a
              href={address}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-sm font-semibold text-text transition-colors hover:bg-surface-muted"
            >
              <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
              Open website
            </a>
          </div>
        </div>
      ) : null}

      {stage === "error" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-info bg-danger-soft p-4 text-danger-text">
            <CircleAlert size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
            <p className="text-sm leading-5">{friendlyError(errorCode)}</p>
          </div>
          {hasLiveVersion ? (
            <p className="text-sm leading-5 text-text-muted">
              Your website is still online. Nothing visitors see has changed.
            </p>
          ) : null}
          <p className="text-sm leading-5 text-text-muted">
            If this keeps happening, contact us and we will help.
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}

function CheckRow({
  ok,
  label,
  hint,
  warning = false,
}: {
  ok: boolean;
  label: string;
  hint?: string;
  warning?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          ok ? "bg-success text-white" : warning ? "bg-warning-soft text-warning-text" : "bg-danger-soft text-danger-text",
        )}
      >
        {ok ? (
          <Check size={12} strokeWidth={3} />
        ) : (
          <CircleAlert size={13} strokeWidth={2} />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-base">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-text-muted">{hint}</span> : null}
      </span>
    </li>
  );
}

