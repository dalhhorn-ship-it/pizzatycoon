# Infrastructure: Pizza D

## Hosting (ADR-007)

* One Cloudflare Worker serves the Vite build (`dist/`) as static assets and the save API under `/api/*`.
* Cloud saves live in a D1 database bound to the Worker (ADR-005). Schema migrations are in `worker/migrations/` and applied with `wrangler d1 migrations apply`, never by hand in the dashboard.
* Configuration: `wrangler.jsonc` at the repo root.

### First time setup (once, by the founder)

1. `npx wrangler login`
2. `npx wrangler d1 create pizza-d-saves` and copy the printed `database_id` into `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. `npm run deploy`
5. For CI deploys: create a Cloudflare API token with Workers and D1 edit rights and add it as the GitHub secret `CLOUDFLARE_API_TOKEN`, plus `CLOUDFLARE_ACCOUNT_ID`.

## Environments

| Environment | What | Trigger |
|---|---|---|
| Local game only | `npm run dev` (saves stay local) | Developer |
| Local with Worker and D1 | `npm run build && npm run worker:dev` | Developer |
| Production | Cloudflare Worker `pizza-d` | Merge to main (when the secrets are set) |

## CI pipeline (`.github/workflows/ci.yml`)

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint` (includes the simulation purity rules)
4. `npm test` (unit, golden day, balance harness)
5. `npm run build`
6. On main, when `CLOUDFLARE_API_TOKEN` is set: apply D1 migrations and `wrangler deploy`

## Monitoring

* No third party analytics. Errors are logged locally and shown in a debug panel; the player can copy a diagnostic report.
* Optional later: self hosted Plausible with consent (PRD Q11).

## Backup and recovery

* Saves: local copy plus cloud copy; the previous revision is kept as a second slot on both sides.
* D1: Time Travel point in time recovery (30 days); schema is code so a fresh database can be recreated.
