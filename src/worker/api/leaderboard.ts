/** Public, bounded, cacheable leaderboards built only from accepted, server-verified results. */
import type { HallOfFameEntry, Leaderboard, LeaderboardRow } from '../../shared/competition/api';
import { isWeekId } from '../../shared/competition/week';
import { validateCountry } from '../../shared/competition/identity';
import { RULESET_VERSION } from '../../shared/rules';
import { foundingStatus } from '../db/awards';
import { ensureWeek } from '../db/cup';
import type { Env } from '../env';
import { HttpError, json } from '../http';

const CACHE_SECONDS = 30;

interface Row {
  rnk: number;
  handle: string;
  visibility: string;
  account_state: string;
  country_code: string | null;
  score: number;
  goals: number;
  precision_total?: number;
  misses?: number;
}

/** Private or deleted players keep their rank but not their identity. */
function publicRow(r: Row): LeaderboardRow {
  const visible = r.visibility === 'public' && r.account_state === 'active';
  return {
    rank: r.rnk,
    handle: visible ? r.handle : null,
    country: visible ? r.country_code : null,
    score: r.score,
    goals: r.goals,
    ...(r.precision_total !== undefined ? { precisionTotal: r.precision_total } : {}),
    ...(r.misses !== undefined ? { misses: r.misses } : {}),
  };
}

export async function leaderboard(request: Request, env: Env, now: number): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? 'weekly';
  const offset = Math.max(0, Math.min(10_000, Number.parseInt(url.searchParams.get('offset') ?? '0', 10) || 0));
  const limitN = Math.max(1, Math.min(100, Number.parseInt(url.searchParams.get('limit') ?? '50', 10) || 50));

  if (kind === 'weekly' || kind === 'country') {
    let weekId = url.searchParams.get('week');
    if (!weekId) weekId = (await ensureWeek(env, now)).weekId;
    if (!isWeekId(weekId)) throw new HttpError(400, 'bad_week', 'Unknown week.');
    let country: string | null = null;
    if (kind === 'country') {
      const c = validateCountry(url.searchParams.get('country'));
      if (!c.ok || !c.country) throw new HttpError(400, 'bad_country', 'Choose a country.');
      country = c.country;
    }
    const where = `r.cup_week_id = ? AND r.ranked = 1 AND r.state = 'accepted'${country ? " AND p.country_code = ? AND p.visibility = 'public' AND p.account_state = 'active'" : ''}`;
    const binds: unknown[] = country ? [weekId, country] : [weekId];
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM runs r JOIN players p ON p.id = r.player_id WHERE ${where}`)
      .bind(...binds)
      .first<{ n: number }>();
    const rows = await env.DB.prepare(
      `SELECT RANK() OVER (ORDER BY r.skill_score DESC, r.goals DESC, r.precision_total DESC, r.misses ASC) AS rnk,
              p.handle, p.visibility, p.account_state, p.country_code,
              r.skill_score AS score, r.goals, r.precision_total, r.misses
         FROM runs r JOIN players p ON p.id = r.player_id
        WHERE ${where}
        ORDER BY rnk, r.submitted_at
        LIMIT ? OFFSET ?`,
    )
      .bind(...binds, limitN, offset)
      .all<Row>();
    const body: Leaderboard = {
      kind,
      weekId,
      country,
      rulesetVersion: RULESET_VERSION,
      generatedAt: now,
      offset,
      limit: limitN,
      total: total?.n ?? 0,
      rows: rows.results.map(publicRow),
    };
    return json(body, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` });
  }

  if (kind === 'career') {
    const total = await env.DB.prepare('SELECT COUNT(DISTINCT player_id) AS n FROM goal_ledger').first<{ n: number }>();
    const rows = await env.DB.prepare(
      `SELECT RANK() OVER (ORDER BY g.goals DESC) AS rnk, p.handle, p.visibility, p.account_state, p.country_code,
              g.goals AS score, g.goals
         FROM (SELECT player_id, COUNT(*) AS goals FROM goal_ledger GROUP BY player_id) g
         JOIN players p ON p.id = g.player_id
        ORDER BY rnk, p.created_at
        LIMIT ? OFFSET ?`,
    )
      .bind(limitN, offset)
      .all<Row>();
    const body: Leaderboard = {
      kind: 'career',
      weekId: null,
      country: null,
      rulesetVersion: RULESET_VERSION,
      generatedAt: now,
      offset,
      limit: limitN,
      total: total?.n ?? 0,
      rows: rows.results.map(publicRow),
    };
    return json(body, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` });
  }

  if (kind === 'hall') {
    const rows = await env.DB.prepare(
      `SELECT a.award_key, a.review_state, p.handle, p.visibility, p.account_state, p.country_code, r.skill_score
         FROM awards a JOIN players p ON p.id = a.player_id LEFT JOIN runs r ON r.id = a.source_run
        WHERE a.award_type = 'cup-week-winner' AND a.review_state != 'revoked'
        ORDER BY a.awarded_at DESC LIMIT 100`,
    ).all<{ award_key: string; review_state: HallOfFameEntry['reviewState']; handle: string; visibility: string; account_state: string; country_code: string | null; skill_score: number | null }>();
    const entries: HallOfFameEntry[] = rows.results.map((r) => {
      const visible = r.visibility === 'public' && r.account_state === 'active';
      return {
        weekId: r.award_key.split(':')[1] ?? '',
        handle: visible ? r.handle : null,
        country: visible ? r.country_code : null,
        score: r.skill_score ?? 0,
        reviewState: r.review_state,
      };
    });
    return json({ kind: 'hall', generatedAt: now, entries, founding: await foundingStatus(env) }, 200, { 'cache-control': `public, max-age=${CACHE_SECONDS}` });
  }

  throw new HttpError(400, 'bad_kind', 'Unknown leaderboard.');
}
