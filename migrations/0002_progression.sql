-- Golden Run — Milestone 3: chapter and Road to 1,000 runs, player reports.
--
-- Safe-change notes:
-- * Rebuilds `runs` to widen the `mode` CHECK and make `cup_week_id`
--   nullable (SQLite can't alter constraints in place). Every existing row
--   is copied unchanged; foreign keys are deferred for the duration, as D1
--   recommends for table rebuilds.
-- * IMPORTANT: dropping `runs` still fires `run_shots`' ON DELETE CASCADE even
--   with deferred checks, so `run_shots` is copied aside first and restored
--   after the rename (verified by a migrate-with-data test).
-- * Backward compatible: Milestone 2 code keeps working against the new
--   table (new columns are nullable), so this can be applied before the
--   Milestone 3 deploy.
-- * Rollback: restore from D1 Time Travel to the bookmark taken before
--   applying (see docs/DEPLOYMENT.md); don't hand-edit back.

PRAGMA defer_foreign_keys = true;

CREATE TABLE runs_new (
  id              TEXT PRIMARY KEY,
  player_id       TEXT NOT NULL REFERENCES players(id),
  mode            TEXT NOT NULL CHECK (mode IN ('cup', 'chapter', 'road')),
  ranked          INTEGER NOT NULL CHECK (ranked IN (0, 1)),
  cup_week_id     TEXT REFERENCES cup_weeks(id),   -- cup runs only
  stage           INTEGER,                          -- chapter runs only (1–6)
  scenario_ids    TEXT,                             -- JSON course for chapter/road runs
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
  review_reason   TEXT,
  CHECK ((mode = 'cup') = (cup_week_id IS NOT NULL)),
  CHECK ((mode = 'chapter') = (stage IS NOT NULL))
);

INSERT INTO runs_new (id, player_id, mode, ranked, cup_week_id, stage, scenario_ids, ruleset_version, nonce_hash,
                      started_at, deadline_at, submitted_at, state, skill_score, goals, precision_total, misses,
                      idempotency_key, input_hash, review_reason)
SELECT id, player_id, mode, ranked, cup_week_id, NULL, NULL, ruleset_version, nonce_hash,
       started_at, deadline_at, submitted_at, state, skill_score, goals, precision_total, misses,
       idempotency_key, input_hash, review_reason
  FROM runs;

CREATE TABLE run_shots_keep AS SELECT * FROM run_shots;

DROP TABLE runs;
ALTER TABLE runs_new RENAME TO runs;

INSERT INTO run_shots (run_id, idx, scenario_id, command, outcome, goal, skill_points, precision, modifiers)
SELECT run_id, idx, scenario_id, command, outcome, goal, skill_points, precision, modifiers FROM run_shots_keep;
DROP TABLE run_shots_keep;

CREATE UNIQUE INDEX runs_one_ranked_entry ON runs(cup_week_id, player_id) WHERE ranked = 1;
CREATE INDEX runs_leaderboard ON runs(cup_week_id, ranked, state, skill_score DESC, goals DESC, precision_total DESC, misses ASC);
CREATE INDEX runs_player ON runs(player_id, started_at DESC);
CREATE INDEX runs_open ON runs(state, deadline_at);
CREATE INDEX runs_chapter ON runs(player_id, mode, stage);

-- Ledger order is the authoritative "who got there first" order.
CREATE INDEX goal_ledger_player_order ON goal_ledger(player_id, id);

-- Player reports (abuse, offensive nicknames, suspected cheating). Reviewed by the owner.
CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  target_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL CHECK (reason IN ('nickname', 'cheating', 'other')),
  note        TEXT,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER,
  UNIQUE (reporter_id, target_id, reason)
);
CREATE INDEX reports_open ON reports(resolved_at, created_at);

PRAGMA defer_foreign_keys = false;
