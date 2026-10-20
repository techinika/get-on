"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addressFromName, normalizeAddress, validateAddress } from "@/lib/address";
import { friendlyError } from "@/lib/errors";
import { StepAbout } from "./step-about";
import { StepBusinessName } from "./step-business-name";
import { StepBusinessType } from "./step-business-type";
import { StepContact } from "./step-contact";
import { StepReview } from "./step-review";
import { StepStart } from "./step-start";
import {
  DEFAULT_STATE,
  STEP_META,
  TOTAL_STEPS,
  type AddressStatusState,
  type StartChoice,
  type WizardState,
} from "./types";
import { WizardActions, WizardProgress, WizardTopBar } from "./wizard-chrome";

const STORAGE_KEY = "get-on-wizard";
const ADDRESS_CHECK_DEBOUNCE_MS = 400;

function clampStep(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(TOTAL_STEPS, Math.max(1, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toAddressStatus(data: unknown): AddressStatusState {
  if (isRecord(data)) {
    if (data.status === "available") return { status: "available" };
    if (data.status === "taken") {
      const suggestions = Array.isArray(data.suggestions)
        ? data.suggestions
            .filter((item): item is string => typeof item === "string")
            .slice(0, 3)
        : [];
      return { status: "taken", suggestions };
    }
    if (data.status === "invalid") {
      return {
        status: "invalid",
        reason:
          typeof data.reason === "string" && data.reason
            ? data.reason
            : "Please try a different web address.",
      };
    }
  }
  return {
    status: "invalid",
    reason: "We could not check that right now. Please try again.",
  };
}

function restoredState(): WizardState | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      step: clampStep(parsed.step),
      contact: {
        ...DEFAULT_STATE.contact,
        ...(isRecord(parsed.contact) ? parsed.contact : {}),
      },
      addressStatus: DEFAULT_STATE.addressStatus,
    };
  } catch {
    return null;
  }
}

export function Wizard() {
  const router = useRouter();
  const [state, setState] = React.useState<WizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = React.useState(false);
  const [checkNonce, setCheckNonce] = React.useState(0);
  const [checkedKey, setCheckedKey] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [limitReached, setLimitReached] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const prevStepRef = React.useRef<number | null>(null);

  const effectiveAddress = state.customAddress
    ? normalizeAddress(state.customAddressValue)
    : addressFromName(state.name);

  // Restore any saved draft once, after mount (sessionStorage is client-only;
  // reading it during render would break SSR hydration). Passing the identical
  // DEFAULT_STATE reference is a no-op bail-out.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from sessionStorage
    setState(restoredState() ?? DEFAULT_STATE);
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, address: effectiveAddress }),
      );
    } catch {
      // Storage may be full or blocked; the wizard still works without it.
    }
  }, [state, hydrated, effectiveAddress]);

  React.useEffect(() => {
    if (prevStepRef.current !== null && prevStepRef.current !== state.step) {
      headingRef.current?.focus();
    }
    prevStepRef.current = state.step;
  }, [state.step]);

  // Debounced availability check. The displayed status is derived during
  // render; this effect only fetches and stores the latest result.
  const checkKey = `${checkNonce}:${effectiveAddress}`;
  React.useEffect(() => {
    if (!hydrated) return;
    const candidate = effectiveAddress;
    if (!candidate || !validateAddress(candidate).ok || checkedKey === checkKey) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/address?q=${encodeURIComponent(candidate)}`, { signal: controller.signal })
        .then(async (response) => {
          if (controller.signal.aborted) return;
          const data: unknown = await response.json();
          if (controller.signal.aborted) return;
          setState((prev) => ({ ...prev, addressStatus: toAddressStatus(data) }));
          setCheckedKey(checkKey);
        })
        .catch(() => {
          // Aborted (stale) or offline; keep the current status.
        });
    }, ADDRESS_CHECK_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [effectiveAddress, hydrated, checkNonce, checkedKey, checkKey]);

  let addressStatus: AddressStatusState;
  if (!effectiveAddress) {
    addressStatus = { status: "idle" };
  } else {
    const local = validateAddress(effectiveAddress);
    if (!local.ok) {
      addressStatus = {
        status: "invalid",
        reason: local.reason ?? "Please try a different web address.",
      };
    } else if (checkedKey === checkKey) {
      addressStatus = state.addressStatus;
    } else {
      addressStatus = { status: "checking" };
    }
  }

  const setStep = (step: number) => {
    setSubmitError(null);
    setState((prev) => ({ ...prev, step: clampStep(step) }));
  };

  const canContinue =
    state.step === 1
      ? state.name.trim().length > 0 && addressStatus.status === "available"
      : state.step === 2
        ? state.businessType.trim().length > 0
        : state.step === 6
          ? !limitReached
          : true;

  const handleContinue = () => {
    if (!canContinue) return;
    if (state.step === TOTAL_STEPS) {
      void createProject();
      return;
    }
    setStep(state.step + 1);
  };

  const handleSkip = () => setStep(state.step + 1);

  const saveAndExit = () => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
    router.push("/dashboard");
  };

  const selectSuggestion = (value: string) => {
    setSubmitError(null);
    setState((prev) => ({ ...prev, customAddress: true, customAddressValue: value }));
    setCheckNonce((nonce) => nonce + 1);
  };

  async function createProject() {
    setSubmitting(true);
    setSubmitError(null);
    setLimitReached(false);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name.trim(),
          address: effectiveAddress,
          about: state.about,
          businessType: state.businessType,
          startChoice: state.startChoice,
          contact: {
            phone: state.contact.phone.trim(),
            email: state.contact.email.trim(),
            address: state.contact.address.trim(),
          },
          ...(state.logoData ? { logoData: state.logoData } : {}),
        }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (
        response.ok &&
        isRecord(data) &&
        isRecord(data.project) &&
        typeof data.project.id === "string"
      ) {
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage failures.
        }
        router.push(`/dashboard/projects/${data.project.id}`);
        return;
      }

      const code = isRecord(data) && typeof data.error === "string" ? data.error : "UNKNOWN";

      if (code === "SUBDOMAIN_TAKEN") {
        setState((prev) => ({
          ...prev,
          step: 1,
          customAddress: true,
          customAddressValue: effectiveAddress,
        }));
        setCheckNonce((nonce) => nonce + 1);
        return;
      }

      if (code === "LIMIT_WEBSITES_REACHED") {
        setLimitReached(true);
        return;
      }

      setSubmitError(friendlyError(code));
    } catch {
      setSubmitError(friendlyError("NETWORK_ERROR"));
    } finally {
      setSubmitting(false);
    }
  }

  const meta = STEP_META[state.step - 1];

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <WizardTopBar onExit={saveAndExit} />
      <WizardProgress step={state.step} />

      <main className="mx-auto w-full max-w-[560px] px-6 pb-24 pt-8 md:pb-16 md:pt-16">
        <div key={state.step} className="animate-step-in">
          <p className="text-sm text-text-muted">
            Step {state.step} of {TOTAL_STEPS}
          </p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-h1">
            {meta.title}
          </h1>
          <p className="mt-2 text-base text-text-muted">{meta.sub}</p>

          <div className="mt-8">
            {state.step === 1 ? (
              <StepBusinessName
                name={state.name}
                onNameChange={(name) => setState((prev) => ({ ...prev, name }))}
                effectiveAddress={effectiveAddress}
                customAddress={state.customAddress}
                customAddressValue={state.customAddressValue}
                addressStatus={addressStatus}
                onToggleCustom={() =>
                  setState((prev) => ({
                    ...prev,
                    customAddress: !prev.customAddress,
                    customAddressValue: prev.customAddress
                      ? prev.customAddressValue
                      : prev.customAddressValue || effectiveAddress,
                  }))
                }
                onCustomAddressChange={(customAddressValue) =>
                  setState((prev) => ({ ...prev, customAddressValue }))
                }
                onSelectSuggestion={selectSuggestion}
              />
            ) : null}

            {state.step === 2 ? (
              <StepBusinessType
                value={state.businessType}
                onChange={(businessType) => setState((prev) => ({ ...prev, businessType }))}
              />
            ) : null}

            {state.step === 3 ? (
              <StepAbout
                value={state.about}
                onChange={(about) => setState((prev) => ({ ...prev, about }))}
              />
            ) : null}

            {state.step === 4 ? (
              <StepStart
                value={state.startChoice}
                onChange={(startChoice: StartChoice) =>
                  setState((prev) => ({ ...prev, startChoice }))
                }
              />
            ) : null}

            {state.step === 5 ? (
              <StepContact
                contact={state.contact}
                onContactChange={(contact) => setState((prev) => ({ ...prev, contact }))}
                logoData={state.logoData}
                logoError={state.logoError}
                onLogoChange={(logoData) => setState((prev) => ({ ...prev, logoData }))}
                onLogoError={(logoError) => setState((prev) => ({ ...prev, logoError }))}
              />
            ) : null}

            {state.step === 6 ? (
              <StepReview
                name={state.name.trim()}
                address={effectiveAddress}
                businessType={state.businessType}
                submitError={submitError}
                limitReached={limitReached}
                onEditStep={setStep}
              />
            ) : null}
          </div>

          {meta.skippable ? (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleSkip}
                className="inline-flex min-h-11 items-center text-sm text-text-muted underline underline-offset-2 hover:text-text"
              >
                Skip this step
              </button>
            </div>
          ) : null}
        </div>

        <WizardActions
          showBack={state.step > 1 && !limitReached}
          onBack={() => setStep(state.step - 1)}
          onContinue={handleContinue}
          continueDisabled={!canContinue}
          continueLabel={state.step === TOTAL_STEPS ? "Create my website" : "Continue"}
          continueLoading={submitting}
          continueLoadingLabel="Setting up your website..."
        />
      </main>
    </div>
  );
}
