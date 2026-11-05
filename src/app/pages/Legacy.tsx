import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import type { RunTotals } from '../../shared/competition/cup';
import { runTotals } from '../../shared/competition/cup';
import { readTributeTarget, TRIBUTE_COURSE, tributeShareText, tributeShareUrl } from '../../shared/tribute';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageShell } from '../components/PageShell';
import { ShareButton } from '../components/ShareButton';

const GameView = lazy(() => import('../../game/GameView'));

const goldButton = 'display inline-flex min-h-14 items-center justify-center rounded-full bg-gradient-to-b from-gold-bright to-gold px-8 text-xl font-extrabold uppercase italic text-midnight shadow-[0_0_32px_rgba(232,184,74,0.32)] transition hover:brightness-110 active:scale-[0.98]';
const outlineButton = 'inline-flex min-h-12 items-center justify-center rounded-full border border-white/25 px-6 text-sm font-semibold text-chalk transition hover:border-gold hover:text-gold';

export function Legacy() {
  const { search } = useLocation();
  const challenge = readTributeTarget(new URLSearchParams(search));
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<RunTotals | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle');

  useEffect(() => {
    document.title = 'The No. 7 Tribute — Seven Shots · The Golden Run';
  }, []);

  const start = () => {
    setResult(null);
    setCopyStatus('idle');
    setPlaying(true);
  };

  if (playing) {
    return (
      <div className="fixed inset-0 z-40 bg-midnight">
        <ErrorBoundary fallback={(error, retry) => (
          <div role="alert" className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="display text-4xl font-extrabold uppercase italic text-gold">The floodlights went out</h1>
            <p className="max-w-md text-chalk/75">The tribute could not start on this device. {error.message}</p>
            <button type="button" className={goldButton} onClick={retry}>Try again</button>
            <button type="button" className={outlineButton} onClick={() => setPlaying(false)}>Back to tribute</button>
          </div>
        )}>
          <Suspense fallback={<p role="status" className="flex min-h-full items-center justify-center text-center text-gold">Opening the stadium…</p>}>
            <GameView mode={{
              course: TRIBUTE_COURSE,
              ranked: false,
              label: 'The No. 7 Tribute · 7 shots',
              exitTo: '/legacy',
              onExit: () => setPlaying(false),
              onCourseComplete: (snapshot) => {
                setResult(runTotals(snapshot.results));
                setPlaying(false);
              },
            }} />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  const url = result ? tributeShareUrl({ score: result.skillScore, goals: result.goals }) : '';
  const message = result ? tributeShareText({ score: result.skillScore, goals: result.goals }) : '';
  const didWin = result && challenge ? result.skillScore > challenge.score : false;

  return (
    <PageShell>
      <div className="relative isolate overflow-hidden rounded-[28px] border border-gold/20 bg-[radial-gradient(ellipse_at_70%_20%,#53401c_0%,#14203a_32%,#05070d_75%)] px-5 py-10 sm:px-10 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 -z-10 select-none font-display text-[340px] font-extrabold italic leading-none text-gold/[0.08] sm:right-6 sm:text-[460px]">7</div>
        <p className="label text-gold">05 Nov 2026 · Portugal's No. 7 · Independent fan tribute</p>

        {!result ? (
          <>
            <h1 className="display mt-6 max-w-3xl text-[clamp(58px,11vw,124px)] font-extrabold uppercase italic leading-[0.82] tracking-tight">
              The 7<br /><span className="gold-text">lives on.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-chalk/80">
              Cristiano Ronaldo announced the end of his Portugal chapter after 23 years. The shirt gets passed on. The memories don't.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-2 border-y border-white/15 py-5 sm:max-w-xl sm:gap-6">
              <Stat number="23" label="Years" />
              <Stat number="146" label="Portugal goals" />
              <Stat number="234" label="Appearances" />
            </div>

            {challenge && (
              <div className="mt-6 max-w-xl rounded-xl border border-gold/35 bg-gold/10 px-4 py-3" role="status">
                <p className="label text-gold">A fan challenged you</p>
                <p className="mt-1 text-chalk/90">
                  They shared <strong>{challenge.goals}/7 goals · {challenge.score.toLocaleString('en-US')} pts.</strong> Same seven shots. Can you beat their score?
                </p>
                <p className="mt-1 text-xs text-chalk/55">Friend's practice score is self-reported, not server-verified.</p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={start} className={goldButton}>Take the 7 shots <span className="ml-3" aria-hidden="true">▶</span></button>
              <Link to="/play" className={outlineButton}>Warm up first</Link>
            </div>
            <p className="mt-4 text-sm text-chalk/60">No account. No payment. Seven identical shots for every fan. Drag from the ball toward the goal and release to strike.</p>
          </>
        ) : (
          <section aria-label="Your seven-shot tribute result">
            <p className="label mt-5 text-gold">Your tribute is complete</p>
            <h1 className="display mt-3 text-[clamp(52px,9vw,96px)] font-extrabold uppercase italic leading-[0.88]">
              The legacy<br /><span className="gold-text">continues.</span>
            </h1>
            <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="label text-chalk/60">Goals</p>
                <p className="display text-7xl font-extrabold italic text-gold">{result.goals}<span className="text-4xl text-chalk/50">/7</span></p>
              </div>
              <div className="pb-2">
                <p className="label text-chalk/60">Practice score</p>
                <p className="display text-5xl font-extrabold italic">{result.skillScore.toLocaleString('en-US')} <span className="text-lg text-chalk/50">pts</span></p>
              </div>
            </div>
            {challenge && (
              <p className="mt-5 max-w-xl rounded-lg border border-gold/30 bg-gold/10 p-4 text-chalk">
                {didWin ? 'You beat their shared practice score!' : result.skillScore === challenge.score ? 'You matched their shared practice score!' : `Your friend's score is ${(challenge.score - result.skillScore).toLocaleString('en-US')} points ahead. Try again.`}
              </p>
            )}
            <p className="mt-6 max-w-xl text-chalk/75">Millions of memories. Seven chances to make one of your own. Invite another fan to take these same shots.</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ShareButton label="Share your 7" spec={{
                kicker: '23 years · Portugal No. 7',
                title: 'The 7 lives on',
                big: `${result.goals}/7`,
                sub: `${result.skillScore.toLocaleString('en-US')} pts · fan tribute · unranked`,
                url,
              }} text={message} />
              <a className={goldButton} href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message + ' ' + url)}`} target="_blank" rel="noopener noreferrer">Challenge X</a>
              <button type="button" className={outlineButton} onClick={() => {
                void navigator.clipboard.writeText(url).then(() => setCopyStatus('copied'), () => setCopyStatus('manual'));
              }}>{copyStatus === 'copied' ? 'Challenge link copied ✓' : 'Copy challenge link'}</button>
              <button type="button" onClick={start} className={outlineButton}>Try again</button>
            </div>
            {copyStatus === 'manual' && (
              <label className="mt-4 block max-w-xl text-sm text-chalk/75">
                Select and copy your challenge link:
                <input type="text" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-lg border border-white/20 bg-midnight p-3 text-xs text-gold" />
              </label>
            )}
            <p className="mt-4 text-xs text-chalk/55">Tribute scores are local and unranked, not validated or saved by the server. The Golden Cup offers server-verified competition.</p>
            <Link className="mt-5 inline-block text-sm font-semibold text-gold underline underline-offset-4" to="/cup">Enter the verified Golden Cup →</Link>
          </section>
        )}
      </div>

      <div className="mx-auto mt-10 max-w-3xl text-center">
        <p className="label text-gold">For every fan who remembers</p>
        <h2 className="display mt-2 text-4xl font-extrabold uppercase italic sm:text-5xl">One more shot for seven.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-chalk/65">
          From the first Portugal appearance in 2003 to the final international chapter. A free, independently made football arcade tribute—no athlete endorsement or affiliation.
          Ronaldo continues his club career.
        </p>
        <div className="mt-6 flex justify-center gap-5 text-sm">
          <Link className="text-gold underline underline-offset-4" to="/about">The story behind Golden Run</Link>
          <Link className="text-chalk/70 underline underline-offset-4" to="/rules">How scores work</Link>
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <p className="display text-3xl font-extrabold italic text-gold sm:text-5xl">{number}</p>
      <p className="label mt-1 text-[9px] text-chalk/65 sm:text-[11px]">{label}</p>
    </div>
  );
}
