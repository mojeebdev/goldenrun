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

## Founding Golden Fan audit

The title is created automatically as **provisional** for the player whose 1,000th accepted goal has the lowest ledger id.

See who holds it and how they got there:

```bash
npx wrangler d1 execute goldenrun-db --remote --command "SELECT a.player_id, p.handle, a.review_state, a.awarded_at FROM awards a JOIN players p ON p.id = a.player_id WHERE a.award_type = 'founding-golden-fan'"
```

```bash
npx wrangler d1 execute goldenrun-db --remote --command "SELECT r.mode, r.state, COUNT(*) runs, SUM(r.goals) goals, MIN(r.submitted_at) first, MAX(r.submitted_at) last FROM runs r WHERE r.player_id = 'PLAYER_ID' GROUP BY r.mode, r.state"
```

Confirm it (**writes**):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE awards SET review_state = 'confirmed' WHERE award_key = 'founding-golden-fan' AND review_state = 'provisional'"
```

Revoke it (**writes**). Freeing the unique key lets the next hourly cron hand the title to the next player in ledger order; revoked players are never chosen again:

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE awards SET review_state = 'revoked', award_key = 'founding-golden-fan:revoked:' || player_id WHERE award_key = 'founding-golden-fan'"
```

## Player reports

```bash
npx wrangler d1 execute goldenrun-db --remote --command "SELECT r.id, t.handle AS target, r.reason, r.note, r.created_at FROM reports r JOIN players t ON t.id = r.target_id WHERE r.resolved_at IS NULL ORDER BY r.created_at"
```

Rename an offensive nickname (**writes**):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE players SET handle = 'Player_1234', handle_norm = 'player_1234' WHERE handle_norm = 'badname'"
```

Mark a report handled (**writes**):

```bash
npx wrangler d1 execute goldenrun-db --remote --command "UPDATE reports SET resolved_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE id = 1"
```
