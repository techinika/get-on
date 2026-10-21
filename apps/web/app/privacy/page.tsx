import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { legalDocument } from "@/lib/legal-content";

const document = legalDocument("privacy");

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Get-On collects, why we collect it, and what you can ask us to do with it.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Get-On",
    description: "What Get-On collects, why we collect it, and what you can ask us to do with it.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalPage document={document} />;
}
