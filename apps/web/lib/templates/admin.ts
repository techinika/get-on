import {
  SYSTEM_TEMPLATES,
  packageSummary,
  validateTemplatePackage,
} from "@get-on/templates";
import { createClient } from "@/lib/supabase/server";
import { StaffError } from "@/lib/admin/staff";
import { templatePackageBytes, templatePackageHash } from "./package-hash";

export type AdminSystemTemplateRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  business_types: string[];
  status: "draft" | "published" | "archived";
  plan_min: string;
  is_default: boolean;
  featured: boolean;
  sort: number;
  current_version_id: string | null;
  current_version: number | null;
  version_count: number;
  page_count: number;
  uses_count: number;
  created_at: string;
  updated_at: string;
};

export type AdminSystemTemplateVersion = {
  id: string;
  template_id: string;
  version: number;
  package_hash: string;
  schema_version: number;
  summary: string | null;
  page_count: number;
  block_count: number;
  required_plugins: string[];
  asset_count: number;
  bytes: number;
  created_at: string;
  is_current: boolean;
};

export type AdminSystemTemplateDetail = {
  template: AdminSystemTemplateRow;
  versions: AdminSystemTemplateVersion[];
};

export type SystemTemplateSyncResult = {
  imported: number;
  unchanged: number;
  templates: number;
};

export type SystemTemplateSyncRow = {
  ok: boolean;
  template_id: string;
  version_id: string;
  version: number;
  created: boolean;
  duplicate: boolean;
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new StaffError(error.message, error.message);
  return data as T;
}

export async function listSystemTemplates(): Promise<AdminSystemTemplateRow[]> {
  const result = await rpc<{ templates: AdminSystemTemplateRow[] }>(
    "admin_system_templates",
    {},
  );
  return result.templates ?? [];
}

export async function getSystemTemplate(
  templateId: string,
): Promise<AdminSystemTemplateDetail | null> {
  return rpc<AdminSystemTemplateDetail | null>("admin_system_template", {
    p_template: templateId,
  });
}

export async function syncSystemTemplateCatalog(): Promise<SystemTemplateSyncResult> {
  let imported = 0;
  let unchanged = 0;

  for (const [index, pkg] of SYSTEM_TEMPLATES.entries()) {
    const validation = validateTemplatePackage(pkg);
    if (!validation.ok) {
      throw new StaffError(
        "TEMPLATE_INVALID",
        `The ${pkg.meta.slug} template has a problem: ${
          validation.issues[0]?.message ?? "unknown issue"
        }`,
      );
    }

    const summary = packageSummary(pkg);
    const result = await rpc<SystemTemplateSyncRow>("admin_template_sync", {
      p_slug: pkg.meta.slug,
      p_meta: pkg.meta,
      p_package: pkg,
      p_package_hash: templatePackageHash(pkg),
      p_summary: "Imported from the code registry.",
      p_page_count: summary.pageCount,
      p_block_count: summary.blockCount,
      p_required_plugins: summary.requiredPlugins,
      p_fonts: null,
      p_asset_count: pkg.assets.length,
      p_bytes: templatePackageBytes(pkg),
      p_sort: (index + 1) * 10,
    });

    if (result.duplicate) unchanged += 1;
    else imported += 1;
  }

  return { imported, unchanged, templates: SYSTEM_TEMPLATES.length };
}
