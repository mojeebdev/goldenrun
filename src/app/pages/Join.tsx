import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { validateHandle } from '../../shared/competition/identity';
import { CountrySelect } from '../components/CountrySelect';
import { PageShell } from '../components/PageShell';
import { RecoveryCodes } from '../components/RecoveryCodes';
import { Field, GoldButton, Notice, Panel, inputClass } from '../components/Ui';
import { useAccount } from '../lib/account';
import { passkeysSupported } from '../lib/format';
import { createAccount } from '../lib/passkeys';

export function Join() {
  const { bootstrap, refresh } = useAccount();
  const navigate = useNavigate();
  const [handle, setHandle] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ handle: string; codes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    document.title = 'Create your player — The Golden Run';
  }, []);

  const supported = passkeysSupported();
  const handleCheck = handle ? validateHandle(handle) : null;

  if (done) {
    return (
      <PageShell>
        <p className="label text-gold">Welcome to the run</p>
        <h1 className="display text-5xl font-extrabold uppercase italic">You’re in, {done.handle}</h1>
        <Panel className="mt-6 max-w-xl">
          <h2 className="display text-2xl font-extrabold uppercase italic">Save your recovery codes</h2>
          <p className="mt-1 text-sm text-chalk/75">
            Your passkey lives on this device (or in your password manager if it syncs). If you lose it, one of these codes
            lets you back in once so you can add a new passkey. They are shown <b>only now</b>.
          </p>
          <div className="mt-4">
            <RecoveryCodes codes={done.codes} handle={done.handle} />
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm text-chalk/85">
            <input type="checkbox" className="mt-1 accent-[var(--color-gold)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I’ve saved my recovery codes somewhere safe.
          </label>
          <div className="mt-5 flex flex-wrap gap-3">
            <GoldButton disabled={!saved} onClick={() => navigate('/cup')}>
              Enter the Golden Cup
            </GoldButton>
          </div>
          <p className="mt-3 text-xs text-chalk/55">Tip: add a second passkey on another device from your account page.</p>
        </Panel>
      </PageShell>
    );
  }

  if (bootstrap?.player) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">Already signed in</h1>
        <p className="mt-2 text-chalk/75">You’re playing as {bootstrap.player.handle}.</p>
        <Link to="/account" className="mt-4 inline-block text-gold underline">
          Go to your account
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <p className="label text-gold">Free · no email · no password</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">Create your player</h1>
      <p className="mt-2 max-w-xl text-chalk/75">
        Keep your goals, enter the weekly Golden Cup and appear on verified leaderboards. You sign in with a passkey —
        your phone’s or computer’s fingerprint, face or screen lock. We never see it.
      </p>
      <form
        className="mt-8 grid max-w-xl gap-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const v = validateHandle(handle);
          if (!v.ok) return setError(v.error);
          if (!rules) return setError('Please accept the game rules.');
          setBusy(true);
          try {
            const res = await createAccount(v.handle, country);
            await refresh();
            setDone({ handle: res.handle, codes: res.recoveryCodes });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Public nickname" hint="3–20 letters, numbers or underscores. Shown on leaderboards.">
          <input
            className={inputClass}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username webauthn"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            placeholder="e.g. TopCorner_7"
            aria-invalid={handleCheck ? !handleCheck.ok : undefined}
          />
        </Field>
        {handleCheck && !handleCheck.ok && <p className="-mt-3 text-xs text-[#ffb3a5]">{handleCheck.error}</p>}
        <Field label="Country (optional)" hint="Only used for country leaderboards. We never guess it from your location.">
          <CountrySelect value={country} onChange={setCountry} />
        </Field>
        <label className="flex items-start gap-2 text-sm text-chalk/85">
          <input type="checkbox" className="mt-1 accent-[var(--color-gold)]" checked={rules} onChange={(e) => setRules(e.target.checked)} />
          <span>
            I accept the <Link to="/rules" className="text-gold underline">game & competition rules</Link>. The Golden Run is an unofficial
            fan game with no cash prizes.
          </span>
        </label>
        {!supported && (
          <Notice tone="warn">
            This browser doesn’t support passkeys. Try an up-to-date Chrome, Safari, Edge or Firefox — or keep playing practice as a guest.
          </Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-4">
          <GoldButton type="submit" disabled={busy || !supported}>
            {busy ? 'Waiting for passkey…' : 'Create with passkey'}
          </GoldButton>
          <Link to="/login" className="text-sm text-chalk/75 underline">
            I already have a player
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
