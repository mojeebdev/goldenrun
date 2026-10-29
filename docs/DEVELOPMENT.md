# Development guide

Technical notes for working on The Golden Run. The [README](../README.md) is the player-facing introduction to the game.

- **Live site:** [goldenrun.fun](https://goldenrun.fun). One Cloudflare Worker serves the React, Phaser and Tailwind app through Workers Static Assets, plus the `/api/*` routes, D1 persistence and an hourly cron.
- **Deploying:** merging to `main` deploys through Workers Builds.
- **Support and reports:** mojeeb@blindspotlab.xyz.

## Run it locally

Requires Node.js 20 or later (tested on 22).

```bash
npm ci
```

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

The first command installs dependencies. The second sets the passkey origin to `localhost`. The third creates the local D1 database. The last serves http://localhost:5173, with the Worker running locally in workerd. Passkeys work on `localhost`, not on `127.0.0.1`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the Cloudflare plugin (the Worker runs locally in workerd) |
| `npm run build` | Typecheck and production build (`dist/client` assets, `dist/goldenrun` Worker) |
| `npm run preview` | Serve the production build through the local Worker runtime |
| `npm run typecheck` / `npm run lint` / `npm test` | Static checks and the Vitest suite |
| `npm run check` | All of the above in sequence |
| `npm run balance` | Print goal and save rates per keeper level on a shot grid |
| `npm run loadcheck` | Local load check against the real Worker handler and a local D1 |
| `npm run deploy:dry-run` | Validate the Worker bundle with Wrangler **without deploying** |
| `npm run db:migrate:local` | Apply D1 migrations to the local database used by `npm run dev` |

Routes: `/` home · `/play` practice · `/modes` · `/2008` chapter · `/road-to-1000` career · `/cup` Golden Cup · `/leaderboard` · `/u/:username` · `/c/:runId` challenges · `/join` · `/login` · `/account` · `/rules` · `/terms` · `/privacy` · `/about` · `/api/health` and `/api/v1/*`.

## Code map

| Path | Purpose |
| --- | --- |
| `src/shared/rules/` | Pure, deterministic, Worker-compatible rules: `ShotCommand`, scenarios, keeper, simulation, scoring |
| `src/shared/competition/` | Cup weeks, course generation, progression, run totals and tie order, nickname and country validation, API types |
| `src/shared/site.ts`, `structuredData.ts` | Creator, studio, support and copyright details; schema.org JSON-LD |
| `src/game/` | Phaser scene, procedural rendering, input mapping, practice session and onboarding, synthesised audio |
| `src/app/` | React shell, routes and pages |
| `src/worker/` | The application Worker: `api/` (auth, runs, players, leaderboards, progress), `security/`, `db/`, `meta.ts` (server-rendered metadata), `cron.ts` |
| `migrations/` | D1 schema migrations |
| `tests/` | Unit tests. `tests/integration/` runs the real Worker against a local D1 with a software passkey |

## Platform

Cloudflare only:
- One Worker with Static Assets.
- D1 for players, sessions, runs, goals, awards and rankings.
- Workers Rate Limiting.
- A Cron Trigger for weekly settlement.
- The `goldenrun.fun` custom domain.

Accounts use first-party WebAuthn passkeys. There's no third-party identity provider, separate backend, or managed database outside Cloudflare.

## Working agreement

1. Keep gameplay deterministic, friendly to touch input, accessible, and resilient on low-end devices.
2. Keep builds and tests green. Never present placeholder functionality as complete.
3. Never buy anything, create Cloudflare resources, change DNS or run production database migrations without explicit owner direction. Give the owner the commands to run instead.
4. Never use licensed player, club or award logos, images, music, commentary or likenesses. Use original art and sound and non-official labels.
5. Document changes in the [CHANGELOG](../CHANGELOG.md).

## Project documents

| Document | Purpose |
| --- | --- |
| [Product Brief](PRODUCT_BRIEF.md) | Audience, modes, business rules, trust and success measures |
| [Gameplay Specification](GAMEPLAY_SPEC.md) | Input design, trajectory model, keeper behaviour, scoring and game-state contracts |
| [Experience & Storyboard](UX_STORYBOARD.md) | Screens, user journey and visual system |
| [Architecture](ARCHITECTURE.md) | Cloudflare resources, persistence, authentication, scoring integrity and operations |
| [Roadmap](ROADMAP.md) | Milestones, tests and acceptance gates |
| [Deployment](DEPLOYMENT.md) | Owner-run Cloudflare steps, the dashboard checklist and rollback |
| [Operations](OPERATIONS.md) | Weekly review, audits, reports and backups |
| [Launch checklist](LAUNCH.md) | Release readiness and open owner items |
| [UX audit](UX_AUDIT.md) | Findings behind the Milestone 4 onboarding rework |
| [Changelog](../CHANGELOG.md) | What each milestone shipped, verified and left open |
| [Agent prompts](../prompts/) | Repository-wide engineering instructions and milestone briefs |

## Release history

Four milestones went live on 2026-10-29:
1. **The Perfect Shot:** the playable shooting game.
2. **Verified competition:** passkey accounts, the Golden Cup and D1 leaderboards.
3. **Progression:** the 2008 chapter, Road to 1,000, badges, challenges and launch pages.
4. **Onboarding and release readiness.**

The story, creator and company pages followed the same day. Details are in the [CHANGELOG](../CHANGELOG.md).
