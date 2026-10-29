/**
 * Turns the authoritative keeper capsule pose into an expressive humanoid rig
 * for drawing. Purely cosmetic: collisions use the capsule, and the rig is
 * built around that same capsule so what you see is what blocks the ball.
 */
import type { KeeperPose } from '../../shared/rules';

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface Rig {
  footL: P3;
  footR: P3;
  kneeL: P3;
  kneeR: P3;
  hip: P3;
  neck: P3;
  head: P3;
  shoulderL: P3;
  shoulderR: P3;
  elbowL: P3;
  elbowR: P3;
  handL: P3;
  handR: P3;
}

const p = (x: number, y: number, z: number): P3 => ({ x, y, z });

export interface IdleState {
  /** Seconds, for breathing/bounce. */
  time: number;
  /** -1..1 small lateral shuffle (pre-shot only). */
  shuffle: number;
  /** 0..1 crouch into the set position as the shooter prepares. */
  crouch: number;
}

export function readyRig(x: number, z: number, idle: IdleState): Rig {
  const bounce = Math.sin(idle.time * 5.2) * 0.018;
  const sx = x + idle.shuffle * 0.18;
  const c = idle.crouch;
  const hipY = 0.93 - c * 0.1 + bounce;
  const step = Math.sin(idle.time * 5.2) * 0.03 * Math.abs(idle.shuffle);
  const hip = p(sx, hipY, z);
  const neck = p(sx, hipY + 0.56 - c * 0.04, z);
  const armOut = 0.5 + c * 0.1;
  return {
    footL: p(sx - 0.3 - c * 0.05, 0.06 + Math.max(0, step), z),
    footR: p(sx + 0.3 + c * 0.05, 0.06 + Math.max(0, -step), z),
    kneeL: p(sx - 0.32 - c * 0.06, 0.5 - c * 0.08, z - 0.08),
    kneeR: p(sx + 0.32 + c * 0.06, 0.5 - c * 0.08, z - 0.08),
    hip,
    neck,
    head: p(sx, neck.y + 0.2, z),
    shoulderL: p(sx - 0.21, neck.y - 0.04, z),
    shoulderR: p(sx + 0.21, neck.y - 0.04, z),
    elbowL: p(sx - armOut + 0.08, neck.y - 0.22, z - 0.12),
    elbowR: p(sx + armOut - 0.08, neck.y - 0.22, z - 0.12),
    handL: p(sx - armOut - 0.02, neck.y - 0.42 + c * 0.06, z - 0.2),
    handR: p(sx + armOut + 0.02, neck.y - 0.42 + c * 0.06, z - 0.2),
  };
}

/** Rig for a committed move (set or dive), built along the feet→hands capsule. */
export function moveRig(pose: KeeperPose, plan: { action: string; x: number }): Rig {
  const a = pose.feet;
  const b = pose.hands;
  const z = a.z;
  if (plan.action === 'set' || pose.arms) {
    const base = readyRig(plan.x, z, { time: 0, shuffle: 0, crouch: 0.6 });
    const hx = b.x;
    const hy = b.y;
    return {
      ...base,
      elbowL: p((base.shoulderL.x + hx) / 2 - 0.08, (base.shoulderL.y + hy) / 2, z - 0.15),
      elbowR: p((base.shoulderR.x + hx) / 2 + 0.08, (base.shoulderR.y + hy) / 2, z - 0.15),
      handL: p(hx - 0.1, hy, z - 0.22),
      handR: p(hx + 0.1, hy, z - 0.22),
    };
  }
  let ux = b.x - a.x;
  let uy = b.y - a.y;
  const L = Math.hypot(ux, uy) || 1;
  ux /= L;
  uy /= L;
  // Normal pointing "up" relative to the body axis.
  let nx = -uy;
  let ny = ux;
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  const along = (t: number, n = 0, dz = 0): P3 => p(a.x + ux * L * t + nx * n, a.y + uy * L * t + ny * n, z + dz);
  return {
    footL: along(0, 0.02),
    footR: along(0.04, 0.2),
    kneeL: along(0.2, -0.04),
    kneeR: along(0.24, 0.16),
    hip: along(0.4, 0.04),
    neck: along(0.68, 0.06),
    head: along(0.78, 0.16),
    shoulderL: along(0.66, -0.06),
    shoulderR: along(0.68, 0.16),
    elbowL: along(0.84, -0.05, -0.05),
    elbowR: along(0.84, 0.14, -0.05),
    handL: along(1, -0.06, -0.1),
    handR: along(1, 0.08, -0.1),
  };
}

export function lerpRig(a: Rig, b: Rig, t: number): Rig {
  const out = {} as Rig;
  for (const k of Object.keys(a) as (keyof Rig)[]) {
    out[k] = p(a[k].x + (b[k].x - a[k].x) * t, a[k].y + (b[k].y - a[k].y) * t, a[k].z + (b[k].z - a[k].z) * t);
  }
  return out;
}
