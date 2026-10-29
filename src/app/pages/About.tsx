/**
 * /about — the story behind the game, the person who made it, the studio that
 * publishes it, and the credits. Written as an editorial feature in eight short
 * numbered chapters. Structured data for this page is rendered by the Worker.
 */
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { COPYRIGHT, CREATOR, SITE, STUDIO } from '../../shared/site';
import { PageShell } from '../components/PageShell';
import { XIcon } from '../components/SiteFooter';

const body = 'max-w-[62ch] space-y-5 text-[17px] leading-[1.75] text-chalk/80 sm:text-lg';
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;
const inline = 'text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold';

export function About() {
  useEffect(() => {
    document.title = 'About The Golden Run — the story, the creator and the studio';
  }, []);

  return (
    <PageShell>
      <article aria-labelledby="about-title">
        <header className="anim-rise max-w-3xl">
          <p className="label text-gold">About & credits</p>
          <h1 id="about-title" className="display mt-2 text-[clamp(44px,10vw,88px)] font-extrabold uppercase italic leading-[0.9]">
            The story behind <span className="gold-text">The Golden Run</span>
          </h1>
          <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-chalk/75 sm:text-xl">
            A football milestone, a question about greatness, and a decision to build. This is where the game came from, who made it, and
            who stands behind it.
          </p>
        </header>

        <Chapter n={1} title="The story behind The Golden Run">
          <p className="display text-3xl font-extrabold italic leading-tight text-chalk sm:text-4xl">It started with a legendary year.</p>
          <p>
            In 2008, Cristiano Ronaldo won his first Ballon d’Or. It became one of the defining moments of an extraordinary football
            career.
          </p>
        </Chapter>

        <Chapter n={2} title="From a legendary year to a new challenge">
          <p>
            Years later, as football fans returned to that 2008 achievement and Ronaldo continued his pursuit of 1,000 career goals, an
            idea began to take shape.
          </p>
          <p>
            What if celebrating football greatness could be something more interactive than watching highlights, debating rankings or
            sharing another post?
          </p>
          <PullQuote>What if fans could experience a journey of their own?</PullQuote>
        </Chapter>

        <Chapter n={3} title="How the idea became a playable football game">
          <p>
            My first thought was simple: a football game where the first player to reach 1,000 goals would earn the title of the
            ultimate Golden Fan.
          </p>
          <p>The more I thought about it, the more I realized that reaching a number shouldn’t be the only thing that mattered.</p>
          <PullQuote>The journey needed to be fun. The goals needed to feel earned. And the competition needed to reward skill.</PullQuote>
          <p>
            That changed the direction of the project. Instead of building a goal counter, I began designing a proper arcade football
            experience: a ball, a goalkeeper, a stadium, precise shooting, difficult saves, and those moments when a perfectly placed shot
            makes you want to celebrate.
          </p>
          <p>From there, the idea grew into The Golden Run, a game built around three connected experiences:</p>
          <ol className="!mt-6 divide-y divide-white/10 border-y border-white/10">
            <Experience mark="2008" to="/2008" title="The spirit of 2008">
              A six-matchday story chapter. Score 42 verified goals to earn the 2008 badge.
            </Experience>
            <Experience mark="1,000" to="/road-to-1000" title="The road to 1,000 goals">
              Every goal our server verifies counts once on your career road.
            </Experience>
            <Experience mark="Cup" to="/cup" title="The Golden Cup">
              The same twelve shots for everyone each week, so fans can test their skill against one another.
            </Experience>
          </ol>
          <p>
            The Golden Run is not an official Cristiano Ronaldo game. It is an independent creative tribute to the ambition, consistency,
            memorable milestones and competitive spirit that make football meaningful to so many people.
          </p>
          <p>It is also a reminder that a moment of inspiration can become something real when you decide to build.</p>
          <p className="!mt-8 border-l-2 border-gold pl-5 font-semibold text-chalk">
            A legendary journey inspired the idea. <span className="text-gold">The next goal belongs to you.</span>
            <span className="mt-2 block text-sm font-normal text-chalk/55">— Mojeeb</span>
          </p>
        </Chapter>

        <Chapter n={4} title="Meet the creator" id="creator">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,300px)] md:items-start">
            <div className="space-y-5">
              <h3 className="display text-4xl font-extrabold uppercase italic leading-none text-chalk sm:text-5xl">
                The mind behind <span className="text-gold">the run</span>
              </h3>
              <p>
                The Golden Run was conceived and built by <b className="text-chalk">{CREATOR.name}</b>, an independent product engineer and
                strategist who enjoys turning unexpected ideas into real, usable experiences.
              </p>
              <p>
                Through BlindspotLab, he works across product strategy, design and engineering, building software that brings ideas out of
                conversations and into people’s hands.
              </p>
              <p>The Golden Run began as a question about football greatness. It became an experiment in gameplay, creativity and competition.</p>
              <ul className="flex flex-wrap gap-2 pt-1 text-sm" aria-label={`${CREATOR.name} online`}>
                <Chip href={CREATOR.url}>mojeeb.xyz ↗</Chip>
                <Chip href={CREATOR.x} label={`${CREATOR.xHandle} on X`}>
                  <XIcon className="h-3 w-3" /> {CREATOR.xHandle}
                </Chip>
                <Chip href={CREATOR.github} label="mojeebdev on GitHub">
                  GitHub · mojeebdev
                </Chip>
              </ul>
            </div>
            <figure className="mx-auto w-full max-w-[300px] md:mx-0">
              <picture>
                <source type="image/avif" srcSet="/media/mojeeb-titilayo-480.avif 480w, /media/mojeeb-titilayo-720.avif 720w" sizes="(min-width: 768px) 300px, 80vw" />
                <img
                  src="/media/mojeeb-titilayo-480.jpg"
                  srcSet="/media/mojeeb-titilayo-480.jpg 480w, /media/mojeeb-titilayo-720.jpg 720w"
                  sizes="(min-width: 768px) 300px, 80vw"
                  width={480}
                  height={600}
                  loading="lazy"
                  decoding="async"
                  alt="Portrait of Mojeeb Titilayo, creator of The Golden Run, in a cream cap and light-blue shirt, arms folded."
                  className="aspect-[4/5] w-full rounded-2xl border border-white/10 object-cover shadow-[0_20px_60px_-20px_rgba(232,184,74,0.35)]"
                />
              </picture>
              <figcaption className="mt-3 text-xs text-chalk/55">
                <span className="text-chalk/80">{CREATOR.name}</span> · {CREATOR.jobTitle}
              </figcaption>
            </figure>
          </div>
        </Chapter>

        <Chapter n={5} title="The studio behind the game">
          <p>
            The Golden Run is an independent project created by {CREATOR.name} through <b className="text-chalk">{STUDIO.name}</b>, an
            AI-native product studio focused on turning ideas into working products.
          </p>
          <p>
            BlindspotLab publishes the game and holds the rights in its original code, artwork, sound and writing.{' '}
            <a href={STUDIO.url} {...ext} className={inline}>
              Visit blindspotlab.xyz ↗
            </a>
          </p>
        </Chapter>

        <Chapter n={6} title="Original artwork, technology & credits">
          <ul className="space-y-3 [&>li]:pl-5 [&>li]:-indent-5 [&>li]:before:mr-3 [&>li]:before:text-gold [&>li]:before:content-['—']">
            <li>Stadium, pitch, crowd, goal, net, goalkeeper, ball, homepage scene and share cards: drawn in code for this game (Canvas, SVG and Phaser). Original.</li>
            <li>Every sound effect is synthesised live with the Web Audio API. No recorded samples.</li>
            <li>“2008: The Beginning” is six fictional matchdays written for the game. No real fixtures are depicted.</li>
            <li>No real player likenesses, club crests, kits, award imagery, match footage or commentary are used.</li>
            <li>Fonts: Barlow Condensed, Figtree and Azeret Mono, under the SIL Open Font License 1.1, self-hosted via Fontsource.</li>
            <li>Software: React, React Router, Phaser, Tailwind CSS and SimpleWebAuthn (MIT licences), running on Cloudflare Workers and D1. Each remains under its own licence.</li>
            <li>
              How results are verified: your device sends only the inputs of each shot, and our server replays every shot with the same
              physics and goalkeeper to decide the result. See the <Link to="/rules" className={inline}>rules</Link>.
            </li>
          </ul>
        </Chapter>

        <Chapter n={7} title="Contact and support" id="contact">
          <p>
            For questions, feedback, account help or disputes about a result, email{' '}
            <a href={`mailto:${SITE.supportEmail}`} className={inline}>
              {SITE.supportEmail}
            </a>
            . To flag a nickname or suspected cheating, use “Report player” on any profile.
          </p>
          <p className="text-base text-chalk/65">
            Found a bug? Email the same address with what happened and which device and browser you were using. We will never ask for
            your recovery codes, so never send them to anyone.
          </p>
        </Chapter>

        <Chapter n={8} title="Independence and non-affiliation">
          <p>
            The Golden Run is an unofficial, independent fan game. It is not affiliated with, endorsed by, sponsored by or connected to
            Cristiano Ronaldo, any other player, club, league or competition, or the Ballon d’Or and its organisers. Mentions of real
            people and awards describe the history that inspired the game, nothing more.
          </p>
          <p className="text-base text-chalk/65">
            Player names, award names and other trademarks belong to their respective owners. Titles and badges in the game are
            unofficial in-game recognition with no monetary value.
          </p>
          <p className="text-sm text-chalk/55">
            {COPYRIGHT} The copyright covers the game’s own original content; third-party software and fonts remain under their own
            licences.
          </p>
        </Chapter>
      </article>
    </PageShell>
  );
}

function Chapter({ n, title, id, children }: { n: number; title: string; id?: string; children: ReactNode }) {
  const headingId = `chapter-${n}`;
  return (
    <section id={id} aria-labelledby={headingId} className="mt-16 grid gap-4 border-t border-white/10 pt-8 sm:mt-20 md:grid-cols-[180px_minmax(0,1fr)] md:gap-10">
      <div>
        <p className="font-[var(--font-accent)] text-sm tabular-nums text-gold" aria-hidden="true">
          {String(n).padStart(2, '0')}
        </p>
        <h2 id={headingId} className="label mt-1 text-[11px] leading-relaxed text-chalk/60">
          {title}
        </h2>
      </div>
      <div className={body}>{children}</div>
    </section>
  );
}

function PullQuote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="!my-8 border-l-2 border-gold pl-5">
      <p className="display text-[clamp(26px,5vw,40px)] font-extrabold italic leading-[1.1] text-gold-bright">{children}</p>
    </blockquote>
  );
}

function Experience({ mark, title, to, children }: { mark: string; title: string; to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="group grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-4 py-4 sm:grid-cols-[110px_minmax(0,1fr)]">
        <span className="display text-3xl font-extrabold italic text-gold sm:text-4xl">{mark}</span>
        <span>
          <span className="display block text-xl font-extrabold uppercase italic text-chalk group-hover:text-gold">{title} ›</span>
          <span className="block text-base leading-relaxed text-chalk/65">{children}</span>
        </span>
      </Link>
    </li>
  );
}

function Chip({ href, label, children }: { href: string; label?: string; children: ReactNode }) {
  return (
    <li>
      <a
        href={href}
        {...ext}
        aria-label={label ? `${label}, opens in a new tab` : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-chalk/85 transition hover:border-gold/60 hover:text-gold"
      >
        {children}
      </a>
    </li>
  );
}
