# ADR-006: Headless tests and a balance harness in CI

* Status: Accepted (2026-09-26)

## Context

The acceptance criteria include numeric balance checks (AC-10 to AC-12, AC-72, AC-105, AC-114): two strategies both viable, neither dominant, the middle ground viable but not dominant, no dead ends.

## Decision

* Vitest for unit tests of every formula (checked against `balance.md` worked numbers), the day model (golden starter day), commands and save migrations.
* `tests/balance/`: builds the three reference restaurants of `balance.md` section 3, runs them in all three districts, and asserts the section 3.5 checks. It prints a profit table so a balance change shows its effect in the CI log.
* Seeded property tests: random menus, prices and rooms never produce NaN, negative covers or runaway cash.
* Playwright smoke test on WebKit for the UI in v0.1.

## Consequences

* A tuning change that breaks a strategy fails CI; the designer either adjusts or updates the guardrail in `balance.md` 3.7 with a reason.
