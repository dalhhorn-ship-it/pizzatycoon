# ADR-005: Local first saves with cloud sync on a Cloudflare Worker and D1

* Status: Accepted (2026-09-26), revised the same day when the founder chose Cloudflare Workers for publishing

## Context

Founder decisions: cloud saves so a game continues between iPad and desktop browsers; the game is published on Cloudflare Workers. The game must stay playable offline and cost next to nothing to run. iPad Safari can evict site storage and kill background tabs.

## Options considered

| Option | Pros | Cons | Lock-in | Cost |
|---|---|---|---|---|
| **Same Worker that serves the game, saves in D1** | One deploy, one platform, no extra account, same origin (no CORS), tiny code | Cloudflare specific bindings | Low: D1 is SQLite; the API is 4 plain HTTP routes that run on any server | Free tier fits early scale |
| Supabase | Auth built in, open source | Second platform and account, CORS | Low | Free tier |
| Workers KV | Simple | Eventually consistent, weak for revision checks | Medium | Free tier |
| Save codes only | No backend | Poor experience | None | Zero |

## Decision

* A `SaveStore` port with a local adapter (localStorage in M0, IndexedDB in v0.1) and a cloud adapter that talks to `/api/*` on the same Worker.
* **Identity without accounts:** on first sync the browser gets an anonymous player id and a random secret token (only a SHA-256 hash is stored). To continue on another device the player taps "Link a device", gets a 6 character code valid for 15 minutes, and enters it on the other device, which then receives its own token for the same player. No email, no password, no personal data.
* **Conflicts:** saves carry a `revision`. A write names the `baseRevision` it was built on; if the cloud has moved on, the Worker answers 409 and the game shows both saves (day, cash, stars, time) and lets the player pick. No silent overwrites.
* A "copy save code" export stays available as a backend free fallback.

## Consequences

* No privacy policy for personal data is needed beyond a short note that an anonymous id and the save are stored.
* Exit path: the four routes and the SQLite schema run unchanged on any Node or Deno server with SQLite or Postgres.
