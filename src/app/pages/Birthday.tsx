import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { BirthdayMatch, BirthdayResponse, DateRef } from '../../shared/birthday';
import {
  BIRTHDAY_PATH, KITS, birthdayUrl, bestMatch, daysInMonth, formatMinute, haulLabel, headline, isBirthdayHost,
  monthName, parseBirthday, resultWord, shareText, xIntentUrl,
} from '../../shared/birthday';
import { SITE } from '../../shared/site';
import { ShareButton } from '../components/ShareButton';

const goldButton = 'display inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold px-8 text-xl font-extrabold uppercase italic text-midnight shadow-[0_0_32px_rgba(232,184,74,0.32)] transition hover:brightness-110 active:scale-[0.98]';
const outlineButton = 'inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-chalk transition hover:border-gold hover:text-gold';
const selectClass = 'min-h-14 rounded-2xl border border-white/20 bg-night px-4 text-lg font-semibold text-chalk focus:border-gold';

type Load = { state: 'idle' } | { state: 'loading'; key: string } | { state: 'ready'; data: BirthdayResponse } | { state: 'error'; key: string };

/** Data the Worker embedded for the first render (see src/worker/birthday.ts). */
function embedded(key: string): BirthdayResponse | null {
  const el = typeof document === 'undefined' ? null : document.getElementById('birthday-data');
  if (!el?.textContent) return null;
  try {
    const d = JSON.parse(el.textContent) as BirthdayResponse;
    return d.key === key ? d : null;
  } catch {
    return null;
  }
}

export function Birthday() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const onSubdomain = isBirthdayHost(window.location.hostname);
  const base = onSubdomain ? '' : BIRTHDAY_PATH;
  const gameUrl = onSubdomain ? SITE.url : '';
  const ref = useMemo(() => (slug ? parseBirthday(slug) : null), [slug]);
  const [load, setLoad] = useState<Load>(() => {
    const d = ref ? embedded(ref.key) : null;
    return d ? { state: 'ready', data: d } : { state: 'idle' };
  });

  // Normalise 08-02 / august-2 → aug-2 so every share uses one URL.
  useEffect(() => {
    if (ref && ref.slug !== slug.toLowerCase()) navigate(`${base}/${ref.slug}`, { replace: true });
  }, [ref, slug, base, navigate]);

  useEffect(() => {
    if (!ref) {
      document.title = 'Has Ronaldo scored on your birthday? · The Golden Run';
      return;
    }
    if (load.state === 'ready' && load.data.key === ref.key) return;
    let cancelled = false;
    setLoad({ state: 'loading', key: ref.key });
    fetch(`/api/v1/birthday/${ref.key}`)
      .then((r) => (r.ok ? (r.json() as Promise<BirthdayResponse>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => !cancelled && setLoad({ state: 'ready', data }))
      .catch(() => !cancelled && setLoad({ state: 'error', key: ref.key }));
    return () => {
      cancelled = true;
    };
    // load is intentionally not a dependency: it is the effect's output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref?.key]);

  useEffect(() => {
    if (load.state === 'ready') {
      document.title = load.data.total
        ? `Ronaldo has scored ${load.data.total} on ${load.data.label} · The Golden Run`
        : `Ronaldo has never scored on ${load.data.label} · The Golden Run`;
    }
  }, [load]);

  const data = load.state === 'ready' && ref && load.data.key === ref.key ? load.data : null;

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_at_top,#14203a_0%,#05070d_60%)]">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 pt-[max(14px,var(--safe-top))] sm:px-8">
        <Link to={`${base}/`} className="display text-2xl font-extrabold uppercase italic tracking-tight text-chalk">
          CR7 <span className="text-gold">× your birthday</span>
        </Link>
        <a href={`${gameUrl}/play`} className="display rounded-full bg-gold px-5 py-2 text-lg font-extrabold uppercase italic text-midnight hover:bg-gold-bright">
          Play
        </a>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-8">
        <section className="relative isolate overflow-hidden rounded-[28px] border border-gold/20 bg-[radial-gradient(ellipse_at_75%_15%,#53401c_0%,#14203a_34%,#05070d_78%)] px-5 py-9 sm:px-10 sm:py-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-20 -z-10 select-none font-display text-[300px] font-extrabold italic leading-none text-gold/[0.07] sm:text-[420px]">7</div>
          <p className="label text-gold">{data ? `${data.label} · Official goals` : 'The trend everyone is checking'}</p>
          {!data ? (
            <h1 className="display mt-5 max-w-2xl text-[clamp(48px,9vw,96px)] font-extrabold uppercase italic leading-[0.86] tracking-tight">
              Has Ronaldo scored <span className="gold-text">on your birthday?</span>
            </h1>
          ) : (
            <ResultHero data={data} />
          )}
          {ref && load.state === 'loading' && <p role="status" className="mt-6 text-gold">Checking {ref.label}…</p>}
          {load.state === 'error' && <p role="alert" className="mt-6 text-chalk/80">Couldn&apos;t load that date. Check your connection and try again.</p>}
          {slug && !ref && <p role="alert" className="mt-6 text-chalk/80">That isn&apos;t a date we recognise. Pick your birthday below.</p>}

          {data && <ShareRow data={data} />}

          <DatePicker key={ref?.key ?? 'none'} initial={ref} compact={Boolean(data)} onPick={(r) => navigate(`${base}/${r.slug}`)} />
        </section>

        {data && data.total > 0 && (
          <section aria-label={`Matches on ${data.label}`} className="mt-8 space-y-4">
            {data.matches.map((m) => <MatchCard key={`${m.date}-${m.opponent}`} match={m} />)}
          </section>
        )}

        {data && data.total === 0 && data.nearest && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-night/70 p-6">
            <p className="label text-gold">So close</p>
            <p className="mt-2 text-chalk/80">The nearest dates he has scored on:</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className={outlineButton} to={`${base}/${data.nearest.before.slug}`}>← {data.nearest.before.label}</Link>
              <Link className={outlineButton} to={`${base}/${data.nearest.after.slug}`}>{data.nearest.after.label} →</Link>
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-gold/25 bg-gold/[0.06] p-6 sm:p-8">
          <p className="label text-gold">Your turn</p>
          <h2 className="display mt-2 text-4xl font-extrabold uppercase italic leading-none">Score one for your birthday</h2>
          <p className="mt-3 max-w-xl text-chalk/75">The Golden Run is a free football arcade in your browser. Drag, curl and strike past the keeper. No sign-up needed.</p>
          <a href={`${gameUrl}/play`} className={`${goldButton} mt-5`}>Play The Golden Run <span className="ml-3" aria-hidden="true">▶</span></a>
        </section>

        <p className="mt-8 text-xs leading-relaxed text-chalk/50">
          Official competitive goals for club and country only. Friendlies for clubs are not counted; senior international friendlies are.
          {data ? ` ${data.career.total.toLocaleString('en-US')} goals up to ${formatDate(data.career.updated)}.` : ''} Minutes for Portugal goals before October 2017 are still being added.
          Dates are the local match date. An independent fan project, not affiliated with or endorsed by Cristiano Ronaldo, his clubs or the Portuguese Football Federation.
          Spot a mistake? <a className="underline hover:text-gold" href={`mailto:${SITE.supportEmail}?subject=Birthday%20goal%20correction`}>Tell us</a>.
        </p>
      </main>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${monthName(m!)} ${d}, ${y}`;
}

function ResultHero({ data }: { data: BirthdayResponse }) {
  if (data.total === 0) {
    return (
      <>
        <h1 className="display mt-5 text-[clamp(64px,14vw,150px)] font-extrabold uppercase italic leading-[0.82] tracking-tight">
          Not <span className="gold-text">yet.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-chalk/80">{headline(data).replace(/^Not yet\. /, '')} {data.career.total.toLocaleString('en-US')} career goals and not one on your birthday.</p>
      </>
    );
  }
  const best = bestMatch(data.matches)!;
  const haul = haulLabel(best.goals.length);
  return (
    <>
      <h1 className="display mt-5 text-[clamp(64px,14vw,150px)] font-extrabold uppercase italic leading-[0.82] tracking-tight">
        <span className="gold-text">Yes.</span> {data.total}
        <span className="text-[0.45em] text-chalk/70"> goal{data.total === 1 ? '' : 's'}</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-relaxed text-chalk/80">
        {headline(data).replace(/^Yes\. /, '')} {haul ? `Best of all: a ${haul.toLowerCase()} against ${best.opponent} in ${best.year}.` : `Most recently against ${data.matches.at(-1)!.opponent} in ${data.matches.at(-1)!.year}.`}
      </p>
    </>
  );
}

function ShareRow({ data }: { data: BirthdayResponse }) {
  const [copied, setCopied] = useState(false);
  const url = birthdayUrl(data.slug);
  const best = bestMatch(data.matches);
  return (
    <div className="mt-7 flex flex-wrap items-center gap-3">
      <a className={goldButton} href={xIntentUrl(data)} target="_blank" rel="noopener noreferrer">
        Share on X <span className="ml-3" aria-hidden="true">𝕏</span>
      </a>
      <ShareButton
        label="Share card"
        text={shareText(data)}
        spec={{
          kicker: `Ronaldo on ${data.label}`,
          title: data.total ? 'Scored on my birthday' : 'Never on my birthday',
          big: data.total ? `${data.total} goal${data.total === 1 ? '' : 's'}` : 'Not yet',
          sub: best ? `${haulLabel(best.goals.length) ?? 'Goal'} vs ${best.opponent} · ${best.year}` : 'Has he scored on yours?',
          url,
        }}
      />
      <button
        type="button"
        className={outlineButton}
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        {copied ? 'Link copied ✓' : 'Copy link'}
      </button>
    </div>
  );
}

function DatePicker({ initial, compact, onPick }: { initial: DateRef | null; compact: boolean; onPick: (r: DateRef) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(initial ? Number(initial.key.slice(0, 2)) : 0);
  const [day, setDay] = useState(initial ? Number(initial.key.slice(3)) : 0);
  const maxDay = month ? daysInMonth(month) : 31;
  const ready = month > 0 && day > 0 && day <= maxDay;
  return (
    <form
      className={compact ? 'mt-8 border-t border-white/10 pt-6' : 'mt-8'}
      onSubmit={(e) => {
        e.preventDefault();
        const r = ready ? parseBirthday(`${month}-${day}`) : null;
        if (r) onPick(r);
      }}
    >
      <p className="label text-chalk/60">{compact ? 'Check another birthday' : 'Your birthday'}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <label className="sr-only" htmlFor="bday-month">Month</label>
        <select id="bday-month" className={`${selectClass} min-w-40`} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          <option value={0} disabled>Month</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{monthName(i + 1)}</option>)}
        </select>
        <label className="sr-only" htmlFor="bday-day">Day</label>
        <select id="bday-day" className={`${selectClass} min-w-24`} value={day} onChange={(e) => setDay(Number(e.target.value))}>
          <option value={0} disabled>Day</option>
          {Array.from({ length: maxDay }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
        </select>
        <button type="submit" disabled={!ready} className={`${compact ? outlineButton : goldButton} disabled:opacity-40`}>
          {compact ? 'Check' : 'Show me'}
        </button>
      </div>
      {!compact && (
        <button
          type="button"
          className="mt-4 text-sm text-chalk/60 underline-offset-4 hover:text-gold hover:underline"
          onClick={() => {
            const r = parseBirthday(`${today.getMonth() + 1}-${today.getDate()}`);
            if (r) onPick(r);
          }}
        >
          Or check today ({monthName(today.getMonth() + 1)} {today.getDate()})
        </button>
      )}
    </form>
  );
}

const VENUE = { H: 'Home', A: 'Away', N: 'Neutral' } as const;

function MatchCard({ match }: { match: BirthdayMatch }) {
  const kit = KITS[match.team];
  const haul = haulLabel(match.goals.length);
  const minutes = match.goals.map(formatMinute).filter(Boolean);
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-night/80 pl-3">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-3" style={{ background: `linear-gradient(${kit.primary} 0 62%, ${kit.secondary} 62% 100%)` }} />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
        <div className="shrink-0">
          <p className="display text-6xl font-extrabold italic leading-none text-gold">{match.year}</p>
          <p className="label mt-1 text-chalk/55">{VENUE[match.venue]}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide" style={{ background: kit.primary, color: kit.ink }}>{kit.short}</span>
            <span className="label text-chalk/60">{match.competition}</span>
          </div>
          <h3 className="display mt-2 text-3xl font-extrabold uppercase italic leading-tight sm:text-4xl">
            {match.team} <span className="text-gold">{match.teamScore}–{match.oppScore}</span> {match.opponent}
          </h3>
          <p className="mt-1 text-sm text-chalk/70">
            {resultWord(match)}{match.stadium ? <> · <span aria-label="Stadium">📍 {match.stadium}</span></> : null}
          </p>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="display text-4xl font-extrabold italic leading-none">
            {match.goals.length}<span className="ml-1 text-lg text-chalk/60">{match.goals.length === 1 ? 'goal' : 'goals'}</span>
          </p>
          {haul && <p className="display mt-1 inline-block -skew-x-6 rounded bg-gold px-2 py-0.5 text-sm font-extrabold uppercase text-midnight">{haul}</p>}
          {minutes.length > 0 && <p className="label mt-2 text-chalk/60">{minutes.join(' · ')}</p>}
        </div>
      </div>
    </article>
  );
}

export default Birthday;
