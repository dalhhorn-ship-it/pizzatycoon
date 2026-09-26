# Infrastructure: Pizza D

## Hosting

* Static site: the Vite build (`dist/`) is deployed to GitHub Pages from the main branch by GitHub Actions. Any static host or CDN (Cloudflare Pages, Netlify, S3) works without changes.
* Cloud save (v0.1): one Supabase project. Schema and row level security policies live in `supabase/migrations/` and are applied by CI, never by hand.

## Environments

| Environment | What | Trigger |
|---|---|---|
| Local | `npm run dev` | Developer |
| Preview | Build artifact per pull request | Pull request |
| Production | GitHub Pages | Merge to main |

## CI pipeline (`.github/workflows/ci.yml`)

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint` (includes the simulation purity rules)
4. `npm test` (unit, golden day, balance harness)
5. `npm run build`
6. On main: deploy `dist/` to GitHub Pages

## Monitoring

* No third party analytics. Errors are logged locally and shown in a debug panel; the player can copy a diagnostic report.
* Optional later: self hosted Plausible with consent (PRD Q11).

## Backup and recovery

* Saves: local copy plus cloud copy; the previous revision is kept as a second slot on both sides.
* Supabase: daily backups on the project; schema is code so a fresh project can be recreated.
