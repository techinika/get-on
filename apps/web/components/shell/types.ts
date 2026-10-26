import type { PlanId } from "@/lib/plans";

export type ShellRole = "owner" | "admin" | "editor" | "viewer";

export type ShellUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type ShellTeam = {
  id: string;
  name: string;
  planId: PlanId;
  role: ShellRole;
  isPersonal: boolean;
  billingStatus?: "active" | "grace" | "lapsed" | "free";
};

export type ShellProject = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
  updatedAt?: string | null;
  /** True when the Contact plugin is on for this website. */
  contactEnabled?: boolean;
  /** New contact messages waiting for the team. */
  unreadMessages?: number;
  /** The homepage page id, used for the quick preview link. */
  homepageId?: string | null;
  /** True when the saved content has changed since the live version. */
  hasUnpublishedChanges?: boolean;
  /** The public address of the website, when publishing is configured. */
  siteUrl?: string | null;
  /** The live main domain, when one is connected. */
  primaryHost?: string | null;
};

export type ShellUsage = {
  websites: number;
  members: number;
  storageBytes?: number;
  aiCredits?: number;
};
