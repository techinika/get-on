export interface JobMessageBody {
  job: string;
  payload?: Record<string, unknown>;
  cron?: string;
  enqueuedAt?: string;
}

export interface QueueSendOptions {
  contentType?: "json" | "text" | "bytes" | "v8";
  delaySeconds?: number;
}

export interface QueueMessageRequest<Body = JobMessageBody> {
  body: Body;
  contentType?: "json" | "text" | "bytes" | "v8";
  delaySeconds?: number;
}

export interface QueueLike<Body = JobMessageBody> {
  send(message: Body, options?: QueueSendOptions): Promise<void>;
  sendBatch(messages: Iterable<QueueMessageRequest<Body>>): Promise<void>;
}

export interface MessageLike<Body = JobMessageBody> {
  readonly id: string;
  readonly timestamp: Date;
  readonly body: Body;
  readonly attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

export interface MessageBatchLike<Body = JobMessageBody> {
  readonly queue: string;
  readonly messages: readonly MessageLike<Body>[];
  ackAll(): void;
  retryAll(options?: { delaySeconds?: number }): void;
}

export interface ScheduledControllerLike {
  readonly scheduledTime: number;
  readonly cron: string;
  noRetry?: () => void;
}

export interface KvNamespaceLike {
  get(key: string, type: "json" | "text"): Promise<unknown>;
  put?(key: string, value: string): Promise<void>;
}

export interface AiGatewayOptions {
  id: string;
  skipCache?: boolean;
  collectLog?: boolean;
  metadata?: Record<string, string>;
}

export interface AiRunOptions {
  gateway?: AiGatewayOptions;
}

export interface AiBindingLike {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: AiRunOptions,
  ): Promise<unknown>;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

export interface ApiWorkerEnv {
  ROOT_DOMAIN?: string;
  APP_ORIGIN?: string;
  API_ORIGIN?: string;
  AI_GATEWAY_ID?: string;
  CRON_SECRET?: string;
  JOBS_SECRET?: string;
  WORKER_SHARED_SECRET?: string;
  CLOUDFLARE_ANALYTICS_API_TOKEN?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CF_API_TOKEN_DOMAINS?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CF_SAAS_ZONE_ID?: string;
  AI?: AiBindingLike;
  JOBS_QUEUE?: QueueLike<JobMessageBody>;
  SITES_KV?: KvNamespaceLike;
}
