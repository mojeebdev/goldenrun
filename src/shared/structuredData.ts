/**
 * schema.org JSON-LD for the pages crawlers should understand: the homepage
 * and /about. One connected @graph per page, with stable @ids shared across
 * pages (and with mojeeb.xyz and blindspotlab.xyz), so the game, its creator
 * and its publisher resolve to the same three entities everywhere.
 *
 * Football figures that inspired the story appear only as `mentions` of the
 * About page, never as creator, publisher, sponsor or sameAs.
 */
import { CODE_LICENSE, COPYRIGHT_YEAR, CREATOR, SITE, STUDIO } from './site';

export type StructuredPage = 'home' | 'about';

export const IDS = {
  website: `${SITE.url}/#website`,
  game: `${SITE.url}/#game`,
  home: `${SITE.url}/#webpage`,
  about: `${SITE.url}/about#webpage`,
  portrait: `${SITE.url}/about#portrait`,
  person: CREATOR.id,
  organization: STUDIO.id,
} as const;

export const ABOUT_DESCRIPTION =
  'How a legendary year in football inspired a fan football arcade: the story behind The Golden Run, its creator Mojeeb Titilayo, and the studio behind it, BlindspotLab Limited.';

const ref = (id: string) => ({ '@id': id });

function person() {
  return {
    '@type': 'Person',
    '@id': IDS.person,
    name: CREATOR.name,
    url: CREATOR.url,
    jobTitle: CREATOR.jobTitle,
    image: ref(IDS.portrait),
    sameAs: [CREATOR.x, CREATOR.github],
    worksFor: ref(IDS.organization),
  };
}

function organization() {
  return {
    '@type': 'Organization',
    '@id': IDS.organization,
    name: STUDIO.name,
    legalName: STUDIO.name,
    url: STUDIO.url,
    founder: ref(IDS.person),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: SITE.supportEmail,
      availableLanguage: 'English',
    },
  };
}

function website() {
  return {
    '@type': 'WebSite',
    '@id': IDS.website,
    name: SITE.name,
    url: `${SITE.url}/`,
    inLanguage: 'en',
    publisher: ref(IDS.organization),
    creator: ref(IDS.person),
    copyrightHolder: ref(IDS.organization),
    copyrightYear: COPYRIGHT_YEAR,
  };
}

function game() {
  return {
    '@type': 'VideoGame',
    '@id': IDS.game,
    name: SITE.name,
    url: `${SITE.url}/`,
    description: SITE.description,
    image: SITE.image,
    inLanguage: 'en',
    genre: ['Arcade', 'Sports'],
    gamePlatform: 'Web browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any (runs in a modern web browser)',
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    creator: ref(IDS.person),
    publisher: ref(IDS.organization),
    copyrightHolder: ref(IDS.organization),
    copyrightYear: COPYRIGHT_YEAR,
    license: CODE_LICENSE.url,
  };
}

function portrait() {
  return {
    '@type': 'ImageObject',
    '@id': IDS.portrait,
    url: `${SITE.url}${CREATOR.portrait}`,
    contentUrl: `${SITE.url}${CREATOR.portrait}`,
    width: 720,
    height: 900,
    caption: `${CREATOR.name}, creator of ${SITE.name}`,
  };
}

export function structuredData(page: StructuredPage): Record<string, unknown> {
  const shared = [website(), game(), person(), organization(), portrait()];
  const pageNode =
    page === 'home'
      ? {
          '@type': 'WebPage',
          '@id': IDS.home,
          url: `${SITE.url}/`,
          name: 'The Golden Run — 2008 → 1,000',
          isPartOf: ref(IDS.website),
          about: ref(IDS.game),
          mainEntity: ref(IDS.game),
          inLanguage: 'en',
        }
      : {
          '@type': 'AboutPage',
          '@id': IDS.about,
          url: `${SITE.url}/about`,
          name: 'About The Golden Run — the story, the creator and the studio',
          description: ABOUT_DESCRIPTION,
          isPartOf: ref(IDS.website),
          about: ref(IDS.game),
          mainEntity: ref(IDS.game),
          author: ref(IDS.person),
          publisher: ref(IDS.organization),
          primaryImageOfPage: ref(IDS.portrait),
          // The footballer whose 2008 season inspired the theme is mentioned in the story.
          // He has no role in the game, so he appears only here.
          mentions: [{ '@type': 'Person', name: 'Cristiano Ronaldo' }],
          inLanguage: 'en',
        };
  return { '@context': 'https://schema.org', '@graph': [pageNode, ...shared] };
}

/** JSON for a <script type="application/ld+json"> block; `<` is escaped so the payload can't close the tag. */
export function structuredDataScript(page: StructuredPage): string {
  return JSON.stringify(structuredData(page)).replace(/</g, '\\u003c');
}
