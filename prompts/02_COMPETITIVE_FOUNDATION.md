# Milestone 2 Prompt — Verified Competition Foundation

**Prerequisite:** Milestone 1 gameplay actually runs and its tests pass. Read [master prompt](00_MASTER_PROMPT.md), [architecture](../docs/ARCHITECTURE.md) and [gameplay spec](../docs/GAMEPLAY_SPEC.md).  
**Scope:** Cloudflare-native D1 persistence, in-Worker auth and auditably fair ranked competition. **Do not deploy, create remote resources, configure DNS or apply production migrations** without explicit instruction.

## Mission

A player can claim a first-party account, enter the weekly Golden Cup, complete a standardized sequence and have the **Worker recompute** the result. Only verified runs appear on rankings; retries do not duplicate goals.

## A. Cloudflare D1 schema and migrations

Implement versioned local D1 migrations (using Wrangler tooling) for players, passkey credentials/challenges, authenticated sessions, scenario/ruleset versions, cup weeks, runs, shots, goal ledger, awards and audit state.

- Required uniqueness constraints for nicknames, run submission/idempotency, (run_id, sequence_index), ranked entry per (week, player), ledger event and inaugural crown.
- Carefully chosen indexes on public leaderboard query patterns.
- Immutable recorded rule/scenario version per eligible submission.
- Write and test migrations **locally**; do not run remote/production D1 changes.
- Do not publish real secret keys in the repo; use safe local dev secrets/templates.

## B. First-party account flow

- Guests continue to practice immediately.
- Account-claim screen lets users choose a unique public nickname and an optional country (validate ISO country codes; users can decline).
- Browser-native passkeys/WebAuthn: Worker generates short-lived challenges, verifies the correct origin + RP ID, attestation/assertion requirements, signatures, challenge reuse, credential counter semantics and user verification policy.
- Store credential public keys and session hashes in D1. Use Secure HttpOnly same-site cookies and session rotation/revocation.
- Add a second-passkey enrollment flow, clear recovery limitations and a safe account recovery strategy; **do not pretend single-device registration ensures recovery**.
- Implement privacy defaults and guard against username enumeration and replay.
- No Auth0, Clerk, Supabase Auth, Firebase Auth or other outside identity provider.

## C. Trustworthy shot submissions

- Keep the `ShotCommand` and `simulateShot()` implementation exactly shared between Worker and client. Worker inputs are quantized and validated independently.
- `POST /runs/start` returns authenticated server-issued run identity, nonce, ruleset/scenario hash, exact 12-shot order and server deadlines.
- `POST /runs/:id/submit` accepts an ordered bounded command list, not claimed goals or claimed points. It rejects wrong owners, mismatched versions, wrong shots, expired attempts, replayed nonces, duplicate submissions and impossible payloads.
- Re-simulate every shot in Worker. Store independently derived shot result, point detail and accepted goal count.
- Test **idempotency** using D1 constraints and safe batched writes/conditional statements. Exactly one accepted event per shot even after concurrent/replayed requests.
- Limit write amplification: no D1 write per animation frame. Batch an accepted run.
- Errors are typed and comprehensible to players; provisional/failed verification clearly displayed.

## D. Weekly Cup competition

- Immutable challenge package per week in UTC. All players play the same scenario sequence and published rules.
- Standardize **12 attempts** and a **90-second target window**, with explicit server-side start and expiry + documented latency allowance. Never trust the UI timer as score authority or a tie-break input.
- One ranked entry per verified account per week at initial release. Unlimited non-ranked practice is okay.
- Tie policy: points, goals, precision subtotal, misses, and genuine shared ties if still equal.
- D1 leaderboard: verified global and optional country rankings, paginated, bounded and eventually cached; show real period/date, refresh and provisional status.
- Cron `scheduled()` on **the same Worker** creates/closes competition weeks and records provisional winners idempotently.
- Never describe provisional rankings as final. Support admin/manual verification state without creating a separate dashboard infrastructure.

## E. Security and privacy

- CSRF/Origin enforcement, request size bounds, authorization, anti-enumeration, sensible rate limiting; risk-based Turnstile + Cloudflare WAF guidance.
- Log security events safely; never log authentication challenges, bearer/session secrets, raw IP histories or recovery codes.
- Acknowledge that browser automation and sockpuppet accounts remain possible; design anomaly flagging, reviewed winners and fair-contest dispute path.
- Test authenticated ownership isolation, duplicate submissions, malicious input, unsupported rules versions and broken session flows.
- Do not apply geolocation based on IP for public country; use user-provided optional data.

## F. Tests, documentation, handoff

- Unit tests for score comparison, ranked eligibility and session/auth state.
- Integration tests against **local D1 and local Worker**, showing a forged score is ignored; parallel/replayed submission increments ledger once; same shot commands re-simulate identically; 12-shot course is stable for all players.
- Test expired/duplicate WebAuthn challenges and session logout/revocation.
- Update architecture with any actual storage/auth details that differ from proposal.
- Create a **mobile-friendly Cloudflare dashboard deployment guide** identifying resources the owner must provision and secrets/bindings to configure; do not execute deployment.
- Run available checks, commit implementation and document status.

## Acceptance gate

The competition feels continuous with the Milestone 1 game, but scores are only final after the Worker accepts them. No fake data masquerades as a live ranking. Account recovery limitations are explicit. All infrastructure remains within Cloudflare.

**Stop after Milestone 2.** Do not auto-ship production or add optional backend vendors.
