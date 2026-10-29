/**
 * Local, unranked practice session. Framework-agnostic so it can be tested
 * without a browser. Guarantees: one shot → at most one resolution, and the
 * numbers come from the authoritative ShotResult, never from animation.
 */
import type { KeeperLevel, ShotCommand, ShotResult } from '../shared/rules';
import { PRACTICE_SPOTS, scenarioIdFor, simulateShot } from '../shared/rules';

export type Phase = 'ready' | 'aiming' | 'flight' | 'resolution';

export interface PracticeStats {
  attempts: number;
  goals: number;
  streak: number;
  bestStreak: number;
  score: number;
  saves: number;
  woodwork: number;
}

export interface ResolvedShot {
  shotId: number;
  result: ShotResult;
  streakBonus: number;
  points: number;
}

export interface SessionSnapshot {
  phase: Phase;
  level: KeeperLevel;
  spotIndex: number;
  stats: PracticeStats;
  last: ResolvedShot | null;
}

/** Provisional practice streak bonus (+25 per consecutive goal after the first, max +100). Not a ranked rule. */
export function streakBonus(streak: number): number {
  return Math.min(Math.max(streak - 1, 0) * 25, 100);
}

const EMPTY_STATS: PracticeStats = { attempts: 0, goals: 0, streak: 0, bestStreak: 0, score: 0, saves: 0, woodwork: 0 };

export class PracticeSession {
  private snapshot: SessionSnapshot;
  private listeners = new Set<() => void>();
  private nextId = 1;
  private pending: { shotId: number; result: ShotResult } | null = null;
  private resolved = new Set<number>();

  constructor(level: KeeperLevel = 'rookie') {
    this.snapshot = { phase: 'ready', level, spotIndex: 0, stats: { ...EMPTY_STATS }, last: null };
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SessionSnapshot => this.snapshot;

  private set(patch: Partial<SessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const fn of this.listeners) fn();
  }

  get scenarioId(): string {
    return scenarioIdFor(PRACTICE_SPOTS[this.snapshot.spotIndex]!.id, this.snapshot.level);
  }

  get spot() {
    return PRACTICE_SPOTS[this.snapshot.spotIndex]!;
  }

  setPhase(phase: Phase): void {
    if (this.snapshot.phase !== phase) this.set({ phase });
  }

  setLevel(level: KeeperLevel): void {
    if (this.pending) return; // never change rules mid-shot
    this.set({ level });
  }

  /** Begin a shot. Returns null if a shot is already in flight. */
  shoot(command: ShotCommand): { shotId: number; result: ShotResult } | null {
    if (this.pending || this.snapshot.phase === 'flight' || this.snapshot.phase === 'resolution') return null;
    if (command.scenarioId !== this.scenarioId) return null;
    const result = simulateShot(command);
    const shot = { shotId: this.nextId++, result };
    this.pending = shot;
    this.set({ phase: 'flight' });
    return shot;
  }

  /** Commit the outcome exactly once. Repeated calls are ignored. */
  resolve(shotId: number): ResolvedShot | null {
    if (!this.pending || this.pending.shotId !== shotId || this.resolved.has(shotId)) return null;
    this.resolved.add(shotId);
    const { result } = this.pending;
    const s = this.snapshot.stats;
    const streak = result.goal ? s.streak + 1 : 0;
    const bonus = result.goal ? streakBonus(streak) : 0;
    const points = result.skillPoints + bonus;
    const stats: PracticeStats = {
      attempts: s.attempts + 1,
      goals: s.goals + (result.goal ? 1 : 0),
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      score: s.score + points,
      saves: s.saves + (result.outcome === 'saved' ? 1 : 0),
      woodwork: s.woodwork + (result.woodwork.length > 0 ? 1 : 0),
    };
    const last: ResolvedShot = { shotId, result, streakBonus: bonus, points };
    this.set({ stats, last, phase: 'resolution' });
    return last;
  }

  /** Ready the next ball. A goal advances to the next practice spot. */
  next(): void {
    const advance = this.snapshot.last?.result.goal && this.pending ? 1 : 0;
    this.pending = null;
    this.set({
      phase: 'ready',
      spotIndex: (this.snapshot.spotIndex + advance) % PRACTICE_SPOTS.length,
    });
  }

  /** Abandon an in-flight shot (tab hidden, restart). Unresolved shots never count. */
  abandon(): void {
    this.pending = null;
    this.set({ phase: 'ready' });
  }

  selectSpot(index: number): void {
    if (this.pending) return;
    this.set({ spotIndex: ((index % PRACTICE_SPOTS.length) + PRACTICE_SPOTS.length) % PRACTICE_SPOTS.length });
  }

  reset(): void {
    this.pending = null;
    this.set({ phase: 'ready', spotIndex: 0, stats: { ...EMPTY_STATS }, last: null });
  }

  get inFlight(): { shotId: number; result: ShotResult } | null {
    return this.pending;
  }
}
