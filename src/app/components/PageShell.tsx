import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Unofficial, Wordmark } from './Brand';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#14203a_0%,#05070d_60%)]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-[max(14px,var(--safe-top))] sm:px-8">
        <Wordmark />
        <Link
          to="/play"
          className="display rounded-full bg-gold px-5 py-2 text-lg font-extrabold uppercase italic text-midnight hover:bg-gold-bright"
        >
          Play
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-10 sm:px-8">
        <Unofficial />
      </footer>
    </div>
  );
}
