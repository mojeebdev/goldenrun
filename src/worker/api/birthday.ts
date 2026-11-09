/**
 * GET /api/v1/birthday/:mmdd — every official Ronaldo goal scored on a calendar day.
 * Read-only, public, cache-friendly: the data only changes when he scores.
 */
import type { BirthdayResponse, DateRef, GoalRow } from '../../shared/birthday';
import { buildResponse, goalFromRow, refFromKey } from '../../shared/birthday';
import type { Env } from '../env';
import { HttpError, json } from '../http';

const SUMMARY_TTL_MS = 10 * 60 * 1000;
let summary: { at: number; keys: Set<string>; career: BirthdayResponse['career'] } | null = null;

async function careerSummary(env: Env, now: number) {
  if (summary && now - summary.at < SUMMARY_TTL_MS) return summary;
  const [days, totals] = await env.DB.batch([
    env.DB.prepare('SELECT DISTINCT month_day FROM cr7_goals'),
    env.DB.prepare('SELECT COUNT(*) AS total, MAX(date) AS updated FROM cr7_goals'),
  ]);
  const keys = new Set((days!.results as { month_day: string }[]).map((r) => r.month_day));
  const t = (totals!.results as { total: number; updated: string | null }[])[0];
  summary = { at: now, keys, career: { total: t?.total ?? 0, updated: t?.updated ?? '' } };
  return summary;
}

/** Shared by the API and the server-rendered share metadata. */
export async function birthdayFor(env: Env, ref: DateRef, now = Date.now()): Promise<BirthdayResponse> {
  const [{ keys, career }, rows] = await Promise.all([
    careerSummary(env, now),
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
