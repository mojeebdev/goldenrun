/**
 * Awards derived from the immutable goal ledger. Every statement is an
 * idempotent INSERT OR IGNORE keyed by a unique award_key, so this can run
 * after each accepted run and again from the hourly cron without duplicates.
 *
 * Founding Golden Fan: the player whose 1,000th accepted ledger row has the
 * lowest ledger id — the server's own acceptance order, never a client clock.
 * It is granted as `provisional` and only becomes `confirmed` after the owner
 * audits it (docs/OPERATIONS.md).
 */
import type { AwardView } from '../../shared/competition/api';
import { CHAPTER_TARGET, FOUNDING_GOALS, MILESTONES } from '../../shared/competition/progression';
import type { Env } from '../env';

export async function grantAwards(env: Env, now: number, playerId?: string): Promise<void> {
  const only = playerId ? 'WHERE player_id = ?' : '';
  const pb = playerId ? [playerId] : [];
  const stmts: D1PreparedStatement[] = MILESTONES.map((n) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO awards (id, player_id, award_type, award_key, source_run, awarded_at, review_state)
       SELECT lower(hex(randomblob(16))), c.player_id, 'milestone', 'milestone-${n}:' || c.player_id,
              (SELECT g.run_id FROM goal_ledger g WHERE g.player_id = c.player_id ORDER BY g.id LIMIT 1 OFFSET ${n - 1}),
              ?, 'confirmed'
         FROM (SELECT player_id, COUNT(*) AS n FROM goal_ledger ${only} GROUP BY player_id) c
        WHERE c.n >= ${n}`,
    ).bind(now, ...pb),
  );
  stmts.push(
    env.DB.prepare(
      `INSERT OR IGNORE INTO awards (id, player_id, award_type, award_key, source_run, awarded_at, review_state)
       SELECT lower(hex(randomblob(16))), c.player_id, 'badge-2008', 'badge-2008:' || c.player_id, NULL, ?, 'confirmed'
         FROM (SELECT g.player_id, COUNT(*) AS n FROM goal_ledger g JOIN runs r ON r.id = g.run_id
                WHERE r.mode = 'chapter' ${playerId ? 'AND g.player_id = ?' : ''} GROUP BY g.player_id) c
        WHERE c.n >= ${CHAPTER_TARGET}`,
    ).bind(now, ...pb),
  );
  await env.DB.batch(stmts);

  // Only scan for the founding title once someone could have earned it.
  const eligible = await env.DB.prepare(
    `SELECT 1 FROM goal_ledger ${only} GROUP BY player_id HAVING COUNT(*) >= ${FOUNDING_GOALS} LIMIT 1`,
  )
    .bind(...pb)
    .first();
  if (!eligible) return;
  await env.DB.prepare(
    `INSERT OR IGNORE INTO awards (id, player_id, award_type, award_key, source_run, awarded_at, review_state)
     SELECT lower(hex(randomblob(16))), t.player_id, 'founding-golden-fan', 'founding-golden-fan', t.run_id, ?, 'provisional'
       FROM (SELECT player_id, run_id, id, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY id) AS rn FROM goal_ledger) t
       JOIN players p ON p.id = t.player_id
      WHERE t.rn = ${FOUNDING_GOALS} AND p.account_state = 'active'
        AND t.player_id NOT IN (SELECT player_id FROM awards WHERE award_type = 'founding-golden-fan' AND review_state = 'revoked')
      ORDER BY t.id
      LIMIT 1`,
  )
    .bind(now)
    .run();
}

export function awardLabel(type: string, key: string): string {
  switch (type) {
    case 'cup-week-winner':
      return `Golden Cup winner · ${key.split(':')[1] ?? ''}`;
    case 'milestone':
      return `${Number(key.split(':')[0]!.split('-')[1]).toLocaleString('en-US')} career goals`;
    case 'badge-2008':
      return '2008: The Beginning';
    case 'founding-golden-fan':
      return 'Founding Golden Fan';
    default:
      return type;
  }
}

export async function playerAwards(env: Env, playerId: string): Promise<AwardView[]> {
  const rows = await env.DB.prepare(
    `SELECT award_type, award_key, review_state, awarded_at FROM awards
      WHERE player_id = ? AND review_state != 'revoked' ORDER BY awarded_at DESC, award_key LIMIT 100`,
  )
    .bind(playerId)
    .all<{ award_type: string; award_key: string; review_state: AwardView['reviewState']; awarded_at: number }>();
  return rows.results.map((a) => ({
    type: a.award_type,
    label: awardLabel(a.award_type, a.award_key),
    reviewState: a.review_state,
    awardedAt: a.awarded_at,
  }));
}

export async function foundingStatus(env: Env) {
  const row = await env.DB.prepare(
    `SELECT a.review_state, a.awarded_at, p.handle, p.country_code, p.visibility, p.account_state
       FROM awards a JOIN players p ON p.id = a.player_id
      WHERE a.award_key = 'founding-golden-fan' AND a.review_state != 'revoked'`,
  ).first<{ review_state: 'provisional' | 'confirmed'; awarded_at: number; handle: string; country_code: string | null; visibility: string; account_state: string }>();
  if (!row) return { state: 'open' as const, handle: null, country: null, awardedAt: null };
  const visible = row.visibility === 'public' && row.account_state === 'active';
  return {
    state: row.review_state,
    handle: visible ? row.handle : null,
    country: visible ? row.country_code : null,
    awardedAt: row.awarded_at,
  };
}
