#!/usr/bin/env node
/**
 * Pre-renders the X/OG share card for every calendar date (366 + a landing card)
 * into public/birthday/og/<slug>.jpg, from data/birthday/goals.json.
 *
 * Static PNGs keep share previews instant and free at viral traffic, and keep the
 * stack Cloudflare-only (served by Workers Static Assets). Runs as part of
 * `npm run build`; skips work when the data and this script are unchanged.
 *
 * No photos, crests or logos: type, gold and kit-colour stripes only.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import sharp from 'sharp';
import { KITS, allDates, bestMatch, buildResponse, haulLabel } from '../../src/shared/birthday.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'birthday', 'og');
const DATA = join(ROOT, 'data', 'birthday', 'goals.json');
const FONT = (pkg, file) => readFileSync(join(ROOT, 'node_modules', '@fontsource', pkg, 'files', file));

const W = 1200;
const H = 630;
const GOLD = '#e8b84a';
const CHALK = '#f2efe6';

const raw = readFileSync(DATA);
const stamp = createHash('sha256').update(raw).update(readFileSync(fileURLToPath(import.meta.url))).update(readFileSync(join(ROOT, 'src/shared/birthday.ts'))).digest('hex');
const stampFile = join(OUT, '.stamp');
if (!process.argv.includes('--force') && existsSync(stampFile) && readFileSync(stampFile, 'utf8') === stamp) {
  console.log('birthday OG cards up to date');
  process.exit(0);
}

const { goals, total, updated } = JSON.parse(raw.toString('utf8'));
const byKey = new Map();
for (const g of goals) {
  const k = g.date.slice(5);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(g);
}
const career = { total, updated };

const fonts = [
  { name: 'Barlow Condensed', data: FONT('barlow-condensed', 'barlow-condensed-latin-800-italic.woff'), weight: 800, style: 'italic' },
  { name: 'Barlow Condensed', data: FONT('barlow-condensed', 'barlow-condensed-latin-600-normal.woff'), weight: 600, style: 'normal' },
  { name: 'Figtree', data: FONT('figtree', 'figtree-latin-600-normal.woff'), weight: 600, style: 'normal' },
  { name: 'Azeret Mono', data: FONT('azeret-mono', 'azeret-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
];

/** Tiny hyperscript for satori's element objects. */
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c !== null && c !== false) } });
const text = (style, s) => h('div', style, String(s));

function frame(children, kits) {
  const stripes = kits.length ? kits : ['#8e1b2a'];
  return h('div', {
    width: W, height: H, position: 'relative', flexDirection: 'column', overflow: 'hidden',
    backgroundColor: '#05070d',
    backgroundImage: 'radial-gradient(circle at 82% 0%, rgba(255,216,140,0.34) 0%, rgba(255,216,140,0) 46%), linear-gradient(180deg, #05070d 0%, #0b1220 62%, #14203a 100%)',
    fontFamily: 'Figtree', color: CHALK,
  },
    text({ position: 'absolute', right: -30, top: -150, fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 760, color: 'rgba(232,184,74,0.08)', lineHeight: 1 }, '7'),
    h('div', { flexDirection: 'column', padding: '58px 72px 0 72px', flexGrow: 1 }, children),
    h('div', { height: 92, alignItems: 'center', justifyContent: 'space-between', padding: '0 72px', borderTop: '1px solid rgba(242,239,230,0.12)', backgroundColor: 'rgba(5,7,13,0.55)' },
      text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 40, color: GOLD, letterSpacing: 1 }, 'THE GOLDEN RUN'),
      text({ fontFamily: 'Azeret Mono', fontSize: 24, color: 'rgba(242,239,230,0.7)' }, 'birthday.goldenrun.fun'),
    ),
    h('div', { position: 'absolute', left: 0, right: 0, bottom: 0, height: 12 },
      stripes.map((c) => h('div', { flexGrow: 1, height: 12, backgroundColor: c })),
    ),
  );
}

const kicker = (s) => text({ fontFamily: 'Azeret Mono', fontSize: 26, letterSpacing: 3, color: GOLD }, s.toUpperCase());

function dateCard(ref) {
  const r = buildResponse(ref, byKey.get(ref.key) ?? [], byKey.keys(), career);
  const dateLine = text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 132, lineHeight: 0.95, marginTop: 18, color: CHALK }, ref.label.toUpperCase());
  if (r.total === 0) {
    return frame([
      kicker('Has Ronaldo scored on'),
      dateLine,
      text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: GOLD, marginTop: 6 }, 'NOT YET.'),
      text({ fontSize: 34, marginTop: 18, color: 'rgba(242,239,230,0.85)' }, `${total.toLocaleString('en-US')} official goals. Not one on ${ref.label}.`),
    ], []);
  }
  const best = bestMatch(r.matches);
  const haul = haulLabel(best.goals.length);
  const years = [...new Set(r.matches.map((m) => m.year))];
  const kits = [...new Set(r.matches.map((m) => m.team))].map((t) => KITS[t].primary);
  const yearLine = years.length <= 6 ? years.join(' · ') : `${years.slice(0, 5).join(' · ')} +${years.length - 5} more`;
  return frame([
    kicker('Ronaldo scored on'),
    dateLine,
    h('div', { alignItems: 'flex-end', marginTop: 4 },
      text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 150, lineHeight: 0.9, color: GOLD }, `${r.total}`),
      text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 64, lineHeight: 1, color: CHALK, marginLeft: 18, marginBottom: 14 }, `GOAL${r.total === 1 ? '' : 'S'}`),
      best.goals.length >= 3 ? text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 40, color: '#05070d', backgroundColor: GOLD, padding: '2px 16px', marginLeft: 22, marginBottom: 22, borderRadius: 6 }, haul.toUpperCase()) : null,
    ),
    text({ fontSize: 32, marginTop: 14, color: 'rgba(242,239,230,0.9)' }, `${haul ? `${haul} vs ${best.opponent}` : `vs ${best.opponent}`} · ${KITS[best.team].short} · ${best.year}`),
    text({ fontFamily: 'Azeret Mono', fontSize: 22, marginTop: 10, color: 'rgba(242,239,230,0.55)' }, `${r.matches.length} MATCH${r.matches.length === 1 ? '' : 'ES'}: ${yearLine}`),
  ], kits);
}

function landingCard() {
  return frame([
    kicker('The trend everyone is checking'),
    text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 124, lineHeight: 0.9, marginTop: 22, color: CHALK }, 'HAS RONALDO SCORED'),
    text({ fontFamily: 'Barlow Condensed', fontStyle: 'italic', fontWeight: 800, fontSize: 124, lineHeight: 0.9, color: GOLD }, 'ON YOUR BIRTHDAY?'),
    text({ fontSize: 34, marginTop: 24, color: 'rgba(242,239,230,0.85)' }, `${total.toLocaleString('en-US')} official goals. 366 dates. Find yours.`),
  ], Object.values(KITS).map((k) => k.primary));
}

/** satori → SVG (text as paths) → JPEG. JPEG keeps 367 gradient cards around 45 KB each. */
async function jpg(el) {
  const svg = await satori(el, { width: W, height: H, fonts });
  return sharp(Buffer.from(svg)).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}

mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
writeFileSync(join(OUT, 'default.jpg'), await jpg(landingCard()));
for (const ref of allDates()) writeFileSync(join(OUT, `${ref.slug}.jpg`), await jpg(dateCard(ref)));
writeFileSync(stampFile, stamp);
console.log(`rendered ${allDates().length + 1} birthday OG cards in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
