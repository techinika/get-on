import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/legal-content";
import { AnalyticsLoader, GaConsentBanner } from "@/components/analytics";

const document = legalDocument("cookies");

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "The small number of cookies Get-On sets, what each one does, and how to control them.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    title: "Cookie Policy | Get-On",
    description: "The small number of cookies Get-On sets, what each one does, and how to control them.",
    url: "/cookies",
  },
};

export default function CookiesPage() {
  return (
    <>
      <LegalPage document={document} />
      <AnalyticsLoader />
      <GaConsentBanner />
    </>
  );
}
