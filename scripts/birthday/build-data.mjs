#!/usr/bin/env node
/**
 * Builds the "Has Ronaldo scored on your birthday?" dataset from the source
 * CSVs in data/birthday/ and writes:
 *   - data/birthday/goals.json          (canonical, one row per goal, used by tests + OG render)
 *   - migrations/0003_birthday_seed.sql (D1 seed: table + inserts)
 *
 * Sources (official competitive goals only; friendlies for clubs excluded,
 * senior internationals including international friendlies included):
 *   source-club.csv            club goals, Sporting → Al Nassr, to 18 Mar 2023 (Transfermarkt-derived dataset)
 *   source-portugal-early.csv  Portugal goals 1–79 with venues (Wikipedia list)
 *   source-portugal-late.csv   Portugal goals 80–146 venues (Wikipedia list), used for stadium lookup
 *   source-recent.csv          career goals 614–985 with minutes (14 Oct 2017 → 29 Oct 2026)
 *
 * Usage: node scripts/birthday/build-data.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clubStadium, displayOpponent, NEUTRAL_VENUES } from './stadiums.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = join(ROOT, 'data', 'birthday');
const CUTOFF = '2017-10-14'; // first date covered by source-recent.csv
const EXPECTED_TOTAL = 985;
const EXPECTED_PORTUGAL = 146;

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}
const csv = (name) => parseCsv(readFileSync(join(DATA, name), 'utf8'));

// ---------- dates ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
/** "10/26/02" or "10-07-02" (m d yy) → ISO */
function isoFromMdy(s) {
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/.exec(s);
  if (!m) throw new Error(`bad m/d/y date: ${s}`);
  const yy = Number(m[3]);
  return `${yy > 50 ? 1900 + yy : 2000 + yy}-${pad(m[1])}-${pad(m[2])}`;
}
/** "29 Oct 2026" / "12 June 2004" → ISO */
function isoFromDmy(s) {
  const m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (!m) throw new Error(`bad d mon y date: ${s}`);
  const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (mi < 0) throw new Error(`bad month: ${s}`);
  return `${m[3]}-${pad(mi + 1)}-${pad(m[1])}`;
}

// ---------- normalisation ----------
const CLUB_NAMES = {
  'Sporting CP': 'Sporting CP',
  'Manchester United': 'Manchester United',
  'Real Madrid': 'Real Madrid',
  'Juventus FC': 'Juventus',
  'Al-Nassr FC': 'Al Nassr',
};
/** Club for a date in Ronaldo's career (used for source-recent rows, which carry no team). */
function clubOn(iso) {
  if (iso < '2003-08-12') return 'Sporting CP';
  if (iso < '2009-07-01') return 'Manchester United';
  if (iso < '2018-07-10') return 'Real Madrid';
  if (iso < '2021-08-31') return 'Juventus';
  if (iso < '2022-11-22') return 'Manchester United';
  return 'Al Nassr';
}
const INTL = /(World Cup Qualifier|World Cup ·|World Cup$|Nations League|Euros Qualifier|UEFA Euros|International Friendly|Confederations Cup)/;
const isIntlCompetition = (c) => INTL.test(c) && !/Club World Cup/.test(c);

const COMP_CLEAN = [
  [/^Champs League/, 'Champions League'],
  [/^UEFA Euros/, 'UEFA Euro'],
  [/^Euros Qualifier/, 'Euro Qualifier'],
];
const cleanComp = (c) => COMP_CLEAN.reduce((s, [re, to]) => s.replace(re, to), c.replace(/\s+-\s+/g, ' · '));

/** Club CSV competition names (Transfermarkt sponsor names) → readable. */
const CLUB_COMP = {
  'Liga Portugal': 'Liga Portugal',
  'Taca de Portugal Placard': 'Taça de Portugal',
  'Premier League': 'Premier League',
  'FA Cup': 'FA Cup',
  'EFL Cup': 'League Cup',
  'UEFA Champions League': 'Champions League',
  'UEFA Champions League Qualifying': 'Champions League · Qualifying',
  'FIFA Club World Cup': 'Club World Cup',
  'UEFA Super Cup': 'UEFA Super Cup',
  'Community Shield': 'Community Shield',
  'LaLiga': 'La Liga',
  'Copa del Rey': 'Copa del Rey',
  'Supercopa': 'Supercopa de España',
  'Serie A': 'Serie A',
  'Italy Cup': 'Coppa Italia',
  'Supercoppa Italiana': 'Supercoppa Italiana',
  'Saudi Pro League': 'Saudi Pro League',
  'Europa League': 'Europa League',
};

/** Minute strings: "90+5", "45+1'", "118'" → { minute: '90+5', sortable: 95 } */
function cleanMinute(s) {
  const v = s.replace(/'/g, '').trim();
  if (!v) return null;
  if (!/^\d{1,3}(\+\d{1,2})?$/.test(v)) throw new Error(`bad minute: ${s}`);
  return v;
}
const minuteSort = (m) => (m ? m.split('+').reduce((a, b) => a + Number(b), 0) : 999);

/** Excel-mangled score "3:00" → [3,0]; "1:02" → [1,2]; "2 - 1" → [2,1]; "2–1" → [2,1] */
function parseScore(s) {
  const m = /^(\d{1,2})\s*[:–-]\s*(\d{1,2})/.exec(s.replace(/‡/g, '').trim());
  if (!m) throw new Error(`bad score: ${s}`);
  return [Number(m[1]), Number(m[2])];
}

const OPP_CLEAN = [
  [/ FC$| CF$| SC$| CP$| AC$| CA$| SAD$/, ''],
  [/^FC /, ''],
];
/** The club CSV was saved as UTF-8 then read as Latin-1 somewhere upstream ("ZÃ¼rich"). */
const fixMojibake = (s) => (/[ÃÂ]/.test(s) ? Buffer.from(s, 'latin1').toString('utf8') : s);
function cleanOpponent(o) {
  let s = fixMojibake(o).replace(/\s+/g, ' ').trim();
  const keep = new Set(['Neom SC', 'Raja CA', 'FC Sheriff', 'AC Milan', 'FC Porto', 'Sporting CP', 'FC Barcelona', 'Juventus FC', 'Sevilla FC', 'Chelsea FC']);
  if (keep.has(s)) return displayOpponent(s === 'FC Sheriff' ? 'Sheriff Tiraspol' : s);
  for (const [re, to] of OPP_CLEAN) s = s.replace(re, to);
  return displayOpponent(s.trim());
}

/** The club CSV stores shoot-out scores in place of the result; these are the real full-time scores. */
const SHOOTOUT_RESULTS = {
  '2008-05-21|Chelsea': [1, 1], // UCL final, Moscow — United won 6–5 on pens
  '2012-04-25|Bayern Munich': [2, 1], // UCL semi 2nd leg — Real lost 1–3 on pens
};

// ---------- build ----------
const goals = [];

// 1. Club goals before CUTOFF (source-club.csv)
const clubRows = csv('source-club.csv');
const clubRecentOverlap = [];
for (const r of clubRows) {
  const date = isoFromMdy(r.Date);
  const team = CLUB_NAMES[r.Club];
  if (!team) throw new Error(`unknown club ${r.Club}`);
  if (date >= CUTOFF) { clubRecentOverlap.push({ date, team }); continue; }
  const opponent = cleanOpponent(r.Opponent);
  const [h, a] = parseScore(r.Result);
  const venue = r.Venue === 'H' ? 'H' : 'A';
  const [teamScore, oppScore] = SHOOTOUT_RESULTS[`${date}|${opponent}`] ?? (venue === 'H' ? [h, a] : [a, h]);
  const comp = CLUB_COMP[r.Competition];
  if (!comp) throw new Error(`unknown club competition ${r.Competition}`);
  const round = /^\d+$/.test(r.Matchday) ? '' : r.Matchday.replace(/^final$/i, 'Final').replace(/-Finals$/, '-final');
  goals.push({
    date, team, opponent, venue: NEUTRAL_VENUES[`${date}|${opponent}`] ? 'N' : venue,
    minute: cleanMinute(r.Minute), teamScore, oppScore,
    competition: !round ? comp : /^Group/.test(round) ? `${comp} · Group` : `${comp} · ${round}`,
    penalty: /penalty/i.test(r.Type), stadium: null, source: 'club',
  });
}

// 2. Portugal goals 1–79 (all before CUTOFF)
for (const r of csv('source-portugal-early.csv')) {
  const date = isoFromDmy(r.date);
  if (date >= CUTOFF) throw new Error(`Portugal early row after cutoff: ${r.no}`);
  const [teamScore, oppScore] = parseScore(r.result);
  const stadium = r.venue.split(',')[0].trim();
  const home = /, Portugal$/.test(r.venue);
  const away = r.venue.endsWith(`, ${r.opponent}`) || (r.opponent === 'Northern Ireland' && /Belfast/.test(r.venue));
  goals.push({
    date, team: 'Portugal', opponent: r.opponent, venue: home ? 'H' : away ? 'A' : 'N',
    minute: null, teamScore, oppScore,
    competition: r.competition === 'Friendly' ? 'International Friendly' : r.competition,
    penalty: r.score.includes('‡'), stadium, venueFull: r.venue, source: 'wikipedia',
  });
}

// 3. Portugal venues for later goals: date → venue
const lateVenue = new Map();
for (const r of csv('source-portugal-late.csv')) lateVenue.set(isoFromDmy(r.date), r.venue);

// 4. Recent goals 614–985
const recent = csv('source-recent.csv');
for (const r of recent) {
  const date = isoFromDmy(r.date);
  const intl = isIntlCompetition(r.competition);
  const team = intl ? 'Portugal' : clubOn(date);
  const [teamScore, oppScore] = parseScore(r.score);
  let stadium = null, venueFull;
  if (intl) {
    venueFull = lateVenue.get(date);
    if (!venueFull) throw new Error(`no Portugal venue for ${date} (${r.opponent}) goal ${r.no}`);
    stadium = venueFull.split(',')[0].trim();
  }
  goals.push({
    date, team, opponent: cleanOpponent(r.opponent), venue: r.venue,
    minute: cleanMinute(r.minute), teamScore, oppScore,
    competition: cleanComp(r.competition), penalty: null, stadium, venueFull,
    source: 'recent', careerNo: Number(r.no),
  });
}

// ---------- one naming scheme for competitions across all three sources ----------
const ORDINAL = { '3rd': 'Third', '4th': 'Fourth', '5th': 'Fifth', '6th': 'Sixth' };
function finalCompetition(c, iso) {
  const year = iso.slice(0, 4);
  let s = c
    .replace(/^(\d{4}) FIFA World Cup qualification$/, 'World Cup Qualifier')
    .replace(/^UEFA Euro \d{4} qualifying$/, 'Euro Qualifier')
    .replace(/^(\d{4}) FIFA (World Cup|Confederations Cup)$/, '$1 $2')
    .replace(/^World Cup · /, `${year} World Cup · `)
    .replace(/^UEFA Euro · /, 'UEFA Euro 2020 · ')
    .replace(/ · last 16$/, ' · Round of 16')
    .replace(/ · (\d)(?:rd|th) round$/i, (_m, d) => ` · ${ORDINAL[`${d}${d === '3' ? 'rd' : 'th'}`]} round`)
    .replace(/ · (Third|Fourth|Fifth|Sixth) Round$/, ' · $1 round');
  return s;
}
for (const g of goals) g.competition = finalCompetition(g.competition, g.date);

// ---------- order + number ----------
goals.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : minuteSort(a.minute) - minuteSort(b.minute)));
goals.forEach((g, i) => { g.no = i + 1; });

// ---------- stadiums for club goals ----------
const missingStadium = new Map();
for (const g of goals) {
  if (g.stadium) continue;
  const neutral = NEUTRAL_VENUES[`${g.date}|${g.opponent}`];
  if (neutral) { g.stadium = neutral; continue; }
  if (g.venue === 'N') { missingStadium.set(`${g.date}|${g.opponent}`, 'NEUTRAL'); continue; }
  const host = g.venue === 'H' ? g.team : g.opponent;
  const s = clubStadium(host, g.date);
  if (s) g.stadium = s; else missingStadium.set(host, (missingStadium.get(host) ?? 0) + 1);
}

// ---------- validation ----------
const errors = [];
const byTeam = goals.reduce((m, g) => ((m[g.team] = (m[g.team] ?? 0) + 1), m), {});
if (goals.length !== EXPECTED_TOTAL) errors.push(`total ${goals.length} != ${EXPECTED_TOTAL}`);
if (byTeam.Portugal !== EXPECTED_PORTUGAL) errors.push(`Portugal ${byTeam.Portugal} != ${EXPECTED_PORTUGAL}`);
for (const g of goals) if (g.careerNo && g.careerNo !== g.no) { errors.push(`numbering drift at ${g.date} ${g.opponent}: ${g.no} vs source ${g.careerNo}`); break; }
// Club CSV and recent source overlap 14 Oct 2017 → 18 Mar 2023: per-date club goal counts must agree.
const count = (arr) => arr.reduce((m, x) => ((m[`${x.date}|${x.team}`] = (m[`${x.date}|${x.team}`] ?? 0) + 1), m), {});
const a = count(clubRecentOverlap);
const b = count(goals.filter((g) => g.source === 'recent' && g.team !== 'Portugal' && g.date <= '2023-03-18'));
const overlapDiffs = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
if (overlapDiffs.length) errors.push(`club overlap mismatches: ${overlapDiffs.slice(0, 10).join(', ')}`);

console.log('goals by team', byTeam, 'total', goals.length);
console.log('overlap checked dates', Object.keys(a).length, 'mismatches', overlapDiffs.length);
if (missingStadium.size) console.log('missing stadiums', Object.fromEntries(missingStadium));
if (errors.length) { console.error('VALIDATION FAILED\n - ' + errors.join('\n - ')); process.exit(1); }
if (missingStadium.size) { console.error('stadium mapping incomplete'); process.exit(1); }

// ---------- outputs ----------
const out = goals.map(({ source: _s, careerNo: _c, venueFull: _v, ...g }) => g);
writeFileSync(join(DATA, 'goals.json'), JSON.stringify({ updated: out.at(-1).date, total: out.length, goals: out }, null, 0) + '\n');

const sq = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? '1' : '0') : `'${String(v).replace(/'/g, "''")}'`);
const schema = [
  `CREATE TABLE IF NOT EXISTS cr7_goals (
  no INTEGER PRIMARY KEY,           -- career goal number (1 = Sporting v Moreirense, 2002)
  date TEXT NOT NULL,               -- ISO yyyy-mm-dd (local match date)
  month_day TEXT NOT NULL,          -- mm-dd, the birthday lookup key
  team TEXT NOT NULL,               -- Sporting CP | Manchester United | Real Madrid | Juventus | Al Nassr | Portugal
  opponent TEXT NOT NULL,
  venue TEXT NOT NULL CHECK (venue IN ('H','A','N')),
  stadium TEXT,
  minute TEXT,                      -- e.g. '90+5'; NULL when unknown
  team_score INTEGER NOT NULL,      -- final score, Ronaldo's side first
  opp_score INTEGER NOT NULL,
  competition TEXT NOT NULL,
  penalty INTEGER                   -- 1/0, NULL when unknown
);`,
  'CREATE INDEX IF NOT EXISTS idx_cr7_goals_month_day ON cr7_goals (month_day, date);',
];
const inserts = [];
for (let i = 0; i < out.length; i += 50) {
  const chunk = out.slice(i, i + 50).map((g) =>
    `(${[g.no, g.date, g.date.slice(5), g.team, g.opponent, g.venue, g.stadium, g.minute, g.teamScore, g.oppScore, g.competition, g.penalty === null ? null : g.penalty].map(sq).join(',')})`);
  inserts.push(`INSERT INTO cr7_goals (no,date,month_day,team,opponent,venue,stadium,minute,team_score,opp_score,competition,penalty) VALUES\n${chunk.join(',\n')};`);
}
const header = [
  '-- Generated by scripts/birthday/build-data.mjs from data/birthday/source-*.csv. Do not edit by hand.',
  `-- "Has Ronaldo scored on your birthday?" — ${out.length} official career goals (club + Portugal), up to ${out.at(-1).date}.`,
];
// Refresh file: safe to run any time (`npm run birthday:seed:remote`) after new goals are added.
writeFileSync(join(DATA, 'seed.sql'), [...header, ...schema, 'DELETE FROM cr7_goals;', ...inserts].join('\n') + '\n');
// The migration seeds the first deploy. Applied migrations are immutable, so it is only written once.
const migration = join(ROOT, 'migrations', '0003_birthday_goals.sql');
if (!existsSync(migration) || process.argv.includes('--rewrite-migration')) {
  writeFileSync(migration, [...header, '-- Later goals are loaded with data/birthday/seed.sql (npm run birthday:seed:remote).', ...schema, ...inserts].join('\n') + '\n');
  console.log('wrote migrations/0003_birthday_goals.sql');
}
console.log('wrote data/birthday/goals.json and data/birthday/seed.sql');
