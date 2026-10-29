import { describe, expect, it } from 'vitest';
import { nextStep } from '../src/app/lib/nextStep';
import type { Progress } from '../src/shared/competition/api';

function progress(stageGoals: number[], badge = false, careerGoals = 0): Progress {
  return {
    player: { handle: 'Tester' },
    careerGoals,
    tier: 'Academy',
    nextMilestone: 42,
    awards: [],
    chapter: {
      stages: stageGoals.map((goals, i) => ({ stage: i + 1, goals, unlocked: i === 0 || stageGoals[i - 1]! >= 7 })),
      total: stageGoals.reduce((a, b) => a + Math.min(b, 7), 0),
      badge,
    },
    founding: { state: 'open', handle: null, country: null, awardedAt: null },
  };
}

describe('next step for a player', () => {
  it('starts a new player on 2008 matchday 1', () => {
    expect(nextStep(progress([0, 0, 0, 0, 0, 0]))).toMatchObject({ to: '/2008', label: 'Start 2008' });
    expect(nextStep(null)).toMatchObject({ to: '/2008' });
  });

  it('continues at the first unlocked matchday still short of its quota', () => {
    const s = nextStep(progress([7, 3, 0, 0, 0, 0]));
    expect(s).toMatchObject({ to: '/2008', label: 'Continue 2008' });
    expect(s.detail).toContain('Matchday 2');
    expect(s.detail).toContain('10/42');
  });

  it('sends a player with the 2008 badge to the Road to 1,000', () => {
    const s = nextStep(progress([7, 7, 7, 7, 7, 7], true, 120));
    expect(s.to).toBe('/road-to-1000');
    expect(s.detail).toContain('120 career goals');
  });
});
