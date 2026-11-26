export type SiteState =
  | "draft"
  | "live"
  | "changes"
  | "offline"
  | "review"
  | "suspended";

export type SiteStatusInput = {
  published: boolean;
  hasLiveVersion: boolean;
  hasChanges: boolean;
  reviewState: string | null | undefined;
  suspendedAt: string | null | undefined;
};

/** One status model for every screen (publishing spec §8.1). */
export function siteStateOf(input: SiteStatusInput): SiteState {
  if (input.suspendedAt) return "suspended";
  if (input.reviewState === "pending") return "review";
  if (input.published && input.hasLiveVersion) {
    return input.hasChanges ? "changes" : "live";
  }
  if (input.hasLiveVersion) return "offline";
  return "draft";
}

export function siteStateCopy(state: SiteState): {
  label: string;
  sentence: string;
  badge: "draft" | "live" | "accent" | "neutral" | "info" | "danger";
} {
  switch (state) {
    case "live":
      return {
        label: "Live",
        sentence: "Live. Published recently.",
        badge: "live",
      };
    case "changes":
      return {
        label: "Live, with changes",
        sentence: "You have changes that are not published yet",
        badge: "accent",
      };
    case "offline":
      return {
        label: "Offline",
        sentence: "Taken offline. You can publish again at any time.",
        badge: "neutral",
      };
    case "review":
      return {
        label: "Under review",
        sentence: "We are taking a quick look before it goes live",
        badge: "info",
      };
    case "suspended":
      return {
        label: "Suspended",
        sentence: "This website has been taken offline",
        badge: "danger",
      };
    default:
      return {
        label: "Not published",
        sentence: "Not live yet",
        badge: "draft",
      };
  }
}

export function displayAddress(address: string): string {
  try {
    return new URL(address).host;
  } catch {
    return address.replace(/^https?:\/\//, "");
  }
}

export type PagePublishStatus = "live" | "changes" | "draft";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const rec = value as Record<string, unknown>;
  const keys = Object.keys(rec).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(rec[key])}`)
    .join(",")}}`;
}

export function pagePublishStatus(input: {
  projectPublished: boolean;
  liveAt: string | null | undefined;
  liveSnapshot: unknown;
  page: {
    id: string;
    title: string;
    path: string;
    is_homepage: boolean;
    blocks: unknown;
    updated_at?: string | null;
  };
}): PagePublishStatus {
  if (!input.projectPublished) return "draft";
  const snapshot =
    input.liveSnapshot && typeof input.liveSnapshot === "object"
      ? (input.liveSnapshot as { pages?: Array<Record<string, unknown>> })
      : null;
  const snapshotPages = Array.isArray(snapshot?.pages) ? snapshot.pages : null;
  if (!snapshotPages) {
    if (!input.liveAt) return "draft";
    if (
      input.page.updated_at &&
      Date.parse(input.page.updated_at) > Date.parse(input.liveAt)
    ) {
      return "changes";
    }
    return "live";
  }

  const livePage = snapshotPages.find((p) => String(p.id ?? "") === input.page.id);
  if (!livePage) return "draft";

  const liveBlocks = stableStringify(livePage.blocks ?? null);
  const currentBlocks = stableStringify(input.page.blocks ?? null);
  const metadataChanged =
    String(livePage.title ?? "") !== input.page.title ||
    String(livePage.path ?? "") !== input.page.path ||
    Boolean(livePage.is_homepage) !== Boolean(input.page.is_homepage);

  if (metadataChanged || liveBlocks !== currentBlocks) {
    return "changes";
  }
  return "live";
}

