import { Link } from 'react-router';
import { PageShell } from '../components/PageShell';

export function NotFound() {
  return (
    <PageShell>
      <p className="label text-gold">404</p>
      <h1 className="display text-6xl font-extrabold uppercase italic">Wide of the post</h1>
      <p className="mt-2 text-chalk/70">That page doesn’t exist.</p>
      <Link to="/" className="mt-6 inline-block text-gold underline">
        Back to the tunnel
      </Link>
    </PageShell>
  );
}
