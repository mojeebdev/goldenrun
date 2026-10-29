/** /terms and /privacy. Plain-language documents that describe how the game actually works. */
import { useEffect } from 'react';
import { Link } from 'react-router';
import { COPYRIGHT, CREATOR, SITE, STUDIO } from '../../shared/site';
import { PageShell } from '../components/PageShell';

const UPDATED = '29 October 2026';
const prose = 'mt-6 max-w-3xl space-y-5 text-chalk/80 [&_h2]:display [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:italic [&_h2]:text-chalk [&_li]:ml-5 [&_li]:list-disc [&_a]:text-gold [&_a]:underline';

export function Legal({ page }: { page: 'terms' | 'privacy' }) {
  useEffect(() => {
    document.title = `${page === 'terms' ? 'Terms' : 'Privacy'} — The Golden Run`;
  }, [page]);
  return (
    <PageShell>
      <p className="label text-gold">Last updated {UPDATED}</p>
      {page === 'terms' ? <Terms /> : <Privacy />}
    </PageShell>
  );
}

const mail = <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>;

function Terms() {
  return (
    <>
      <h1 className="display text-5xl font-extrabold uppercase italic">Terms of play</h1>
      <div className={prose}>
        <p>
          The Golden Run (“the game”, goldenrun.fun) is a free, independent and unofficial fan game, operated by <b>{STUDIO.name}</b> (“we”,
          “us”) and created by {CREATOR.name}. By playing you agree to these terms and to the <Link to="/rules">game & competition rules</Link>.
        </p>
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
          <li>There is nothing to buy and no paid entry. Titles, badges, trophies and leaderboard places, including weekly Golden Cup wins and the Founding Golden Fan title, are unofficial in-game recognition only. They have no monetary value and can’t be exchanged.</li>
          <li>The game is not affiliated with, endorsed by or sponsored by any player, club, league, competition or award.</li>
        </ul>
        <h2>Ownership</h2>
        <ul>
          <li>{COPYRIGHT} This covers the game’s original code, artwork, sound and writing.</li>
          <li>Open-source software and fonts used by the game remain under their own licences (listed on <Link to="/about">About & credits</Link>).</li>
          <li>Names of real players, clubs, competitions and awards, and other third-party trademarks, belong to their respective owners. They are used only to describe the history that inspired the game.</li>
        </ul>
        <h2>Availability</h2>
        <p>The game is provided as is, without guarantees. Features, rules and rankings may change (rule versions are published), and service can be interrupted. To the extent the law allows, we aren’t liable for losses from using the game.</p>
        <h2>Contact and disputes</h2>
        <p>
          Questions, support and disputes about a result: email {mail}. For a result, include your nickname and the week or the challenge link. To flag a nickname or
          suspected cheating, use “Report player” on a profile.
        </p>
        <p className="text-xs text-chalk/50">
          These terms are a plain-language description written for players. They are not legal advice and have not yet been reviewed by a lawyer; they should be
          before any prize, sponsorship or wider commercial use.
        </p>
      </div>
    </>
  );
}

function Privacy() {
  return (
    <>
      <h1 className="display text-5xl font-extrabold uppercase italic">Privacy</h1>
      <div className={prose}>
        <p>
          <b>{STUDIO.name}</b> operates The Golden Run and is responsible for the personal data described here. Privacy questions and requests: {mail}.
        </p>
        <p>We collect as little as possible. Guests can play practice without anything being sent to us.</p>
        <h2>What we store (only if you create a player)</h2>
        <ul>
          <li>Your public nickname and, if you choose, a country. We never detect your location.</li>
          <li>Your passkey’s <b>public</b> key and sign-in counter. Your fingerprint, face or device PIN never leave your device.</li>
          <li>Hashed session tokens and hashed recovery codes — we can’t read the originals.</li>
          <li>Verified game results: the shot inputs of your server-checked runs, scores, goals, badges and titles.</li>
          <li>Reports you file, and a minimal security log of account events (no IP addresses, cookies or codes).</li>
        </ul>
        <h2>If you email us</h2>
        <ul>
          <li>Creating a player never asks for an email address. Email is only involved if you choose to write to us.</li>
          <li>When you do, we receive your email address, your message and anything you attach. We use them only to read and answer your message and to handle what you ask for, such as account help, a result dispute or a question about your data.</li>
          <li>Your correspondence stays in our mailbox, which is hosted by an email provider on our behalf. It is not added to the game’s database or linked to your player, unless you give us your nickname so we can look into something.</li>
          <li>We don’t use it for newsletters or marketing.</li>
        </ul>
        <h2>What we don’t do</h2>
        <ul>
          <li>The game doesn’t ask for an email address, phone number, real name, birth date or contacts, and uses no advertising IDs or tracking pixels. No ads, no analytics service, no selling data.</li>
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
          <li>Questions or requests about your data: email {mail}. We can’t verify who owns a player from an email alone, so account changes and deletion are done while signed in. If you’ve lost both your passkey and your recovery codes, the account can’t be recovered.</li>
          <li>We will never ask for your recovery codes. Don’t share them with anyone, including us.</li>
        </ul>
        <p className="text-xs text-chalk/50">
          This notice describes how the software actually works today. It is not legal advice and should be reviewed by a qualified lawyer for your
          jurisdiction before wider launch.
        </p>
      </div>
    </>
  );
}
