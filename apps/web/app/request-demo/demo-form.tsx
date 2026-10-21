"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  MessageCircle,
  Phone,
  ShieldCheck,
  Video,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { submitDemoRequest } from "@/app/request-demo/actions";
import { Turnstile } from "@/app/request-demo/turnstile";
import {
  MEETING_METHOD_OPTIONS,
  PREFERRED_TIME_OPTIONS,
  WEBSITES_NEEDED_OPTIONS,
  demoRequestSchema,
} from "@/lib/demo-request";
import { BUSINESS_TYPE_LABELS } from "@/lib/business-types";
import { cn } from "@/lib/utils";

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  businessType: string;
  websitesNeeded: string;
  meetingMethod: string;
  preferredTime: string;
  message: string;
  consent: boolean;
};

const EMPTY: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  businessName: "",
  businessType: "",
  websitesNeeded: "",
  meetingMethod: "video",
  preferredTime: "any",
  message: "",
  consent: false,
};

const MEETING_ICONS = {
  video: Video,
  phone: Phone,
  whatsapp: MessageCircle,
} as const;

export type DemoFormProps = {
  formToken: string;
  supportEmail: string;
  /** Prefilled when the visitor already has an account. */
  defaultName?: string;
  defaultEmail?: string;
  loggedIn?: boolean;
  /** Interest recorded from the URL, for example "enterprise". */
  interest?: string;
  interestLabel?: string;
};

function fieldMessage(field: string, value: unknown): string | undefined {
  const shape = demoRequestSchema.shape as Record<string, z.ZodTypeAny>;
  const schema = shape[field];
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return undefined;
  return result.error.issues[0]?.message;
}

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

const noopSubscribe = () => () => {};

export function DemoForm({
  formToken,
  supportEmail,
  defaultName,
  defaultEmail,
  loggedIn = false,
  interest,
  interestLabel,
}: DemoFormProps) {
  const [values, setValues] = React.useState<FormValues>({
    ...EMPTY,
    fullName: defaultName ?? "",
    email: defaultEmail ?? "",
  });
  const timezone = React.useSyncExternalStore(noopSubscribe, detectTimezone, () => "");
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormValues, string>>>({});
  const [banner, setBanner] = React.useState<"validation" | "rate" | "server" | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const successRef = React.useRef<HTMLHeadingElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateField(key: keyof FormValues) {
    const message = fieldMessage(key, values[key]);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[key] = message;
      else delete next[key];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);

    const nextErrors: Partial<Record<keyof FormValues, string>> = {};
    for (const key of Object.keys(values) as (keyof FormValues)[]) {
      const message = fieldMessage(key, values[key]);
      if (message) nextErrors[key] = message;
    }
    setErrors(nextErrors);

    const firstInvalid = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      setBanner("validation");
      const element = formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`);
      element?.focus();
      return;
    }

    setSubmitting(true);
    const form = new FormData();
    form.append("fullName", values.fullName);
    form.append("email", values.email);
    form.append("phone", values.phone);
    form.append("businessName", values.businessName);
    form.append("businessType", values.businessType);
    form.append("websitesNeeded", values.websitesNeeded);
    form.append("meetingMethod", values.meetingMethod);
    form.append("preferredTime", values.preferredTime);
    form.append("timezone", timezone);
    form.append("message", values.message);
    form.append("consent", values.consent ? "true" : "false");
    form.append("formToken", formToken);
    form.append("sourcePage", "/request-demo");
    if (turnstileToken) form.append("turnstileToken", turnstileToken);
    if (interest) form.append("interest", interest);

    const result = await submitDemoRequest(form);
    setSubmitting(false);

    if (result.ok) {
      setSent(true);
      return;
    }
    if (result.code === "VALIDATION") {
      setErrors(result.fieldErrors ?? {});
      setBanner("validation");
      return;
    }
    setBanner(result.code === "RATE_LIMIT" ? "rate" : "server");
  }

  if (sent) {
    const firstName = values.fullName.trim().split(/\s+/)[0] ?? "";
    return (
      <div className="rounded-dialog border border-border bg-surface p-6 text-center shadow-card min-[640px]:p-8">
        <span
          aria-hidden
          className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full bg-success-soft text-success"
        >
          <Check size={32} strokeWidth={2.5} />
        </span>
        <h2
          ref={successRef}
          tabIndex={-1}
          className="mt-6 text-[22px] font-heading font-bold text-text"
        >
          Thank you, {firstName}!
        </h2>
        <p className="mt-2 text-[16px] leading-6 text-text-muted">
          We have your request. We will email you at {values.email} within 1 working day to agree a
          time.
        </p>
        <dl className="mt-6 space-y-2 rounded-info bg-surface-muted p-4 text-left text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Meeting</dt>
            <dd className="font-semibold text-text">
              {MEETING_METHOD_OPTIONS.find((option) => option.value === values.meetingMethod)?.label}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Best time</dt>
            <dd className="font-semibold text-text">
              {
                PREFERRED_TIME_OPTIONS.find((option) => option.value === values.preferredTime)?.label
              }
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-muted">Business</dt>
            <dd className="font-semibold text-text">{values.businessName}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-input border-[1.5px] border-border-strong bg-surface px-5 text-base font-semibold text-text transition-colors hover:bg-surface-muted"
          >
            Back to home
          </Link>
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-input bg-primary px-5 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              Go to my dashboard
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-dialog border border-border bg-surface p-6 shadow-card min-[640px]:p-8">
      <h2 className="text-[22px] font-heading font-bold text-text">Tell us a little about you</h2>
      <p className="mt-1 text-[15px] text-text-muted">
        It takes about a minute. We will only use your details to arrange your demo.
      </p>
      {interestLabel ? (
        <p className="mt-3 inline-flex items-center rounded-pill bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-text">
          Asking about: {interestLabel}
        </p>
      ) : null}

      {banner ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-info border border-danger-border bg-danger-soft p-4"
        >
          <p className="text-[15px] text-danger-text">
            {banner === "validation"
              ? "Please check the highlighted fields."
              : banner === "rate"
                ? `You have sent a few requests already. Please wait a little and try again, or email us at ${supportEmail}.`
                : `We could not send your request. Please try again, or email us at ${supportEmail}.`}
          </p>
        </div>
      ) : null}

      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>
        <input type="hidden" name="formToken" value={formToken} />
        <input type="hidden" name="timezone" value={timezone} />
        <Turnstile onToken={setTurnstileToken} />

        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Your name</Label>
            <Input
              id="fullName"
              name="fullName"
              value={values.fullName}
              autoComplete="name"
              error={errors.fullName}
              onChange={(event) => setValue("fullName", event.target.value)}
              onBlur={() => validateField("fullName")}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={values.email}
              error={errors.email}
              onChange={(event) => setValue("email", event.target.value)}
              onBlur={() => validateField("email")}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
          <div>
            <Label htmlFor="phone" optional>
              Phone or WhatsApp
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              error={errors.phone}
              onChange={(event) => setValue("phone", event.target.value)}
              onBlur={() => validateField("phone")}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-sm text-text-muted">Include the country code</p>
          </div>
          <div>
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              value={values.businessName}
              error={errors.businessName}
              onChange={(event) => setValue("businessName", event.target.value)}
              onBlur={() => validateField("businessName")}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
          <div>
            <Label htmlFor="businessType" optional>
              Type of business
            </Label>
            <select
              id="businessType"
              name="businessType"
              value={values.businessType}
              onChange={(event) => setValue("businessType", event.target.value)}
              className="mt-1.5 h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-base text-text"
            >
              <option value="">Choose one</option>
              {BUSINESS_TYPE_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="websitesNeeded">How many websites do you need?</Label>
            <select
              id="websitesNeeded"
              name="websitesNeeded"
              value={values.websitesNeeded}
              onChange={(event) => setValue("websitesNeeded", event.target.value)}
              onBlur={() => validateField("websitesNeeded")}
              className="mt-1.5 h-12 w-full rounded-input border-[1.5px] border-border-strong bg-surface px-3.5 text-base text-text"
            >
              <option value="">Choose one</option>
              {WEBSITES_NEEDED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.websitesNeeded ? (
              <p role="alert" className="mt-1.5 text-sm text-danger-text">
                {errors.websitesNeeded}
              </p>
            ) : null}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-text">How would you like to meet?</legend>
          <div className="mt-2 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
            {MEETING_METHOD_OPTIONS.map((option) => {
              const Icon = MEETING_ICONS[option.value as keyof typeof MEETING_ICONS];
              const selected = values.meetingMethod === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] px-3 py-3 text-center transition-colors",
                    selected
                      ? "border-[2px] border-primary bg-primary-soft"
                      : "border-border-strong bg-surface hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="meetingMethod"
                    value={option.value}
                    checked={selected}
                    onChange={() => setValue("meetingMethod", option.value)}
                    className="sr-only"
                  />
                  <Icon size={22} strokeWidth={1.75} aria-hidden className="text-primary" />
                  <span className="text-sm font-semibold text-text">{option.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-text">When suits you best?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 min-[480px]:grid-cols-4">
            {PREFERRED_TIME_OPTIONS.map((option) => {
              const selected = values.preferredTime === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[44px] cursor-pointer items-center justify-center rounded-[10px] border-[1.5px] px-3 text-sm font-semibold transition-colors",
                    selected
                      ? "border-[2px] border-primary bg-primary-soft text-text"
                      : "border-border-strong bg-surface text-text hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="preferredTime"
                    value={option.value}
                    checked={selected}
                    onChange={() => setValue("preferredTime", option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[13px] text-text-muted">
            Your time zone: {timezone || "not known yet"}
          </p>
        </fieldset>

        <div>
          <Label htmlFor="message" optional>
            What would you like to see?
          </Label>
          <Textarea
            id="message"
            name="message"
            value={values.message}
            maxLength={500}
            error={errors.message}
            placeholder="For example: how to build a simple website for my shop."
            onChange={(event) => setValue("message", event.target.value)}
            onBlur={() => validateField("message")}
            className="mt-1.5 min-h-[112px]"
          />
          <p className="mt-1 text-right text-[13px] text-text-muted">{values.message.length}/500</p>
        </div>

        <div>
          <label className="flex min-h-[44px] items-start gap-3">
            <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
              <input
                type="checkbox"
                name="consent"
                checked={values.consent}
                onChange={(event) => {
                  setValue("consent", event.target.checked);
                  validateField("consent");
                }}
                className="peer h-6 w-6 appearance-none rounded-[8px] border-2 border-border-strong bg-surface transition-colors checked:border-primary checked:bg-primary"
              />
              <Check
                size={16}
                strokeWidth={3}
                aria-hidden
                className="pointer-events-none absolute text-on-primary opacity-0 peer-checked:opacity-100"
              />
            </span>
            <span className="text-[14px] leading-[1.5] text-text">
              I agree that Get-On may contact me about my demo request. See our{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary underline underline-offset-[3px]"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.consent ? (
            <p role="alert" className="mt-1.5 text-sm text-danger-text">
              {errors.consent}
            </p>
          ) : null}
        </div>

        <div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            loadingLabel="Sending..."
            className="w-full"
          >
            Request my demo
          </Button>
          <p className="mt-3 text-center text-[13px] leading-5 text-text-muted">
            We only use your details to arrange your demo.
          </p>
        </div>
      </form>
    </div>
  );
}

export function DemoReassuranceChips() {
  const chips = [
    { Icon: Clock, label: "20 minutes" },
    { Icon: Video, label: "Video, phone or WhatsApp" },
    { Icon: ShieldCheck, label: "No pressure" },
  ];
  return (
    <ul className="mt-8 flex flex-wrap gap-3">
      {chips.map(({ Icon, label }) => (
        <li
          key={label}
          className="flex h-9 items-center gap-2 rounded-pill border border-border bg-surface px-3 text-[14px] font-medium text-text"
        >
          <Icon size={16} strokeWidth={1.75} aria-hidden className="text-primary" />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function DemoSteps() {
  const steps = [
    { title: "You send the form", text: "It takes about a minute." },
    { title: "We reply within 1 working day", text: "We will suggest a time that suits you." },
    { title: "We show you around", text: "About 20 minutes, and you can ask us anything." },
  ];
  return (
    <ol className="mt-4 space-y-5">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-on-primary"
          >
            {index + 1}
          </span>
          <span>
            <span className="block text-[16px] font-semibold text-text">{step.title}</span>
            <span className="block text-[15px] text-text-muted">{step.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DemoEyebrow() {
  return (
    <p className="inline-flex h-8 items-center gap-2 rounded-pill bg-accent-soft px-3 text-[14px] font-semibold text-accent-text">
      <Video size={16} strokeWidth={1.75} aria-hidden />
      Request a demo
    </p>
  );
}
