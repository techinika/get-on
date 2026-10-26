import type { PlanId } from "@/lib/plans";

export type PlanCopy = {
  /** One line shown under the plan name. */
  descriptor: string;
  /** One sentence shown on the plan screen. */
  summary: string;
  /** Price as shown on the plan screen. */
  priceLabel: string;
  cta: string;
  ctaVariant: "primary" | "secondary";
  /** Set when the button leaves the sign-up flow, for example for a demo. */
  ctaHref?: string;
  features: string[];
};

export const PLAN_COPY: Record<PlanId, PlanCopy> = {
  free: {
    descriptor: "To try it out",
    summary: "To try it out. Includes one website with one page.",
    priceLabel: "Free forever",
    cta: "Start free",
    ctaVariant: "secondary",
    features: [
      "1 website",
      "1 page",
      "Contact form",
      "Free address: yourname.get-on.tech",
      "Small Get-On badge on your site",
      "Standard support",
    ],
  },
  basic: {
    descriptor: "For a small business site",
    summary: "For a small business site. Two websites with up to five pages each.",
    priceLabel: "$7.99 per month",
    cta: "Choose Basic",
    ctaVariant: "primary",
    features: [
      "2 websites",
      "Up to 5 pages each",
      "1 custom domain per website",
      "2 extra features (plugins)",
      "No Get-On badge",
      "Standard support",
    ],
  },
  pro: {
    descriptor: "For growing businesses",
    summary: "For growing businesses. Five websites, unlimited pages and five people.",
    priceLabel: "$13.99 per month",
    cta: "Choose Pro",
    ctaVariant: "secondary",
    features: [
      "5 websites",
      "Unlimited pages",
      "Up to 3 custom domains per website",
      "5 extra features (plugins)",
      "Up to 5 team members",
      "Priority support",
    ],
  },
  enterprise: {
    descriptor: "For big teams and agencies",
    summary: "For big teams and agencies. Everything is unlimited.",
    priceLabel: "$59.99 per month",
    cta: "Talk to us",
    ctaVariant: "secondary",
    ctaHref: "/request-demo?interest=enterprise",
    features: [
      "Unlimited websites",
      "Unlimited pages",
      "Unlimited team members",
      "Unlimited extra features",
      "Up to 10 custom domains per website",
      "Highest-priority support",
    ],
  },
};

/** Rows of the "Compare plans" table (spec §6.2). */
export type CompareRow = {
  label: string;
  values: Record<PlanId, string | boolean>;
};

export const COMPARE_ROWS: CompareRow[] = [
  { label: "Websites", values: { free: "1", basic: "2", pro: "5", enterprise: "Unlimited" } },
  { label: "Pages per website", values: { free: "1", basic: "5", pro: "Unlimited", enterprise: "Unlimited" } },
  { label: "Team members", values: { free: "1", basic: "1", pro: "5", enterprise: "Unlimited" } },
  { label: "Extra features (plugins)", values: { free: "1", basic: "2", pro: "5", enterprise: "Unlimited" } },
  {
    label: "Custom domains per website",
    values: { free: "—", basic: "1", pro: "3", enterprise: "10" },
  },
  { label: "No Get-On badge", values: { free: false, basic: true, pro: true, enterprise: true } },
  {
    label: "Support priority",
    values: { free: "Standard", basic: "Standard", pro: "Priority", enterprise: "Highest" },
  },
  { label: "AI credits per month", values: { free: "0", basic: "100", pro: "400", enterprise: "1,500" } },
  { label: "Picture storage", values: { free: "100 MB", basic: "1 GB", pro: "5 GB", enterprise: "25 GB" } },
  {
    label: "Subscriber emails per month",
    values: { free: "—", basic: "1,000", pro: "5,000", enterprise: "25,000" },
  },
];
