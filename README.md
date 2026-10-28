# The Golden Run ⚽🏆

**Domain:** [goldenrun.fun](https://goldenrun.fun) *(purchased and connected to Cloudflare per owner confirmation; not yet confirmed live)*  
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
| **Golden Cup** | Weekly set of 12 standardized shots, with a 90-second target | Highest verified skill score is weekly champion |

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

**Planning/specifications.** Domain **purchased** and **connected to Cloudflare** (owner-confirmed). No gameplay implementation, Worker deployment, production custom-domain binding, or public website availability has been verified.

---
**Source of truth:** [github.com/mojeebdev/goldenrun](https://github.com/mojeebdev/goldenrun)
