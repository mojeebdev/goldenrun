import { describe, expect, it } from 'vitest';
import { getScenario } from '../src/shared/rules';
import { readTributeTarget, TRIBUTE_COURSE, tributeShareText, tributeShareUrl } from '../src/shared/tribute';

describe('No. 7 tribute', () => {
  it('is a stable, seven-shot course using only supported scenarios', () => {
    expect(TRIBUTE_COURSE).toHaveLength(7);
    expect(new Set(TRIBUTE_COURSE).size).toBe(7);
    for (const id of TRIBUTE_COURSE) expect(getScenario(id)).not.toBeNull();
  });

  it('round-trips a fan challenge without implying server verification', () => {
    const url = new URL(tributeShareUrl({ score: 1750, goals: 5 }));
    expect(url.pathname).toBe('/legacy');
    expect(readTributeTarget(url.searchParams)).toEqual({ score: 1750, goals: 5 });
    expect(tributeShareText({ score: 1750, goals: 5 })).toContain('5/7');
  });

  it('rejects invalid or exaggerated shared-score parameters', () => {
    for (const query of ['beat=-1&goals=2', 'beat=99999&goals=3', 'beat=100&goals=8', 'beat=nan&goals=0', 'beat=12.5&goals=2', 'beat=1']) {
      expect(readTributeTarget(new URLSearchParams(query))).toBeNull();
    }
  });
});
