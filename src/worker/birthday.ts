/**
 * birthday.goldenrun.fun — host routing and server-rendered share previews.
 *
 * The page itself is the SPA (src/app/pages/Birthday.tsx). The Worker serves the
 * SPA shell with date-specific title, description and a pre-rendered OG card
 * (public/birthday/og/<slug>.png, built by scripts/birthday/render-og.ts), so a
 * link like birthday.goldenrun.fun/aug-2 unfurls on X with its own card.
 */
import type { BirthdayResponse, DateRef } from '../shared/birthday';
import { BIRTHDAY_ORIGIN, BIRTHDAY_PATH, bestMatch, birthdayUrl, haulLabel, ogImageUrl, parseBirthday, scoreline } from '../shared/birthday';
import { birthdayFor } from './api/birthday';
import type { Env } from './env';

const LANDING = {
  title: 'Has Ronaldo scored on your birthday? · The Golden Run',
  description: 'Enter your birthday and see every official goal Cristiano Ronaldo has scored on that date: the opponent, the stadium, the score and the minute. Then share it on X.',
};

/** Paths on goldenrun.fun that belong to the birthday page. */
export const isBirthdayPath = (pathname: string) => pathname === BIRTHDAY_PATH || pathname.startsWith(`${BIRTHDAY_PATH}/`);

/** goldenrun.fun/birthday/aug-2 → birthday.goldenrun.fun/aug-2 */
export function canonicalRedirect(url: URL): Response {
  const rest = url.pathname.slice(BIRTHDAY_PATH.length).replace(/^\/+/, '');
  return Response.redirect(`${BIRTHDAY_ORIGIN}/${rest}${url.search}`, 301);
}

/** The date segment of a birthday page path, for either host ("" for the landing page). */
export function birthdaySegment(pathname: string, onBirthdayHost: boolean): string | null {
  const p = onBirthdayHost ? pathname : pathname.slice(BIRTHDAY_PATH.length);
  const seg = p.replace(/^\/+|\/+$/g, '');
  if (seg.includes('/')) return null;
  return seg;
}

function describe(r: BirthdayResponse) {
  if (r.total === 0) {
    const n = r.nearest;
    return {
      title: `Has Ronaldo scored on ${r.label}? Not yet. 😭`,
      description: `Cristiano Ronaldo has never scored an official goal on ${r.label}.${n ? ` His closest: ${n.before.label} and ${n.after.label}.` : ''} Check your birthday.`,
    };
  }
  const best = bestMatch(r.matches)!;
  const haul = haulLabel(best.goals.length);
  return {
    title: `Ronaldo has scored ${r.total} goal${r.total === 1 ? '' : 's'} on ${r.label} 🐐`,
    description: `${haul ? `${haul} · ` : ''}${scoreline(best)}, ${best.year}${best.stadium ? ` at ${best.stadium.split(',')[0]}` : ''}. ${r.matches.length} match${r.matches.length === 1 ? '' : 'es'} in all. Has he scored on your birthday?`,
  };
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function birthdayPage(request: Request, env: Env, segment: string): Promise<Response> {
  const url = new URL(request.url);
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers }));
  if (!shell.ok) return shell;

  let ref: DateRef | null = null;
  let data: BirthdayResponse | null = null;
  if (segment) {
    ref = parseBirthday(segment);
    if (ref && ref.slug !== segment.toLowerCase()) {
      // One URL per date (08-02, august-2 → aug-2) so shares and caches line up.
      const base = url.hostname.startsWith('birthday.') ? '' : BIRTHDAY_PATH;
      return Response.redirect(`${url.origin}${base}/${ref.slug}`, 301);
    }
    if (ref) {
      try {
        data = await birthdayFor(env, ref);
      } catch {
        data = null; // the page still loads and fetches on the client
      }
    }
  }

  const meta = data ? describe(data) : LANDING;
  const canonical = ref ? birthdayUrl(ref.slug) : `${BIRTHDAY_ORIGIN}/`;
  const image = ogImageUrl(ref ? ref.slug : 'default');
  const set = (content: string) => ({ element: (el: Element) => void el.setAttribute('content', content) });
  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(meta.title) })
    .on('meta[name="description"]', set(meta.description))
    .on('meta[property="og:title"]', set(meta.title))
    .on('meta[property="og:description"]', set(meta.description))
    .on('meta[property="og:url"]', set(canonical))
    .on('meta[property="og:image"]', set(image))
    .on('meta[name="twitter:title"]', set(meta.title))
    .on('meta[name="twitter:description"]', set(meta.description))
    .on('meta[name="twitter:image"]', set(image))
    .on('head', {
      element: (el) => {
        el.append(`<link rel="canonical" href="${escapeHtml(canonical)}" />`, { html: true });
        el.append(`<meta property="og:image:alt" content="${escapeHtml(meta.title)}" />`, { html: true });
        // Hand the first render its data so the result shows without a second round trip.
        if (data) el.append(`<script id="birthday-data" type="application/json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`, { html: true });
      },
    })
    .transform(shell);
  const headers = new Headers(rewritten.headers);
  headers.set('cache-control', 'public, max-age=300');
  return new Response(rewritten.body, { status: segment && !ref ? 404 : 200, headers });
}
