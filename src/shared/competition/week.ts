/**
 * Golden Cup weeks: ISO-8601 weeks in UTC (Monday 00:00 → next Monday 00:00).
 * Pure integer/Date arithmetic so browser and Worker agree.
 */
const DAY = 86_400_000;
const WEEK = 7 * DAY;

export interface CupWeekWindow {
  id: string; // e.g. "2026-W44"
  startsAt: number; // ms, Monday 00:00 UTC
  endsAt: number; // ms, following Monday 00:00 UTC
}

export function weekWindow(nowMs: number): CupWeekWindow {
  const d = new Date(nowMs);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const isoDay = (d.getUTCDay() + 6) % 7; // Monday = 0
  const startsAt = dayStart - isoDay * DAY;
  // ISO week-year is the year of the Thursday in this week.
  const thursday = new Date(startsAt + 3 * DAY);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = Date.UTC(isoYear, 0, 4);
  const jan4IsoDay = (new Date(jan4).getUTCDay() + 6) % 7;
  const week1Start = jan4 - jan4IsoDay * DAY;
  const week = Math.floor((startsAt - week1Start) / WEEK) + 1;
  return { id: `${isoYear}-W${String(week).padStart(2, '0')}`, startsAt, endsAt: startsAt + WEEK };
}

export function isWeekId(id: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(id);
}
