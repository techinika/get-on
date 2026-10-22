import { createSiteWorker } from "./worker";

export { createSiteWorker } from "./worker";
export type { SiteWorkerOptions } from "./worker";
export type {
  CacheLike,
  ExecutionContextLike,
  KVLike,
  R2BucketLike,
  R2ObjectLike,
  WorkerEnv,
} from "./env";

export default createSiteWorker();
