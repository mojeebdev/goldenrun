/**
 * Ranked Golden Cup runs. The client never reports goals or points: it submits
 * 12 bounded ShotCommands and this Worker re-simulates each one with the same
 * shared rules the browser uses. Exactly-once acceptance is enforced by D1
 * unique constraints inside a single atomic batch.
 */
import type { RunShotSummary, RunState, RunSummary, StartedRun } from '../../shared/competition/api';
import { CUP, runTotals } from '../../shared/competition/cup';
import type { ShotCommand, ShotResult } from '../../shared/rules';
import { simulateShot, validateShotCommand } from '../../shared/rules';
import { auditStatement } from '../db/audit';
import { ensureWeek, getWeek } from '../db/cup';
import type { Env } from '../env';
import { HttpError, json, readJson } from '../http';
import { randomToken, safeEqual, sha256Hex } from '../security/crypto';
import { limit } from '../security/ratelimit';
import { requireSession } from '../security/session';

export interface RunRow {
  id: string;
  player_id: string;
  mode: 'cup';
  ranked: number;
  cup_week_id: string;
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

export function runSummary(r: RunRow, shots?: RunShotSummary[], rank?: number | null): RunSummary {
  return {
    runId: r.id,
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
  };
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
async function expireIfLate(env: Env, run: RunRow, now: number): Promise<RunRow> {
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
  if (body.ranked !== true) throw new HttpError(400, 'bad_request', 'Only ranked runs are issued by the server; practice runs stay on your device.');
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

const CLAIMED = 'EXISTS (SELECT 1 FROM runs WHERE id = ? AND submitted_at = ? AND idempotency_key = ?)';

/** Heuristics that hold a run for human review instead of ranking it. Never auto-reject on these. */
export function reviewReasons(totals: ReturnType<typeof runTotals>, elapsedMs: number): string[] {
  const reasons: string[] = [];
  if (elapsedMs < CUP.minPlausibleMs) reasons.push('too_fast');
  if (totals.goals === CUP.shots && totals.topCorners >= 10) reasons.push('near_perfect_run');
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
      return json(runSummary(run, await loadShots(env, run.id), await runRank(env, run)));
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
  const week = await getWeek(env, run.cup_week_id);
  if (!week || week.rulesetVersion !== run.ruleset_version) throw new HttpError(409, 'ruleset_mismatch', 'The rules changed.');

  // ---- validate commands: exact count, order, ruleset and scenario sequence ----
  const raw = body.commands;
  if (!Array.isArray(raw) || raw.length !== CUP.shots) {
    throw new HttpError(400, 'bad_commands', `Submit exactly ${CUP.shots} shots.`);
  }
  const commands: ShotCommand[] = raw.map((c: unknown, i: number) => {
    const v = validateShotCommand(c);
    if (!v.ok) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: ${v.error}.`);
    if (v.command.rulesetVersion !== run!.ruleset_version) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: wrong ruleset.`);
    if (v.command.scenarioId !== week.scenarioIds[i]) throw new HttpError(400, 'bad_commands', `Shot ${i + 1}: wrong scenario order.`);
    return v.command;
  });

  // ---- authoritative re-simulation ----
  const results: ShotResult[] = commands.map((c) => simulateShot(c));
  const totals = runTotals(results);
  const reasons = reviewReasons(totals, now - run.started_at);
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
  if (state === 'accepted') {
    results.forEach((r, i) => {
      if (r.goal) {
        stmts.push(
          env.DB.prepare(
            `INSERT INTO goal_ledger (player_id, run_id, shot_index, created_at) SELECT ?, ?, ?, ? WHERE ${CLAIMED}`,
          ).bind(s.playerId, run!.id, i, now, run!.id, now, idem),
        );
      }
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
    if (settled.idempotency_key === idem) return json(runSummary(settled, await loadShots(env, run.id), await runRank(env, settled)));
    throw new HttpError(409, 'already_submitted', 'This run has already been submitted.');
  }
  await auditStatement(env, now, state === 'accepted' ? 'run.accepted' : 'run.held_for_review', s.playerId, { runId: run.id, reasons }).run();
  const settled = (await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(run.id).first<RunRow>())!;
  return json(runSummary(settled, await loadShots(env, run.id), await runRank(env, settled)), 201);
}

export async function getRun(request: Request, env: Env, now: number, runId: string): Promise<Response> {
  const s = await requireSession(env, request, now);
  let run = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(runId).first<RunRow>();
  if (!run || run.player_id !== s.playerId) throw new HttpError(404, 'not_found', 'Run not found.');
  run = await expireIfLate(env, run, now);
  return json(runSummary(run, await loadShots(env, run.id), await runRank(env, run)));
}
