/**
 * The one thing a signed-in player should do next, shown as the home page's
 * main button and on the modes hub. Pure so it can be tested without a browser.
 */
import type { Progress } from '../../shared/competition/api';
import { CHAPTER_2008, CHAPTER_QUOTA } from '../../shared/competition/progression';

export interface NextStep {
  to: string;
  label: string;
  detail: string;
}

export function nextStep(progress: Progress | null): NextStep {
  if (!progress?.player) {
    return { to: '/2008', label: 'Start 2008', detail: 'Matchday 1 · The Debut' };
  }
  if (!progress.chapter.badge) {
    const stage = progress.chapter.stages.find((s) => s.unlocked && s.goals < CHAPTER_QUOTA) ?? progress.chapter.stages.find((s) => s.unlocked);
    const meta = CHAPTER_2008.find((c) => c.stage === stage?.stage) ?? CHAPTER_2008[0]!;
    return {
      to: '/2008',
      label: progress.chapter.total === 0 ? 'Start 2008' : 'Continue 2008',
      detail: `Matchday ${meta.stage} · ${meta.title} · ${progress.chapter.total}/42 goals`,
    };
  }
  return {
    to: '/road-to-1000',
    label: 'Road to 1,000',
    detail: `${progress.careerGoals.toLocaleString('en-US')} career goals${progress.nextMilestone ? ` · next badge at ${progress.nextMilestone}` : ''}`,
  };
}
