/**
 * Phone navigation: a bottom tab bar within thumb reach. Hidden from `sm` up,
 * where the header has room for the same links.
 */
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAccount } from '../lib/account';

const icon = 'h-5 w-5';
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const ICONS: Record<string, ReactNode> = {
  play: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <circle cx="12" cy="12" r="9" {...stroke} />
      <path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" />
    </svg>
  ),
  modes: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.5" {...stroke} />
      <rect x="13" y="4" width="7" height="7" rx="1.5" {...stroke} />
      <rect x="4" y="13" width="7" height="7" rx="1.5" {...stroke} />
      <rect x="13" y="13" width="7" height="7" rx="1.5" {...stroke} />
    </svg>
  ),
  cup: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path d="M7 4h10v4a5 5 0 01-10 0zM7 6H4.5a2.5 2.5 0 002.8 3M17 6h2.5a2.5 2.5 0 01-2.8 3M12 13v4M8.5 20h7M10 17h4" {...stroke} />
    </svg>
  ),
  ranks: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path d="M5 20v-6h4v6M10 20V9h4v11M15 20v-9h4v9M3 20h18" {...stroke} />
    </svg>
  ),
  me: (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" {...stroke} />
      <path d="M5 20a7 7 0 0114 0" {...stroke} />
    </svg>
  ),
};

export function TabBar() {
  const { bootstrap } = useAccount();
  const player = bootstrap?.player;
  const tabs: [string, string, string][] = [
    ['/play', 'Play', 'play'],
    ['/modes', 'Modes', 'modes'],
    ['/cup', 'Cup', 'cup'],
    ['/leaderboard', 'Ranks', 'ranks'],
    [player ? '/account' : '/join', player ? 'Me' : 'Join', 'me'],
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night/95 pb-[var(--safe-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map(([to, label, key]) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? 'text-gold' : 'text-chalk/65'}`
              }
            >
              {ICONS[key]}
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
