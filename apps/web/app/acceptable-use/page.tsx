import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/legal-content";
import { AnalyticsLoader, GaConsentBanner } from "@/components/analytics";

const document = legalDocument("acceptable-use");

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "What you must not publish or send on Get-On, and how we enforce it.",
  alternates: { canonical: "/acceptable-use" },
  openGraph: {
    title: "Acceptable Use Policy | Get-On",
    description: "What you must not publish or send on Get-On, and how we enforce it.",
    url: "/acceptable-use",
  },
};

export default function AcceptableUsePage() {
  return (
    <>
      <LegalPage document={document} />
      <AnalyticsLoader />
      <GaConsentBanner />
    </>
  );
}
