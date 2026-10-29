# Golden Run — Milestone Roadmap & Acceptance Gates

**Product:** goldenrun.fun | **Repository:** mojeebdev/goldenrun | **Infrastructure:** Cloudflare only.

Every milestone must be independently shippable/testable, with tests and a short change log. Prompts are implementation handoffs, not evidence of completed features. Do not skip gameplay playtesting to rush a profile dashboard.

## Phase 0 — Planning (THIS DOCUMENTATION PASS)

- [x] Establish product vision, unofficial fan identity, game modes and core differentiators.
- [x] Select arcade shooting with a later optional hybrid experience.
- [x] Require Cloudflare one-Worker + D1 architecture.
- [x] Draft UX, input mechanics, competition rules, integrity architecture.
- [x] Create sequential agent build prompts in `prompts/`.
- [ ] Complete legal/brand name/IP clearance before launch.
- [x] Owner confirmed purchase of `goldenrun.fun`.
- [x] Owner confirmed `goldenrun.fun` is connected to Cloudflare.
- [x] Owner deployed the Worker to `goldenrun.fun` (2026-10-29). HTTPS checked: `/`, `/play` and `/api/health` return 200 and the health digest matches tests. `www` is not configured yet.
- [x] Owner authorized Milestone 1 gameplay implementation (production deployment still requires separate approval).

## Milestone 1 — The Perfect Shot (playable prototype)

**Objective:** One awesome shot feels like a game, not a website demo.

- [x] Set up React + Vite, Phaser, TypeScript and Tailwind under current Cloudflare Worker tooling.
- [x] Build responsive stadium, goal, ball, goalkeeper, clean HUD and immediate guest play.
- [x] Map touch/mouse and keyboard commands to deterministic fixed-point input.
- [x] Shared simulation for shot arc, spin, goal-plane collision, keeper saves, points.
- [x] Goal/miss/save animation, efficient reset, original sound with mute and reduced motion.
- [x] Pure unit tests for physics, same-command replay, geometry and bounds.
- [~] Mobile portrait and landscape, small laptop, desktop and keyboard QA — done in emulated Chromium viewports (Pixel 5, 390×844, 844×390, 1280×720/800, 1440×900) with real pointer, touch and keyboard events. **Real-device QA on budget Android and iPhone Safari is still outstanding.**
- [x] Document preview-only local run/build steps.

**Gate:** Can play consecutive shots in browser with clear aim/goal/keeper feedback, without accounts, D1 or live domain. Repeatability and responsiveness tests pass.

**Status (2026-10-29):** gate met in local/emulated testing; see [CHANGELOG](../CHANGELOG.md). Owner hands-on review of play feel and real-phone QA remain before Milestone 2.

## Milestone 2 — Verified Competition & Accounts

- [x] Create D1 migrations for minimal players, passkey credentials, sessions, cup, runs, shots, goal ledger, awards (`migrations/0001_initial.sql`, tested on local D1).
- [x] Implement account claim and passkey auth entirely in same Cloudflare Worker + D1 (plus extra passkeys, recovery codes, logout-all, privacy, deletion).
- [x] Server issues runs, independently validates every shot, handles duplicates and replay attempts.
- [x] Implement 12-shot standardized weekly cup with UTC schedule, practice and one ranked attempt.
- [x] D1-backed verified leaderboard; global, optional country and lifetime goals. Tie semantics published on `/rules`.
- [~] Anti-abuse limits, origin/CSRF checks and minimal audit logging are done (Workers Rate Limiting bindings, review holds). **Turnstile is not wired yet** — it needs an owner-created widget and secret.
- [x] Verify race-free accepted goals and provisional winner determination in tests.
- [x] No public "live" ranking is presented from client estimates.
- [x] Production: owner created D1 `goldenrun-db` (WEUR), applied `0001_initial.sql` remotely and deployed (2026-10-29). Live API checks passed. Passkeys still need testing on real phones.

**Gate:** Two browsers playing same shot sequence get same outcome; manipulated scores cannot enter D1; duplicate submit does not increment a goal twice; credentials and session handling pass security checks.

**Status (2026-10-29):** gate met against the local Worker + local D1 (integration tests and a real-browser passkey run). Deployed to production the same day.

## Milestone 3 — Progression, 2008 & Road to 1,000

- [x] Mode selection, narrative 2008 chapter (six original matchdays, 7-goal quota each = 42 verified goals), sequential unlocks.
- [x] Persistent 42/100/250/500/750/1,000 career milestones (from the immutable goal ledger) with Road to 1,000 difficulty tiers.
- [x] Founding Golden Fan: provisional on the first 1,000th ledger goal (server order), owner audit to confirm, documented revoke path that passes the title to the next player.
- [x] Player profiles with badges and titles, privacy controls, report button and Hall of Fame (weekly winners + Founding Golden Fan).
- [x] Accessible celebrations (existing), progression bars and earned badges; volume control added.
- [x] Published rules, terms, privacy and first-finish order; covered by integration tests.

**Gate:** Completing 42 validated chapter goals earns exactly one badge, 1,000 validated career goals trigger review path, and no stage can be farmed by resubmitting past shots.

**Status (2026-10-29):** gate met in integration tests against local D1. The badge is awarded once even after replays and repeated settlement. Matchday quotas hold under concurrent runs. Resubmitted or replayed inputs are refused. The first 1,000th goal by ledger order gets the provisional title. Live in production on 2026-10-29. Milestone 4 items delivered early with Milestone 3: challenge links, share cards, Open Graph previews, terms and privacy.

## Milestone 4 — Social & Release Readiness

- [x] Challenge deep links (`/c/:runId`) and original share cards (rendered on the player's device); public URL previews via Worker HTMLRewriter.
- [x] Localized public rankings and country boards with opt-in country choices. Weekly country boards, an opt-in country at sign-up, and dates shown in your own time zone with UTC alongside.
- [x] UX onboarding polish: two-button home, practice how-to plus setup, stepped join, phone tab bar, a modes hub showing your progress ([UX_AUDIT](UX_AUDIT.md)). Accessibility tested with axe-core: no violations. Analytics: documented as an owner decision (Cloudflare Web Analytics, cookieless; update `/privacy` first).
- [x] Load / stress tests (`npm run loadcheck`), cheap-device and slow 3G/4G tests (an emulated 4× CPU slowdown against production; see LAUNCH.md), and a review of asset sizes.
- [x] D1 migration rehearsal on a non-production DB (an integration test runs `0002` on a populated local D1), plus backup and rollback notes (Time Travel bookmark taken before `0002`; DEPLOYMENT.md).
- [x] Terms, Privacy, contest rules, reporting, moderation and deletion request experience (plain-language drafts; legal review still recommended).
- [x] Written Cloudflare dashboard deployment instructions for owner, including D1 binding, Worker build, custom-domain route and SSL. Domain is already purchased and Cloudflare-connected; do not instruct repurchase or unnecessary nameserver changes.
- [x] Verify no unlicensed branding, imagery, SFX or implied endorsements. Fonts are OFL-1.1 (Fontsource); every sound is synthesised in code (Web Audio); art is code or SVG from this repo; a scan finds no player, club, league, award or sponsor names.

**Gate:** Automated builds pass; security and legal checklist reviewed; clear public onboarding; first shot within seconds on realistic hardware; Cloudflare production deployment requires explicit owner approval.

**Status (2026-10-29):** gate met. Builds and 106 tests pass. Onboarding has been reworked (home, practice, join, phone navigation). Emulated cheap-phone tests show the first shot is possible about 5–7 s after a cold load on slow networks. Accessibility and asset checks are clean. Every production deploy is the owner merging to `main`. Still open, all owner items: real-phone QA, a legal review of terms and privacy, Phase 0 brand and IP clearance, and the analytics decision.

## Phase 5 — Only after retention evidence

- Direct friend duels, replay uploads via optional R2, optional real-time play via Durable Objects.
- More 2008/2013/2014/2016/2017-inspired chapters using original artwork and permitted facts.
- More scenarios, seasonal competitions, performance tuning.
- No new infrastructure provider without owner decision.

## Working rules for each implementation task

1. Audit repo state before changes.
2. Read `README.md`, relevant docs, `prompts/00_MASTER_PROMPT.md` and current milestone prompt.
3. Work only inside approved milestone; document any deliberately deferred work.
4. Run format, typecheck, unit and build checks; for milestone 1 perform manual gameplay QA where tools allow.
5. Commit code + updated docs to GitHub, with concise status, SHA and any manual Cloudflare owner actions. Do not claim testing you did not run.
6. Never auto-purchase, auto-deploy, create Cloudflare account resources, migrate remote D1, or change DNS without explicit instructions.

## Risks worth watching

- Too much time spent on visual spectacle before proving gameplay.
- Browser-only input trust and scripted high scores.
- D1 write amplification per shot: batch accepted run submissions rather than database writes on each frame.
- Overly heavy art on mobile; keyboard and accessibility gaps.
- Passkey-only recovery challenges.
- Confusion about official Ronaldo/Ballon d'Or association.
- Time-dependent competition rules and network jitter.
- Country leaderboards advantaging large populations; document metric methodology.
