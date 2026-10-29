import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Leaderboard, RunSummary, StartedRun } from '../../src/shared/competition/api';
import { runTotals } from '../../src/shared/competition/cup';
import { makeCommand, simulateShot } from '../../src/shared/rules';
import type { ShotCommand } from '../../src/shared/rules';
import { settle } from '../../src/worker/cron';
import type { Env } from '../../src/worker/env';
import type { Client } from './harness';
import { registerPlayer, startHarness } from './harness';

let env: Env;
let dispose: () => Promise<void>;
const clock = Date.UTC(2026, 10, 4, 18, 0, 0); // Wed 4 Nov 2026, week 2026-W45
const now = () => clock;
const SECOND = 1000;

beforeAll(async () => {
  ({ env, dispose } = await startHarness());
});
afterAll(async () => dispose());

/** A deterministic "player style": aim/power vary with a seed so players differ. */
function commandsFor(run: StartedRun, seed: number): ShotCommand[] {
  return run.scenarioIds.map((id, i) =>
    makeCommand(id, {
      aimX: ((i * 7 + seed) % 2 ? 1 : -1) * (430 + ((seed * 37 + i * 11) % 60)),
      aimY: 560 + ((seed * 13 + i * 29) % 160),
      power: 780 + ((seed * 17 + i) % 220),
      spin: ((seed + i) % 3) * 200 - 200,
    }),
  );
}

async function start(c: Client): Promise<StartedRun> {
  const r = await c.call<StartedRun>('POST', '/api/v1/runs/start', { ranked: true });
  expect(r.status).toBe(201);
  return r.body;
}

async function submit(c: Client, run: StartedRun, commands: unknown[], extra: Record<string, unknown> = {}, at = clock + 45 * SECOND) {
  return c.call<RunSummary & { error?: string }>('POST', `/api/v1/runs/${run.runId}/submit`, {
    nonce: run.nonce,
    idempotencyKey: `idem-${run.runId}`,
    commands,
    ...extra,
  }, { now: at });
}

describe('Golden Cup ranked runs (local Worker + local D1)', () => {
  it('serves the same 12-shot course to everyone, issued server-side', async () => {
    const a = await registerPlayer(env, now, 'Alpha', 'PT');
    const b = await registerPlayer(env, now, 'Bravo', 'BR');
    const ra = await start(a.client);
    const rb = await start(b.client);
    expect(ra.weekId).toBe('2026-W45');
    expect(ra.scenarioIds).toHaveLength(12);
    expect(rb.scenarioIds).toEqual(ra.scenarioIds);
    expect(rb.scenarioSetHash).toBe(ra.scenarioSetHash);
    expect(ra.deadlineAt - ra.startedAt).toBe(120 * SECOND);

    // Identical commands from two players re-simulate to identical results.
    const cmds = commandsFor(ra, 3);
    const sa = await submit(a.client, ra, cmds);
    const sb = await submit(b.client, rb, cmds);
    expect(sa.status).toBe(201);
    expect(sb.body.skillScore).toBe(sa.body.skillScore);
    expect(sb.body.shots).toEqual(sa.body.shots);
  });

  it('ignores forged scores: points come only from re-simulation', async () => {
    const p = await registerPlayer(env, now, 'Forger');
    const run = await start(p.client);
    const cmds = commandsFor(run, 5);
    const expected = runTotals(cmds.map((c) => simulateShot(c)));
    const res = await submit(p.client, run, cmds.map((c) => ({ ...c, goal: true, points: 700 })), { score: 999999, goals: 12 });
    // Unknown fields are not part of a ShotCommand; validation keeps only the bounded fields.
    expect(res.status).toBe(201);
    expect(res.body.skillScore).toBe(expected.skillScore);
    expect(res.body.goals).toBe(expected.goals);
    const ledger = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE run_id = ?').bind(run.runId).first<{ n: number }>();
    expect(ledger!.n).toBe(expected.goals);
  });

  it('allows one ranked entry per account per week', async () => {
    const p = await registerPlayer(env, now, 'OneShot');
    await start(p.client);
    const again = await p.client.call<{ error: string; run: RunSummary }>('POST', '/api/v1/runs/start', { ranked: true });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('entry_used');
  });

  it('rejects malformed, reordered, out-of-range and short submissions without consuming the run', async () => {
    const p = await registerPlayer(env, now, 'Sloppy');
    const run = await start(p.client);
    const good = commandsFor(run, 9);
    const swapped = [good[1], good[0], ...good.slice(2)];
    expect((await submit(p.client, run, swapped)).status).toBe(400);
    expect((await submit(p.client, run, good.slice(0, 11))).status).toBe(400);
    expect((await submit(p.client, run, [{ ...good[0], power: 5000 }, ...good.slice(1)])).status).toBe(400);
    expect((await submit(p.client, run, [{ ...good[0], aimX: 1.5 }, ...good.slice(1)])).status).toBe(400);
    expect((await submit(p.client, run, [{ ...good[0], rulesetVersion: 'gr-9' }, ...good.slice(1)])).status).toBe(400);
    expect((await submit(p.client, run, good, { nonce: 'not-the-nonce' })).status).toBe(403);
    expect((await submit(p.client, run, good)).status).toBe(201);
  });

  it('is idempotent: retries return the stored result, other keys conflict, races count once', async () => {
    const p = await registerPlayer(env, now, 'Racer');
    const run = await start(p.client);
    const cmds = commandsFor(run, 11);
    const expected = runTotals(cmds.map((c) => simulateShot(c)));
    // Five concurrent submissions with the same key.
    const results = await Promise.all(Array.from({ length: 5 }, () => submit(p.client, run, cmds)));
    for (const r of results) {
      expect([200, 201]).toContain(r.status);
      expect(r.body.skillScore).toBe(expected.skillScore);
    }
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const ledger = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE run_id = ?').bind(run.runId).first<{ n: number }>();
    expect(ledger!.n).toBe(expected.goals);
    const shots = await env.DB.prepare('SELECT COUNT(*) AS n FROM run_shots WHERE run_id = ?').bind(run.runId).first<{ n: number }>();
    expect(shots!.n).toBe(12);
    // A different idempotency key (replayed run) is refused.
    const replay = await submit(p.client, run, cmds, { idempotencyKey: 'another-key-123' });
    expect(replay.status).toBe(409);
  });

  it('expires late runs and never accepts them', async () => {
    const p = await registerPlayer(env, now, 'Tardy');
    const run = await start(p.client);
    const res = await submit(p.client, run, commandsFor(run, 2), {}, run.deadlineAt + 1);
    expect(res.status).toBe(410);
    const st = await p.client.call<RunSummary>('GET', `/api/v1/runs/${run.runId}`);
    expect(st.body.state).toBe('expired');
    expect((await submit(p.client, run, commandsFor(run, 2), {}, run.deadlineAt + 2)).status).toBe(410);
  });

  it('holds implausibly fast runs for review: not ranked, no career goals', async () => {
    const p = await registerPlayer(env, now, 'Speedy');
    const run = await start(p.client);
    const res = await submit(p.client, run, commandsFor(run, 4), {}, clock + 5 * SECOND);
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('pending_review');
    expect(res.body.rank ?? null).toBeNull();
    const ledger = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE run_id = ?').bind(run.runId).first<{ n: number }>();
    expect(ledger!.n).toBe(0);
  });

  it('keeps runs private to their owner', async () => {
    const owner = await registerPlayer(env, now, 'Owner');
    const thief = await registerPlayer(env, now, 'Thief');
    const run = await start(owner.client);
    expect((await thief.client.call('GET', `/api/v1/runs/${run.runId}`)).status).toBe(404);
    expect((await submit(thief.client, run, commandsFor(run, 1))).status).toBe(404);
  });

  it('builds honest leaderboards with the published tie order', async () => {
    const weekly = await (await registerPlayer(env, now, 'Viewer')).client.call<Leaderboard>('GET', '/api/v1/leaderboard?kind=weekly');
    expect(weekly.status).toBe(200);
    const rows = weekly.body.rows;
    expect(rows.length).toBeGreaterThan(0);
    // Only accepted runs, sorted; equal results share a rank.
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]!;
      const b = rows[i]!;
      expect(a.score).toBeGreaterThanOrEqual(b.score);
      if (a.score === b.score && a.goals === b.goals && a.precisionTotal === b.precisionTotal && a.misses === b.misses) {
        expect(b.rank).toBe(a.rank);
      } else {
        expect(b.rank).toBeGreaterThan(a.rank);
      }
    }
    expect(rows.find((r) => r.handle === 'Speedy')).toBeUndefined(); // pending review
    expect(rows.find((r) => r.handle === 'Tardy')).toBeUndefined(); // expired
    const alpha = rows.find((r) => r.handle === 'Alpha')!;
    const bravo = rows.find((r) => r.handle === 'Bravo')!;
    expect(alpha.rank).toBe(bravo.rank); // identical runs tie

    const pt = await client0().call<Leaderboard>('GET', '/api/v1/leaderboard?kind=country&country=PT');
    expect(pt.body.rows.map((r) => r.country)).toEqual(pt.body.rows.map(() => 'PT'));
    expect(pt.body.rows.map((r) => r.rank)[0]).toBe(1);

    const career = await client0().call<Leaderboard>('GET', '/api/v1/leaderboard?kind=career');
    expect(career.body.rows.length).toBeGreaterThan(0);
    expect((await client0().call('GET', '/api/v1/leaderboard?kind=nope')).status).toBe(400);
    expect((await client0().call('GET', '/api/v1/leaderboard?kind=weekly&week=bad')).status).toBe(400);
  });

  it('anonymises private players without changing ranks', async () => {
    const p = await registerPlayer(env, now, 'Shy', 'PT');
    const run = await start(p.client);
    await submit(p.client, run, commandsFor(run, 3)); // same as Alpha/Bravo
    await p.client.call('PATCH', '/api/v1/me', { visibility: 'private' });
    const board = await client0().call<Leaderboard>('GET', '/api/v1/leaderboard?kind=weekly&limit=100');
    expect(board.body.rows.some((r) => r.handle === 'Shy')).toBe(false);
    const alpha = board.body.rows.find((r) => r.handle === 'Alpha')!;
    expect(board.body.rows.some((r) => r.handle === null && r.rank === alpha.rank)).toBe(true);
  });

  it('cron settlement is idempotent and records provisional winners once', async () => {
    const afterWeek = Date.UTC(2026, 10, 9, 0, 30, 0); // Monday after W45
    const first = await settle(env, afterWeek);
    expect(first.closed).toBe(1);
    const second = await settle(env, afterWeek + 3600 * 1000);
    expect(second.awarded).toBe(0);
    const awards = await env.DB.prepare("SELECT COUNT(*) AS n FROM awards WHERE award_key LIKE 'cup-week-winner:2026-W45:%'").first<{ n: number }>();
    expect(awards!.n).toBe(first.awarded);
    expect(first.awarded).toBeGreaterThanOrEqual(1);
    const hall = await client0().call<{ entries: { weekId: string; reviewState: string }[] }>('GET', '/api/v1/leaderboard?kind=hall');
    expect(hall.body.entries.every((e) => e.weekId === '2026-W45' && e.reviewState === 'provisional')).toBe(true);
    // A new week opened; old-week runs can no longer start.
    const week = await env.DB.prepare("SELECT status FROM cup_weeks WHERE id = '2026-W45'").first<{ status: string }>();
    expect(['closed', 'finalized']).toContain(week!.status);
    expect(await env.DB.prepare("SELECT 1 FROM cup_weeks WHERE id = '2026-W46'").first()).not.toBeNull();
  });

  it('career goals equal accepted goals, one per goal', async () => {
    const c = (await registerPlayer(env, now, 'Counter')).client;
    const me = await c.call<{ careerGoals: number }>('GET', '/api/v1/me');
    expect(me.body.careerGoals).toBe(0);
    const total = await env.DB.prepare("SELECT COALESCE(SUM(goals),0) AS n FROM runs WHERE state = 'accepted'").first<{ n: number }>();
    const ledger = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger').first<{ n: number }>();
    expect(ledger!.n).toBe(total!.n);
  });
});

function client0() {
  // Anonymous reader for public endpoints.
  return {
    call: async <T>(method: string, path: string) => {
      const { handleApi } = await import('../../src/worker/index');
      const res = await handleApi(new Request(`http://localhost:5173${path}`, { method }), env, clock);
      return { status: res.status, body: (await res.json()) as T };
    },
  };
}
