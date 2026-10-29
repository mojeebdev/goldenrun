/** Future game modes. Shown as previews only — none are live in Milestone 1. */
export interface ModePreview {
  path: string;
  title: string;
  kicker: string;
  blurb: string;
}

export const UPCOMING_MODES: ModePreview[] = [
  {
    path: '/2008',
    title: '2008: The Beginning',
    kicker: '42-goal chapter',
    blurb: 'A story campaign of rising challenges. Score 42 verified goals to earn the 2008 badge.',
  },
  {
    path: '/road-to-1000',
    title: 'Road to 1,000',
    kicker: 'Career goals',
    blurb: 'Every verified goal counts once toward your 1,000. Milestones at 42, 100, 250, 500 and 750.',
  },
  {
    path: '/cup',
    title: 'Golden Cup',
    kicker: 'Weekly · 12 shots',
    blurb: 'The same 12 standardised shots for everyone each week, with a 90-second target.',
  },
  {
    path: '/leaderboard',
    title: 'Leaderboards',
    kicker: 'Verified only',
    blurb: 'Weekly, country and career rankings built only from server-verified results.',
  },
];
