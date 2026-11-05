/**
 * The No. 7 fan tribute is deliberately unranked: everyone receives the same
 * seven shots, can play without an account, and may share a *claimed* score.
 * Never merge this with the server-verified Cup or career goal ledger.
 */
export const TRIBUTE_COURSE: string[] = [
  'cup.center-18.rookie',
  'cup.left-20.rookie',
  'cup.right-19.professional',
  'cup.arc-23.professional',
  'cup.center-18.professional',
  'cup.long-28.professional',
  'cup.long-28.legendary',
];

export interface TributeTarget {
  score: number;
  goals: number;
}

export function readTributeTarget(search: URLSearchParams): TributeTarget | null {
  const rawScore = search.get('beat');
  const rawGoals = search.get('goals');
  if (rawScore === null || rawGoals === null) return null;
  // Shared practice claims can be edited; validation is for UX, not authority.
  if (!/^\d{1,5}$/.test(rawScore) || !/^[0-7]$/.test(rawGoals)) return null;
  const score = Number(rawScore);
  const goals = Number(rawGoals);
  if (score > 10_000) return null;
  return { score, goals };
}

export function tributeShareUrl(target: TributeTarget): string {
  const params = new URLSearchParams({
    beat: String(Math.max(0, Math.round(target.score))),
    goals: String(Math.max(0, Math.min(7, Math.round(target.goals)))),
  });
  return `https://goldenrun.fun/legacy?${params.toString()}`;
}

export function tributeShareText(target: TributeTarget): string {
  return `I scored ${target.goals}/7 goals (${target.score.toLocaleString('en-US')} points) in The Golden Run's No. 7 Tribute. Seven shots. Same keeper challenges. Can you beat me? #CR7 #GoldenRun`;
}
