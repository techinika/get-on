import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireSystemTemplate, materializeTemplate } from "@get-on/templates";
import { templateBySlug } from "@/lib/templates/catalog";
import { RenderPage, SiteFooter, SiteHeader, SiteRoot } from "@get-on/renderer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export function generateStaticParams() {
  return ["starter", "software-company", "law-firm", "restaurant", "developer-portfolio"].map(
    (slug) => ({ slug }),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const item = templateBySlug(slug);
  if (!item) return {};
  return {
    title: `${item.name} template`,
    description: item.description,
    alternates: { canonical: `/templates/${item.slug}` },
    openGraph: {
      title: `${item.name} template | Get-On`,
      description: item.description,
      url: `/templates/${item.slug}`,
    },
  };
}

export default async function TemplatePreviewPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const item = templateBySlug(slug);
  if (!item) notFound();

  const pkg = requireSystemTemplate(slug);
  const preview = materializeTemplate(pkg, { profile: pkg.sampleProfile });
  const requestedPath = typeof pageParam === "string" ? pageParam : "/";
  const page = preview.pages.find((candidate) => candidate.path === requestedPath) ?? preview.pages[0]!;

  const nav = preview.pages
    .filter((candidate) => candidate.showInMenu)
    .map((candidate) => ({
      label: candidate.title,
      href: `/templates/${slug}?page=${encodeURIComponent(candidate.path)}`,
    }));

  const contact = pkg.sampleProfile;

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-3 md:px-8">
          <Link
            href="/templates"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
            All templates
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-text-muted">
              Previewing <span className="font-semibold text-text">{item.name}</span>
            </p>
            <Link href={`/dashboard/new?template=${item.slug}`} className={buttonVariants({ size: "md" })}>
              Use this design
              <ArrowRight size={18} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>
        <nav aria-label="Preview pages" className="mx-auto flex w-full max-w-[1120px] gap-1 overflow-x-auto px-5 pb-2 md:px-8">
          {preview.pages.map((candidate) => (
            <Link
              key={candidate.path}
              href={`/templates/${slug}?page=${encodeURIComponent(candidate.path)}`}
              aria-current={candidate.path === page.path ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-input px-3 text-sm font-semibold",
                candidate.path === page.path
                  ? "bg-primary-soft text-primary"
                  : "text-text-muted hover:bg-surface-muted hover:text-text",
              )}
            >
              {candidate.title}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-b border-border bg-surface-muted">
        <p className="mx-auto w-full max-w-[1120px] px-5 py-2.5 text-xs text-text-muted md:px-8">
          This is a preview with example words. Your own business details replace them when you start.
        </p>
      </div>

      <div className="overflow-hidden bg-surface">
        <SiteRoot theme={preview.theme}>
          <RenderPage
            content={{ blocks: page.blocks }}
            header={
              <SiteHeader
                businessName={contact.businessName}
                nav={nav}
                watermark={false}
                theme={preview.theme}
                tagline={contact.tagline}
              />
            }
            footer={
              <SiteFooter
                businessName={contact.businessName}
                phone={contact.phone}
                email={contact.email}
                address={contact.address}
                hours={contact.hoursNote}
                nav={nav}
                showWatermark={false}
                theme={preview.theme}
                tagline={contact.tagline}
                socialLinks={contact.social}
              />
            }
            ctx={{
              mode: "editor",
              contactEnabled: true,
              theme: preview.theme,
              hours: contact.hoursNote,
              address: contact.address,
              phone: contact.phone,
              email: contact.email,
              socialLinks: contact.social,
              getPageHref: (pageId) => {
                const linked = preview.pages.find((candidate) => candidate.id === pageId);
                return linked
                  ? `/templates/${slug}?page=${encodeURIComponent(linked.path)}`
                  : `/templates/${slug}`;
              },
            }}
          />
        </SiteRoot>
      </div>
    </div>
  );
}
