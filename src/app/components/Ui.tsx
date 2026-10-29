import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function GoldButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`display inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-bright to-gold px-7 text-xl font-extrabold uppercase italic text-midnight shadow-[0_0_30px_rgba(232,184,74,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function GhostButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-chalk/90 transition hover:bg-white/5 disabled:opacity-50 ${className}`}
    />
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-night/70 p-5 ${className}`}>{children}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warn'; children: ReactNode }) {
  const tones = {
    info: 'border-white/15 bg-white/5 text-chalk/85',
    error: 'border-[#e0563f]/50 bg-[#e0563f]/10 text-[#ffb3a5]',
    success: 'border-pitch/60 bg-pitch/15 text-[#a8e6b4]',
    warn: 'border-gold/40 bg-gold/10 text-gold-bright',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label text-gold">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-chalk/55">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/15 bg-midnight/70 px-4 py-3 text-base text-chalk placeholder:text-chalk/35 focus:border-gold focus:outline-none';
