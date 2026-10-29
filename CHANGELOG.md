# Changelog

## Milestone 3 — Campaign modes, progression and launch prep (2026-10-29)

### Added
- **2008: The Beginning** (`/2008`): six original, fictional matchdays (Rookie → Legendary). Each is a server-issued, verified 10-shot run and counts up to 7 chapter goals. 42 chapter goals earn the 2008 badge. Matchdays unlock in order, and replays can't push a matchday past its quota.
- **Road to 1,000** (`/road-to-1000`): unlimited verified 10-shot career runs on random courses chosen by the server. Six difficulty tiers (Academy → Legend) follow the career total. Milestone badges at 42, 100, 250, 500, 750 and 1,000.
- **Founding Golden Fan:** awarded provisionally to the player whose 1,000th goal the server accepted first (goal-ledger order). The owner confirms it after an audit. A documented revoke step passes it on fairly.
- **Single career ledger:** ranked cup goals, Road goals and in-quota chapter goals each count exactly once.
- **Challenges and sharing:** `/c/:runId` lets anyone practise the exact 12 shots of a verified cup run and compare. Share cards are drawn on the device (no third-party image service). The Worker rewrites Open Graph tags for `/u/:handle` and `/c/:runId`, and there's a branded default `og.png`.
- **Profiles:** badges and titles, share-profile button, report-a-player (nickname, cheating or other). Reports go to a `reports` table for owner review.
- **Hall of Fame:** Founding Golden Fan card plus weekly winners.
- **Launch pages:** `/terms`, `/privacy`, `/about` (non-affiliation, original art and sound inventory, licences). Footer links.
- **Settings:** volume slider.
- **Migration `0002_progression.sql`:** rebuilds `runs` for the new modes and preserves all data, including working around a SQLite cascade trap that would have deleted `run_shots`. Adds `reports` and a ledger-order index.
- **Tests:** 97 in total. Integration tests cover the 42-goal badge awarded exactly once, quota caps under concurrency, locked matchdays, random Road courses, review holds for too-fast and all-top-corner runs, tier progression, first-to-1,000 ordering and the revoke hand-over, public challenges, idempotent reports, guest progress, and migration on a populated database.

### Not done / limitations
- **Real-phone passkey testing** is still outstanding.
- **Turnstile** isn't wired up (needs an owner-created widget).
- **Legal pages** are plain-language drafts; get legal review before any prizes or wider commercial use.
- **Share cards** are generated on the player's device. Link previews use the static `og.png` with page-specific titles; there are no per-player images.
- **Load testing** has only been run locally (see `docs/LAUNCH.md`). Production capacity is Cloudflare's, but D1 query costs should be watched as the ledger grows.

## Milestone 2 — Verified Competition (2026-10-29, live on goldenrun.fun)

### Added
- **D1 schema** (`migrations/0001_initial.sql`) with uniqueness guarantees for nicknames, the single ranked entry per week, per-shot results, career-goal ledger rows and awards.
- **Passkey accounts** with no external identity provider: create a player (nickname plus optional country), discoverable passkey sign-in, extra passkeys, recovery codes, sign out / sign out everywhere, public/private profile, account deletion (competitive records kept anonymously).
- **Golden Cup:** a deterministic 12-shot course per ISO week, practice mode, and one ranked entry per player per week. The server issues each ranked run (90 s target, 30 s grace) and re-simulates the 12 submitted shot inputs. Acceptance is atomic and idempotent, with review holds for implausible runs. Progress is saved locally so an interrupted run can resume or re-send.
- **Leaderboards:** weekly global, weekly by self-chosen country, career goals and Hall of Fame. All are built from accepted runs only, with shared ranks for exact ties. Private and deleted players stay anonymous. Responses are cacheable for 30 s.
- **Public profiles** at `/u/:handle`, published rules at `/rules`, and account management at `/account`.
- **Security:** Origin checks on every write, body limits, Workers Rate Limiting bindings, hashed secrets everywhere, audit events without personal data.
- **Hourly cron** to open, close and expire weeks and runs and record provisional weekly winners (idempotent).
- **Tests:** 82 in total. Integration tests run the real Worker handler against a local D1 with a software ES256 passkey authenticator. They cover registration, login, counter regression, origin and user-verification checks, challenge replay and expiry, session revocation and expiry, recovery codes, privacy and deletion, forged scores, wrong order or ranges, nonce checks, idempotent and concurrent submissions (exactly one acceptance), expiry, review holds, ownership, tie ranking, country filtering, anonymisation and cron idempotency.

### Verified
- `npm run typecheck`, `lint`, `test` (82/82), `build`, `wrangler deploy --dry-run` (D1, rate limiters and variables bound).
- Real browser (Chromium with a virtual WebAuthn authenticator) against `vite dev` with the Worker and local D1: create player → recovery codes → ranked run of 12 real mouse shots → server-verified result and rank → leaderboard → account → sign out → passkey sign-in → profile. No console errors. Phone layouts checked for overflow.

### Not done / limitations
- **Cloudflare Workers Builds** fail for this branch while local builds pass; check the build settings (see `docs/DEPLOYMENT.md`). Production was deployed manually with `wrangler deploy`.
- **Turnstile** isn't wired up. It needs a widget and secret created by the owner. Rate limits and review holds are the current defences.
- **Passkeys haven't been tested on real phones** (iOS/Android biometrics); only Chromium's virtual authenticator.
- **Bots:** shot inputs can be scripted. Server replay stops invented scores, but not skilled automation; top results rely on review.
- Career goals currently come only from ranked cup goals. Road to 1,000 progression is Milestone 3.

## Milestone 1 — The Perfect Shot (2026-10-29)

A playable, guest-first, unranked football shooting game running on the one-Worker Cloudflare stack. Local preview only — nothing has been deployed.

### Added
- **Project foundation:** Vite + React 19 + TypeScript + Tailwind CSS 4 + Phaser 3, built with the Cloudflare Vite plugin into one Worker with Workers Static Assets (SPA fallback, `/api/*` Worker-first). `/api/health` is the only endpoint. Self-hosted fonts (Barlow Condensed, Figtree, Azeret Mono); no third-party runtime requests.
- **Shared deterministic rules (`src/shared/rules`, ruleset `gr-1.0.0`):** versioned, bounded, integer `ShotCommand` with strict validation; 240 Hz fixed-step physics (gravity, drag, Magnus curl, ground, posts, crossbar, nets, whole-ball goal-line test); reach-limited deterministic goalkeeper with Rookie / Professional / Legendary profiles (set, dive left/right, watch, catch, parry, fall); scoring per the gameplay spec; result digests.
- **Stadium (`src/game`):** behind-the-ball perspective camera that adapts to portrait/landscape; procedurally painted night stadium (tiered crowd, floodlight spill and beams, deep-red fascia, original Golden Run boards, mown pitch and full markings); goal with real proportions and animated net bulge; expressive keeper rig driven by the collision capsule (idle bounce, shuffle, set, dives, fingertip parries, catches, falling, recovery); spinning ball with height-aware shadow and gold trail.
- **Shooting:** one-finger strike pad gesture (direction = aim, length = power, curvature = curl, strike point = height) with live power ring, strike dot, curl arrow, trajectory dots and goal-plane reticle; viewport- and sampling-rate-normalised. Keyboard controls for every parameter. Cancels safely on pointer cancel, blur, tab hide or resize.
- **Game feel:** GOAL!/SAVED!/OFF THE POST!/CROSSBAR!/WIDE/OVER banners placed clear of the goal mouth, bonus chips, technique tags (low drive, rocket, dipping, off the woodwork, through the gloves), crowd surge and arms-up, confetti, subtle push-in and slow motion on exceptional goals, tap-to-skip, instant next ball. Original Web Audio sound design (kick, net, post ring, glove, catch, goal sting, crowd bed/roar/groan) — muted by default, only started from a user gesture.
- **HUD (`/play`):** Unranked Practice label, spot + keeper, Goals / Shots / Streak / Score, sound, settings (keeper, spot, sound, motion, graphics, controls, restart), exit. Reduced-motion (system or manual), auto graphics downgrade on sustained low FPS, DPR cap.
- **Website:** cinematic SVG stadium homepage with PLAY NOW above the fold and background preloading of the game chunk; `/modes` and future-mode pages clearly labelled *coming later*; unofficial fan-project notice; 404.
- **Tests (Vitest, 44):** same-command replay, pinned canonical digest (matches the Worker), grid stability, mirror symmetry, render-mutation independence; goal-line/post/crossbar geometry; spin/power/elevation response; extreme inputs; keeper reach fairness, unsaveable top corners, difficulty ordering; command validation and quantisation; gesture normalisation across five screen sizes and sampling rates; session single-resolution, misses, abandonment and 60-shot continuity.

### Verified
- `npm run typecheck`, `npm run lint`, `npm test` (44/44), `npm run build`, `wrangler deploy --dry-run` (no deploy).
- Production Worker preview: `/api/health` digest `b21e6426` equals the Node test digest; SPA routes return 200; unknown `/api/*` 404; non-GET 405.
- Headless Chromium (software WebGL): mouse, emulated touch (CDP) and keyboard shots producing goals (incl. top corner and parried-in), saves, wides, overs and a crossbar hit; consecutive shots; settings; resize during a drag cancels safely; no console errors. Viewports: 390×844, 844×390, Pixel 5, 800×1000, 1280×720/800, 1440×900.

### Not done / known limitations
- **No real-device testing yet** (budget Android, iPhone Safari). FPS figures from headless software GL are not representative.
- Audio verified only for absence of errors (headless; not listened to).
- Phaser chunk is ~343 KB gzip (lazy-loaded after the homepage); a custom Phaser build could cut this.
- The aiming input deviates from the spec's "angle sets height" wording — see GAMEPLAY_SPEC *Milestone 1 implementation notes*.
- No accounts, D1, ranked play, leaderboards or deployment (Milestone 2+ by design).
