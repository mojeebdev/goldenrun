/**
 * Golden Cup course: 12 standardised shots, identical for every player in a
 * week, derived deterministically from the week ID and the ruleset version.
 */
import { fnv1a } from '../rules/fixed';
import { POINTS } from '../rules/scoring';
import { getScenario, scenarioIdFor } from '../rules/scenarios';
import type { KeeperLevel } from '../rules/scenarios';
import type { ShotResult } from '../rules/simulate';

export const CUP = {
  shots: 12,
  /** Target round length shown to players (s). Not a score input. */
  targetSeconds: 90,
  /** Extra server-side allowance for network and device delays (s). */
  graceSeconds: 30,
  /** Runs completed faster than this are held for review (ms). */
  minPlausibleMs: 18_000,
} as const;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s;
  };
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Course shape (fixed): shots 1–4 against a Professional keeper from the four
 * short spots; 5–8 Professional including one long-range strike; 9–12
 * Legendary including one long-range strike. The weekly seed only reorders
 * spots inside each block.
 */
export function cupScenarioIds(weekId: string, rulesetVersion: string): string[] {
  const next = lcg(parseInt(fnv1a(`${rulesetVersion}:${weekId}`), 16));
  const short = ['center-18', 'left-20', 'arc-23', 'right-19'];
  const block = (spots: string[], level: KeeperLevel) => shuffle(spots, next).map((s) => `cup.${s}.${level}`);
  const b1 = block(short, 'professional');
  const b2 = block([...shuffle(short, next).slice(0, 3), 'long-28'], 'professional');
  const b3 = block([...shuffle(short, next).slice(0, 3), 'long-28'], 'legendary');
  return [...b1, ...b2, ...b3];
}

export function scenarioSetHash(ids: readonly string[], rulesetVersion: string): string {
  return fnv1a(`${rulesetVersion}|${ids.join(',')}`);
}

/** Highest score any course can award: every shot at its per-shot cap. */
export function cupMaxScore(ids: readonly string[]): number {
  return ids.reduce((sum, id) => {
    const sc = getScenario(id);
    const max = POINTS.goal + POINTS.topCorner + POINTS.curl + (sc?.longRange ? POINTS.longRange : 0);
    return sum + Math.min(max, POINTS.maxPerShot);
  }, 0);
}

export interface RunTotals {
  skillScore: number;
  goals: number;
  precisionTotal: number;
  misses: number;
  topCorners: number;
}

/** Aggregate authoritative shot results. Career goals count 1 per goal, never by points. */
export function runTotals(results: readonly ShotResult[]): RunTotals {
  let skillScore = 0;
  let goals = 0;
  let precisionTotal = 0;
  let topCorners = 0;
  for (const r of results) {
    skillScore += r.skillPoints;
    if (r.goal) {
      goals++;
      precisionTotal += r.precision;
      if (r.modifiers.some((m) => m.id === 'top-corner')) topCorners++;
    }
  }
  return { skillScore, goals, precisionTotal, misses: results.length - goals, topCorners };
}

/** Published tie order: points, goals, precision subtotal, fewer misses; else a shared rank. */
export function compareRuns(a: RunTotals, b: RunTotals): number {
  return (
    b.skillScore - a.skillScore || b.goals - a.goals || b.precisionTotal - a.precisionTotal || a.misses - b.misses
  );
}

export { scenarioIdFor };
