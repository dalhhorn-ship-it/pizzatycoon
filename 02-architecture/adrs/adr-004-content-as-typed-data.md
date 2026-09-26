# ADR-004: Content and balance as typed TypeScript data modules

* Status: Accepted (2026-09-26)

## Context

Every number in `balance.md` is a tuning assumption that designers will change often. Changes must be reviewable and must not require touching logic.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Typed TS modules (`as const satisfies`)** | Compile time checks, comments, no runtime schema library | Designers edit code files |
| JSON plus runtime schema (zod or JSON Schema) | Tool friendly | Extra dependency, weaker editor help |
| Spreadsheet or remote config | Designer friendly | Snowflake state, not versioned with code |

## Decision

`src/data/*.ts`, one file per content area, holding plain objects. A validation test checks each value against the safe range in `balance.md`. A CSV export and import script can be added when a designer asks for it.

## Consequences

* A pull request that changes `src/data` shows the balance harness result in CI.
