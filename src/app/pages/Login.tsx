import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageShell } from '../components/PageShell';
import { Field, GhostButton, GoldButton, Notice, Panel, inputClass } from '../components/Ui';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { passkeysSupported } from '../lib/format';
import { signInWithPasskey } from '../lib/passkeys';

export function Login() {
  const { refresh } = useAccount();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    document.title = 'Sign in — The Golden Run';
  }, []);

  return (
    <PageShell>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">Sign in</h1>
      <p className="mt-2 max-w-xl text-chalk/75">Use the passkey you created for your player.</p>
      <div className="mt-8 grid max-w-xl gap-4">
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-4">
          <GoldButton
            disabled={busy || !passkeysSupported()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signInWithPasskey();
                await refresh();
                navigate('/modes');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Waiting for passkey…' : 'Sign in with passkey'}
          </GoldButton>
          <Link to="/join" className="text-sm text-chalk/75 underline">
            Create a player
          </Link>
        </div>
        {!recovering ? (
          <button type="button" className="w-fit text-sm text-chalk/60 underline" onClick={() => setRecovering(true)}>
            Lost your passkey? Use a recovery code
          </button>
        ) : (
          <Panel>
            <h2 className="display text-2xl font-extrabold uppercase italic">Use a recovery code</h2>
            <p className="mt-1 text-sm text-chalk/70">Each code works once. Afterwards, add a new passkey straight away.</p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError(null);
                try {
                  await api.recover(handle, code);
                  await refresh();
                  navigate('/account?recovered=1');
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Nickname">
                <input className={inputClass} value={handle} onChange={(e) => setHandle(e.target.value)} autoCapitalize="none" spellCheck={false} />
              </Field>
              <Field label="Recovery code">
                <input className={`${inputClass} uppercase tracking-widest`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} />
              </Field>
              <div className="flex gap-3">
                <GoldButton type="submit" disabled={busy || !handle || !code}>
                  Recover
                </GoldButton>
                <GhostButton onClick={() => setRecovering(false)}>Cancel</GhostButton>
              </div>
            </form>
          </Panel>
        )}
        <p className="text-xs text-chalk/50">
          No codes and no passkey? We can’t verify you any other way, so the account can’t be recovered. You can always create a new player.
        </p>
      </div>
    </PageShell>
  );
}
