/** Opaque session cookies; D1 stores only SHA-256(secret). */
import type { Env } from '../env';
import { HttpError, readCookie, sessionCookie, sessionCookieName } from '../http';
import { randomToken, sha256Hex } from './crypto';

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export interface SessionPlayer {
  sessionId: string;
  playerId: string;
  handle: string;
}

export async function createSession(env: Env, request: Request, playerId: string, now: number): Promise<string> {
  const secret = randomToken(32);
  const id = await sha256Hex(secret);
  await env.DB.prepare('INSERT INTO sessions (id, player_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(id, playerId, now, now + SESSION_TTL_MS)
    .run();
  return sessionCookie(request, secret, Math.floor(SESSION_TTL_MS / 1000));
}

export async function currentSession(env: Env, request: Request, now: number): Promise<SessionPlayer | null> {
  const secret = readCookie(request, sessionCookieName(request));
  if (!secret || secret.length > 100) return null;
  const id = await sha256Hex(secret);
  const row = await env.DB.prepare(
    `SELECT s.id AS sessionId, p.id AS playerId, p.handle AS handle
       FROM sessions s JOIN players p ON p.id = s.player_id
      WHERE s.id = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND p.account_state = 'active'`,
  )
    .bind(id, now)
    .first<SessionPlayer>();
  return row ?? null;
}

export async function requireSession(env: Env, request: Request, now: number): Promise<SessionPlayer> {
  const s = await currentSession(env, request, now);
  if (!s) throw new HttpError(401, 'unauthorized', 'Sign in with your passkey first.');
  return s;
}

export async function revokeSession(env: Env, sessionId: string, now: number): Promise<void> {
  await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now, sessionId).run();
}

export function clearSessionCookie(request: Request): string {
  return sessionCookie(request, '', 0);
}
