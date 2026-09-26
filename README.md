# Pizza D

A cosy restaurant builder for adults, inspired by Pizza Tycoon. Open a pizzeria, craft the menu, choose the quality tier of every ingredient, save up for kitchen equipment, lay out the dining room, hire your team and find your own way to success: luxury, high volume, or somewhere in between. Free, played in the browser on iPad (Safari, Chrome) and desktop, with cloud saves that follow you between devices.

## Status: M0 systems prototype

Playable greybox with the full economy of `01-product/balance.md`:

* Menu with 13 pizzas, 15 primi piatti, 9 secondi plus antipasti, drinks and desserts; per ingredient quality tiers (Basic, Standard, Premium, Artisan) and supplier choice, custom pizzas, primi and secondi, pricing against a fair price band
* Local following: a new restaurant starts unknown and earns its regulars through word of mouth from satisfied guests; small shopfronts are seen by fewer passers-by
* More than one restaurant: hire a restaurant manager, open another venue, and the manager runs the first one according to their skill
* Fast forward a week, stopping early when something needs you
* Menu complexity: a wide or fancy menu slows the prep line and lengthens ticket times unless the cooks are skilled; primi and secondi spare the oven but load the prep line
* Kitchen equipment in volume, quality, artisan and basic families with unlocks, throughput and quality effects
* Dining room build mode (tables, booths, decor, lighting, ambience)
* Staff with skill, potential, traits, morale and salary; hiring board with a measurable impact preview
* Day simulation for lunch and dinner: demand by customer segment, dish choice, kitchen and seat capacity, turnover, satisfaction, reviews, reputation
* Daily and weekly finance, starter loan, safety net (no game over)
* City map of Porto Verde: 7 neighbourhoods and 24 rentable venues with demographic cards, foot traffic, rent and floor area in m², plus moving between venues (`01-product/city-map.md`)
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

The repo is connected to Cloudflare Workers Builds and deploys the `main` branch with `npx wrangler deploy`. That command builds the game first (`build` in `wrangler.jsonc`), creates the D1 save database on the first deploy, and the Worker creates its tables on first use. Nothing needs to be set up by hand. Details in `02-architecture/infrastructure.md`.

Manual deploy: `npx wrangler login`, then `npm run deploy`.
