# Golden Run — Product Brief (v0.1)

**Status:** Approved concept with implementation details to validate in a playable prototype  
**Domain:** goldenrun.fun (planned)  
**Audience:** Football fans worldwide, including fans following Ronaldo's legendary 2008 season and his road to 1,000 career goals.  
**Promise:** One shot feels great; every verified goal matters; every week offers a fair chance to win.

## Positioning and boundaries

A free-to-play, unofficial football skill game inspired by historical football milestones. This game does **not** confer any official fan award, Ballon d'Or, licensed trophy or endorsement from any athlete, team or rights holder.

Hero proposition: **"2008 → 1,000. The road to greatness starts with one goal."**  
Primary action: **Play now** — no account required for a first attempt.

The brand should stand on its own. Avoid confusion with Ronaldo's official products and avoid building a full licensed athlete simulator. Football facts can inform original challenges; commercial images, insignia, original commentary/audio and identifiable likenesses require rights review.

## Player motivations

1. **Curious visitor:** Opens a social link and can take their first shot in seconds.
2. **Competitive player:** Wants a fair, repeatable challenge, skill-based ranks and shared results.
3. **Dedicated fan:** Wants a 2008 chapter, historical references and a path to 1,000 goals.
4. **Social challenger:** Wants to send a friend a challenge and compare the exact same course.
5. **Low-end mobile user:** Expects smooth input, reasonable download size and a low-quality setting.

## Game modes

### 2008: The Beginning

- Narrative progression loosely themed around an exceptional 2008 season.
- **42 goals** is the initial completion target. This is a progression design decision, not an assertion that each scene is a faithful recreation of a particular real match.
- Tiered scenarios with original stadiums and changing shot conditions.
- Earn an in-game 2008 badge after 42 verified campaign goals.
- No historical player likenesses or licensed clubs without rights clearance.

### Road to 1,000

- Persistent account-bound career goal counter; one valid goal equals one career goal.
- Milestones at **42 / 100 / 250 / 500 / 750 / 1,000** with meaningful visual unlocks and difficulty progression.
- An archived, permanent **Founding Golden Fan** title can go to the first player to accumulate 1,000 **validated** career goals, subject to review, eligibility and published contest rules.
- Distinguish "first provisional finish" from "verified title awarded"; avoid race conditions and winner announcements on client state.
- Lifetime progression remains playable after the first winner.

### Golden Cup

- Weekly challenge with **12 predetermined, reproducible shots** from a published, versioned scenario set.
- **90-second target round** and clear time remaining in UI; do not use device timing alone as authoritative ranking evidence.
- Score primarily for completion and shot skill; identical conditions for all players. No purchasable or random gameplay advantage.
- Highest verified score wins. Tie resolution: (1) more successful goals, (2) higher precision subtotal, (3) fewer missed shots, (4) shared rank if still tied. Never use client-supplied time alone as the deciding factor.
- One **ranked submission** per account per weekly competition in initial launch; allow unlimited unranked practice. Reconsider limits only after anti-cheat and retention evidence.
- UTC-defined weekly window, clearly displayed in local time for participants. Lock rules and scenario version for that week.

### Leaderboards

- Global Weekly Cup, Country Weekly Cup, Lifetime Goals, Friends/challenges (later).
- Display screen name, country flag, trophy marker, verified score, period and rule version.
- No rankings for guest-mode unverified practice. Opt-in public profiles and optional country disclosure.
- Publish clear scoring rules, eligibility, dispute process and moderation policy.

## Scoring (initial proposal to prototype-test)

A successful goal earns **100 base points** in skill modes. Optional modifiers:
- Top-corner precision: **+150**
- Controlled curled finish: **+200**
- High-difficulty distance/scenario: **+250**
- Goal streak bonus: published, capped multiplier, not stackable without a limit.

Modifiers must be deterministic, numerically defined and validated from the shot simulation. Avoid accidental double-counting or farming one easy shot. The Golden Cup must have a stable **maximum theoretical score** and a test suite that reproduces it. **Career goals always increment by one**, never by point value.

## Engagement and virality

- Web share results card with score, cup week, username and deep link.
- "Beat my 12 shots" link opens the identical scenario set.
- Optional country rivalries; normalize/clarify aggregate metrics so large countries do not automatically win on population.
- Hall of Fame preserves confirmed week winners and the inaugural 1,000-goal winner.
- A historical Ronaldo goal counter may appear **only with an attributable, current and reconciled data source**; never hardcode a disputed real-world total as permanent truth.
- Later: shot replays, profile collectibles, seasonal challenges.

## Monetization and safeguards

Free to play at launch. Never sell goals, power, accuracy, extra ranked attempts or leaderboard placement. Avoid gambling, wagering, paid entry, misleading prizes and unclear rewards. If real-world prizes are ever contemplated, obtain a separate jurisdiction-specific rules and legal review.

Create basic Terms, Privacy, cookie/session explanation, moderation/reporting, deletion request and child-safety defaults prior to public launch. Minimize account data; do not collect precise location for a country flag. Respect reduced motion, sound toggles, keyboard support and color contrast.

## Core metrics

- Time from landing to first shot (target: seconds, not a signup journey).
- First shot completion and first-goal conversion.
- Shots/session and 90-second challenge completion.
- Day-1/Day-7 returning players and weekly cup repeat participation.
- Shared links opened → first shots → registered competitors.
- Verified-score reject rate and false positive appeals.
- FPS, interaction latency, crash rate and device coverage.

## Launch definition

Launch only when the first-shot loop is fun in hands-on testing; persistence and scores resist trivial tampering; 12-shot runs are replay-verifiable; core journeys work on mid-range and budget phones; and legal/identity claims are clean.
