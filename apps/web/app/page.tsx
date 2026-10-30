import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { LandingHowItWorks } from "@/components/landing/how-it-works";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFinalCta } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { initialsFrom } from "@/lib/viewer";
import type { Viewer } from "@/lib/viewer";
import { AnalyticsLoader, GaConsentBanner } from "@/components/analytics";

export default async function Home() {
  const viewer = await getViewer();

  return (
    <>
      <LandingHeader viewer={viewer} />
      <main>
        <LandingHero />
        <LandingHowItWorks />
        <LandingFeatures />
        <LandingPricing />
        <LandingFaq />
        <LandingFinalCta />
      </main>
      <LandingFooter />
      <AnalyticsLoader />
      <GaConsentBanner />
    </>
  );
}

/**
 * The signed-in person, or null when nobody is signed in. The auth cookie is
 * checked first, so a visitor who is not signed in costs no request to the
 * auth server.
 */
async function getViewer(): Promise<Viewer | null> {
  const cookieStore = await cookies();
  const signedIn = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));
  if (!signedIn) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? user.email ?? "Account";
  return {
    id: user.id,
    name,
    email: user.email ?? "",
    initials: initialsFrom(profile?.full_name, user.email),
  };
}
