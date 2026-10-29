import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { HallOfFameEntry, Leaderboard as Board } from '../../shared/competition/api';
import { flagEmoji } from '../../shared/competition/identity';
import { CountrySelect } from '../components/CountrySelect';
import { PageShell } from '../components/PageShell';
import { GhostButton, Notice } from '../components/Ui';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { countryName, localDateTime } from '../lib/format';

type Tab = 'weekly' | 'country' | 'career' | 'hall';
const TABS: [Tab, string][] = [
  ['weekly', 'Weekly global'],
  ['country', 'Weekly country'],
  ['career', 'Career goals'],
  ['hall', 'Hall of Fame'],
];
const PAGE = 50;

export function Leaderboard() {
  const { bootstrap } = useAccount();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'weekly') as Tab;
  const country = params.get('country');
  const offset = Number(params.get('offset') ?? '0') || 0;
  const [board, setBoard] = useState<Board | null>(null);
  const [hall, setHall] = useState<HallOfFameEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Leaderboards — The Golden Run';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        if (tab === 'hall') {
          const h = await api.hallOfFame();
          if (!cancelled) setHall(h.entries);
        } else if (tab === 'country' && !country) {
          if (!cancelled) setBoard(null);
        } else {
          const p: Record<string, string> = { kind: tab, offset: String(offset), limit: String(PAGE) };
          if (tab === 'country' && country) p.country = country;
          const b = await api.leaderboard(p);
          if (!cancelled) setBoard(b);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [tab, country, offset]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  };
  const me = bootstrap?.player?.handle;

  return (
    <PageShell>
      <p className="label text-gold">Verified results only</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">Leaderboards</h1>
      <div className="mt-6 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => set({ tab: t, offset: null })}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-gold text-midnight' : 'bg-white/5 text-chalk/80 hover:bg-white/10'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'country' && (
        <div className="mt-4 max-w-xs">
          <CountrySelect value={country} onChange={(c) => set({ country: c, offset: null })} />
          <p className="mt-1 text-xs text-chalk/55">Countries are chosen by players, never detected. Big and small nations rank on the same per-player scores.</p>
        </div>
      )}

      <div className="mt-5">
        {error && <Notice tone="error">{error}</Notice>}
        {loading && <p role="status" className="text-sm text-chalk/60">Loading…</p>}
        {!loading && tab === 'hall' && hall && <Hall entries={hall} />}
        {!loading && tab !== 'hall' && board && <Table board={board} me={me} onPage={(o) => set({ offset: String(o) })} />}
        {!loading && tab === 'country' && !country && <p className="text-chalk/60">Pick a country to see its ranking.</p>}
      </div>
    </PageShell>
  );
}

function Table({ board, me, onPage }: { board: Board; me?: string; onPage: (offset: number) => void }) {
  const weekly = board.kind !== 'career';
  return (
    <div>
      <p className="text-xs text-chalk/55">
        {weekly ? <>Week <b>{board.weekId}</b> (resets Monday 00:00 UTC){board.country ? <> · {flagEmoji(board.country)} {countryName(board.country)}</> : null} · </> : 'All verified career goals · '}
        rules {board.rulesetVersion} · refreshed {localDateTime(board.generatedAt)} · {board.total} player{board.total === 1 ? '' : 's'}
      </p>
      {board.rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-night/60 p-6 text-chalk/70">
          No verified results yet{weekly ? ' this week' : ''}. <Link to="/cup" className="text-gold underline">Be the first on the board.</Link>
        </div>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead className="label text-[10px] text-chalk/50">
            <tr>
              <th className="py-2 pr-2">#</th>
              <th className="py-2">Player</th>
              {weekly && <th className="py-2 text-right">Goals</th>}
              <th className="py-2 text-right">{weekly ? 'Score' : 'Goals'}</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((r, i) => (
              <tr key={i} className={`border-t border-white/5 ${r.handle && r.handle === me ? 'bg-gold/10' : ''}`}>
                <td className="py-2 pr-2 tabular-nums text-chalk/70">{r.rank}</td>
                <td className="py-2">
                  {r.handle ? (
                    <Link to={`/u/${r.handle}`} className="font-semibold hover:text-gold">{r.country ? `${flagEmoji(r.country)} ` : ''}{r.handle}</Link>
                  ) : (
                    <span className="text-chalk/45">Private player</span>
                  )}
                </td>
                {weekly && <td className="py-2 text-right tabular-nums">{r.goals}</td>}
                <td className="py-2 text-right font-semibold tabular-nums text-gold">{r.score.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {board.total > board.limit && (
        <div className="mt-4 flex gap-2">
          <GhostButton disabled={board.offset === 0} onClick={() => onPage(Math.max(0, board.offset - board.limit))}>Previous</GhostButton>
          <GhostButton disabled={board.offset + board.limit >= board.total} onClick={() => onPage(board.offset + board.limit)}>Next</GhostButton>
        </div>
      )}
      <p className="mt-4 text-xs text-chalk/50">
        Ties: points, then goals, then precision, then fewer misses; still level means a shared rank. Runs held for review appear only once confirmed.
      </p>
    </div>
  );
}

function Hall({ entries }: { entries: HallOfFameEntry[] }) {
  if (entries.length === 0) {
    return <div className="rounded-2xl border border-white/10 bg-night/60 p-6 text-chalk/70">No Golden Cup has been settled yet. Weekly winners appear here after each cup closes.</div>;
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {entries.map((e, i) => (
        <li key={i} className="rounded-xl border border-gold/25 bg-night/60 p-4">
          <p className="label text-gold">{e.weekId} · {e.reviewState === 'confirmed' ? 'Confirmed winner' : 'Provisional winner'}</p>
          <p className="display mt-1 text-2xl font-extrabold uppercase italic">
            {e.handle ? <Link to={`/u/${e.handle}`}>{e.country ? `${flagEmoji(e.country)} ` : ''}{e.handle}</Link> : 'Private player'}
          </p>
          <p className="text-sm text-chalk/70">{e.score.toLocaleString('en-US')} pts</p>
        </li>
      ))}
    </ul>
  );
}
