import { zipSync } from "fflate";
import sharp from "sharp";
import { validateContent } from "@get-on/blocks";
import {
  SITE_PACKAGE_CONTENT_SCHEMA_VERSION,
  SITE_PACKAGE_FORMAT,
  SITE_PACKAGE_FORMAT_VERSION,
  SITE_PACKAGE_THEME_VERSION,
  SitePackageError,
  checksumsFor,
  contentHash,
  sha256Hex,
  type SiteDocument,
  type SitePackageManifest,
  type SitePage,
} from "@get-on/site-package";
import type { createClient } from "@/lib/supabase/server";
import { primaryAddress, readPublishConfig } from "@/lib/publishing/config";
import {
  buildSiteInput,
  usedImageIds,
  type SourceMedia,
  type SourcePage,
  type SourceProject,
  type SourceSettings,
} from "@/lib/publishing/build-input";
import { buildSite } from "@get-on/publisher";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PackageProject = {
  id: string;
  name: string;
  subdomain: string;
  primary_host: string | null;
  settings?: unknown;
  plan_id?: string | null;
};

export type PackageSource = {
  project: PackageProject;
  settings: (SourceSettings & Record<string, unknown>) | null;
  pages: SourcePage[];
  media: SourceMedia[];
  plugins: string[];
  redirects: Array<{ from_path: string; to_type: string; to_value: string | null; code: number }>;
};

export type BackupOptions = {
  pictures: boolean;
  files: boolean;
  messages: boolean;
};

export type BackupResult = {
  bytes: Uint8Array;
  manifest: SitePackageManifest;
  document: SiteDocument;
  mediaCount: number;
  mediaBytes: number;
  jsonBytes: number;
};

export async function loadPackageSource(
  supabase: Supabase,
  project: PackageProject,
): Promise<PackageSource> {
  const [{ data: settings }, { data: pages }, { data: media }, { data: installs }, { data: redirects }] =
    await Promise.all([
      supabase.from("project_settings").select("*").eq("project_id", project.id).maybeSingle(),
      supabase
        .from("pages")
        .select(
          "id, title, path, position, is_homepage, blocks, show_in_menu, is_hidden, seo_title, seo_description, hide_from_search, social_image_url",
        )
        .eq("project_id", project.id)
        .order("position", { ascending: true }),
      supabase
        .from("media")
        .select("id, path, alt, width, height, mime")
        .eq("project_id", project.id)
        .is("deleted_at", null),
      supabase
        .from("plugin_installs")
        .select("plugin_id, state")
        .eq("project_id", project.id)
        .eq("state", "active"),
      supabase
        .from("redirects")
        .select("from_path, to_type, to_value, code")
        .eq("project_id", project.id),
    ]);

  return {
    project,
    settings: (settings as PackageSource["settings"]) ?? null,
    pages: (pages ?? []) as SourcePage[],
    media: (media ?? []) as SourceMedia[],
    plugins: (installs ?? []).map((row) => String(row.plugin_id)),
    redirects: (redirects ?? []) as PackageSource["redirects"],
  };
}

export function buildContentDocument(source: PackageSource): SiteDocument {
  const config = readPublishConfig();
  const settings = source.settings ?? {};
  const pages: SitePage[] = source.pages.map((page) => {
    const parsed = validateContent(page.blocks);
    if (!parsed.ok) {
      throw new SitePackageError("EXPORT_NOT_VALID", "A page has content we cannot export.");
    }
    return {
      pageKey: page.id,
      title: page.title,
      path: page.path,
      position: page.position,
      is_homepage: page.is_homepage,
      blocks: parsed.content.blocks,
      show_in_menu: page.show_in_menu !== false,
      is_hidden: Boolean(page.is_hidden),
      seo_title: page.seo_title ?? null,
      seo_description: page.seo_description ?? null,
      hide_from_search: Boolean(page.hide_from_search),
      social_image_url: (page as SourcePage & { social_image_url?: string | null }).social_image_url ?? null,
    };
  });

  return {
    profile: {
      name: source.project.name,
      address: primaryAddress(config, source.project.subdomain, source.project.primary_host),
    },
    look: (settings.theme as Record<string, unknown> | undefined) ?? {},
    pages,
    sharedSections: [],
    search: {
      title: settings.seo_site_title ?? null,
      description: settings.seo_description ?? null,
      titleFormat: settings.seo_title_format ?? "{page} | {site}",
      indexing: settings.search_indexing !== false,
      twitterHandle: settings.twitter_handle ?? null,
    },
    redirects: source.redirects.map((row) => ({
      from_path: row.from_path,
      to_type: row.to_type,
      to_value: row.to_value,
      code: row.code,
    })),
    google: (settings.verification as Record<string, unknown> | undefined) ?? {},
    plugins: source.plugins,
    customNotFound: (settings.custom_404 as Record<string, unknown> | undefined) ?? {},
    templateOrigin: null,
  };
}

function manifestFor(
  source: PackageSource,
  document: SiteDocument,
  kind: SitePackageManifest["kind"],
  options: BackupOptions,
  mediaCount: number,
  mediaBytes: number,
): SitePackageManifest {
  return {
    format: SITE_PACKAGE_FORMAT,
    formatVersion: SITE_PACKAGE_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    createdWith: "Get-On",
    kind,
    contentSchemaVersion: SITE_PACKAGE_CONTENT_SCHEMA_VERSION,
    themeVersion: SITE_PACKAGE_THEME_VERSION,
    source: {
      name: source.project.name,
      address: primaryAddress(
        readPublishConfig(),
        source.project.subdomain,
        source.project.primary_host,
      ),
    },
    options,
    counts: {
      pages: document.pages.length,
      redirects: document.redirects.length,
      pictures: mediaCount,
      messages: options.messages ? 1 : 0,
    },
    contentHash: contentHash(document),
    mediaTotalBytes: mediaBytes,
  };
}

export function buildContentBytes(source: PackageSource): { bytes: Uint8Array; manifest: SitePackageManifest; document: SiteDocument } {
  const document = buildContentDocument(source);
  const manifest = manifestFor(
    source,
    document,
    "export",
    { pictures: false, files: false, messages: false },
    0,
    0,
  );
  return {
    bytes: new TextEncoder().encode(JSON.stringify({ manifest, document }, null, 2)),
    manifest,
    document,
  };
}

async function readMediaBytes(
  supabase: Supabase,
  media: SourceMedia[],
): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, media.length) }, async () => {
    while (cursor < media.length) {
      const item = media[cursor]!;
      cursor += 1;
      const { data, error } = await supabase.storage.from("project-media").download(item.path);
      if (!error && data) out.set(item.id, new Uint8Array(await data.arrayBuffer()));
    }
  });
  await Promise.all(workers);
  return out;
}

async function normaliseImage(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mime: string; width: number | null; height: number | null }> {
  const image = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await image.metadata();
  let quality = 82;
  let encoded = await image.webp({ quality }).toBuffer();
  while (encoded.byteLength > 5 * 1024 * 1024 && quality > 40) {
    quality -= 12;
    encoded = await sharp(bytes, { failOn: "none" }).rotate().webp({ quality }).toBuffer();
  }
  if (encoded.byteLength > 5 * 1024 * 1024) {
    throw new SitePackageError("BACKUP_MEDIA_TOO_BIG");
  }
  return {
    bytes: new Uint8Array(encoded),
    mime: "image/webp",
    width: meta.width ?? null,
    height: meta.height ?? null,
  };
}

async function readMessages(supabase: Supabase, projectId: string) {
  const { data } = await supabase
    .from("contact_messages")
    .select("form_id, page_path, name, email, phone, message, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function buildBackup(
  supabase: Supabase,
  source: PackageSource,
  options: BackupOptions,
): Promise<BackupResult> {
  const document = buildContentDocument(source);
  const media = options.pictures ? source.media : [];
  const bytesById = await readMediaBytes(supabase, media);
  const mediaEntries: Array<Record<string, unknown>> = [];
  const files: Record<string, Uint8Array> = {};
  let mediaBytes = 0;

  for (const item of media) {
    const bytes = bytesById.get(item.id);
    if (!bytes) continue;
    const normalised = await normaliseImage(bytes);
    const sha256 = sha256Hex(normalised.bytes);
    const filePath = `media/files/${sha256}.webp`;
    if (!files[filePath]) {
      files[filePath] = normalised.bytes;
      mediaBytes += normalised.bytes.byteLength;
    }
    mediaEntries.push({
      id: item.id,
      path: filePath,
      sha256,
      mime: normalised.mime,
      bytes: normalised.bytes.byteLength,
      width: normalised.width,
      height: normalised.height,
      alt: item.alt ?? null,
    });
  }

  const manifest = manifestFor(
    source,
    document,
    "backup",
    options,
    mediaEntries.length,
    mediaBytes,
  );
  const siteJson = new TextEncoder().encode(JSON.stringify({ manifest, document }, null, 2));
  files["site.json"] = siteJson;
  files["media/index.json"] = new TextEncoder().encode(JSON.stringify(mediaEntries, null, 2));

  if (options.messages) {
    const messages = await readMessages(supabase, source.project.id);
    files["messages.json"] = new TextEncoder().encode(JSON.stringify(messages, null, 2));
  }

  const checksumEntries = Object.entries(files)
    .filter(([path]) => path !== "checksums.sha256")
    .map(([path, value]) => ({ path, bytes: value }));
  files["checksums.sha256"] = new TextEncoder().encode(checksumsFor(checksumEntries));

  return {
    bytes: zipSync(files, { level: 6 }),
    manifest,
    document,
    mediaCount: mediaEntries.length,
    mediaBytes,
    jsonBytes: siteJson.byteLength,
  };
}

export type WebsiteZipResult = {
  bytes: Uint8Array;
  bytesCount: number;
  pageCount: number;
};

export async function buildWebsiteZip(
  supabase: Supabase,
  source: PackageSource,
  planId: string,
): Promise<WebsiteZipResult> {
  const wanted = usedImageIds(source.pages);
  const media = source.media.filter((item) => wanted.has(item.id));
  const imageBytes = await readMediaBytes(supabase, media);
  const config = readPublishConfig();
  const input = buildSiteInput({
    project: source.project as SourceProject,
    projectSettings: source.settings,
    pages: source.pages,
    media,
    imageBytes,
    planId,
    publishId: `export-${crypto.randomUUID()}`,
    rootDomain: config.kind === "local" ? config.localRootDomain : config.rootDomain,
    primaryHost: source.project.primary_host,
    activePlugins: source.plugins,
  });
  const result = await buildSite(input);
  const files: Record<string, Uint8Array> = {};
  for (const [path, file] of Object.entries(result.files)) files[path] = file.body;
  for (const [path, file] of Object.entries(result.shared)) files[path] = file.body;
  files["README.txt"] = new TextEncoder().encode(
    `This is a copy of your published website.\n\nUpload the files in this folder to any static web host. The home page is index.html.\n\nThis copy does not include the Get-On editor, your account, contact messages or visitor statistics.\n`,
  );
  return {
    bytes: zipSync(files, { level: 6 }),
    bytesCount: Object.values(files).reduce((sum, value) => sum + value.byteLength, 0),
    pageCount: input.pages.filter((page) => !page.hidden).length,
  };
}
