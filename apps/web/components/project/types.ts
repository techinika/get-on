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
};

export type ProjectSummary = {
  id: string;
  name: string;
  subdomain: string;
  status: "draft" | "published";
};
