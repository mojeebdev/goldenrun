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
