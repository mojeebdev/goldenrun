# Milestone 1 Prompt — The Perfect Shot

**Prerequisite:** Read [master prompt](00_MASTER_PROMPT.md), product brief, gameplay spec, UX storyboard, architecture and roadmap.  
**Scope:** Build the first **playable local preview**. **No login, database, remote Cloudflare resource creation, production deployment or paid service** in this milestone.

## Mission

Turn a blank repository into an actual skill-based football browser game. Visitors can load a full-screen cinematic stadium, take as many guest practice shots as they like, control power and curl, and experience meaningful keeper saves and satisfying goals.

**Build the playable game, not just a beautiful landing page.**

## A. Scaffold and Cloudflare-ready framework

- Initialize a lightweight TypeScript project with React + Vite + Tailwind CSS and Phaser; adopt current supported Cloudflare Vite plugin/Wrangler conventions.
- Prepare **one application Worker** for frontend assets plus future `/api/*` endpoints. At this stage a `/api/health` route may return a harmless static health response.
- Create package scripts for dev, build, typecheck, unit tests and format/lint.
- Lock reproducible dependencies and provide setup instructions that work from a clean clone.
- Add basic error boundary and accessible loading state for lazy-loaded game bundle.
- Do not configure a real D1 database yet. Stub **future** bindings as types only, not as fake production integrations.

## B. One polished interactive stadium

Create a distinctive original football stadium at night, not a stock-looking generic UI:
- Mid/dark stadium atmosphere, luminous warm gold floodlights, readable goal with depth, pitch markings, rich green turf, small ambient crowd motion.
- Behind-the-ball 2.5D play camera in Phaser. Keep the goal and keeper visually unambiguous at all viewport sizes.
- Rotating ball with changing ground shadow; motion trail lightly communicates trajectory.
- Keeper should have idle, dive-left, dive-right, successful save, failed dive and recovery animations.
- Net reacts on scored shot. Clear post/crossbar/out outcomes.
- Visually coherent wordmark **THE GOLDEN RUN**, branding **2008 → 1,000**, gold/black/green palette and a single dominant **PLAY NOW** CTA.
- Use original SVG/Canvas/Phaser graphics or self-authored assets only. Do not use online Ronaldo photos, club logos, official awards, branded football kits or copied stadium imagery.
- Keep all interactive controls visible, high contrast and thumb friendly.

## C. Input: make the shot feel skillful

Implement one input mapping used on desktop and mobile:
- Touch/mouse press + drag: directional aim and elevation, distance sets power, curvature determines spin. Live trajectory preview should be informative but not perfect at high difficulty.
- Snap to a normalized fixed-point `ShotCommand` independent of viewport size and pointer frequency.
- Release shoots, cancel cancels; disable shooting during active flight.
- Keyboard controls for aim/power/spin/shoot. Surface keyboard help in settings.
- Never allow touch input to accidentally scroll the page while dragging inside the play zone.
- No complicated onboarding or mandatory tutorial; brief first-shot hint fades after the user understands it.

## D. Physics and goalkeeping — authoritative pure simulation

- Extract data model, physics, scoring and keeper reach into `src/shared/rules/` or equivalent **Worker-compatible pure TypeScript**.
- Simulate fixed-step trajectory, elevation, gravity, lateral curl, goal-plane crossing, post/crossbar and keeper collision.
- Include at least three keeper difficulties. Use deterministic scenario seeds and no unseeded randomness.
- Produce `ShotResult` and replay samples for visualization. Frame rate can affect animation, **not** score/outcome.
- Maintain one simulation coordinate system regardless of portrait or landscape screen.
- Bound and validate `power`, `spin`, `aimX`, `aimY`; reject NaN/Infinity and malformed values.

## E. Game loop and feedback

- Guest visit → play → aim → shoot → flight → goal/save/miss → short reaction → next attempt, without page reload.
- Fast consecutive attempts with reset button and pause/resume. On tab hide, safely suspend or terminate active unranked shot.
- Practice overlay tracks local attempts, goals and current streak; plainly label it **UNRANKED PRACTICE**. No fictitious global rankings.
- Goal: net response, ball impact sound, tasteful celebration and points breakdown. Save: clear keeper motion and rebound. Miss: clear context.
- Mute and reduced-motion settings; do not auto-play unconsented sound.
- Simple landing menu and in-game HUD as described in UX document; avoid large panels over the pitch.
- No false registration, achievement, history, leaderboard, or D1 claims in the MVP UI. Future mode cards may be visually marked **Coming later**.

## F. Tests and review

Implement automated tests for:
- Fixed command generates same `ShotResult` across repeated calls;
- Goal line / posts / crossbar / goalkeeper reach boundaries;
- Spin and power extremes, invalid payload rejection;
- One shot → at most one resolution + one local practice goal;
- Viewport normalization produces consistent quantized command;
- Rendering layer cannot change authoritative numeric outcome.

Smoke test in an actual browser if browser tooling exists. Prefer check on at least budget Android viewport, iPhone viewport and desktop; if no real device access, state precisely what remains untested. Run `typecheck`, `test`, `build`, and lint as available, and record actual outcomes.

## Deliverables

- A responsive, **genuinely playable** Phaser shooting scene with keeper and working physics.
- Cohesive React shell, original visual identity and guest-first navigation.
- Shared deterministic simulation module with tests.
- Local development and preview instructions.
- Update roadmap status based on executed tests; commit changes.

## Acceptance checklist

1. Landing to first shot requires **no account**, no page reload and minimal steps.
2. On both mouse and touch, a user can visibly aim, shoot, score, miss and have saves.
3. Ball trajectory and keeper decisions are believable, explainable and deterministic.
4. Continuous play works without UI freeze; score HUD and celebrations are readable.
5. Layout survives portrait, landscape, resizing, and keyboard controls.
6. Tests and production build pass. No remote infrastructure touched.

**Stop after Milestone 1.** The owner should be able to inspect play feel and art direction before you add persistent competition or accounts.
