import { describe, expect, it } from 'vitest';
import { CUP, compareRuns, cupMaxScore, cupScenarioIds, runTotals, scenarioSetHash } from '../src/shared/competition/cup';
import { flagEmoji, validateCountry, validateHandle } from '../src/shared/competition/identity';
import { isWeekId, weekWindow } from '../src/shared/competition/week';
import { POINTS, RULESET_VERSION, getScenario, makeCommand, simulateShot } from '../src/shared/rules';

describe('cup weeks (ISO-8601, UTC)', () => {
  it.each([
    [Date.UTC(2026, 0, 1, 12), '2026-W01'], // Thursday
    [Date.UTC(2026, 9, 29), '2026-W44'],
    [Date.UTC(2026, 10, 2, 0, 0, 0), '2026-W45'], // Monday 00:00 starts a week
    [Date.UTC(2026, 10, 1, 23, 59, 59), '2026-W44'], // Sunday 23:59:59 still the old week
    [Date.UTC(2027, 0, 1), '2026-W53'], // 2026 has 53 ISO weeks
    [Date.UTC(2027, 0, 4), '2027-W01'],
  ])('%s → %s', (ms, id) => {
    const w = weekWindow(ms);
    expect(w.id).toBe(id);
    expect(isWeekId(w.id)).toBe(true);
    expect(w.endsAt - w.startsAt).toBe(7 * 86_400_000);
    expect(new Date(w.startsAt).getUTCDay()).toBe(1);
    expect(ms).toBeGreaterThanOrEqual(w.startsAt);
    expect(ms).toBeLessThan(w.endsAt);
  });
});

describe('cup course', () => {
  it('is deterministic per week and well-formed', () => {
    const a = cupScenarioIds('2026-W45', RULESET_VERSION);
    expect(cupScenarioIds('2026-W45', RULESET_VERSION)).toEqual(a);
    expect(a).toHaveLength(CUP.shots);
    expect(a.every((id) => getScenario(id) !== null)).toBe(true);
    expect(a.filter((id) => id.includes('long-28'))).toHaveLength(2);
    expect(a.slice(0, 8).every((id) => id.endsWith('.professional'))).toBe(true);
    expect(a.slice(8).every((id) => id.endsWith('.legendary'))).toBe(true);
    expect(scenarioSetHash(a, RULESET_VERSION)).toBe(scenarioSetHash([...a], RULESET_VERSION));
    const weeks = new Set(Array.from({ length: 10 }, (_, i) => cupScenarioIds(`2026-W${10 + i}`, RULESET_VERSION).join()));
    expect(weeks.size).toBeGreaterThan(1); // order varies week to week
  });

  it('cup scenarios share practice physics (prefix only)', () => {
    const cmd = (id: string) => makeCommand(id, { aimX: 300, aimY: 600, power: 800, spin: 300 });
    const p = simulateShot(cmd('practice.left-20.legendary'));
    const c = simulateShot(cmd('cup.left-20.legendary'));
    expect(c.samples).toEqual(p.samples);
    expect(c.outcome).toBe(p.outcome);
  });

  it('has a stable maximum score that is actually achievable on every shot', () => {
    const ids = cupScenarioIds('2026-W45', RULESET_VERSION);
    const max = cupMaxScore(ids);
    expect(max).toBe(10 * (POINTS.goal + POINTS.topCorner + POINTS.curl) + 2 * POINTS.maxPerShot);
    // Search each distinct spot (legendary keeper) for a shot earning the per-shot cap.
    for (const id of new Set(ids.map((i) => i.replace('.professional', '.legendary')))) {
      const cap = Math.min(POINTS.maxPerShot, POINTS.goal + POINTS.topCorner + POINTS.curl + (getScenario(id)!.longRange ? POINTS.longRange : 0));
      let found = false;
      search: for (const spin of [-1000, -700, 700, 1000])
        for (let aimX = -1000; aimX <= 1000; aimX += 40)
          for (let aimY = 450; aimY <= 800; aimY += 25)
            for (const power of [850, 1000]) {
              if (simulateShot(makeCommand(id, { aimX, aimY, power, spin })).skillPoints === cap) {
                found = true;
                break search;
              }
            }
      expect(found, id).toBe(true);
    }
  });

  it('aggregates totals and orders by the published tie rules', () => {
    const ids = cupScenarioIds('2026-W45', RULESET_VERSION);
    const results = ids.map((id) => simulateShot(makeCommand(id, { aimX: 450, aimY: 650, power: 950, spin: 0 })));
    const t = runTotals(results);
    expect(t.goals + t.misses).toBe(12);
    expect(t.skillScore).toBe(results.reduce((s, r) => s + r.skillPoints, 0));
    const base = { skillScore: 500, goals: 4, precisionTotal: 3000, misses: 8, topCorners: 1 };
    expect(compareRuns(base, { ...base, skillScore: 600 })).toBeGreaterThan(0);
    expect(compareRuns(base, { ...base, goals: 5 })).toBeGreaterThan(0);
    expect(compareRuns(base, { ...base, precisionTotal: 3100 })).toBeGreaterThan(0);
    expect(compareRuns(base, { ...base, misses: 7 })).toBeGreaterThan(0);
    expect(compareRuns(base, { ...base })).toBe(0); // shared rank
  });
});

describe('identity validation', () => {
  it('validates nicknames and countries', () => {
    expect(validateHandle('Golden_7').ok).toBe(true);
    for (const bad of ['ab', 'x'.repeat(21), 'hi there', 'Admin', 'deleted_x', 42, 'ünï']) expect(validateHandle(bad).ok).toBe(false);
    expect(validateCountry('pt')).toEqual({ ok: true, country: 'PT' });
    expect(validateCountry(null)).toEqual({ ok: true, country: null });
    expect(validateCountry('XX').ok).toBe(false);
    expect(flagEmoji('PT')).toBe('🇵🇹');
  });
});
