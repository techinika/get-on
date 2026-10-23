"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type LegalTocSection = {
  id: string;
  title: string;
};

/**
 * "On this page" navigation. The active item follows the section you are
 * reading. Below 1024 the same list sits in a details card.
 */
export function LegalToc({ sections }: { sections: LegalTocSection[] }) {
  const [active, setActive] = React.useState(sections[0]?.id ?? "");

  React.useEffect(() => {
    const headings = sections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => element !== null);
    if (headings.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }
        const first = sections.find((section) => visible.has(section.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 },
    );

    for (const heading of headings) observer.observe(heading);
    return () => observer.disconnect();
  }, [sections]);

  const linkClass = (id: string) =>
    cn(
      "block border-l-2 py-1.5 pl-3 text-[14px] transition-colors",
      active === id
        ? "border-primary font-semibold text-primary"
        : "border-border text-text-muted hover:text-text",
    );

  return (
    <>
      <nav aria-label="On this page" className="hidden min-[1024px]:block">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-text-muted">
          On this page
        </p>
        <ul className="mt-3 space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={linkClass(section.id)} aria-current={active === section.id ? "true" : undefined}>
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <details className="mb-6 rounded-info border border-border bg-surface min-[1024px]:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-semibold text-text [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            aria-hidden
            className="shrink-0 transition-transform duration-150"
          />
        </summary>
        <ul className="space-y-0.5 px-4 pb-4 pt-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={linkClass(section.id)}>
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
