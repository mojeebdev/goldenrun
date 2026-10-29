# Operations (owner)

Plain Wrangler commands against the production D1 database. Read-only queries are safe; anything that changes data is marked **writes**.

## Look around

```bash
npx wrangler d1 execute goldenrun-db --remote --command "SELECT id, status, starts_at, ends_at FROM cup_weeks ORDER BY id DESC LIMIT 5"
```

```bash
npx wrangler d1 execute goldenrun-db --remote --command "SELECT r.id, p.handle, r.skill_score, r.goals, r.review_reason, r.submitted_at FROM runs r JOIN players p ON p.id = r.player_id WHERE r.state = 'pending_review' ORDER BY r.submitted_at"
```

## Review a held run

Replay check: the stored `run_shots.command` values are what the server already re-simulated. Look for obviously scripted patterns (identical precision, inhuman timing).

Accept it (**writes** — also credits its career goals):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE runs SET state = 'accepted' WHERE id = 'RUN_ID' AND state = 'pending_review'; INSERT OR IGNORE INTO goal_ledger (player_id, run_id, shot_index, created_at) SELECT r.player_id, s.run_id, s.idx, CAST(strftime('%s','now') AS INTEGER) * 1000 FROM run_shots s JOIN runs r ON r.id = s.run_id WHERE s.run_id = 'RUN_ID' AND s.goal = 1 AND r.state = 'accepted';"
```

Reject it (**writes**):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE runs SET state = 'rejected' WHERE id = 'RUN_ID' AND state = 'pending_review'"
```

If the week had already closed, its winners are re-checked on the next hourly cron (new rank-1 runs get provisional awards). Revoke a provisional award that no longer holds (**writes**):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE awards SET review_state = 'revoked' WHERE award_key = 'cup-week-winner:2026-W45:PLAYER_ID'"
```

## Confirm a weekly winner after review (**writes**)

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE awards SET review_state = 'confirmed' WHERE award_key LIKE 'cup-week-winner:2026-W45:%' AND review_state = 'provisional'"
```

## Backups

```bash
npx wrangler d1 export goldenrun-db --remote --output goldenrun-backup.sql
```

D1 also keeps 30 days of point-in-time recovery (Time Travel): `npx wrangler d1 time-travel info goldenrun-db`.
