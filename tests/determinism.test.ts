import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SHOT,
  KEEPER_LEVELS,
  PRACTICE_SPOTS,
  makeCommand,
  resultDigest,
  scenarioIdFor,
  simulateShot,
} from '../src/shared/rules';

/**
 * Digest of the canonical shot. The same value is returned by the Cloudflare
 * Worker at /api/health (workerd runtime), proving browser/Node/Worker agree.
 * If physics intentionally changes, bump RULESET_VERSION and update this.
 */
const CANONICAL_DIGEST = 'b21e6426';

describe('deterministic simulation', () => {
  it('replays the same command to an identical result', () => {
    const a = simulateShot(CANONICAL_SHOT);
    const b = simulateShot(structuredClone(CANONICAL_SHOT));
    expect(b).toEqual(a);
    expect(resultDigest(b)).toBe(resultDigest(a));
  });

  it('matches the pinned canonical digest (also served by the Worker)', () => {
    expect(resultDigest(simulateShot(CANONICAL_SHOT))).toBe(CANONICAL_DIGEST);
  });

  it('is stable across a broad grid of commands, spots and keepers', () => {
    for (const spot of PRACTICE_SPOTS) {
      for (const level of KEEPER_LEVELS) {
        const id = scenarioIdFor(spot.id, level);
        for (const aimX of [-900, -300, 0, 450])
          for (const aimY of [0, 500, 950])
            for (const power of [0, 500, 1000])
              for (const spin of [-1000, 0, 700]) {
                const cmd = makeCommand(id, { aimX, aimY, power, spin });
                expect(resultDigest(simulateShot(cmd))).toBe(resultDigest(simulateShot(cmd)));
              }
      }
    }
  });

  it('is mirror-symmetric on the central spot without a keeper', () => {
    const id = scenarioIdFor('center-18', 'rookie');
    for (const [aimX, spin] of [
      [300, 0],
      [200, 600],
      [-450, -1000],
    ] as const) {
      const r = simulateShot(makeCommand(id, { aimX, aimY: 500, power: 700, spin }), { keeper: false });
      const m = simulateShot(makeCommand(id, { aimX: -aimX, aimY: 500, power: 700, spin: -spin }), { keeper: false });
      expect(m.crossing!.x).toBeCloseTo(-r.crossing!.x, 5);
      expect(m.crossing!.y).toBeCloseTo(r.crossing!.y, 5);
      expect(m.outcome).toBe(r.outcome);
    }
  });

  it('render-side mutation of a result cannot change the next authoritative result', () => {
    const first = simulateShot(CANONICAL_SHOT);
    const digest = resultDigest(first);
    // Simulate a renderer scribbling over what it was given.
    first.samples.forEach((s) => (s.x += 10));
    (first as { outcome: string }).outcome = 'goal';
    first.skillPoints = 9999;
    expect(resultDigest(simulateShot(CANONICAL_SHOT))).toBe(digest);
  });
});
