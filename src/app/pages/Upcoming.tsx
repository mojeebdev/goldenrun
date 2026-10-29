import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageShell } from '../components/PageShell';
import { UPCOMING_MODES } from '../modes';

const PROFILE = {
  path: '/u',
  title: 'Player profiles',
  kicker: 'Opt-in',
  blurb: 'Public profiles with verified career goals and badges arrive with player accounts.',
};

export function Upcoming({ path }: { path: string }) {
  const mode = UPCOMING_MODES.find((m) => m.path === path) ?? PROFILE;
  useEffect(() => {
    document.title = `${mode.title} (coming later) — The Golden Run`;
  }, [mode.title]);
  return (
    <PageShell>
      <p className="label text-gold">Coming later · {mode.kicker}</p>
      <h1 className="display text-5xl font-extrabold uppercase italic sm:text-6xl">{mode.title}</h1>
      <p className="mt-3 max-w-xl text-lg text-chalk/75">{mode.blurb}</p>
      <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-night/60 p-5 text-sm text-chalk/70">
        This mode is not live yet. There are no accounts, rankings or recorded results in the current version — only
        unranked practice. Scores here will only ever come from server-verified shots.
      </div>
      <Link
        to="/play"
        className="display mt-8 inline-flex rounded-full bg-gold px-8 py-3 text-2xl font-extrabold uppercase italic text-midnight hover:bg-gold-bright"
      >
        Practice now
      </Link>
    </PageShell>
  );
}
