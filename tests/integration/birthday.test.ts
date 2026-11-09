import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { BirthdayResponse } from '../../src/shared/birthday';
import { resetBirthdayCache } from '../../src/worker/api/birthday';
import { handleApi } from '../../src/worker/index';
import type { Env } from '../../src/worker/env';
import { startHarness } from './harness';

let env: Env;
let dispose: () => Promise<void>;

beforeAll(async () => {
  resetBirthdayCache();
  ({ env, dispose } = await startHarness()); // all migrations, including the 0003 seed
});
afterAll(async () => dispose());

const get = async (path: string) => {
  const res = await handleApi(new Request(`http://localhost${path}`), env, Date.parse('2026-11-09T12:00:00Z'));
  return { status: res.status, headers: res.headers, body: (await res.json()) as BirthdayResponse & { error?: string } };
};

describe('GET /api/v1/birthday/:mmdd', () => {
  it('returns every goal on a date grouped by match, from D1', async () => {
    const { status, body, headers } = await get('/api/v1/birthday/08-12');
    expect(status).toBe(200);
    expect(headers.get('cache-control')).toContain('public');
    expect(body).toMatchObject({ key: '08-12', slug: 'aug-12', label: 'August 12', total: 4, nearest: null });
    expect(body.matches.map((m) => [m.year, m.team, m.opponent, m.goals.length])).toEqual([
      [2014, 'Real Madrid', 'Sevilla', 2],
      [2023, 'Al Nassr', 'Al-Hilal', 2],
    ]);
    expect(body.matches[1]).toMatchObject({ stadium: 'King Fahd Stadium, Taif', competition: 'Arab Club Champions Cup · Final', teamScore: 2, oppScore: 1 });
    expect(body.career.total).toBe(985);
  });

  it('answers an empty date with the nearest scoring dates', async () => {
    const { status, body } = await get('/api/v1/birthday/08-02');
    expect(status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.matches).toEqual([]);
    expect(body.nearest).toMatchObject({ before: { slug: 'jul-31' }, after: { slug: 'aug-3' } });
  });

  it('rejects dates that do not exist', async () => {
    expect((await get('/api/v1/birthday/02-30')).status).toBe(404);
    expect((await get('/api/v1/birthday/13-01')).status).toBe(404);
  });

  it('agrees with the seed file total', async () => {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT month_day) AS days FROM cr7_goals').first<{ n: number; days: number }>();
    expect(row).toEqual({ n: 985, days: 288 });
  });
});
