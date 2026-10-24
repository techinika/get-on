/** The shape of the live pointer stored in KV (or the local pointer file). */
export type SiteState = "live" | "unpublished" | "suspended";

export type SitePause = {
  title: string;
  text: string;
  since?: string;
};

export type SiteRedirect = {
  from: string;
  to: string;
  code: number;
};

export type SitePointer = {
  siteId: string;
  publishId: string;
  state: SiteState;
  builtAt: string;
  plan: string;
  /** A friendly message that replaces the website while it is paused. */
  pause?: SitePause | null;
  /** Old addresses that are sent to a new page or a full link. */
  redirects?: SiteRedirect[];
};

export type SiteFile = {
  body: Uint8Array;
  contentType: string;
  etag: string;
  size: number;
};

/**
 * Everything the serving layer needs from storage. The Cloudflare adapter
 * reads KV and R2, the Node adapter reads a folder, and the tests use memory.
 */
export interface SiteStore {
  /** The live pointer for a host name, or null when there is none. */
  getPointer(host: string): Promise<SitePointer | null>;
  /** A file inside one published version. */
  getFile(
    siteId: string,
    publishId: string,
    path: string,
  ): Promise<SiteFile | null>;
  /**
   * A shared file that is not part of a version, such as the self-hosted
   * fonts. Optional: when a store has no shared area, fonts are expected to
   * live inside the version.
   */
  getSharedFile?(path: string): Promise<SiteFile | null>;
}
