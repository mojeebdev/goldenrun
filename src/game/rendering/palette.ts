/** Golden Run palette: midnight black, trophy gold, stadium green, restrained deep red. */
export const PALETTE = {
  midnight: '#05070d',
  night: '#0b1220',
  gold: '#e8b84a',
  goldBright: '#ffd877',
  goldDeep: '#b8862b',
  green: '#1f6b34',
  greenDark: '#17552a',
  red: '#8e1b2a',
  redDeep: '#5c0f1b',
  chalk: '#f2efe6',
} as const;

export const HEX = {
  gold: 0xe8b84a,
  goldBright: 0xffd877,
  chalk: 0xf2efe6,
  red: 0x8e1b2a,
  redDeep: 0x5c0f1b,
  midnight: 0x05070d,
  keeperKit: 0x1c2333,
  keeperTrim: 0xe8b84a,
  skin: 0x8a5a3c,
  hair: 0x1a1210,
  glove: 0xffd877,
  sock: 0x10141c,
  boot: 0x0a0a0a,
} as const;

/** Small seeded PRNG for repeatable decoration (render only). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
