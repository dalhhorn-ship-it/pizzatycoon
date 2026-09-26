# ADR-003: Canvas2D floor view first, PixiJS when sprite counts demand it

* Status: Accepted (2026-09-26)

## Context

The floor shows the grid, tables, decor, kitchen and up to about 120 seated guests plus staff. Target 60 fps on an older iPad, with low battery use.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Canvas2D** | Zero dependencies, simple, good up to a few hundred sprites | CPU bound at high sprite counts |
| PixiJS (WebGL) | GPU batching, thousands of sprites, filters for lighting | About 150 KB more, WebGL context loss handling |
| DOM or SVG elements | Easy hit testing | Layout thrash with many moving elements |

## Decision

Canvas2D in M0 with a render on change loop (the loop sleeps when nothing moves or the tab is hidden). If the M0 performance spike misses 60 fps with 120 guests on the minimum iPad, switch the floor adapter to PixiJS. The floor is an adapter behind a small interface, so the switch touches only `src/ui/floor/`.

## Consequences

* The floor must not own any game rules; placement validity comes from the sim.
