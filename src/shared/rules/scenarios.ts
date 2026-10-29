/**
 * Scenario definitions: where the ball sits, where the keeper starts and how
 * capable the keeper is. Scenario IDs are stable and versioned by the ruleset.
 */
export type KeeperLevel = 'rookie' | 'professional' | 'legendary';

export const KEEPER_LEVELS: readonly KeeperLevel[] = ['rookie', 'professional', 'legendary'];

export interface KeeperProfile {
  level: KeeperLevel;
  label: string;
  /** Seconds after the strike before the keeper commits. */
  reaction: number;
  /** Seconds for a full-stretch dive. */
  diveDuration: number;
  /** Max hand distance from the hip during a dive (m). */
  reach: number;
  /** Highest point the hands can reach (m). */
  maxHandHeight: number;
  /** Shots slower than this (m/s) that hit the gloves are caught, not parried. */
  catchSpeed: number;
  /** 0..1 — how much of the ball's curl the keeper anticipates. */
  curlRead: number;
}

export const KEEPER_PROFILES: Record<KeeperLevel, KeeperProfile> = {
  rookie: {
    level: 'rookie',
    label: 'Rookie',
    reaction: 0.34,
    diveDuration: 0.75,
    reach: 2.2,
    maxHandHeight: 2.45,
    catchSpeed: 14,
    curlRead: 0,
  },
  professional: {
    level: 'professional',
    label: 'Professional',
    reaction: 0.27,
    diveDuration: 0.62,
    reach: 2.55,
    maxHandHeight: 2.65,
    catchSpeed: 18,
    curlRead: 0.45,
  },
  legendary: {
    level: 'legendary',
    label: 'Legendary',
    reaction: 0.2,
    diveDuration: 0.52,
    reach: 2.85,
    maxHandHeight: 2.8,
    catchSpeed: 21,
    curlRead: 0.8,
  },
};

export interface Spot {
  id: string;
  label: string;
  /** Distance from ball to goal line (m). */
  distance: number;
  /** Ball lateral offset from the goal centre line (m). */
  ballX: number;
  /** Keeper starting x (m): keepers shade toward the near post on angles. */
  keeperX: number;
  /** Eligible for the long-range modifier. */
  longRange: boolean;
}

export const PRACTICE_SPOTS: readonly Spot[] = [
  { id: 'center-18', label: 'Centre · 18 m', distance: 18, ballX: 0, keeperX: 0, longRange: false },
  { id: 'left-20', label: 'Left channel · 20 m', distance: 20, ballX: -5.5, keeperX: -0.5, longRange: false },
  { id: 'arc-23', label: 'Top of the D · 23 m', distance: 23, ballX: -1.2, keeperX: -0.1, longRange: false },
  { id: 'right-19', label: 'Right channel · 19 m', distance: 19, ballX: 5, keeperX: 0.45, longRange: false },
  { id: 'long-28', label: 'Long range · 28 m', distance: 28, ballX: 2.5, keeperX: 0.2, longRange: true },
];

export interface Scenario extends Spot {
  scenarioId: string;
  spotId: string;
  keeper: KeeperProfile;
}

export function scenarioIdFor(spotId: string, level: KeeperLevel): string {
  return `practice.${spotId}.${level}`;
}

export function getScenario(scenarioId: string): Scenario | null {
  const m = /^practice\.([a-z0-9-]+)\.(rookie|professional|legendary)$/.exec(scenarioId);
  if (!m) return null;
  const spot = PRACTICE_SPOTS.find((s) => s.id === m[1]);
  if (!spot) return null;
  const level = m[2] as KeeperLevel;
  return { ...spot, scenarioId, spotId: spot.id, keeper: KEEPER_PROFILES[level] };
}
