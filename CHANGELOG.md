# Changelog

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
