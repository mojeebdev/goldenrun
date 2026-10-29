/**
 * Mode hub: every way to play, with the player's own status on each card so
 * the next step is obvious. Guests see what a free player unlocks.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Me, Progress } from '../../shared/competition/api';
import { CHAPTER_TARGET } from '../../shared/competition/progression';
import { PageShell } from '../components/PageShell';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { relativeTime } from '../lib/format';
import { MODES } from '../modes';
import { nextStep } from '../lib/nextStep';

function cupStatus(me: Me | null): string | null {
  const e = me?.cupEntry;
  if (!me) return null;
  if (!e) return 'Not played this week';
  switch (e.state) {
    case 'accepted':
      return `This week: ${e.skillScore ?? 0} pts${e.rank ? ` · rank #${e.rank}` : ''}`;
    case 'pending_review':
      return 'This week: held for review';
    case 'started':
      return 'This week: in progress';
    case 'expired':
      return 'This week: expired';
    default:
      return 'This week: not accepted';
  }
}

export function Modes() {
  const { bootstrap, clockOffset } = useAccount();
  const player = bootstrap?.player ?? null;
  const [progress, setProgress] = useState<Progress | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    document.title = 'Game modes — The Golden Run';
  }, []);
  useEffect(() => {
    if (!player) return;
    api.progress().then(setProgress, () => setProgress(null));
    api.me().then(setMe, () => setMe(null));
  }, [player]);

  const step = nextStep(progress);
  const status: Record<string, string | null> = {
    '/2008': progress
      ? progress.chapter.badge
        ? `Badge earned · ${progress.chapter.total}/${CHAPTER_TARGET}`
        : `${progress.chapter.total}/${CHAPTER_TARGET} chapter goals · ${step.to === '/2008' ? step.detail.split(' · ')[0] : 'complete'}`
      : null,
    '/road-to-1000': progress ? `${progress.careerGoals.toLocaleString('en-US')} career goals · ${progress.tier}` : null,
    '/cup': cupStatus(me),
    '/leaderboard': null,
  };
  const cupCloses = bootstrap?.cup ? `closes ${relativeTime(bootstrap.cup.endsAt, now + clockOffset)}` : null;

  return (
    <PageShell>
      <p className="label text-gold">2008 → 1,000</p>
      <h1 className="display text-5xl font-extrabold uppercase italic">Game modes</h1>

      {player ? (
        <Link to={step.to} className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-gold bg-gold/10 p-4 hover:bg-gold/15">
          <span>
            <span className="label text-gold">Up next for {player.handle}</span>
            <span className="display block text-2xl font-extrabold uppercase italic">{step.label}</span>
            <span className="block text-sm text-chalk/70">{progress ? step.detail : 'Loading your progress…'}</span>
          </span>
          <span aria-hidden="true" className="text-2xl text-gold">›</span>
        </Link>
      ) : (
        <div className="mt-5 rounded-2xl border border-gold/40 bg-night/70 p-4">
          <p className="text-sm text-chalk/80">
            Practice is open to everyone. The 2008 chapter, Road to 1,000 and the Golden Cup save verified goals to a free player.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link to="/join" className="display rounded-full bg-gold px-5 py-2 text-lg font-extrabold uppercase italic text-midnight">
              Create free player
            </Link>
            <Link to="/login" className="text-sm text-chalk/75 underline">Sign in</Link>
          </div>
        </div>
      )}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        <li>
          <Link to="/play" className="block h-full rounded-2xl border border-white/10 bg-gradient-to-br from-pitch-dark/60 to-midnight p-5 hover:border-gold">
            <p className="label text-gold">Open to everyone · unranked</p>
            <p className="display mt-1 text-3xl font-extrabold uppercase italic">Practice</p>
            <p className="mt-1 text-sm text-chalk/70">Pick your keeper and spot. Unlimited shots, nothing recorded.</p>
          </Link>
        </li>
        {MODES.map((m) => {
          const line = status[m.path];
          return (
            <li key={m.path}>
              <Link to={m.path} className="block h-full rounded-2xl border border-white/10 bg-night/60 p-5 hover:border-white/25">
                <p className="label text-gold">
                  {m.kicker}
                  {m.path === '/cup' && cupCloses ? ` · ${cupCloses}` : ''}
                </p>
                <p className="display mt-1 text-3xl font-extrabold uppercase italic text-chalk/90">{m.title}</p>
                <p className="mt-1 text-sm text-chalk/65">{m.blurb}</p>
                {line ? (
                  <p className="mt-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-chalk/85">{line}</p>
                ) : !player && m.path !== '/leaderboard' ? (
                  <p className="mt-3 inline-block rounded-full bg-white/5 px-3 py-1 text-xs text-chalk/55">Needs a free player</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
