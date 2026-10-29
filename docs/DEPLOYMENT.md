# Deployment notes (owner actions — not yet performed)

Milestone 1 is a **local preview**. Nothing below has been executed. Do these only when the owner explicitly approves a deployment.

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

## Not needed for Milestone 1

No D1 database, secrets, KV, R2, Durable Objects, Turnstile or Cron Triggers. Milestone 2 will add D1 (local migrations first) and document its bindings here.
