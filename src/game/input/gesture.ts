/**
 * Pointer gesture → ShotCommand mapping. Pure and viewport-independent.
 *
 * Gesture model (one finger or mouse):
 *   1. TOUCH the strike pad (the ball). Where you strike it vertically sets the
 *      elevation: strike low on the ball to lift it, high to keep it down.
 *   2. DRAG toward the goal. Direction = left/right aim. Length = power.
 *   3. CURVE the drag to apply side spin (bend right → ball curls right).
 *   4. RELEASE to shoot. Release near the start, or drag downward, to cancel.
 *
 * Fairness: every length is divided by a reference length derived from the
 * viewport (not raw pixels), spin uses the enclosed area of the path (robust
 * to how many pointer samples a device delivers), and the output is clamped
 * and quantised by the shared rules.
 */
import { makeCommand } from '../../shared/rules';
import type { ShotCommand } from '../../shared/rules';

export interface Point {
  x: number;
  y: number;
}

export interface GestureFrame {
  /** Strike pad centre and radius in CSS px. */
  padCenter: Point;
  padRadius: number;
  /** Reference drag length (CSS px) for full power. */
  refLength: number;
}

export interface ShotParams {
  aimX: number;
  aimY: number;
  power: number;
  spin: number;
}

export const GESTURE = {
  /** Fraction of refLength below which a release cancels. */
  cancelBelow: 0.12,
  /** Drag (normalised) that maps to zero power. */
  powerFloor: 0.12,
  /** Sideways/up ratio that reaches |aimX| = 1000. */
  fullAimRatio: 1.15,
  /** Normalised enclosed-area curvature that reaches |spin| = 1000. */
  fullSpinCurvature: 0.11,
  /** Curvature dead zone: small wobbles never add spin. */
  spinDeadZone: 0.012,
} as const;

/** Reference drag length for a viewport: same intent ⇒ same command at any size. */
export function referenceLength(viewportW: number, viewportH: number): number {
  const m = Math.min(viewportW, viewportH);
  return Math.max(120, Math.min(420, m * 0.42));
}

/** Elevation from where the pad was struck: bottom → 1000 (lofted), top → 0. */
export function elevationFromStrike(start: Point, frame: GestureFrame): number {
  const oy = (start.y - frame.padCenter.y) / frame.padRadius;
  const c = oy < -1 ? -1 : oy > 1 ? 1 : oy;
  return 450 + c * 550; // centre strike ≈ chest-high shot
}

/** Signed curvature: positive when the path bows left of its chord (curls right). */
export function pathCurvature(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  const p0 = points[0]!;
  const pn = points[points.length - 1]!;
  const cx = pn.x - p0.x;
  const cy = pn.y - p0.y;
  const len2 = cx * cx + cy * cy;
  if (len2 < 1) return 0;
  // Shoelace area of the polygon (path + closing chord), screen coords (y down).
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    area += (a.x - p0.x) * (b.y - p0.y) - (b.x - p0.x) * (a.y - p0.y);
  }
  area *= 0.5;
  // In y-down screen space, a path bowing left of an upward chord has positive area.
  return area / len2;
}

export interface GestureReading {
  params: ShotParams;
  /** Normalised drag length (1 = full power). */
  length: number;
  cancel: boolean;
}

export function readGesture(points: readonly Point[], frame: GestureFrame): GestureReading {
  const start = points[0];
  const end = points[points.length - 1];
  const aimY = start ? elevationFromStrike(start, frame) : 500;
  if (!start || !end) {
    return { params: { aimX: 0, aimY, power: 0, spin: 0 }, length: 0, cancel: true };
  }
  const dx = (end.x - start.x) / frame.refLength;
  const dy = (end.y - start.y) / frame.refLength;
  const up = -dy;
  const length = Math.sqrt(dx * dx + dy * dy);
  const cancel = length < GESTURE.cancelBelow || up < GESTURE.cancelBelow * 0.5;
  const ratio = dx / Math.max(up, 0.25);
  const aimX = (ratio / GESTURE.fullAimRatio) * 1000;
  const power = ((length - GESTURE.powerFloor) / (1 - GESTURE.powerFloor)) * 1000;
  const k = pathCurvature(points);
  const ak = Math.abs(k);
  const spin = ak < GESTURE.spinDeadZone ? 0 : (Math.sign(k) * (ak - GESTURE.spinDeadZone) * 1000) / (GESTURE.fullSpinCurvature - GESTURE.spinDeadZone);
  return {
    params: {
      aimX: clamp(aimX, -1000, 1000),
      aimY,
      power: clamp(power, 0, 1000),
      spin: clamp(spin, -1000, 1000),
    },
    length,
    cancel,
  };
}

export function gestureToCommand(scenarioId: string, points: readonly Point[], frame: GestureFrame): ShotCommand | null {
  const r = readGesture(points, frame);
  if (r.cancel) return null;
  return makeCommand(scenarioId, r.params);
}

/**
 * Resample a raw pointer path at fixed arc-length spacing so that devices with
 * very different sampling rates (60 Hz vs 240 Hz touch) yield the same shape.
 */
export function resamplePath(points: readonly Point[], spacing: number): Point[] {
  if (points.length === 0) return [];
  const out: Point[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]!;
    const b = points[i]!;
    let seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (carry + seg >= spacing && seg > 0) {
      const t = (spacing - carry) / seg;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(p);
      a = p;
      seg = Math.hypot(b.x - a.x, b.y - a.y);
      carry = 0;
    }
    carry += seg;
  }
  const last = points[points.length - 1]!;
  const tail = out[out.length - 1]!;
  if (tail.x !== last.x || tail.y !== last.y) out.push({ x: last.x, y: last.y });
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Keyboard step sizes. */
export const KEY_STEPS = { aimX: 50, aimY: 50, power: 50, spin: 100 } as const;
