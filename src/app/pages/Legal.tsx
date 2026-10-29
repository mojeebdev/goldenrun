import { useEffect } from 'react';
import { Link } from 'react-router';
import { PageShell } from '../components/PageShell';

const UPDATED = '29 October 2026';
const prose = 'mt-6 max-w-3xl space-y-5 text-chalk/80 [&_h2]:display [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:italic [&_h2]:text-chalk [&_li]:ml-5 [&_li]:list-disc [&_a]:text-gold [&_a]:underline';

export function Legal({ page }: { page: 'terms' | 'privacy' | 'about' }) {
  useEffect(() => {
    document.title = `${page === 'terms' ? 'Terms' : page === 'privacy' ? 'Privacy' : 'About & credits'} — The Golden Run`;
  }, [page]);
  return (
    <PageShell>
      <p className="label text-gold">Last updated {UPDATED}</p>
      {page === 'terms' && <Terms />}
      {page === 'privacy' && <Privacy />}
      {page === 'about' && <About />}
    </PageShell>
  );
}

function Terms() {
  return (
    <>
      <h1 className="display text-5xl font-extrabold uppercase italic">Terms of play</h1>
      <div className={prose}>
        <p>The Golden Run (“the game”, goldenrun.fun) is a free, unofficial fan game run by an independent creator. By playing you agree to these terms and to the <Link to="/rules">game & competition rules</Link>.</p>
        <h2>Who can play</h2>
        <ul>
          <li>Anyone can play practice as a guest. To create a player you must be at least 13, and have a parent’s or guardian’s permission where your local law requires it.</li>
          <li>One player per person. Shared, bought, sold or automated accounts aren’t allowed.</li>
        </ul>
        <h2>Fair play</h2>
        <ul>
          <li>No bots, scripts, modified clients, exploiting bugs or coordinated multi-account play. Results can be held, removed or reset, and accounts suspended, if we believe the rules were broken.</li>
          <li>Nicknames must not impersonate real people, clubs or the game, or be offensive. We may rename or remove them.</li>
        </ul>
        <h2>No prizes, no purchases</h2>
        <ul>
          <li>There is nothing to buy and no paid entry. Titles, badges and trophies are in-game recognition with no monetary value and can’t be exchanged.</li>
          <li>The game is not affiliated with or endorsed by any player, club, league, competition or award.</li>
        </ul>
        <h2>Availability</h2>
        <p>The game is provided as is, without guarantees. Features, rules and rankings may change (rule versions are published), and service can be interrupted. To the extent the law allows, we aren’t liable for losses from using the game.</p>
        <h2>Contact</h2>
        <p>Questions, disputes or reports: open an issue at <a href="https://github.com/mojeebdev/goldenrun/issues">github.com/mojeebdev/goldenrun</a>, or use “Report player” on a profile.</p>
        <p className="text-xs text-chalk/50">These terms are a plain-language starting point and should be reviewed by a qualified lawyer before any prize or wider commercial use.</p>
      </div>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1 className="display text-5xl font-extrabold uppercase italic">Privacy</h1>
      <div className={prose}>
        <p>We collect as little as possible. Guests can play practice without anything being sent to us.</p>
        <h2>What we store (only if you create a player)</h2>
        <ul>
          <li>Your public nickname and, if you choose, a country. We never detect your location.</li>
          <li>Your passkey’s <b>public</b> key and sign-in counter. Your fingerprint, face or device PIN never leave your device.</li>
          <li>Hashed session tokens and hashed recovery codes — we can’t read the originals.</li>
          <li>Verified game results: the shot inputs of your server-checked runs, scores, goals, badges and titles.</li>
          <li>Reports you file, and a minimal security log of account events (no IP addresses, cookies or codes).</li>
        </ul>
        <h2>What we don’t do</h2>
        <ul>
          <li>No email, phone number, real name, birth date, contacts, advertising IDs or tracking pixels. No ads, no analytics service, no selling data.</li>
        </ul>
        <h2>Cookies and device storage</h2>
        <ul>
          <li>One essential sign-in cookie (HttpOnly, secure, first-party) when you sign in. Nothing else uses cookies.</li>
          <li>Your settings and in-progress runs are kept in your browser’s local storage on your device only.</li>
        </ul>
        <h2>Where it lives</h2>
        <p>The game runs on Cloudflare (Workers and the D1 database), which processes requests on our behalf. Rate limiting may briefly use your network address to count requests; it isn’t stored with your player.</p>
        <h2>Your controls</h2>
        <ul>
          <li>Make your profile private at any time: you stay on leaderboards as “Private player”.</li>
          <li>Delete your account from your account page: your nickname, country, passkeys and codes are removed and you’re signed out everywhere. Verified results stay in past standings anonymously so other players’ ranks don’t change.</li>
          <li>Other requests: open an issue at <a href="https://github.com/mojeebdev/goldenrun/issues">github.com/mojeebdev/goldenrun</a> (don’t post personal data publicly).</li>
        </ul>
        <p className="text-xs text-chalk/50">This notice describes how the software actually works today. It should be reviewed by a qualified lawyer for your jurisdiction before wider launch.</p>
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <h1 className="display text-5xl font-extrabold uppercase italic">About & credits</h1>
      <div className={prose}>
        <p>The Golden Run is an independent, unofficial fan game inspired by the idea of a legendary goal-scoring journey: <b>2008 → 1,000</b>. It is not affiliated with, endorsed by or connected to any footballer, club, league, competition, award or rights holder, and uses no real player likenesses, club crests, kits, award imagery, footage or commentary.</p>
        <h2>Original artwork & sound inventory</h2>
        <ul>
          <li>Stadium, pitch, crowd, goal, net, goalkeeper, ball, homepage scene and share cards: drawn in code by this project (Canvas, SVG and Phaser), original.</li>
          <li>All sound effects: synthesised live with the Web Audio API by this project. No recorded samples.</li>
          <li>Story mode “2008: The Beginning”: six fictional matchdays written for the game; no real fixtures are depicted.</li>
          <li>Fonts: Barlow Condensed, Figtree and Azeret Mono, under the SIL Open Font License 1.1, self-hosted via Fontsource.</li>
          <li>Software: React, React Router, Phaser, Tailwind CSS, SimpleWebAuthn (MIT licences) and Cloudflare Workers tooling.</li>
        </ul>
        <h2>How results are verified</h2>
        <p>Your device sends only the inputs of each shot. Our server replays every shot with the same physics and goalkeeper and decides the result. See the <Link to="/rules">rules</Link>.</p>
        <h2>Source</h2>
        <p><a href="https://github.com/mojeebdev/goldenrun">github.com/mojeebdev/goldenrun</a></p>
      </div>
    </>
  );
}
