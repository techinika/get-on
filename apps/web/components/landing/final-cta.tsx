import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingFinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-5 pt-8 pb-16 md:px-8 lg:py-24">
      <div className="relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-panel bg-primary px-6 py-10 text-center md:px-12 md:py-16">
        <span
          aria-hidden
          className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent opacity-25"
        />
        <span
          aria-hidden
          className="absolute -bottom-15 -right-15 h-[220px] w-[220px] rounded-full bg-accent opacity-25"
        />

        <div className="relative">
          <h2 id="cta-title" className="text-h2 text-white">
            Ready to get your business online?
          </h2>
          <p className="mx-auto mt-3 max-w-[520px] text-lg text-white/90">
            Answer a few questions, let AI draft your pages, and publish today.
          </p>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ variant: "primary", size: "lg" }),
              "mt-7 bg-white text-[#0B6B4F] hover:bg-white hover:text-[#0B6B4F]",
            )}
          >
            Start free
            <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
          </Link>
          <Link
            href="/request-demo"
            className="mt-4 inline-block text-[15px] font-semibold text-white underline underline-offset-[3px]"
          >
            or request a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
