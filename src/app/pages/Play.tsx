import { lazy, Suspense, useEffect } from 'react';
import { Link } from 'react-router';
import { BallMark } from '../components/Brand';
import { ErrorBoundary } from '../components/ErrorBoundary';

const GameView = lazy(() => import('../../game/GameView'));

function Loading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-midnight" role="status" aria-live="polite">
      <BallMark className="h-14 w-14 animate-spin [animation-duration:1.6s]" />
      <p className="display text-2xl font-extrabold uppercase italic text-gold">Walking out of the tunnel…</p>
      <p className="label text-chalk/60">Loading the stadium</p>
    </div>
  );
}

export function Play() {
  useEffect(() => {
    document.title = 'Practice — The Golden Run';
  }, []);
  return (
    <div className="fixed inset-0 bg-midnight">
      <ErrorBoundary
        fallback={(error, retry) => (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
            <p className="display text-4xl font-extrabold uppercase italic text-gold">The floodlights failed</p>
            <p className="max-w-md text-chalk/75">
              The game couldn’t start on this device ({error.message || 'unknown error'}). Check your connection and try again.
            </p>
            <div className="mt-2 flex gap-3">
              <button type="button" onClick={() => location.reload()} className="rounded-full bg-gold px-6 py-2 font-semibold text-midnight">
                Reload
              </button>
              <button type="button" onClick={retry} className="rounded-full border border-white/20 px-6 py-2">
                Try again
              </button>
              <Link to="/" className="rounded-full border border-white/20 px-6 py-2">
                Home
              </Link>
            </div>
          </div>
        )}
      >
        <Suspense fallback={<Loading />}>
          <GameView />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
