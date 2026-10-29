# The Golden Run ⚽🏆

**Domain:** [goldenrun.fun](https://goldenrun.fun) *(live on Cloudflare Workers since 2026-10-29)*  
**Campaign:** 2008 → 1,000  
**Tagline:** *The road to greatness starts with one goal.*

> An **unofficial, independently created football arcade game** celebrating great football moments. Not affiliated with or endorsed by Cristiano Ronaldo, France Football, Ballon d'Or, any football club or league.

## What we're building

A mobile-first, browser-based **precision-shooting football game** that is enjoyable in seconds and competitive over weeks. Players swipe or drag to aim, control power and spin, beat a moving goalkeeper, accumulate verified career goals, and compete on global, country, and weekly leaderboards.

**Release strategy:** Build an exceptional playable shooting loop first. Add competitive accounts and progression only after gameplay tests are satisfied. Ship a free-to-play experience with zero pay-to-win mechanics.

### Core game modes

| Mode | Goal | Winner/Progress |
| --- | --- | --- |
| **2008: The Beginning** | Complete a 42-goal progression chapter | Earn the 2008 badge |
| **Road to 1,000** | Earn 1,000 verified career goals | First audited player receives the permanent *Founding Golden Fan* title |
| **Golden Cup** | Weekly set of 12 standardized shots, with 4 minutes on the clock | Highest verified skill score is weekly champion |

The *Founding Golden Fan* and weekly Golden Cup are **in-game, unofficial** recognitions; no real Ballon d'Or prize or endorsement is implied. Career goals count **one each**, independent of a shot's point value.

## Technology: Cloudflare end to end

- **One Cloudflare Worker** hosting **React + Phaser + Tailwind** via Workers Static Assets, plus API routes.
- **Cloudflare D1** for players, sessions, runs, shot attestations, goals, awards and rankings.
- **Cloudflare Turnstile/WAF** for risk-based abuse prevention.
- **Cron Triggers on the same Worker** for weekly competition settlement.
- **Cloudflare DNS/CDN** for the domain. The owner has purchased `goldenrun.fun` and connected it to Cloudflare; Worker custom-domain routing and production launch remain pending.
- **Cloudflare Workers Builds + GitHub integration** for deployment, once the owner sets it up.
- **Optional later:** R2 for user-generated replay media; Durable Objects only for a proven real-time requirement.

**Not allowed:** Supabase, Firebase, Vercel, third-party identity platforms, managed databases or a separate application server. The GitHub repository is source control, not a second hosting provider. Browser-native WebAuthn/passkeys can be used for account authentication without another identity provider.

## Documents

| Document | Purpose |
| --- | --- |
| [Product Brief](docs/PRODUCT_BRIEF.md) | Audience, gameplay modes, business rules, trust and success measures |
| [Gameplay Specification](docs/GAMEPLAY_SPEC.md) | Input design, trajectory model, keeper behavior, scoring and game-state contracts |
| [Experience & Storyboard](docs/UX_STORYBOARD.md) | Screens, user journey and cinematic visual system |
| [Architecture](docs/ARCHITECTURE.md) | Cloudflare resources, persistence, authentication, scoring integrity and operations |
| [Roadmap](docs/ROADMAP.md) | Incremental milestones, tests and acceptance gates |
| [Deployment notes](docs/DEPLOYMENT.md) | Owner-run Cloudflare steps (not yet performed) |
| [Changelog](CHANGELOG.md) | What each milestone shipped, verified and left open |
| [Master Agent Prompt](prompts/00_MASTER_PROMPT.md) | Repository-wide engineering instructions |
| [Milestone 1 Prompt](prompts/01_PERFECT_SHOT.md) | First playable vertical slice |
| [Milestone 2 Prompt](prompts/02_COMPETITIVE_FOUNDATION.md) | Profiles, persistence and verified competition |
| [Milestone 3 Prompt](prompts/03_MODES_AND_LAUNCH.md) | Mode progression, social loops and release readiness |

## Working agreement

1. **Design and documentation first.** The owner has confirmed domain purchase and Cloudflare connection. These specifications are not evidence that gameplay code, D1, Worker routing or production deployment exist.
2. Implement one milestone at a time; keep builds and tests green. Avoid placeholder game functionality falsely presented as complete.
3. **Never purchase, deploy to production, connect billing, alter DNS or perform production database migrations without explicit owner direction.**
4. Keep gameplay deterministic, input-friendly on mobile, accessible and resilient to low-end devices.
5. No licensed Ronaldo/club/award logos, images, music, commentary, player likenesses or trademarked branding without verified usage rights. Use original art, sounds and non-official labels.
6. Changes should be documented and committed to this repository; implementation proceeds only when explicitly requested.

## Project status

**Milestone 1 — The Perfect Shot: live at [goldenrun.fun](https://goldenrun.fun).** The owner deployed the Worker on 2026-10-29. `/`, `/play` and `/api/health` were checked over HTTPS and return 200. The production health digest (`b21e6426`) matches the test suite. `www.goldenrun.fun` redirects to the apex.

**Milestone 2 — Verified competition: live since 2026-10-29.** Passkey accounts, the weekly Golden Cup with server-verified scores, and D1 leaderboards. The owner created the production D1 database (`goldenrun-db`, WEUR), applied migrations remotely and deployed. Checked over HTTPS: `/api/health` reports milestone 2 with digest `b21e6426`; the bootstrap and leaderboard endpoints read from D1; cross-origin writes are refused; passkey options use RP ID `goldenrun.fun`. See [CHANGELOG](CHANGELOG.md) for what shipped and what remains.

**Milestone 3 — 2008 chapter, Road to 1,000, badges, challenges and launch pages: live since 2026-10-29.** The owner applied migration `0002` remotely (a Time Travel bookmark was recorded first). Merging PR #2 deployed it automatically through Workers Builds. Checked over HTTPS: `/api/health` reports milestone 3; `/2008`, `/road-to-1000`, the legal pages, `og.png` and the `/u/*` and `/c/*` share routes all return 200; progress and Hall of Fame are served from D1.

**Milestone 4 — Onboarding and release readiness: live since 2026-10-29.**
- A two-button home page, practice how-to plus setup, a stepped join, phone tab bar navigation and a modes hub showing your progress.
- The audit fixes and a clean axe-core accessibility run.
- Cheap-device timings, asset licence checks and Cloudflare dashboard instructions.
- No migration and no new Cloudflare resources. Merging to `main` deploys it.
- See [docs/UX_AUDIT.md](docs/UX_AUDIT.md) and the [CHANGELOG](CHANGELOG.md).

## Run it locally

Requires Node.js 20+ (tested on 22).

```bash
npm ci
npm run dev          # http://localhost:5173 — React + Phaser + the Worker (/api/health) in workerd
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the Cloudflare plugin (Worker runs locally in workerd) |
| `npm run build` | Typecheck + production build (`dist/client` assets, `dist/goldenrun` Worker) |
| `npm run preview` | Serve the production build through the local Worker runtime |
| `npm run typecheck` / `npm run lint` / `npm test` | Static checks and the Vitest suite |
| `npm run check` | All of the above in sequence |
| `npm run balance` | Prints goal/save rates per keeper level on a shot grid |
| `npm run deploy:dry-run` | Validates the Worker bundle with Wrangler **without deploying** |
| `npm run db:migrate:local` | Applies D1 migrations to the local database used by `npm run dev` |

First-time local setup for accounts: `cp .dev.vars.example .dev.vars` (sets the passkey origin to `localhost`), then `npm run db:migrate:local`. Open **http://localhost:5173** — passkeys don't work on `127.0.0.1`.

Routes: `/` homepage · `/play` practice · `/cup` Golden Cup · `/2008` chapter · `/road-to-1000` career · `/leaderboard` · `/u/:username` · `/c/:runId` challenges · `/join` · `/login` · `/account` · `/rules` · `/terms` · `/privacy` · `/about` · `/modes` · `/api/health` and `/api/v1/*`.

### How to play

Press on the ball, drag toward the goal and release. **Direction** aims, **length** is power, **curving the drag** adds curl, and **where you strike the ball** sets the height (low on the ball lifts it, high on the ball keeps it down). Keyboard: ← → aim · ↑ ↓ height · W/S power · Q/E curl · Enter/Space shoot · Esc cancel · M sound · P settings.

### Code map

| Path | Purpose |
| --- | --- |
| `src/shared/rules/` | Pure, deterministic, Worker-compatible rules: `ShotCommand`, scenarios, keeper, simulation, scoring |
| `src/game/` | Phaser scene, procedural rendering, input mapping, practice session, synthesized audio |
| `src/app/` | React shell, routes, homepage |
| `src/shared/competition/` | Cup weeks, course generation, run totals and tie order, nickname/country validation, API types |
| `src/worker/` | The single application Worker: `api/` (auth, runs, players, leaderboards), `security/`, `db/`, `cron.ts` |
| `migrations/` | D1 schema migrations |
| `tests/` | Unit tests; `tests/integration/` runs the real Worker against a local D1 with a software passkey |

---
**Source of truth:** [github.com/mojeebdev/goldenrun](https://github.com/mojeebdev/goldenrun)

## Credits

The Golden Run was conceived and built by [Mojeeb Titilayo](https://mojeeb.xyz) ([@MojeebMotion](https://x.com/MojeebMotion)) and is published by [BlindspotLab Limited](https://blindspotlab.xyz). © 2026 BlindspotLab Limited. All rights reserved. Third-party software and fonts remain under their own licences. Support: mojeeb@blindspotlab.xyz.

The Golden Run is an unofficial, independent fan game, not affiliated with or endorsed by any player, club, league, competition or award.
