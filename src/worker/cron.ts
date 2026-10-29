/**
 * Hourly settlement (Cron Trigger on the same Worker). Idempotent: it reads all
 * deadlines from D1 and can run late, twice or concurrently without harm.
 */
import { ensureWeek } from './db/cup';
import type { Env } from './env';

export async function settle(env: Env, now: number): Promise<{ expired: number; closed: number; awarded: number }> {
  await ensureWeek(env, now);
  const expired = await env.DB.prepare("UPDATE runs SET state = 'expired' WHERE state = 'started' AND deadline_at < ?").bind(now).run();
  const closed = await env.DB.prepare("UPDATE cup_weeks SET status = 'closed' WHERE status = 'open' AND ends_at <= ?").bind(now).run();

  let awarded = 0;
  const weeks = await env.DB.prepare("SELECT id FROM cup_weeks WHERE status = 'closed'").all<{ id: string }>();
  for (const w of weeks.results) {
    // Provisional winners: every accepted ranked run sharing rank 1. Pending
    // reviews are excluded; owners re-run settlement after resolving them.
    const res = await env.DB.prepare(
      `INSERT OR IGNORE INTO awards (id, player_id, award_type, award_key, source_run, awarded_at, review_state)
       SELECT lower(hex(randomblob(16))), t.player_id, 'cup-week-winner', 'cup-week-winner:' || t.cup_week_id || ':' || t.player_id, t.id, ?, 'provisional'
         FROM (SELECT r.*, RANK() OVER (ORDER BY r.skill_score DESC, r.goals DESC, r.precision_total DESC, r.misses ASC) AS rnk
                 FROM runs r WHERE r.cup_week_id = ? AND r.ranked = 1 AND r.state = 'accepted') t
        WHERE t.rnk = 1`,
    )
      .bind(now, w.id)
      .run();
    awarded += res.meta.changes;
    const pending = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM runs WHERE cup_week_id = ? AND ranked = 1 AND state IN ('pending_review', 'started')",
    )
      .bind(w.id)
      .first<{ n: number }>();
    if ((pending?.n ?? 0) === 0) {
      await env.DB.prepare("UPDATE cup_weeks SET status = 'finalized', finalized_at = ? WHERE id = ? AND status = 'closed'").bind(now, w.id).run();
    }
  }
  if (expired.meta.changes || closed.meta.changes || awarded) {
    await env.DB.prepare('INSERT INTO audit_events (at, kind, detail) VALUES (?, ?, ?)')
      .bind(now, 'cron.settled', JSON.stringify({ expired: expired.meta.changes, closed: closed.meta.changes, awarded }))
      .run();
  }
  return { expired: expired.meta.changes, closed: closed.meta.changes, awarded };
}
