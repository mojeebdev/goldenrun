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
4. Only after the above is verified, update README "Project status" to say the site is live.

## Milestone 2: database and redeploy (run in this order)

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
