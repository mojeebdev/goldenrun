import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Me, RunSummary, StartedRun } from '../../shared/competition/api';
import { runTotals } from '../../shared/competition/cup';
import type { RunTotals } from '../../shared/competition/cup';
import type { ShotCommand } from '../../shared/rules';
import { getScenario } from '../../shared/rules';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageShell } from '../components/PageShell';
import { GhostButton, GoldButton, Notice, Panel } from '../components/Ui';
import { ShareButton } from '../components/ShareButton';
import { ApiError, api } from '../lib/api';
import { useAccount } from '../lib/account';
import { durationLabel, localDateTime, relativeTime, utcDateTime } from '../lib/format';

const GameView = lazy(() => import('../../game/GameView'));

const STORE_KEY = 'goldenrun.cup.ranked.v1';

interface StoredRun {
  run: StartedRun;
  commands: ShotCommand[];
  idempotencyKey: string;
  result?: RunSummary;
}

function loadStored(): StoredRun | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as StoredRun) : null;
  } catch {
    return null;
  }
}
function saveStored(s: StoredRun | null): void {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage blocked: the run still works, it just can't resume after a reload */
  }
}

type View =
  | { kind: 'lobby' }
  | { kind: 'confirm' }
  | { kind: 'play'; ranked: boolean; stored?: StoredRun }
  | { kind: 'practice-done'; totals: RunTotals }
  | { kind: 'submitting'; stored: StoredRun; local: RunTotals }
  | { kind: 'unsent'; stored: StoredRun; local: RunTotals; error: string }
  | { kind: 'result'; summary: RunSummary; local?: RunTotals };

export function Cup() {
  const { bootstrap, clockOffset, loading, offline } = useAccount();
  const [me, setMe] = useState<Me | null>(null);
  const [view, setView] = useState<View>({ kind: 'lobby' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [renderNow] = useState(() => Date.now());
  const cup = bootstrap?.cup;

  useEffect(() => {
    document.title = 'Golden Cup — The Golden Run';
  }, []);

  const loadMe = useCallback(async () => {
    if (!bootstrap?.player) return setMe(null);
    try {
      setMe(await api.me());
    } catch {
      setMe(null);
    }
  }, [bootstrap?.player]);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const stored = useMemo(() => {
    const s = loadStored();
    return s && cup && s.run.weekId === cup.weekId ? s : null;
    // re-read whenever the view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cup, view.kind]);

  const submit = useCallback(async (s: StoredRun, local: RunTotals) => {
    setView({ kind: 'submitting', stored: s, local });
    try {
      const summary = await api.submitRun(s.run.runId, s.run.nonce, s.idempotencyKey, s.commands);
      saveStored({ ...s, result: summary });
      setView({ kind: 'result', summary, local });
      void loadMe();
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 410 || err.status === 409 || err.status === 404) {
        // Settled one way or another on the server: show the server's view.
        try {
          const summary = await api.getRun(s.run.runId);
          saveStored({ ...s, result: summary });
          setView({ kind: 'result', summary, local });
          return;
        } catch {
          /* fall through */
        }
      }
      setView({ kind: 'unsent', stored: s, local, error: err.message });
    }
  }, [loadMe]);

  if (loading) return <PageShell><p role="status" className="text-chalk/70">Loading this week’s cup…</p></PageShell>;
  if (!cup) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">Golden Cup</h1>
        <Notice tone="error">{offline ? 'Couldn’t reach the server. Check your connection and reload.' : 'The cup is unavailable right now.'}</Notice>
      </PageShell>
    );
  }

  // ---------------- playing ----------------
  if (view.kind === 'play') {
    const ranked = view.ranked;
    const s = view.stored;
    return (
      <div className="fixed inset-0 z-40 bg-midnight">
        <ErrorBoundary fallback={(e) => <div className="p-6 text-center" role="alert">The game failed to start: {e.message}</div>}>
          <Suspense fallback={<p role="status" className="p-6 text-center text-chalk/70">Loading the stadium…</p>}>
            <GameView
              mode={{
                course: ranked ? s!.run.scenarioIds : cup.scenarioIds,
                ranked,
                restore: ranked ? s!.commands : undefined,
                exitTo: '/cup',
                onExit: () => {
                  setView({ kind: 'lobby' });
                  void loadMe();
                },
                timer: ranked ? { targetEndsAt: s!.run.targetEndsAt, deadlineAt: s!.run.deadlineAt, clockOffset } : undefined,
                onShotResolved: (snap) => {
                  if (ranked) saveStored({ ...s!, commands: snap.commands });
                },
                onCourseComplete: (snap) => {
                  const local = runTotals(snap.results);
                  if (ranked) {
                    const done = { ...s!, commands: snap.commands };
                    saveStored(done);
                    void submit(done, local);
                  } else {
                    setView({ kind: 'practice-done', totals: local });
                  }
                },
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  const entry = me?.cupEntry ?? null;
  const resumable = !!(
    stored &&
    entry &&
    entry.runId === stored.run.runId &&
    entry.state === 'started' &&
    !stored.result &&
    stored.run.deadlineAt > renderNow + clockOffset
  );
  const signedIn = !!bootstrap?.player;
  const closesIn = relativeTime(cup.endsAt, renderNow + clockOffset);

  const startRanked = async () => {
    setBusy(true);
    setError(null);
    try {
      const run = await api.startRun();
      const s: StoredRun = { run: { ...run, serverNow: run.serverNow }, commands: [], idempotencyKey: crypto.randomUUID() };
      saveStored(s);
      setView({ kind: 'play', ranked: true, stored: s });
    } catch (e) {
      setError((e as Error).message);
      setView({ kind: 'lobby' });
      void loadMe();
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <p className="label text-gold">Week {cup.weekId} · closes {closesIn}</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">The Golden Cup</h1>
      <p className="mt-2 max-w-2xl text-chalk/75">
        Twelve standardised shots — the same spots, keepers and order for everyone this week, with {durationLabel(cup.targetSeconds)} on
        the clock. Your ranked score only counts once our server has replayed every shot.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-4">
          {error && <Notice tone="error">{error}</Notice>}
          <ResultPanels view={view} onRetry={(s, l) => void submit(s, l)} />

          <Panel>
            <h2 className="display text-2xl font-extrabold uppercase italic">Your ranked entry</h2>
            {!signedIn ? (
              <>
                <p className="mt-1 text-sm text-chalk/75">Ranked entries need a player account (free, passkey sign-in). You can practise this week’s course right now as a guest.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link to="/join" className="display rounded-full bg-gold px-6 py-2 text-xl font-extrabold uppercase italic text-midnight">Create player</Link>
                  <Link to="/login" className="self-center text-sm text-chalk/75 underline">Sign in</Link>
                </div>
              </>
            ) : !me ? (
              <p className="mt-1 text-sm text-chalk/60" role="status">Checking your entry…</p>
            ) : resumable ? (
              <>
                <p className="mt-1 text-sm text-chalk/75">
                  Your ranked run is in progress ({stored!.commands.length}/12 shots). Submit before {localDateTime(stored!.run.deadlineAt)}.
                </p>
                <GoldButton className="mt-4" onClick={() => setView({ kind: 'play', ranked: true, stored: stored! })}>Resume ranked run</GoldButton>
              </>
            ) : stored && stored.commands.length === 12 && !stored.result && entry?.state === 'started' ? (
              <>
                <Notice tone="warn">Your 12 shots are saved on this device but not confirmed by the server yet.</Notice>
                <GoldButton className="mt-4" onClick={() => void submit(stored, runTotals([]))}>Send now</GoldButton>
              </>
            ) : entry ? (
              <EntrySummary entry={entry} />
            ) : view.kind === 'confirm' ? (
              <>
                <Notice tone="warn">
                  Starting uses your <b>one ranked entry</b> for {cup.weekId}. You get {durationLabel(cup.targetSeconds)} for all 12 shots,
                  plus {cup.graceSeconds} seconds of extra time, and the clock starts as soon as you kick off. It keeps running if you
                  pause or leave, and leaving doesn’t give you another entry.
                </Notice>
                <div className="mt-4 flex flex-wrap gap-3">
                  <GoldButton disabled={busy} onClick={startRanked}>{busy ? 'Starting…' : 'Kick off'}</GoldButton>
                  <GhostButton onClick={() => setView({ kind: 'lobby' })}>Not yet</GhostButton>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-chalk/75">You haven’t played your ranked entry this week.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <GoldButton onClick={() => setView({ kind: 'confirm' })}>Play ranked</GoldButton>
                </div>
              </>
            )}
            {stored && entry?.state === 'started' && !resumable && stored.run.runId !== entry.runId && (
              <p className="mt-3 text-xs text-chalk/55">This entry was started on another device.</p>
            )}
            {entry?.state === 'started' && !stored && (
              <p className="mt-3 text-xs text-chalk/55">
                This ranked run was started on another device or its progress was cleared from this browser. It can only be finished
                where it began, and it expires {relativeTime(entry.deadlineAt)}.
              </p>
            )}
          </Panel>

          <Panel>
            <h2 className="display text-2xl font-extrabold uppercase italic">Practice the course</h2>
            <p className="mt-1 text-sm text-chalk/75">Unlimited, unranked, nothing sent to the server.</p>
            <GhostButton className="mt-4" onClick={() => setView({ kind: 'play', ranked: false })}>Practice this week’s 12</GhostButton>
          </Panel>
        </div>

        <Panel>
          <h2 className="display text-2xl font-extrabold uppercase italic">This week’s course</h2>
          <ol className="mt-3 space-y-1.5 text-sm">
            {cup.scenarioIds.map((id, i) => {
              const sc = getScenario(id)!;
              return (
                <li key={i} className="flex justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5">
                  <span><span className="text-chalk/50 tabular-nums">{String(i + 1).padStart(2, '0')}</span> {sc.label}</span>
                  <span className={sc.keeper.level === 'legendary' ? 'text-gold' : 'text-chalk/60'}>{sc.keeper.label}</span>
                </li>
              );
            })}
          </ol>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-chalk/65">
            <dt>Window (your time)</dt><dd className="text-right">{localDateTime(cup.startsAt)} → {localDateTime(cup.endsAt)}</dd>
            <dt>Window (UTC)</dt><dd className="text-right">{utcDateTime(cup.startsAt)} → {utcDateTime(cup.endsAt)}</dd>
            <dt>Max possible score</dt><dd className="text-right">{cup.maxScore.toLocaleString('en-US')}</dd>
            <dt>Rules version</dt><dd className="text-right">{cup.rulesetVersion} · set {cup.scenarioSetHash}</dd>
          </dl>
          <Link to="/rules" className="mt-3 inline-block text-xs text-gold underline">Scoring, ties and review rules</Link>
        </Panel>
      </div>
    </PageShell>
  );
}

function stateLabel(state: RunSummary['state']): { text: string; tone: 'success' | 'warn' | 'error' | 'info' } {
  switch (state) {
    case 'accepted':
      return { text: 'Verified', tone: 'success' };
    case 'pending_review':
      return { text: 'Held for review — not ranked yet', tone: 'warn' };
    case 'expired':
      return { text: 'Expired — not submitted in time', tone: 'error' };
    case 'rejected':
      return { text: 'Rejected', tone: 'error' };
    default:
      return { text: 'In progress', tone: 'info' };
  }
}

function EntrySummary({ entry }: { entry: RunSummary }) {
  const st = stateLabel(entry.state);
  return (
    <div className="mt-2">
      <Notice tone={st.tone}>{st.text}</Notice>
      {entry.skillScore !== null && (
        <p className="mt-3 text-chalk/80">
          <span className="display text-4xl font-extrabold italic text-gold">{entry.skillScore.toLocaleString('en-US')}</span> pts ·{' '}
          {entry.goals}/12 goals{entry.rank ? <> · rank <b>#{entry.rank}</b></> : null}
        </p>
      )}
      <p className="mt-2 text-xs text-chalk/55">One ranked entry per week. Keep practising — a new cup opens every Monday 00:00 UTC.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {entry.state === 'accepted' && <ChallengeShare run={entry} />}
        <Link to="/leaderboard" className="text-sm text-gold underline">See the leaderboard</Link>
      </div>
    </div>
  );
}

function ChallengeShare({ run }: { run: RunSummary }) {
  const url = `${location.origin}/c/${run.runId}`;
  return (
    <ShareButton
      label="Challenge friends"
      text={`I scored ${run.skillScore} in the Golden Cup ${run.weekId}. Beat my 12 shots:`}
      spec={{ kicker: `Golden Cup ${run.weekId}`, title: 'Beat my 12 shots', big: (run.skillScore ?? 0).toLocaleString('en-US'), sub: `${run.goals}/12 goals${run.rank ? ` · rank #${run.rank}` : ''} · verified`, url }}
    />
  );
}

function ResultPanels({ view, onRetry }: { view: View; onRetry: (s: StoredRun, l: RunTotals) => void }) {
  if (view.kind === 'practice-done') {
    return (
      <Panel className="border-gold/40">
        <p className="label text-gold">Practice result · unranked</p>
        <p className="mt-1"><span className="display text-4xl font-extrabold italic text-gold">{view.totals.skillScore.toLocaleString('en-US')}</span> pts · {view.totals.goals}/12 goals</p>
      </Panel>
    );
  }
  if (view.kind === 'submitting') {
    return (
      <Panel className="border-gold/40">
        <p className="label text-gold" role="status">Verifying your 12 shots…</p>
        <p className="mt-1 text-chalk/75">Provisional (your device): {view.local.skillScore.toLocaleString('en-US')} pts · {view.local.goals} goals</p>
      </Panel>
    );
  }
  if (view.kind === 'unsent') {
    return (
      <Panel className="border-[#e0563f]/40">
        <Notice tone="error">Not submitted yet: {view.error}</Notice>
        <p className="mt-2 text-sm text-chalk/75">Your shots are saved on this device. Points are only stored once the server confirms them.</p>
        <GoldButton className="mt-3" onClick={() => onRetry(view.stored, view.local)}>Try again</GoldButton>
      </Panel>
    );
  }
  if (view.kind === 'result') {
    const s = view.summary;
    const st = stateLabel(s.state);
    return (
      <Panel className="border-gold/40">
        <p className="label text-gold">Ranked result · {s.weekId}</p>
        <div className="mt-2"><Notice tone={st.tone}>{st.text}</Notice></div>
        {s.skillScore !== null && (
          <p className="mt-3">
            <span className="display text-5xl font-extrabold italic text-gold">{s.skillScore.toLocaleString('en-US')}</span> pts · {s.goals}/12 goals
            {s.rank ? <> · rank <b>#{s.rank}</b></> : null}
          </p>
        )}
        {s.state === 'accepted' && (
          <div className="mt-3">
            <ChallengeShare run={s} />
          </div>
        )}
        {view.local && s.skillScore !== null && view.local.skillScore !== s.skillScore && (
          <p className="mt-1 text-xs text-chalk/55">Your device showed {view.local.skillScore}; the server’s replay is the official result.</p>
        )}
        {s.shots && (
          <ol className="mt-3 grid grid-cols-6 gap-1 sm:grid-cols-12" aria-label="Shot by shot">
            {s.shots.map((sh) => (
              <li key={sh.idx} title={`${sh.idx + 1}: ${sh.outcome}`} className={`rounded-md py-1 text-center text-xs font-semibold ${sh.goal ? 'bg-gold text-midnight' : 'bg-white/10 text-chalk/60'}`}>
                {sh.goal ? '⚽' : '×'}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    );
  }
  return null;
}
