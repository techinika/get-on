import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";
import { TemplateGallery } from "@/components/templates/template-gallery";
import { buttonVariants } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { templatesForPlan } from "@/lib/templates/catalog";

export const metadata: Metadata = {
  title: "Website templates",
  description:
    "Ready-made website designs for small businesses. Preview each design and start with the one that feels right.",
  alternates: { canonical: "/templates" },
};

export default function PublicTemplatesPage() {
  const templates = templatesForPlan("enterprise").map((item) => ({
    ...item,
    available: true,
  }));

  return (
    <>
      <LandingHeader />
      <main>
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-14 md:px-8 md:py-20">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-primary">Templates</p>
            <h1 className="mt-3 max-w-[18ch] text-[clamp(2.25rem,6vw,3.75rem)] font-bold leading-[1.05] tracking-tight text-text">
              Start with a design that already feels like you.
            </h1>
            <p className="mt-4 max-w-[58ch] text-lg leading-8 text-text-muted">
              Choose a ready-made website, then make it yours. Every design comes with real pages,
              friendly words and room to grow. You can change everything later.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Start free
                <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
              </Link>
              <Link href="/login" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Log in
              </Link>
            </div>
          </div>
        </section>
        <section className="mx-auto w-full max-w-[1120px] px-5 py-12 md:px-8 md:py-16">
          <ToastProvider>
            <TemplateGallery items={templates} mode="public" />
          </ToastProvider>
        </section>
      </main>
      <LandingFooter />
    </>
  );
}
