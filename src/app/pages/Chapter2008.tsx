import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Progress } from '../../shared/competition/api';
import { CHAPTER_2008, CHAPTER_QUOTA, CHAPTER_TARGET, ROAD } from '../../shared/competition/progression';
import { getScenario } from '../../shared/rules';
import { PageShell } from '../components/PageShell';
import { loadRun, storageKey, useRunFlow } from '../components/RunFlow';
import { GoldButton, Notice, Panel } from '../components/Ui';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { durationLabel } from '../lib/format';

export function Chapter2008() {
  const { bootstrap, clockOffset } = useAccount();
  const [progress, setProgress] = useState<Progress | null>(null);
  const reload = useCallback(() => {
    api.progress().then(setProgress, () => setProgress(null));
  }, []);
  const flow = useRunFlow('chapter', reload);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    document.title = '2008: The Beginning — The Golden Run';
    reload();
  }, [reload]);

  if (flow.view) return flow.view;
  const signedIn = !!bootstrap?.player;
  const total = progress?.chapter.total ?? 0;

  return (
    <PageShell>
      <p className="label text-gold">Chapter one · six matchdays · {CHAPTER_TARGET} goals</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">
        2008 <span className="text-gold">·</span> The Beginning
      </h1>
      <p className="mt-2 max-w-2xl text-chalk/75">
        A breakthrough season told in six fictional matchdays. Each one counts up to {CHAPTER_QUOTA} verified goals toward the
        chapter. Reach {CHAPTER_TARGET} to earn the 2008 badge. These are original scenes, not recreations of real matches.
      </p>
      <p className="mt-1 text-xs text-chalk/55">Each matchday has {durationLabel(ROAD.targetSeconds)} on the clock for 10 shots, plus {ROAD.graceSeconds} seconds of extra time.</p>

      <div className="mt-6 max-w-2xl">
        <div className="flex items-baseline justify-between text-sm">
          <span className="label text-chalk/60">Chapter goals</span>
          <span className="display text-3xl font-extrabold italic text-gold">
            {total}/{CHAPTER_TARGET}
          </span>
        </div>
        <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Chapter goals" aria-valuemin={0} aria-valuemax={CHAPTER_TARGET} aria-valuenow={total}>
          <div className="h-full bg-gradient-to-r from-gold-deep to-gold-bright" style={{ width: `${(total / CHAPTER_TARGET) * 100}%` }} />
        </div>
        {progress?.chapter.badge && <p className="mt-3 text-gold">🏅 2008 badge earned — it’s on your profile.</p>}
      </div>

      <div className="mt-6 grid max-w-2xl gap-3">
        {flow.result}
        {flow.error && <Notice tone="error">{flow.error}</Notice>}
        {!signedIn && (
          <Notice tone="info">
            Chapter goals are verified and saved to your player, so you need one (free, passkey sign-in).{' '}
            <Link to="/join" className="text-gold underline">Create a player</Link> · <Link to="/login" className="text-gold underline">Sign in</Link>
          </Notice>
        )}
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-2">
        {CHAPTER_2008.map((st) => {
          const sp = progress?.chapter.stages.find((x) => x.stage === st.stage);
          const goals = sp?.goals ?? 0;
          const unlocked = sp?.unlocked ?? st.stage === 1;
          const saved = signedIn ? loadRun(storageKey('chapter', st.stage), now + clockOffset) : null;
          const legendary = st.scenarioIds.filter((id) => getScenario(id)?.keeper.level === 'legendary').length;
          return (
            <li key={st.stage}>
              <Panel className={unlocked ? '' : 'opacity-60'}>
                <p className="label text-chalk/55">Matchday {st.stage}{legendary ? ` · ${legendary} legendary keepers` : ''}</p>
                <h2 className="display mt-1 text-3xl font-extrabold uppercase italic">{st.title}</h2>
                <p className="mt-1 text-sm text-chalk/70">{st.blurb}</p>
                <div className="mt-3 flex items-center gap-1" role="img" aria-label={`${goals} of ${CHAPTER_QUOTA} chapter goals`}>
                  {Array.from({ length: CHAPTER_QUOTA }, (_, i) => (
                    <span key={i} className={`h-2 flex-1 rounded-full ${i < goals ? 'bg-gold' : 'bg-white/10'}`} />
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {!unlocked ? (
                    <span className="text-sm text-chalk/55">🔒 Score {CHAPTER_QUOTA} on matchday {st.stage - 1} to unlock</span>
                  ) : saved ? (
                    <GoldButton onClick={() => flow.resume(saved)}>Resume ({saved.commands.length}/10)</GoldButton>
                  ) : !signedIn ? (
                    <Link to="/join" className="display rounded-full border-2 border-gold/70 px-5 py-1.5 text-lg font-extrabold uppercase italic text-gold hover:border-gold">
                      Create a player to play
                    </Link>
                  ) : (
                    <GoldButton disabled={flow.busy} onClick={() => void flow.start(st.stage)}>
                      {goals >= CHAPTER_QUOTA ? 'Replay' : 'Kick off'}
                    </GoldButton>
                  )}
                  {goals >= CHAPTER_QUOTA && <span className="text-sm text-gold">Complete ✓</span>}
                </div>
              </Panel>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-xs text-chalk/50">
        Want to rehearse first? <Link to="/play" className="underline">Practice is free and unlimited.</Link> Matchdays have no daily limit; replays don’t add goals past each quota.
      </p>
    </PageShell>
  );
}
