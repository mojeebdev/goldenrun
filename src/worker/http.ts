/** Small HTTP toolkit: JSON responses, typed errors, body limits, cookies, origin checks. */
import type { Env } from './env';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
};

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
  console.error('unhandled', e instanceof Error ? e.stack : e);
  return json({ error: 'internal', message: 'Something went wrong. Please try again.' }, 500);
}

const MAX_BODY = 32 * 1024;

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send JSON.');
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY) throw new HttpError(413, 'too_large', 'Request body too large.');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'too_large', 'Request body too large.');
  try {
    const v = JSON.parse(text) as unknown;
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('not an object');
    return v as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Malformed JSON body.');
  }
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** CSRF defence: state-changing requests must come from our own origin. */
export function assertSameOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins(env).includes(origin)) {
    throw new HttpError(403, 'forbidden_origin', 'Requests must come from the Golden Run site.');
  }
  return origin;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

/** Session cookie name: the __Host- prefix needs HTTPS, so local http dev uses a plain name. */
export function sessionCookieName(request: Request): string {
  return isSecure(request) ? '__Host-gr_session' : 'gr_session';
}

export function sessionCookie(request: Request, value: string, maxAgeSeconds: number): string {
  const parts = [
    `${sessionCookieName(request)}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure(request)) parts.push('Secure');
  return parts.join('; ');
}

export function clientKey(request: Request): string {
  // Used only as a rate-limit bucket key, never stored or used as identity.
  return request.headers.get('cf-connecting-ip') ?? 'local';
}
