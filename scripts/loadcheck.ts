// Local load check: real Worker handler + local D1 (Miniflare), single machine.
// Registers players with software passkeys, submits verified runs and times
// the hot paths. Production D1 runs on Cloudflare and will differ; this is a
// regression guard for query cost, not a capacity claim.
import { registerPlayer, startHarness } from '../tests/integration/harness';
import { makeCommand } from '../src/shared/rules';
import type { StartedRun } from '../src/shared/competition/api';

const PLAYERS = Number(process.env.PLAYERS ?? 60);
const ROAD_RUNS = Number(process.env.ROAD_RUNS ?? 3);

function pct(xs: number[], p: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!.toFixed(1);
}

async function main() {
  const { env, dispose } = await startHarness();
  let clock = Date.UTC(2026, 10, 11, 12, 0, 0);
  const now = () => clock;
  const submitMs: number[] = [];
  const clients = [];
  for (let i = 0; i < PLAYERS; i++) clients.push((await registerPlayer(env, now, `Load_${i}`, i % 3 ? 'PT' : 'BR')).client);
  for (const [i, c] of clients.entries()) {
    const runs: StartedRun[] = [];
    const cup = await c.call<StartedRun>('POST', '/api/v1/runs/start', { mode: 'cup', ranked: true });
    runs.push(cup.body);
    for (let k = 0; k < ROAD_RUNS; k++) runs.push((await c.call<StartedRun>('POST', '/api/v1/runs/start', { mode: 'road' })).body);
    for (const r of runs) {
      const cmds = r.scenarioIds.map((id, j) => makeCommand(id, { aimX: ((i * 37 + j * 91) % 1400) - 700, aimY: (i * 53 + j * 29) % 900, power: 600 + ((i + j) % 400), spin: ((i + j) % 5) * 200 - 400 }));
      const t0 = performance.now();
      const res = await c.call('POST', `/api/v1/runs/${r.runId}/submit`, { nonce: r.nonce, idempotencyKey: `k-${r.runId}`, commands: cmds }, { now: r.startedAt + 40_000 });
      submitMs.push(performance.now() - t0);
      if (res.status !== 201) throw new Error(`submit ${res.status}`);
    }
    clock += 1000;
  }
  const readMs: Record<string, number[]> = { weekly: [], country: [], career: [], hall: [], progress: [] };
  const reader = clients[0]!;
  for (let k = 0; k < 40; k++) {
    for (const [kind, path] of [
      ['weekly', '/api/v1/leaderboard?kind=weekly'],
      ['country', '/api/v1/leaderboard?kind=country&country=PT'],
      ['career', '/api/v1/leaderboard?kind=career'],
      ['hall', '/api/v1/leaderboard?kind=hall'],
      ['progress', '/api/v1/progress'],
    ] as const) {
      const t0 = performance.now();
      await reader.call('GET', path);
      readMs[kind]!.push(performance.now() - t0);
    }
  }
  console.log(`players=${PLAYERS} runs=${submitMs.length} (each fully re-simulated)`);
  console.log(`submit   p50=${pct(submitMs, 50)}ms p95=${pct(submitMs, 95)}ms`);
  for (const [k, xs] of Object.entries(readMs)) console.log(`${k.padEnd(8)} p50=${pct(xs, 50)}ms p95=${pct(xs, 95)}ms`);
  await dispose();
}

void main();
