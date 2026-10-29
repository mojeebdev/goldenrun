import type { ShotCommand } from './command';
import { validateShotCommand } from './command';
import { fnv1a, q } from './fixed';
import {
  BALL_RADIUS,
  BAR_AXIS_Y,
  DT,
  FRAME_AXIS_Z_OFFSET,
  GOAL_HALF_WIDTH,
  GOAL_HEIGHT,
  GRAVITY,
  KEEPER_LINE_OFFSET,
  MAX_STEPS,
  POST_AXIS_X,
  POST_RADIUS,
  SAMPLE_EVERY,
  STEP_HZ,
  netDepthAt,
} from './geometry';
import type { KeeperPlan, Vec3 } from './keeper';
import { closestOnSegment, keeperPose, planKeeper, readyPlan } from './keeper';
import type { Scenario } from './scenarios';
import { getScenario } from './scenarios';
import { scoreShot } from './scoring';
import type { Modifier } from './scoring';

/** Physics constants (part of the ruleset). */
export const PHYSICS = {
  /** Horizontal launch speed range (m/s), from power. */
  minSpeed: 12,
  maxSpeed: 31,
  /** Intended height at the goal line (m), from aimY. */
  minHeight: 0.12,
  maxHeight: 3.45,
  maxSlope: 0.9,
  maxYawTangent: 0.42,
  magnus: 0.24,
  spinDecayPerSecond: 0.3,
  drag: 0.0065,
  groundRestitution: 0.5,
  groundFriction: 0.9,
  rollingDecel: 2.2,
  frameRestitution: 0.6,
  parryRestitution: 0.35,
  parryDamping: 0.65,
} as const;

export type Outcome = 'goal' | 'saved' | 'post' | 'crossbar' | 'wide' | 'over' | 'short';

export interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
  /** Current side-spin factor (-1..1), for rendering rotation. */
  s: number;
}

export interface FrameEvent {
  t: number;
  kind: 'post' | 'crossbar';
  x: number;
  y: number;
  z: number;
}

export interface ShotResult {
  rulesetVersion: string;
  scenarioId: string;
  command: ShotCommand;
  outcome: Outcome;
  goal: boolean;
  /** First time the whole ball passed the goal-line plane (in or out). */
  crossing: { t: number; x: number; y: number; inside: boolean } | null;
  keeper: KeeperPlan;
  keeperContact: { t: number; kind: 'catch' | 'parry'; x: number; y: number; z: number } | null;
  woodwork: FrameEvent[];
  netImpact: { t: number; x: number; y: number; z: number } | null;
  launchSpeed: number;
  peakHeight: number;
  /** Lateral displacement (m) produced by spin by the time of the crossing. */
  curlOffset: number;
  precision: number;
  modifiers: Modifier[];
  skillPoints: number;
  tags: string[];
  /** Time the outcome becomes visually certain (s). */
  decisiveAt: number;
  duration: number;
  samples: Sample[];
}

export interface SimulateOptions {
  /** Disable the keeper (used for the aiming preview). */
  keeper?: boolean;
  /** Stop once the ball reaches the goal plane (aiming preview). */
  stopAtGoalPlane?: boolean;
}

interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  s: number;
}

export function launchState(command: ShotCommand, scenario: Scenario): Body {
  const p = command.power / 1000;
  const vh = PHYSICS.minSpeed + (PHYSICS.maxSpeed - PHYSICS.minSpeed) * p;
  const yaw = PHYSICS.maxYawTangent * (command.aimX / 1000);
  // Unit vector from the ball to the goal centre, and its right-hand normal.
  const ux0 = -scenario.ballX;
  const uz0 = scenario.distance;
  const ul = Math.sqrt(ux0 * ux0 + uz0 * uz0);
  const ux = ux0 / ul;
  const uz = uz0 / ul;
  let dx = ux + yaw * uz;
  let dz = uz - yaw * ux;
  const dl = Math.sqrt(dx * dx + dz * dz);
  dx /= dl;
  dz /= dl;
  // Elevation: the striker picks a height at the goal line; the launch angle
  // that reaches it (ignoring curl, with an approximate drag allowance) is
  // solved here, then real physics takes over.
  const target = PHYSICS.minHeight + (PHYSICS.maxHeight - PHYSICS.minHeight) * (command.aimY / 1000);
  const tFlat = scenario.distance / (dz * vh);
  const tFlight = tFlat * (1 + 0.5 * PHYSICS.drag * vh * tFlat);
  let vy = (target - BALL_RADIUS + 0.5 * GRAVITY * tFlight * tFlight) / tFlight;
  if (vy > vh * PHYSICS.maxSlope) vy = vh * PHYSICS.maxSlope;
  return {
    x: q(scenario.ballX),
    y: BALL_RADIUS,
    z: 0,
    vx: q(dx * vh),
    vy: q(vy),
    vz: q(dz * vh),
    s: q(command.spin / 1000),
  };
}

function magnusAccel(b: Body): { ax: number; az: number } {
  const h = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
  if (h < 1e-6 || b.s === 0) return { ax: 0, az: 0 };
  const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const a = PHYSICS.magnus * b.s * speed;
  return { ax: (a * b.vz) / h, az: (-a * b.vx) / h };
}

function reflect(b: Body, nx: number, ny: number, nz: number, restitution: number, damping: number): boolean {
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) return false;
  const k = (1 + restitution) * vn;
  b.vx = (b.vx - k * nx) * damping;
  b.vy = (b.vy - k * ny) * damping;
  b.vz = (b.vz - k * nz) * damping;
  return true;
}

function snap(b: Body): void {
  b.x = q(b.x);
  b.y = q(b.y);
  b.z = q(b.z);
  b.vx = q(b.vx);
  b.vy = q(b.vy);
  b.vz = q(b.vz);
  b.s = q(b.s);
}

/**
 * Authoritative, deterministic shot simulation. Pure: no clocks, no
 * randomness, no rendering. Same ruleset + scenario + command => identical
 * result on every compliant JavaScript engine (browser or Worker).
 */
export function simulateShot(command: ShotCommand, options: SimulateOptions = {}): ShotResult {
  const valid = validateShotCommand(command);
  if (!valid.ok) throw new Error(`invalid shot command: ${valid.error}`);
  const cmd = valid.command;
  const scenario = getScenario(cmd.scenarioId)!;
  const withKeeper = options.keeper !== false;
  const D = scenario.distance;
  const frameZ = D + FRAME_AXIS_Z_OFFSET;
  const keeperZ = D - KEEPER_LINE_OFFSET;
  const profile = scenario.keeper;
  const reactStep = Math.round(profile.reaction * STEP_HZ);

  const b = launchState(cmd, scenario);
  const launchSpeed = q(Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz));
  let plan: KeeperPlan = readyPlan(scenario.keeperX, keeperZ, profile.reaction);
  let keeperActive = withKeeper;
  let held = false;
  let crossing: ShotResult['crossing'] = null;
  let goal = false;
  let keeperContact: ShotResult['keeperContact'] = null;
  const woodwork: FrameEvent[] = [];
  let netImpact: ShotResult['netImpact'] = null;
  let peak = b.y;
  let curlV = 0;
  let curlX = 0;
  let curlAtCrossing = 0;
  let endStep = MAX_STEPS;
  let stopAt = MAX_STEPS;
  let slowSteps = 0;
  const samples: Sample[] = [{ t: 0, x: b.x, y: b.y, z: b.z, s: b.s }];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const t = q(step / STEP_HZ);

    if (withKeeper && step === reactStep && !held) {
      const m = magnusAccel(b);
      plan = planKeeper(profile, scenario.keeperX, keeperZ, t, b, m.ax);
    }

    if (held) {
      // Ball is in the keeper's gloves and travels with them.
      const pose = keeperPose(plan, t);
      b.x = pose.hands.x;
      b.y = Math.max(BALL_RADIUS, pose.hands.y);
      b.z = pose.hands.z - 0.12;
      b.vx = b.vy = b.vz = 0;
      b.s = 0;
    } else {
      // --- integrate (semi-implicit Euler, fixed step) ---
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
      const m = magnusAccel(b);
      const drag = PHYSICS.drag * speed;
      const onGround = b.y <= BALL_RADIUS + 1e-4 && Math.abs(b.vy) < 0.4;
      b.vx += (m.ax - drag * b.vx) * DT;
      b.vz += (m.az - drag * b.vz) * DT;
      b.vy += (-GRAVITY - drag * b.vy) * DT;
      if (onGround) {
        const h = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
        if (h > 1e-6) {
          const k = Math.max(0, h - PHYSICS.rollingDecel * DT) / h;
          b.vx *= k;
          b.vz *= k;
        }
      }
      curlV += m.ax * DT;
      curlX += curlV * DT;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      b.z += b.vz * DT;
      b.s -= b.s * PHYSICS.spinDecayPerSecond * DT;

      // --- ground ---
      if (b.y < BALL_RADIUS) {
        b.y = BALL_RADIUS;
        if (b.vy < -0.8) {
          b.vy = -b.vy * PHYSICS.groundRestitution;
          b.vx *= PHYSICS.groundFriction;
          b.vz *= PHYSICS.groundFriction;
          b.s *= 0.6;
        } else if (b.vy < 0) {
          b.vy = 0;
        }
      }

      // --- woodwork: two posts and the crossbar (cylinders) ---
      for (const sign of [-1, 1]) {
        const px = sign * POST_AXIS_X;
        const dx = b.x - px;
        const dz = b.z - frameZ;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (b.y < BAR_AXIS_Y && d < BALL_RADIUS + POST_RADIUS && d > 0) {
          const nx = dx / d;
          const nz = dz / d;
          if (reflect(b, nx, 0, nz, PHYSICS.frameRestitution, 0.92)) {
            woodwork.push({ t, kind: 'post', x: q(b.x), y: q(b.y), z: q(b.z) });
          }
          b.x = px + nx * (BALL_RADIUS + POST_RADIUS + 1e-4);
          b.z = frameZ + nz * (BALL_RADIUS + POST_RADIUS + 1e-4);
        }
      }
      if (b.x > -POST_AXIS_X && b.x < POST_AXIS_X) {
        const dy = b.y - BAR_AXIS_Y;
        const dz = b.z - frameZ;
        const d = Math.sqrt(dy * dy + dz * dz);
        if (d < BALL_RADIUS + POST_RADIUS && d > 0) {
          const ny = dy / d;
          const nz = dz / d;
          if (reflect(b, 0, ny, nz, PHYSICS.frameRestitution, 0.92)) {
            woodwork.push({ t, kind: 'crossbar', x: q(b.x), y: q(b.y), z: q(b.z) });
          }
          b.y = BAR_AXIS_Y + ny * (BALL_RADIUS + POST_RADIUS + 1e-4);
          b.z = frameZ + nz * (BALL_RADIUS + POST_RADIUS + 1e-4);
        }
      }

      // --- goalkeeper ---
      if (keeperActive && b.z > keeperZ - 1 && b.z < keeperZ + 1) {
        const pose = keeperPose(plan, t);
        const pos: Vec3 = { x: b.x, y: b.y, z: b.z };
        const capsules: [Vec3, Vec3, number][] = [[pose.feet, pose.hands, pose.radius]];
        if (pose.arms) capsules.push([pose.arms[0], pose.arms[1], 0.1]);
        for (const [a, c, r] of capsules) {
          const { point } = closestOnSegment(pos, a, c);
          const dx = pos.x - point.x;
          const dy = pos.y - point.y;
          const dz = pos.z - point.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d >= BALL_RADIUS + r) continue;
          const hx = pos.x - pose.hands.x;
          const hy = pos.y - pose.hands.y;
          const hz = pos.z - pose.hands.z;
          const nearHands = Math.sqrt(hx * hx + hy * hy + hz * hz) < 0.5;
          const ballSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
          const kind = nearHands && ballSpeed < profile.catchSpeed ? 'catch' : 'parry';
          keeperContact = { t, kind, x: q(b.x), y: q(b.y), z: q(b.z) };
          keeperActive = false;
          if (kind === 'catch') {
            held = true;
            b.vx = b.vy = b.vz = 0;
            b.s = 0;
          } else {
            let nx = 0;
            let ny = 0;
            let nz = -1;
            if (d > 1e-6) {
              nx = dx / d;
              ny = dy / d;
              nz = dz / d;
            }
            // Gloves/body always push the ball back out of the keeper's plane.
            if (nz > -0.35) {
              nz = -0.35;
              const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
              nx /= l;
              ny /= l;
              nz /= l;
            }
            reflect(b, nx, ny, nz, PHYSICS.parryRestitution, PHYSICS.parryDamping);
            b.x = point.x + nx * (BALL_RADIUS + r + 1e-3);
            b.y = Math.max(BALL_RADIUS, point.y + ny * (BALL_RADIUS + r + 1e-3));
            b.z = point.z + nz * (BALL_RADIUS + r + 1e-3);
            b.s *= 0.3;
          }
          break;
        }
      }

      // --- goal-line plane crossing ---
      if (!crossing && b.z >= D + BALL_RADIUS) {
        const inside = b.x > -GOAL_HALF_WIDTH && b.x < GOAL_HALF_WIDTH && b.y < GOAL_HEIGHT;
        crossing = { t, x: q(b.x), y: q(b.y), inside };
        curlAtCrossing = curlX;
        if (inside) {
          goal = true;
          stopAt = Math.min(stopAt, step + Math.round(1.1 * STEP_HZ));
        } else {
          stopAt = Math.min(stopAt, step + Math.round(0.7 * STEP_HZ));
        }
        if (options.stopAtGoalPlane) stopAt = step;
      }

      // --- netting ---
      if (b.z > D) {
        const depth = netDepthAt(b.y);
        const inGoalX = b.x > -GOAL_HALF_WIDTH && b.x < GOAL_HALF_WIDTH;
        if (goal) {
          let hit = false;
          if (b.z > D + depth - BALL_RADIUS) {
            b.z = D + depth - BALL_RADIUS;
            if (b.vz > 0) b.vz = -b.vz * 0.12;
            b.vx *= 0.55;
            b.vy *= 0.55;
            hit = true;
          }
          if (b.x < -GOAL_HALF_WIDTH + BALL_RADIUS || b.x > GOAL_HALF_WIDTH - BALL_RADIUS) {
            const sx = b.x < 0 ? -1 : 1;
            b.x = sx * (GOAL_HALF_WIDTH - BALL_RADIUS);
            if (b.vx * sx > 0) b.vx = -b.vx * 0.12;
            b.vz *= 0.7;
            hit = true;
          }
          if (b.y > GOAL_HEIGHT - BALL_RADIUS) {
            b.y = GOAL_HEIGHT - BALL_RADIUS;
            if (b.vy > 0) b.vy = -b.vy * 0.1;
            b.vz *= 0.7;
            hit = true;
          }
          if (hit && !netImpact) netImpact = { t, x: q(b.x), y: q(b.y), z: q(b.z) };
        } else if (b.z < D + depth + BALL_RADIUS) {
          // Outside of the goal: side netting and roof stop the ball entering.
          const ax = b.x < 0 ? -b.x : b.x;
          if (!inGoalX && ax < GOAL_HALF_WIDTH + BALL_RADIUS && b.y < GOAL_HEIGHT) {
            const sx = b.x < 0 ? -1 : 1;
            b.x = sx * (GOAL_HALF_WIDTH + BALL_RADIUS);
            if (b.vx * sx < 0) b.vx = -b.vx * 0.12;
            b.vz *= 0.6;
            if (!netImpact) netImpact = { t, x: q(b.x), y: q(b.y), z: q(b.z) };
          } else if (inGoalX && b.y < GOAL_HEIGHT + BALL_RADIUS && b.y > GOAL_HEIGHT - 0.3) {
            b.y = GOAL_HEIGHT + BALL_RADIUS;
            if (b.vy < 0) b.vy = -b.vy * 0.1;
            b.vz *= 0.6;
            if (!netImpact) netImpact = { t, x: q(b.x), y: q(b.y), z: q(b.z) };
          }
        }
      }
      if (b.y > peak) peak = b.y;
    }

    snap(b);
    if (step % SAMPLE_EVERY === 0) samples.push({ t, x: b.x, y: b.y, z: b.z, s: b.s });

    // --- termination ---
    const sp2 = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
    slowSteps = sp2 < 0.04 && b.y <= BALL_RADIUS + 1e-3 ? slowSteps + 1 : 0;
    const caughtDone = held && keeperContact !== null && t > keeperContact.t + 0.7;
    if (step >= stopAt || caughtDone || slowSteps > STEP_HZ / 4 || b.z < -4 || b.z > D + 14) {
      endStep = step;
      if (step % SAMPLE_EVERY !== 0) samples.push({ t, x: b.x, y: b.y, z: b.z, s: b.s });
      break;
    }
  }

  const duration = q(endStep / STEP_HZ);
  let outcome: Outcome;
  if (goal) outcome = 'goal';
  else if (keeperContact) outcome = 'saved';
  else if (woodwork.length > 0) outcome = woodwork[0]!.kind;
  else if (crossing) outcome = crossing.y >= GOAL_HEIGHT && crossing.x > -POST_AXIS_X - 0.5 && crossing.x < POST_AXIS_X + 0.5 ? 'over' : 'wide';
  else outcome = 'short';

  const decisiveAt = q(
    goal && crossing
      ? crossing.t
      : keeperContact
        ? keeperContact.t
        : woodwork.length > 0
          ? woodwork[0]!.t
          : crossing
            ? crossing.t
            : duration,
  );

  const curlOffset = q(crossing ? curlAtCrossing : curlX);
  const scored = scoreShot({
    goal,
    crossing,
    command: cmd,
    scenario,
    curlOffset,
    peakHeight: q(peak),
    launchSpeed,
    woodworkHits: woodwork.length,
    parried: keeperContact?.kind === 'parry',
  });

  return {
    rulesetVersion: cmd.rulesetVersion,
    scenarioId: cmd.scenarioId,
    command: cmd,
    outcome,
    goal,
    crossing,
    keeper: plan,
    keeperContact,
    woodwork,
    netImpact,
    launchSpeed,
    peakHeight: q(peak),
    curlOffset,
    precision: scored.precision,
    modifiers: scored.modifiers,
    skillPoints: scored.skillPoints,
    tags: scored.tags,
    decisiveAt,
    duration,
    samples,
  };
}

/** Stable digest of a full result, for replay/verification comparisons. */
export function resultDigest(result: ShotResult): string {
  return fnv1a(JSON.stringify(result));
}

/** Aiming preview: flight without the keeper, up to the goal plane. */
export function previewShot(command: ShotCommand): ShotResult {
  return simulateShot(command, { keeper: false, stopAtGoalPlane: true });
}

