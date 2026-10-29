/**
 * Local shooting session: free practice, or a fixed course (the Golden Cup's
 * 12 shots). Framework-agnostic so it can be tested without a browser.
 * Guarantees: one shot → at most one resolution, and the numbers come from
 * the authoritative ShotResult, never from animation. In course mode the
 * session records each command, which is all a ranked submission contains.
 */
import type { KeeperLevel, Scenario, ShotCommand, ShotResult } from '../shared/rules';
import { PRACTICE_SPOTS, getScenario, scenarioIdFor, simulateShot } from '../shared/rules';

export type Phase = 'ready' | 'aiming' | 'flight' | 'resolution' | 'complete';

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
  /** Course mode only: commands of resolved shots, in order. */
  commands: ShotCommand[];
  /** Course mode only: authoritative results of resolved shots, in order. */
  results: ShotResult[];
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
  private pending: { shotId: number; result: ShotResult; command: ShotCommand } | null = null;
  private resolved = new Set<number>();
  readonly course: readonly string[] | null;

  constructor(level: KeeperLevel = 'rookie', course: readonly string[] | null = null) {
    this.course = course && course.length ? course : null;
    this.snapshot = { phase: 'ready', level, spotIndex: 0, stats: { ...EMPTY_STATS }, last: null, commands: [], results: [] };
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
    if (this.course) return this.course[Math.min(this.snapshot.spotIndex, this.course.length - 1)]!;
    return scenarioIdFor(PRACTICE_SPOTS[this.snapshot.spotIndex]!.id, this.snapshot.level);
  }

  get scenario(): Scenario {
    return getScenario(this.scenarioId)!;
  }

  setPhase(phase: Phase): void {
    if (this.snapshot.phase !== phase) this.set({ phase });
  }

  setLevel(level: KeeperLevel): void {
    if (this.pending || this.course) return; // never change rules mid-shot or mid-course
    this.set({ level });
  }

  /** Begin a shot. Returns null if a shot is already in flight. */
  shoot(command: ShotCommand): { shotId: number; result: ShotResult } | null {
    const phase = this.snapshot.phase;
    if (this.pending || phase === 'flight' || phase === 'resolution' || phase === 'complete') return null;
    if (command.scenarioId !== this.scenarioId) return null;
    const result = simulateShot(command);
    const shot = { shotId: this.nextId++, result, command };
    this.pending = shot;
    this.set({ phase: 'flight' });
    return shot;
  }

  /** Commit the outcome exactly once. Repeated calls are ignored. */
  resolve(shotId: number): ResolvedShot | null {
    if (!this.pending || this.pending.shotId !== shotId || this.resolved.has(shotId)) return null;
    this.resolved.add(shotId);
    const { result, command } = this.pending;
    const s = this.snapshot.stats;
    const streak = result.goal ? s.streak + 1 : 0;
    // Courses score skill points only, exactly as the Worker will.
    const bonus = result.goal && !this.course ? streakBonus(streak) : 0;
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
    const commands = this.course ? [...this.snapshot.commands, command] : this.snapshot.commands;
    const results = this.course ? [...this.snapshot.results, result] : this.snapshot.results;
    this.set({ stats, last, phase: 'resolution', commands, results });
    return last;
  }

  /** Ready the next ball. Practice: a goal advances the spot. Course: always advance. */
  next(): void {
    if (this.course) {
      const wasPending = !!this.pending;
      this.pending = null;
      const index = this.snapshot.spotIndex + (wasPending ? 1 : 0);
      this.set({ phase: index >= this.course.length ? 'complete' : 'ready', spotIndex: Math.min(index, this.course.length) });
      return;
    }
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

  /** Course mode: replay already-taken shots (resume after a reload). */
  restore(commands: readonly ShotCommand[]): void {
    if (!this.course) return;
    for (const c of commands) {
      const shot = this.shoot(c);
      if (!shot) break;
      this.resolve(shot.shotId);
      this.next();
    }
  }

  selectSpot(index: number): void {
    if (this.pending || this.course) return;
    this.set({ spotIndex: ((index % PRACTICE_SPOTS.length) + PRACTICE_SPOTS.length) % PRACTICE_SPOTS.length });
  }

  reset(): void {
    this.pending = null;
    this.set({ phase: 'ready', spotIndex: 0, stats: { ...EMPTY_STATS }, last: null, commands: [], results: [] });
  }

  get inFlight(): { shotId: number; result: ShotResult } | null {
    return this.pending;
  }
}
