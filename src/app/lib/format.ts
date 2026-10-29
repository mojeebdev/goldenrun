import { flagEmoji } from '../../shared/competition/identity';

const dn = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(undefined, { type: 'region' }) : null;

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return dn?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function countryLabel(code: string | null | undefined): string {
  return code ? `${flagEmoji(code)} ${countryName(code)}` : '';
}

export function localDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function utcDateTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** 240 → "4 minutes", 210 → "3 min 30 s". */
export function durationLabel(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (!s) return `${m} minute${m === 1 ? '' : 's'}`;
  return `${m} min ${s} s`;
}

export function relativeTime(ms: number, now = Date.now()): string {
  const s = Math.round((ms - now) / 1000);
  const abs = Math.abs(s);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < 60) return rtf.format(s, 'second');
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
}
