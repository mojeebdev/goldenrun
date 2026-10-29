import { useEffect } from 'react';
import { Link } from 'react-router';
import { BallMark, Unofficial, Wordmark } from '../components/Brand';
import { StadiumHero } from '../components/StadiumHero';
import { UPCOMING_MODES } from '../modes';
import { useAccount } from '../lib/account';

const preloadGame = () => import('../../game/GameView');

function HomeAccountLink() {
  const { bootstrap } = useAccount();
  const p = bootstrap?.player;
  return (
    <Link className="whitespace-nowrap rounded-full px-3 py-2 text-chalk/80 hover:text-gold" to={p ? '/account' : '/login'}>
      {p ? p.handle : 'Sign in'}
    </Link>
  );
}

export function Home() {
  useEffect(() => {
    document.title = 'The Golden Run — 2008 → 1,000';
    // Stream the game in the background so PLAY NOW is instant.
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => void preloadGame()) : window.setTimeout(() => void preloadGame(), 1200);
    return () => {
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
  }, []);

  return (
    <div className="min-h-full bg-midnight">
      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden">
        <StadiumHero className="absolute inset-0 -z-10 h-full w-full" preserve="xMidYMax slice" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-midnight/70 via-transparent to-midnight/30" />

        <header className="flex items-center justify-between px-4 pt-[max(12px,var(--safe-top))] sm:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="The Golden Run home">
            <BallMark className="h-7 w-7" />
            <span className="label text-chalk/80">goldenrun.fun</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Main">
            <Link className="rounded-full px-3 py-2 text-chalk/80 hover:text-gold" to="/modes">
              Modes
            </Link>
            <Link className="rounded-full px-3 py-2 text-chalk/80 hover:text-gold" to="/cup">
              Cup
            </Link>
            <Link className="whitespace-nowrap rounded-full px-3 py-2 text-chalk/80 hover:text-gold" to="/leaderboard">
              Leaderboards
            </Link>
            <HomeAccountLink />
          </nav>
        </header>

        <div className="flex flex-1 flex-col items-center justify-start px-4 pt-[7vh] pb-[30vh] text-center sm:pt-[1vh]">
          <p className="label mb-3 rounded-full border border-gold/30 bg-midnight/60 px-3 py-1 text-gold backdrop-blur">
            Unofficial football arcade
          </p>
          <Wordmark size="lg" />
          <p className="display mt-3 text-[clamp(28px,6vw,54px)] font-extrabold italic text-chalk">
            2008 <span className="text-gold">→</span> 1,000
          </p>
          <p className="mt-1 max-w-md text-[15px] text-chalk/80 sm:text-base">The road to greatness starts with one goal.</p>
          <div className="flex flex-col items-center sm:absolute sm:left-1/2 sm:top-[72%] sm:-translate-x-1/2 sm:-translate-y-1/2">
          <Link
            to="/play"
            onMouseEnter={() => void preloadGame()}
            onFocus={() => void preloadGame()}
            className="display group mt-7 inline-flex sm:mt-0 min-h-14 items-center gap-3 rounded-full bg-gradient-to-b from-gold-bright to-gold px-10 text-2xl font-extrabold uppercase italic tracking-wide text-midnight shadow-[0_0_40px_rgba(232,184,74,0.45)] transition hover:scale-[1.03] active:scale-[0.98]"
          >
            Play now
            <span aria-hidden="true" className="transition group-hover:translate-x-1">
              ▶
            </span>
          </Link>
          <p className="label mt-3 text-chalk/60">No sign-up · instant practice</p>
          </div>
        </div>

      </section>

      <section className="mx-auto max-w-5xl px-4 pt-10 sm:px-8" aria-label="How to play">
        <ul className="grid gap-2 sm:grid-cols-3">
          {[
            ['Drag', 'Swipe from the ball. Direction aims, length is power.'],
            ['Bend', 'Curve your swipe to curl it round the keeper.'],
            ['Strike', 'Hit low on the ball to lift it into the top corner.'],
          ].map(([t, d]) => (
            <li key={t} className="flex items-baseline gap-3 rounded-xl border border-white/10 bg-night/60 p-3">
              <p className="display w-16 text-lg font-extrabold uppercase italic text-gold">{t}</p>
              <p className="text-sm text-chalk/75">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-8" aria-labelledby="modes-title">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="label text-gold">The road ahead</p>
            <h2 id="modes-title" className="display text-4xl font-extrabold uppercase italic">
              Game modes
            </h2>
          </div>
          <Link to="/modes" className="label text-chalk/70 hover:text-gold">
            All modes →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/play" className="rounded-2xl border border-gold/40 bg-gradient-to-br from-pitch-dark/60 to-midnight p-5 hover:border-gold">
            <p className="label text-gold">Live now</p>
            <p className="display mt-1 text-2xl font-extrabold uppercase italic">Practice</p>
            <p className="mt-1 text-sm text-chalk/75">Unlimited unranked shots against Rookie, Professional or Legendary keepers.</p>
          </Link>
          {UPCOMING_MODES.map((m) => (
            <Link key={m.path} to={m.path} className="rounded-2xl border border-white/10 bg-night/60 p-5 hover:border-white/25">
              <p className={`label ${m.live ? 'text-gold' : 'text-chalk/50'}`}>{m.live ? 'Live now' : 'Coming later'} · {m.kicker}</p>
              <p className="display mt-1 text-2xl font-extrabold uppercase italic text-chalk/90">{m.title}</p>
              <p className="mt-1 text-sm text-chalk/60">{m.blurb}</p>
            </Link>
          ))}
        </div>
        <Unofficial className="mt-10 max-w-2xl" />
      </section>
    </div>
  );
}
