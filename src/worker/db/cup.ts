/** Cup week persistence. Weeks are created lazily and deterministically, so concurrent creation is harmless. */
import { cupMaxScore, cupScenarioIds, scenarioSetHash } from '../../shared/competition/cup';
import { weekWindow } from '../../shared/competition/week';
import { CUP } from '../../shared/competition/cup';
import type { CupInfo } from '../../shared/competition/api';
import { RULESET_VERSION } from '../../shared/rules';
import type { Env } from '../env';

interface CupWeekRow {
  id: string;
  starts_at: number;
  ends_at: number;
  ruleset_version: string;
  scenario_ids: string;
  scenario_set_hash: string;
  status: 'open' | 'closed' | 'finalized';
}

export function toCupInfo(row: CupWeekRow): CupInfo {
  const ids = JSON.parse(row.scenario_ids) as string[];
  return {
    weekId: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    rulesetVersion: row.ruleset_version,
    scenarioIds: ids,
    scenarioSetHash: row.scenario_set_hash,
    targetSeconds: CUP.targetSeconds,
    graceSeconds: CUP.graceSeconds,
    maxScore: cupMaxScore(ids),
    status: row.status,
  };
}

export async function ensureWeek(env: Env, now: number): Promise<CupInfo> {
  const w = weekWindow(now);
  const ids = cupScenarioIds(w.id, RULESET_VERSION);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO cup_weeks (id, starts_at, ends_at, ruleset_version, scenario_ids, scenario_set_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(w.id, w.startsAt, w.endsAt, RULESET_VERSION, JSON.stringify(ids), scenarioSetHash(ids, RULESET_VERSION))
    .run();
  const row = await env.DB.prepare('SELECT * FROM cup_weeks WHERE id = ?').bind(w.id).first<CupWeekRow>();
  return toCupInfo(row!);
}

export async function getWeek(env: Env, weekId: string): Promise<CupInfo | null> {
  const row = await env.DB.prepare('SELECT * FROM cup_weeks WHERE id = ?').bind(weekId).first<CupWeekRow>();
  return row ? toCupInfo(row) : null;
}
