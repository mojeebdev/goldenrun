# Golden Run — Cloudflare-Only Architecture

**Decision:** One Cloudflare account, one primary application Worker, one D1 database. GitHub is only version control. Do not add Supabase, Vercel, Firebase, other hosted databases, external authentication, managed queues, independent API hosting or real-time sockets at launch.

## Architecture

```
Visitor on goldenrun.fun
   |
   +-- Cloudflare DNS/CDN, WAF and conditional Turnstile
   |
   +-- Cloudflare Worker (single deployment)
        |-- Workers Static Assets: React SPA, Phaser game, original art/audio
        |-- /api/* endpoints (same Worker)
        |-- scheduled(): weekly tournament settlement (same Worker)
        |
        +-- D1: players, credentials, sessions, challenges, goals, runs, trophies
```

- Source: `mojeebdev/goldenrun` on GitHub.
- Use Cloudflare Vite plugin / current Workers toolchain, React + TypeScript, Phaser + Tailwind CSS.
- Configure SPA fallback and Worker-first routing for `/api/*`.
- The Worker validates all writes to D1.
- Cloudflare Workers Builds native GitHub integration deploys only after owner has reviewed configuration.
- Cloudflare R2 only if/when replay media storage becomes essential; no R2 in initial MVP.
- Cloudflare Durable Objects only for actual synchronous multiplayer or coordination at scale. Not in MVP.

## Suggested source layout (create during Milestone 1)

```
src/
  app/                  # React routes and shell
  game/
    scenes/             # Phaser scenes, camera, keeper animation, effects
    input/              # pointer + keyboard control mappings
    rendering/          # animation only, no trusted score decisions
  shared/
    rules/              # ShotCommand, fixed point simulation, score calculation
    schemas/            # validated request/response and identifiers
  worker/
    index.ts            # fetch() and scheduled() handlers
    api/                # endpoints and auth middleware
    db/                 # query layer; D1 access only here
    security/           # passkeys, signed sessions, rate limits, run validation
migrations/
tests/
public/
docs/
prompts/
```

If Cloudflare's recommended starter differs, preserve the logical separation rather than forcing exact folders.

## D1 relational model (design target, not a migration yet)

1. `players`: id (opaque ULID/UUID), display_name, normalized_handle (unique), country_code (nullable), created_at, visibility, account_state.
2. `passkey_credentials`: credential_id (unique), player_id, public_key, counter, device metadata where required, created_at, last_used_at.
3. `webauthn_challenges`: hashed opaque challenge ID, action, expiry, used_at, associated temporary session/player.
4. `sessions`: hashed secret/token identifier, player_id or guest_id, created_at, expires_at, revoked_at. Cookie should be HttpOnly, Secure, SameSite=Lax/Strict as appropriate.
5. `rulesets`: version, code/data checksum, enabled_at, archived_at. Immutable once ranked runs depend on a version.
6. `scenarios`: ID/version, target and geometry, distance, keeper parameters, seed; content hash.
7. `cup_weeks`: id, start_at_utc, end_at_utc, ruleset_version, scenario_set_hash, status, finalized_at.
8. `runs`: id, player_id, mode, cup_week_id nullable, version, started_at, submitted_at, validation_state, skill_score, accepted_goals, input_hash; unique constraints for ranked weekly entry and accepted idempotency keys.
9. `run_shots`: unique run_id + sequence_index, scenario_id, normalized command, authoritative result, point breakdown, outcome.
10. `goal_ledger`: immutable accepted career-goal events, player_id, run_id, shot index, created_at; unique(run_id, shot_index). Derive/safely materialize career totals.
11. `awards`: ID, player_id, award_type, source_run, awarded_at, review_state. Unique global award key for the inaugural champion.
12. `audit_events`: structured, non-sensitive operation and suspicious-event logs, retention limited.

Create migrations in `migrations/` with rollback/safe-change notes. Index leaderboard queries by `(cup_week_id, validation_state, skill_score)`, career totals, user handle and run ownership. Archive winners rather than rewriting historical standings.

## Authentication without another provider

- **Guest practice:** unsigned local practice play possible. If creating a guest session server-side, use an opaque, expiring session cookie.
- **Account claim:** public nickname + optional country + browser-native **WebAuthn passkey**. Worker verifies origin, relying party ID, challenge, signature and counters, and stores public keys in D1.
- Require account verification for ranked submissions and lifetime goals. Do not try to identify players through IP address or device fingerprints.
- Support registration of **multiple passkeys**; plan recovery code generation and safe account recovery before promising cross-device retention. Recovery codes must be high-entropy and stored hashed.
- Verify CSRF / Origin for state-changing requests; rate-limit sensitive endpoints; restrict CORS to the first-party origin.
- Do not leak credential IDs or passkey registration state in public player profiles.
- If passkeys are unsupported on a browser, show honest fallback messaging; don't silently introduce an external auth provider.

## API contract (proposed, version before implementation)

```
GET  /api/v1/bootstrap                 # public rules, current cup, version
GET  /api/v1/leaderboard?kind=&week=    # public, paginated, cacheable
GET  /api/v1/players/:handle           # public profile if opted in
POST /api/v1/auth/registration/options
POST /api/v1/auth/registration/verify
POST /api/v1/auth/login/options
POST /api/v1/auth/login/verify
POST /api/v1/auth/logout
POST /api/v1/runs/start                # authenticated ranked challenge issued
POST /api/v1/runs/:id/submit           # signed-in and idempotent verified submission
GET  /api/v1/runs/:id                  # run and verification state (owner)
GET  /api/v1/me                        # current account and goals
```

Avoid implementing endpoint names without actual validation and API tests. Explicit `429` rate limit and `409` duplicate submission semantics. Use structured errors safe to show users.

## Trusted competitive scoring

1. Client requests an **authoritative run ID**, ruleset version, challenge/scenario hash, allowed start/end, short expiry and session-bound nonce.
2. Client plays the prescribed shot sequence locally, recording only bounded `ShotCommand` inputs. UI animation never determines a score in the database.
3. Client submits 12 commands once with run id, nonce, sequence metadata and idempotency key. Use opaque secrets not guessable IDs alone.
4. Worker checks account, run ownership, deadline/grace, input bounds, scenario order, scenario version, not previously submitted, abuse signals and per-week submission allowance.
5. Worker independently re-simulates all shots via `src/shared/rules`, calculates outcomes and score, and commits accepted run + shot records + ledger changes via a safe idempotent D1 write path.
6. Only **accepted/verified** results enter public leaderboards. If suspicious, hold as **pending review** without announcing a winner.
7. First-to-1,000 is determined from accepted ledger records and a documented server-side acceptance order, then independently audited before the unique crown is awarded.

**Security honesty:** Client inputs can still be automated or reverse-engineered; deterministic re-simulation blocks fabricated outcomes, not all skilled bots or multi-account abuse. Require risk-aware protection, suspicious-run review, challenge throttles and clear contest rules. Do not assert complete cheat immunity.

**Timing fairness:** Avoid awarding faster finishes based on client wall clock. The 90-second UX must match published rules, while server-issued submission deadlines include documented network tolerance. Log device/connectivity tests. If this creates inequitable results, switch to the same fixed 12-shot round with 90 seconds as a target rather than a strict win condition—announce the rules clearly **before** accepting ranked runs.

## Weekly competition lifecycle

- Store times as UTC; display local equivalent in client.
- On new week: create immutable ruleset + challenge hash, persist start and end times.
- On scheduled `scheduled()` invocation: close eligible window, validate unsettled runs, mark provisional winner(s), and audit/confirm without race or double-award.
- Cron may run late or twice: handler is **idempotent**; reads deadlines from D1, does not assume the invocation itself defines the ending.
- Update cached public leaderboards after accepted scores, with reasonable caching and versioned cache keys.
- For the first release, one ranked cup entry per verified account per week (unranked retry unlimited).

## Data retention, privacy and operational controls

- D1 holds minimal account data and verified competitive events; avoid collecting birth dates, precise location, contact graphs or unneeded personal data.
- Provide profile privacy and deletion workflow (with transparent treatment of competitive records and winner archive).
- Use Cloudflare observability, error logging and alerting where available; never log credential secrets, raw session cookies or recovery codes.
- Use Cloudflare WAF and Turnstile when risk merits it; don't obstruct guest first play.
- Maintain separate local/preview vs production D1 bindings. Never point `wrangler dev` accidentally at production data.
- Include explicit migration scripts plus owner-run dashboard/Wrangler setup guide, but **do not** create remote resources, update DNS, enable paid features or deploy production without instruction.
- Budget: monitor D1 reads/writes, Worker requests, asset sizes and CPU. Caching should not misrepresent ranking freshness.

## Useful Cloudflare documentation (verified 2026-10-29)

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Workers Builds / GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Scheduled handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
