/**
 * Behind-the-ball perspective camera. Rendering only — it never feeds back
 * into the simulation. Works in device pixels.
 */
import type { Scenario } from '../../shared/rules';

export interface Screen {
  x: number;
  y: number;
  /** Pixels per metre at this depth. */
  scale: number;
  depth: number;
}

export interface CamSpace {
  cx: number;
  cy: number;
  cz: number;
}

export const CAMERA = {
  /** Camera distance behind the ball (m). */
  back: 6.2,
  height: 2.05,
  near: 0.4,
} as const;

export class Projection {
  readonly width: number;
  readonly height: number;
  readonly camX: number;
  readonly camZ: number;
  readonly camY = CAMERA.height;
  readonly fx: number; // forward (horizontal)
  readonly fz: number;
  readonly focal: number;
  readonly horizonY: number;
  readonly centerX: number;
  readonly distance: number;
  readonly ballX: number;

  constructor(width: number, height: number, scenario: Pick<Scenario, 'distance' | 'ballX'>) {
    this.width = width;
    this.height = height;
    this.distance = scenario.distance;
    this.ballX = scenario.ballX;
    const D = scenario.distance;
    const bx = scenario.ballX;
    // Camera sits on the line from the goal centre through the ball.
    const len = Math.hypot(bx, D);
    this.camX = bx + (bx / len) * CAMERA.back;
    this.camZ = -(D / len) * CAMERA.back;
    // Look at the goal centre.
    const gx = 0 - this.camX;
    const gz = D - this.camZ;
    const gl = Math.hypot(gx, gz);
    this.fx = gx / gl;
    this.fz = gz / gl;

    const portrait = height > width;
    const goalDepth = gl;
    const ballDepth = CAMERA.back;
    const ballDrop = (CAMERA.height - 0.11) / ballDepth; // ball's offset below horizon per focal unit
    const goalFrac = portrait ? 0.84 : 0.56;
    const focalW = (width * goalFrac * goalDepth) / 7.32;
    const ballY = height * (portrait ? 0.8 : 0.86);
    const maxDrop = height * (portrait ? 0.4 : 0.54);
    const focalH = maxDrop / ballDrop;
    this.focal = Math.min(focalW, focalH);
    this.horizonY = ballY - this.focal * ballDrop;
    this.centerX = width / 2;
  }

  toCam(x: number, y: number, z: number): CamSpace {
    const rx = x - this.camX;
    const rz = z - this.camZ;
    return {
      // right vector = (fz, -fx)
      cx: rx * this.fz - rz * this.fx,
      cy: y - this.camY,
      cz: rx * this.fx + rz * this.fz,
    };
  }

  fromCam(c: CamSpace): Screen {
    const s = this.focal / c.cz;
    return { x: this.centerX + c.cx * s, y: this.horizonY - c.cy * s, scale: s, depth: c.cz };
  }

  project(x: number, y: number, z: number): Screen | null {
    const c = this.toCam(x, y, z);
    if (c.cz < CAMERA.near) return null;
    return this.fromCam(c);
  }

  /** Project a 3D polygon, clipped against the near plane. */
  projectPoly(points: readonly [number, number, number][]): Screen[] {
    const cam = points.map(([x, y, z]) => this.toCam(x, y, z));
    const out: CamSpace[] = [];
    for (let i = 0; i < cam.length; i++) {
      const a = cam[i]!;
      const b = cam[(i + 1) % cam.length]!;
      const ain = a.cz >= CAMERA.near;
      const bin = b.cz >= CAMERA.near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (CAMERA.near - a.cz) / (b.cz - a.cz);
        out.push({ cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, cz: CAMERA.near });
      }
    }
    return out.map((c) => this.fromCam(c));
  }

  /** Project a 3D segment, clipped against the near plane. */
  projectSegment(a: [number, number, number], b: [number, number, number]): [Screen, Screen] | null {
    let ca = this.toCam(...a);
    let cb = this.toCam(...b);
    if (ca.cz < CAMERA.near && cb.cz < CAMERA.near) return null;
    if (ca.cz < CAMERA.near) ca = lerpCam(ca, cb, (CAMERA.near - ca.cz) / (cb.cz - ca.cz));
    else if (cb.cz < CAMERA.near) cb = lerpCam(cb, ca, (CAMERA.near - cb.cz) / (ca.cz - cb.cz));
    return [this.fromCam(ca), this.fromCam(cb)];
  }
}

function lerpCam(a: CamSpace, b: CamSpace, t: number): CamSpace {
  return { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, cz: a.cz + (b.cz - a.cz) * t };
}
