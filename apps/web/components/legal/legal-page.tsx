import * as React from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, TriangleAlert } from "lucide-react";
import { LandingHeader } from "@/components/landing/header";
import { LandingFooter } from "@/components/landing/footer";
import { ToastProvider } from "@/components/ui/toast";
import { BackToTop } from "@/components/legal/back-to-top";
import { CopySectionLink } from "@/components/legal/copy-section-link";
import { LegalText } from "@/components/legal/legal-text";
import { LegalToc } from "@/components/legal/legal-toc";
import { PrintButton } from "@/components/legal/print-button";
import { company, formatEffectiveDate } from "@/lib/company";
import { otherLegalDocuments, type LegalBlock, type LegalDocument } from "@/lib/legal-content";

function renderBlock(block: LegalBlock, key: string): React.ReactNode {
  switch (block.kind) {
    case "p":
      return (
        <p key={key} className="mb-4 text-[16px] leading-[1.7] text-text">
          <LegalText text={block.text} />
        </p>
      );
    case "h3":
      return (
        <h3 key={key} className="mt-7 text-[18px] font-semibold leading-[26px] text-text">
          <LegalText text={block.text} />
        </h3>
      );
    case "ul":
      return (
        <ul key={key} className="mb-4 ml-6 list-disc space-y-2 text-[16px] leading-[1.7] text-text">
          {block.items.map((item, index) => (
            <li key={`${key}-${index}`}>
              <LegalText text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="mb-4 ml-6 list-decimal space-y-2 text-[16px] leading-[1.7] text-text">
          {block.items.map((item, index) => (
            <li key={`${key}-${index}`}>
              <LegalText text={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div key={key} className="relative mb-4">
          <div className="overflow-x-auto rounded-input border border-border">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-muted">
                  {block.head.map((cell, index) => (
                    <th
                      key={`${key}-head-${index}`}
                      scope="col"
                      className="px-4 py-3 text-[13px] font-bold uppercase tracking-[0.04em] text-text"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${key}-row-${rowIndex}`} className="border-t border-border">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${key}-row-${rowIndex}-cell-${cellIndex}`}
                        className="px-4 py-3 align-top text-[15px] text-text"
                      >
                        <LegalText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Right edge fade, so a wide table shows there is more to scroll. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-input bg-gradient-to-l from-surface to-transparent"
          />
        </div>
      );
    default:
      return null;
  }
}

/** The shared layout for the four legal pages (spec §9.2). */
export function LegalPage({ document }: { document: LegalDocument }) {
  const sections = document.sections.map((section) => ({
    id: section.id,
    title: section.title,
  }));

  return (
    <ToastProvider>
      <LandingHeader />
      <main className="legal-page bg-bg">
        {company.reviewPending ? (
          <div className="border-b border-border bg-bg">
            <div className="mx-auto w-full max-w-[1120px] px-5 py-4 min-[768px]:px-8">
              <div className="flex items-start gap-3 rounded-input border border-warning-border bg-warning-soft px-4 py-3">
                <TriangleAlert size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-warning-text" />
                <p className="text-[14px] leading-5 text-warning-text">
                  Draft. These pages must be reviewed by a qualified lawyer before launch.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="border-b border-border bg-surface-muted">
          <div className="mx-auto w-full max-w-[1120px] px-5 py-12 min-[768px]:px-8 min-[768px]:py-16">
            <p className="text-[14px] font-bold uppercase tracking-[0.08em] text-primary">Legal</p>
            <h1 className="mt-3 font-heading text-[36px] font-bold leading-[44px] text-text min-[1024px]:text-[44px] min-[1024px]:leading-[52px]">
              {document.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px] text-text-muted">
              <span className="flex items-center gap-2">
                <Calendar size={16} strokeWidth={1.75} aria-hidden />
                Last updated {formatEffectiveDate(company.effectiveDate)}
              </span>
              <PrintButton />
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1120px] px-5 min-[768px]:px-8">
          <div className="mt-8 max-w-[720px] rounded-info border border-border border-l-4 border-l-primary bg-surface p-5">
            <p className="text-[16px] font-bold text-text">The short version</p>
            <ul className="mt-3 space-y-2">
              {document.short.map((item, index) => (
                <li key={index} className="flex gap-2 text-[15px] leading-[1.6] text-text">
                  <CheckCircle2
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-success"
                  />
                  <span>
                    <LegalText text={item} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1120px] px-5 py-12 min-[768px]:px-8 min-[768px]:py-16">
          <div className="grid grid-cols-1 gap-8 min-[1024px]:grid-cols-[240px_minmax(0,720px)] min-[1024px]:gap-16 min-[1024px]:justify-center">
            <div className="min-[1024px]:sticky min-[1024px]:top-24 min-[1024px]:self-start">
              <LegalToc sections={sections} />
            </div>

            <div>
              {document.sections.map((section, index) => (
                <section key={section.id} className={index === 0 ? "" : "mt-12"}>
                  <h2
                    id={section.id}
                    className="group relative scroll-mt-[88px] font-heading text-[24px] font-bold leading-8 text-text"
                  >
                    <span>
                      {index + 1}. {section.title}
                    </span>
                    <CopySectionLink id={section.id} />
                  </h2>
                  {section.blocks.map((block, blockIndex) =>
                    renderBlock(block, `${section.id}-${blockIndex}`),
                  )}
                </section>
              ))}

              <div className="mt-12 rounded-info bg-surface-muted p-5">
                <p className="text-[16px] font-semibold text-text">Questions about this page?</p>
                <p className="mt-1 text-[15px] text-text-muted">
                  Email us at{" "}
                  <a
                    href={`mailto:${company.privacyEmail}`}
                    className="text-primary underline underline-offset-[3px]"
                  >
                    {company.privacyEmail}
                  </a>
                  .
                </p>
                <div className="mt-4 flex flex-wrap gap-4">
                  {otherLegalDocuments(document.slug).map((other) => (
                    <Link
                      key={other.slug}
                      href={`/${other.slug}`}
                      className="text-[14px] font-semibold text-primary underline underline-offset-[3px]"
                    >
                      {other.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <BackToTop />
      <LandingFooter />
    </ToastProvider>
  );
}
