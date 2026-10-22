import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { createTimeToken } from "@/lib/spam";
import { normalizeSiteName } from "@/lib/report";
import { ReportForm } from "./report-form";

export const metadata: Metadata = {
  title: "Report a website | Get-On",
  description: "Tell us about a website on Get-On that is a scam, copies someone else, or breaks our rules.",
  robots: { index: false, follow: false },
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const site = params.site ? (normalizeSiteName(params.site) ?? params.site.trim()) : "";

  return (
    <>
      <LandingHeader />
      <main className="bg-bg">
        <section className="mx-auto w-full max-w-[560px] px-5 py-12 min-[768px]:px-5 min-[768px]:py-16">
          <p className="text-[14px] font-bold uppercase tracking-[0.08em] text-primary">
            Report a problem
          </p>
          <h1 className="mt-2 text-[32px] font-heading font-bold leading-[40px] text-text min-[1024px]:text-[40px] min-[1024px]:leading-[48px]">
            Report a website
          </h1>
          <p className="mt-2 text-[16px] leading-6 text-text-muted">
            Tell us about a website on Get-On that is a scam, copies someone else, or breaks
            our rules. We look at every report.
          </p>

          <div className="mt-8">
            <ReportForm initialSite={site} formToken={createTimeToken()} />
          </div>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
