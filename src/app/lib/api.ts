/** Typed client for the Worker API. Same-origin only; cookies carry the session. */
import type { Bootstrap, Challenge, HallOfFameEntry, Leaderboard, Me, PlayerProfile, Progress, RunSummary, StartedRun } from '../../shared/competition/api';
import type { ShotCommand } from '../../shared/rules';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network', 'No connection. Check your network and try again.');
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, String(data.error ?? 'error'), String(data.message ?? `Request failed (${res.status}).`), data);
  }
  return data as T;
}

export const api = {
  bootstrap: () => call<Bootstrap>('GET', '/api/v1/bootstrap'),
  me: () => call<Me>('GET', '/api/v1/me'),
  updateMe: (patch: { country?: string | null; visibility?: 'public' | 'private' }) => call<{ ok: true }>('PATCH', '/api/v1/me', patch),
  deleteMe: (confirm: string) => call<{ ok: true }>('DELETE', '/api/v1/me', { confirm }),
  registrationOptions: (handle: string, country: string | null) =>
    call<{ challengeId: string; options: unknown }>('POST', '/api/v1/auth/registration/options', { handle, country, acceptRules: true }),
  registrationVerify: (challengeId: string, response: unknown) =>
    call<{ handle: string; recoveryCodes: string[] }>('POST', '/api/v1/auth/registration/verify', { challengeId, response }),
  loginOptions: () => call<{ challengeId: string; options: unknown }>('POST', '/api/v1/auth/login/options', {}),
  loginVerify: (challengeId: string, response: unknown) => call<{ handle: string }>('POST', '/api/v1/auth/login/verify', { challengeId, response }),
  passkeyOptions: () => call<{ challengeId: string; options: unknown }>('POST', '/api/v1/auth/passkeys/options', {}),
  passkeyVerify: (challengeId: string, response: unknown) => call<{ ok: true }>('POST', '/api/v1/auth/passkeys/verify', { challengeId, response }),
  recover: (handle: string, code: string) => call<{ ok: true }>('POST', '/api/v1/auth/recover', { handle, code }),
  newRecoveryCodes: () => call<{ recoveryCodes: string[] }>('POST', '/api/v1/auth/recovery-codes', {}),
  logout: () => call<{ ok: true }>('POST', '/api/v1/auth/logout', {}),
  logoutAll: () => call<{ ok: true }>('POST', '/api/v1/auth/logout-all', {}),
  startRun: () => call<StartedRun>('POST', '/api/v1/runs/start', { mode: 'cup', ranked: true }),
  startTraining: (mode: 'chapter' | 'road', stage?: number) => call<StartedRun>('POST', '/api/v1/runs/start', { mode, stage }),
  progress: () => call<Progress>('GET', '/api/v1/progress'),
  challenge: (runId: string) => call<Challenge>('GET', `/api/v1/challenges/${runId}`),
  report: (handle: string, reason: 'nickname' | 'cheating' | 'other', note?: string) => call<{ ok: true }>('POST', '/api/v1/reports', { handle, reason, note }),
  submitRun: (runId: string, nonce: string, idempotencyKey: string, commands: ShotCommand[]) =>
    call<RunSummary>('POST', `/api/v1/runs/${runId}/submit`, { nonce, idempotencyKey, commands }),
  getRun: (runId: string) => call<RunSummary>('GET', `/api/v1/runs/${runId}`),
  leaderboard: (params: Record<string, string>) => call<Leaderboard>('GET', `/api/v1/leaderboard?${new URLSearchParams(params)}`),
  hallOfFame: () => call<{ entries: HallOfFameEntry[]; generatedAt: number; founding: Progress['founding'] }>('GET', '/api/v1/leaderboard?kind=hall'),
  player: (handle: string) => call<PlayerProfile>('GET', `/api/v1/players/${encodeURIComponent(handle)}`),
};
