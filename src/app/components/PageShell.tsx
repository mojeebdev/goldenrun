import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAccount } from '../lib/account';
import { Unofficial, Wordmark } from './Brand';

export function PageShell({ children }: { children: ReactNode }) {
  const { bootstrap } = useAccount();
  const player = bootstrap?.player;
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#14203a_0%,#05070d_60%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-[max(14px,var(--safe-top))] sm:px-8">
        <Wordmark />
        <nav className="flex items-center gap-1 text-sm" aria-label="Main">
          <Link to="/cup" className="hidden rounded-full px-3 py-2 text-chalk/80 hover:text-gold sm:inline">Cup</Link>
          <Link to="/leaderboard" className="hidden rounded-full px-3 py-2 text-chalk/80 hover:text-gold sm:inline">Leaderboards</Link>
          <Link to={player ? '/account' : '/login'} className="rounded-full px-3 py-2 text-chalk/80 hover:text-gold">
            {player ? player.handle : 'Sign in'}
          </Link>
          <Link
            to="/play"
            className="display ml-1 rounded-full bg-gold px-5 py-2 text-lg font-extrabold uppercase italic text-midnight hover:bg-gold-bright"
          >
            Play
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 sm:px-8">
        <nav className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-chalk/55" aria-label="Footer">
          <Link to="/modes" className="hover:text-gold">Modes</Link>
          <Link to="/rules" className="hover:text-gold">Rules</Link>
          <Link to="/terms" className="hover:text-gold">Terms</Link>
          <Link to="/privacy" className="hover:text-gold">Privacy</Link>
          <Link to="/about" className="hover:text-gold">About & credits</Link>
        </nav>
        <Unofficial />
      </footer>
    </div>
  );
}
