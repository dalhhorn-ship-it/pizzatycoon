# ADR-005: Local first saves with Supabase cloud sync behind a port

* Status: Accepted (2026-09-26)

## Context

Founder decision: cloud saves so a game continues between iPad and desktop browsers. The game must stay playable offline and free to run. iPad Safari can evict site storage and kill background tabs.

## Options considered

| Option | Pros | Cons | Lock-in | Cost |
|---|---|---|---|---|
| **Supabase (Postgres, auth, row level security)** | Anonymous auth and magic links built in, open source, self hostable | One more service to run | Low: plain Postgres schema | Free tier fits early scale |
| PocketBase self hosted | Single binary, simple | We run and back up a server | None | Small VPS |
| Firebase | Mature | Proprietary, Google tracking concerns | High | Free tier |
| Save codes (copy and paste) only | No backend | Poor experience | None | Zero |

## Decision

A `SaveStore` port with a local adapter (localStorage in M0, IndexedDB in v0.1) and a Supabase adapter in v0.1. Anonymous sign in on first launch; linking an email magic link lets the player sign in on a second device. Saves carry `schemaVersion`, `revision` and `baseRevision`; conflicts are shown to the player, never resolved silently. A "copy save code" export stays available as a backend free fallback.

## Consequences

* Privacy policy needed for the email link (PRD D4).
* Exit path: the same table on any Postgres, or PocketBase behind the same port.
