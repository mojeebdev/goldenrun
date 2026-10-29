/**
 * Practice onboarding. First visit: three short "how to shoot" steps. Every
 * visit: one setup card (keeper, spot, sound) and a single Kick off button.
 * The game is already loaded and paused underneath, so kick-off is instant.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { KeeperLevel } from '../shared/rules';
import { KEEPER_LEVELS, KEEPER_PROFILES, PRACTICE_SPOTS } from '../shared/rules';
import type { GameController } from './GameController';
import type { SessionSnapshot } from './session';
import type { Settings } from './settings';
import { markOnboarded } from './settings';

const KEEPER_BLURB: Record<KeeperLevel, string> = {
  rookie: 'Slow to react. Find your range.',
  professional: 'Quicker, longer reach, reads some curl.',
  legendary: 'Elite reflexes. Only your best shots beat this keeper.',
};

const HOW_TO_STEPS: { title: string; body: string; art: 'drag' | 'bend' | 'strike' }[] = [
  { title: 'Drag', body: 'Put your finger on the ball and drag toward the goal. Direction aims, length is power. Let go to shoot.', art: 'drag' },
  { title: 'Bend', body: 'Curve your swipe and the ball curls the same way, round the keeper.', art: 'bend' },
  { title: 'Strike', body: 'Where you start on the ball matters. Start low to lift it toward the top corner, start high to keep it down.', art: 'strike' },
];

export function PracticeSetup({
  controller,
  settings,
  session,
  firstTime,
  onDone,
}: {
  controller: GameController;
  settings: Settings;
  session: SessionSnapshot;
  firstTime: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState<number | null>(firstTime ? 0 : null);
  const kickRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finish = () => {
    markOnboarded();
    onDone();
  };

  useEffect(() => {
    (step === null ? kickRef : nextRef).current?.focus();
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-black/55 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        className="anim-rise max-h-[94%] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-night p-5 pb-[max(20px,var(--safe-bottom))] sm:rounded-3xl"
      >
        {step !== null ? (
          <HowTo
            step={step}
            nextRef={nextRef}
            onNext={() => (step + 1 < HOW_TO_STEPS.length ? setStep(step + 1) : setStep(null))}
            onSkip={() => setStep(null)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label text-gold">Unranked · unlimited</p>
                <h2 id="setup-title" className="display text-4xl font-extrabold uppercase italic">Practice</h2>
              </div>
              <button type="button" className="label mt-2 shrink-0 text-chalk/70 underline hover:text-gold" onClick={() => setStep(0)}>
                How to shoot
              </button>
            </div>

            <fieldset className="mt-4">
              <legend className="label mb-2 text-gold">Goalkeeper</legend>
              <div className="grid gap-2">
                {KEEPER_LEVELS.map((l) => {
                  const on = settings.level === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={on}
                      disabled={session.phase === 'flight'}
                      onClick={() => controller.updateSettings({ level: l })}
                      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? 'border-gold bg-gold/15' : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                    >
                      <span>
                        <span className={`display block text-xl font-extrabold uppercase italic ${on ? 'text-gold' : 'text-chalk'}`}>{KEEPER_PROFILES[l].label}</span>
                        <span className="block text-xs text-chalk/65">{KEEPER_BLURB[l]}</span>
                      </span>
                      <span aria-hidden="true" className={`h-5 w-5 shrink-0 rounded-full border-2 ${on ? 'border-gold bg-gold shadow-[inset_0_0_0_3px_var(--color-night)]' : 'border-white/30'}`} />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="label mb-2 text-gold">Shooting spot</legend>
              <div className="flex gap-1.5">
                <Segment on={settings.rotate} onClick={() => controller.updateSettings({ rotate: true })}>
                  Tour all five
                </Segment>
                <Segment on={!settings.rotate} onClick={() => controller.updateSettings({ rotate: false })}>
                  Stay on one
                </Segment>
              </div>
              <p className="mt-1.5 text-xs text-chalk/55">
                {settings.rotate ? 'Score to move on to the next spot.' : 'Pick a spot and drill it as long as you like.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRACTICE_SPOTS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={session.spotIndex === i}
                    onClick={() => controller.selectSpot(i)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${session.spotIndex === i ? 'bg-gold text-midnight' : 'bg-white/5 text-chalk/80 hover:bg-white/10'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">Sound</span>
                <span className="block text-xs text-chalk/55">Crowd, strikes and the net.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.sound}
                aria-label="Sound"
                onClick={() => controller.updateSettings({ sound: !settings.sound })}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${settings.sound ? 'bg-gold' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-chalk transition-all ${settings.sound ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            <button
              ref={kickRef}
              type="button"
              onClick={finish}
              className="display mt-5 w-full rounded-full bg-gradient-to-b from-gold-bright to-gold py-3 text-2xl font-extrabold uppercase italic text-midnight shadow-[0_0_30px_rgba(232,184,74,0.35)] active:scale-[0.98]"
            >
              Kick off ▶
            </button>
            <p className="mt-3 text-center text-xs text-chalk/60">
              Want goals that count?{' '}
              <Link to="/modes" className="text-gold underline">
                See the verified modes
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Segment({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${on ? 'bg-gold text-midnight' : 'bg-white/5 text-chalk/80 hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}

function HowTo({ step, onNext, onSkip, nextRef }: { step: number; onNext: () => void; onSkip: () => void; nextRef: React.RefObject<HTMLButtonElement | null> }) {
  const s = HOW_TO_STEPS[step]!;
  const last = step === HOW_TO_STEPS.length - 1;
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="label text-gold">
          How to shoot · {step + 1}/{HOW_TO_STEPS.length}
        </p>
        <button type="button" className="label text-chalk/60 underline hover:text-gold" onClick={onSkip}>
          Skip
        </button>
      </div>
      <h2 id="setup-title" className="display mt-1 text-5xl font-extrabold uppercase italic">
        {s.title}
      </h2>
      <HowToArt key={s.art} art={s.art} />
      <p className="mt-3 text-[15px] text-chalk/85">{s.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5" aria-hidden="true">
          {HOW_TO_STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-gold' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>
        <button
          ref={nextRef}
          type="button"
          onClick={onNext}
          className="display rounded-full bg-gold px-7 py-2 text-xl font-extrabold uppercase italic text-midnight active:scale-[0.98]"
        >
          {last ? 'Got it' : 'Next'}
        </button>
      </div>
    </div>
  );
}

/** Tiny pitch diagrams: goal at the top, ball at the bottom, the swipe drawn in gold. */
function HowToArt({ art }: { art: 'drag' | 'bend' | 'strike' }) {
  const path =
    art === 'drag' ? 'M150 150 L150 62' : art === 'bend' ? 'M150 150 C 200 120, 205 85, 160 58' : 'M150 156 C 150 120, 150 80, 186 44';
  return (
    <svg viewBox="0 0 300 180" className="mt-3 block max-h-[34svh] w-full rounded-2xl" role="img" aria-label={`Diagram: ${art}`}>
      <rect x="0" y="0" width="300" height="180" fill="#1d5a2c" rx="16" />
      <path d="M0 96h300" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="2" />
      {/* goal */}
      <path d="M96 52V22h108v30" fill="none" stroke="#f7f5ef" strokeWidth="4" strokeLinejoin="round" />
      <path d="M100 26h100M100 34h100M100 42h100M110 24v28M130 24v28M150 24v28M170 24v28M190 24v28" stroke="#f7f5ef" strokeOpacity="0.2" strokeWidth="1" />
      {art === 'strike' && (
        <>
          <circle cx="186" cy="36" r="9" fill="none" stroke="#f5d27a" strokeWidth="2" strokeDasharray="3 3" />
          <text x="214" y="40" fill="#f5d27a" fontSize="11" fontFamily="var(--font-accent)">top corner</text>
        </>
      )}
      {/* ball */}
      <circle cx="150" cy="150" r="13" fill="#f7f5ef" />
      <path d="M150 143l6 4.5-2.4 7h-7.2l-2.4-7z" fill="#14161c" />
      {art === 'strike' && (
        <>
          <circle cx="150" cy="160" r="4.5" fill="#e8b84a" className="howto-pulse" />
          <text x="170" y="168" fill="#f7f5ef" fillOpacity="0.8" fontSize="11" fontFamily="var(--font-accent)">start low</text>
        </>
      )}
      <path d={path} fill="none" stroke="#e8b84a" strokeWidth="5" strokeLinecap="round" className="howto-draw" pathLength={100} />
      <circle r="7" fill="#e8b84a" fillOpacity="0.85" className="howto-finger" style={{ offsetPath: `path('${path}')` }} />
    </svg>
  );
}
