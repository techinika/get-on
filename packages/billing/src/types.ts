export type PlanId = "free" | "basic" | "pro" | "enterprise";

export const PLAN_IDS: readonly PlanId[] = ["free", "basic", "pro", "enterprise"];

export type TermMonths = 1 | 6 | 12 | 24 | 36 | 48 | 60;

export const TERM_MONTHS: readonly TermMonths[] = [1, 6, 12, 24, 36, 48, 60];

export type SupportLevel = "standard" | "priority" | "highest";

export type BackupLimits = {
  autoFrequency: "weekly" | "daily";
  autoKeep: number;
  manualMax: number;
  storageMb: number;
};

export type PlanLimits = {
  maxWebsites: number | null;
  maxPagesPerSite: number | null;
  maxMembers: number | null;
  maxPlugins: number | null;
  maxTemplates: number | null;
  maxCustomDomainsPerSite: number;
  maxRedirects: number;
  maxPreviewLinks: number;
  maxDeletedPending: number;
  storageMb: number;
  monthlyEmails: number;
  aiMonthlyCredits: number;
  aiDailyActions: number;
  formsMonthly: number;
  backups: BackupLimits;
  exportsPerDay: number;
  support: SupportLevel;
  watermark: boolean;
};

export type PlanFeatures = {
  customDomain: boolean;
  removeBadge: boolean;
  customCode: boolean;
  analytics: boolean;
  teamMembers: boolean;
  plugins: boolean;
  prioritySupport: boolean;
  previewLinks: boolean;
  exports: boolean;
};

export type PlanCatalogueEntry = {
  id: PlanId;
  name: string;
  rank: number;
  priceMonthlyCents: number;
  limits: PlanLimits;
};

export type TermOption = {
  months: TermMonths;
  discountBps: number;
  label: string;
  active: boolean;
};

export type Coupon = {
  code: string;
  active: boolean;
  percentOffBps: number | null;
  amountOffCents: number | null;
  planIds: PlanId[] | null;
  minMonths: number | null;
  firstPurchaseOnly: boolean;
  startsAt: string | null;
  endsAt: string | null;
  maxRedemptions: number | null;
  perTeamLimit: number | null;
};

export type QuoteInput = {
  planId: PlanId;
  months: TermMonths;
  coupon?: Coupon | null;
  terms?: readonly TermOption[];
  taxRateBps?: number;
  currency?: string;
  now?: Date;
  firstPurchase?: boolean;
  redemptionCount?: number;
  teamRedemptionCount?: number;
};

export type CouponValidation =
  | { ok: true; coupon: Coupon }
  | {
      ok: false;
      reason:
        | "inactive"
        | "not_started"
        | "expired"
        | "wrong_plan"
        | "term_too_short"
        | "first_purchase_only"
        | "used_up"
        | "team_limit";
      message: string;
    };

export type Quote = {
  planId: PlanId;
  months: TermMonths;
  currency: string;
  monthlyPriceCents: number;
  grossCents: number;
  termDiscountBps: number;
  termDiscountCents: number;
  couponDiscountCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  effectiveMonthlyCents: number;
  savingsCents: number;
  couponCode: string | null;
};

export type SubscriptionTerm = {
  id: string;
  teamId: string;
  planId: PlanId;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "ended" | "cancelled";
  invoiceId: string | null;
};

export type AccessGrant = {
  id: string;
  teamId: string;
  planId: PlanId;
  startsAt: string;
  endsAt: string | null;
  revokedAt: string | null;
};

export type AccessSource = "paid" | "grant" | "free" | "grace" | "lapsed";

export type AccessStatus = "active" | "grace" | "lapsed" | "free";

export type TeamAccess = {
  planId: PlanId;
  source: AccessSource;
  status: AccessStatus;
  paidThrough: string | null;
  graceEndsAt: string | null;
  currentTermId: string | null;
  grantId: string | null;
  limits: PlanLimits;
  features: PlanFeatures;
};

export type CoverageSummary = {
  activeTerm: SubscriptionTerm | null;
  paidThrough: string | null;
  nextStart: string | null;
  lastEnd: string | null;
  gaps: Array<{ startsAt: string; endsAt: string }>;
};

export type InvoiceStatus =
  | "draft"
  | "open"
  | "payment_pending"
  | "paid"
  | "void"
  | "expired"
  | "refunded"
  | "partly_refunded";

export type PaymentStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "invalid"
  | "reversed"
  | "refunded"
  | "partly_refunded";
