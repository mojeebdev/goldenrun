import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Progress } from '../../shared/competition/api';
import { FOUNDING_GOALS, MILESTONES, ROAD, ROAD_TIERS } from '../../shared/competition/progression';
import { flagEmoji } from '../../shared/competition/identity';
import { PageShell } from '../components/PageShell';
import { loadRun, storageKey, useRunFlow } from '../components/RunFlow';
import { GoldButton, Notice, Panel } from '../components/Ui';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { durationLabel } from '../lib/format';

export function Road() {
  const { bootstrap, clockOffset } = useAccount();
  const [progress, setProgress] = useState<Progress | null>(null);
  const reload = useCallback(() => {
    api.progress().then(setProgress, () => setProgress(null));
  }, []);
  const flow = useRunFlow('road', reload);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    document.title = 'Road to 1,000 — The Golden Run';
    reload();
  }, [reload]);

  if (flow.view) return flow.view;
  const signedIn = !!bootstrap?.player;
  const goals = progress?.careerGoals ?? 0;
  const saved = signedIn ? loadRun(storageKey('road'), now + clockOffset) : null;
  const founding = progress?.founding;
  const earned = new Set(progress?.awards.filter((a) => a.type === 'milestone').map((a) => a.label));

  return (
    <PageShell>
      <p className="label text-gold">Career · every verified goal counts once</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">Road to 1,000</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          <Panel>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="label text-chalk/55">Verified career goals</p>
                <p className="display text-7xl font-extrabold italic leading-none text-gold">{goals.toLocaleString('en-US')}</p>
              </div>
              <div className="text-right">
                <p className="label text-chalk/55">Tier</p>
                <p className="display text-2xl font-extrabold uppercase italic">{progress?.tier ?? 'Academy'}</p>
              </div>
            </div>
            <div className="relative mt-4 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={1000} aria-valuenow={goals}>
              <div className="h-full bg-gradient-to-r from-gold-deep to-gold-bright" style={{ width: `${Math.min(100, goals / 10)}%` }} />
              {MILESTONES.slice(0, -1).map((m) => (
                <span key={m} className="absolute top-0 h-full w-px bg-midnight/70" style={{ left: `${m / 10}%` }} />
              ))}
            </div>
            <ol className="mt-3 flex flex-wrap gap-2">
              {MILESTONES.map((m) => {
                const got = earned.has(`${m.toLocaleString('en-US')} career goals`);
                return (
                  <li key={m} className={`rounded-full px-3 py-1 text-xs font-semibold ${got ? 'bg-gold text-midnight' : 'bg-white/5 text-chalk/60'}`}>
                    {got ? '🏅 ' : ''}{m.toLocaleString('en-US')}
                  </li>
                );
              })}
            </ol>
            {progress?.nextMilestone && <p className="mt-2 text-xs text-chalk/55">{progress.nextMilestone - goals} to your next milestone.</p>}
          </Panel>

          {flow.result}
          {flow.error && <Notice tone="error">{flow.error}</Notice>}

          <Panel>
            <h2 className="display text-2xl font-extrabold uppercase italic">Play a career run</h2>
            <p className="mt-1 text-sm text-chalk/70">
              {ROAD.shots} shots on a course our server picks at random. Keepers get tougher as your total grows. Every goal the
              server verifies is yours for good: one goal, one step. Also counts: ranked Golden Cup goals and the first 7 goals on each 2008 matchday.
            </p>
            <p className="mt-2 text-xs text-chalk/55">Each run has {durationLabel(ROAD.targetSeconds)} on the clock, plus {ROAD.graceSeconds} seconds of extra time.</p>
            <div className="mt-4">
              {!signedIn ? (
                <Notice tone="info">
                  Career goals belong to a player. <Link to="/join" className="text-gold underline">Create one</Link> or{' '}
                  <Link to="/login" className="text-gold underline">sign in</Link>.
                </Notice>
              ) : saved ? (
                <GoldButton onClick={() => flow.resume(saved)}>Resume run ({saved.commands.length}/{ROAD.shots})</GoldButton>
              ) : (
                <GoldButton disabled={flow.busy} onClick={() => void flow.start()}>Start a career run</GoldButton>
              )}
            </div>
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel className="border-gold/40">
            <p className="label text-gold">The Founding Golden Fan</p>
            <h2 className="display mt-1 text-3xl font-extrabold uppercase italic">First to {FOUNDING_GOALS.toLocaleString('en-US')}</h2>
            {founding?.state === 'open' || !founding ? (
              <p className="mt-2 text-sm text-chalk/75">Unclaimed. The first player whose 1,000th goal our server accepts earns this permanent in-game title, after an audit.</p>
            ) : (
              <p className="mt-2 text-sm text-chalk/80">
                {founding.state === 'provisional' ? 'Provisional — under audit: ' : 'Confirmed: '}
                <b className="text-chalk">{founding.handle ? `${founding.country ? flagEmoji(founding.country) + ' ' : ''}${founding.handle}` : 'a private player'}</b>
              </p>
            )}
            <p className="mt-2 text-xs text-chalk/50">Unofficial in-game recognition. No prize, no affiliation with any player, club or award.</p>
          </Panel>
          <Panel>
            <p className="label text-chalk/55">Difficulty tiers</p>
            <ul className="mt-2 space-y-1 text-sm">
              {ROAD_TIERS.map((t) => (
                <li key={t.name} className={`flex justify-between rounded-lg px-3 py-1.5 ${progress?.tier === t.name ? 'bg-gold/15 text-gold' : 'bg-white/5'}`}>
                  <span>{t.name}</span>
                  <span className="text-chalk/60">{t.minGoals}+ · {t.levels.join(' / ')}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
