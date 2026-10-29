/**
 * First-party passkey (WebAuthn) authentication. No external identity provider:
 * challenges, public keys, counters and sessions live in D1 and are verified
 * by this Worker. @simplewebauthn/server performs the WebAuthn verification.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, WebAuthnCredential } from '@simplewebauthn/server';

type Transports = WebAuthnCredential['transports'];
import { normalizeHandle, validateCountry, validateHandle } from '../../shared/competition/identity';
import { auditStatement } from '../db/audit';
import type { Env } from '../env';
import { HttpError, allowedOrigins, clientKey, json, readJson } from '../http';
import { fromBase64Url, normalizeRecoveryCode, randomToken, recoveryCode, sha256Hex, toBase64Url } from '../security/crypto';
import { limit } from '../security/ratelimit';
import { clearSessionCookie, createSession, requireSession, revokeSession } from '../security/session';

function utf8(s: string): Uint8Array<ArrayBuffer> {
  const e = new TextEncoder().encode(s);
  const out = new Uint8Array(new ArrayBuffer(e.length));
  out.set(e);
  return out;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RECOVERY_CODES = 8;

type Action = 'register' | 'login' | 'add-passkey';

interface ChallengeRow {
  id: string;
  challenge: string;
  action: Action;
  player_id: string | null;
  pending_player_id: string | null;
  pending_handle: string | null;
  pending_country: string | null;
  expires_at: number;
  used_at: number | null;
}

async function storeChallenge(
  env: Env,
  now: number,
  action: Action,
  challenge: string,
  fields: { playerId?: string; pendingPlayerId?: string; handle?: string; country?: string | null },
): Promise<string> {
  const handle = randomToken(24);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').bind(now - CHALLENGE_TTL_MS),
    env.DB.prepare(
      `INSERT INTO webauthn_challenges (id, challenge, action, player_id, pending_player_id, pending_handle, pending_country, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      await sha256Hex(handle),
      challenge,
      action,
      fields.playerId ?? null,
      fields.pendingPlayerId ?? null,
      fields.handle ?? null,
      fields.country ?? null,
      now + CHALLENGE_TTL_MS,
    ),
  ]);
  return handle;
}

/** Atomically consume a challenge: each can be used once, before it expires, for one action. */
async function consumeChallenge(env: Env, now: number, handle: unknown, action: Action): Promise<ChallengeRow> {
  if (typeof handle !== 'string' || handle.length > 64) throw new HttpError(400, 'bad_challenge', 'Missing challenge.');
  const id = await sha256Hex(handle);
  const res = await env.DB.prepare(
    'UPDATE webauthn_challenges SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ? AND action = ?',
  )
    .bind(now, id, now, action)
    .run();
  if (res.meta.changes !== 1) {
    throw new HttpError(400, 'challenge_expired', 'This sign-in request expired or was already used. Please try again.');
  }
  return (await env.DB.prepare('SELECT * FROM webauthn_challenges WHERE id = ?').bind(id).first<ChallengeRow>())!;
}

function rp(env: Env) {
  return { rpID: env.RP_ID, rpName: env.RP_NAME, origins: allowedOrigins(env) };
}

async function issueRecoveryCodes(env: Env, playerId: string, now: number) {
  const codes = Array.from({ length: RECOVERY_CODES }, recoveryCode);
  const stmts = await Promise.all(
    codes.map(async (c) =>
      env.DB.prepare('INSERT INTO recovery_codes (code_hash, player_id, created_at) VALUES (?, ?, ?)').bind(
        await sha256Hex(normalizeRecoveryCode(c)),
        playerId,
        now,
      ),
    ),
  );
  return { codes, stmts };
}

function credentialStatement(
  env: Env,
  playerId: string,
  now: number,
  info: { credential: { id: string; publicKey: Uint8Array; counter: number; transports?: string[] }; credentialDeviceType: string; credentialBackedUp: boolean },
) {
  return env.DB.prepare(
    `INSERT INTO passkey_credentials (id, player_id, public_key, counter, transports, device_type, backed_up, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    info.credential.id,
    playerId,
    toBase64Url(info.credential.publicKey),
    info.credential.counter,
    JSON.stringify(info.credential.transports ?? []),
    info.credentialDeviceType,
    info.credentialBackedUp ? 1 : 0,
    now,
  );
}

// ---------------- registration (claim an account) ----------------

export async function registrationOptions(request: Request, env: Env, now: number): Promise<Response> {
  await limit(env.AUTH_LIMITER, `auth:${clientKey(request)}`);
  const body = await readJson(request);
  const h = validateHandle(body.handle);
  if (!h.ok) throw new HttpError(400, 'bad_handle', h.error);
  const c = validateCountry(body.country);
  if (!c.ok) throw new HttpError(400, 'bad_country', c.error);
  if (body.acceptRules !== true) throw new HttpError(400, 'rules_not_accepted', 'Please accept the game rules to continue.');
  const taken = await env.DB.prepare('SELECT 1 FROM players WHERE handle_norm = ?').bind(normalizeHandle(h.handle)).first();
  if (taken) throw new HttpError(409, 'handle_taken', 'That nickname is taken. Try another.');

  const pendingPlayerId = crypto.randomUUID();
  const { rpID, rpName } = rp(env);
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: h.handle,
    userDisplayName: h.handle,
    userID: utf8(pendingPlayerId),
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257],
  });
  const challengeId = await storeChallenge(env, now, 'register', options.challenge, {
    pendingPlayerId,
    handle: h.handle,
    country: c.country,
  });
  return json({ challengeId, options });
}

export async function registrationVerify(request: Request, env: Env, now: number): Promise<Response> {
  await limit(env.AUTH_LIMITER, `auth:${clientKey(request)}`);
  const body = await readJson<{ challengeId?: string; response?: RegistrationResponseJSON }>(request);
  const ch = await consumeChallenge(env, now, body.challengeId, 'register');
  if (!body.response || !ch.pending_player_id || !ch.pending_handle) throw new HttpError(400, 'bad_request', 'Incomplete registration.');
  const { rpID, origins } = rp(env);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    throw new HttpError(400, 'verification_failed', `Passkey could not be verified: ${(e as Error).message}`);
  }
  if (!verification.verified) throw new HttpError(400, 'verification_failed', 'Passkey could not be verified.');
  const info = verification.registrationInfo;
  const playerId = ch.pending_player_id;
  const { codes, stmts } = await issueRecoveryCodes(env, playerId, now);
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO players (id, handle, handle_norm, country_code, created_at) VALUES (?, ?, ?, ?, ?)',
      ).bind(playerId, ch.pending_handle, normalizeHandle(ch.pending_handle), ch.pending_country, now),
      credentialStatement(env, playerId, now, info),
      ...stmts,
      auditStatement(env, now, 'account.created', playerId),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HttpError(409, 'handle_taken', 'That nickname was just taken. Try another.');
    throw e;
  }
  const cookie = await createSession(env, request, playerId, now);
  return json({ handle: ch.pending_handle, recoveryCodes: codes }, 201, { 'set-cookie': cookie });
}

// ---------------- login ----------------

export async function loginOptions(request: Request, env: Env, now: number): Promise<Response> {
  await limit(env.AUTH_LIMITER, `auth:${clientKey(request)}`);
  // Discoverable credentials: no allowCredentials list, so nothing reveals whether an account exists.
  const options = await generateAuthenticationOptions({ rpID: env.RP_ID, userVerification: 'required' });
  const challengeId = await storeChallenge(env, now, 'login', options.challenge, {});
  return json({ challengeId, options });
}

interface CredentialRow {
  id: string;
  player_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
}

export async function loginVerify(request: Request, env: Env, now: number): Promise<Response> {
  await limit(env.AUTH_LIMITER, `auth:${clientKey(request)}`);
  const body = await readJson<{ challengeId?: string; response?: AuthenticationResponseJSON }>(request);
  const ch = await consumeChallenge(env, now, body.challengeId, 'login');
  const response = body.response;
  if (!response || typeof response.id !== 'string') throw new HttpError(400, 'bad_request', 'Incomplete sign-in.');
  const cred = await env.DB.prepare(
    `SELECT c.* FROM passkey_credentials c JOIN players p ON p.id = c.player_id
      WHERE c.id = ? AND p.account_state = 'active'`,
  )
    .bind(response.id)
    .first<CredentialRow>();
  const fail = () => new HttpError(401, 'verification_failed', 'That passkey isn’t registered here, or it couldn’t be verified.');
  if (!cred) throw fail();
  const { rpID, origins } = rp(env);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: ch.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: fromBase64Url(cred.public_key),
        counter: cred.counter,
        transports: cred.transports ? (JSON.parse(cred.transports) as Transports) : undefined,
      },
    });
  } catch {
    throw fail();
  }
  if (!verification.verified) throw fail();
  const newCounter = verification.authenticationInfo.newCounter;
  // Signature counters must increase when the authenticator uses them (clone detection).
  if (cred.counter > 0 && newCounter <= cred.counter) {
    await auditStatement(env, now, 'auth.counter_regression', cred.player_id).run();
    throw fail();
  }
  await env.DB.prepare('UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ?')
    .bind(newCounter, now, cred.id)
    .run();
  const cookie = await createSession(env, request, cred.player_id, now);
  const player = await env.DB.prepare('SELECT handle FROM players WHERE id = ?').bind(cred.player_id).first<{ handle: string }>();
  return json({ handle: player!.handle }, 200, { 'set-cookie': cookie });
}

// ---------------- add another passkey (signed in) ----------------

export async function addPasskeyOptions(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  await limit(env.AUTH_LIMITER, `auth:${s.playerId}`);
  const existing = await env.DB.prepare('SELECT id, transports FROM passkey_credentials WHERE player_id = ?')
    .bind(s.playerId)
    .all<{ id: string; transports: string | null }>();
  if (existing.results.length >= 10) throw new HttpError(400, 'too_many_passkeys', 'You can register up to 10 passkeys.');
  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    userName: s.handle,
    userDisplayName: s.handle,
    userID: utf8(s.playerId),
    attestationType: 'none',
    excludeCredentials: existing.results.map((c) => ({
      id: c.id,
      transports: c.transports ? (JSON.parse(c.transports) as Transports) : undefined,
    })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    supportedAlgorithmIDs: [-7, -257],
  });
  const challengeId = await storeChallenge(env, now, 'add-passkey', options.challenge, { playerId: s.playerId });
  return json({ challengeId, options });
}

export async function addPasskeyVerify(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  const body = await readJson<{ challengeId?: string; response?: RegistrationResponseJSON }>(request);
  const ch = await consumeChallenge(env, now, body.challengeId, 'add-passkey');
  if (ch.player_id !== s.playerId || !body.response) throw new HttpError(400, 'bad_request', 'This request belongs to another session.');
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: ch.challenge,
      expectedOrigin: allowedOrigins(env),
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    });
  } catch (e) {
    throw new HttpError(400, 'verification_failed', `Passkey could not be verified: ${(e as Error).message}`);
  }
  if (!verification.verified) throw new HttpError(400, 'verification_failed', 'Passkey could not be verified.');
  try {
    await env.DB.batch([
      credentialStatement(env, s.playerId, now, verification.registrationInfo),
      auditStatement(env, now, 'passkey.added', s.playerId),
    ]);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw new HttpError(409, 'passkey_exists', 'That passkey is already registered.');
    throw e;
  }
  return json({ ok: true }, 201);
}

// ---------------- recovery codes ----------------

export async function recover(request: Request, env: Env, now: number): Promise<Response> {
  await limit(env.AUTH_LIMITER, `recover:${clientKey(request)}`);
  const body = await readJson(request);
  const fail = () => new HttpError(401, 'recovery_failed', 'That nickname and recovery code don’t match an unused code.');
  if (typeof body.handle !== 'string' || typeof body.code !== 'string' || body.code.length > 40) throw fail();
  const codeHash = await sha256Hex(normalizeRecoveryCode(body.code));
  const row = await env.DB.prepare(
    `SELECT r.player_id AS playerId FROM recovery_codes r JOIN players p ON p.id = r.player_id
      WHERE r.code_hash = ? AND r.used_at IS NULL AND p.handle_norm = ? AND p.account_state = 'active'`,
  )
    .bind(codeHash, normalizeHandle(body.handle))
    .first<{ playerId: string }>();
  if (!row) throw fail();
  const used = await env.DB.prepare('UPDATE recovery_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL')
    .bind(now, codeHash)
    .run();
  if (used.meta.changes !== 1) throw fail();
  await auditStatement(env, now, 'auth.recovery_code_used', row.playerId).run();
  const cookie = await createSession(env, request, row.playerId, now);
  return json({ ok: true, next: 'add-passkey' }, 200, { 'set-cookie': cookie });
}

export async function regenerateRecoveryCodes(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  await limit(env.AUTH_LIMITER, `auth:${s.playerId}`);
  const { codes, stmts } = await issueRecoveryCodes(env, s.playerId, now);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM recovery_codes WHERE player_id = ?').bind(s.playerId),
    ...stmts,
    auditStatement(env, now, 'auth.recovery_codes_regenerated', s.playerId),
  ]);
  return json({ recoveryCodes: codes });
}

export async function logout(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now).catch(() => null);
  if (s) await revokeSession(env, s.sessionId, now);
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
}

export async function logoutEverywhere(request: Request, env: Env, now: number): Promise<Response> {
  const s = await requireSession(env, request, now);
  await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE player_id = ? AND revoked_at IS NULL').bind(now, s.playerId).run();
  return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie(request) });
}
