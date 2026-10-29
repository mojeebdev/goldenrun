import { clamp, easeOut3, lerp, q } from './fixed';
import { GOAL_HALF_WIDTH, GOAL_HEIGHT, GRAVITY } from './geometry';
import type { KeeperProfile } from './scenarios';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type KeeperAction = 'ready' | 'set' | 'dive-left' | 'dive-right' | 'watch';

/**
 * The keeper's decision, taken once at the reaction instant from the ball
 * state the keeper can observe. Everything is derived deterministically.
 */
export interface KeeperPlan {
  action: KeeperAction;
  /** Start x of the keeper and the plane z they work in. */
  x: number;
  z: number;
  /** Time (s) the keeper reads the shot and commits to a move. */
  reactAt: number;
  /** Time (s) the move starts — keepers wait on slow shots instead of diving early. */
  startAt: number;
  /** Predicted interception point (what the keeper read). */
  read: { x: number; y: number } | null;
  /** Final hand position the dive heads for (reach-limited). */
  handsTo: { x: number; y: number } | null;
  /** Seconds the move takes. */
  duration: number;
}

export interface KeeperPose {
  feet: Vec3;
  hands: Vec3;
  /** Body capsule radius. */
  radius: number;
  /** Ready-stance arms bar (null mid-dive). */
  arms: [Vec3, Vec3] | null;
  /** 0..1 progress through the committed move. */
  progress: number;
  /** 0..1 progress of falling to the turf after a dive. */
  fall: number;
}

const READY_HANDS_Y = 1.62;
const FEET_Y = 0.12;
const HIP_Y = 0.95;
const READY_RADIUS = 0.3;
const DIVE_RADIUS = 0.24;
const ARMS_Y = 1.15;
const ARMS_HALF = 0.62;
const FALL_DELAY = 0.08;
const FALL_DURATION = 0.4;

export function readyPlan(x: number, z: number, reactAt: number): KeeperPlan {
  return { action: 'ready', x, z, reactAt, startAt: reactAt, read: null, handsTo: null, duration: 0 };
}

/**
 * Decide the keeper's move from the observed ball state.
 * `lateralAccel` is the ball's current sideways acceleration (curl); the keeper
 * anticipates only `profile.curlRead` of it.
 */
export function planKeeper(
  profile: KeeperProfile,
  keeperX: number,
  keeperZ: number,
  t: number,
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  lateralAccel: number,
): KeeperPlan {
  const base = readyPlan(keeperX, keeperZ, t);
  if (ball.vz <= 0.5 || ball.z >= keeperZ) return { ...base, action: 'watch' };
  const tz = (keeperZ - ball.z) / ball.vz;
  const px = q(ball.x + ball.vx * tz + 0.5 * profile.curlRead * lateralAccel * tz * tz);
  const py = q(clamp(ball.y + ball.vy * tz - 0.5 * GRAVITY * tz * tz, 0.15, 3.2));
  const read = { x: px, y: py };
  const arriveAt = t + tz;
  if (px < -(GOAL_HALF_WIDTH + 0.7) || px > GOAL_HALF_WIDTH + 0.7 || py > GOAL_HEIGHT + 0.6) {
    return { ...base, action: 'watch', read };
  }
  const dx = px - keeperX;
  // Shots straight at the keeper: hands move to the ball, no dive.
  if (dx > -0.55 && dx < 0.55 && py < 2.0) {
    const hx = keeperX + clamp(dx, -0.9, 0.9);
    const hy = clamp(py, 0.25, profile.maxHandHeight);
    return {
      ...base,
      action: 'set',
      read,
      handsTo: { x: q(hx), y: q(hy) },
      duration: q(profile.diveDuration * 0.45),
      startAt: q(Math.max(t, arriveAt - profile.diveDuration * 0.45)),
    };
  }
  // Full dive: hands head for the read point, limited by reach and leap.
  let vx = px - keeperX;
  let vy = py - HIP_Y;
  const len = Math.sqrt(vx * vx + vy * vy);
  if (len > profile.reach) {
    vx = (vx / len) * profile.reach;
    vy = (vy / len) * profile.reach;
  }
  const hy = clamp(HIP_Y + vy, 0.2, profile.maxHandHeight);
  return {
    ...base,
    action: dx < 0 ? 'dive-left' : 'dive-right',
    read,
    handsTo: { x: q(keeperX + vx), y: q(hy) },
    duration: profile.diveDuration,
    startAt: q(Math.max(t, arriveAt - profile.diveDuration)),
  };
}

/** Keeper body at time t. Used by BOTH collision and rendering. */
export function keeperPose(plan: KeeperPlan, t: number): KeeperPose {
  const kx = plan.x;
  const z = plan.z;
  const ready: KeeperPose = {
    feet: { x: kx, y: FEET_Y, z },
    hands: { x: kx, y: READY_HANDS_Y, z },
    radius: READY_RADIUS,
    arms: [
      { x: kx - ARMS_HALF, y: ARMS_Y, z },
      { x: kx + ARMS_HALF, y: ARMS_Y, z },
    ],
    progress: 0,
    fall: 0,
  };
  if (plan.action === 'ready' || plan.action === 'watch' || !plan.handsTo || t <= plan.startAt) {
    return ready;
  }
  const p = clamp((t - plan.startAt) / plan.duration, 0, 1);
  // Quadratic ease-out: explosive push-off that decelerates at full stretch.
  const s = plan.action === 'set' ? easeOut3(p) : p * (2 - p);
  const to = plan.handsTo;
  if (plan.action === 'set') {
    return {
      ...ready,
      hands: { x: lerp(kx, to.x, s), y: lerp(READY_HANDS_Y, to.y, s), z },
      progress: p,
    };
  }
  const dir = plan.action === 'dive-left' ? -1 : 1;
  const lift = to.y > 1.4 ? (to.y - 1.4) * 0.45 : 0;
  let feetY = FEET_Y + lift * s;
  let handsY = lerp(READY_HANDS_Y, to.y, s);
  // After full stretch the keeper drops to the turf (gravity always wins).
  let fall = 0;
  const tEnd = plan.startAt + plan.duration + FALL_DELAY;
  if (t > tEnd) {
    fall = clamp((t - tEnd) / FALL_DURATION, 0, 1);
    const f2 = fall * fall;
    handsY = lerp(handsY, 0.3, f2);
    feetY = lerp(feetY, FEET_Y, f2);
  }
  return {
    feet: { x: kx + dir * 0.45 * s, y: feetY, z },
    hands: { x: lerp(kx, to.x, s), y: handsY, z },
    radius: lerp(READY_RADIUS, DIVE_RADIUS, s),
    arms: s < 0.15 ? ready.arms : null,
    progress: p,
    fall,
  };
}

/** Closest point on segment ab to p. */
export function closestOnSegment(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; u: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const len2 = abx * abx + aby * aby + abz * abz;
  let u = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / len2 : 0;
  u = clamp(u, 0, 1);
  return { point: { x: a.x + abx * u, y: a.y + aby * u, z: a.z + abz * u }, u };
}
