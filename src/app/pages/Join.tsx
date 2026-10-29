/**
 * Create a player in three short steps (name → passkey → recovery codes), then
 * a "where to start" screen that points new players at the right first game.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { validateHandle } from '../../shared/competition/identity';
import { CountrySelect } from '../components/CountrySelect';
import { PageShell } from '../components/PageShell';
import { RecoveryCodes } from '../components/RecoveryCodes';
import { Field, GoldButton, Notice, Panel, inputClass } from '../components/Ui';
import { ApiError } from '../lib/api';
import { useAccount } from '../lib/account';
import { passkeysSupported } from '../lib/format';
import { createAccount } from '../lib/passkeys';

type Step = 'name' | 'passkey' | 'codes' | 'start';
const STEPS: { id: Step; label: string }[] = [
  { id: 'name', label: 'Nickname' },
  { id: 'passkey', label: 'Passkey' },
  { id: 'codes', label: 'Backup codes' },
];

export function Join() {
  const { bootstrap, refresh } = useAccount();
  const [step, setStep] = useState<Step>('name');
  const [handle, setHandle] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ handle: string; codes: string[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = 'Create your player — The Golden Run';
  }, []);
  // Move focus to each new step's heading so screen readers follow along.
  useEffect(() => {
    if (step !== 'name') headingRef.current?.focus();
  }, [step]);

  const supported = passkeysSupported();
  const handleCheck = handle ? validateHandle(handle) : null;

  if (bootstrap?.player && !done) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">You’re already in</h1>
        <p className="mt-2 text-chalk/75">You’re playing as {bootstrap.player.handle}.</p>
        <StartChoices />
      </PageShell>
    );
  }

  const createPlayer = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await createAccount(handle.trim(), country);
      await refresh();
      setDone({ handle: res.handle, codes: res.recoveryCodes });
      setStep('codes');
    } catch (err) {
      if (err instanceof ApiError && ['handle_taken', 'bad_handle', 'bad_country'].includes(err.code)) {
        setStep('name');
      }
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <PageShell>
      <div className="mx-auto max-w-xl">
        {step !== 'start' && <StepDots index={stepIndex} />}

        {step === 'name' && (
          <>
            <h1 className="display mt-4 text-5xl font-extrabold uppercase italic">Create your player</h1>
            <ul className="mt-3 grid gap-1.5 text-sm text-chalk/80">
              <Perk>Keep every verified goal on the Road to 1,000</Perk>
              <Perk>Play the 2008 chapter and the weekly Golden Cup</Perk>
              <Perk>Free. No email, no password.</Perk>
            </ul>
            <form
              className="mt-6 grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                const v = validateHandle(handle);
                if (!v.ok) return setError(v.error);
                if (!rules) return setError('Please accept the game rules to continue.');
                setHandle(v.handle);
                setStep('passkey');
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
                  autoFocus
                />
              </Field>
              {handleCheck && !handleCheck.ok && <p className="-mt-3 text-xs text-[#ffb3a5]">{handleCheck.error}</p>}
              <Field label="Country (optional)" hint="Only for country leaderboards. We never guess it from your location.">
                <CountrySelect value={country} onChange={setCountry} />
              </Field>
              <label className="flex items-start gap-2 text-sm text-chalk/85">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-gold)]" checked={rules} onChange={(e) => setRules(e.target.checked)} />
                <span>
                  I accept the <Link to="/rules" className="text-gold underline">game & competition rules</Link>. The Golden Run is a fan football arcade
                  with no cash prizes.
                </span>
              </label>
              {error && <Notice tone="error">{error}</Notice>}
              <div className="flex flex-wrap items-center gap-4">
                <GoldButton type="submit" disabled={!handle}>Continue</GoldButton>
                <Link to="/login" className="text-sm text-chalk/75 underline">I already have a player</Link>
              </div>
            </form>
          </>
        )}

        {step === 'passkey' && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="display mt-4 text-5xl font-extrabold uppercase italic outline-none">
              Lock it to this device
            </h1>
            <p className="mt-2 text-chalk/80">
              <b className="text-chalk">{handle}</b> signs in with a <b className="text-chalk">passkey</b>: your phone’s Face ID, fingerprint or screen lock.
            </p>
            <Panel className="mt-5">
              <ul className="grid gap-3 text-sm text-chalk/85">
                <Perk>Nothing to remember: no password, no email.</Perk>
                <Perk>Your face or fingerprint never leaves your device. We never see it.</Perk>
                <Perk>If your phone backs up passwords (iCloud Keychain, Google Password Manager), your player comes with you.</Perk>
              </ul>
            </Panel>
            {!supported && (
              <div className="mt-4">
                <Notice tone="warn">
                  This browser doesn’t support passkeys. Try an up-to-date Safari, Chrome, Edge or Firefox. You can keep practising as a guest meanwhile.
                </Notice>
              </div>
            )}
            {error && (
              <div className="mt-4">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <GoldButton disabled={busy || !supported} onClick={() => void createPlayer()}>
                {busy ? 'Waiting for your device…' : 'Create my passkey'}
              </GoldButton>
              <button type="button" className="text-sm text-chalk/75 underline" onClick={() => setStep('name')} disabled={busy}>
                Back
              </button>
            </div>
            <p className="mt-3 text-xs text-chalk/55">Your device will ask you to confirm. That’s the passkey being made.</p>
          </>
        )}

        {step === 'codes' && done && (
          <>
            <h1 ref={headingRef} tabIndex={-1} className="display mt-4 text-5xl font-extrabold uppercase italic outline-none">
              Save your backup codes
            </h1>
            <p className="mt-2 text-chalk/80">
              If you ever lose this device, one of these codes gets you back in once so you can add a new passkey. They’re shown <b>only now</b>.
            </p>
            <div className="mt-5">
              <RecoveryCodes codes={done.codes} handle={done.handle} />
            </div>
            <label className="mt-5 flex items-start gap-2 text-sm text-chalk/85">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-gold)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
              I’ve saved my backup codes somewhere safe.
            </label>
            <GoldButton className="mt-5" disabled={!saved} onClick={() => setStep('start')}>
              Continue
            </GoldButton>
          </>
        )}

        {step === 'start' && done && (
          <>
            <p className="label text-gold">Welcome to the run</p>
            <h1 ref={headingRef} tabIndex={-1} className="display mt-1 text-5xl font-extrabold uppercase italic outline-none">
              You’re in, {done.handle}
            </h1>
            <p className="mt-2 text-chalk/80">Where do you want to start?</p>
            <StartChoices />
          </>
        )}
      </div>
    </PageShell>
  );
}

function StepDots({ index }: { index: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < index ? 'bg-gold/30 text-gold' : i === index ? 'bg-gold text-midnight' : 'bg-white/10 text-chalk/50'}`}
            aria-hidden="true"
          >
            {i < index ? '✓' : i + 1}
          </span>
          <span className={`label hidden text-[10px] sm:inline ${i === index ? 'text-gold' : 'text-chalk/50'}`}>{s.label}</span>
          {i < STEPS.length - 1 && <span className="h-px w-6 bg-white/15" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

function Perk({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="mt-0.5 text-gold">✓</span>
      <span>{children}</span>
    </li>
  );
}

/** Where a new (or returning) player should go next. The 2008 chapter is the natural first step. */
function StartChoices() {
  const choices: { to: string; title: string; detail: string; tag?: string }[] = [
    { to: '/2008', title: '2008 · Matchday 1', detail: 'The story starts here. A forgiving keeper, 10 shots, goals that count.', tag: 'Recommended' },
    { to: '/play', title: 'Practice', detail: 'Warm up first. Unlimited shots, nothing recorded.' },
    { to: '/road-to-1000', title: 'Road to 1,000', detail: 'Career runs on random courses. Every verified goal counts once.' },
    { to: '/cup', title: 'Golden Cup', detail: 'This week’s 12 shots. One ranked try per week, so warm up first.' },
  ];
  return (
    <ul className="mt-5 grid gap-3">
      {choices.map((c, i) => (
        <li key={c.to}>
          <Link
            to={c.to}
            className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${i === 0 ? 'border-gold bg-gold/10 hover:bg-gold/15' : 'border-white/10 bg-night/60 hover:border-white/25'}`}
          >
            <span>
              {c.tag && <span className="label text-gold">{c.tag}</span>}
              <span className="display block text-2xl font-extrabold uppercase italic">{c.title}</span>
              <span className="block text-sm text-chalk/70">{c.detail}</span>
            </span>
            <span aria-hidden="true" className="text-2xl text-gold">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
