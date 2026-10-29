/**
 * Run clock shown in the HUD. Display only: the server's deadline is what
 * counts, so the clock is computed from the server-issued times plus the
 * measured clock offset, never from when the stadium finished loading.
 */
export interface RunTimer {
  /** When the shooting time on the clock runs out (server ms). */
  targetEndsAt: number;
  /** When the server stops accepting the run (server ms). */
  deadlineAt: number;
  /** serverNow − clientNow, measured at bootstrap. */
  clockOffset: number;
}

export type ClockState =
  | { kind: 'time'; seconds: number; urgent: boolean }
  | { kind: 'extra'; seconds: number }
  | { kind: 'closed' };

/** Seconds left at which the clock turns red and warns the player. */
export const URGENT_SECONDS = 30;

export function clockState(timer: RunTimer, clientNow: number): ClockState {
  const serverNow = clientNow + timer.clockOffset;
  const left = Math.ceil((timer.targetEndsAt - serverNow) / 1000);
  if (left > 0) return { kind: 'time', seconds: left, urgent: left <= URGENT_SECONDS };
  const extra = Math.ceil((timer.deadlineAt - serverNow) / 1000);
  if (extra > 0) return { kind: 'extra', seconds: extra };
  return { kind: 'closed' };
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
