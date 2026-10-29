/** Public nickname and country validation shared by client and Worker. */

export const HANDLE_RE = /^[A-Za-z0-9_]{3,20}$/;

const RESERVED = new Set([
  'admin', 'administrator', 'support', 'goldenrun', 'golden_run', 'official', 'moderator', 'staff', 'system',
  'root', 'null', 'undefined', 'deleted', 'anonymous', 'private', 'me', 'api',
]);

export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase();
}

export function validateHandle(handle: unknown): { ok: true; handle: string } | { ok: false; error: string } {
  if (typeof handle !== 'string') return { ok: false, error: 'Nickname is required.' };
  const h = handle.trim();
  if (!HANDLE_RE.test(h)) return { ok: false, error: 'Use 3–20 letters, numbers or underscores.' };
  const n = normalizeHandle(h);
  if (RESERVED.has(n) || n.startsWith('deleted_')) return { ok: false, error: 'That nickname is reserved.' };
  return { ok: true, handle: h };
}

/** ISO 3166-1 alpha-2 codes (officially assigned). Names come from Intl.DisplayNames in the UI. */
export const COUNTRY_CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO ' +
  'JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR ' +
  'MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO ' +
  'RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV ' +
  'TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

const COUNTRY_SET = new Set(COUNTRY_CODES);

export function validateCountry(code: unknown): { ok: true; country: string | null } | { ok: false; error: string } {
  if (code === null || code === undefined || code === '') return { ok: true, country: null };
  if (typeof code !== 'string' || !COUNTRY_SET.has(code.toUpperCase())) return { ok: false, error: 'Unknown country.' };
  return { ok: true, country: code.toUpperCase() };
}

/** Regional-indicator flag emoji for a country code (display only). */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  const A = 0x1f1e6;
  return String.fromCodePoint(A + code.charCodeAt(0) - 65, A + code.charCodeAt(1) - 65);
}
