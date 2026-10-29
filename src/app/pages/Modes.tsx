import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageShell } from '../components/PageShell';
import { UPCOMING_MODES } from '../modes';

export function Modes() {
  useEffect(() => {
    document.title = 'Game modes — The Golden Run';
  }, []);
  return (
    <PageShell>
      <p className="label text-gold">2008 → 1,000</p>
      <h1 className="display text-5xl font-extrabold uppercase italic">Game modes</h1>
      <p className="mt-2 max-w-xl text-chalk/70">
        Practice is playable today. Competitive modes arrive once player accounts and server-verified results are in place.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link to="/play" className="rounded-2xl border border-gold/50 bg-gradient-to-br from-pitch-dark/60 to-midnight p-6 hover:border-gold">
          <p className="label text-gold">Live now · unranked</p>
          <p className="display mt-1 text-3xl font-extrabold uppercase italic">Practice</p>
          <p className="mt-2 text-sm text-chalk/75">Five shooting spots, three keepers, unlimited attempts. Nothing is recorded or ranked.</p>
        </Link>
        {UPCOMING_MODES.map((m) => (
          <Link key={m.path} to={m.path} className="rounded-2xl border border-white/10 bg-night/60 p-6 hover:border-white/25">
            <p className="label text-chalk/50">Coming later · {m.kicker}</p>
            <p className="display mt-1 text-3xl font-extrabold uppercase italic text-chalk/90">{m.title}</p>
            <p className="mt-2 text-sm text-chalk/60">{m.blurb}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
