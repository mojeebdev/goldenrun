import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../src/worker/env';
import { migrationStatements, startHarness } from './harness';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ env, dispose } = await startHarness({ migrations: ['0001_initial.sql'] }));
});
afterAll(async () => dispose());

const count = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

describe('migration 0002 on a database with Milestone 2 data', () => {
  it('keeps every run, shot, ledger row and award', async () => {
    await env.DB.batch(
      [
        "INSERT INTO players (id, handle, handle_norm, created_at) VALUES ('p1','Alpha','alpha',1), ('p2','Bravo','bravo',2)",
        "INSERT INTO cup_weeks (id, starts_at, ends_at, ruleset_version, scenario_ids, scenario_set_hash) VALUES ('2026-W44', 0, 1, 'gr-1.0.0', '[]', 'x')",
        "INSERT INTO runs (id, player_id, mode, ranked, cup_week_id, ruleset_version, nonce_hash, started_at, deadline_at, submitted_at, state, skill_score, goals, precision_total, misses, idempotency_key) VALUES ('r1','p1','cup',1,'2026-W44','gr-1.0.0','h',1,2,3,'accepted',750,3,2000,9,'k1'), ('r2','p2','cup',1,'2026-W44','gr-1.0.0','h',1,2,NULL,'started',NULL,NULL,NULL,NULL,NULL)",
        "INSERT INTO run_shots (run_id, idx, scenario_id, command, outcome, goal, skill_points, precision, modifiers) VALUES ('r1',0,'cup.center-18.professional','{}','goal',1,250,800,'[]'), ('r1',1,'cup.left-20.professional','{}','wide',0,0,0,'[]')",
        "INSERT INTO goal_ledger (player_id, run_id, shot_index, created_at) VALUES ('p1','r1',0,3), ('p1','r1',3,3), ('p1','r1',7,3)",
        "INSERT INTO awards (id, player_id, award_type, award_key, source_run, awarded_at) VALUES ('a1','p1','cup-week-winner','cup-week-winner:2026-W44:p1','r1',5)",
      ].map((q) => env.DB.prepare(q)),
    );
    await env.DB.batch(migrationStatements('0002_progression.sql').map((q) => env.DB.prepare(q)));
    expect(await count('runs')).toBe(2);
    expect(await count('run_shots')).toBe(2); // the cascade trap: must survive the runs rebuild
    expect(await count('goal_ledger')).toBe(3);
    expect(await count('awards')).toBe(1);
    expect(await count('players')).toBe(2);
    const fk = await env.DB.prepare('PRAGMA foreign_key_check').all();
    expect(fk.results).toHaveLength(0);
    const leftovers = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name IN ('runs_new', 'run_shots_keep')").all();
    expect(leftovers.results).toHaveLength(0);
  });

  it('enforces the new mode invariants', async () => {
    const bad = env.DB.prepare(
      "INSERT INTO runs (id, player_id, mode, ranked, ruleset_version, nonce_hash, started_at, deadline_at) VALUES ('x','p1','chapter',0,'gr-1.0.0','h',1,2)",
    );
    await expect(bad.run()).rejects.toThrow(); // chapter runs need a stage
    const cupNoWeek = env.DB.prepare(
      "INSERT INTO runs (id, player_id, mode, ranked, ruleset_version, nonce_hash, started_at, deadline_at) VALUES ('y','p1','cup',1,'gr-1.0.0','h',1,2)",
    );
    await expect(cupNoWeek.run()).rejects.toThrow();
  });
});
