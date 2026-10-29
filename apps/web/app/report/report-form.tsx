"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Turnstile } from "@/components/turnstile";
import { submitReport, type ReportResult } from "@/app/report/actions";
import { REPORT_REASONS } from "@/lib/report";
import { cn } from "@/lib/utils";

type Values = {
  site: string;
  reason: string;
  details: string;
  email: string;
};

export function ReportForm({
  initialSite,
  formToken,
}: {
  initialSite: string;
  formToken: string;
}) {
  const [values, setValues] = React.useState<Values>({
    site: initialSite,
    reason: "",
    details: "",
    email: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [banner, setBanner] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const successRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function setValue(key: keyof Values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setBanner(null);
    setErrors({});

    const form = new FormData(event.currentTarget);
    form.set("site", values.site);
    form.set("reason", values.reason);
    form.set("details", values.details);
    form.set("email", values.email);
    form.set("formToken", formToken);
    form.set("turnstileToken", turnstileToken);
    form.set("company", "");

    const result: ReportResult = await submitReport(form).catch(() => ({
      ok: false,
      code: "SERVER",
    }));

    if (result.ok) {
      setSent(true);
      setSubmitting(false);
      return;
    }

    if (result.code === "VALIDATION" && result.fieldErrors) {
      setErrors(result.fieldErrors);
    } else if (result.code === "INVALID_SITE") {
      setErrors({ site: "We could not find a website with that address." });
    } else if (result.code === "RATE_LIMIT") {
      setBanner("You have sent a few reports already. Please try again a little later.");
    } else {
      setBanner("That did not work. Please try again.");
    }
    setSubmitting(false);
  }

  if (sent) {
    return (
      <div className="rounded-card bg-surface p-6 shadow-card min-[640px]:p-8">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-soft text-success-text">
            <Check size={32} strokeWidth={2} aria-hidden />
          </span>
          <h2
            ref={successRef}
            tabIndex={-1}
            className="mt-5 text-h2 outline-none"
          >
            Thank you
          </h2>
          <p className="mt-2 max-w-[46ch] text-base leading-6 text-text-muted">
            We have your report and will look at it as soon as we can. If the website is
            breaking our rules, we will take it offline.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text transition-colors hover:bg-surface-muted"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-card bg-surface p-6 shadow-card min-[640px]:p-8"
    >
      <div className="flex flex-col gap-4">
        {banner ? (
          <div role="alert" className="rounded-info bg-danger-soft p-3.5 text-sm text-danger-text">
            {banner}
          </div>
        ) : null}

        <div>
          <Label htmlFor="report-site">Website address</Label>
          <div className="mt-1.5">
            <Input
              id="report-site"
              name="site"
              value={values.site}
              onChange={(event) => setValue("site", event.target.value)}
              placeholder="rosebakery.get-on.tech"
              error={errors.site}
              autoComplete="off"
              inputMode="url"
            />
          </div>
          {errors.site ? null : (
            <p className="mt-1.5 text-sm text-text-muted">For example: rosebakery.get-on.tech</p>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-text">What is the problem?</legend>
          <div className="mt-2 flex flex-col gap-2" role="radiogroup">
            {REPORT_REASONS.map((reason) => {
              const selected = values.reason === reason.value;
              return (
                <label
                  key={reason.value}
                  className={cn(
                    "flex min-h-[56px] cursor-pointer items-center gap-3 rounded-info border-[1.5px] px-4 py-3 text-base transition-colors",
                    selected
                      ? "border-2 border-primary bg-primary-soft"
                      : "border-border-strong hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selected}
                    onChange={() => setValue("reason", reason.value)}
                    className="h-[22px] w-[22px] shrink-0 accent-primary"
                  />
                  <span>{reason.label}</span>
                </label>
              );
            })}
          </div>
          {errors.reason ? <FieldError>{errors.reason}</FieldError> : null}
        </fieldset>

        <div>
          <Label htmlFor="report-details" optional>
            More details
          </Label>
          <div className="mt-1.5">
            <Textarea
              id="report-details"
              name="details"
              value={values.details}
              onChange={(event) => setValue("details", event.target.value)}
              maxLength={1000}
              error={errors.details}
              className="min-h-[112px]"
            />
          </div>
          <p className="mt-1 text-right text-sm text-text-muted">
            {values.details.length}/1000
          </p>
        </div>

        <div>
          <Label htmlFor="report-email" optional>
            Your email
          </Label>
          <div className="mt-1.5">
            <Input
              id="report-email"
              name="email"
              type="email"
              value={values.email}
              onChange={(event) => setValue("email", event.target.value)}
              error={errors.email}
              autoComplete="email"
            />
          </div>
          {errors.email ? null : (
            <p className="mt-1.5 text-sm text-text-muted">
              Only if you want us to reply. We will not share it with the website owner.
            </p>
          )}
        </div>

        <input type="hidden" name="company" value="" tabIndex={-1} autoComplete="off" className="hidden" />
        <Turnstile onToken={setTurnstileToken} />

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={submitting}
          loadingLabel="Sending..."
        >
          Send report
        </Button>
      </div>
    </form>
  );
}
