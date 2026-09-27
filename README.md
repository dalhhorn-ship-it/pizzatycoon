# Pizza D

A cosy restaurant builder for adults, inspired by Pizza Tycoon. Open a pizzeria, craft the menu, choose the quality tier of every ingredient, save up for kitchen equipment, lay out the dining room, hire your team and find your own way to success: luxury, high volume, or somewhere in between. Free, played in the browser on iPad (Safari, Chrome) and desktop, with cloud saves that follow you between devices.

## Status: M0.6

Playable in the browser, with everything below built and tested. What each document covers is in `01-product/README.md`; milestones in `01-product/versions.md`; the cleanup backlog in `cleanup-sprints.md`.

* **Menu:** 13 pizzas, 15 primi, 9 secondi plus antipasti, drinks and desserts; ingredient quality tiers (Basic, Standard, Premium, Artisan) and supplier choice; custom dishes; pricing against a fair price band; menu complexity that loads the prep line
* **The bar:** an Italian wine list, aperitivi and digestivi
* **Kitchen:** a floor plan with stations, flow and a service pipeline; equipment families with add-ons and upgrade paths; bottlenecks (ovens need tending, cooks need wash points, sinks, dough in the fridges) and a capacity view per service
* **Dining room:** build mode with tables, booths, decor, lighting, room touches and fire safety
* **The Squad:** four attributes and an OVR per person, composure under pressure, courses and coaching, a staff market, personalities and mood, each person's value in the day and week reports; restaurant managers run the team by policy
* **City:** Porto Verde with 7 neighbourhoods and 72 rentable venues, moving between venues, more than one restaurant with managers
* **Live market:** rival pizzerias that compete on price, quality or marketing, open, grow into small chains and close; ten marketing campaigns with audiences; a Rivals tab with market share, rival cards and a coach
* **Food delivery:** from 3 stars, three modes, a kitchen shared with the dining room, riders and vehicles, its own delivery rating and Top rated
* **Money:** daily and weekly P&L, starter loan, a safety net (no game over), and a weekly business review of every restaurant over 6 or 12 weeks
* **Saves:** local first with a previous save slot, cloud sync on Cloudflare D1, device linking with a 6 character code, conflict chooser; fonts and code served from the site only

## Project layout

| Path | What |
|---|---|
| `01-product/` | PRD, features, versions, acceptance criteria, balance sheet |
| `02-architecture/` | Solution design, ADRs, infrastructure |
| `.claude/agents/` | Team agent definitions (product, architecture, engineering, QA) |
| `src/data/` | Content and every tunable number (ADR-004) |
| `src/sim/` | Pure, deterministic simulation core (ADR-002) |
| `src/save/` | Save format, local store, cloud sync (ADR-005) |
| `src/game/` | Controller: commands, autosave, sync |
| `src/ui/` | DOM UI and Canvas2D floor view (ADR-003) |
| `worker/` | Cloudflare Worker: static assets and the save API, D1 migrations (ADR-007) |
| `tests/` | Unit tests (`npm test`), save fixtures, and the balance lane in `tests/balance` (`npm run balance`) |

## Develop

```bash
npm install
npm run dev            # game only, saves stay on this device
npm test               # fast unit lane (about 8 s)
npm run balance        # balance lane: strategy table, live market, delivery, performance budget
npm run test:all       # both
```

Full stack locally (game, Worker and a local D1 database):

```bash
npm run db:migrate:local
npm run build && npm run worker:dev   # http://localhost:8787
```

## Deploy (Cloudflare Workers)

The repo is connected to Cloudflare Workers Builds and deploys the `main` branch with `npx wrangler deploy`. That command builds the game first (`build` in `wrangler.jsonc`), creates the D1 save database on the first deploy, and the Worker creates its tables on first use. Nothing needs to be set up by hand. Details in `02-architecture/infrastructure.md`.

Manual deploy: `npx wrangler login`, then `npm run deploy`.
