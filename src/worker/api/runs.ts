/**
 * Ranked Golden Cup runs. The client never reports goals or points: it submits
 * 12 bounded ShotCommands and this Worker re-simulates each one with the same
 * shared rules the browser uses. Exactly-once acceptance is enforced by D1
 * unique constraints inside a single atomic batch.
 */
import type { RunShotSummary, RunState, RunSummary, StartedRun } from '../../shared/competition/api';
import { CUP, runTotals } from '../../shared/competition/cup';
import { CHAPTER_QUOTA, MIN_MS_PER_SHOT, ROAD, chapterStage, roadScenarioIds, stageUnlocked } from '../../shared/competition/progression';
import type { RunMode } from '../../shared/competition/progression';
import type { ShotCommand, ShotResult } from '../../shared/rules';
import { RULESET_VERSION, simulateShot, validateShotCommand } from '../../shared/rules';
import { scenarioSetHash } from '../../shared/competition/cup';
import { auditStatement } from '../db/audit';
import { grantAwards } from '../db/awards';
import { ensureWeek, getWeek } from '../db/cup';
import type { Env } from '../env';
import { HttpError, json, readJson } from '../http';
import { randomToken, safeEqual, sha256Hex } from '../security/crypto';
import { limit } from '../security/ratelimit';
import { requireSession } from '../security/session';

export interface RunRow {
  id: string;
  player_id: string;
  mode: RunMode;
  ranked: number;
  cup_week_id: string | null;
  stage: number | null;
  scenario_ids: string | null;
  ruleset_version: string;
  nonce_hash: string;
  started_at: number;
  deadline_at: number;
  submitted_at: number | null;
  state: RunState;
  skill_score: number | null;
  goals: number | null;
  precision_total: number | null;
  misses: number | null;
  idempotency_key: string | null;
  input_hash: string | null;
  review_reason: string | null;
}

export function runSummary(r: RunRow, shots?: RunShotSummary[], rank?: number | null, creditedGoals?: number): RunSummary {
  return {
    runId: r.id,
    mode: r.mode,
    stage: r.stage,
    weekId: r.cup_week_id,
    ranked: r.ranked === 1,
    state: r.state,
    startedAt: r.started_at,
    deadlineAt: r.deadline_at,
    submittedAt: r.submitted_at,
    skillScore: r.skill_score,
    goals: r.goals,
    precisionTotal: r.precision_total,
    misses: r.misses,
    ...(shots ? { shots } : {}),
    ...(rank !== undefined ? { rank } : {}),
    ...(creditedGoals !== undefined ? { creditedGoals } : {}),
  };
}

/** Career-ledger rows this run earned (chapter quota can make it less than its goals). */
export async function creditedGoals(env: Env, runId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE run_id = ?').bind(runId).first<{ n: number }>();
  return row?.n ?? 0;
}

async function settledSummary(env: Env, run: RunRow): Promise<RunSummary> {
  return runSummary(run, await loadShots(env, run.id), await runRank(env, run), await creditedGoals(env, run.id));
}

/** Chapter goals credited per matchday for a player (each capped at the quota by construction). */
export async function chapterGoalsByStage(env: Env, playerId: string): Promise<Record<number, number>> {
  const rows = await env.DB.prepare(
    `SELECT r.stage AS stage, COUNT(*) AS n FROM goal_ledger g JOIN runs r ON r.id = g.run_id
      WHERE g.player_id = ? AND r.mode = 'chapter' GROUP BY r.stage`,
  )
    .bind(playerId)
    .all<{ stage: number; n: number }>();
  const out: Record<number, number> = {};
  for (const r of rows.results) out[r.stage] = r.n;
  return out;
}

export async function careerGoals(env: Env, playerId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE player_id = ?').bind(playerId).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function loadShots(env: Env, runId: string): Promise<RunShotSummary[]> {
  const rows = await env.DB.prepare(
    'SELECT idx, scenario_id, outcome, goal, skill_points FROM run_shots WHERE run_id = ? ORDER BY idx',
  )
    .bind(runId)
    .all<{ idx: number; scenario_id: string; outcome: string; goal: number; skill_points: number }>();
  return rows.results.map((s) => ({
    idx: s.idx,
    scenarioId: s.scenario_id,
    outcome: s.outcome,
    goal: s.goal === 1,
    skillPoints: s.skill_points,
  }));
}

/** Rank of an accepted ranked run within its week (ties share a rank). */
export async function runRank(env: Env, run: RunRow): Promise<number | null> {
  if (run.state !== 'accepted' || run.ranked !== 1) return null;
  const row = await env.DB.prepare(
    `SELECT 1 + COUNT(*) AS rank FROM runs
      WHERE cup_week_id = ?1 AND ranked = 1 AND state = 'accepted'
        AND (skill_score > ?2
          OR (skill_score = ?2 AND goals > ?3)
          OR (skill_score = ?2 AND goals = ?3 AND precision_total > ?4)
          OR (skill_score = ?2 AND goals = ?3 AND precision_total = ?4 AND misses < ?5))`,
  )
    .bind(run.cup_week_id, run.skill_score, run.goals, run.precision_total, run.misses)
    .first<{ rank: number }>();
  return row?.rank ?? null;
}

/** Lazily expire a run whose deadline has passed without a submission. */
export async function expireIfLate(env: Env, run: RunRow, now: number): Promise<RunRow> {
  if (run.state === 'started' && now > run.deadline_at) {
    await env.DB.prepare("UPDATE runs SET state = 'expired' WHERE id = ? AND state = 'started'").bind(run.id).run();
    return { ...run, state: 'expired' };
  }
  return run;
}

export async function startRun(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  await limit(env.WRITE_LIMITER, `write:${s.playerId}`);
  const body = await readJson(request);
  const mode = body.mode ?? (body.ranked === true ? 'cup' : null);
  if (mode === 'chapter' || mode === 'road') return startTrainingRun(env, s.playerId, now, mode, body.stage);
  if (mode !== 'cup' || body.ranked !== true) {
    throw new HttpError(400, 'bad_request', 'Choose a cup, chapter or road run. Practice runs stay on your device.');
  }
  const cup = await ensureWeek(env, now);
  if (cup.status !== 'open' || now >= cup.endsAt) throw new HttpError(409, 'cup_closed', 'This week’s cup is closed.');
  const nonce = randomToken(32);
  const runId = crypto.randomUUID();
  const deadline = now + (CUP.targetSeconds + CUP.graceSeconds) * 1000;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO runs (id, player_id, mode, ranked, cup_week_id, ruleset_version, nonce_hash, started_at, deadline_at)
         VALUES (?, ?, 'cup', 1, ?, ?, ?, ?, ?)`,
      ).bind(runId, s.playerId, cup.weekId, cup.rulesetVersion, await sha256Hex(nonce), now, deadline),
      auditStatement(env, now, 'run.started', s.playerId, { runId, weekId: cup.weekId }),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) {
      const existing = await env.DB.prepare('SELECT * FROM runs WHERE cup_week_id = ? AND player_id = ? AND ranked = 1')
        .bind(cup.weekId, s.playerId)
        .first<RunRow>();
      return json(
        { error: 'entry_used', message: 'You have already used this week’s ranked entry.', run: existing ? runSummary(await expireIfLate(env, existing, now)) : null },
        409,
      );
    }
    throw e;
  }
  const started: StartedRun = {
    runId,
    nonce,
    mode: 'cup',
    stage: null,
    weekId: cup.weekId,
    rulesetVersion: cup.rulesetVersion,
    scenarioIds: cup.scenarioIds,
    scenarioSetHash: cup.scenarioSetHash,
    startedAt: now,
    targetEndsAt: now + CUP.targetSeconds * 1000,
    deadlineAt: deadline,
    serverNow: now,
  };
  return json(started, 201);
}

/** Chapter and Road to 1,000 runs: unlimited, unranked, each goal verified like the cup. */
async function startTrainingRun(env: Env, playerId: string, now: number, mode: 'chapter' | 'road', rawStage: unknown): Promise<Response> {
  let scenarioIds: string[];
  let stage: number | null = null;
  if (mode === 'chapter') {
    const st = typeof rawStage === 'number' && Number.isInteger(rawStage) ? chapterStage(rawStage) : null;
    if (!st) throw new HttpError(400, 'bad_stage', 'Unknown matchday.');
    if (!stageUnlocked(st.stage, await chapterGoalsByStage(env, playerId))) {
      throw new HttpError(403, 'stage_locked', `Score ${CHAPTER_QUOTA} chapter goals on matchday ${st.stage - 1} first.`);
    }
    stage = st.stage;
    scenarioIds = st.scenarioIds;
  } else {
    // Server-chosen random course: nobody can prepare inputs in advance.
    scenarioIds = roadScenarioIds(await careerGoals(env, playerId), randomToken(16));
  }
  const nonce = randomToken(32);
  const runId = crypto.randomUUID();
  const deadline = now + (ROAD.targetSeconds + ROAD.graceSeconds) * 1000;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO runs (id, player_id, mode, ranked, stage, scenario_ids, ruleset_version, nonce_hash, started_at, deadline_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    ).bind(runId, playerId, mode, stage, JSON.stringify(scenarioIds), RULESET_VERSION, await sha256Hex(nonce), now, deadline),
    auditStatement(env, now, 'run.started', playerId, { runId, mode, stage }),
  ]);
  const started: StartedRun = {
    runId,
    nonce,
    mode,
    stage,
    weekId: null,
    rulesetVersion: RULESET_VERSION,
    scenarioIds,
    scenarioSetHash: scenarioSetHash(scenarioIds, RULESET_VERSION),
    startedAt: now,
    targetEndsAt: now + ROAD.targetSeconds * 1000,
    deadlineAt: deadline,
    serverNow: now,
  };
  return json(started, 201);
}

const CLAIMED = 'EXISTS (SELECT 1 FROM runs WHERE id = ? AND submitted_at = ? AND idempotency_key = ?)';

/** Heuristics that hold a run for human review instead of ranking it. Never auto-reject on these. */
export function reviewReasons(totals: ReturnType<typeof runTotals>, elapsedMs: number, mode: RunMode = 'cup', shots: number = CUP.shots): string[] {
  const reasons: string[] = [];
  const minMs = mode === 'cup' ? CUP.minPlausibleMs : shots * MIN_MS_PER_SHOT;
  if (elapsedMs < minMs) reasons.push('too_fast');
  if (totals.goals === shots && totals.topCorners >= shots - 2) reasons.push('near_perfect_run');
  return reasons;
}

export async function submitRun(request: Request, env: Env, now: number, runId: string): Promise<Response> {
  const s = await requireSession(env, request, now);
  await limit(env.WRITE_LIMITER, `write:${s.playerId}`);
  const body = await readJson(request);
  let run = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(runId).first<RunRow>();
  // Same response for missing and foreign runs: run IDs reveal nothing.
  if (!run || run.player_id !== s.playerId) throw new HttpError(404, 'not_found', 'Run not found.');

  const idem = body.idempotencyKey;
  if (typeof idem !== 'string' || idem.length < 8 || idem.length > 64) {
    throw new HttpError(400, 'bad_request', 'An idempotency key is required.');
  }
  // Retried submission of an already-settled run: return the stored result.
  if (run.state !== 'started' && run.state !== 'expired') {
    if (run.idempotency_key === idem) {
      return json(await settledSummary(env, run));
    }
    throw new HttpError(409, 'already_submitted', 'This run has already been submitted.');
  }
  if (typeof body.nonce !== 'string' || !safeEqual(await sha256Hex(body.nonce), run.nonce_hash)) {
    throw new HttpError(403, 'bad_nonce', 'This run’s credentials don’t match.');
  }
  run = await expireIfLate(env, run, now);
  if (run.state === 'expired') {
    throw new HttpError(410, 'run_expired', 'The submission window for this run closed. Practice is still open.');
  }
  let course: string[];
  if (run.mode === 'cup') {
    const week = run.cup_week_id ? await getWeek(env, run.cup_week_id) : null;
    if (!week || week.rulesetVersion !== run.ruleset_version) throw new HttpError(409, 'ruleset_mismatch', 'The rules changed.');
    course = week.scenarioIds;
  } else {
    if (run.ruleset_version !== RULESET_VERSION) throw new HttpError(409, 'ruleset_mismatch', 'The rules changed.');
    course = JSON.parse(run.scenario_ids ?? '[]') as string[];
  }

  // ---- validate commands: exact count, order, ruleset and scenario sequence ----
  const raw = body.commands;
  if (!Array.isArray(raw) || raw.length !== course.length) {
    throw new HttpError(400, 'bad_commands', `Submit exactly ${course.length} shots.`);
  }
  const commands: ShotCommand[] = raw.map((c: unknown, i: number) => {
    const v = validateShotCommand(c);
    if (!v.ok) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: ${v.error}.`);
    if (v.command.rulesetVersion !== run!.ruleset_version) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: wrong ruleset.`);
    if (v.command.scenarioId !== course[i]) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: wrong scenario order.`);
    return v.command;
  });

  // ---- authoritative re-simulation ----
  const results: ShotResult[] = commands.map((c) => simulateShot(c));
  const totals = runTotals(results);
  const reasons = reviewReasons(totals, now - run.started_at, run.mode, course.length);
  const state: RunState = reasons.length ? 'pending_review' : 'accepted';
  const inputHash = await sha256Hex(JSON.stringify(commands));

  const stmts: D1PreparedStatement[] = [
    // Claim the run. If a concurrent request already did, changes = 0 and the
    // unique constraints below abort the whole batch — nothing is double-counted.
    env.DB.prepare(
      `UPDATE runs SET state = ?, submitted_at = ?, skill_score = ?, goals = ?, precision_total = ?, misses = ?,
              idempotency_key = ?, input_hash = ?, review_reason = ?
        WHERE id = ? AND state = 'started'`,
    ).bind(state, now, totals.skillScore, totals.goals, totals.precisionTotal, totals.misses, idem, inputHash, reasons.join(',') || null, run.id),
    // Every insert is guarded on this request's claim having landed, so a run
    // that changed state meanwhile (e.g. expired by cron) gets no orphan rows.
    ...results.map((r, i) =>
      env.DB.prepare(
        `INSERT INTO run_shots (run_id, idx, scenario_id, command, outcome, goal, skill_points, precision, modifiers)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${CLAIMED}`,
      ).bind(run!.id, i, r.scenarioId, JSON.stringify(commands[i]), r.outcome, r.goal ? 1 : 0, r.skillPoints, r.precision, JSON.stringify(r.modifiers), run!.id, now, idem),
    ),
  ];
  // Career goals: one ledger row per accepted goal, unique per (run, shot).
  // Chapter goals only count while they fill that matchday's quota; the cap is
  // evaluated statement by statement inside the transaction, so concurrent
  // chapter runs can never push a matchday past it.
  if (state === 'accepted') {
    const quota =
      run.mode === 'chapter'
        ? ` AND (SELECT COUNT(*) FROM goal_ledger g JOIN runs rr ON rr.id = g.run_id
                  WHERE g.player_id = ? AND rr.mode = 'chapter' AND rr.stage = ?) < ${CHAPTER_QUOTA}`
        : '';
    results.forEach((r, i) => {
      if (!r.goal) return;
      const binds: unknown[] = [s.playerId, run!.id, i, now, run!.id, now, idem];
      if (quota) binds.push(s.playerId, run!.stage);
      stmts.push(
        env.DB.prepare(
          `INSERT INTO goal_ledger (player_id, run_id, shot_index, created_at) SELECT ?, ?, ?, ? WHERE ${CLAIMED}${quota}`,
        ).bind(...binds),
      );
    });
  }
  try {
    const out = await env.DB.batch(stmts);
    // Claim didn't land (guards skipped every insert): treat like a lost race.
    if (out[0]!.meta.changes !== 1) throw new Error('UNIQUE: run already claimed');
  } catch (e) {
    if (!String(e).includes('UNIQUE')) throw e;
    // Lost a race with a concurrent submission: report the settled state instead.
    const settled = (await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(run.id).first<RunRow>())!;
    if (settled.idempotency_key === idem) return json(await settledSummary(env, settled));
    throw new HttpError(409, 'already_submitted', 'This run has already been submitted.');
  }
  await auditStatement(env, now, state === 'accepted' ? 'run.accepted' : 'run.held_for_review', s.playerId, { runId: run.id, reasons }).run();
  if (state === 'accepted') await grantAwards(env, now, s.playerId);
  const settled = (await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(run.id).first<RunRow>())!;
  return json(await settledSummary(env, settled), 201);
}

export async function getRun(request: Request, env: Env, now: number, runId: string): Promise<Response> {
  const s = await requireSession(env, request, now);
  let run = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(runId).first<RunRow>();
  if (!run || run.player_id !== s.playerId) throw new HttpError(404, 'not_found', 'Run not found.');
  run = await expireIfLate(env, run, now);
  return json(await settledSummary(env, run));
}
