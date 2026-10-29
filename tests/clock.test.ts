import { describe, expect, it } from 'vitest';
import { clockState, formatClock } from '../src/game/clock';
import { CUP } from '../src/shared/competition/cup';
import { ROAD } from '../src/shared/competition/progression';

const start = 1_000_000;
const timer = {
  targetEndsAt: start + CUP.targetSeconds * 1000,
  deadlineAt: start + (CUP.targetSeconds + CUP.graceSeconds) * 1000,
  clockOffset: 0,
};

describe('run clock', () => {
  it('counts the shooting time down, then extra time, then closes', () => {
    expect(clockState(timer, start)).toEqual({ kind: 'time', seconds: 240, urgent: false });
    expect(clockState(timer, start + 210_000)).toEqual({ kind: 'time', seconds: 30, urgent: true });
    expect(clockState(timer, start + 239_001)).toEqual({ kind: 'time', seconds: 1, urgent: true });
    expect(clockState(timer, start + 240_000)).toEqual({ kind: 'extra', seconds: 30 });
    expect(clockState(timer, start + 269_999)).toEqual({ kind: 'extra', seconds: 1 });
    expect(clockState(timer, start + 270_000)).toEqual({ kind: 'closed' });
  });

  it('follows the server clock, not the device clock', () => {
    // Device clock 5 s behind the server: 5 s less on the clock.
    expect(clockState({ ...timer, clockOffset: 5000 }, start)).toEqual({ kind: 'time', seconds: 235, urgent: false });
  });

  it('formats minutes and seconds', () => {
    expect(formatClock(240)).toBe('4:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(9)).toBe('0:09');
  });

  it('leaves a realistic phone pace well inside the window', () => {
    // A shot's own animation is 3-4 s; budget 12 s of aiming per shot on a phone.
    const pace = 16;
    expect(CUP.shots * pace).toBeLessThanOrEqual(CUP.targetSeconds);
    expect(ROAD.shots * pace).toBeLessThanOrEqual(ROAD.targetSeconds);
  });
});
