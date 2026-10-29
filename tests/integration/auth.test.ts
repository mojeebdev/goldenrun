import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Env } from '../../src/worker/env';
import { SoftAuthenticator } from './authenticator';
import { ORIGIN, client, registerPlayer, startHarness } from './harness';

let env: Env;
let dispose: () => Promise<void>;
const clock = Date.UTC(2026, 10, 3, 12, 0, 0); // Tue 3 Nov 2026
const now = () => clock;

beforeAll(async () => {
  ({ env, dispose } = await startHarness());
});
afterAll(async () => dispose());

describe('passkey accounts (local Worker + local D1)', () => {
  it('registers with a passkey, issues a session cookie and recovery codes', async () => {
    const { client: c, recoveryCodes } = await registerPlayer(env, now, 'Striker_7', 'PT');
    expect(recoveryCodes).toHaveLength(8);
    expect(new Set(recoveryCodes).size).toBe(8);
    expect(c.cookie).toMatch(/^gr_session=/);
    const me = await c.call<{ player: { handle: string; country: string } ; careerGoals: number; passkeys: unknown[]; recoveryCodesRemaining: number }>('GET', '/api/v1/me');
    expect(me.status).toBe(200);
    expect(me.body.player).toMatchObject({ handle: 'Striker_7', country: 'PT' });
    expect(me.body.passkeys).toHaveLength(1);
    expect(me.body.recoveryCodesRemaining).toBe(8);
    // Only hashes are stored.
    const row = await env.DB.prepare('SELECT id FROM sessions LIMIT 1').first<{ id: string }>();
    expect(c.cookie).not.toContain(row!.id);
    const code = await env.DB.prepare('SELECT code_hash FROM recovery_codes LIMIT 1').first<{ code_hash: string }>();
    expect(recoveryCodes.join()).not.toContain(code!.code_hash);
  });

  it('rejects taken (case-insensitive), reserved and malformed nicknames', async () => {
    const c = client(env, now);
    expect((await c.call('POST', '/api/v1/auth/registration/options', { handle: 'striker_7', acceptRules: true })).status).toBe(409);
    expect((await c.call('POST', '/api/v1/auth/registration/options', { handle: 'admin', acceptRules: true })).status).toBe(400);
    expect((await c.call('POST', '/api/v1/auth/registration/options', { handle: 'a b', acceptRules: true })).status).toBe(400);
    expect((await c.call('POST', '/api/v1/auth/registration/options', { handle: 'NoRules', acceptRules: false })).status).toBe(400);
    expect((await c.call('POST', '/api/v1/auth/registration/options', { handle: 'BadLand', country: 'XX', acceptRules: true })).status).toBe(400);
  });

  it('refuses cross-origin writes and wrong-origin passkey responses', async () => {
    const c = client(env, now);
    const res = await c.call('POST', '/api/v1/auth/login/options', {}, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect((await c.call('POST', '/api/v1/auth/login/options', {}, { origin: null })).status).toBe(403);
    const opt = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>(
      'POST', '/api/v1/auth/registration/options', { handle: 'Phisher', acceptRules: true });
    const auth = new SoftAuthenticator(ORIGIN, 'localhost');
    const ver = await c.call('POST', '/api/v1/auth/registration/verify', {
      challengeId: opt.body.challengeId,
      response: await auth.register(opt.body.options, 'https://evil.example'),
    });
    expect(ver.status).toBe(400);
    expect(await env.DB.prepare("SELECT 1 FROM players WHERE handle_norm = 'phisher'").first()).toBeNull();
  });

  it('requires user verification', async () => {
    const c = client(env, now);
    const opt = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>(
      'POST', '/api/v1/auth/registration/options', { handle: 'NoUV', acceptRules: true });
    const auth = new SoftAuthenticator(ORIGIN, 'localhost', { userVerified: false });
    const ver = await c.call('POST', '/api/v1/auth/registration/verify', { challengeId: opt.body.challengeId, response: await auth.register(opt.body.options) });
    expect(ver.status).toBe(400);
  });

  it('challenges are single-use and expire', async () => {
    const c = client(env, now);
    const opt = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>(
      'POST', '/api/v1/auth/registration/options', { handle: 'Replayer', acceptRules: true });
    const auth = new SoftAuthenticator(ORIGIN, 'localhost');
    const response = await auth.register(opt.body.options);
    expect((await c.call('POST', '/api/v1/auth/registration/verify', { challengeId: opt.body.challengeId, response })).status).toBe(201);
    const again = await client(env, now).call('POST', '/api/v1/auth/registration/verify', { challengeId: opt.body.challengeId, response });
    expect(again.status).toBe(400);
    expect((again.body as { error: string }).error).toBe('challenge_expired');

    const late = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>(
      'POST', '/api/v1/auth/registration/options', { handle: 'Latecomer', acceptRules: true });
    const lateRes = await c.call('POST', '/api/v1/auth/registration/verify',
      { challengeId: late.body.challengeId, response: await new SoftAuthenticator(ORIGIN, 'localhost').register(late.body.options) },
      { now: clock + 6 * 60 * 1000 });
    expect(lateRes.status).toBe(400);
  });

  it('signs in with a discoverable passkey and rejects counter regression', async () => {
    const { auth } = await registerPlayer(env, now, 'Winger', null);
    auth.opts.countSignatures = true;
    const c = client(env, now);
    const opt = await c.call<{ challengeId: string; options: { challenge: string; allowCredentials?: unknown[] } }>('POST', '/api/v1/auth/login/options', {});
    expect(opt.body.options.allowCredentials ?? []).toHaveLength(0); // no account enumeration
    const ok = await c.call<{ handle: string }>('POST', '/api/v1/auth/login/verify', { challengeId: opt.body.challengeId, response: await auth.assert(opt.body.options) });
    expect(ok.status).toBe(200);
    expect(ok.body.handle).toBe('Winger');
    expect((await c.call('GET', '/api/v1/me')).status).toBe(200);

    // A cloned authenticator replaying an old counter is refused.
    auth.counter = 0;
    const c2 = client(env, now);
    const opt2 = await c2.call<{ challengeId: string; options: { challenge: string } }>('POST', '/api/v1/auth/login/options', {});
    const bad = await c2.call('POST', '/api/v1/auth/login/verify', { challengeId: opt2.body.challengeId, response: await auth.assert(opt2.body.options) });
    expect(bad.status).toBe(401);
  });

  it('rejects an unknown passkey without revealing accounts', async () => {
    const c = client(env, now);
    const stranger = new SoftAuthenticator(ORIGIN, 'localhost');
    await stranger.register({ challenge: 'x', user: { id: 'y' } });
    const opt = await c.call<{ challengeId: string; options: { challenge: string } }>('POST', '/api/v1/auth/login/options', {});
    const res = await c.call<{ error: string }>('POST', '/api/v1/auth/login/verify', { challengeId: opt.body.challengeId, response: await stranger.assert(opt.body.options) });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('verification_failed');
  });

  it('logout revokes the session; logout-all revokes every session', async () => {
    const { client: a, auth } = await registerPlayer(env, now, 'Keeper_1');
    const b = client(env, now);
    const opt = await b.call<{ challengeId: string; options: { challenge: string } }>('POST', '/api/v1/auth/login/options', {});
    await b.call('POST', '/api/v1/auth/login/verify', { challengeId: opt.body.challengeId, response: await auth.assert(opt.body.options) });
    const stolen = a.cookie;
    expect((await a.call('POST', '/api/v1/auth/logout', {})).status).toBe(200);
    a.cookie = stolen; // replaying the old cookie must not work
    expect((await a.call('GET', '/api/v1/me')).status).toBe(401);
    expect((await b.call('GET', '/api/v1/me')).status).toBe(200);
    await b.call('POST', '/api/v1/auth/logout-all', {});
    expect((await b.call('GET', '/api/v1/me')).status).toBe(401);
  });

  it('sessions expire', async () => {
    const { client: c } = await registerPlayer(env, now, 'Expiring');
    expect((await c.call('GET', '/api/v1/me', undefined, { now: clock + 31 * 24 * 3600 * 1000 })).status).toBe(401);
  });

  it('recovery codes work exactly once and lead to adding a new passkey', async () => {
    const { recoveryCodes } = await registerPlayer(env, now, 'Lost_Phone');
    const c = client(env, now);
    expect((await c.call('POST', '/api/v1/auth/recover', { handle: 'lost_phone', code: 'AAAA-BBBB-CCCC-DDDD' })).status).toBe(401);
    expect((await c.call('POST', '/api/v1/auth/recover', { handle: 'someone_else', code: recoveryCodes[0] })).status).toBe(401);
    expect((await c.call('POST', '/api/v1/auth/recover', { handle: 'lost_phone', code: recoveryCodes[0]!.toLowerCase() })).status).toBe(200);
    expect((await client(env, now).call('POST', '/api/v1/auth/recover', { handle: 'lost_phone', code: recoveryCodes[0] })).status).toBe(401);
    // Enrol a replacement passkey on the recovered session.
    const opt = await c.call<{ challengeId: string; options: { challenge: string; user: { id: string } } }>('POST', '/api/v1/auth/passkeys/options', {});
    expect(opt.status).toBe(200);
    const add = await c.call('POST', '/api/v1/auth/passkeys/verify', {
      challengeId: opt.body.challengeId,
      response: await new SoftAuthenticator(ORIGIN, 'localhost').register(opt.body.options),
    });
    expect(add.status).toBe(201);
    const me = await c.call<{ passkeys: unknown[]; recoveryCodesRemaining: number }>('GET', '/api/v1/me');
    expect(me.body.passkeys).toHaveLength(2);
    expect(me.body.recoveryCodesRemaining).toBe(7);
  });

  it('privacy settings and account deletion', async () => {
    const { client: c } = await registerPlayer(env, now, 'Private_Pat', 'BR');
    expect((await c.call('GET', '/api/v1/players/Private_Pat')).status).toBe(200);
    expect((await c.call('PATCH', '/api/v1/me', { visibility: 'private' })).status).toBe(200);
    expect((await c.call('GET', '/api/v1/players/Private_Pat')).status).toBe(404);
    expect((await c.call('PATCH', '/api/v1/me', { country: 'ZZ' })).status).toBe(400);
    expect((await c.call('DELETE', '/api/v1/me', { confirm: 'wrong' })).status).toBe(400);
    expect((await c.call('DELETE', '/api/v1/me', { confirm: 'Private_Pat' })).status).toBe(200);
    expect((await c.call('GET', '/api/v1/me')).status).toBe(401);
    expect(await env.DB.prepare("SELECT 1 FROM players WHERE handle_norm = 'private_pat'").first()).toBeNull();
    // The nickname is free again.
    expect((await client(env, now).call('POST', '/api/v1/auth/registration/options', { handle: 'Private_Pat', acceptRules: true })).status).toBe(200);
  });

  it('unknown routes and methods are typed errors', async () => {
    const c = client(env, now);
    expect((await c.call('GET', '/api/v1/nope')).status).toBe(404);
    expect((await c.call('PUT', '/api/v1/me', {})).status).toBe(405);
    expect((await c.call('GET', '/api/v1/me')).status).toBe(401);
  });
});
