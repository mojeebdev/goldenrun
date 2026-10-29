import { isSafeInt } from './fixed';
import { RULESET_VERSION } from './version';
import { getScenario } from './scenarios';

/**
 * A versioned, bounded, quantized shot. This — never a claimed outcome — is
 * what a future Worker verifier will receive and re-simulate.
 */
export interface ShotCommand {
  rulesetVersion: string;
  scenarioId: string;
  /** Horizontal aim, -1000 (far left) .. 1000 (far right). */
  aimX: number;
  /** Elevation / strike point, 0 (driven low) .. 1000 (lofted). */
  aimY: number;
  /** Strike power, 0 .. 1000. */
  power: number;
  /** Side spin, -1000 (curls left) .. 1000 (curls right). */
  spin: number;
}

export const COMMAND_BOUNDS = {
  aimX: [-1000, 1000],
  aimY: [0, 1000],
  power: [0, 1000],
  spin: [-1000, 1000],
} as const;

export type CommandValidation =
  | { ok: true; command: ShotCommand }
  | { ok: false; error: string };

/** Strict validation: integers inside bounds, known ruleset and scenario. */
export function validateShotCommand(input: unknown): CommandValidation {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'command must be an object' };
  }
  const c = input as Record<string, unknown>;
  if (c.rulesetVersion !== RULESET_VERSION) {
    return { ok: false, error: 'unsupported rulesetVersion' };
  }
  if (typeof c.scenarioId !== 'string' || c.scenarioId.length > 64 || !getScenario(c.scenarioId)) {
    return { ok: false, error: 'unknown scenarioId' };
  }
  for (const key of Object.keys(COMMAND_BOUNDS) as (keyof typeof COMMAND_BOUNDS)[]) {
    const v = c[key];
    const [lo, hi] = COMMAND_BOUNDS[key];
    if (!isSafeInt(v)) return { ok: false, error: `${key} must be an integer` };
    if (v < lo || v > hi) return { ok: false, error: `${key} out of range` };
  }
  return {
    ok: true,
    command: {
      rulesetVersion: RULESET_VERSION,
      scenarioId: c.scenarioId,
      aimX: c.aimX as number,
      aimY: c.aimY as number,
      power: c.power as number,
      spin: c.spin as number,
    },
  };
}

/** Clamp + round an arbitrary real into a command field. NaN maps to `fallback`. */
export function quantizeField(key: keyof typeof COMMAND_BOUNDS, value: number, fallback = 0): number {
  const [lo, hi] = COMMAND_BOUNDS[key];
  if (!Number.isFinite(value)) return fallback;
  const r = Math.round(value);
  return r < lo ? lo : r > hi ? hi : r === 0 ? 0 : r; // normalise -0
}

export function makeCommand(
  scenarioId: string,
  fields: { aimX: number; aimY: number; power: number; spin: number },
): ShotCommand {
  return {
    rulesetVersion: RULESET_VERSION,
    scenarioId,
    aimX: quantizeField('aimX', fields.aimX),
    aimY: quantizeField('aimY', fields.aimY, 500),
    power: quantizeField('power', fields.power),
    spin: quantizeField('spin', fields.spin),
  };
}
