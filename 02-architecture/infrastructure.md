# Infrastructure: Pizza D

## Hosting (ADR-007)

* One Cloudflare Worker serves the Vite build (`dist/`) as static assets and the save API under `/api/*`.
* Cloud saves live in a D1 database bound to the Worker (ADR-005). Schema migrations are in `worker/migrations/` and applied with `wrangler d1 migrations apply`, never by hand in the dashboard.
* Configuration: `wrangler.jsonc` at the repo root.

### Cloudflare Workers Builds (git connected)

* Production branch: `main`. Only code on that branch is deployed.
* Build command: leave empty (or `npm ci`). Deploy command: `npx wrangler deploy`.
* `wrangler.jsonc` runs `npm run build` before every deploy, and has no `database_id`, so the first deploy creates the D1 database automatically.
* The Worker creates its tables on first use (`CREATE TABLE IF NOT EXISTS`), so no manual migration step is needed. `worker/migrations/` holds the same schema for `wrangler d1 migrations` when a later schema change needs a real migration.

### Manual deploy from a laptop

1. `npx wrangler login`
2. `npm run deploy`

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
6. Deploys happen in Cloudflare Workers Builds on pushes to `main` (see above); the GitHub workflow only deploys when `CLOUDFLARE_API_TOKEN` is set, for teams that prefer deploying from Actions

## Monitoring

* No third party analytics. Errors are logged locally and shown in a debug panel; the player can copy a diagnostic report.
* Optional later: self hosted Plausible with consent (PRD Q11).

## Backup and recovery

* Saves: local copy plus cloud copy; the previous revision is kept as a second slot on both sides.
* D1: Time Travel point in time recovery (30 days); schema is code so a fresh database can be recreated.
