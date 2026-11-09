/**
 * "Has Ronaldo scored on your birthday?" — birthday.goldenrun.fun
 *
 * Pure helpers shared by the Worker (API + share metadata), the React page and
 * the build-time OG card renderer. The goal data itself lives in D1
 * (`cr7_goals`, seeded from data/birthday/) — official competitive goals only.
 */

export const BIRTHDAY_HOST = 'birthday.goldenrun.fun';
export const BIRTHDAY_ORIGIN = `https://${BIRTHDAY_HOST}`;
/** Path prefix used when the page is served from goldenrun.fun (dev, previews). */
export const BIRTHDAY_PATH = '/birthday';

export type Team = 'Sporting CP' | 'Manchester United' | 'Real Madrid' | 'Juventus' | 'Al Nassr' | 'Portugal';

export interface BirthdayGoal {
  no: number;
  date: string; // yyyy-mm-dd
  team: Team;
  opponent: string;
  venue: 'H' | 'A' | 'N';
  stadium: string | null;
  minute: string | null;
  teamScore: number;
  oppScore: number;
  competition: string;
  penalty: boolean | null;
}

export interface BirthdayMatch {
  date: string;
  year: number;
  team: Team;
  opponent: string;
  venue: 'H' | 'A' | 'N';
  stadium: string | null;
  teamScore: number;
  oppScore: number;
  competition: string;
  goals: { no: number; minute: string | null; penalty: boolean | null }[];
}

export interface DateRef {
  key: string; // mm-dd
  slug: string; // aug-2
  label: string; // August 2
}

export interface BirthdayResponse extends DateRef {
  total: number;
  matches: BirthdayMatch[];
  /** Closest dates (either side, wrapping the year) on which he has scored, when this date has none. */
  nearest: { before: DateRef; after: DateRef } | null;
  /** Career goals in the dataset and the date of the latest one, for "as of" copy. */
  career: { total: number; updated: string };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const monthName = (m: number) => {
  const n = MONTHS[m - 1]!;
  return n[0]!.toUpperCase() + n.slice(1);
};
export const daysInMonth = (m: number) => DAYS_IN_MONTH[m - 1] ?? 31;

const pad = (n: number) => String(n).padStart(2, '0');

export function dateRef(month: number, day: number): DateRef {
  return { key: `${pad(month)}-${pad(day)}`, slug: `${MONTHS[month - 1]!.slice(0, 3)}-${day}`, label: `${monthName(month)} ${day}` };
}

/** Accepts "aug-2", "august-2", "08-02", "8-2" (case-insensitive). Returns null for anything else or an impossible date. */
export function parseBirthday(input: string): DateRef | null {
  const s = input.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  let month: number, day: number;
  let m = /^([a-z]{3,9})-(\d{1,2})$/.exec(s);
  if (m) {
    const word = m[1]!;
    const idx = MONTHS.findIndex((name) => name === word || (word.length === 3 && name.startsWith(word)) || (word === 'sept' && name === 'september'));
    if (idx < 0) return null;
    month = idx + 1;
    day = Number(m[2]);
  } else if ((m = /^(\d{1,2})-(\d{1,2})$/.exec(s))) {
    month = Number(m[1]);
    day = Number(m[2]);
  } else return null;
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(month)) return null;
  return dateRef(month, day);
}

export const refFromKey = (key: string) => parseBirthday(key);

/** Every calendar day, Feb 29 included, in order. */
export function allDates(): DateRef[] {
  const out: DateRef[] = [];
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= daysInMonth(m); d++) out.push(dateRef(m, d));
  return out;
}

/** Goals → matches, oldest first; goals inside a match ordered by minute. */
export function groupMatches(goals: BirthdayGoal[]): BirthdayMatch[] {
  const byMatch = new Map<string, BirthdayMatch>();
  for (const g of [...goals].sort((a, b) => a.no - b.no)) {
    const id = `${g.date}|${g.team}|${g.opponent}`;
    let match = byMatch.get(id);
    if (!match) {
      match = {
        date: g.date, year: Number(g.date.slice(0, 4)), team: g.team, opponent: g.opponent, venue: g.venue,
        stadium: g.stadium, teamScore: g.teamScore, oppScore: g.oppScore, competition: g.competition, goals: [],
      };
      byMatch.set(id, match);
    }
    match.goals.push({ no: g.no, minute: g.minute, penalty: g.penalty });
  }
  return [...byMatch.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Nearest dates with goals either side of `key`, wrapping round the calendar. */
export function nearestDates(key: string, keysWithGoals: Iterable<string>): { before: DateRef; after: DateRef } | null {
  const dates = allDates();
  const has = new Set(keysWithGoals);
  const i = dates.findIndex((d) => d.key === key);
  if (i < 0 || has.size === 0) return null;
  let before: DateRef | undefined, after: DateRef | undefined;
  for (let step = 1; step < dates.length && (!before || !after); step++) {
    const b = dates[(i - step + dates.length) % dates.length]!;
    const a = dates[(i + step) % dates.length]!;
    if (!before && has.has(b.key)) before = b;
    if (!after && has.has(a.key)) after = a;
  }
  return before && after ? { before, after } : null;
}

export const resultWord = (m: Pick<BirthdayMatch, 'teamScore' | 'oppScore'>) =>
  m.teamScore > m.oppScore ? 'Won' : m.teamScore < m.oppScore ? 'Lost' : 'Drew';

export function haulLabel(n: number): string | null {
  if (n >= 5) return `${n} goals`;
  if (n === 4) return 'Poker · 4 goals';
  if (n === 3) return 'Hat-trick';
  if (n === 2) return 'Brace';
  return null;
}

export const formatMinute = (g: { minute: string | null; penalty: boolean | null }) =>
  g.minute ? `${g.minute}'${g.penalty ? ' (pen)' : ''}` : g.penalty ? 'pen' : null;

/** "Real Madrid 4–1 Elche" — Ronaldo's side first. */
export const scoreline = (m: BirthdayMatch) => `${m.team} ${m.teamScore}–${m.oppScore} ${m.opponent}`;

/** The match fans will want to brag about: most goals, then latest. */
export function bestMatch(matches: BirthdayMatch[]): BirthdayMatch | null {
  return [...matches].sort((a, b) => b.goals.length - a.goals.length || (b.date > a.date ? 1 : -1))[0] ?? null;
}

export function headline(r: Pick<BirthdayResponse, 'total' | 'matches' | 'label'>): string {
  if (r.total === 0) return `Not yet. Ronaldo has never scored an official goal on ${r.label}.`;
  const years = r.matches.length;
  return `Yes. ${r.total} goal${r.total === 1 ? '' : 's'} on ${r.label}, in ${years} match${years === 1 ? '' : 'es'}.`;
}

export function birthdayUrl(slug: string) {
  return `${BIRTHDAY_ORIGIN}/${slug}`;
}

export function ogImageUrl(slug: string) {
  return `${BIRTHDAY_ORIGIN}${BIRTHDAY_PATH}/og/${slug}.jpg`;
}

/** Tweet text. Kept well under 280 characters including the link. */
export function shareText(r: Pick<BirthdayResponse, 'total' | 'matches' | 'label' | 'career'>): string {
  if (r.total === 0) {
    return `Cristiano Ronaldo has scored ${r.career.total.toLocaleString('en-US')} official goals… and NOT ONE on my birthday (${r.label}) 😭\n\nHas he scored on yours? 👇`;
  }
  const best = bestMatch(r.matches)!;
  const haul = haulLabel(best.goals.length);
  const highlight = haul
    ? `${haul === 'Hat-trick' ? 'a hat-trick' : haul === 'Brace' ? 'a brace' : haul.toLowerCase()} vs ${best.opponent} in ${best.year}`
    : `vs ${best.opponent} in ${best.year}`;
  const lead = r.total === 1
    ? `Cristiano Ronaldo scored on my birthday (${r.label}) 🐐 ${highlight}.`
    : `Cristiano Ronaldo has scored ${r.total} goals on my birthday (${r.label}) 🐐 Including ${highlight}.`;
  return `${lead}\n\nHas he scored on yours? 👇`;
}

export function xIntentUrl(r: Pick<BirthdayResponse, 'total' | 'matches' | 'label' | 'slug' | 'career'>): string {
  const params = new URLSearchParams({ text: shareText(r), url: birthdayUrl(r.slug) });
  return `https://x.com/intent/post?${params.toString()}`;
}

/** Kit colours for result cards: primary, secondary, text-on-primary. No crests or logos. */
export const KITS: Record<Team, { primary: string; secondary: string; ink: string; short: string }> = {
  'Sporting CP': { primary: '#00804a', secondary: '#ffffff', ink: '#ffffff', short: 'Sporting' },
  'Manchester United': { primary: '#da291c', secondary: '#fbe122', ink: '#ffffff', short: 'Man United' },
  'Real Madrid': { primary: '#f4f4f4', secondary: '#febe10', ink: '#0b1220', short: 'Real Madrid' },
  Juventus: { primary: '#111111', secondary: '#f4f4f4', ink: '#ffffff', short: 'Juventus' },
  'Al Nassr': { primary: '#fcd116', secondary: '#1d3d8f', ink: '#0b1220', short: 'Al Nassr' },
  Portugal: { primary: '#c8102e', secondary: '#046a38', ink: '#ffffff', short: 'Portugal' },
};

/** Raw D1 row → API goal. */
export interface GoalRow {
  no: number;
  date: string;
  team: Team;
  opponent: string;
  venue: 'H' | 'A' | 'N';
  stadium: string | null;
  minute: string | null;
  team_score: number;
  opp_score: number;
  competition: string;
  penalty: number | null;
}
export const goalFromRow = (r: GoalRow): BirthdayGoal => ({
  no: r.no, date: r.date, team: r.team, opponent: r.opponent, venue: r.venue, stadium: r.stadium, minute: r.minute,
  teamScore: r.team_score, oppScore: r.opp_score, competition: r.competition, penalty: r.penalty === null ? null : r.penalty === 1,
});

/** Builds the response for one date from its goals plus the set of all scoring dates. */
export function buildResponse(ref: DateRef, goals: BirthdayGoal[], keysWithGoals: Iterable<string>, career: BirthdayResponse['career']): BirthdayResponse {
  const matches = groupMatches(goals);
  return { ...ref, total: goals.length, matches, nearest: goals.length ? null : nearestDates(ref.key, keysWithGoals), career };
}

/** Host check shared by the Worker router and the SPA entry. */
export const isBirthdayHost = (hostname: string) => hostname === BIRTHDAY_HOST || hostname.startsWith('birthday.');
