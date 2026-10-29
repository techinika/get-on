import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { DemoEyebrow, DemoForm, DemoReassuranceChips, DemoSteps } from "./demo-form";
import { createTimeToken } from "@/lib/spam";
import { createClient } from "@/lib/supabase/server";
import env from "@/lib/env";
import { AnalyticsLoader, GaConsentBanner } from "@/components/analytics";

export const metadata: Metadata = {
  title: "Request a demo",
  description: "See how Get-On works in a short, friendly call. No technical knowledge needed.",
  alternates: { canonical: "/request-demo" },
  openGraph: {
    title: "Request a demo | Get-On",
    description: "See how Get-On works in a short, friendly call. No technical knowledge needed.",
    url: "/request-demo",
  },
};

const INTEREST_LABELS: Record<string, string> = {
  enterprise: "Enterprise",
  "multi-site": "Multiple websites",
  partnership: "Partnership",
};

export default async function RequestDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ interest?: string }>;
}) {
  const params = await searchParams;
  const interest = params.interest?.trim() || undefined;
  const interestLabel = interest ? (INTEREST_LABELS[interest] ?? interest) : undefined;

  let defaultName: string | undefined;
  let defaultEmail: string | undefined;
  let loggedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      loggedIn = true;
      defaultEmail = user.email ?? undefined;
      defaultName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        undefined;
    }
  } catch {
    // A signed out visitor is normal here.
  }

  return (
    <>
      <LandingHeader />
      <main className="bg-bg">
        <section className="mx-auto w-full max-w-[1120px] px-5 py-12 min-[768px]:px-8 min-[1024px]:py-24">
          <div className="grid grid-cols-1 gap-10 min-[1024px]:grid-cols-12 min-[1024px]:gap-16">
            <div className="min-[1024px]:col-span-5">
              <DemoEyebrow />
              <h1 className="mt-4 text-[40px] font-heading font-bold leading-[44px] text-text min-[1024px]:text-[52px] min-[1024px]:leading-[56px]">
                See Get-On in action.
              </h1>
              <p className="mt-4 max-w-[480px] text-[18px] leading-[1.6] text-text-muted">
                A short, friendly call where we show you how it works and answer your questions. No
                technical knowledge needed.
              </p>

              <p className="mt-8 text-[12px] font-bold uppercase tracking-[0.08em] text-text-muted">
                What happens next
              </p>
              <DemoSteps />

              <DemoReassuranceChips />

              <p className="mt-6 text-[14px] text-text-muted">
                Prefer to write? Email us at{" "}
                <a
                  href={`mailto:${env.supportEmail}`}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  {env.supportEmail}
                </a>
                .
              </p>
            </div>

            <div className="mt-10 min-[1024px]:col-span-7 min-[1024px]:mt-0">
              <DemoForm
                formToken={createTimeToken()}
                supportEmail={env.supportEmail}
                defaultName={defaultName}
                defaultEmail={defaultEmail}
                loggedIn={loggedIn}
                interest={interest}
                interestLabel={interestLabel}
              />
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
      <AnalyticsLoader />
      <GaConsentBanner />
    </>
  );
}
