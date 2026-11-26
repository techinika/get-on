import type { PagePublishStatus } from "@/lib/publishing/status";

export type PageRow = {
  id: string;
  project_id: string;
  title: string;
  path: string;
  position: number;
  is_homepage: boolean;
  blocks: unknown[] | null;
  created_at?: string;
  updated_at?: string;
  publishStatus?: PagePublishStatus;
};

export type ProjectSummary = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
};
