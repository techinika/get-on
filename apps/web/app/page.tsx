import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export default function Home() {
  return (
    <>
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingPricing />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
