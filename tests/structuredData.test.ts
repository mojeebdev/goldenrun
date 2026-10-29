import { describe, expect, it } from 'vitest';
import { IDS, structuredData, structuredDataScript } from '../src/shared/structuredData';
import { CREATOR, SITE, STUDIO } from '../src/shared/site';

type Node = Record<string, unknown> & { '@type': string; '@id'?: string };

function graph(page: 'home' | 'about'): Node[] {
  const g = structuredData(page);
  expect(g['@context']).toBe('https://schema.org');
  return g['@graph'] as Node[];
}

/** Every { "@id": ... } reference anywhere in a value. */
function refs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => refs(v, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (Object.keys(o).length === 1 && typeof o['@id'] === 'string') out.push(o['@id']);
    else Object.values(o).forEach((v) => refs(v, out));
  }
  return out;
}

const byId = (g: Node[], id: string) => g.find((n) => n['@id'] === id)!;

describe('structured data', () => {
  for (const page of ['home', 'about'] as const) {
    it(`${page}: one connected graph whose references all resolve`, () => {
      const g = graph(page);
      const ids = g.map((n) => n['@id']).filter(Boolean) as string[];
      expect(new Set(ids).size).toBe(ids.length);
      for (const r of refs(g)) expect(ids).toContain(r);
      // Survives a JSON round trip, and the script form can't close its <script> tag.
      expect(JSON.parse(structuredDataScript(page))).toEqual(structuredData(page));
      expect(structuredDataScript(page)).not.toContain('<');
    });
  }

  it('links the game to its creator and publisher', () => {
    const g = graph('home');
    const game = byId(g, IDS.game);
    expect(game['@type']).toBe('VideoGame');
    expect(game).toMatchObject({
      name: SITE.name,
      creator: { '@id': CREATOR.id },
      publisher: { '@id': STUDIO.id },
      copyrightHolder: { '@id': STUDIO.id },
      copyrightYear: 2026,
      isAccessibleForFree: true,
      gamePlatform: 'Web browser',
    });
    expect(byId(g, IDS.person)).toMatchObject({ '@type': 'Person', name: 'Mojeeb Titilayo', url: 'https://mojeeb.xyz', worksFor: { '@id': STUDIO.id } });
    expect(byId(g, IDS.person).sameAs).toEqual(['https://x.com/MojeebMotion', 'https://github.com/mojeebdev']);
    expect(byId(g, IDS.organization)).toMatchObject({
      '@type': 'Organization',
      legalName: 'BlindspotLab Limited',
      url: 'https://blindspotlab.xyz',
      founder: { '@id': CREATOR.id },
    });
  });

  it('describes /about as an AboutPage of the game, by its creator', () => {
    const page = byId(graph('about'), IDS.about);
    expect(page).toMatchObject({
      '@type': 'AboutPage',
      url: 'https://goldenrun.fun/about',
      about: { '@id': IDS.game },
      author: { '@id': CREATOR.id },
      publisher: { '@id': STUDIO.id },
    });
  });

  it('never presents the inspiring footballer as creator, publisher, sponsor or identity', () => {
    for (const page of ['home', 'about'] as const) {
      const g = graph(page);
      for (const node of g) {
        for (const key of ['creator', 'publisher', 'sponsor', 'organizer', 'author', 'founder', 'sameAs', 'copyrightHolder']) {
          expect(JSON.stringify(node[key] ?? '')).not.toMatch(/ronaldo/i);
        }
      }
    }
    const mentions = byId(graph('about'), IDS.about).mentions;
    expect(mentions).toEqual([{ '@type': 'Person', name: 'Cristiano Ronaldo' }]);
    expect(JSON.stringify(graph('home'))).not.toMatch(/ronaldo/i);
  });
});
