"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-bg/85 backdrop-blur-[8px]",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1120px] items-center justify-between px-5 md:grid md:grid-cols-[1fr_auto_1fr] md:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center text-base font-medium text-text decoration-primary decoration-2 underline-offset-[6px] hover:underline"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:justify-self-end">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "md" }), "hidden md:inline-flex")}
          >
            Log in
          </Link>
          <Link
            href="/request-demo"
            className={cn(
              buttonVariants({ variant: "secondary", size: "md" }),
              "hidden min-[1024px]:inline-flex",
            )}
          >
            Request a demo
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "hidden md:inline-flex")}
          >
            Start free
          </Link>
          <Link
            href="/signup"
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "h-10 px-4 md:hidden")}
          >
            Start free
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center rounded-input text-text hover:bg-surface-muted md:hidden"
          >
            {menuOpen ? (
              <X size={22} strokeWidth={1.75} aria-hidden />
            ) : (
              <Menu size={22} strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="landing-mobile-menu"
          className="absolute inset-x-0 top-full border-b border-border bg-surface px-5 pb-5 pt-2 md:hidden"
        >
          <nav aria-label="Mobile">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex h-14 items-center text-xl font-semibold text-text"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/request-demo"
              onClick={() => setMenuOpen(false)}
              className="flex h-14 items-center text-xl font-semibold text-text"
            >
              Request a demo
            </Link>
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className={cn(buttonVariants({ variant: "secondary", size: "md" }), "mt-3 w-full")}
            >
              Log in
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
