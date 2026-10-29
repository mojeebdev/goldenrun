/**
 * Who makes The Golden Run: one source for the creator, the studio, the
 * support contact and the copyright line, shared by the app (footer, About,
 * legal pages) and the Worker (server-rendered metadata and JSON-LD).
 */

export const SITE = {
  name: 'The Golden Run',
  url: 'https://goldenrun.fun',
  description:
    'The Golden Run is an independent, unofficial football arcade game for the web. Drag, curl and strike past a goalkeeper, play the 2008 story chapter, chase 1,000 verified career goals and compete in the weekly Golden Cup.',
  supportEmail: 'mojeeb@blindspotlab.xyz',
  image: 'https://goldenrun.fun/og.png',
} as const;

export const CREATOR = {
  name: 'Mojeeb Titilayo',
  jobTitle: 'Product Engineer & Strategist',
  url: 'https://mojeeb.xyz',
  x: 'https://x.com/MojeebMotion',
  xHandle: '@MojeebMotion',
  github: 'https://github.com/mojeebdev',
  /** Self-hosted copy of the official founder portrait published on blindspotlab.xyz. */
  portrait: '/media/mojeeb-titilayo-720.jpg',
  /** Same @id as the Person on mojeeb.xyz, so every site describes one entity. */
  id: 'https://mojeeb.xyz/#person',
} as const;

export const STUDIO = {
  name: 'BlindspotLab Limited',
  shortName: 'BlindspotLab',
  url: 'https://blindspotlab.xyz',
  /** Same @id as the Organization on blindspotlab.xyz. */
  id: 'https://blindspotlab.xyz/#organization',
} as const;

export const COPYRIGHT_YEAR = 2026;
export const COPYRIGHT = `© ${COPYRIGHT_YEAR} ${STUDIO.name}. All rights reserved.`;
