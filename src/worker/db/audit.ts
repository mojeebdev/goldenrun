import type { Env } from '../env';

/** Append a non-sensitive audit event. Never pass secrets, cookies, challenges or IPs. */
export function auditStatement(env: Env, now: number, kind: string, playerId: string | null, detail?: Record<string, unknown>) {
  return env.DB.prepare('INSERT INTO audit_events (at, kind, player_id, detail) VALUES (?, ?, ?, ?)').bind(
    now,
    kind,
    playerId,
    detail ? JSON.stringify(detail) : null,
  );
}
