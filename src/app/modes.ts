/** Game modes. `live` ones are playable; the rest are clearly labelled as coming later. */
export interface ModePreview {
  path: string;
  live?: boolean;
  title: string;
  kicker: string;
  blurb: string;
}

export const UPCOMING_MODES: ModePreview[] = [
  {
    path: '/2008',
    live: true,
    title: '2008: The Beginning',
    kicker: '42-goal chapter',
    blurb: 'A story campaign of rising challenges. Score 42 verified goals to earn the 2008 badge.',
  },
  {
    path: '/road-to-1000',
    live: true,
    title: 'Road to 1,000',
    kicker: 'Career goals',
    blurb: 'Every verified goal counts once toward your 1,000. Milestones at 42, 100, 250, 500 and 750.',
  },
  {
    path: '/cup',
    live: true,
    title: 'Golden Cup',
    kicker: 'Weekly · 12 shots',
    blurb: 'The same 12 standardised shots for everyone each week, with a 90-second target.',
  },
  {
    path: '/leaderboard',
    live: true,
    title: 'Leaderboards',
    kicker: 'Verified only',
    blurb: 'Weekly, country and career rankings built only from server-verified results.',
  },
];
