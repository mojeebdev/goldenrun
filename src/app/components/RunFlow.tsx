/**
 * Plays one server-issued verified run (2008 chapter matchday or Road to
 * 1,000), saves progress on this device, submits the shot inputs and shows the
 * server's verdict. Points and goals only count once the Worker confirms them.
 */
import { lazy, Suspense, useCallback, useState } from 'react';
import type { RunSummary, StartedRun } from '../../shared/competition/api';
import { runTotals } from '../../shared/competition/cup';
import type { RunTotals } from '../../shared/competition/cup';
import type { ShotCommand } from '../../shared/rules';
import { ApiError, api } from '../lib/api';
import { useAccount } from '../lib/account';
import { ErrorBoundary } from './ErrorBoundary';
import { GhostButton, GoldButton, Notice, Panel } from './Ui';

const GameView = lazy(() => import('../../game/GameView'));

interface Stored {
  run: StartedRun;
  commands: ShotCommand[];
  idempotencyKey: string;
}

export function storageKey(mode: 'chapter' | 'road', stage?: number) {
  return `goldenrun.run.${mode}${stage ? `.${stage}` : ''}.v1`;
}

/** `serverNow` is the server's clock (device time + measured offset): deadlines are server times. */
export function loadRun(key: string, serverNow: number): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    const s = raw ? (JSON.parse(raw) as Stored) : null;
    return s && s.run.deadlineAt > serverNow ? s : null;
  } catch {
    return null;
  }
}

function saveRun(key: string, s: Stored | null) {
  try {
    if (s) localStorage.setItem(key, JSON.stringify(s));
    else localStorage.removeItem(key);
  } catch {
    /* storage blocked — the run still works, it just can't resume */
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'play'; stored: Stored }
  | { kind: 'submitting'; local: RunTotals }
  | { kind: 'unsent'; stored: Stored; local: RunTotals; error: string }
  | { kind: 'done'; summary: RunSummary; local: RunTotals };

export function useRunFlow(mode: 'chapter' | 'road', onSettled?: () => void) {
  const { clockOffset } = useAccount();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (key: string, s: Stored, local: RunTotals) => {
      setPhase({ kind: 'submitting', local });
      try {
        const summary = await api.submitRun(s.run.runId, s.run.nonce, s.idempotencyKey, s.commands);
        saveRun(key, null);
        setPhase({ kind: 'done', summary, local });
      } catch (e) {
        const err = e as ApiError;
        if ([404, 409, 410].includes(err.status)) {
          try {
            const summary = await api.getRun(s.run.runId);
            saveRun(key, null);
            setPhase({ kind: 'done', summary, local });
            return;
          } catch {
            /* fall through */
          }
        }
        setPhase({ kind: 'unsent', stored: s, local, error: err.message });
      } finally {
        onSettled?.();
      }
    },
    [onSettled],
  );

  const start = useCallback(
    async (stage?: number) => {
      setError(null);
      try {
        const run = await api.startTraining(mode, stage);
        const stored: Stored = { run, commands: [], idempotencyKey: crypto.randomUUID() };
        saveRun(storageKey(mode, stage), stored);
        setPhase({ kind: 'play', stored });
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [mode],
  );

  const resume = useCallback((stored: Stored) => setPhase({ kind: 'play', stored }), []);

  const view =
    phase.kind === 'play' ? (
      <div className="fixed inset-0 z-40 bg-midnight">
        <ErrorBoundary fallback={(e) => <div className="p-6 text-center" role="alert">The game failed to start: {e.message}</div>}>
          <Suspense fallback={<p role="status" className="p-6 text-center text-chalk/70">Loading the stadium…</p>}>
            <GameView
              mode={{
                course: phase.stored.run.scenarioIds,
                ranked: true,
                restore: phase.stored.commands,
                exitTo: mode === 'chapter' ? '/2008' : '/road-to-1000',
                onExit: () => {
                  setPhase({ kind: 'idle' });
                  onSettled?.();
                },
                label: mode === 'chapter' ? `2008 · Matchday ${phase.stored.run.stage} · Verified` : 'Road to 1,000 · Verified',
                timer: { targetEndsAt: phase.stored.run.targetEndsAt, deadlineAt: phase.stored.run.deadlineAt, clockOffset },
                onShotResolved: (snap) => saveRun(storageKey(mode, phase.stored.run.stage ?? undefined), { ...phase.stored, commands: snap.commands }),
                onCourseComplete: (snap) => {
                  const key = storageKey(mode, phase.stored.run.stage ?? undefined);
                  const done = { ...phase.stored, commands: snap.commands };
                  saveRun(key, done);
                  void submit(key, done, runTotals(snap.results));
                },
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    ) : null;

  const result =
    phase.kind === 'submitting' ? (
      <Panel className="border-gold/40">
        <p className="label text-gold" role="status">Verifying your shots…</p>
        <p className="mt-1 text-chalk/75">Your device counted {phase.local.goals} goals. The server’s replay decides.</p>
      </Panel>
    ) : phase.kind === 'unsent' ? (
      <Panel className="border-[#e0563f]/40">
        <Notice tone="error">Not submitted yet: {phase.error}</Notice>
        <p className="mt-2 text-sm text-chalk/75">Your shots are saved on this device until the deadline.</p>
        <GoldButton className="mt-3" onClick={() => void submit(storageKey(mode, phase.stored.run.stage ?? undefined), phase.stored, phase.local)}>
          Try again
        </GoldButton>
      </Panel>
    ) : phase.kind === 'done' ? (
      <RunResult summary={phase.summary} onClose={() => setPhase({ kind: 'idle' })} />
    ) : null;

  return { start, resume, view, result, error, busy: phase.kind === 'submitting' };
}

function RunResult({ summary, onClose }: { summary: RunSummary; onClose: () => void }) {
  const held = summary.state === 'pending_review';
  const credited = summary.creditedGoals ?? 0;
  return (
    <Panel className="border-gold/40">
      <p className="label text-gold">{summary.mode === 'chapter' ? `Matchday ${summary.stage} result` : 'Road to 1,000 result'}</p>
      {held ? (
        <Notice tone="warn">Held for a quick human review — it looked unusually fast or flawless. Your goals count once it’s confirmed.</Notice>
      ) : summary.state === 'accepted' ? (
        <Notice tone="success">Verified by the server.</Notice>
      ) : (
        <Notice tone="error">This run wasn’t accepted ({summary.state}).</Notice>
      )}
      <p className="mt-3">
        <span className="display text-5xl font-extrabold italic text-gold">+{credited}</span> career goal{credited === 1 ? '' : 's'} ·{' '}
        {summary.goals ?? 0}/{summary.shots?.length ?? 10} scored
      </p>
      {summary.mode === 'chapter' && (summary.goals ?? 0) > credited && !held && (
        <p className="mt-1 text-xs text-chalk/60">Each matchday counts up to 7 chapter goals. Extra goals here don’t add to your totals — move on to the next matchday.</p>
      )}
      {summary.shots && (
        <ol className="mt-3 grid grid-cols-10 gap-1" aria-label="Shot by shot">
          {summary.shots.map((sh) => (
            <li key={sh.idx} title={`${sh.idx + 1}: ${sh.outcome}`} className={`rounded-md py-1 text-center text-xs ${sh.goal ? 'bg-gold text-midnight' : 'bg-white/10 text-chalk/60'}`}>
              {sh.goal ? '⚽' : '×'}
            </li>
          ))}
        </ol>
      )}
      <GhostButton className="mt-4" onClick={onClose}>Close</GhostButton>
    </Panel>
  );
}
