/** Account (/me), privacy, deletion and public player profiles. */
import type { Me, PlayerProfile } from '../../shared/competition/api';
import { validateCountry } from '../../shared/competition/identity';
import { auditStatement } from '../db/audit';
import { ensureWeek } from '../db/cup';
import type { Env } from '../env';
import { HttpError, json, readJson } from '../http';
import { randomToken } from '../security/crypto';
import { clearSessionCookie, requireSession } from '../security/session';
import type { RunRow } from './runs';
import { runRank, runSummary } from './runs';

export async function getMe(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  const player = await env.DB.prepare('SELECT id, handle, country_code, visibility, created_at FROM players WHERE id = ?')
    .bind(s.playerId)
    .first<{ id: string; handle: string; country_code: string | null; visibility: 'public' | 'private'; created_at: number }>();
  const goals = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE player_id = ?').bind(s.playerId).first<{ n: number }>();
  const passkeys = await env.DB.prepare(
    'SELECT id, created_at, last_used_at, device_type, backed_up FROM passkey_credentials WHERE player_id = ? ORDER BY created_at',
  )
    .bind(s.playerId)
    .all<{ id: string; created_at: number; last_used_at: number | null; device_type: string | null; backed_up: number }>();
  const codes = await env.DB.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE player_id = ? AND used_at IS NULL')
    .bind(s.playerId)
    .first<{ n: number }>();
  const cup = await ensureWeek(env, now);
  const entry = await env.DB.prepare('SELECT * FROM runs WHERE cup_week_id = ? AND player_id = ? AND ranked = 1')
    .bind(cup.weekId, s.playerId)
    .first<RunRow>();
  const me: Me = {
    player: {
      id: player!.id,
      handle: player!.handle,
      country: player!.country_code,
      visibility: player!.visibility,
      createdAt: player!.created_at,
    },
    careerGoals: goals?.n ?? 0,
    // Credential IDs are shortened: enough to tell passkeys apart, never the full ID.
    passkeys: passkeys.results.map((p) => ({
      id: p.id.slice(-6),
      createdAt: p.created_at,
      lastUsedAt: p.last_used_at,
      deviceType: p.device_type,
      backedUp: p.backed_up === 1,
    })),
    recoveryCodesRemaining: codes?.n ?? 0,
    cupEntry: entry ? runSummary(entry, undefined, await runRank(env, entry)) : null,
  };
  return json(me);
}

export async function updateMe(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  const body = await readJson(request);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if ('country' in body) {
    const c = validateCountry(body.country);
    if (!c.ok) throw new HttpError(400, 'bad_country', c.error);
    sets.push('country_code = ?');
    binds.push(c.country);
  }
  if ('visibility' in body) {
    if (body.visibility !== 'public' && body.visibility !== 'private') throw new HttpError(400, 'bad_visibility', 'Choose public or private.');
    sets.push('visibility = ?');
    binds.push(body.visibility);
  }
  if (!sets.length) throw new HttpError(400, 'bad_request', 'Nothing to update.');
  await env.DB.batch([
    env.DB.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, s.playerId),
    auditStatement(env, now, 'account.updated', s.playerId, { fields: sets.map((x) => x.split(' ')[0]) }),
  ]);
  return json({ ok: true });
}

/**
 * Account deletion: personal data is removed and the account can no longer sign
 * in. Verified competitive records stay (anonymised) so past standings and
 * awarded titles remain consistent, as published in the rules.
 */
export async function deleteMe(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  const body = await readJson(request);
  if (body.confirm !== s.handle) throw new HttpError(400, 'confirm_handle', 'Type your nickname exactly to confirm deletion.');
  const tomb = `deleted_${randomToken(9).replace(/[^A-Za-z0-9]/g, 'x')}`;
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE players SET handle = ?, handle_norm = ?, country_code = NULL, visibility = 'private', account_state = 'deleted' WHERE id = ?",
    ).bind(tomb, tomb.toLowerCase(), s.playerId),
    env.DB.prepare('DELETE FROM passkey_credentials WHERE player_id = ?').bind(s.playerId),
    env.DB.prepare('DELETE FROM recovery_codes WHERE player_id = ?').bind(s.playerId),
    env.DB.prepare('DELETE FROM webauthn_challenges WHERE player_id = ?').bind(s.playerId),
    env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL').bind(now, s.playerId),
    auditStatement(env, now, 'account.deleted', s.playerId),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
}

export async function getProfile(env: Env, handle: string): Promise<Response> {
  const p = await env.DB.prepare(
    "SELECT id, handle, country_code, created_at FROM players WHERE handle_norm = ? AND visibility = 'public' AND account_state = 'active'",
  )
    .bind(handle.toLowerCase())
    .first<{ id: string; handle: string; country_code: string | null; created_at: number }>();
  if (!p) throw new HttpError(404, 'not_found', 'No public player with that nickname.');
  const goals = await env.DB.prepare('SELECT COUNT(*) AS n FROM goal_ledger WHERE player_id = ?').bind(p.id).first<{ n: number }>();
  const awards = await env.DB.prepare(
    "SELECT award_type, award_key, review_state FROM awards WHERE player_id = ? AND review_state != 'revoked' ORDER BY awarded_at DESC LIMIT 50",
  )
    .bind(p.id)
    .all<{ award_type: string; award_key: string; review_state: string }>();
  const runs = await env.DB.prepare(
    "SELECT * FROM runs WHERE player_id = ? AND ranked = 1 AND state = 'accepted' ORDER BY started_at DESC LIMIT 20",
  )
    .bind(p.id)
    .all<RunRow>();
  const profile: PlayerProfile = {
    handle: p.handle,
    country: p.country_code,
    joinedAt: p.created_at,
    careerGoals: goals?.n ?? 0,
    awards: awards.results.map((a) => ({ type: a.award_type, weekId: a.award_key.split(':')[1] ?? null, reviewState: a.review_state })),
    cupResults: await Promise.all(
      runs.results.map(async (r) => ({ weekId: r.cup_week_id, score: r.skill_score ?? 0, goals: r.goals ?? 0, rank: await runRank(env, r) })),
    ),
  };
  return json(profile, 200, { 'cache-control': 'public, max-age=30' });
}
