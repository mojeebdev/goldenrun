import { HttpError } from '../http';

/** Workers Rate Limiting API wrapper. Missing bindings (tests) are treated as unlimited. */
export async function limit(limiter: RateLimit | undefined, key: string): Promise<void> {
  if (!limiter) return;
  const { success } = await limiter.limit({ key });
  if (!success) throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a minute and try again.');
}
