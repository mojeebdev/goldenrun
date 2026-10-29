/** Road to 1,000 + 2008 chapter progress, public challenges and player reports. */
import type { Challenge, Progress } from '../../shared/competition/api';
import { CHAPTER_2008, CHAPTER_TARGET, nextMilestone, roadTier, stageUnlocked } from '../../shared/competition/progression';
import { weekWindow } from '../../shared/competition/week';
import { auditStatement } from '../db/audit';
import { foundingStatus, playerAwards } from '../db/awards';
import { getWeek } from '../db/cup';
import type { Env } from '../env';
import { HttpError, json, readJson } from '../http';
import { limit } from '../security/ratelimit';
import { currentSession, requireSession } from '../security/session';
import type { RunRow } from './runs';
import { careerGoals, chapterGoalsByStage, runRank } from './runs';

export async function getProgress(request: Request, env: Env, now: number): Promise<Response> {
  const s = await currentSession(env, request, now);
  const founding = await foundingStatus(env);
  if (!s) {
    const body: Progress = {
      player: null,
      careerGoals: 0,
      tier: roadTier(0).name,
      nextMilestone: nextMilestone(0),
      awards: [],
      chapter: { stages: CHAPTER_2008.map((c) => ({ stage: c.stage, goals: 0, unlocked: c.stage === 1 })), total: 0, badge: false },
      founding,
    };
    return json(body);
  }
  const [goals, byStage, awards] = await Promise.all([careerGoals(env, s.playerId), chapterGoalsByStage(env, s.playerId), playerAwards(env, s.playerId)]);
  const total = Object.values(byStage).reduce((a, b) => a + b, 0);
  const body: Progress = {
    player: { handle: s.handle },
    careerGoals: goals,
    tier: roadTier(goals).name,
    nextMilestone: nextMilestone(goals),
    awards,
    chapter: {
      stages: CHAPTER_2008.map((c) => ({ stage: c.stage, goals: byStage[c.stage] ?? 0, unlocked: stageUnlocked(c.stage, byStage) })),
      total,
      badge: total >= CHAPTER_TARGET,
    },
    founding,
  };
  return json(body);
}

/** Public "beat my 12 shots" card for an accepted ranked cup run. */
export async function getChallenge(env: Env, now: number, runId: string): Promise<Response> {
  const run = await env.DB.prepare(
    `SELECT r.*, p.handle, p.country_code, p.visibility, p.account_state FROM runs r JOIN players p ON p.id = r.player_id
      WHERE r.id = ? AND r.mode = 'cup' AND r.ranked = 1 AND r.state = 'accepted'`,
  )
    .bind(runId)
    .first<RunRow & { handle: string; country_code: string | null; visibility: string; account_state: string }>();
  if (!run || !run.cup_week_id) throw new HttpError(404, 'not_found', 'That challenge doesn’t exist or isn’t verified.');
  const week = await getWeek(env, run.cup_week_id);
  if (!week) throw new HttpError(404, 'not_found', 'That challenge doesn’t exist.');
  const visible = run.visibility === 'public' && run.account_state === 'active';
  const body: Challenge = {
    runId: run.id,
    weekId: week.weekId,
    handle: visible ? run.handle : null,
    country: visible ? run.country_code : null,
    score: run.skill_score ?? 0,
    goals: run.goals ?? 0,
    rank: await runRank(env, run),
    scenarioIds: week.scenarioIds,
    weekIsCurrent: weekWindow(now).id === week.weekId,
  };
  return json(body, 200, { 'cache-control': 'public, max-age=60' });
}

export async function reportPlayer(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  await limit(env.WRITE_LIMITER, `report:${s.playerId}`);
  const body = await readJson(request);
  const reason = body.reason;
  if (reason !== 'nickname' && reason !== 'cheating' && reason !== 'other') throw new HttpError(400, 'bad_reason', 'Choose a reason.');
  const note = typeof body.note === 'string' ? body.note.slice(0, 500) : null;
  if (typeof body.handle !== 'string') throw new HttpError(400, 'bad_request', 'Who are you reporting?');
  const target = await env.DB.prepare("SELECT id FROM players WHERE handle_norm = ? AND account_state = 'active'")
    .bind(body.handle.toLowerCase())
    .first<{ id: string }>();
  if (!target) throw new HttpError(404, 'not_found', 'Player not found.');
  if (target.id === s.playerId) throw new HttpError(400, 'bad_request', 'You can’t report yourself.');
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO reports (reporter_id, target_id, reason, note, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(s.playerId, target.id, reason, note, now),
    auditStatement(env, now, 'report.created', s.playerId, { reason }),
  ]);
  // Same answer for first and repeated reports.
  return json({ ok: true }, 202);
}
