import Link from "next/link";
import { PLAN_DEFINITIONS, describeLimit } from "@/lib/plans";

const faqItems = [
  {
    q: "What is a web address?",
    a: "It is the link people type to find your website. We give you one free address like yourbusiness.get-on.tech.",
  },
  {
    q: "Do I need to know how websites work?",
    a: "No. We guide you step by step in plain language.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes, on paid plans you can connect your own domain when you are ready.",
  },
  {
    q: "What happens on the free plan?",
    a: "You can launch one website with one page and no credit card needed.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can change or cancel your paid plan at any time.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-background)]/95 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-xl font-bold text-[var(--color-primary)]">
            Get-On
          </Link>
          <div className="hidden items-center gap-6 text-sm md:flex">
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-3 py-2 text-sm hover:bg-[var(--color-muted)]">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary-foreground)]"
            >
              Start free
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-10 md:space-y-24 md:py-16">
        <section className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="space-y-5">
            <p className="inline-flex rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-semibold">
              Free forever plan. No card needed.
            </p>
            <h1 className="text-4xl leading-tight md:text-5xl">
              Get your business online in minutes.
            </h1>
            <p className="text-lg text-[var(--color-muted-foreground)]">
              No technical skills needed. Get a free address like
              yourbusiness.get-on.tech and build your pages with AI or by hand.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="min-h-11 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-[var(--color-primary-foreground)]"
              >
                Start free
              </Link>
              <a href="#how-it-works" className="text-sm font-semibold underline-offset-4 hover:underline">
                See how it works
              </a>
            </div>
          </div>
          <div className="mx-auto w-full max-w-xs rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="mb-4 rounded-lg bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              bakery.get-on.tech
            </div>
            <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
              <div className="h-24 rounded-xl bg-gradient-to-r from-orange-200 to-amber-200 dark:from-orange-800 dark:to-amber-700" />
              <div className="h-3 w-2/3 rounded bg-[var(--color-muted)]" />
              <div className="h-3 w-full rounded bg-[var(--color-muted)]" />
              <div className="h-10 rounded-xl bg-[var(--color-primary)]/90" />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="space-y-4">
          <h2 className="text-3xl">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {["Tell us about your business", "Pick AI or a template", "Publish with one tap"].map(
              (step, index) => (
                <article key={step} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                  <p className="mb-2 text-sm font-semibold text-[var(--color-primary)]">Step {index + 1}</p>
                  <p>{step}</p>
                </article>
              ),
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-3xl">What you get</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Free web address",
              "AI that writes your pages",
              "Easy visual editing",
              "Contact form",
              "Your own domain when you grow",
              "Automatic backups",
            ].map((item) => (
              <article key={item} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p>{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="space-y-4">
          <h2 className="text-3xl">Simple pricing</h2>
          <div className="grid gap-4 lg:grid-cols-4">
            {PLAN_DEFINITIONS.map((plan) => {
              const featured = plan.id === "pro";
              return (
                <article
                  key={plan.id}
                  className={`rounded-2xl border p-5 ${
                    featured
                      ? "border-[var(--color-primary)] bg-[var(--color-surface)] shadow"
                      : "border-[var(--color-border)] bg-[var(--color-surface)]"
                  }`}
                >
                  <h3 className="text-xl">{plan.name}</h3>
                  <p className="mt-1 text-2xl font-bold">
                    {plan.priceUsdMonthly === 0 ? "Free" : `$${plan.priceUsdMonthly}/mo`}
                  </p>
                  <ul className="mt-4 space-y-1 text-sm text-[var(--color-muted-foreground)]">
                    <li>{describeLimit(plan.maxWebsites, "website")}</li>
                    <li>{describeLimit(plan.maxPagesPerSite, "pages per site")}</li>
                    <li>{describeLimit(plan.maxMembers, "team members")}</li>
                    <li>{plan.aiCreditsMonthly} AI credits/month</li>
                    <li>Support: {plan.supportPriority}</li>
                  </ul>
                </article>
              );
            })}
          </div>
        </section>

        <section id="faq" className="space-y-4">
          <h2 className="text-3xl">FAQ</h2>
          <div className="space-y-3">
            {faqItems.map((item) => (
              <details key={item.q} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-[var(--color-primary)] p-8 text-[var(--color-primary-foreground)]">
          <h2 className="text-3xl">Ready to start?</h2>
          <p className="mt-2">Launch your first website today. It takes just a few minutes.</p>
          <Link
            href="/signup"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[var(--color-primary)]"
          >
            Start free
          </Link>
        </section>
      </main>

      <footer className="border-t border-[var(--color-border)] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-[var(--color-muted-foreground)]">
          <p>© Get-On</p>
          <div className="flex gap-4">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
