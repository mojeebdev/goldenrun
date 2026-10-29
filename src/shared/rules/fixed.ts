/**
 * Deterministic numeric helpers.
 *
 * The simulation only uses IEEE-754 operations that every JavaScript engine
 * must round identically (+, -, *, /, Math.sqrt, Math.round). Transcendental
 * functions (sin, exp, pow, ...) are implementation-defined and are banned in
 * src/shared by lint. State is snapped to a micro-unit grid after every step
 * so tiny divergences can never accumulate.
 */
const GRID = 1_000_000;

export function q(v: number): number {
  return Math.round(v * GRID) / GRID;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cubic ease-out using multiplication only. */
export function easeOut3(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

export function isSafeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v);
}

/** 32-bit FNV-1a over a string. Math.imul is exact integer math. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
