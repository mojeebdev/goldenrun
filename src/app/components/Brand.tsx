import { Link } from 'react-router';

export function Wordmark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  if (size === 'lg') {
    return (
      <h1 className="display text-center font-extrabold italic uppercase leading-[0.82]">
        <span className="block text-[clamp(18px,3.4vw,30px)] tracking-[0.42em] text-chalk/80 not-italic font-semibold">The</span>
        <span className="gold-text block text-[clamp(64px,15vw,168px)]">Golden Run</span>
      </h1>
    );
  }
  return (
    <Link to="/" className="display flex items-center gap-2 text-lg font-extrabold italic uppercase tracking-wide text-chalk">
      <BallMark />
      <span>
        The <span className="text-gold">Golden Run</span>
      </span>
    </Link>
  );
}

export function BallMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#f7f5ef" />
      <path d="M32 18l13 9.5-5 15.5H24l-5-15.5z" fill="#14161c" stroke="#e8b84a" strokeWidth="3" />
      <circle cx="32" cy="32" r="28" fill="none" stroke="#e8b84a" strokeWidth="4" />
    </svg>
  );
}

export function Unofficial({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-chalk/55 ${className}`}>
      The Golden Run is an unofficial, independent fan-made football game. It is not affiliated with, endorsed by or
      connected to any player, club, league, award or rights holder. All artwork and sound are original.
    </p>
  );
}
