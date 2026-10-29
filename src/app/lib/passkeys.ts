/** Browser side of the passkey ceremonies (thin wrappers with friendly errors). */
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { ApiError, api } from './api';

function friendly(e: unknown): Error {
  if (e instanceof ApiError) return e;
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'AbortError') return new Error('The passkey prompt was cancelled or timed out. Nothing was saved — try again when ready.');
  if (name === 'InvalidStateError') return new Error('This device already has a passkey for this account.');
  if (name === 'SecurityError') return new Error('Passkeys only work on the official site address over HTTPS.');
  return new Error((e as Error)?.message || 'Passkey request failed.');
}

export async function createAccount(handle: string, country: string | null) {
  const { challengeId, options } = await api.registrationOptions(handle, country);
  let response;
  try {
    response = await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON });
  } catch (e) {
    throw friendly(e);
  }
  return api.registrationVerify(challengeId, response);
}

export async function signInWithPasskey() {
  const { challengeId, options } = await api.loginOptions();
  let response;
  try {
    response = await startAuthentication({ optionsJSON: options as PublicKeyCredentialRequestOptionsJSON });
  } catch (e) {
    throw friendly(e);
  }
  return api.loginVerify(challengeId, response);
}

export async function addPasskey() {
  const { challengeId, options } = await api.passkeyOptions();
  let response;
  try {
    response = await startRegistration({ optionsJSON: options as PublicKeyCredentialCreationOptionsJSON });
  } catch (e) {
    throw friendly(e);
  }
  return api.passkeyVerify(challengeId, response);
}
