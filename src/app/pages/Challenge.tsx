import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Challenge as ChallengeData } from '../../shared/competition/api';
import { runTotals } from '../../shared/competition/cup';
import type { RunTotals } from '../../shared/competition/cup';
import { flagEmoji } from '../../shared/competition/identity';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageShell } from '../components/PageShell';
import { GoldButton, Notice, Panel } from '../components/Ui';
import { api } from '../lib/api';

const GameView = lazy(() => import('../../game/GameView'));

export function Challenge() {
  const { runId = '' } = useParams();
  const [c, setC] = useState<ChallengeData | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mine, setMine] = useState<RunTotals | null>(null);

  useEffect(() => {
    api.challenge(runId).then(
      (d) => {
        setC(d);
        document.title = `Beat ${d.handle ?? 'this'} ${d.score} — The Golden Run`;
      },
      () => setMissing(true),
    );
  }, [runId]);

  if (playing && c) {
    return (
      <div className="fixed inset-0 z-40 bg-midnight">
        <ErrorBoundary fallback={(e) => <div className="p-6 text-center" role="alert">The game failed to start: {e.message}</div>}>
          <Suspense fallback={<p role="status" className="p-6 text-center text-chalk/70">Loading the stadium…</p>}>
            <GameView
              mode={{
                course: c.scenarioIds,
                label: 'Challenge · Practice · Unranked',
                exitTo: `/c/${c.runId}`,
                onExit: () => setPlaying(false),
                onCourseComplete: (snap) => {
                  setMine(runTotals(snap.results));
                  setPlaying(false);
                },
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (missing) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">Challenge not found</h1>
        <p className="mt-2 text-chalk/70">Only verified Golden Cup runs can be shared as challenges.</p>
        <Link to="/cup" className="mt-4 inline-block text-gold underline">Play this week’s cup</Link>
      </PageShell>
    );
  }
  if (!c) return <PageShell><p role="status" className="text-chalk/60">Loading challenge…</p></PageShell>;

  const who = c.handle ? `${c.country ? flagEmoji(c.country) + ' ' : ''}${c.handle}` : 'A private player';
  return (
    <PageShell>
      <p className="label text-gold">Golden Cup {c.weekId} · challenge</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">Beat {c.score.toLocaleString('en-US')}</h1>
      <p className="mt-2 text-lg text-chalk/80">
        {who} scored <b>{c.score.toLocaleString('en-US')}</b> with {c.goals}/12 goals{c.rank ? ` (rank #${c.rank})` : ''} — verified by our server.
        Same 12 spots, same keepers. Your turn.
      </p>
      <div className="mt-6 grid max-w-xl gap-4">
        {mine && (
          <Panel className={mine.skillScore > c.score ? 'border-gold' : ''}>
            <p className="label text-gold">Your practice attempt · unranked</p>
            <p className="mt-1">
              <span className="display text-5xl font-extrabold italic text-gold">{mine.skillScore.toLocaleString('en-US')}</span> pts · {mine.goals}/12 goals
            </p>
            <p className="mt-1 text-chalk/80">{mine.skillScore > c.score ? 'You beat it! 🏆' : mine.skillScore === c.score ? 'Dead level.' : `${c.score - mine.skillScore} short — go again.`}</p>
          </Panel>
        )}
        <div className="flex flex-wrap gap-3">
          <GoldButton onClick={() => setPlaying(true)}>{mine ? 'Try again' : 'Take the challenge'}</GoldButton>
          {c.weekIsCurrent && <Link to="/cup" className="self-center text-sm text-gold underline">Enter this week’s ranked cup</Link>}
        </div>
        <Notice tone="info">
          Challenge attempts are practice: free, unlimited and not ranked. {c.weekIsCurrent ? 'For a ranked score, play your weekly entry in the Golden Cup.' : 'This course is from a past week.'}
        </Notice>
      </div>
    </PageShell>
  );
}
