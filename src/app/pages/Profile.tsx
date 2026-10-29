import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { PlayerProfile } from '../../shared/competition/api';
import { PageShell } from '../components/PageShell';
import { GhostButton, Notice, Panel } from '../components/Ui';
import { ShareButton } from '../components/ShareButton';
import { useAccount } from '../lib/account';
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
          <p className="mt-2 text-xs text-chalk/55">Verified career goals from the Golden Cup, Road to 1,000 and 2008 matchdays.</p>
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

        </Panel>
      </div>
      <Panel className="mt-4">
        <p className="label text-chalk/55">Badges & titles</p>
        {p.awards.length === 0 ? (
          <p className="mt-2 text-sm text-chalk/60">No badges yet.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {p.awards.map((a, i) => (
              <li key={i} className={`rounded-full px-3 py-1 text-sm font-semibold ${a.type === 'founding-golden-fan' ? 'bg-gradient-to-r from-gold-deep to-gold-bright text-midnight' : 'bg-gold/15 text-gold'}`}>
                {a.type === 'founding-golden-fan' ? '👑' : a.type === 'cup-week-winner' ? '🏆' : '🏅'} {a.label}
                {a.reviewState === 'provisional' ? ' (provisional)' : ''}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <ShareButton
          label="Share profile"
          text={`${p.handle} has ${p.careerGoals} verified goals on the Road to 1,000.`}
          spec={{ kicker: 'Road to 1,000', title: p.handle, big: p.careerGoals.toLocaleString('en-US'), sub: 'verified career goals', url: `${location.origin}/u/${p.handle}` }}
        />
        <ReportLink handle={p.handle} />
      </div>
      <p className="mt-6 text-xs text-chalk/50">In-game, unofficial recognition only. Not affiliated with any player, club, league or award.</p>
    </PageShell>
  );
}

function ReportLink({ handle }: { handle: string }) {
  const { bootstrap } = useAccount();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<'nickname' | 'cheating' | 'other'>('cheating');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  if (!bootstrap?.player || bootstrap.player.handle.toLowerCase() === handle.toLowerCase()) return null;
  if (msg) return <span className="text-sm text-chalk/60">{msg}</span>;
  if (!open) {
    return (
      <button type="button" className="text-sm text-chalk/50 underline" onClick={() => setOpen(true)}>
        Report player
      </button>
    );
  }
  return (
    <div className="w-full max-w-md rounded-xl border border-white/10 bg-night/70 p-4">
      <p className="label text-chalk/60">Report {handle}</p>
      <div className="mt-2 flex gap-1.5">
        {(['cheating', 'nickname', 'other'] as const).map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-sm capitalize ${reason === r ? 'bg-gold text-midnight' : 'bg-white/5'}`}>
            {r}
          </button>
        ))}
      </div>
      <textarea className="mt-2 w-full rounded-lg border border-white/15 bg-midnight/70 p-2 text-sm" maxLength={500} rows={2}
        placeholder="Optional details" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="mt-2 flex gap-2">
        <GhostButton onClick={async () => {
          try {
            await api.report(handle, reason, note || undefined);
            setMsg('Thanks — the report was sent for review.');
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}>Send report</GhostButton>
        <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
      </div>
      <div className="mt-2"><Notice tone="info">Reports go to the site owner. Your name isn’t shown to the player.</Notice></div>
    </div>
  );
}
