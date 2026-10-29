/**
 * The Golden Run application Worker.
 *
 * Static assets (React + Phaser SPA) are served by Workers Static Assets; this
 * handler runs for /api/*, for pages with server-rendered metadata (/, /about,
 * /u/*, /c/* — see `run_worker_first`) and for the hourly cron.
 */
import { CANONICAL_SHOT, RULESET_VERSION, resultDigest, simulateShot } from '../shared/rules';
import type { Bootstrap } from '../shared/competition/api';
import * as auth from './api/auth';
import { leaderboard } from './api/leaderboard';
import { deleteMe, getMe, getProfile, updateMe } from './api/players';
import { getRun, startRun, submitRun } from './api/runs';
import { getChallenge, getProgress, reportPlayer } from './api/progress';
import { hasPageMeta, withShareMeta } from './meta';
import { settle } from './cron';
import { ensureWeek } from './db/cup';
import type { Env } from './env';
import { HttpError, assertSameOrigin, errorResponse, json } from './http';
import { currentSession } from './security/session';

type Handler = (request: Request, env: Env, now: number, params: string[]) => Promise<Response>;

const routes: [method: string, pattern: RegExp, handler: Handler][] = [
  ['GET', /^\/api\/health$/, async () => {
    const result = simulateShot(CANONICAL_SHOT);
    return json({ ok: true, service: 'goldenrun', milestone: 4, rulesetVersion: RULESET_VERSION, canonicalShot: { outcome: result.outcome, digest: resultDigest(result) } });
  }],
  ['GET', /^\/api\/v1\/bootstrap$/, async (req, env, now) => {
    const [cup, session] = await Promise.all([ensureWeek(env, now), currentSession(env, req, now)]);
    const body: Bootstrap = { rulesetVersion: RULESET_VERSION, serverNow: now, cup, player: session ? { handle: session.handle } : null };
    return json(body);
  }],
  ['POST', /^\/api\/v1\/auth\/registration\/options$/, auth.registrationOptions],
  ['POST', /^\/api\/v1\/auth\/registration\/verify$/, auth.registrationVerify],
  ['POST', /^\/api\/v1\/auth\/login\/options$/, auth.loginOptions],
  ['POST', /^\/api\/v1\/auth\/login\/verify$/, auth.loginVerify],
  ['POST', /^\/api\/v1\/auth\/passkeys\/options$/, auth.addPasskeyOptions],
  ['POST', /^\/api\/v1\/auth\/passkeys\/verify$/, auth.addPasskeyVerify],
  ['POST', /^\/api\/v1\/auth\/recover$/, auth.recover],
  ['POST', /^\/api\/v1\/auth\/recovery-codes$/, auth.regenerateRecoveryCodes],
  ['POST', /^\/api\/v1\/auth\/logout$/, auth.logout],
  ['POST', /^\/api\/v1\/auth\/logout-all$/, auth.logoutEverywhere],
  ['GET', /^\/api\/v1\/me$/, getMe],
  ['PATCH', /^\/api\/v1\/me$/, updateMe],
  ['DELETE', /^\/api\/v1\/me$/, deleteMe],
  ['POST', /^\/api\/v1\/runs\/start$/, startRun],
  ['POST', /^\/api\/v1\/runs\/([0-9a-f-]{36})\/submit$/, (req, env, now, p) => submitRun(req, env, now, p[0]!)],
  ['GET', /^\/api\/v1\/runs\/([0-9a-f-]{36})$/, (req, env, now, p) => getRun(req, env, now, p[0]!)],
  ['GET', /^\/api\/v1\/leaderboard$/, leaderboard],
  ['GET', /^\/api\/v1\/progress$/, getProgress],
  ['GET', /^\/api\/v1\/challenges\/([0-9a-f-]{36})$/, (_req, env, now, p) => getChallenge(env, now, p[0]!)],
  ['POST', /^\/api\/v1\/reports$/, reportPlayer],
  ['GET', /^\/api\/v1\/players\/([A-Za-z0-9_]{3,20})$/, (_req, env, _now, p) => getProfile(env, p[0]!)],
];

export async function handleApi(request: Request, env: Env, now = Date.now()): Promise<Response> {
  const url = new URL(request.url);
  try {
    let pathMatched = false;
    for (const [method, pattern, handler] of routes) {
      const m = pattern.exec(url.pathname);
      if (!m) continue;
      pathMatched = true;
      const reqMethod = request.method === 'HEAD' ? 'GET' : request.method;
      if (reqMethod !== method) continue;
      if (method !== 'GET') assertSameOrigin(request, env);
      return await handler(request, env, now, m.slice(1));
    }
    if (pathMatched) throw new HttpError(405, 'method_not_allowed', 'Method not allowed.');
    throw new HttpError(404, 'not_found', 'Not found.');
  } catch (e) {
    return errorResponse(e);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (hasPageMeta(url.pathname)) return withShareMeta(request, env);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(settle(env, Date.now()).then(() => undefined));
  },
} satisfies ExportedHandler<Env>;
