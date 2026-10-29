/**
 * Integration harness: the real Worker API handler against a real local D1
 * (Miniflare via wrangler's getPlatformProxy), with migrations applied fresh.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { handleApi } from '../../src/worker/index';
import type { Env } from '../../src/worker/env';
import { SoftAuthenticator } from './authenticator';

export const ORIGIN = 'http://localhost:5173';

export async function startHarness() {
  const proxy = await getPlatformProxy<Env>({ persist: { path: mkdtempSync(join(tmpdir(), 'gr-d1-')) } });
  const env: Env = {
    ...(proxy.env as Env),
    // Rate limiting is exercised separately; tests run unthrottled.
    AUTH_LIMITER: undefined,
    WRITE_LIMITER: undefined,
    RP_ID: 'localhost',
    RP_NAME: 'The Golden Run',
    ALLOWED_ORIGINS: ORIGIN,
  };
  for (const file of readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join('migrations', file), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      await env.DB.prepare(stmt).run();
    }
  }
  return { env, dispose: () => proxy.dispose() };
}

export interface Client {
  cookie: string | null;
  call: <T = Record<string, unknown>>(method: string, path: string, body?: unknown, opts?: { now?: number; origin?: string | null }) => Promise<{ status: number; body: T; setCookie: string | null }>;
}

export function client(env: Env, defaultNow: () => number): Client {
  const c: Client = {
    cookie: null,
    async call(method, path, body, opts = {}) {
      const headers: Record<string, string> = {};
      const origin = opts.origin === undefined ? ORIGIN : opts.origin;
      if (origin) headers.origin = origin;
      if (c.cookie) headers.cookie = c.cookie;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const res = await handleApi(
        new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
        env,
        opts.now ?? defaultNow(),
      );
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const pair = setCookie.split(';')[0]!;
        c.cookie = pair.endsWith('=') ? null : pair;
      }
      return { status: res.status, body: (await res.json()) as never, setCookie };
    },
  };
  return c;
}

/** Register a new account end to end; returns the signed-in client and its authenticator. */
export async function registerPlayer(env: Env, now: () => number, handle: string, country: string | null = null) {
  const c = client(env, now);
  const auth = new SoftAuthenticator(ORIGIN, 'localhost');
  const opt = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>(
    'POST',
    '/api/v1/auth/registration/options',
    { handle, country, acceptRules: true },
  );
  if (opt.status !== 200) throw new Error(`options ${opt.status} ${JSON.stringify(opt.body)}`);
  const ver = await c.call<{ recoveryCodes: string[] }>('POST', '/api/v1/auth/registration/verify', {
    challengeId: opt.body.challengeId,
    response: await auth.register(opt.body.options),
  });
  if (ver.status !== 201) throw new Error(`verify ${ver.status} ${JSON.stringify(ver.body)}`);
  return { client: c, auth, recoveryCodes: ver.body.recoveryCodes };
}
