import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/legal-content";
import { AnalyticsLoader, GaConsentBanner } from "@/components/analytics";

const document = legalDocument("terms");

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The simple rules for using Get-On: your account, your website, plans, and how to contact us.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | Get-On",
    description: "The simple rules for using Get-On: your account, your website, plans, and how to contact us.",
    url: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <LegalPage document={document} />
      <AnalyticsLoader />
      <GaConsentBanner />
    </>
  );
}
