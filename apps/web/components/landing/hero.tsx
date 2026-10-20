import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, Lock, Phone, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const trustItems = ["Free forever plan", "Set up in about 5 minutes", "Works on any phone"];

export function LandingHero() {
  return (
    <section className="pt-12 pb-16 lg:py-24" aria-labelledby="hero-title">
      <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 px-5 md:px-8 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="lg:col-span-7">
          <p className="mb-5 inline-flex h-8 items-center gap-1.5 rounded-pill bg-accent-soft px-3 text-sm font-semibold text-accent-text">
            <Sparkles size={16} strokeWidth={1.75} aria-hidden />
            Free to start. No card needed.
          </p>

          <h1 id="hero-title" className="text-display">
            Get your business{" "}
            <span className="relative inline-block">
              online
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 200 10"
                preserveAspectRatio="none"
                className="pointer-events-none absolute left-0 top-full mt-1 h-2.5 w-full overflow-visible text-accent"
              >
                <path
                  d="M4 6 Q 29 1 54 6 T 104 6 T 154 6 T 196 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </span>{" "}
            in minutes.
          </h1>

          <p className="mt-5 max-w-[520px] text-lg text-text-muted md:text-xl">
            No technical skills needed. You get a free web address like
            yourbusiness.get-on.tech. Build your pages with AI or by hand.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Start free
              <ArrowRight size={20} strokeWidth={1.75} aria-hidden />
            </Link>
            <a href="#how" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              See how it works
            </a>
          </div>

          <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            {trustItems.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CircleCheck size={18} strokeWidth={1.75} className="shrink-0 text-success" aria-hidden />
                <span className="text-sm font-medium text-text">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 lg:col-span-5 lg:mt-0">
          <PhoneShowcase />
        </div>
      </div>
    </section>
  );
}

function PhoneShowcase() {
  return (
    <div
      role="img"
      aria-label="Example of a small business website on a phone"
      className="relative flex w-full justify-center"
    >
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-[48px] bg-accent-soft" />
      </div>

      <div className="relative w-[280px] lg:w-[300px]">
        <div className="relative aspect-[1/2] w-full overflow-hidden rounded-[40px] border-[10px] border-solid border-[#1F1A17] bg-white shadow-raised">
          <span
            aria-hidden
            className="absolute left-1/2 top-2.5 z-20 h-6 w-[90px] -translate-x-1/2 rounded-pill bg-[#1F1A17]"
          />

          <div className="flex h-full flex-col">
            <div aria-hidden className="h-10 shrink-0" />

            <div className="flex h-11 shrink-0 items-center justify-center bg-[#F6F0E6] px-3">
              <div className="flex h-7 items-center gap-1 rounded-pill bg-white px-3">
                <Lock size={12} strokeWidth={1.75} className="shrink-0 text-[#1F1A17]" aria-hidden />
                <span className="text-xs text-[#1F1A17]">rosebakery.get-on.tech</span>
              </div>
            </div>

            <div
              aria-hidden
              className="relative h-[140px] shrink-0"
              style={{ backgroundImage: "linear-gradient(135deg, #F5A524, #E8743B)" }}
            >
              <span className="absolute bottom-3 right-3 h-14 w-14 rounded-full bg-white/40" />
            </div>

            <div className="flex flex-1 flex-col gap-3 p-4">
              <p className="font-heading text-[22px] font-bold leading-tight text-[#1F1A17]">
                Rose Bakery
              </p>

              <div aria-hidden className="flex flex-col gap-2">
                <span className="h-2 w-full rounded bg-[#E8DFD0]" />
                <span className="h-2 w-[90%] rounded bg-[#E8DFD0]" />
                <span className="h-2 w-[60%] rounded bg-[#E8DFD0]" />
              </div>

              <span className="inline-flex h-9 w-fit items-center rounded-pill bg-[#0B6B4F] px-4 text-sm font-semibold text-white">
                Order now
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5 rounded-xl bg-[#F6F0E6] p-2.5">
                  <Clock size={16} strokeWidth={1.75} className="text-[#6B6158]" aria-hidden />
                  <span className="text-xs text-[#1F1A17]">Open 7am to 5pm</span>
                </div>
                <div className="flex flex-col gap-1.5 rounded-xl bg-[#F6F0E6] p-2.5">
                  <Phone size={16} strokeWidth={1.75} className="text-[#6B6158]" aria-hidden />
                  <span className="text-xs text-[#1F1A17]">Call us</span>
                </div>
              </div>

              <p className="mt-auto text-center text-[10px] text-[#6B6158]">Built with Get-On</p>
            </div>
          </div>
        </div>

        <div className="animate-float absolute -right-4 top-20 z-10 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-card">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
          <span className="text-sm font-semibold text-text">Published</span>
        </div>

        <div className="animate-float-delayed absolute -left-6 bottom-24 z-10 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 shadow-card">
          <Sparkles size={16} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
          <span className="text-sm font-semibold text-text">AI wrote this page</span>
        </div>
      </div>
    </div>
  );
}
