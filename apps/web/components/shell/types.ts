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
};

export type ShellProject = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
  updatedAt?: string | null;
};

export type ShellUsage = {
  websites: number;
  members: number;
};
