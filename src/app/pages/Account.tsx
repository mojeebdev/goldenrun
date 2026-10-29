import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Me } from '../../shared/competition/api';
import { CountrySelect } from '../components/CountrySelect';
import { PageShell } from '../components/PageShell';
import { RecoveryCodes } from '../components/RecoveryCodes';
import { Field, GhostButton, GoldButton, Notice, Panel, inputClass } from '../components/Ui';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { localDateTime } from '../lib/format';
import { addPasskey } from '../lib/passkeys';

export function Account() {
  const { refresh, signOut } = useAccount();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(params.get('recovered') ? 'Recovered. Add a new passkey now so you can sign in next time.' : null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirm, setConfirm] = useState('');
  const [signedOut, setSignedOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch (e) {
      if ((e as { status?: number }).status === 401) setSignedOut(true);
      else setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    document.title = 'Your account — The Golden Run';
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage(ok);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (signedOut) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">Not signed in</h1>
        <div className="mt-4 flex gap-4">
          <Link className="text-gold underline" to="/login">Sign in</Link>
          <Link className="text-gold underline" to="/join">Create a player</Link>
        </div>
      </PageShell>
    );
  }
  if (!me) return <PageShell><p className="text-chalk/70" role="status">Loading your account…</p></PageShell>;

  return (
    <PageShell>
      <p className="label text-gold">Your player</p>
      <h1 className="display text-5xl font-extrabold uppercase italic">{me.player.handle}</h1>
      <p className="mt-1 text-chalk/70">
        <b className="text-chalk">{me.careerGoals}</b> verified career goals · joined {new Date(me.player.createdAt).toLocaleDateString()}
        {me.player.visibility === 'public' && (
          <> · <Link className="text-gold underline" to={`/u/${me.player.handle}`}>public profile</Link></>
        )}
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {message && <div className="md:col-span-2"><Notice tone="success">{message}</Notice></div>}
        {error && <div className="md:col-span-2"><Notice tone="error">{error}</Notice></div>}

        <Panel>
          <h2 className="display text-2xl font-extrabold uppercase italic">Privacy</h2>
          <div className="mt-3 grid gap-4">
            <Field label="Country" hint="Optional. Used only for country leaderboards.">
              <CountrySelect value={me.player.country} onChange={(c) => act(() => api.updateMe({ country: c }), 'Country updated.')} />
            </Field>
            <Field label="Profile" hint="Private players stay on leaderboards anonymously; their profile page is hidden.">
              <div className="flex gap-2">
                {(['public', 'private'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={me.player.visibility === v}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize ${me.player.visibility === v ? 'bg-gold text-midnight' : 'bg-white/5 text-chalk/80'}`}
                    onClick={() => act(() => api.updateMe({ visibility: v }), `Profile is now ${v}.`)}>
                    {v}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Panel>

        <Panel>
          <h2 className="display text-2xl font-extrabold uppercase italic">Passkeys</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {me.passkeys.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
                <span>…{p.id} {p.backedUp ? <span className="text-chalk/55">(synced)</span> : <span className="text-chalk/55">(this device only)</span>}</span>
                <span className="text-chalk/55">{p.lastUsedAt ? `used ${localDateTime(p.lastUsedAt)}` : `added ${localDateTime(p.createdAt)}`}</span>
              </li>
            ))}
          </ul>
          <GoldButton className="mt-4" onClick={() => act(addPasskey, 'Passkey added.')}>Add a passkey</GoldButton>
          <p className="mt-2 text-xs text-chalk/55">Add one on each device you play on, so losing a phone doesn’t lock you out.</p>
        </Panel>

        <Panel>
          <h2 className="display text-2xl font-extrabold uppercase italic">Recovery codes</h2>
          <p className="mt-1 text-sm text-chalk/70">{me.recoveryCodesRemaining} of 8 unused. Generating new ones cancels the old set.</p>
          {codes ? (
            <div className="mt-3"><RecoveryCodes codes={codes} handle={me.player.handle} /></div>
          ) : (
            <GhostButton className="mt-3" onClick={() => act(async () => setCodes((await api.newRecoveryCodes()).recoveryCodes))}>
              Generate new codes
            </GhostButton>
          )}
        </Panel>

        <Panel>
          <h2 className="display text-2xl font-extrabold uppercase italic">Sessions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <GhostButton onClick={async () => { await signOut(); navigate('/'); }}>Sign out</GhostButton>
            <GhostButton onClick={async () => { await api.logoutAll().catch(() => undefined); await refresh(); navigate('/'); }}>Sign out everywhere</GhostButton>
          </div>
        </Panel>

        <Panel className="md:col-span-2 border-[#e0563f]/30">
          <h2 className="display text-2xl font-extrabold uppercase italic">Delete account</h2>
          <p className="mt-1 text-sm text-chalk/70">
            Removes your nickname, country, passkeys and recovery codes and signs you out everywhere. Verified results stay in
            past standings anonymously, so other players’ ranks don’t change. This can’t be undone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className={`${inputClass} max-w-xs`} placeholder={`Type ${me.player.handle} to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <GhostButton disabled={confirm !== me.player.handle} className="border-[#e0563f]/60 text-[#ffb3a5]"
              onClick={() => act(async () => { await api.deleteMe(confirm); await refresh(); navigate('/'); })}>
              Delete my account
            </GhostButton>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}
