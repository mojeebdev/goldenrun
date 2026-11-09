# Deployment notes (owner actions)

**Status (2026-10-29):** the owner deployed Milestone 1 to `https://goldenrun.fun`. HTTPS checks passed: `/`, `/play` and `/api/health` return 200, and the health digest `b21e6426` matches the test suite. Still open: `www.goldenrun.fun` (doesn't resolve). The steps below are kept as a reference for redeploys.

## Build locally

```bash
npm ci
npm run check            # typecheck, lint, tests, build
npm run deploy:dry-run   # validates the Worker bundle; uploads nothing
```

## First deployment (when approved)

1. **Cloudflare Workers Builds (recommended):** Cloudflare dashboard → Workers & Pages → Create → Import a repository → `mojeebdev/goldenrun`, branch `main`. Build command `npm run build`, deploy command `npx wrangler deploy`. The Worker name is `goldenrun` (from `wrangler.jsonc`).
   *Or* from a trusted machine: `npx wrangler login`, then `npm run build && npx wrangler deploy`.
2. Check the `*.workers.dev` URL: `/`, `/play`, `/api/health` (expect `{"ok":true,...}`).
3. **Custom domain:** the domain `goldenrun.fun` is already purchased and on Cloudflare — do **not** re-buy it or change nameservers. Worker → Settings → Domains & Routes → Add → Custom domain → `goldenrun.fun` (and decide the `www` policy: add `www.goldenrun.fun` as a custom domain or a redirect rule). Verify HTTPS and that the old zone records don't conflict.
4. Only after the above is verified, update the release history in `docs/DEVELOPMENT.md` and the CHANGELOG to say the site is live.

## Milestone 2: database and redeploy (run in this order)

**Status:** all steps done on 2026-10-29. Tables were verified with `SELECT name FROM sqlite_master`, and the live API was checked.

**Workers Builds:** Git-triggered builds failed on the PR branch even though the same commits build locally. Check that Worker → Settings → Build uses build command `npm run build`, deploy command `npx wrangler deploy`, and non-production deploy command `npx wrangler versions upload`. Until those builds pass, deploy manually with step 3.

Run these from the repository root on your machine, logged in with `npx wrangler login`.

1. **Create the production database** (done 2026-10-29: `goldenrun-db`, region WEUR, ID committed in `wrangler.jsonc`):

   ```bash
   npx wrangler d1 create goldenrun-db
   ```

2. **After the ID is committed** and you've pulled the branch, create the tables in production:

   ```bash
   npx wrangler d1 migrations apply goldenrun-db --remote
   ```

3. **Deploy** (adds the D1 binding, the two rate limiters and the hourly cron to the same Worker):

   ```bash
   npm ci && npm run build && npx wrangler deploy
   ```

4. **Check it:**

   ```bash
   curl -s https://goldenrun.fun/api/v1/bootstrap
   ```

   Expect JSON with `"cup":{"weekId":...}`. Then create a player at https://goldenrun.fun/join on your phone.

No secrets are needed. Rate limiters (`ratelimits` in `wrangler.jsonc`) and the cron trigger are created by `wrangler deploy` itself; there is nothing to set up in the dashboard. Day-to-day review commands are in [OPERATIONS.md](OPERATIONS.md).

**Order matters:** don't deploy Milestone 2 before step 2. Without the tables, the account and cup APIs will error, although practice still works.

## Milestone 3: migration 0002, then deploy

**Status:** done on 2026-10-29. `0002` was applied remotely and counts checked. Merging to `main` auto-deployed through Workers Builds, so production deploys from `main` now work. Pull-request preview builds still fail during build setup; check the non-production branch build settings in the Cloudflare dashboard.

`0002_progression.sql` rebuilds the `runs` table (all data is kept; it has been tested on a database with Milestone 2 data). It is backward compatible, so **apply it before merging/deploying Milestone 3**:

1. Note a restore point, just in case:

   ```bash
   npx wrangler d1 time-travel info goldenrun-db
   ```

2. Apply:

   ```bash
   npx wrangler d1 migrations apply goldenrun-db --remote
   ```

3. Check that `reports` exists and runs were kept:

   ```bash
   npx wrangler d1 execute goldenrun-db --remote --command "SELECT (SELECT COUNT(*) FROM runs) runs, (SELECT COUNT(*) FROM run_shots) shots, (SELECT COUNT(*) FROM goal_ledger) goals, (SELECT COUNT(*) FROM reports) reports"
   ```

4. Merge the pull request (Workers Builds deploys `main`) or deploy manually: `npm ci && npm run build && npx wrangler deploy`.

## Birthday page: migration 0003, then deploy (birthday.goldenrun.fun)

"Has Ronaldo scored on your birthday?" uses the same Worker and the same D1. Migration `0003_birthday_goals.sql` creates `cr7_goals` and loads all 985 official goals up to 29 Oct 2026. It only adds a table, so it's safe to apply before the code ships.

1. Apply: `npx wrangler d1 migrations apply goldenrun-db --remote`
2. Check: `npx wrangler d1 execute goldenrun-db --remote --command "SELECT COUNT(*) goals, COUNT(DISTINCT month_day) days FROM cr7_goals"`. Expect `985` and `288`.
3. Deploy `main` (Workers Builds) or manually: `npm ci && npm run build && npx wrangler deploy`. The build pre-renders 367 share cards into `public/birthday/og/`, which takes about a minute.
4. `wrangler deploy` attaches `birthday.goldenrun.fun` as a second Custom Domain from `wrangler.jsonc`, and Cloudflare creates the DNS record and certificate. Check Settings → Domains & Routes lists both domains.
5. Smoke test:
   - https://birthday.goldenrun.fun/aug-12 shows 4 goals.
   - https://goldenrun.fun/birthday/aug-12 returns a 301 to the subdomain.
   - Paste https://birthday.goldenrun.fun/may-2 into the X composer (or https://cards-dev.twitter.com/validator) and check that the card image appears.

**When he scores again:**
1. Add rows to `data/birthday/source-recent.csv`, using the next career number, minute, score, H/A/N, date and competition.
2. Add any away or neutral venue to `NEUTRAL_VENUES` in `scripts/birthday/stadiums.mjs`, and bump `EXPECTED_TOTAL` in `build-data.mjs`.
3. Run `npm run birthday:data`, commit and deploy.
4. Load the new rows with `npm run birthday:seed:remote`, which replaces the table contents in one file.

Applied migrations never change.

## Cloudflare dashboard checklist (no command line)

Everything production needs is already set up. Use this list to check it, or to rebuild it from the dashboard. Don't buy the domain again or change nameservers: goldenrun.fun is already on Cloudflare.

1. **Worker and builds:** Workers & Pages → `goldenrun` → Settings → Build.
   - Git repository `mojeebdev/goldenrun`, production branch `main`.
   - Build command `npm run build`.
   - Deploy command `npx wrangler deploy`.
2. **Preview builds (optional):** on the same page, under "Builds for non-production branches", either turn them off or set a non-production deploy command such as `npx wrangler versions upload`. PR previews have failed in about a second on every PR, which points at this setting. Production isn't affected.
3. **D1 binding:** Workers & Pages → `goldenrun` → Settings → Bindings should list `DB` → `goldenrun-db`. It comes from `wrangler.jsonc` on every deploy, so don't add it by hand. The database is under Storage & Databases → D1. The Console tab runs SQL, and Time Travel restores to a point in time.
4. **Custom domain:** Workers & Pages → `goldenrun` → Settings → Domains & Routes should list `goldenrun.fun` as a Custom Domain. It also comes from `wrangler.jsonc`; Cloudflare creates the DNS record and the certificate. The `www` redirect is your existing redirect rule.
5. **SSL/TLS:** goldenrun.fun → SSL/TLS → Overview: **Full (strict)**. Edge Certificates: **Always Use HTTPS** on, minimum TLS 1.2.
6. **Rate limits and cron** are created by `wrangler deploy` from `wrangler.jsonc`; there's nothing to set up. Settings → Trigger Events should list the cron `17 * * * *`.
7. **Notifications (recommended):** Notifications → Add → Workers: weekly summary or error alerts for `goldenrun`.
8. **Analytics (owner decision):** Cloudflare Web Analytics (goldenrun.fun → Analytics & Logs → Web Analytics) is cookieless and needs no code. The privacy page currently says "no analytics service", so **update `/privacy` before turning it on**.

## Rollback

- **Code:** list versions and roll back the Worker without touching data:

  ```bash
  npx wrangler deployments list
  ```

  ```bash
  npx wrangler rollback
  ```

- **Database:** restore D1 to a point in time (last 30 days). This overwrites everything written since then, so only use it for a broken migration:

  ```bash
  npx wrangler d1 time-travel restore goldenrun-db --timestamp=2026-10-29T12:00:00Z
  ```
