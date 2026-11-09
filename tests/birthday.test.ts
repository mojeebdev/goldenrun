import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { BirthdayGoal } from '../src/shared/birthday';
import {
  allDates, birthdayUrl, buildResponse, groupMatches, haulLabel, isBirthdayHost, nearestDates, parseBirthday, shareText,
} from '../src/shared/birthday';
import { birthdaySegment, canonicalRedirect, isBirthdayPath } from '../src/worker/birthday';

const data = JSON.parse(readFileSync('data/birthday/goals.json', 'utf8')) as { total: number; updated: string; goals: BirthdayGoal[] };
const byKey = new Map<string, BirthdayGoal[]>();
for (const g of data.goals) byKey.set(g.date.slice(5), [...(byKey.get(g.date.slice(5)) ?? []), g]);
const career = { total: data.total, updated: data.updated };
const responseFor = (slug: string) => {
  const ref = parseBirthday(slug)!;
  return buildResponse(ref, byKey.get(ref.key) ?? [], byKey.keys(), career);
};

describe('birthday dates', () => {
  it('parses every accepted spelling to one canonical slug', () => {
    for (const input of ['aug-2', 'AUG-2', 'august-2', '08-02', '8-2', '/aug-2/']) {
      expect(parseBirthday(input)).toEqual({ key: '08-02', slug: 'aug-2', label: 'August 2' });
    }
    expect(parseBirthday('sept-9')?.slug).toBe('sep-9');
    expect(parseBirthday('feb-29')?.key).toBe('02-29');
  });

  it('rejects impossible dates and junk', () => {
    for (const bad of ['feb-30', 'apr-31', '13-01', '00-10', 'aug-0', 'augu-2', 'favicon.svg', '', 'aug-2-2014']) {
      expect(parseBirthday(bad)).toBeNull();
    }
  });

  it('covers all 366 calendar days', () => {
    const dates = allDates();
    expect(dates).toHaveLength(366);
    expect(new Set(dates.map((d) => d.slug)).size).toBe(366);
  });

  it('finds the nearest scoring dates either side, wrapping the year', () => {
    const near = nearestDates('08-02', byKey.keys());
    expect(near?.before.slug).toBe('jul-31');
    expect(near?.after.slug).toBe('aug-3');
    expect(nearestDates('01-01', ['12-30', '01-03'])).toMatchObject({ before: { key: '12-30' }, after: { key: '01-03' } });
  });
});

describe('birthday dataset', () => {
  it('holds every official career goal exactly once, in order', () => {
    expect(data.goals).toHaveLength(data.total);
    expect(data.total).toBe(985);
    expect(data.goals.map((g) => g.no)).toEqual(data.goals.map((_, i) => i + 1));
    expect(data.goals.filter((g) => g.team === 'Portugal')).toHaveLength(146);
    expect(data.goals[0]).toMatchObject({ date: '2002-10-07', team: 'Sporting CP', opponent: 'Moreirense' });
  });

  it('has a valid date, score, competition and stadium on every goal', () => {
    for (const g of data.goals) {
      expect(parseBirthday(g.date.slice(5)), g.date).not.toBeNull();
      expect(g.teamScore).toBeGreaterThan(0);
      expect(g.competition.length).toBeGreaterThan(2);
      expect(g.stadium, `${g.date} ${g.opponent}`).toBeTruthy();
      expect(g.opponent).not.toMatch(/Ã|Â/); // no mojibake from the source CSV
    }
  });

  it('answers the launch example honestly: no official goal on August 2', () => {
    const r = responseFor('aug-2');
    expect(r.total).toBe(0);
    expect(r.nearest?.before.label).toBe('July 31');
  });

  it('groups a hat-trick into one match', () => {
    const r = responseFor('may-2');
    const atleti = r.matches.find((m) => m.year === 2017)!;
    expect(atleti).toMatchObject({ team: 'Real Madrid', opponent: 'Atlético Madrid', teamScore: 3, oppScore: 0 });
    expect(atleti.goals).toHaveLength(3);
    expect(haulLabel(atleti.goals.length)).toBe('Hat-trick');
  });

  it('uses the real full-time score for shoot-out matches', () => {
    const r = responseFor('may-21');
    expect(r.matches.find((m) => m.year === 2008)).toMatchObject({ opponent: 'Chelsea', teamScore: 1, oppScore: 1, stadium: 'Luzhniki Stadium, Moscow' });
  });
});

describe('sharing', () => {
  it('keeps every tweet inside X limits with room for the link', () => {
    for (const ref of allDates()) {
      const text = shareText(responseFor(ref.slug));
      expect(text.length + 1 + 23, ref.slug).toBeLessThanOrEqual(280);
    }
  });

  it('never claims 1,000 goals before he gets there', () => {
    expect(shareText(responseFor('aug-2'))).toContain('985 official goals');
    expect(shareText(responseFor('may-2'))).toContain('a hat-trick vs Atlético Madrid in 2017');
  });

  it('builds canonical subdomain URLs', () => {
    expect(birthdayUrl('aug-2')).toBe('https://birthday.goldenrun.fun/aug-2');
  });

  it('groups goals without inventing matches', () => {
    expect(groupMatches([])).toEqual([]);
  });
});

describe('birthday routing', () => {
  it('recognises the subdomain', () => {
    expect(isBirthdayHost('birthday.goldenrun.fun')).toBe(true);
    expect(isBirthdayHost('birthday.localhost')).toBe(true);
    expect(isBirthdayHost('goldenrun.fun')).toBe(false);
  });

  it('extracts the date segment on either host', () => {
    expect(birthdaySegment('/', true)).toBe('');
    expect(birthdaySegment('/aug-2', true)).toBe('aug-2');
    expect(birthdaySegment('/birthday', false)).toBe('');
    expect(birthdaySegment('/birthday/aug-2/', false)).toBe('aug-2');
    expect(birthdaySegment('/a/b', true)).toBeNull();
    expect(isBirthdayPath('/birthday/aug-2')).toBe(true);
    expect(isBirthdayPath('/birthdays')).toBe(false);
  });

  it('sends goldenrun.fun/birthday to the subdomain', () => {
    const res = canonicalRedirect(new URL('https://goldenrun.fun/birthday/aug-2?ref=x'));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('https://birthday.goldenrun.fun/aug-2?ref=x');
  });
});
