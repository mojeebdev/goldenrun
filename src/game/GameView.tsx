/**
 * /play — the full-viewport game with a minimal HUD. Lazy-loaded so the
 * homepage never pays for Phaser.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import type { KeeperLevel } from '../shared/rules';
import { KEEPER_LEVELS, KEEPER_PROFILES, PRACTICE_SPOTS } from '../shared/rules';
import type { AimReadout, ControllerUi } from './GameController';
import { GameController } from './GameController';
import type { ResolvedShot, SessionSnapshot } from './session';
import type { Quality } from './settings';

export default function GameView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [controller, setController] = useState<GameController | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const c = new GameController(host);
    c.mount();
    setController(c);
    return () => {
      c.destroy();
      setController(null);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-midnight">
      <div ref={hostRef} className="game-surface absolute inset-0" aria-label="Football pitch. Drag from the ball toward the goal to shoot, or use the keyboard." role="application" />
      {controller && <Hud controller={controller} />}
    </div>
  );
}

function useController(c: GameController): [ControllerUi, SessionSnapshot] {
  const ui = useSyncExternalStore(c.subscribeUi, c.getUi);
  const session = useSyncExternalStore(c.session.subscribe, c.session.getSnapshot);
  return [ui, session];
}

function Hud({ controller }: { controller: GameController }) {
  const [ui, session] = useController(controller);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { stats } = session;
  const spot = PRACTICE_SPOTS[session.spotIndex]!;

  useEffect(() => {
    controller.setPaused(settingsOpen);
  }, [settingsOpen, controller]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'm' || e.key === 'M') controller.toggleSound();
      else if (e.key === 'Escape' && settingsOpen) setSettingsOpen(false);
      else if ((e.key === 'p' || e.key === 'P') && !settingsOpen) setSettingsOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, settingsOpen]);

  const layout = ui.layout;
  const hintTop = layout ? Math.max(layout.goalBottom + 12, layout.ball.y - layout.padRadius - 92) : null;

  return (
    <div className={`pointer-events-none absolute inset-0 ${ui.reducedMotion ? 'reduce-motion' : ''}`}>
      {/* Top bar */}
      <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-[max(10px,var(--safe-left))] pt-[max(8px,var(--safe-top))] pr-[max(10px,var(--safe-right))]">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" aria-label="Exit to home" className="hud-btn">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 leading-tight">
            <p className="label truncate text-[10px] text-gold">Unranked practice</p>
            <p className="display truncate text-[15px] font-semibold uppercase text-chalk/85">
              {spot.label} · <span className="text-chalk/60">{KEEPER_PROFILES[session.level].label} keeper</span>
            </p>
          </div>
        </div>
        <Stats goals={stats.goals} attempts={stats.attempts} streak={stats.streak} score={stats.score} />
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="hud-btn"
            onClick={() => controller.toggleSound()}
            aria-pressed={ui.settings.sound}
            aria-label={ui.settings.sound ? 'Mute sound (M)' : 'Turn sound on (M)'}
          >
            {ui.settings.sound ? <SoundOnIcon /> : <SoundOffIcon />}
          </button>
          <button type="button" className="hud-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings and controls (P)">
            <GearIcon />
          </button>
        </div>
      </div>

      {/* Hint (first shots) */}
      {ui.hint && hintTop !== null && !ui.aim && session.phase === 'ready' && (
        <p
          className="anim-rise label absolute left-1/2 -translate-x-1/2 rounded-full bg-midnight/75 px-4 py-2 text-center text-[11px] text-chalk/90 backdrop-blur"
          style={{ top: hintTop }}
        >
          {ui.hint}
        </p>
      )}

      {/* Live aiming readout */}
      {ui.aim && <AimPanel aim={ui.aim} />}

      {/* Outcome banner */}
      {ui.banner && (
        <Banner shot={ui.banner} goalTop={layout?.goalTop ?? 160} goalBottom={layout?.goalBottom ?? 260} onSkip={() => controller.skip()} />
      )}
      <Announcer shot={ui.banner} />

      {/* Keyboard affordance on desktop */}
      {!ui.aim && session.phase === 'ready' && (
        <p className="label absolute bottom-[max(10px,var(--safe-bottom))] right-[max(12px,var(--safe-right))] hidden text-[10px] text-chalk/45 [@media(min-width:768px)_and_(min-height:600px)]:block">
          Keyboard: ← → aim · ↑ ↓ height · W/S power · Q/E curl · Enter shoot
        </p>
      )}

      {settingsOpen && (
        <SettingsSheet
          ui={ui}
          session={session}
          controller={controller}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

function Stats({ goals, attempts, streak, score }: { goals: number; attempts: number; streak: number; score: number }) {
  const items: [string, number | string][] = [
    ['Goals', goals],
    ['Shots', attempts],
    ['Streak', streak],
    ['Score', score.toLocaleString('en-US')],
  ];
  return (
    <dl className="pointer-events-none absolute left-1/2 top-[calc(max(8px,var(--safe-top))+44px)] flex -translate-x-1/2 gap-1 sm:static sm:translate-x-0">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-[54px] rounded-lg border border-white/10 bg-midnight/65 px-2 py-1 text-center backdrop-blur">
          <dt className="label text-[9px] text-chalk/55">{k}</dt>
          <dd className={`display text-lg font-extrabold leading-none ${k === 'Score' ? 'text-gold' : 'text-chalk'}`}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function AimPanel({ aim }: { aim: AimReadout }) {
  const height = 0.12 + 3.33 * (aim.aimY / 1000);
  const curl = aim.spin === 0 ? 'None' : `${aim.spin > 0 ? 'Right' : 'Left'} ${Math.round(Math.abs(aim.spin) / 10)}%`;
  return (
    <div className="absolute bottom-[max(10px,var(--safe-bottom))] left-[max(10px,var(--safe-left))] flex flex-col gap-1">
      <Meter label="Power" value={aim.power / 1000} text={`${Math.round(aim.power / 10)}%`} />
      <Meter label="Height" value={aim.aimY / 1000} text={`${height.toFixed(1)} m`} />
      <Meter label="Curl" value={Math.abs(aim.spin) / 1000} text={curl} />
      <p className={`label mt-0.5 text-[10px] ${aim.onTarget ? 'text-gold-bright' : 'text-[#e0563f]'}`}>
        {aim.onTarget ? 'On target' : 'Off target'}
        {aim.source === 'keyboard' ? ' · Enter to shoot' : ''}
      </p>
    </div>
  );
}

function Meter({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div className="flex w-44 items-center gap-2 rounded-md bg-midnight/70 px-2 py-1 backdrop-blur">
      <span className="label w-12 text-[9px] text-chalk/60">{label}</span>
      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
        <span className="absolute inset-y-0 left-0 rounded-full bg-gold" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
      <span className="w-14 text-right font-[var(--font-accent)] text-[11px] tabular-nums text-chalk">{text}</span>
    </div>
  );
}

const OUTCOME_TEXT: Record<string, { title: string; sub: string }> = {
  goal: { title: 'GOAL!', sub: '' },
  saved: { title: 'SAVED!', sub: 'The keeper reads it' },
  post: { title: 'OFF THE POST!', sub: 'So close' },
  crossbar: { title: 'CROSSBAR!', sub: 'Rattled the frame' },
  wide: { title: 'WIDE', sub: 'Pull it back inside the posts' },
  over: { title: 'OVER THE BAR', sub: 'Strike higher on the ball to keep it down' },
  short: { title: 'NOT ENOUGH', sub: 'Drag farther for more power' },
};

function Banner({
  shot,
  goalTop,
  goalBottom,
  onSkip,
}: {
  shot: ResolvedShot;
  goalTop: number;
  goalBottom: number;
  onSkip: () => void;
}) {
  const r = shot.result;
  const text = OUTCOME_TEXT[r.outcome] ?? OUTCOME_TEXT.wide!;
  const caught = r.keeperContact?.kind === 'catch';
  const sub = r.goal ? r.tags.join(' · ') : r.outcome === 'saved' ? (caught ? 'Held by the keeper' : 'Parried away') : text.sub;
  // The title sits above the crossbar and the details below the goal line, so
  // the ball, net and keeper reaction always stay visible.
  const room = Math.max(40, goalTop - 64);
  const titleSize = Math.min(r.goal ? 150 : 84, Math.max(36, room * 0.85));
  return (
    <>
      <button
        type="button"
        onClick={onSkip}
        className="pointer-events-auto absolute inset-x-0 flex justify-center"
        style={{ bottom: `calc(100% - ${goalTop - 4}px)` }}
        aria-label="Continue to next shot"
      >
        <span
          className={`anim-goal display block font-extrabold italic leading-[0.9] drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)] ${
            r.goal ? 'gold-text' : 'text-chalk'
          }`}
          style={{ fontSize: titleSize }}
        >
          {text.title}
        </span>
      </button>
      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center gap-1.5 px-3" style={{ top: goalBottom + 10 }}>
        {r.goal && (
          <span className="anim-rise flex flex-wrap justify-center gap-1.5">
            {r.modifiers.map((m) => (
              <span key={m.id} className="rounded-full bg-midnight/80 px-3 py-1 text-sm font-semibold text-chalk ring-1 ring-gold/50">
                {m.label} <span className="text-gold">+{m.points}</span>
              </span>
            ))}
            {shot.streakBonus > 0 && (
              <span className="rounded-full bg-blood/90 px-3 py-1 text-sm font-semibold text-chalk">
                Streak <span className="text-gold-bright">+{shot.streakBonus}</span>
              </span>
            )}
          </span>
        )}
        {sub && <span className="label anim-rise rounded-full bg-midnight/75 px-3 py-1 text-[11px] text-chalk/85">{sub}</span>}
        <span className="label text-[10px] text-chalk/50">Tap to continue</span>
      </div>
    </>
  );
}

function Announcer({ shot }: { shot: ResolvedShot | null }) {
  let msg = '';
  if (shot) {
    const r = shot.result;
    msg = r.goal ? `Goal! ${shot.points} points.` : `${OUTCOME_TEXT[r.outcome]?.title ?? r.outcome}.`;
  }
  return (
    <div className="sr-only" aria-live="polite" role="status">
      {msg}
    </div>
  );
}

function SettingsSheet({
  ui,
  session,
  controller,
  onClose,
}: {
  ui: ControllerUi;
  session: SessionSnapshot;
  controller: GameController;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  const level = ui.settings.level;
  const rm = ui.settings.reducedMotion;
  const segment = 'flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition';
  const on = 'bg-gold text-midnight';
  const off = 'bg-white/5 text-chalk/80 hover:bg-white/10';
  return (
    <div className="pointer-events-auto absolute inset-0 z-10 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="anim-rise max-h-[92%] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-night p-5 pb-[max(20px,var(--safe-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="display text-3xl font-extrabold uppercase italic">
            Settings
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="hud-btn" aria-label="Close settings">
            ✕
          </button>
        </div>

        <Section title="Goalkeeper">
          <div className="flex gap-1.5">
            {KEEPER_LEVELS.map((l: KeeperLevel) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                disabled={session.phase === 'flight'}
                className={`${segment} ${level === l ? on : off}`}
                onClick={() => controller.updateSettings({ level: l })}
              >
                {KEEPER_PROFILES[l].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-chalk/55">
            Higher levels react faster, reach further and read curl. The aiming guide also gets less precise.
          </p>
        </Section>

        <Section title="Shooting spot">
          <div className="grid grid-cols-2 gap-1.5">
            {PRACTICE_SPOTS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={session.spotIndex === i}
                className={`${segment} ${session.spotIndex === i ? on : off}`}
                onClick={() => controller.selectSpot(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-chalk/55">Scoring moves you to the next spot automatically.</p>
        </Section>

        <Section title="Sound">
          <div className="flex gap-1.5">
            <button type="button" aria-pressed={ui.settings.sound} className={`${segment} ${ui.settings.sound ? on : off}`} onClick={() => controller.updateSettings({ sound: true })}>
              On
            </button>
            <button type="button" aria-pressed={!ui.settings.sound} className={`${segment} ${!ui.settings.sound ? on : off}`} onClick={() => controller.updateSettings({ sound: false })}>
              Off
            </button>
          </div>
        </Section>

        <Section title="Motion">
          <div className="flex gap-1.5">
            {([
              [null, 'System'],
              [false, 'Full'],
              [true, 'Reduced'],
            ] as const).map(([v, label]) => (
              <button key={label} type="button" aria-pressed={rm === v} className={`${segment} ${rm === v ? on : off}`} onClick={() => controller.updateSettings({ reducedMotion: v })}>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-chalk/55">Reduced removes slow motion, camera moves, confetti and crowd bounce.</p>
        </Section>

        <Section title="Graphics">
          <div className="flex gap-1.5">
            {(['auto', 'high', 'low'] as Quality[]).map((q) => (
              <button key={q} type="button" aria-pressed={ui.settings.quality === q} className={`${segment} capitalize ${ui.settings.quality === q ? on : off}`} onClick={() => controller.updateSettings({ quality: q })}>
                {q}
              </button>
            ))}
          </div>
          {ui.settings.quality === 'auto' && ui.lowQuality && <p className="mt-1.5 text-xs text-chalk/55">Auto switched to low detail to keep things smooth.</p>}
        </Section>

        <Section title="Controls">
          <ul className="space-y-1 text-sm text-chalk/80">
            <li>
              <b className="text-chalk">Touch / mouse:</b> press on the ball, drag toward the goal, release to shoot.
            </li>
            <li>Direction aims · length is power · curve the drag to curl it.</li>
            <li>Strike low on the ball to lift it, high on the ball to drive it low.</li>
            <li>Release close to the ball (or drag down) to cancel.</li>
            <li className="pt-1">
              <b className="text-chalk">Keyboard:</b> ← → aim · ↑ ↓ height · W / S power · Q / E curl · Enter or Space shoot · Esc cancel · M sound · P settings
            </li>
          </ul>
        </Section>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-chalk/85 hover:bg-white/5"
            onClick={() => {
              controller.restart();
              onClose();
            }}
          >
            Restart practice
          </button>
          <button type="button" className="flex-1 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-midnight" onClick={onClose}>
            Back to the pitch
          </button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-chalk/45">
          Unranked practice: nothing is uploaded or saved except these settings on this device.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="label mb-1.5 text-gold">{title}</h3>
      {children}
    </section>
  );
}

function SoundOnIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zm8.1-2.3l1.9 1.5-2 3.4-2.3-.9a7.6 7.6 0 01-2 1.2l-.4 2.4h-4l-.4-2.4a7.6 7.6 0 01-2-1.2l-2.3.9-2-3.4 1.9-1.5a7.7 7.7 0 010-2.4L2.6 9.3l2-3.4 2.3.9a7.6 7.6 0 012-1.2L9.3 3h4l.4 2.6a7.6 7.6 0 012 1.2l2.3-.9 2 3.4-1.9 1.5a7.7 7.7 0 010 2.4z"
        fill="currentColor"
      />
    </svg>
  );
}
