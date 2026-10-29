import { useEffect } from 'react';
import { CUP } from '../../shared/competition/cup';
import { POINTS } from '../../shared/rules';
import { PageShell } from '../components/PageShell';
import { durationLabel } from '../lib/format';

export function Rules() {
  useEffect(() => {
    document.title = 'Rules — The Golden Run';
  }, []);
  return (
    <PageShell>
      <p className="label text-gold">Published rules · ruleset gr-1.0.0</p>
      <h1 className="display text-5xl font-extrabold uppercase italic">Game & competition rules</h1>
      <div className="mt-6 max-w-3xl space-y-6 text-chalk/80 [&_h2]:display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:italic [&_h2]:text-chalk [&_li]:ml-5 [&_li]:list-disc">
        <section>
          <h2>What this is</h2>
          <p>The Golden Run is an unofficial, free fan game. There are no cash prizes, no paid entries and nothing to buy. Titles and trophies are in-game recognition only and are not affiliated with any player, club, league or award.</p>
        </section>
        <section>
          <h2>Scoring per shot</h2>
          <ul>
            <li>Goal: +{POINTS.goal}. The whole ball must cross the goal line between the posts and under the bar.</li>
            <li>Top corner: +{POINTS.topCorner} (within 1.06 m of a post and the top 0.89 m of the goal).</li>
            <li>Curler: +{POINTS.curl} (strong side spin that bends the ball at least 0.9 m by the goal line).</li>
            <li>Long range: +{POINTS.longRange} (28 m spot). Maximum {POINTS.maxPerShot} per shot.</li>
            <li>Career goals count one per goal, never by points.</li>
          </ul>
        </section>
        <section>
          <h2>The weekly Golden Cup</h2>
          <ul>
            <li>Runs from Monday 00:00 UTC to the next Monday 00:00 UTC. Your local times are shown on the cup page.</li>
            <li>{CUP.shots} fixed shots: the same spots, keepers and order for every player that week.</li>
            <li>One ranked entry per player per week. Starting a ranked run uses it, even if you leave.</li>
            <li>You have {durationLabel(CUP.targetSeconds)} on the in-game clock for all {CUP.shots} shots, then {CUP.graceSeconds} seconds of extra time for slow devices and connections. After that the server no longer accepts the run. The clock starts when the server issues the run and keeps running if you pause or leave. Time never affects your score or ties.</li>
            <li>Your device only sends your 12 shot inputs. Our server replays every shot with the same physics and keeper and decides the score.</li>
            <li>Ranking: points, then goals, then precision subtotal, then fewer misses. If still level, players share the rank.</li>
            <li>Practice runs are unlimited, unranked and never sent to the server.</li>
          </ul>
        </section>
        <section>
          <h2>Review and fair play</h2>
          <ul>
            <li>Runs that look implausible (for example finished far faster than humanly possible, or near-perfect) are held for review and don’t appear on leaderboards until confirmed.</li>
            <li>Weekly winners are first marked provisional and confirmed after review. Results can be withdrawn for automation, multiple accounts or exploiting bugs.</li>
            <li>No system can stop every bot. Replaying shots on our server stops made-up scores, not skilled scripts, so we review top results by hand.</li>
            <li>Questions or disputes: contact the project owner via the site’s GitHub repository.</li>
          </ul>
        </section>
        <section>
          <h2>Accounts and privacy</h2>
          <ul>
            <li>Sign-in uses passkeys. We store your public nickname, optional country, your passkey’s public key and hashed session and recovery codes — no email, no password, no location.</li>
            <li>You can make your profile private (you stay ranked anonymously) or delete your account from the account page. Deleted accounts remain in past standings anonymously.</li>
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
