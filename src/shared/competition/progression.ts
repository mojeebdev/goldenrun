/**
 * Progression rules: "2008: The Beginning" chapter and "Road to 1,000".
 * Shared by the Worker (authoritative) and the SPA (display only).
 *
 * Career goals: every goal the server accepts from a Golden Cup run or a
 * Road to 1,000 run counts exactly once. Chapter goals count toward the 2008
 * chapter and — only while they fill a matchday's quota — toward the career
 * total too, so replaying an easy matchday can't be farmed.
 */
import { fnv1a } from '../rules/fixed';
import type { KeeperLevel } from '../rules/scenarios';

export type RunMode = 'cup' | 'chapter' | 'road';

export const MILESTONES = [42, 100, 250, 500, 750, 1000] as const;
export const FOUNDING_GOALS = 1000;

export const ROAD = {
  shots: 10,
  /** Shooting time on the in-game clock (s); the deadline adds the extra time below. */
  targetSeconds: 210,
  graceSeconds: 30,
} as const;

/** Runs faster than this per shot are held for review (ms). */
export const MIN_MS_PER_SHOT = 1500;

export interface ChapterStage {
  stage: number;
  title: string;
  blurb: string;
  scenarioIds: string[];
}

/** Each matchday contributes at most this many goals to the chapter. */
export const CHAPTER_QUOTA = 7;
export const CHAPTER_TARGET = 42;
export const CHAPTER_SHOTS = 10;

const s = (spot: string, level: KeeperLevel) => `practice.${spot}.${level}`;

/**
 * Original, fictional matchdays loosely themed on a breakthrough season.
 * No real fixtures, clubs, players or commentary are depicted.
 */
export const CHAPTER_2008: ChapterStage[] = [
  {
    stage: 1,
    title: 'The Debut',
    blurb: 'First night under the floodlights. A forgiving keeper — find your range.',
    scenarioIds: [s('center-18', 'rookie'), s('right-19', 'rookie'), s('left-20', 'rookie'), s('center-18', 'rookie'), s('arc-23', 'rookie'), s('right-19', 'rookie'), s('left-20', 'rookie'), s('center-18', 'rookie'), s('arc-23', 'rookie'), s('center-18', 'rookie')],
  },
  {
    stage: 2,
    title: 'Under the Lights',
    blurb: 'The keeper starts reading your eyes. Mix power with placement.',
    scenarioIds: [s('center-18', 'rookie'), s('left-20', 'professional'), s('right-19', 'rookie'), s('arc-23', 'professional'), s('center-18', 'professional'), s('left-20', 'rookie'), s('right-19', 'professional'), s('arc-23', 'rookie'), s('center-18', 'professional'), s('left-20', 'professional')],
  },
  {
    stage: 3,
    title: 'Away Days',
    blurb: 'Hostile crowd, sharper keeper. Curl it away from the dive.',
    scenarioIds: [s('right-19', 'professional'), s('left-20', 'professional'), s('arc-23', 'professional'), s('center-18', 'professional'), s('right-19', 'professional'), s('arc-23', 'professional'), s('left-20', 'professional'), s('center-18', 'professional'), s('right-19', 'professional'), s('arc-23', 'professional')],
  },
  {
    stage: 4,
    title: 'Derby Night',
    blurb: 'Long-range chances appear. Strike low on the ball and trust the dip.',
    scenarioIds: [s('arc-23', 'professional'), s('long-28', 'professional'), s('left-20', 'professional'), s('right-19', 'legendary'), s('long-28', 'professional'), s('center-18', 'legendary'), s('arc-23', 'professional'), s('long-28', 'professional'), s('left-20', 'legendary'), s('right-19', 'professional')],
  },
  {
    stage: 5,
    title: 'The Final Stretch',
    blurb: 'Legendary keepers, every angle. Precision over power.',
    scenarioIds: [s('left-20', 'legendary'), s('arc-23', 'legendary'), s('right-19', 'legendary'), s('long-28', 'professional'), s('center-18', 'legendary'), s('left-20', 'legendary'), s('long-28', 'legendary'), s('right-19', 'legendary'), s('arc-23', 'legendary'), s('center-18', 'legendary')],
  },
  {
    stage: 6,
    title: 'Cup Final Night',
    blurb: 'Everything on one night. Top corners, curlers and thunderbolts.',
    scenarioIds: [s('long-28', 'legendary'), s('arc-23', 'legendary'), s('left-20', 'legendary'), s('long-28', 'legendary'), s('right-19', 'legendary'), s('center-18', 'legendary'), s('long-28', 'legendary'), s('arc-23', 'legendary'), s('left-20', 'legendary'), s('right-19', 'legendary')],
  },
];

export function chapterStage(stage: number): ChapterStage | null {
  return CHAPTER_2008.find((c) => c.stage === stage) ?? null;
}

/** Matchday N unlocks once the previous matchdays hold N-1 full quotas between them. */
export function stageUnlocked(stage: number, chapterGoalsByStage: Record<number, number>): boolean {
  if (stage === 1) return true;
  const prev = chapterGoalsByStage[stage - 1] ?? 0;
  return prev >= CHAPTER_QUOTA;
}

export interface RoadTier {
  name: string;
  minGoals: number;
  levels: KeeperLevel[];
  spots: string[];
}

/** Road to 1,000 gets harder as a player's verified career total grows. */
export const ROAD_TIERS: RoadTier[] = [
  { name: 'Academy', minGoals: 0, levels: ['rookie'], spots: ['center-18', 'left-20', 'right-19', 'arc-23'] },
  { name: 'First team', minGoals: 42, levels: ['rookie', 'professional'], spots: ['center-18', 'left-20', 'right-19', 'arc-23'] },
  { name: 'Regular', minGoals: 100, levels: ['professional'], spots: ['center-18', 'left-20', 'right-19', 'arc-23', 'long-28'] },
  { name: 'Star', minGoals: 250, levels: ['professional', 'legendary'], spots: ['left-20', 'right-19', 'arc-23', 'long-28'] },
  { name: 'Icon', minGoals: 500, levels: ['legendary'], spots: ['center-18', 'left-20', 'right-19', 'arc-23', 'long-28'] },
  { name: 'Legend', minGoals: 750, levels: ['legendary'], spots: ['left-20', 'right-19', 'arc-23', 'long-28'] },
];

export function roadTier(careerGoals: number): RoadTier {
  let tier = ROAD_TIERS[0]!;
  for (const t of ROAD_TIERS) if (careerGoals >= t.minGoals) tier = t;
  return tier;
}

/** Road course for a run, from a server-chosen random seed (stored with the run). */
export function roadScenarioIds(careerGoals: number, seed: string): string[] {
  const tier = roadTier(careerGoals);
  let h = parseInt(fnv1a(seed), 16) >>> 0;
  const next = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h;
  };
  return Array.from({ length: ROAD.shots }, () => {
    const spot = tier.spots[next() % tier.spots.length]!;
    const level = tier.levels[next() % tier.levels.length]!;
    return `practice.${spot}.${level}`;
  });
}

export function nextMilestone(careerGoals: number): number | null {
  return MILESTONES.find((m) => m > careerGoals) ?? null;
}

export type AwardType = 'cup-week-winner' | 'milestone' | 'badge-2008' | 'founding-golden-fan';

export const AWARD_LABELS: Record<string, string> = {
  'cup-week-winner': 'Golden Cup winner',
  milestone: 'Career milestone',
  'badge-2008': '2008: The Beginning',
  'founding-golden-fan': 'Founding Golden Fan',
};
