# ADR-001: Browser game in TypeScript, built with Vite, installable as a web app

* Status: Accepted (2026-09-26)

## Context

The founder decided Pizza D is free, played in the browser on iPad (Safari, Chrome) and desktop, with no native app. On iPad every browser is WebKit, so WebKit is the real target. The game is mostly menus, tables and cards, with one animated restaurant floor.

## Options considered

| Option | Pros | Cons | Lock-in or WebKit risk | Operational complexity |
|---|---|---|---|---|
| TypeScript + DOM UI + Canvas2D floor (Vite) | Smallest bundle, native text and forms, accessible, fast load, trivially testable | We build our own small floor renderer | None; plain web standards | Low |
| TypeScript + Phaser for everything | Batteries included | Forms and tables in a canvas are poor; bigger bundle | Low | Medium |
| Godot 4 web export | Full editor, strong 2D | Large download (tens of MB), WebAssembly threads need cross origin isolation, weak text input on iPad Safari | Medium (WebKit and wasm quirks) | Medium |
| Unity WebGL | Mature tooling | Heavy, poor mobile Safari support, proprietary | High | High |

## Decision

TypeScript (strict), Vite for build, DOM for the UI shell, Canvas2D for the restaurant floor. Installable web app (manifest and service worker) for home screen play and offline use. PixiJS is the pre-approved upgrade path for the floor if Canvas2D cannot hold 60 fps (ADR-003).

## Consequences

* Output is static files deployable to any host.
* We own WebKit quirk debt: audio unlock on first tap, `100dvh` and safe area insets, `touch-action` to stop zoom and scroll, storage eviction (see ADR-005). Each is handled once in `src/ui/platform.ts`.
* No game editor; level and room content is data, which suits a builder where the player makes the rooms.
