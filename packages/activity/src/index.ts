export type ActivityCategory =
  | "website"
  | "team"
  | "billing"
  | "domain"
  | "ai"
  | "plugin"
  | "settings"
  | "security";

export type ActivityEventDef = {
  event: string;
  category: ActivityCategory;
  label: string;
  coalesceWindowSeconds: number;
};

const ACTIVITY_EVENTS: Record<string, ActivityEventDef> = {
  website_created: {
    event: "website_created",
    category: "website",
    label: "Created website",
    coalesceWindowSeconds: 0,
  },
  website_deleted: {
    event: "website_deleted",
    category: "website",
    label: "Deleted website",
    coalesceWindowSeconds: 0,
  },
  website_restored: {
    event: "website_restored",
    category: "website",
    label: "Restored website",
    coalesceWindowSeconds: 0,
  },
  website_purged: {
    event: "website_purged",
    category: "website",
    label: "Permanently removed website",
    coalesceWindowSeconds: 0,
  },
  website_published: {
    event: "website_published",
    category: "website",
    label: "Published website",
    coalesceWindowSeconds: 30,
  },
  page_created: {
    event: "page_created",
    category: "website",
    label: "Created page",
    coalesceWindowSeconds: 0,
  },
  page_deleted: {
    event: "page_deleted",
    category: "website",
    label: "Deleted page",
    coalesceWindowSeconds: 0,
  },
  "page.edited": {
    event: "page.edited",
    category: "website",
    label: "Edited page",
    coalesceWindowSeconds: 120,
  },
  "settings.business_updated": {
    event: "settings.business_updated",
    category: "settings",
    label: "Updated business details",
    coalesceWindowSeconds: 60,
  },
  "redirect.added": {
    event: "redirect.added",
    category: "website",
    label: "Added redirect",
    coalesceWindowSeconds: 0,
  },
  invite_expired: {
    event: "invite_expired",
    category: "team",
    label: "Team invitation expired",
    coalesceWindowSeconds: 0,
  },
  referral_reward_claimed: {
    event: "referral_reward_claimed",
    category: "billing",
    label: "Claimed referral reward",
    coalesceWindowSeconds: 0,
  },
};

export function activityEvent(event: string): ActivityEventDef | null {
  if (ACTIVITY_EVENTS[event]) return ACTIVITY_EVENTS[event];
  if (!event) return null;
  const prefix = event.split(/[._]/)[0] ?? "website";
  const category: ActivityCategory =
    prefix === "team" || prefix === "invite"
      ? "team"
      : prefix === "billing" || prefix === "plan" || prefix === "referral"
        ? "billing"
        : prefix === "domain"
          ? "domain"
          : prefix === "ai"
            ? "ai"
            : prefix === "plugin"
              ? "plugin"
              : prefix === "settings"
                ? "settings"
                : prefix === "security"
                  ? "security"
                  : "website";
  const label = event
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return {
    event,
    category,
    label,
    coalesceWindowSeconds: 0,
  };
}
