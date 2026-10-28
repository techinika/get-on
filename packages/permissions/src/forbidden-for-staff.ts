/**
 * Tables, columns and storage buckets platform staff must never read.
 *
 * This list is the single source of truth for the privacy boundary. Tests and
 * CI use it to prove that no `app/admin/**` or `lib/admin/**` module reaches
 * customer content. Staff may only read metadata through the `admin_*` views
 * and `SECURITY DEFINER` functions, which select explicit metadata columns.
 */
export const forbiddenTables = [
  "pages",
  "page_versions",
  "project_settings",
  "site_snapshots",
  "publishes",
  "backups",
  "backup_blobs",
  "backup_media",
  "media",
  "project_exports",
  "project_imports",
  "project_operations",
  "project_activity",
  "contact_messages",
  "contact_recipients",
  "redirects",
  "tracked_links",
  "link_stats_daily",
  "param_stats_daily",
  "stats_daily",
  "stats_visitors_daily",
  "stats_param_whitelist",
  "stats_job_runs",
  "templates",
  "template_assets",
  "template_versions",
  "template_workspaces",
  "template_applications",
  "ai_payloads",
  "ai_requests",
  "ai_usage_daily",
  "ai_feedback",
  "ai_design_history",
  "ai_design_reports",
  "ai_unsupported_requests",
  "plugin_installs",
  "team_activity",
] as const;

export type ForbiddenTable = (typeof forbiddenTables)[number];

/**
 * Columns that carry content inside otherwise-metadata tables. Staff views must
 * never select them.
 */
export const forbiddenColumns: Record<string, string[]> = {
  publishes: ["snapshot"],
  projects: [],
  teams: [],
  platform_staff: [],
};

/** Storage buckets staff cannot list or read. */
export const forbiddenStorageBuckets = [
  "media",
  "backups",
  "exports",
  "imports",
  "site-assets",
  "template-assets",
] as const;

/** Modules that may not import the service-role client or a storage client. */
export const staffModuleGlobs = ["apps/web/app/admin/**", "apps/web/lib/admin/**"] as const;

/** Imports banned in staff modules. */
export const forbiddenImports = [
  "@/lib/supabase/admin",
  "@/lib/storage",
  "@/lib/supabase/storage",
  "@get-on/storage",
] as const;

export function isForbiddenTable(name: string): name is ForbiddenTable {
  return (forbiddenTables as readonly string[]).includes(name);
}
