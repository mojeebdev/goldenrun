/** Player preferences, kept in localStorage (best effort; never required). */
import type { KeeperLevel } from '../shared/rules';

export type Quality = 'auto' | 'high' | 'low';

export interface Settings {
  sound: boolean;
  /** null = follow the OS preference. */
  reducedMotion: boolean | null;
  quality: Quality;
  level: KeeperLevel;
}

const KEY = 'goldenrun.settings.v1';

export const DEFAULT_SETTINGS: Settings = { sound: false, reducedMotion: null, quality: 'auto', level: 'rookie' };

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

export function systemPrefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
