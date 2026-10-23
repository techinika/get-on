import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { PLAN_COPY } from "@/lib/plan-copy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getViewer } from "@/lib/viewer";

export async function LandingPricing() {
  const viewer = await getViewer();

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="scroll-mt-20 bg-surface-muted py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-eyebrow">Pricing</p>
          <h2 id="pricing-title" className="text-h2">
            Simple prices. Start free.
          </h2>
          <p className="text-lg text-text-muted">Plans are paid per team. Change your plan any time.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 items-stretch gap-4 pt-3.5 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
          {PLAN_DEFINITIONS.map((plan) => {
            const copy = PLAN_COPY[plan.id];
            const highlighted = plan.id === "basic";

            const href = viewer
              ? plan.id === "free"
                ? "/dashboard"
                : plan.id === "enterprise"
                  ? "/request-demo?interest=enterprise"
                  : "/dashboard/plan?upgrade=" + plan.id
              : copy.ctaHref ?? "/signup";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-dialog bg-surface p-7",
                  highlighted ? "border-2 border-primary shadow-raised" : "border border-border",
                )}
              >
                {highlighted ? (
                  <span className="absolute -top-3.5 left-1/2 z-10 flex h-7 -translate-x-1/2 items-center rounded-pill bg-primary px-3 text-xs font-bold uppercase text-on-primary">
                    Most popular
                  </span>
                ) : null}

                <p className="text-lg font-bold">{plan.name}</p>
                <p className="mt-1 text-sm text-text-muted">{copy.descriptor}</p>

                <p className="mt-5 flex items-baseline gap-1">
                  <span className="font-heading text-[44px] font-bold leading-none text-text">
                    ${plan.priceUsdMonthly}
                  </span>
                  <span className="text-base text-text-muted">/month</span>
                </p>

                <Link
                  href={href}
                  className={cn(buttonVariants({ variant: copy.ctaVariant, size: "md" }), "mt-5 w-full")}
                >
                  {viewer ? (plan.id === "free" ? "Go to dashboard" : plan.id === "enterprise" ? copy.cta : copy.cta) : copy.cta}
                </Link>

                <div className="my-6 border-t border-border" />

                <ul className="flex flex-col gap-3">
                  {copy.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success" aria-hidden />
                      <span className="text-[15px] text-text">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-text-muted">
          Prices are in US dollars. Plans are paid per team.
        </p>
      </div>
    </section>
  );
}
