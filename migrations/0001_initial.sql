-- Golden Run — Milestone 2 initial schema (Cloudflare D1 / SQLite).
--
-- Safe-change notes:
-- * This migration only CREATEs objects; it never drops or rewrites data.
-- * Rollback before any real data exists: drop the tables in reverse order.
--   After launch, never roll back destructively — add a forward migration.
-- * All timestamps are integer milliseconds since the Unix epoch (UTC).

PRAGMA foreign_keys = ON;

-- Public player identity. Handles are unique case-insensitively via handle_norm.
CREATE TABLE players (
  id            TEXT PRIMARY KEY,                 -- opaque UUID
  handle        TEXT NOT NULL,                    -- display form, 3–20 chars
  handle_norm   TEXT NOT NULL UNIQUE,             -- lowercased for uniqueness
  country_code  TEXT,                             -- optional, user-selected ISO 3166-1 alpha-2
  visibility    TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  account_state TEXT NOT NULL DEFAULT 'active' CHECK (account_state IN ('active', 'deleted')),
  created_at    INTEGER NOT NULL
);

-- WebAuthn passkeys. Public keys only; never exposed publicly.
CREATE TABLE passkey_credentials (
  id           TEXT PRIMARY KEY,                  -- credential ID (base64url)
  player_id    TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  public_key   TEXT NOT NULL,                     -- COSE public key (base64url)
  counter      INTEGER NOT NULL DEFAULT 0,
  transports   TEXT,                              -- JSON array
  device_type  TEXT,                              -- singleDevice | multiDevice
  backed_up    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX passkey_credentials_player ON passkey_credentials(player_id);

-- Short-lived, single-use WebAuthn challenges, looked up by a hashed opaque ID.
CREATE TABLE webauthn_challenges (
  id              TEXT PRIMARY KEY,               -- SHA-256 of the opaque challenge handle
  challenge       TEXT NOT NULL,                  -- base64url challenge bytes
  action          TEXT NOT NULL CHECK (action IN ('register', 'login', 'add-passkey')),
  player_id       TEXT REFERENCES players(id) ON DELETE CASCADE,  -- existing player (login/add-passkey)
  pending_player_id TEXT,                         -- id reserved for a registration in progress
  pending_handle  TEXT,
  pending_country TEXT,
  expires_at      INTEGER NOT NULL,
  used_at         INTEGER
);
CREATE INDEX webauthn_challenges_expiry ON webauthn_challenges(expires_at);

-- Sessions: only the SHA-256 of the cookie secret is stored.
CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,                    -- SHA-256(session secret)
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX sessions_player ON sessions(player_id);

-- One-time recovery codes (high entropy, stored hashed).
CREATE TABLE recovery_codes (
  code_hash  TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX recovery_codes_player ON recovery_codes(player_id);

-- Immutable rule versions that ranked runs depend on.
CREATE TABLE rulesets (
  version     TEXT PRIMARY KEY,
  checksum    TEXT NOT NULL,                      -- canonical-shot digest for this version
  enabled_at  INTEGER NOT NULL,
  archived_at INTEGER
);
INSERT INTO rulesets (version, checksum, enabled_at) VALUES ('gr-1.0.0', 'b21e6426', 1793232000000);

-- Weekly Golden Cup: immutable challenge package per ISO week (UTC).
CREATE TABLE cup_weeks (
  id                TEXT PRIMARY KEY,             -- e.g. 2026-W44
  starts_at         INTEGER NOT NULL,
  ends_at           INTEGER NOT NULL,
  ruleset_version   TEXT NOT NULL REFERENCES rulesets(version),
  scenario_ids      TEXT NOT NULL,                -- JSON array of 12 scenario IDs, in order
  scenario_set_hash TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'finalized')),
  finalized_at      INTEGER
);

-- Server-issued runs. Starting a ranked run consumes the week's single ranked entry.
CREATE TABLE runs (
  id              TEXT PRIMARY KEY,               -- opaque UUID
  player_id       TEXT NOT NULL REFERENCES players(id),
  mode            TEXT NOT NULL CHECK (mode IN ('cup')),
  ranked          INTEGER NOT NULL CHECK (ranked IN (0, 1)),
  cup_week_id     TEXT NOT NULL REFERENCES cup_weeks(id),
  ruleset_version TEXT NOT NULL REFERENCES rulesets(version),
  nonce_hash      TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  deadline_at     INTEGER NOT NULL,
  submitted_at    INTEGER,
  state           TEXT NOT NULL DEFAULT 'started'
                  CHECK (state IN ('started', 'accepted', 'pending_review', 'rejected', 'expired')),
  skill_score     INTEGER,
  goals           INTEGER,
  precision_total INTEGER,
  misses          INTEGER,
  idempotency_key TEXT,
  input_hash      TEXT,
  review_reason   TEXT
);
CREATE UNIQUE INDEX runs_one_ranked_entry ON runs(cup_week_id, player_id) WHERE ranked = 1;
CREATE INDEX runs_leaderboard ON runs(cup_week_id, ranked, state, skill_score DESC, goals DESC, precision_total DESC, misses ASC);
CREATE INDEX runs_player ON runs(player_id, started_at DESC);
CREATE INDEX runs_open ON runs(state, deadline_at);

-- Authoritative per-shot results, recomputed by the Worker.
CREATE TABLE run_shots (
  run_id       TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL CHECK (idx BETWEEN 0 AND 11),
  scenario_id  TEXT NOT NULL,
  command      TEXT NOT NULL,                     -- normalised ShotCommand JSON
  outcome      TEXT NOT NULL,
  goal         INTEGER NOT NULL,
  skill_points INTEGER NOT NULL,
  precision    INTEGER NOT NULL,
  modifiers    TEXT NOT NULL,                     -- JSON
  PRIMARY KEY (run_id, idx)
);

-- Immutable accepted career-goal events: one row per goal, never per point.
CREATE TABLE goal_ledger (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,   -- server acceptance order
  player_id  TEXT NOT NULL REFERENCES players(id),
  run_id     TEXT NOT NULL REFERENCES runs(id),
  shot_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (run_id, shot_index)
);
CREATE INDEX goal_ledger_player ON goal_ledger(player_id);

-- Unofficial in-game recognitions; award_key makes each award unique.
CREATE TABLE awards (
  id           TEXT PRIMARY KEY,
  player_id    TEXT NOT NULL REFERENCES players(id),
  award_type   TEXT NOT NULL,                     -- cup-week-winner | ...
  award_key    TEXT NOT NULL UNIQUE,              -- e.g. cup-week-winner:2026-W44:<player>
  source_run   TEXT REFERENCES runs(id),
  awarded_at   INTEGER NOT NULL,
  review_state TEXT NOT NULL DEFAULT 'provisional' CHECK (review_state IN ('provisional', 'confirmed', 'revoked'))
);
CREATE INDEX awards_player ON awards(player_id);

-- Structured, non-sensitive audit trail (no IPs, cookies, challenges or codes).
CREATE TABLE audit_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  kind      TEXT NOT NULL,
  player_id TEXT,
  detail    TEXT
);
CREATE INDEX audit_events_at ON audit_events(at);
