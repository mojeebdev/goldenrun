import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { PlayerProfile } from '../../shared/competition/api';
import { PageShell } from '../components/PageShell';
import { Panel } from '../components/Ui';
import { api } from '../lib/api';
import { countryLabel } from '../lib/format';

export function Profile() {
  const { username = '' } = useParams();
  const [p, setP] = useState<PlayerProfile | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    document.title = `${username} — The Golden Run`;
    setP(null);
    setMissing(false);
    api.player(username).then(setP, () => setMissing(true));
  }, [username]);

  if (missing) {
    return (
      <PageShell>
        <h1 className="display text-5xl font-extrabold uppercase italic">No public player</h1>
        <p className="mt-2 text-chalk/70">“{username}” doesn’t exist or keeps their profile private.</p>
        <Link to="/leaderboard" className="mt-4 inline-block text-gold underline">Leaderboards</Link>
      </PageShell>
    );
  }
  if (!p) return <PageShell><p role="status" className="text-chalk/60">Loading…</p></PageShell>;
  return (
    <PageShell>
      <p className="label text-gold">{countryLabel(p.country) || 'Player'} · since {new Date(p.joinedAt).toLocaleDateString()}</p>
      <h1 className="display text-6xl font-extrabold uppercase italic">{p.handle}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Panel>
          <p className="label text-chalk/55">Road to 1,000</p>
          <p className="display mt-1 text-5xl font-extrabold italic text-gold">{p.careerGoals}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" aria-label={`${p.careerGoals} of 1,000 goals`}>
            <div className="h-full bg-gold" style={{ width: `${Math.min(100, p.careerGoals / 10)}%` }} />
          </div>
          <p className="mt-2 text-xs text-chalk/55">Verified career goals (ranked cup goals).</p>
        </Panel>
        <Panel className="md:col-span-2">
          <p className="label text-chalk/55">Golden Cup results</p>
          {p.cupResults.length === 0 ? (
            <p className="mt-2 text-sm text-chalk/60">No verified cup results yet.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {p.cupResults.map((r) => (
                <li key={r.weekId} className="flex justify-between rounded-lg bg-white/5 px-3 py-1.5">
                  <span>{r.weekId}</span>
                  <span className="tabular-nums">{r.score.toLocaleString('en-US')} pts · {r.goals} goals{r.rank ? ` · #${r.rank}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
          {p.awards.length > 0 && (
            <p className="mt-3 text-sm text-gold">
              {p.awards.map((a) => `🏆 ${a.weekId ?? ''} cup winner${a.reviewState === 'provisional' ? ' (provisional)' : ''}`).join(' · ')}
            </p>
          )}
        </Panel>
      </div>
      <p className="mt-6 text-xs text-chalk/50">In-game, unofficial recognition only. Not affiliated with any player, club, league or award.</p>
    </PageShell>
  );
}
