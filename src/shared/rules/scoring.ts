import { clamp, q } from './fixed';
import { GOAL_HALF_WIDTH, GOAL_HEIGHT } from './geometry';
import type { ShotCommand } from './command';
import type { Scenario } from './scenarios';

export type ModifierId = 'goal' | 'top-corner' | 'curl' | 'long-range';

export interface Modifier {
  id: ModifierId;
  label: string;
  points: number;
}

/** Points table — prototype values from docs/GAMEPLAY_SPEC.md. */
export const POINTS = {
  goal: 100,
  topCorner: 150,
  curl: 200,
  longRange: 250,
  maxPerShot: 700,
} as const;

/** Top-corner zone: within 1.06 m of a post and the top 0.89 m of the mouth. */
export const TOP_CORNER = { minAbsX: GOAL_HALF_WIDTH - 1.06, minY: GOAL_HEIGHT - 0.89 } as const;
/** Curl bonus thresholds. */
export const CURL = { minSpin: 450, minOffset: 0.9 } as const;

export interface ScoreInput {
  goal: boolean;
  crossing: { x: number; y: number } | null;
  command: ShotCommand;
  scenario: Scenario;
  curlOffset: number;
  peakHeight: number;
  launchSpeed: number;
  woodworkHits: number;
  parried: boolean;
}

export function scoreShot(input: ScoreInput): {
  precision: number;
  modifiers: Modifier[];
  skillPoints: number;
  tags: string[];
} {
  const modifiers: Modifier[] = [];
  const tags: string[] = [];
  let precision = 0;
  if (input.goal && input.crossing) {
    const { x, y } = input.crossing;
    const ax = x < 0 ? -x : x;
    // Precision: 0 at the centre of the goal, 1000 in the corners.
    const nx = ax / GOAL_HALF_WIDTH;
    const ny = (y - GOAL_HEIGHT / 2) / (GOAL_HEIGHT / 2);
    precision = Math.round(clamp(Math.sqrt(nx * nx + ny * ny) / Math.sqrt(2), 0, 1) * 1000);

    modifiers.push({ id: 'goal', label: 'Goal', points: POINTS.goal });
    if (ax >= TOP_CORNER.minAbsX && y >= TOP_CORNER.minY) {
      modifiers.push({ id: 'top-corner', label: 'Top corner', points: POINTS.topCorner });
    }
    const absSpin = input.command.spin < 0 ? -input.command.spin : input.command.spin;
    const absCurl = input.curlOffset < 0 ? -input.curlOffset : input.curlOffset;
    if (absSpin >= CURL.minSpin && absCurl >= CURL.minOffset) {
      modifiers.push({ id: 'curl', label: 'Curler', points: POINTS.curl });
    }
    if (input.scenario.longRange) {
      modifiers.push({ id: 'long-range', label: 'Long range', points: POINTS.longRange });
    }
    if (input.peakHeight < 0.9) tags.push('Low drive');
    if (input.launchSpeed >= 29) tags.push('Rocket');
    if (input.peakHeight > 3.4) tags.push('Dipping');
    if (input.woodworkHits > 0) tags.push('Off the woodwork');
    if (input.parried) tags.push('Through the gloves');
  }
  const total = modifiers.reduce((s, m) => s + m.points, 0);
  return { precision: q(precision), modifiers, skillPoints: Math.min(total, POINTS.maxPerShot), tags };
}
