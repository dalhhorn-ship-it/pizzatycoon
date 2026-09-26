# ADR-007: Publish on Cloudflare Workers with static assets

* Status: Accepted (2026-09-26, founder decision)

## Context

The game is a static bundle plus a very small save API. The founder publishes on Cloudflare Workers.

## Decision

* One Worker (`worker/`) with the Vite build (`dist/`) bound as static assets and a D1 database for saves. Configuration in `wrangler.jsonc`, schema in `worker/migrations/`, both in version control.
* Requests to `/api/*` go to the save API; everything else is served from assets with single page fallback.
* Deploys run from CI with `wrangler deploy` on merge to main, using a Cloudflare API token stored as a GitHub secret. No dashboard changes by hand.

## Consequences

* Static assets are served from Cloudflare's edge; saves are same origin, so no CORS and no third party calls.
* Portability: the bundle is plain static files and the API is plain HTTP, so moving hosts means rewriting one small Worker file.
