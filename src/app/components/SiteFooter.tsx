/**
 * The one footer for every content page (home and PageShell). Never rendered
 * over gameplay: /play and in-run views are full-screen and have no footer.
 */
import { Link } from 'react-router';
import { COPYRIGHT_YEAR, CREATOR, SITE, STUDIO } from '../../shared/site';
import { Unofficial } from './Brand';

export function XIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

const link = 'hover:text-gold focus-visible:text-gold';

export function SiteFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-8 ${className}`}>
      <div className="border-t border-white/10 pt-6 sm:flex sm:items-start sm:justify-between sm:gap-8">
        <nav aria-label="Footer" className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm text-chalk/70 sm:flex sm:flex-wrap sm:gap-x-5">
          <Link to="/modes" className={link}>Modes</Link>
          <Link to="/rules" className={link}>Rules</Link>
          <Link to="/terms" className={link}>Terms</Link>
          <Link to="/privacy" className={link}>Privacy</Link>
          <Link to="/about" className={`${link} col-span-2`}>About & credits</Link>
        </nav>
        <p className="mt-4 text-sm text-chalk/70 sm:mt-0 sm:text-right">
          <span className="label mr-2 text-[10px] text-chalk/50">Support</span>
          <a href={`mailto:${SITE.supportEmail}`} className={`${link} underline decoration-white/20 underline-offset-4`}>
            {SITE.supportEmail}
          </a>
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2 text-xs text-chalk/60 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={CREATOR.x}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-chalk/80 transition hover:border-gold/50 hover:text-gold"
          aria-label={`Built by ${CREATOR.xHandle} (${CREATOR.name}) on X, opens in a new tab`}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-chalk text-midnight transition group-hover:bg-gold">
            <XIcon />
          </span>
          <span>
            Built by <b className="font-semibold">{CREATOR.xHandle}</b>
          </span>
        </a>
        <p>
          © {COPYRIGHT_YEAR}{' '}
          <a href={STUDIO.url} target="_blank" rel="noopener" className={`${link} text-chalk/80 underline decoration-white/20 underline-offset-4`}>
            {STUDIO.name}
          </a>
          . All rights reserved.
        </p>
      </div>

      <Unofficial className="mt-4 max-w-3xl" />
    </footer>
  );
}
