import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { TemplatePackage } from "@get-on/templates";
import type {
  AdminSystemTemplateDetail,
  AdminSystemTemplateRow,
  AdminSystemTemplateVersion,
  SystemTemplateSyncRow,
} from "./admin";

const STORE_FILE = "/tmp/get-on-system-templates.json";

type LocalTemplateRecord = {
  template: AdminSystemTemplateRow;
  versions: AdminSystemTemplateVersion[];
};

type LocalCatalogState = {
  byId: Record<string, LocalTemplateRecord>;
  lastSyncedAt: string | null;
};

const globalForTemplates = globalThis as typeof globalThis & {
  __getOnSystemTemplatesState?: LocalCatalogState;
};

function readDiskState(): LocalCatalogState | null {
  try {
    if (!existsSync(STORE_FILE)) return null;
    const raw = readFileSync(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalCatalogState;
    if (parsed && typeof parsed === "object" && parsed.byId) {
      return parsed;
    }
  } catch {
    // Ignore unreadable cache file
  }
  return null;
}

function getState(): LocalCatalogState {
  if (!globalForTemplates.__getOnSystemTemplatesState) {
    globalForTemplates.__getOnSystemTemplatesState = readDiskState() ?? {
      byId: {},
      lastSyncedAt: null,
    };
  }
  return globalForTemplates.__getOnSystemTemplatesState;
}

function persistState(state: LocalCatalogState): void {
  globalForTemplates.__getOnSystemTemplatesState = state;
  try {
    writeFileSync(STORE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal in read-only filesystems
  }
}

function deterministicUuid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  const hex1 = h1.toString(16).padStart(8, "0");
  const hex2 = h2.toString(16).padStart(8, "0");
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-8${hex1.slice(0, 3)}-${hex1}${hex2.slice(0, 4)}`;
}

export function listLocalSystemTemplates(): AdminSystemTemplateRow[] {
  const state = getState();
  return Object.values(state.byId)
    .map((entry) => entry.template)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export function getLocalSystemTemplate(
  templateId: string,
): AdminSystemTemplateDetail | null {
  const state = getState();
  const direct = state.byId[templateId];
  if (direct) return direct;
  for (const record of Object.values(state.byId)) {
    if (record.template.slug === templateId) return record;
  }
  return null;
}

export function getLocalTemplateSyncMeta(): {
  count: number;
  lastSyncedAt: string | null;
} {
  const state = getState();
  return {
    count: Object.keys(state.byId).length,
    lastSyncedAt: state.lastSyncedAt,
  };
}

export function syncLocalSystemTemplate(input: {
  slug: string;
  meta: TemplatePackage["meta"];
  packageHash: string;
  summary: string;
  pageCount: number;
  blockCount: number;
  requiredPlugins: string[];
  assetCount: number;
  bytes: number;
  sort: number;
}): SystemTemplateSyncRow {
  const state = getState();
  const now = new Date().toISOString();

  let record = Object.values(state.byId).find(
    (entry) => entry.template.slug === input.slug,
  );

  if (!record) {
    const templateId = deterministicUuid(`tpl:${input.slug}`);
    const versionId = deterministicUuid(
      `tpl-ver:${input.slug}:1:${input.packageHash}`,
    );
    const version: AdminSystemTemplateVersion = {
      id: versionId,
      template_id: templateId,
      version: 1,
      package_hash: input.packageHash,
      schema_version: 5,
      summary: input.summary,
      page_count: input.pageCount,
      block_count: input.blockCount,
      required_plugins: input.requiredPlugins,
      asset_count: input.assetCount,
      bytes: input.bytes,
      created_at: now,
      is_current: false,
    };
    const template: AdminSystemTemplateRow = {
      id: templateId,
      slug: input.slug,
      name: input.meta.name,
      tagline: input.meta.tagline,
      description: input.meta.description,
      category: input.meta.category,
      tags: input.meta.tags ?? [],
      business_types: input.meta.businessTypes ?? [],
      status: "draft",
      plan_min: input.meta.planMin ?? "free",
      is_default: input.slug === "blank" || input.sort === 10,
      featured: input.meta.featured ?? false,
      sort: input.sort,
      current_version_id: null,
      current_version: null,
      version_count: 1,
      page_count: input.pageCount,
      uses_count: 0,
      created_at: now,
      updated_at: now,
    };
    record = { template, versions: [version] };
    state.byId[templateId] = record;
    state.lastSyncedAt = now;
    persistState(state);
    return {
      ok: true,
      template_id: templateId,
      version_id: versionId,
      version: 1,
      created: true,
      duplicate: false,
    };
  }

  record.template.name = input.meta.name;
  record.template.tagline = input.meta.tagline;
  record.template.description = input.meta.description;
  record.template.category = input.meta.category;
  record.template.tags = input.meta.tags ?? [];
  record.template.business_types = input.meta.businessTypes ?? [];
  record.template.plan_min = input.meta.planMin ?? "free";
  record.template.featured = input.meta.featured ?? false;
  record.template.sort = input.sort;
  record.template.page_count = input.pageCount;

  const existingVersion = record.versions.find(
    (v) => v.package_hash === input.packageHash,
  );
  if (existingVersion) {
    state.lastSyncedAt = now;
    persistState(state);
    return {
      ok: true,
      template_id: record.template.id,
      version_id: existingVersion.id,
      version: existingVersion.version,
      created: false,
      duplicate: true,
    };
  }

  const nextVersionNumber =
    record.versions.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const versionId = deterministicUuid(
    `tpl-ver:${input.slug}:${nextVersionNumber}:${input.packageHash}`,
  );
  const nextVersion: AdminSystemTemplateVersion = {
    id: versionId,
    template_id: record.template.id,
    version: nextVersionNumber,
    package_hash: input.packageHash,
    schema_version: 5,
    summary: input.summary,
    page_count: input.pageCount,
    block_count: input.blockCount,
    required_plugins: input.requiredPlugins,
    asset_count: input.assetCount,
    bytes: input.bytes,
    created_at: now,
    is_current: false,
  };
  record.versions = [nextVersion, ...record.versions];
  record.template.version_count = record.versions.length;
  record.template.updated_at = now;
  state.lastSyncedAt = now;
  persistState(state);

  return {
    ok: true,
    template_id: record.template.id,
    version_id: versionId,
    version: nextVersionNumber,
    created: true,
    duplicate: false,
  };
}

export function publishLocalSystemTemplate(input: {
  templateId: string;
  versionId: string;
}): {
  ok: boolean;
  duplicate: boolean;
  template_id: string;
  version_id: string;
  version: number;
} {
  const state = getState();
  const record = state.byId[input.templateId];
  if (!record) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }
  const targetVersion = record.versions.find((v) => v.id === input.versionId);
  if (!targetVersion) {
    throw new Error("TEMPLATE_VERSION_NOT_FOUND");
  }
  const duplicate =
    record.template.status === "published" &&
    record.template.current_version_id === input.versionId;

  record.versions = record.versions.map((v) => ({
    ...v,
    is_current: v.id === input.versionId,
  }));
  record.template.status = "published";
  record.template.current_version_id = input.versionId;
  record.template.current_version = targetVersion.version;
  record.template.updated_at = new Date().toISOString();
  persistState(state);

  return {
    ok: true,
    duplicate,
    template_id: record.template.id,
    version_id: targetVersion.id,
    version: targetVersion.version,
  };
}
