/** Worker bindings (see wrangler.jsonc). Rate limiters are optional so tests can omit them. */
export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AUTH_LIMITER?: RateLimit;
  WRITE_LIMITER?: RateLimit;
  RP_ID: string;
  RP_NAME: string;
  /** Comma-separated list of exact origins allowed to call state-changing APIs. */
  ALLOWED_ORIGINS: string;
}
