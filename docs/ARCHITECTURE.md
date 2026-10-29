# Golden Run — Cloudflare-Only Architecture

**Decision:** One Cloudflare account, one primary application Worker, one D1 database. GitHub is only version control. Do not add Supabase, Vercel, Firebase, other hosted databases, external authentication, managed queues, independent API hosting or real-time sockets at launch.

## Domain and deployment state

- **Registered domain:** `goldenrun.fun` — purchased by the owner (confirmed 2026-10-29).
- **DNS/provider connection:** Owner reports the domain has been connected to Cloudflare.
- **Not yet verified:** DNS propagation, SSL certificate status, live HTTP response, Workers custom-domain route, D1 provisioning, GitHub build integration and production deployment. A Cloudflare zone is not the same as a published application.
- **Next authorized deployment step:** when requested, attach `goldenrun.fun` to the one application Worker using Cloudflare custom-domain routing, verify HTTPS and redirects (including `www` policy), and only then mark the site live. Do not alter nameservers or purchase the domain again.

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
- Cloudflare Workers Builds native GitHub integration deploys only after owner has reviewed configuration; the purchased domain and Cloudflare zone do **not** imply that the Worker has been deployed or linked to the hostname.
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

**As built in Milestone 1:** `src/app` (React shell), `src/game` (Phaser scene in `scenes/`, input in `input/`, procedural art in `rendering/`, synthesized audio in `audio/`, `session.ts` for local practice), `src/shared/rules` (pure rules), `src/worker/index.ts` (`/api/health` only). Wrangler config: `wrangler.jsonc` with `assets.not_found_handling = "single-page-application"` and `run_worker_first = ["/api/*"]`. No D1 binding, routes, custom domain or cron are configured. `/api/health` simulates a canonical shot through the shared rules and returns its digest, which matches the Node test suite — the first evidence for cross-runtime determinism.

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

## As built in Milestone 2

* **Worker routes** (`src/worker/index.ts`): `GET /api/v1/bootstrap`, `/auth/{registration,login,passkeys}/{options,verify}`, `/auth/recover`, `/auth/recovery-codes`, `/auth/logout`, `/auth/logout-all`, `GET|PATCH|DELETE /me`, `POST /runs/start`, `POST /runs/:id/submit`, `GET /runs/:id`, `GET /leaderboard?kind=weekly|country|career|hall`, `GET /players/:handle`. Every non-GET request must carry an allowed `Origin` (CSRF), a JSON body ≤ 32 KB, and passes the Workers Rate Limiting bindings (`AUTH_LIMITER` 20/min per client, `WRITE_LIMITER` 60/min per player).
* **Passkeys:** `@simplewebauthn/server` (a verification library, not an identity service) running inside the Worker. Resident keys + required user verification, `none` attestation, ES256/RS256. Challenges are stored hashed, expire after 5 minutes and are consumed atomically. Signature-counter regressions are refused. Recovery: eight 80-bit codes, SHA-256 hashed, single use. Session cookie `__Host-gr_session` (HttpOnly, Secure, SameSite=Lax, 30 days); D1 stores only SHA-256 of the secret.
* **Cup weeks:** ISO weeks in UTC. The 12-shot course is derived from `fnv1a(ruleset:week)`. Shots 1–4 face a Professional keeper from the four short spots, 5–8 Professional with one long-range shot, and 9–12 Legendary with one long-range shot. Weeks are created lazily with `INSERT OR IGNORE`, so concurrent creation is harmless.
* **Runs:** starting a ranked run inserts a row under a partial unique index `(cup_week_id, player_id) WHERE ranked = 1`, so the entry is consumed. The deadline is start + 240 s on the clock + 30 s extra time. Chapter and Road runs (10 shots) get 210 s + 30 s. The windows were 90 + 30 s and 75 + 45 s until real-phone testing showed they were too short: each shot's animation alone takes 3–4 s. Submissions contain only 12 commands, which are validated, checked against the course order and re-simulated.
* **Exactly-once acceptance:** one `D1.batch` (a transaction) claims the run with `UPDATE … WHERE state = 'started'`. It then inserts `run_shots` and `goal_ledger` rows with `INSERT … SELECT … WHERE <claim landed>`, protected by `PRIMARY KEY(run_id, idx)` and `UNIQUE(run_id, shot_index)`. A concurrent duplicate aborts the whole batch, and a retry with the same idempotency key returns the stored result.
* **Review holds:** a run is held for review instead of ranked if it finished in under 18 s or scored 12 goals with at least 10 top corners. It is held, never auto-rejected. Owners review with SQL (see `docs/OPERATIONS.md`).
* **Cron** `17 * * * *`: ensure the current week, expire overdue runs, close finished weeks, and insert provisional winners (all rank-1 ties). Award keys are unique, so it is idempotent.
* **Not built yet:** Turnstile (needs an owner-created widget), R2, Durable Objects.

## As built in Milestone 3

* **Run modes:** `runs.mode` is `cup | chapter | road`. Chapter and road runs store their own course (`scenario_ids`). Chapter runs carry a `stage` (1–6). Starting either is unlimited; submission and verification share the cup pipeline (exact course order, re-simulation, atomic idempotent acceptance, review holds: under 1.5 s per shot, or all goals with at most 2 non-top-corners).
* **One career ledger:** `goal_ledger` rows come from accepted cup, road and chapter runs. A chapter goal is inserted only while `COUNT(ledger rows for that player and stage) < 7`, a condition evaluated inside the same batch transaction, so concurrent runs can't exceed the quota and replays add nothing.
* **Awards** (`src/worker/db/awards.ts`): set-based, idempotent `INSERT OR IGNORE` keyed by `award_key`. Milestones `milestone-N:<player>` and `badge-2008:<player>` are `confirmed`. `founding-golden-fan` goes to the player whose 1,000th ledger row has the lowest ledger id (`ROW_NUMBER()` window, revoked players excluded) as `provisional`. It runs after each accepted run and in the hourly cron.
* **Road courses:** chosen by the server with a random seed per run. The tier is set by the player's career total.
* **Share previews:** `run_worker_first` includes `/u/*` and `/c/*`. The Worker fetches the SPA shell from `ASSETS` and rewrites `<title>` and the OG/Twitter tags with `HTMLRewriter`. The default image is the static `og.png`. Player share cards are drawn on the device with canvas.
* **New endpoints:** `GET /api/v1/progress` (guest-safe), `GET /api/v1/challenges/:runId` (accepted ranked cup runs only), `POST /api/v1/reports`. The Hall of Fame response includes `founding`.

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
