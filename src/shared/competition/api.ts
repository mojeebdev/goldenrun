/** JSON shapes exchanged between the SPA and the Worker (API v1). */

export interface ApiError {
  error: string;
  message: string;
}

export interface PublicPlayer {
  handle: string;
  country: string | null;
}

export interface CupInfo {
  weekId: string;
  startsAt: number;
  endsAt: number;
  rulesetVersion: string;
  scenarioIds: string[];
  scenarioSetHash: string;
  targetSeconds: number;
  graceSeconds: number;
  maxScore: number;
  status: 'open' | 'closed' | 'finalized';
}

export interface Bootstrap {
  rulesetVersion: string;
  serverNow: number;
  cup: CupInfo;
  player: { handle: string } | null;
}

export type RunState = 'started' | 'accepted' | 'pending_review' | 'rejected' | 'expired';

export interface RunShotSummary {
  idx: number;
  scenarioId: string;
  outcome: string;
  goal: boolean;
  skillPoints: number;
}

export interface RunSummary {
  runId: string;
  mode: 'cup' | 'chapter' | 'road';
  stage: number | null;
  weekId: string | null;
  ranked: boolean;
  state: RunState;
  startedAt: number;
  deadlineAt: number;
  submittedAt: number | null;
  skillScore: number | null;
  goals: number | null;
  precisionTotal: number | null;
  misses: number | null;
  shots?: RunShotSummary[];
  rank?: number | null;
  /** Career goals this run added to the ledger. */
  creditedGoals?: number;
}

export interface StartedRun {
  runId: string;
  nonce: string;
  mode: 'cup' | 'chapter' | 'road';
  stage: number | null;
  weekId: string | null;
  rulesetVersion: string;
  scenarioIds: string[];
  scenarioSetHash: string;
  startedAt: number;
  targetEndsAt: number;
  deadlineAt: number;
  serverNow: number;
}

export interface Me {
  player: { id: string; handle: string; country: string | null; visibility: 'public' | 'private'; createdAt: number };
  careerGoals: number;
  passkeys: { id: string; createdAt: number; lastUsedAt: number | null; deviceType: string | null; backedUp: boolean }[];
  recoveryCodesRemaining: number;
  cupEntry: RunSummary | null;
}

export interface LeaderboardRow {
  rank: number;
  handle: string | null; // null for private/deleted players
  country: string | null;
  score: number; // skill score (weekly) or goals (career)
  goals: number;
  precisionTotal?: number;
  misses?: number;
}

export interface Leaderboard {
  kind: 'weekly' | 'country' | 'career';
  weekId: string | null;
  country: string | null;
  rulesetVersion: string;
  generatedAt: number;
  offset: number;
  limit: number;
  total: number;
  rows: LeaderboardRow[];
}

export interface HallOfFameEntry {
  weekId: string;
  handle: string | null;
  country: string | null;
  score: number;
  reviewState: 'provisional' | 'confirmed' | 'revoked';
}

export interface AwardView {
  type: string;
  label: string;
  reviewState: 'provisional' | 'confirmed' | 'revoked';
  awardedAt: number;
}

export interface Progress {
  player: { handle: string } | null;
  careerGoals: number;
  tier: string;
  nextMilestone: number | null;
  awards: AwardView[];
  chapter: { stages: { stage: number; goals: number; unlocked: boolean }[]; total: number; badge: boolean };
  founding: { state: 'open' | 'provisional' | 'confirmed'; handle: string | null; country: string | null; awardedAt: number | null };
}

export interface Challenge {
  runId: string;
  weekId: string;
  handle: string | null;
  country: string | null;
  score: number;
  goals: number;
  rank: number | null;
  scenarioIds: string[];
  weekIsCurrent: boolean;
}

export interface PlayerProfile {
  handle: string;
  country: string | null;
  joinedAt: number;
  careerGoals: number;
  awards: AwardView[];
  cupResults: { weekId: string; score: number; goals: number; rank: number | null }[];
}
