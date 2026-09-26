# ADR-002: Pure, deterministic simulation core with an aggregate day model

* Status: Accepted (2026-09-26)

## Context

The economy is the product (PRD pillars, `balance.md`). It must be testable without a browser, reproducible, tunable from data, and able to run up to six off screen locations. The PRD asked for an agent simulation that matches a reference calculator within 10% (AC-72).

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Full agent simulation per guest, per tick | Emergent detail | Slow, hard to balance, two sources of truth, heavy on old iPads |
| Aggregate model only, no guests on screen | Simple, fast | Not cosy; nothing to watch |
| **Aggregate model as authority, guests generated for the view** | One source of truth, fast, testable, still lively on screen | Mid service interventions are modifiers, not true agent reactions |

## Decision

`src/sim` is a pure TypeScript reducer `apply(state, command) -> { state, events }` with no imports from the DOM, UI, save layer or packages, no `Math.random` and no clock. The day is resolved by the aggregate formulas in `balance.md`; the floor view animates a guest stream that is consistent with the day report and never affects the economy.

## Consequences

* AC-72 is satisfied by construction.
* Every balance number is covered by headless tests, including the strategy checks.
* Import boundaries and the ban on `Math.random` and `Date` in `src/sim` are enforced by ESLint rules.
