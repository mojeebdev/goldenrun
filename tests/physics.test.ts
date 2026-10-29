import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  KEEPER_LEVELS,
  KEEPER_PROFILES,
  KEEPER_LINE_OFFSET,
  POST_AXIS_X,
  BAR_AXIS_Y,
  POINTS,
  getScenario,
  makeCommand,
  scenarioIdFor,
  simulateShot,
} from '../src/shared/rules';
import type { ShotResult } from '../src/shared/rules';

const cache = new Map<string, ShotResult[]>();
function sweep(spot: string, level: (typeof KEEPER_LEVELS)[number], keeper: boolean): ShotResult[] {
  const key = `${spot}/${level}/${keeper}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const id = scenarioIdFor(spot, level);
  const out: ShotResult[] = [];
  for (let aimX = -700; aimX <= 700; aimX += 35)
    for (let aimY = 0; aimY <= 1000; aimY += 100)
      for (const power of [200, 550, 900])
        for (const spin of [-600, 0, 600]) out.push(simulateShot(makeCommand(id, { aimX, aimY, power, spin }), { keeper }));
  cache.set(key, out);
  return out;
}

const open = sweep('center-18', 'rookie', false);

describe('goal-line and frame geometry', () => {
  it('only counts a goal when the whole ball crossed inside the frame', () => {
    const D = getScenario(scenarioIdFor('center-18', 'rookie'))!.distance;
    for (const r of open) {
      if (r.goal) {
        expect(r.crossing?.inside).toBe(true);
        expect(Math.abs(r.crossing!.x)).toBeLessThan(GOAL_HALF_WIDTH);
        expect(r.crossing!.y).toBeLessThan(GOAL_HEIGHT);
        // The replay itself shows the ball wholly over the line.
        expect(r.samples.some((s) => s.z >= D + BALL_RADIUS)).toBe(true);
      } else if (r.crossing) {
        expect(r.crossing.inside).toBe(false);
      }
    }
  });

  it('awards exactly one result per shot with a consistent outcome', () => {
    for (const r of open) {
      const goals = r.modifiers.filter((m) => m.id === 'goal').length;
      expect(goals).toBe(r.goal ? 1 : 0);
      expect(r.skillPoints).toBe(r.goal ? Math.min(r.modifiers.reduce((s, m) => s + m.points, 0), POINTS.maxPerShot) : 0);
      if (!r.goal) expect(r.modifiers).toHaveLength(0);
    }
  });

  it('produces post and crossbar hits located on the woodwork', () => {
    const posts = open.flatMap((r) => r.woodwork.filter((w) => w.kind === 'post'));
    const bars = open.flatMap((r) => r.woodwork.filter((w) => w.kind === 'crossbar'));
    expect(posts.length).toBeGreaterThan(0);
    expect(bars.length).toBeGreaterThan(0);
    for (const p of posts) {
      expect(Math.abs(Math.abs(p.x) - POST_AXIS_X)).toBeLessThan(BALL_RADIUS + 0.07);
      expect(p.y).toBeLessThan(BAR_AXIS_Y);
    }
    for (const b of bars) {
      expect(Math.abs(b.y - BAR_AXIS_Y)).toBeLessThan(BALL_RADIUS + 0.07);
      expect(Math.abs(b.x)).toBeLessThan(POST_AXIS_X);
    }
    expect(open.some((r) => r.outcome === 'post')).toBe(true);
    expect(open.some((r) => r.outcome === 'crossbar')).toBe(true);
  });

  it('can be wide, over, low-driven and top-corner', () => {
    expect(open.some((r) => r.outcome === 'wide')).toBe(true);
    expect(open.some((r) => r.outcome === 'over')).toBe(true);
    expect(open.some((r) => r.goal && r.tags.includes('Low drive'))).toBe(true);
    expect(open.some((r) => r.modifiers.some((m) => m.id === 'top-corner'))).toBe(true);
    expect(open.some((r) => r.modifiers.some((m) => m.id === 'curl'))).toBe(true);
  });

  it('curls with spin: positive spin bends right, negative bends left', () => {
    const id = scenarioIdFor('center-18', 'rookie');
    const base = simulateShot(makeCommand(id, { aimX: 0, aimY: 500, power: 600, spin: 0 }), { keeper: false });
    const right = simulateShot(makeCommand(id, { aimX: 0, aimY: 500, power: 600, spin: 1000 }), { keeper: false });
    const left = simulateShot(makeCommand(id, { aimX: 0, aimY: 500, power: 600, spin: -1000 }), { keeper: false });
    expect(right.crossing!.x).toBeGreaterThan(base.crossing!.x + 1);
    expect(left.crossing!.x).toBeLessThan(base.crossing!.x - 1);
  });

  it('power and elevation change the flight', () => {
    const id = scenarioIdFor('center-18', 'rookie');
    const soft = simulateShot(makeCommand(id, { aimX: 0, aimY: 500, power: 100, spin: 0 }), { keeper: false });
    const hard = simulateShot(makeCommand(id, { aimX: 0, aimY: 500, power: 1000, spin: 0 }), { keeper: false });
    expect(hard.crossing!.t).toBeLessThan(soft.crossing!.t);
    expect(hard.launchSpeed).toBeGreaterThan(soft.launchSpeed);
    const low = simulateShot(makeCommand(id, { aimX: 0, aimY: 100, power: 700, spin: 0 }), { keeper: false });
    const high = simulateShot(makeCommand(id, { aimX: 0, aimY: 650, power: 700, spin: 0 }), { keeper: false });
    expect(high.crossing!.y).toBeGreaterThan(low.crossing!.y + 1);
  });

  it('handles every extreme command without NaN', () => {
    for (const spot of ['center-18', 'left-20', 'long-28'])
      for (const aimX of [-1000, 1000])
        for (const aimY of [0, 1000])
          for (const power of [0, 1000])
            for (const spin of [-1000, 1000]) {
              const r = simulateShot(makeCommand(scenarioIdFor(spot, 'legendary'), { aimX, aimY, power, spin }));
              for (const s of r.samples) expect(Number.isFinite(s.x + s.y + s.z)).toBe(true);
              expect(r.duration).toBeGreaterThan(0);
            }
  });
});

describe('goalkeeper', () => {
  it('only touches balls within physical reach of their starting position', () => {
    for (const level of KEEPER_LEVELS) {
      const profile = KEEPER_PROFILES[level];
      const sc = getScenario(scenarioIdFor('center-18', level))!;
      for (const r of sweep('center-18', level, true)) {
        if (!r.keeperContact) continue;
        const dx = r.keeperContact.x - sc.keeperX;
        const dy = r.keeperContact.y - 0.95;
        const fromHip = Math.sqrt(dx * dx + dy * dy);
        // Reach + glove/body radius + ball radius + one step of travel.
        expect(fromHip).toBeLessThan(Math.max(profile.reach, 1.7) + 0.3 + BALL_RADIUS + 0.15);
        expect(Math.abs(r.keeperContact.z - (sc.distance - KEEPER_LINE_OFFSET))).toBeLessThan(0.6);
      }
    }
  });

  it('never saves a hard shot into the top corners, even at Legendary', () => {
    for (const level of KEEPER_LEVELS) {
      const withKeeper = sweep('center-18', level, true);
      let checked = 0;
      withKeeper.forEach((r, i) => {
        const free = open[i]!;
        if (r.launchSpeed > 25 && free.woodwork.length === 0 && free.goal && Math.abs(free.crossing!.x) > 3.3 && free.crossing!.y > 1.9) {
          checked++;
          expect(r.goal).toBe(true);
        }
      });
      expect(checked).toBeGreaterThan(0);
    }
  });

  it('gets harder with each level', () => {
    const rate = (level: (typeof KEEPER_LEVELS)[number]) => {
      const rs = sweep('center-18', level, true).filter((_r, i) => open[i]!.goal);
      return rs.filter((r) => r.goal).length / rs.length;
    };
    const rookie = rate('rookie');
    const pro = rate('professional');
    const legend = rate('legendary');
    expect(rookie).toBeGreaterThan(pro);
    expect(pro).toBeGreaterThan(legend);
    expect(legend).toBeGreaterThan(0.05); // difficult, not impossible
  });

  it('saves shots struck straight at them', () => {
    for (const level of KEEPER_LEVELS) {
      const r = simulateShot(makeCommand(scenarioIdFor('center-18', level), { aimX: 0, aimY: 300, power: 500, spin: 0 }));
      expect(r.outcome).toBe('saved');
    }
  });
});
