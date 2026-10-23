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
