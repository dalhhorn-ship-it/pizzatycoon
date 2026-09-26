# Pizza D

A cosy restaurant builder for adults, inspired by Pizza Tycoon. Open a pizzeria, craft the menu, choose the quality tier of every ingredient, save up for kitchen equipment, lay out the dining room, hire your team and find your own way to success: luxury, high volume, or somewhere in between. Free, played in the browser on iPad (Safari, Chrome) and desktop, with cloud saves that follow you between devices.

## Status: M0 systems prototype

Playable greybox with the full economy of `01-product/balance.md`:

* Menu with 13 pizzas plus sides, per ingredient quality tiers (Basic, Standard, Premium, Artisan) and supplier choice, custom pizzas, pricing against a fair price band
* Kitchen equipment in volume, quality, artisan and basic families with unlocks, throughput and quality effects
* Dining room build mode (tables, booths, decor, lighting, ambience)
* Staff with skill, potential, traits, morale and salary; hiring board with a measurable impact preview
* Day simulation for lunch and dinner: demand by customer segment, dish choice, kitchen and seat capacity, turnover, satisfaction, reviews, reputation
* Daily and weekly finance, starter loan, safety net (no game over)
* Local first saves, cloud sync on Cloudflare D1, device linking with a 6 character code, conflict chooser

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
| `tests/` | Formula, golden day, game and strategy balance tests |

## Develop

```bash
npm install
npm run dev            # game only, saves stay on this device
npm test               # all tests
npm run balance        # strategy profit table and balance checks
```

Full stack locally (game, Worker and a local D1 database):

```bash
npm run db:migrate:local
npm run build && npm run worker:dev   # http://localhost:8787
```

## Deploy (Cloudflare Workers)

One time setup is in `02-architecture/infrastructure.md` (create the D1 database, put its id in `wrangler.jsonc`). Then:

```bash
npm run db:migrate:remote
npm run deploy
```

CI deploys on every push to `main` once the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are set.
