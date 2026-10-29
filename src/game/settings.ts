/** Player preferences, kept in localStorage (best effort; never required). */
import type { KeeperLevel } from '../shared/rules';

export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  sound: boolean;
  /** null = follow the OS preference. */
  reducedMotion: boolean | null;
  quality: Quality;
  level: KeeperLevel;
  /** 0..1 master volume. */
  volume: number;
  /** Practice: move to the next spot after a goal (true) or stay on one spot. */
  rotate: boolean;
}

const KEY = 'goldenrun.settings.v1';

export const DEFAULT_SETTINGS: Settings = { sound: false, reducedMotion: null, quality: 'auto', level: 'rookie', volume: 0.8, rotate: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: v.sound === true,
      reducedMotion: typeof v.reducedMotion === 'boolean' ? v.reducedMotion : null,
      quality: v.quality === 'high' || v.quality === 'low' ? v.quality : 'auto',
      level: v.level === 'professional' || v.level === 'legendary' ? v.level : 'rookie',
      volume: typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : 0.8,
      rotate: v.rotate !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode) — preferences just won't persist */
  }
}

const ONBOARDED_KEY = 'goldenrun.onboarded.v1';

/** Whether this device has seen the "how to shoot" steps. */
export function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* storage unavailable — the steps will just show again next time */
  }
}

export function systemPrefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
