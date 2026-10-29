# Launch checklist (owner)

Status of release readiness after Milestone 4 (onboarding and release readiness). ✅ = done and verified, ☐ = owner action or open item.

## Product and fairness
- ✅ Guest practice works instantly; accounts use first-party passkeys only.
- ✅ Onboarding:
  - The home page has two buttons (Play now / Create free player; signed-in players get Continue / Practice).
  - First-time practice shows a three-step how-to, then a keeper and spot setup card.
  - Joining takes three steps, then a "where to start" screen.
  - Phones get a bottom tab bar.
  - See `docs/UX_AUDIT.md`.
- ✅ Every competitive result is re-simulated by the Worker; client scores are never trusted.
- ✅ Published rules (`/rules`), terms (`/terms`), privacy (`/privacy`), non-affiliation and art inventory (`/about`).
- ✅ Weekly winners and the Founding Golden Fan start as **provisional**; audit steps in `OPERATIONS.md`.
- ☐ Real-device QA: create a player and play the cup, a 2008 matchday and a Road run on an iPhone (Safari) and an Android phone (Chrome). Check passkey prompts, landscape/portrait and sound.
- ☐ Legal review of terms and privacy before introducing any prize or partnership.

## Abuse protection
- ✅ Rate limits (Workers Rate Limiting), origin checks, review holds, reports.
- ☐ Optional: Cloudflare Turnstile on account creation (create a widget in the dashboard; send the site key and set the secret with `npx wrangler secret put TURNSTILE_SECRET`).
- ☐ Optional: a WAF rate-limiting rule on `/api/v1/auth/*` in the Cloudflare dashboard as a second layer.

## Operations
- ✅ Hourly idempotent cron; D1 Time Travel restore and Worker rollback documented in `DEPLOYMENT.md`.
- ✅ `main` deploys automatically through Workers Builds (verified with the Milestone 3 merge).
- ☐ Pull-request preview builds still fail during setup (non-production branch settings in the dashboard). They're optional and don't affect production.
- ☐ Turn on Cloudflare notifications for Worker errors and D1 usage.
- ☐ Weekly: review `pending_review` runs and reports; confirm the weekly winner(s).

## Accessibility
- ✅ axe-core (WCAG 2 A/AA plus best practice) reports no violations on every public page and in the game at 390×844. Dialogs move focus to their main action when they open, and Escape closes them. Every animation respects reduced motion.

## Performance
- ✅ Emulated cheap phone (360×740, CPU 4× slower), against production:
  - Slow 4G: the home page is usable in **2.6 s**, and a cold `/play` reaches the pitch in **5.2 s**.
  - Fast 3G: **2.9 s** and **6.7 s**.
  - Opening Play from the home page is faster, because the game preloads while you're on the home page.
- ✅ Homepage loads without the game engine (~105 KB JS gzip); the game chunk (~343 KB gzip) is lazy-loaded and preloaded on idle.
- ✅ Leaderboards are cacheable for 30 s; submissions are one D1 batch per run.
- Local load check (`npm run loadcheck`: real Worker handler and Miniflare D1 on one dev machine; 60 players, 240 fully re-simulated runs). Submit took 214 ms at p50 and 313 ms at p95, including re-simulating every shot. Weekly leaderboard 47/94 ms, country 46/91 ms, career 20/32 ms, Hall of Fame 16/21 ms, progress 51/70 ms (p50/p95). Production D1 performs differently, so treat these as a regression baseline, not a capacity figure. Watch D1 rows read per day as the ledger grows.
