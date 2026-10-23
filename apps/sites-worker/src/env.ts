export type KVLike = {
  get(
    key: string,
    options?: { type?: "json"; cacheTtl?: number },
  ): Promise<unknown>;
};

export type R2HttpMetadataLike = {
  contentType?: string;
};

export type R2ObjectLike = {
  etag: string;
  httpEtag?: string;
  size: number;
  httpMetadata?: R2HttpMetadataLike;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>;
};

export type WorkerEnv = {
  SITES_BUCKET: R2BucketLike;
  SITES_KV: KVLike;
  ROOT_DOMAIN?: string;
  /** Secret used to sign and verify form tokens. */
  FORM_TOKEN_SECRET?: string;
  /** Previous form token secret, kept during rotation. */
  FORM_TOKEN_SECRET_PREVIOUS?: string;
  /** Shared secret used to sign forwarded form requests. */
  WORKER_SHARED_SECRET?: string;
  /** The app origin that receives forwarded form submissions. */
  APP_ORIGIN?: string;
};

export type CacheLike = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
};
