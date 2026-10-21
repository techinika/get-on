import Link from "next/link";
import { LogoInverse } from "@/components/logo";

const linkColumns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    heading: "Company",
    links: [{ label: "Request a demo", href: "/request-demo" }],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Acceptable Use", href: "/acceptable-use" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="bg-[#1F1A17] pt-12 pb-8 text-[#E8DFD0]">
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[280px]">
            <LogoInverse />
            <p className="mt-3 text-sm text-[#E8DFD0]">Get your business online.</p>
          </div>

          <div className="flex flex-col gap-8 md:flex-row md:gap-16">
            {linkColumns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#B5A99B]">
                  {column.heading}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => {
                    const className = "text-[15px] hover:underline hover:underline-offset-4";
                    return (
                      <li key={link.href}>
                        {link.href.startsWith("#") ? (
                          <a href={link.href} className={className}>
                            {link.label}
                          </a>
                        ) : (
                          <Link href={link.href} className={className}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-[#3A332D] pt-6">
          <p className="text-sm text-[#B5A99B]">© 2026 Get-On</p>
        </div>
      </div>
    </footer>
  );
}
