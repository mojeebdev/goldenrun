import { describe, expect, it } from 'vitest';
import { gestureToCommand, pathCurvature, readGesture, referenceLength, resamplePath } from '../src/game/input/gesture';
import type { GestureFrame, Point } from '../src/game/input/gesture';
import { scenarioIdFor } from '../src/shared/rules';

const SID = scenarioIdFor('center-18', 'rookie');

/** A gesture described in normalised units (fractions of the reference length). */
function gesture(frame: GestureFrame, dx: number, dy: number, bend: number, samples: number, strike = 0): Point[] {
  const start = { x: frame.padCenter.x, y: frame.padCenter.y + strike * frame.padRadius };
  const pts: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const b = Math.sin(u * Math.PI) * bend;
    // bend is perpendicular-left of an upward chord (negative x in screen space)
    pts.push({ x: start.x + (dx * u - b) * frame.refLength, y: start.y + dy * u * frame.refLength });
  }
  return pts;
}

function frameFor(w: number, h: number): GestureFrame {
  const pad = Math.max(40, Math.min(64, Math.min(w, h) * 0.11));
  return { padCenter: { x: w / 2, y: h * 0.8 }, padRadius: pad, refLength: referenceLength(w, h) };
}

describe('gesture → command normalisation', () => {
  it('maps the same normalised intention to the same command on any screen', () => {
    const screens: [number, number][] = [
      [360, 740], // budget Android portrait
      [390, 844], // iPhone portrait
      [844, 390], // phone landscape
      [1440, 900], // laptop
      [2560, 1440], // large desktop
    ];
    const cmds = screens.map(([w, h]) => {
      const f = frameFor(w, h);
      return gestureToCommand(SID, resamplePath(gesture(f, 0.3, -0.7, 0.08, 40, 0.4), f.refLength * 0.02), f);
    });
    for (const c of cmds) {
      expect(c).not.toBeNull();
      expect(Math.abs(c!.aimX - cmds[0]!.aimX)).toBeLessThanOrEqual(1);
      expect(Math.abs(c!.power - cmds[0]!.power)).toBeLessThanOrEqual(1);
      expect(Math.abs(c!.spin - cmds[0]!.spin)).toBeLessThanOrEqual(15);
      expect(c!.aimY).toBe(cmds[0]!.aimY);
    }
  });

  it('is robust to touch sampling rate after resampling', () => {
    const f = frameFor(390, 844);
    const slow = gestureToCommand(SID, resamplePath(gesture(f, -0.2, -0.8, 0.1, 8), f.refLength * 0.02), f)!;
    const fast = gestureToCommand(SID, resamplePath(gesture(f, -0.2, -0.8, 0.1, 64), f.refLength * 0.02), f)!;
    expect(Math.abs(slow.aimX - fast.aimX)).toBeLessThanOrEqual(1);
    expect(Math.abs(slow.power - fast.power)).toBeLessThanOrEqual(1);
    expect(Math.abs(slow.spin - fast.spin)).toBeLessThan(80);
    expect(Math.sign(slow.spin)).toBe(Math.sign(fast.spin));
  });

  it('length drives power, direction drives aim, strike point drives elevation', () => {
    const f = frameFor(390, 844);
    const short = readGesture(gesture(f, 0, -0.4, 0, 10), f).params;
    const long = readGesture(gesture(f, 0, -0.95, 0, 10), f).params;
    expect(long.power).toBeGreaterThan(short.power);
    const left = readGesture(gesture(f, -0.4, -0.7, 0, 10), f).params;
    const right = readGesture(gesture(f, 0.4, -0.7, 0, 10), f).params;
    expect(left.aimX).toBeLessThan(0);
    expect(right.aimX).toBeGreaterThan(0);
    const lofted = readGesture(gesture(f, 0, -0.7, 0, 10, 0.9), f).params;
    const driven = readGesture(gesture(f, 0, -0.7, 0, 10, -0.9), f).params;
    expect(lofted.aimY).toBeGreaterThan(driven.aimY);
  });

  it('curving the drag applies spin in the bend direction; straight drags add none', () => {
    const f = frameFor(390, 844);
    const straight = readGesture(gesture(f, 0.1, -0.8, 0, 30), f).params;
    expect(straight.spin).toBe(0);
    const bowLeft = gesture(f, 0, -0.8, 0.12, 30);
    expect(pathCurvature(bowLeft)).toBeGreaterThan(0);
    expect(readGesture(bowLeft, f).params.spin).toBeGreaterThan(300);
    expect(readGesture(gesture(f, 0, -0.8, -0.12, 30), f).params.spin).toBeLessThan(-300);
  });

  it('cancels tiny or backward drags', () => {
    const f = frameFor(390, 844);
    expect(readGesture(gesture(f, 0, -0.05, 0, 5), f).cancel).toBe(true);
    expect(readGesture(gesture(f, 0, 0.5, 0, 5), f).cancel).toBe(true);
    expect(gestureToCommand(SID, [], f)).toBeNull();
  });
});
