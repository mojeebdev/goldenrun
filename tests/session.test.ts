import { describe, expect, it } from 'vitest';
import { PracticeSession, streakBonus } from '../src/game/session';
import { makeCommand, simulateShot } from '../src/shared/rules';

const GOAL_FIELDS = { aimX: 470, aimY: 640, power: 950, spin: 0 }; // top corner, rookie can't reach
const SAVE_FIELDS = { aimX: 0, aimY: 300, power: 500, spin: 0 };
const WIDE_FIELDS = { aimX: 900, aimY: 400, power: 700, spin: 0 };

describe('practice session', () => {
  it('fixtures behave as expected', () => {
    const s = new PracticeSession('rookie');
    expect(simulateShot(makeCommand(s.scenarioId, GOAL_FIELDS)).goal).toBe(true);
    expect(simulateShot(makeCommand(s.scenarioId, SAVE_FIELDS)).outcome).toBe('saved');
    expect(simulateShot(makeCommand(s.scenarioId, WIDE_FIELDS)).outcome).toBe('wide');
  });

  it('one shot yields at most one resolution and one goal', () => {
    const s = new PracticeSession('rookie');
    const shot = s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS))!;
    expect(shot).not.toBeNull();
    // A second shot while one is in flight is refused.
    expect(s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS))).toBeNull();
    expect(s.resolve(shot.shotId)).not.toBeNull();
    expect(s.resolve(shot.shotId)).toBeNull();
    expect(s.resolve(shot.shotId + 1)).toBeNull();
    expect(s.getSnapshot().stats).toMatchObject({ attempts: 1, goals: 1, streak: 1, score: 250 });
  });

  it('misses and saves never change goals or score, and break the streak', () => {
    const s = new PracticeSession('rookie');
    let shot = s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS))!;
    s.resolve(shot.shotId);
    s.next(); // a goal advances the spot
    expect(s.getSnapshot().spotIndex).toBe(1);
    s.selectSpot(0);
    const before = s.getSnapshot().stats;
    shot = s.shoot(makeCommand(s.scenarioId, WIDE_FIELDS))!;
    s.resolve(shot.shotId);
    s.next();
    const after = s.getSnapshot().stats;
    expect(after.goals).toBe(before.goals);
    expect(after.score).toBe(before.score);
    expect(after.attempts).toBe(before.attempts + 1);
    expect(after.streak).toBe(0);
    expect(s.getSnapshot().spotIndex).toBe(0); // a miss repeats the spot
  });

  it('an abandoned shot is never counted', () => {
    const s = new PracticeSession('rookie');
    const shot = s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS))!;
    s.abandon();
    expect(s.resolve(shot.shotId)).toBeNull();
    expect(s.getSnapshot().stats.attempts).toBe(0);
  });

  it('rejects commands for a different scenario and refuses level changes mid-shot', () => {
    const s = new PracticeSession('rookie');
    expect(s.shoot(makeCommand('practice.long-28.rookie', GOAL_FIELDS))).toBeNull();
    s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS));
    s.setLevel('legendary');
    expect(s.getSnapshot().level).toBe('rookie');
  });

  it('runs many consecutive shots without drift', () => {
    const s = new PracticeSession('professional');
    let goals = 0;
    for (let i = 0; i < 60; i++) {
      const fields = { aimX: ((i * 137) % 1400) - 700, aimY: (i * 211) % 1000, power: (i * 97) % 1000, spin: ((i * 53) % 2000) - 1000 };
      const shot = s.shoot(makeCommand(s.scenarioId, fields))!;
      if (shot.result.goal) goals++;
      s.resolve(shot.shotId);
      s.next();
    }
    expect(s.getSnapshot().stats.attempts).toBe(60);
    expect(s.getSnapshot().stats.goals).toBe(goals);
  });

  it('moves on after a goal when touring, and stays put on a fixed spot', () => {
    const tour = new PracticeSession('rookie');
    tour.resolve(tour.shoot(makeCommand(tour.scenarioId, GOAL_FIELDS))!.shotId);
    tour.next();
    expect(tour.getSnapshot().spotIndex).toBe(1);

    const fixed = new PracticeSession('rookie');
    fixed.setRotate(false);
    fixed.resolve(fixed.shoot(makeCommand(fixed.scenarioId, GOAL_FIELDS))!.shotId);
    fixed.next();
    expect(fixed.getSnapshot().spotIndex).toBe(0);
    expect(fixed.getSnapshot().stats.goals).toBe(1);
  });

  it('caps the provisional streak bonus', () => {
    expect([1, 2, 3, 5, 9].map(streakBonus)).toEqual([0, 25, 50, 100, 100]);
  });
});

describe('course mode (Golden Cup)', () => {
  const course = ['cup.center-18.professional', 'cup.left-20.professional', 'cup.long-28.legendary'];

  it('walks the course in order, records commands and completes once', () => {
    const s = new PracticeSession('rookie', course);
    for (let i = 0; i < course.length; i++) {
      expect(s.scenarioId).toBe(course[i]);
      const shot = s.shoot(makeCommand(s.scenarioId, WIDE_FIELDS))!;
      s.resolve(shot.shotId);
      s.next(); // a miss still advances in a course
    }
    const snap = s.getSnapshot();
    expect(snap.phase).toBe('complete');
    expect(snap.commands.map((c) => c.scenarioId)).toEqual(course);
    expect(s.shoot(makeCommand(course[2]!, WIDE_FIELDS))).toBeNull();
  });

  it('scores skill points only (no practice streak bonus) and refuses spot/level changes', () => {
    const s = new PracticeSession('rookie', course);
    for (let i = 0; i < 2; i++) {
      const shot = s.shoot(makeCommand(s.scenarioId, GOAL_FIELDS))!;
      s.resolve(shot.shotId);
      s.next();
    }
    const snap = s.getSnapshot();
    expect(snap.stats.score).toBe(snap.results.reduce((a, r) => a + r.skillPoints, 0));
    s.selectSpot(0);
    s.setLevel('legendary');
    expect(s.getSnapshot().spotIndex).toBe(2);
  });

  it('restores progress from saved commands deterministically', () => {
    const a = new PracticeSession('rookie', course);
    const cmds = course.slice(0, 2).map((id) => makeCommand(id, GOAL_FIELDS));
    a.restore(cmds);
    expect(a.getSnapshot().spotIndex).toBe(2);
    expect(a.getSnapshot().commands).toEqual(cmds);
    const b = new PracticeSession('rookie', course);
    b.restore(cmds);
    expect(b.getSnapshot().stats).toEqual(a.getSnapshot().stats);
  });
});
