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
- [ ] Verify DNS/SSL resolution and custom-domain Worker route when deployment is authorized; not yet independently verified.
- [ ] Owner authorizes actual gameplay implementation and any production deployment separately.

## Milestone 1 — The Perfect Shot (playable prototype)

**Objective:** One awesome shot feels like a game, not a website demo.

- [ ] Set up React + Vite, Phaser, TypeScript and Tailwind under current Cloudflare Worker tooling.
- [ ] Build responsive stadium, goal, ball, goalkeeper, clean HUD and immediate guest play.
- [ ] Map touch/mouse and keyboard commands to deterministic fixed-point input.
- [ ] Shared simulation for shot arc, spin, goal-plane collision, keeper saves, points.
- [ ] Goal/miss/save animation, efficient reset, original sound with mute and reduced motion.
- [ ] Pure unit tests for physics, same-command replay, geometry and bounds.
- [ ] Mobile portrait and landscape, small laptop, desktop and keyboard QA.
- [ ] Document preview-only local run/build steps.

**Gate:** Can play consecutive shots in browser with clear aim/goal/keeper feedback, without accounts, D1 or live domain. Repeatability and responsiveness tests pass.

## Milestone 2 — Verified Competition & Accounts

- [ ] Create D1 migrations for minimal players, passkey credentials, sessions, cup, runs, shots, goal ledger, awards.
- [ ] Implement account claim and passkey auth entirely in same Cloudflare Worker + D1.
- [ ] Server issues runs, independently validates every shot, handles duplicates and replay attempts.
- [ ] Implement 12-shot standardized weekly cup with UTC schedule, practice and one ranked attempt.
- [ ] D1-backed verified leaderboard; global, optional country and lifetime goals. Define tie semantics.
- [ ] Create anti-abuse limits, origin/CSRF checks, minimal logging and risk-based Turnstile.
- [ ] Verify race-free accepted goals and provisional winner determination in tests.
- [ ] No public "live" ranking is presented from client estimates.

**Gate:** Two browsers playing same shot sequence get same outcome; manipulated scores cannot enter D1; duplicate submit does not increment a goal twice; credentials and session handling pass security checks.

## Milestone 3 — Progression, 2008 & Road to 1,000

- [ ] Mode selection, narrative 2008 chapter (42 verified goals), optional stage-level variants.
- [ ] Persistent 42/100/250/500/750/1,000 career milestones.
- [ ] Founding Golden Fan provisional/verified title workflow and audit trail.
- [ ] Player profiles, privacy controls and Hall of Fame.
- [ ] Short, accessible goal celebration, progression visuals and earned badges.
- [ ] Document and test published competition terms, first-finish order and title ownership.

**Gate:** Completing 42 validated chapter goals earns exactly one badge, 1,000 validated career goals trigger review path, and no stage can be farmed by resubmitting past shots.

## Milestone 4 — Social & Release Readiness

- [ ] Challenge deep links and original share cards; public URL previews.
- [ ] Localized public rankings and country boards with opt-in country choices.
- [ ] UX onboarding polish, analytics through privacy-conscious Cloudflare capabilities, accessibility tests.
- [ ] Load / stress tests, cheap device tests, slow 3G/4G assets review.
- [ ] D1 migration rehearsal on non-production DB; backup/rollback notes.
- [ ] Terms, Privacy, contest rules, reporting, moderation and deletion request experience.
- [ ] Written Cloudflare dashboard deployment instructions for owner, including D1 binding, Worker build, custom-domain route and SSL. Domain is already purchased and Cloudflare-connected; do not instruct repurchase or unnecessary nameserver changes.
- [ ] Verify no unlicensed branding, imagery, SFX or implied endorsements.

**Gate:** Automated builds pass; security and legal checklist reviewed; clear public onboarding; first shot within seconds on realistic hardware; Cloudflare production deployment requires explicit owner approval.

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
