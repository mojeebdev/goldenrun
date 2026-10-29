/**
 * Server-rendered metadata. The Worker serves the SPA's index.html with
 * page-specific tags, rewritten on Cloudflare with HTMLRewriter (no third-party
 * preview service), so crawlers and link previews see them without running JS:
 *  - /u/:handle and /c/:runId: share-preview titles and descriptions.
 *  - / and /about: canonical URL plus the schema.org JSON-LD graph that links
 *    the game, its creator and its publisher.
 */
import { flagEmoji } from '../shared/competition/identity';
import { SITE as SITE_INFO } from '../shared/site';
import type { StructuredPage } from '../shared/structuredData';
import { ABOUT_DESCRIPTION, structuredDataScript } from '../shared/structuredData';
import type { Env } from './env';

interface Meta {
  title: string;
  description: string;
  /** Absolute canonical URL; only set for pages that have one fixed address. */
  canonical?: string;
  structured?: StructuredPage;
}

const SITE = SITE_INFO.name;

const PAGES: Record<string, Meta> = {
  '/': {
    title: 'The Golden Run — 2008 → 1,000',
    description:
      'An independent football arcade game. Drag, curl and strike past the keeper, play the 2008 chapter, chase 1,000 verified goals and enter the weekly Golden Cup. Free in your browser.',
    canonical: `${SITE_INFO.url}/`,
    structured: 'home',
  },
  '/about': {
    title: 'About The Golden Run — the story, the creator and the studio',
    description: ABOUT_DESCRIPTION,
    canonical: `${SITE_INFO.url}/about`,
    structured: 'about',
  },
};

/** Paths whose HTML the Worker renders itself (kept in step with run_worker_first in wrangler.jsonc). */
export function hasPageMeta(pathname: string): boolean {
  return Object.hasOwn(PAGES, pathname) || pathname.startsWith('/u/') || pathname.startsWith('/c/');
}

async function metaFor(env: Env, path: string): Promise<Meta | null> {
  if (Object.hasOwn(PAGES, path)) return PAGES[path]!;
  const u = /^\/u\/([A-Za-z0-9_]{3,20})\/?$/.exec(path);
  if (u) {
    const p = await env.DB.prepare(
      `SELECT p.handle, p.country_code, (SELECT COUNT(*) FROM goal_ledger g WHERE g.player_id = p.id) AS goals
         FROM players p WHERE p.handle_norm = ? AND p.visibility = 'public' AND p.account_state = 'active'`,
    )
      .bind(u[1]!.toLowerCase())
      .first<{ handle: string; country_code: string | null; goals: number }>();
    if (!p) return null;
    return {
      title: `${p.handle}${p.country_code ? ` ${flagEmoji(p.country_code)}` : ''} — ${SITE}`,
      description: `${p.goals} verified career goals on the Road to 1,000. Can you catch them?`,
    };
  }
  const c = /^\/c\/([0-9a-f-]{36})\/?$/.exec(path);
  if (c) {
    const r = await env.DB.prepare(
      `SELECT r.skill_score, r.goals, r.cup_week_id, p.handle, p.visibility, p.account_state
         FROM runs r JOIN players p ON p.id = r.player_id
        WHERE r.id = ? AND r.mode = 'cup' AND r.ranked = 1 AND r.state = 'accepted'`,
    )
      .bind(c[1])
      .first<{ skill_score: number; goals: number; cup_week_id: string; handle: string; visibility: string; account_state: string }>();
    if (!r) return null;
    const who = r.visibility === 'public' && r.account_state === 'active' ? r.handle : 'A player';
    return {
      title: `${who} scored ${r.skill_score.toLocaleString('en-US')} — beat these 12 shots`,
      description: `${r.goals}/12 goals in the Golden Cup ${r.cup_week_id}. Same spots, same keepers — take the challenge on ${SITE}.`,
    };
  }
  return null;
}

export async function withShareMeta(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!env.ASSETS) return new Response('Assets binding missing', { status: 500 });
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers }));
  let meta: Meta | null = null;
  try {
    meta = await metaFor(env, url.pathname);
  } catch {
    meta = null; // never let a preview lookup break the page itself
  }
  if (!meta || !shell.ok) return shell;
  const set = (content: string) => ({
    element: (el: Element) => {
      el.setAttribute('content', content);
    },
  });
  const rewritten = new HTMLRewriter()
    .on('title', {
      element: (el) => {
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', set(meta.description))
    .on('meta[property="og:title"]', set(meta.title))
    .on('meta[property="og:description"]', set(meta.description))
    .on('meta[property="og:url"]', set(meta.canonical ?? url.origin + url.pathname))
    .on('meta[name="twitter:title"]', set(meta.title))
    .on('meta[name="twitter:description"]', set(meta.description))
    .on('head', {
      element: (el) => {
        if (meta.canonical) el.append(`<link rel="canonical" href="${meta.canonical}" />`, { html: true });
        if (meta.structured) el.append(`<script type="application/ld+json">${structuredDataScript(meta.structured)}</script>`, { html: true });
      },
    })
    .transform(shell);
  const headers = new Headers(rewritten.headers);
  headers.set('cache-control', meta.structured ? 'public, max-age=300' : 'public, max-age=60');
  return new Response(rewritten.body, { status: 200, headers });
}
