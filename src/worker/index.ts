/**
 * The Golden Run application Worker.
 *
 * Static assets (the React + Phaser SPA) are served by Workers Static Assets;
 * this handler only runs for /api/* (see `run_worker_first` in wrangler.jsonc).
 *
 * Milestone 1 exposes a single harmless health endpoint. It also replays a
 * canonical shot through the SAME shared simulation the browser uses and
 * returns its digest, so browser/Worker determinism can be compared.
 */
import { CANONICAL_SHOT, RULESET_VERSION, resultDigest, simulateShot } from '../shared/rules';

/** Future bindings (Milestone 2+). Declared as types only — nothing is provisioned. */
export interface Env {
  ASSETS: Fetcher;
  // DB: D1Database;  // Milestone 2: players, runs, goal ledger (not configured yet)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method_not_allowed' }, 405);
      const result = simulateShot(CANONICAL_SHOT);
      return json({
        ok: true,
        service: 'goldenrun',
        milestone: 1,
        rulesetVersion: RULESET_VERSION,
        canonicalShot: { outcome: result.outcome, digest: resultDigest(result) },
      });
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not_found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
