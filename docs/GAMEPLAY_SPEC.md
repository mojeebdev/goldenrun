# Golden Run — Gameplay & Fairness Specification

**Prototype target:** Fast, premium-feeling 2.5D arcade precision shooter viewed from behind the ball.  
**Rule:** The player controls the shot, not a FIFA-style character. One-finger mobile play and mouse/keyboard desktop equivalents.

## Gameplay loop

`READY → AIMING → FLIGHT → RESOLUTION → (GOAL | SAVE | MISS) → CELEBRATION → NEXT_SHOT`.

- The first shot is playable as a guest without account creation.
- No page transitions or network calls are necessary between individual offline/practice shots.
- Smoothly reset the ball and keeper between attempts; visually explain save, post/crossbar or out-of-bounds.
- A goal should have a short, optional replay/slow-motion flourish, net feedback, impact SFX and crowd swell.
- State transitions cannot be triggered twice; one shot yields no more than one accepted goal.

## Input model

### Mobile
- Touch-and-drag from a visible shooting interaction region; **angle** selects horizontal/vertical target, **distance** selects power, **curvature of gesture** applies controlled spin.
- Use on-screen aim/power feedback while dragging. Release shoots. Cancel when gesture exits or pointer is canceled.
- Prevent scroll/text selection only while touching the play area; no hijacking other page interactions.
- Support left- or right-handed interaction and accessible large targets.

### Desktop
- Mouse drag/release follows the same mapping and quantization.
- Keyboard alternative: arrow keys to aim, adjustable power/spin using labeled keys, Enter/Space to shoot; escape cancels.
- Do not tie fairness to cursor speed, device pixels, screen resolution or pointer sample rate.

### Deterministic input

Produce a compact, versioned `ShotCommand` with bounded, quantized values, e.g.:

```ts
type ShotCommand = {
  rulesetVersion: string;
  scenarioId: string;
  aimX: number;      // fixed-point normalized horizontal aim
  aimY: number;      // fixed-point normalized vertical aim
  power: number;     // integer 0..1000
  spin: number;      // integer -1000..1000
};
```

Keep **raw pointer coordinates out** of competitive scoring; convert using a single published mapping. Validate min/max and schema on both client and server.

## World and camera

- Camera behind and slightly above ball looking into the goal; enough height to track shot flight without obstruction.
- 2.5D rendered perspective via Phaser plus lightweight sprites/meshes/texture effects; don't introduce a heavy 3D game stack in Milestone 1.
- Maintain a logical pitch coordinate space independent of display pixels; goal plane and goal mouth boundaries are fixed in simulation units.
- Soft field lighting, legible goalkeeper silhouette, realistic-enough arc, rotated ball texture and depth-aware shadow.
- Static/dynamic scenery should be original assets in optimized WebP/AVIF where appropriate; choose compatibility fallbacks. Do not promise visually photorealistic FIFA gameplay.

## Ball simulation

Implement **pure TypeScript** simulation in a shared module used by gameplay and Cloudflare Worker verification.

- Fixed time step (e.g. 1/120 s) or a closed-form arc with deterministically quantized collision logic; no frame-rate-dependent physics.
- Parameters: initial velocity from power + elevation, gravity, constrained lateral spin effect, drag if needed.
- Detect crossing goal plane, within posts and below crossbar; calculate shot impact coordinates and precision score.
- Explicit collision priority: crossbar/posts, keeper save/rebound (if modeled), goal crossing and off-target.
- Reproducible with the same `rulesetVersion + scenarioId + command` across browser and server.
- Seeded keeper behavior must use deterministic inputs; **no Math.random()** in ranked resolution.
- Return a `ShotResult` containing `goal`, `outcome`, `precision`, `modifiers`, `skillPoints`, and optional replay samples.
- Use fixed-point arithmetic or explicit rounding boundaries for cross-platform consistency; test in Worker and browser-compatible environments.

## Goalkeeper behavior

Three initial deterministic skills: novice, standard and expert — implemented as **Rookie**, **Professional** and **Legendary** (see *Milestone 1 implementation notes* below).
- Position/starting delay defined by scenario.
- Keeper observes shot after a defined reaction delay; chooses reachable interception path based on bounded lateral velocity and dive duration.
- Can save or parry, dive, stand still, or miss; give readable animations for each outcome.
- No unfair teleporting; if a shot is physically unreachable under scenario parameters, keeper should not save it.
- Difficulty increases via reaction limits, reach, wall/obstacles and shot distance, not arbitrary score overrides.

## Game-mode contracts

### Practice
Unlimited shots; optional local practice stats only; not ranked. Available to guests.

### 2008 Chapter
Structured scenario progression; successful verified goals increment chapter total. Award 2008 badge on 42. Maintain chapter unlock policy in server rules.

### Road to 1,000
A successful accepted shot increments the account career goal ledger by **exactly 1**. Server controls eligibility, submission and idempotency. Reject duplicated shot IDs and replayed runs. Invalid attempts do not change totals.

### Golden Cup
12 fixed shots, same order and scenario parameters for every participant per weekly ruleset. Time window with server-authoritative start and finish bounds (allow a documented tolerance for network jitter). *As built: 4:00 on the clock plus 30 s extra time. The original 90-second target was too tight on real phones.* A client's time display alone never grants score or tie advantages. At most one eligible ranked run per verified account per cup week at MVP. All scores from deterministic server re-simulation. Do not claim that purely browser-generated inputs are impossible to automate: add abuse checks, review and contest safeguards.

## Prototype scoring proposal

- Goal: +100
- Top-corner (deterministically defined goal zone): +150
- Curl bonus (threshold AND successful target): +200
- Long-range/harder scenario: +250
- Capped streak bonus: design and publish exact multiplier after first physics playtest.

All modifier eligibility must be independently derived by `simulateShot()` from scenario and command. Cap earned skill points per shot. No purchasable gameplay modifiers. Score tie rules are in Product Brief.

## Accessibility, performance and feel

- 60fps target for typical mobile hardware, graceful 30fps fallbacks; gameplay simulations must be frame-rate independent.
- UI should not cover the goal mouth; mobile safe-area support; landscape and portrait layouts tested.
- Mute button, captions/visual confirmation for sonic cues; reduced-motion alternative to camera shakes and flashing effects.
- Load first playable screen quickly on a normal mobile connection; lazy-load crowd/detail/replays.
- Pointer cancellation, background/resume, device rotation and tab visibility handled deterministically. Expired competition sessions fail clearly without inventing a save.
- Respect user data/privacy when retaining or sharing replays.

## Validation gates

- Identical shot command produces identical `ShotResult` in repeated tests and Worker runtime.
- Boundary tests: each post, crossbar, goal line, keeper reach, power clamps, spin clamps.
- Orientation and input-scaling test: same normalized gesture intention → same outcome across display sizes.
- Gameplay tests verify no double-count, no score change on miss, and no score submitted by practice.
- Real-phone user test: first shot without explanation, readable aiming feedback, responsive save/goal feel.

## Milestone 1 implementation notes (ruleset `gr-1.0.0`)

These record where the playable prototype made a concrete choice the spec left open, or deliberately deviated, and why.

### Input mapping (deviation, documented)
The spec says gesture *angle* selects the horizontal/vertical target and *distance* selects power. A single drag only offers two independent quantities (direction and length) plus curvature, so it cannot independently set horizontal aim, height **and** power. To keep every parameter independent and learnable, Milestone 1 uses:

| Gesture property | Shot parameter |
| --- | --- |
| Direction of the drag (relative to straight up) | `aimX` — left/right |
| Length of the drag (normalised by viewport) | `power` |
| Curvature of the drag (enclosed-area measure) | `spin` — curl |
| **Where the drag starts on the ball** (the strike pad) | `aimY` — height: strike low to lift, high to drive low |

This mirrors real football technique, keeps the one-finger *touch → drag → release* flow, and is shown live (strike dot, power ring, curl arrow, trajectory and goal-plane reticle). Lengths are divided by a reference length derived from `min(viewport width, height)`, and the path is resampled by arc length before measuring curvature, so the same intention gives the same command on any screen or touch sampling rate (covered by tests). Release near the start or drag downward to cancel.

`aimY` is the intended height at the goal line: the launch angle that reaches it (ignoring curl, with a drag allowance) is solved, then the physics runs freely. Power therefore changes speed, arc shape and the keeper's time — not where "up" points.

### Simulation
* Fixed 240 Hz step, semi-implicit Euler; gravity, quadratic drag, Magnus curl decaying over time, ground bounce/roll, post and crossbar cylinders, nets.
* Determinism: only `+ − × ÷ √` and explicit rounding; all state snapped to a 1 µm grid each step; transcendental `Math` functions and `Math.random` are lint-banned in `src/shared`. The canonical shot's digest is identical in Node and the Worker (`/api/health`).
* A goal requires the ball centre to pass `goalLine + ballRadius` while between the posts and below the bar; post/bar collisions are resolved first, so "post and in" is real.
* Replay samples at 60 Hz drive rendering; the renderer never decides outcomes.

### Goalkeeper
Reads the ball state once at its reaction time (anticipating only `curlRead` of the current curl), then either sets (shot at the body), dives left/right toward the read point limited by `reach` and `maxHandHeight`, or watches a shot going wide. On slow shots it waits so the dive completes as the ball arrives. Collisions use a feet→hands capsule; contact below `catchSpeed` near the gloves is a catch, otherwise a parry (which can still go in). Profiles live in `src/shared/rules/scenarios.ts`. Hard shots into the top corners are unsaveable at every level (tested).

### Aiming guide honesty
Rookie shows the full predicted path and an exact reticle; Professional shows ~70 % of the path with a wider reticle; Legendary ~45 % with the widest reticle.

### Scoring (practice)
Goal +100, top corner +150 (within 1.06 m of a post and the top 0.89 m), curl +200 (|spin| ≥ 450 and ≥ 0.9 m of curl at the line), long range +250 (28 m spot), capped at 700 — all derived inside `simulateShot()`. The practice streak bonus (+25 per consecutive goal after the first, max +100) is **provisional, practice-only** and not part of the shared ruleset.

### Practice spots
Centre 18 m, Left channel 20 m, Top of the D 23 m, Right channel 19 m, Long range 28 m. A goal advances to the next spot; a miss repeats it. Scenario IDs: `practice.<spot>.<level>`.
