/**
 * GET /api/v1/birthday/:mmdd — every official Ronaldo goal scored on a calendar day.
 * Read-only, public, cache-friendly: the data only changes when he scores.
 */
import type { BirthdayGoal, BirthdayResponse, DateRef, GoalRow } from '../../shared/birthday';
import { buildResponse, goalFromRow, refFromKey } from '../../shared/birthday';
import type { Env } from '../env';
import { HttpError, json } from '../http';
import seed from '../../../data/birthday/goals.json';

const SEED_GOALS = (seed as { goals: BirthdayGoal[] }).goals;
const COLS = ['no', 'date', 'month_day', 'team', 'opponent', 'venue', 'stadium', 'minute', 'team_score', 'opp_score', 'competition', 'penalty'] as const;
const ROWS_PER_INSERT = 8; // 8 × 12 = 96 bound values, under D1's 100-per-statement limit

/**
 * Self-healing seed: creates cr7_goals and loads the bundled goals when the table
 * is missing or short (e.g. migration 0003 not yet applied remotely). Idempotent
 * (INSERT OR IGNORE), so concurrent first requests and a later migration are safe.
 */
export async function ensureBirthdaySeed(env: Env): Promise<void> {
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cr7_goals (
      no INTEGER PRIMARY KEY, date TEXT NOT NULL, month_day TEXT NOT NULL, team TEXT NOT NULL, opponent TEXT NOT NULL,
      venue TEXT NOT NULL CHECK (venue IN ('H','A','N')), stadium TEXT, minute TEXT, team_score INTEGER NOT NULL,
      opp_score INTEGER NOT NULL, competition TEXT NOT NULL, penalty INTEGER)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cr7_goals_month_day ON cr7_goals (month_day, date)'),
  ];
  for (let i = 0; i < SEED_GOALS.length; i += ROWS_PER_INSERT) {
    const chunk = SEED_GOALS.slice(i, i + ROWS_PER_INSERT);
    const placeholders = chunk.map(() => `(${COLS.map(() => '?').join(',')})`).join(',');
    const values = chunk.flatMap((g) => [
      g.no, g.date, g.date.slice(5), g.team, g.opponent, g.venue, g.stadium, g.minute, g.teamScore, g.oppScore, g.competition,
      g.penalty === null ? null : g.penalty ? 1 : 0,
    ]);
    stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO cr7_goals (${COLS.join(',')}) VALUES ${placeholders}`).bind(...values));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

const missingTable = (e: unknown) => e instanceof Error && /no such table: cr7_goals/i.test(e.message);

const SUMMARY_TTL_MS = 10 * 60 * 1000;
let summary: { at: number; keys: Set<string>; career: BirthdayResponse['career'] } | null = null;

async function careerSummary(env: Env, now: number) {
  if (summary && now - summary.at < SUMMARY_TTL_MS) return summary;
  let s = await readSummary(env, now).catch(async (e) => {
    if (!missingTable(e)) throw e;
    await ensureBirthdaySeed(env);
    return readSummary(env, now);
  });
  if (s.career.total < SEED_GOALS.length) {
    await ensureBirthdaySeed(env);
    s = await readSummary(env, now);
  }
  summary = s;
  return summary;
}

async function readSummary(env: Env, now: number) {
  const [days, totals] = await env.DB.batch([
    env.DB.prepare('SELECT DISTINCT month_day FROM cr7_goals'),
    env.DB.prepare('SELECT COUNT(*) AS total, MAX(date) AS updated FROM cr7_goals'),
  ]);
  const keys = new Set((days!.results as { month_day: string }[]).map((r) => r.month_day));
  const t = (totals!.results as { total: number; updated: string | null }[])[0];
  return { at: now, keys, career: { total: t?.total ?? 0, updated: t?.updated ?? '' } };
}

/** Shared by the API and the server-rendered share metadata. */
export async function birthdayFor(env: Env, ref: DateRef, now = Date.now()): Promise<BirthdayResponse> {
  const { keys, career } = await careerSummary(env, now); // seeds the table first if needed
  const [rows] = await Promise.all([
    env.DB.prepare(
      `SELECT no, date, team, opponent, venue, stadium, minute, team_score, opp_score, competition, penalty
         FROM cr7_goals WHERE month_day = ? ORDER BY date, no`,
    )
      .bind(ref.key)
      .all<GoalRow>(),
  ]);
  return buildResponse(ref, rows.results.map(goalFromRow), keys, career);
}

/** Test hook: forget the cached summary (fresh databases between tests). */
export function resetBirthdayCache() {
  summary = null;
}

export async function getBirthday(_req: Request, env: Env, now: number, key: string): Promise<Response> {
  const ref = refFromKey(key);
  if (!ref) throw new HttpError(404, 'not_found', 'That is not a calendar date. Use mm-dd, e.g. 08-02.');
  const body = await birthdayFor(env, ref, now);
  const res = json(body);
  res.headers.set('cache-control', 'public, max-age=600, s-maxage=3600');
  res.headers.set('access-control-allow-origin', '*');
  return res;
}
