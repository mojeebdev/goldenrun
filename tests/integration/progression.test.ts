import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Challenge, Progress, RunSummary, StartedRun } from '../../src/shared/competition/api';
import { CHAPTER_2008, CHAPTER_QUOTA } from '../../src/shared/competition/progression';
import { makeCommand, simulateShot } from '../../src/shared/rules';
import type { ShotCommand } from '../../src/shared/rules';
import { settle } from '../../src/worker/cron';
import type { Env } from '../../src/worker/env';
import { handleApi } from '../../src/worker/index';
import type { Client } from './harness';
import { registerPlayer, startHarness } from './harness';

let env: Env;
let dispose: () => Promise<void>;
let clock = Date.UTC(2026, 10, 10, 9, 0, 0);
const now = () => clock;

beforeAll(async () => {
  ({ env, dispose } = await startHarness());
});
afterAll(async () => dispose());

// ---- shot helpers: find a guaranteed goal / miss for any scenario (deterministic sim) ----
const goalCache = new Map<string, ShotCommand>();
function goalShot(id: string): ShotCommand {
  const hit = goalCache.get(id);
  if (hit) return hit;
  // Prefer ordinary goals (not top corners): a run of only top corners is
  // deliberately held for human review by the anti-automation heuristic.
  let fallback: ShotCommand | null = null;
  for (const spin of [0, 700, -700])
    for (let aimX = -1000; aimX <= 1000; aimX += 25)
      for (const aimY of [150, 300, 420, 560, 620])
        for (const power of [1000, 900]) {
          const c = makeCommand(id, { aimX, aimY, power, spin });
          const r = simulateShot(c);
          if (!r.goal) continue;
          if (!r.modifiers.some((m) => m.id === 'top-corner')) {
            goalCache.set(id, c);
            return c;
          }
          fallback ??= c;
        }
  if (fallback) {
    goalCache.set(id, fallback);
    return fallback;
  }
  throw new Error(`no goal found for ${id}`);
}
const missShot = (id: string) => makeCommand(id, { aimX: 1000, aimY: 1000, power: 1000, spin: 0 });

async function start(c: Client, body: Record<string, unknown>) {
  return c.call<StartedRun & { error?: string }>('POST', '/api/v1/runs/start', body);
}
async function submit(c: Client, run: StartedRun, commands: ShotCommand[], dt = 40_000) {
  return c.call<RunSummary>('POST', `/api/v1/runs/${run.runId}/submit`, { nonce: run.nonce, idempotencyKey: `k-${run.runId}`, commands }, { now: run.startedAt + dt });
}
/** Play a run scoring exactly `goals` goals (first N shots). */
async function play(c: Client, body: Record<string, unknown>, goals: number) {
  const r = await start(c, body);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const cmds = r.body.scenarioIds.map((id, i) => (i < goals ? goalShot(id) : missShot(id)));
  const s = await submit(c, r.body, cmds);
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return s.body;
}
async function progress(c: Client) {
  return (await c.call<Progress>('GET', '/api/v1/progress')).body;
}

describe('2008: The Beginning', () => {
  it('locks matchdays until the previous quota is full', async () => {
    const { client } = await registerPlayer(env, now, 'Debutant');
    expect((await start(client, { mode: 'chapter', stage: 2 })).status).toBe(403);
    expect((await start(client, { mode: 'chapter', stage: 9 })).status).toBe(400);
    const r = await start(client, { mode: 'chapter', stage: 1 });
    expect(r.body.scenarioIds).toEqual(CHAPTER_2008[0]!.scenarioIds);
    expect(r.body.mode).toBe('chapter');
  });

  it('caps each matchday at its quota, so the easy one cannot be farmed', async () => {
    const { client } = await registerPlayer(env, now, 'Farmer');
    const a = await play(client, { mode: 'chapter', stage: 1 }, 5);
    expect(a.goals).toBe(5);
    expect(a.creditedGoals).toBe(5);
    const b = await play(client, { mode: 'chapter', stage: 1 }, 6);
    expect(b.creditedGoals).toBe(2); // only up to the 7-goal quota
    const c = await play(client, { mode: 'chapter', stage: 1 }, 10);
    expect(c.goals).toBe(10);
    expect(c.creditedGoals).toBe(0);
    const p = await progress(client);
    expect(p.chapter.stages[0]!.goals).toBe(CHAPTER_QUOTA);
    expect(p.chapter.total).toBe(CHAPTER_QUOTA);
    expect(p.chapter.stages[1]!.unlocked).toBe(true);
    expect(p.careerGoals).toBe(CHAPTER_QUOTA); // farmed goals don't reach the career ledger either
  });

  it('enforces the quota even for concurrent runs of the same matchday', async () => {
    const { client } = await registerPlayer(env, now, 'Parallel');
    const runs = await Promise.all([start(client, { mode: 'chapter', stage: 1 }), start(client, { mode: 'chapter', stage: 1 })]);
    const results = await Promise.all(runs.map((r) => submit(client, r.body, r.body.scenarioIds.map((id) => goalShot(id)))));
    const credited = results.reduce((a, r) => a + (r.body.creditedGoals ?? 0), 0);
    expect(credited).toBe(CHAPTER_QUOTA);
  });

  it('awards the 2008 badge exactly once at 42 chapter goals', async () => {
    const { client } = await registerPlayer(env, now, 'Badger');
    for (const st of CHAPTER_2008) {
      const p = await progress(client);
      expect(p.chapter.stages.find((s) => s.stage === st.stage)!.unlocked).toBe(true);
      const before = p.chapter.total;
      expect(p.chapter.badge).toBe(false);
      await play(client, { mode: 'chapter', stage: st.stage }, 10);
      expect((await progress(client)).chapter.total).toBe(before + CHAPTER_QUOTA);
    }
    const done = await progress(client);
    expect(done.chapter.total).toBe(42);
    expect(done.chapter.badge).toBe(true);
    expect(done.awards.filter((a) => a.type === 'badge-2008')).toHaveLength(1);
    // Extra replays and repeated settlement never add a second badge or chapter goals.
    await play(client, { mode: 'chapter', stage: 6 }, 10);
    await settle(env, clock);
    await settle(env, clock + 1000);
    const after = await progress(client);
    expect(after.chapter.total).toBe(42);
    expect(after.awards.filter((a) => a.type === 'badge-2008')).toHaveLength(1);
    expect(after.awards.filter((a) => a.type === 'milestone' && a.label.startsWith('42 '))).toHaveLength(1);
  });
});

describe('Road to 1,000', () => {
  it('issues random server-side courses and counts each verified goal once', async () => {
    const { client } = await registerPlayer(env, now, 'Roadie');
    const a = await start(client, { mode: 'road' });
    const b = await start(client, { mode: 'road' });
    expect(a.body.scenarioIds).toHaveLength(10);
    expect(a.body.scenarioIds.every((id) => id.endsWith('.rookie'))).toBe(true); // Academy tier
    expect(a.body.scenarioIds.join() === b.body.scenarioIds.join() && a.body.runId === b.body.runId).toBe(false);
    const res = await submit(client, a.body, a.body.scenarioIds.map((id, i) => (i < 4 ? goalShot(id) : missShot(id))));
    expect(res.body.creditedGoals).toBe(4);
    // Resubmitting the same inputs (same or new key) can't add goals.
    expect((await client.call('POST', `/api/v1/runs/${a.body.runId}/submit`, { nonce: a.body.nonce, idempotencyKey: 'other-key-1', commands: [] })).status).toBe(409);
    // Old inputs don't fit a new course.
    const replay = await submit(client, b.body, a.body.scenarioIds.map((id) => goalShot(id)));
    if (a.body.scenarioIds.join() !== b.body.scenarioIds.join()) expect(replay.status).toBe(400);
    expect((await progress(client)).careerGoals).toBeLessThanOrEqual(14);
  });

  it('holds a run of only top corners for human review', async () => {
    const { client } = await registerPlayer(env, now, 'Sniper');
    const r = await start(client, { mode: 'road' });
    const corners = r.body.scenarioIds.map((id) => {
      for (let aimX = -1000; aimX <= 1000; aimX += 25)
        for (const aimY of [560, 620, 680])
          for (const power of [1000, 900]) {
            const c = makeCommand(id, { aimX, aimY, power, spin: 0 });
            const res = simulateShot(c);
            if (res.goal && res.modifiers.some((m) => m.id === 'top-corner')) return c;
          }
      throw new Error('no corner');
    });
    const s = await submit(client, r.body, corners);
    expect(s.body.state).toBe('pending_review');
    expect(s.body.creditedGoals).toBe(0);
  });

  it('holds implausibly fast runs: no goals, no awards', async () => {
    const { client } = await registerPlayer(env, now, 'Bot_like');
    const r = await start(client, { mode: 'road' });
    const s = await submit(client, r.body, r.body.scenarioIds.map((id) => goalShot(id)), 4000);
    expect(s.body.state).toBe('pending_review');
    expect(s.body.creditedGoals).toBe(0);
    expect((await progress(client)).careerGoals).toBe(0);
  });

  it('gets harder as the career total grows', async () => {
    const { client } = await registerPlayer(env, now, 'Climber');
    for (let i = 0; i < 5; i++) await play(client, { mode: 'road' }, 10);
    const p = await progress(client);
    expect(p.careerGoals).toBe(50);
    expect(p.tier).toBe('First team');
    expect(p.nextMilestone).toBe(100);
    const r = await start(client, { mode: 'road' });
    expect(r.body.scenarioIds.some((id) => !id.endsWith('.rookie')) || r.body.scenarioIds.every((id) => /rookie|professional/.test(id))).toBe(true);
  });
});

describe('Founding Golden Fan', () => {
  /** Seed N accepted ledger rows directly (fast-forward a long career). */
  async function seedGoals(playerId: string, n: number, runId: string) {
    await env.DB.prepare(
      `INSERT INTO runs (id, player_id, mode, ranked, scenario_ids, ruleset_version, nonce_hash, started_at, deadline_at, submitted_at, state, goals)
       VALUES (?, ?, 'road', 0, '[]', 'gr-1.0.0', 'x', 0, 1, 1, 'accepted', ?)`,
    ).bind(runId, playerId, n).run();
    await env.DB.prepare(
      `WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM seq WHERE i < ? - 1)
       INSERT INTO goal_ledger (player_id, run_id, shot_index, created_at) SELECT ?, ?, i, 0 FROM seq`,
    ).bind(n, playerId, runId).run();
  }
  const idOf = async (handle: string) =>
    (await env.DB.prepare('SELECT id FROM players WHERE handle_norm = ?').bind(handle.toLowerCase()).first<{ id: string }>())!.id;

  it('goes to the first player whose 1,000th goal the server accepted, provisionally, exactly once', async () => {
    const a = await registerPlayer(env, now, 'Veteran_A');
    const b = await registerPlayer(env, now, 'Veteran_B');
    await seedGoals(await idOf('Veteran_A'), 995, '00000000-0000-4000-8000-00000000000a');
    await seedGoals(await idOf('Veteran_B'), 995, '00000000-0000-4000-8000-00000000000b');
    expect((await progress(a.client)).founding.state).toBe('open');
    // B crosses 1,000 first (server acceptance order), then A.
    await play(b.client, { mode: 'road' }, 10);
    await play(a.client, { mode: 'road' }, 10);
    const pa = await progress(a.client);
    expect(pa.careerGoals).toBe(1005);
    expect(pa.founding).toMatchObject({ state: 'provisional', handle: 'Veteran_B' });
    expect(pa.awards.some((x) => x.type === 'founding-golden-fan')).toBe(false);
    expect(pa.awards.some((x) => x.label === '1,000 career goals')).toBe(true);
    await settle(env, clock);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM awards WHERE award_type = 'founding-golden-fan'").first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('after an audit revokes it, the title passes to the next player in ledger order', async () => {
    const bId = await idOf('Veteran_B');
    // Owner's documented revoke step (docs/OPERATIONS.md).
    await env.DB.prepare(
      "UPDATE awards SET review_state = 'revoked', award_key = 'founding-golden-fan:revoked:' || player_id WHERE award_key = 'founding-golden-fan' AND player_id = ?",
    ).bind(bId).run();
    await settle(env, clock + 3600_000);
    const hall = await handleApi(new Request('http://localhost:5173/api/v1/leaderboard?kind=hall'), env, clock);
    const body = (await hall.json()) as { founding: Progress['founding'] };
    expect(body.founding).toMatchObject({ state: 'provisional', handle: 'Veteran_A' });
  });
});

describe('challenges and reports', () => {
  it('exposes accepted ranked cup runs as public challenges only', async () => {
    const { client } = await registerPlayer(env, now, 'Challenger', 'NG');
    const r = await start(client, { ranked: true });
    expect(r.status).toBe(201);
    const cmds = r.body.scenarioIds.map((id) => missShot(id));
    cmds[0] = goalShot(r.body.scenarioIds[0]!);
    await submit(client, r.body, cmds);
    const ch = await handleApi(new Request(`http://localhost:5173/api/v1/challenges/${r.body.runId}`), env, clock);
    expect(ch.status).toBe(200);
    const body = (await ch.json()) as Challenge;
    expect(body).toMatchObject({ handle: 'Challenger', country: 'NG', goals: 1, weekIsCurrent: true });
    expect(body.scenarioIds).toEqual(r.body.scenarioIds);
    const road = await start(client, { mode: 'road' });
    const notCup = await handleApi(new Request(`http://localhost:5173/api/v1/challenges/${road.body.runId}`), env, clock);
    expect(notCup.status).toBe(404);
  });

  it('accepts reports idempotently and refuses self-reports', async () => {
    const { client } = await registerPlayer(env, now, 'Reporter');
    expect((await client.call('POST', '/api/v1/reports', { handle: 'Farmer', reason: 'cheating', note: 'too good' })).status).toBe(202);
    expect((await client.call('POST', '/api/v1/reports', { handle: 'Farmer', reason: 'cheating' })).status).toBe(202);
    expect((await client.call('POST', '/api/v1/reports', { handle: 'Reporter', reason: 'other' })).status).toBe(400);
    expect((await client.call('POST', '/api/v1/reports', { handle: 'Nobody_here', reason: 'other' })).status).toBe(404);
    expect((await client.call('POST', '/api/v1/reports', { handle: 'Farmer', reason: 'spam' })).status).toBe(400);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM reports').first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it('guest progress is honest and empty', async () => {
    const res = await handleApi(new Request('http://localhost:5173/api/v1/progress'), env, clock);
    const p = (await res.json()) as Progress;
    expect(p.player).toBeNull();
    expect(p.careerGoals).toBe(0);
    expect(p.chapter.stages.filter((s) => s.unlocked)).toHaveLength(1);
  });
});

void clock;
clock += 0;
