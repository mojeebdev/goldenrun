import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Progress } from '../../shared/competition/api';
import { BallMark, Unofficial, Wordmark } from '../components/Brand';
import { StadiumHero } from '../components/StadiumHero';
import { TabBar } from '../components/TabBar';
import { api } from '../lib/api';
import { useAccount } from '../lib/account';
import { nextStep } from '../lib/nextStep';

const preloadGame = () => import('../../game/GameView');

const primary =
  'display group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-gradient-to-b from-gold-bright to-gold px-8 text-2xl font-extrabold uppercase italic tracking-wide text-midnight shadow-[0_0_40px_rgba(232,184,74,0.45)] transition hover:scale-[1.03] active:scale-[0.98]';
const secondary =
  'display inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-gold/70 bg-midnight/60 px-8 text-xl font-extrabold uppercase italic tracking-wide text-gold backdrop-blur transition hover:border-gold hover:bg-midnight/80 active:scale-[0.98]';

export function Home() {
  const { bootstrap, loading } = useAccount();
  const player = bootstrap?.player ?? null;
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    document.title = 'The Golden Run — 2008 → 1,000';
    // Stream the game in the background so PLAY NOW is instant.
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(() => void preloadGame()) : window.setTimeout(() => void preloadGame(), 1200);
    return () => {
      if (!w.requestIdleCallback) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    api.progress().then(setProgress, () => setProgress(null));
  }, [player]);

  const step = nextStep(progress);

  return (
    <div className="min-h-full bg-midnight pb-[calc(64px+var(--safe-bottom))] sm:pb-0">
      <section className="relative isolate flex min-h-[calc(100svh-64px-var(--safe-bottom))] flex-col overflow-hidden sm:min-h-[100svh]">
        <StadiumHero className="absolute inset-0 -z-10 h-full w-full" preserve="xMidYMax slice" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-midnight/75 via-midnight/5 via-55% to-midnight/95" />

        <header role="banner" className="flex items-center justify-between gap-2 px-4 pt-[max(12px,var(--safe-top))] sm:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="The Golden Run home">
            <BallMark className="h-7 w-7" />
            <span className="label text-chalk/80">goldenrun.fun</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Site">
            <Link className="hidden rounded-full px-3 py-2 text-chalk/80 hover:text-gold sm:inline" to="/modes">Modes</Link>
            <Link className="hidden rounded-full px-3 py-2 text-chalk/80 hover:text-gold sm:inline" to="/cup">Cup</Link>
            <Link className="hidden rounded-full px-3 py-2 text-chalk/80 hover:text-gold sm:inline" to="/leaderboard">Leaderboards</Link>
            {!loading && (
              <Link className="whitespace-nowrap rounded-full border border-white/15 bg-midnight/50 px-4 py-2 text-chalk/90 backdrop-blur hover:text-gold" to={player ? '/account' : '/login'}>
                {player ? player.handle : 'Sign in'}
              </Link>
            )}
          </nav>
        </header>

        <main className="flex flex-1 flex-col items-center px-4 pt-[6vh] text-center sm:pt-[3vh]">
          <p className="label mb-3 rounded-full border border-gold/30 bg-midnight/60 px-3 py-1 text-gold backdrop-blur">Unofficial football arcade</p>
          <div id="home-title">
            <Wordmark size="lg" />
          </div>
          <p className="display mt-3 text-[clamp(28px,6vw,54px)] font-extrabold italic text-chalk">
            2008 <span className="text-gold">→</span> 1,000
          </p>
          <p className="mt-1 max-w-md text-[15px] text-chalk/80 sm:text-base">The road to greatness starts with one goal.</p>

          <div className="mt-auto mb-[6vh] flex w-full max-w-sm flex-col items-stretch gap-3 sm:mb-[10vh] [@media(max-height:520px)]:mt-4 [@media(max-height:520px)]:max-w-xl [@media(max-height:520px)]:flex-row [@media(max-height:520px)]:flex-wrap [@media(max-height:520px)]:justify-center [@media(max-height:520px)]:[&>a]:flex-1">
            {player ? (
              <>
                <Link to={step.to} className={primary}>
                  {step.label}
                  <span aria-hidden="true" className="transition group-hover:translate-x-1">▶</span>
                </Link>
                <p className="label -mt-1 text-chalk/75 [@media(max-height:520px)]:order-last [@media(max-height:520px)]:mt-0 [@media(max-height:520px)]:basis-full">{progress ? step.detail : `Welcome back, ${player.handle}`}</p>
                <Link to="/play" onMouseEnter={() => void preloadGame()} onFocus={() => void preloadGame()} className={secondary}>
                  Practice
                </Link>
              </>
            ) : (
              <>
                <Link to="/play" onMouseEnter={() => void preloadGame()} onFocus={() => void preloadGame()} className={primary}>
                  Play now
                  <span aria-hidden="true" className="transition group-hover:translate-x-1">▶</span>
                </Link>
                <Link to="/join" className={secondary}>
                  Create free player
                </Link>
                <p className="label text-chalk/70 [@media(max-height:520px)]:basis-full">Practice needs no sign-up · a player keeps your goals</p>
              </>
            )}
          </div>
        </main>
      </section>

      <footer className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <nav className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk/55" aria-label="Footer">
          <Link to="/modes" className="hover:text-gold">Modes</Link>
          <Link to="/rules" className="hover:text-gold">Rules</Link>
          <Link to="/terms" className="hover:text-gold">Terms</Link>
          <Link to="/privacy" className="hover:text-gold">Privacy</Link>
          <Link to="/about" className="hover:text-gold">About & credits</Link>
        </nav>
        <Unofficial />
      </footer>
      <TabBar />
    </div>
  );
}
