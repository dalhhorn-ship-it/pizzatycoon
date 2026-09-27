# Solution design: Pizza D

* Status: Draft 2, as built at M0.6 (sections 4, 5, 6, 8, 9 and 13 updated; the M0 plan in 12 is history)
* Inputs: everything in `01-product/` (PRD with founder decisions of 2026-09-26)
* Companion files: `adrs/`, `infrastructure.md`

## 1. Constraints that drive the design

| Requirement | Source | Consequence |
|---|---|---|
| Browser only, iPad Safari and Chrome plus desktop, no native app | Founder decision | Web stack; WebKit is the real target platform |
| Free, no ads, no IAP, no tracking | Founder decision, PRD 10.1 | No third party SDKs; backend cost must stay near zero |
| Cloud saves across iPad and desktop, fully playable offline | Founder decision, A3, A4 | Local first saves with background sync; a small backend |
| Deep, legible economy that is tuned from data | PRD 5, 6, F-01, `balance.md` | Pure simulation core, all numbers in data files, balance tests in CI |
| Chain of up to 6 locations, most of them off screen | PRD 5.12 | Aggregate day model as the source of economic truth |
| 60 fps with 120 seated guests on an older iPad | M0 DoD, M13 | Game logic never runs per frame; the view animates results |
| Cosy, short sessions, exact resume | A9, A4 | Autosave on day end and on `visibilitychange` |

## 2. Challenge first

* **"Simulate every guest as an agent" is the known failure mode of tycoon games.** It makes the economy hard to test, slow on older iPads and impossible to run for six off screen locations. We keep one **aggregate day model** (the formulas in `balance.md`) as the only authority on money, covers and reputation, and let the view generate a guest animation that is consistent with those numbers. This removes a whole class of "agent sim and calculator disagree" bugs (AC-72 becomes true by construction).
* **A game engine is not needed for M0 to v0.1.** Most screens are forms, tables and cards (menu, purchasing, staff, P&L), which the DOM does better than any canvas engine. Only the restaurant floor needs a canvas. We start with Canvas2D and move the floor to PixiJS only if sprite counts demand it.
* **A backend is a cost and a liability for a free game.** Cloud save is the only server feature. It is a single table of versioned save blobs behind an interface, so the provider can be swapped or self hosted.

## 3. Architecture overview

```mermaid
flowchart LR
  subgraph Browser["Browser (iPad Safari / Chrome / desktop)"]
    UI["UI shell (DOM, TypeScript)\nscreens: city, menu, kitchen, room, staff, finance"]
    Floor["Floor view (Canvas2D, later PixiJS)\ngrid, tables, guest animation"]
    Store["Game controller\ncommands in, state + events out"]
    Sim["Simulation core (pure TypeScript)\nformulas, day model, finance, reputation"]
    Data["Content and balance data\n(typed data modules)"]
    Save["Save port\nserialize, migrate, checksum"]
    Local["Local adapter\nIndexedDB / localStorage"]
    SW["Service worker\noffline cache"]
  end
  Cloud["Cloudflare Worker /api\nD1 (SQLite) saves"]
  UI --> Store
  Floor --> Store
  Store --> Sim
  Sim --> Data
  Store --> Save
  Save --> Local
  Save -. online .-> Cloud
```

**Rule:** `src/sim` imports nothing from the DOM, the UI, the save layer or any npm package. It is plain TypeScript that runs in Node for tests and in the browser for play. This is enforced by a lint rule on import paths (ADR-002).

## 4. Components

| Component | Folder | Responsibility | Talks to |
|---|---|---|---|
| Simulation core | `src/sim/` | Game state types, formulas, day model, finance, reputation, staff, rivals, marketing, delivery, weekly KPIs, commands, seeded RNG (see 13) | Data only |
| Content and balance data | `src/data/` | Districts, segments, ingredients, tiers, suppliers, recipes, equipment, furniture, staff roles, traits, all tunables | Nothing |
| Game controller | `src/game/` | Holds current state, applies commands, emits events, triggers autosave | Sim, save |
| Save layer | `src/save/` | Serialize, version, migrate, checksum; local and cloud adapters; sync | Controller, browser storage, cloud |
| UI shell | `src/ui/` | Screens, panels, HUD; reads state, dispatches commands | Controller |
| Floor view | `src/ui/floor.ts`, `src/ui/kitchenView.ts`, `src/ui/sprites.ts` | Grid rendering, build mode placement, guest animation from day results | Controller |
| Balance harness | `tests/balance/` | Reference builds and strategy checks from `balance.md` section 3 | Sim, data |

## 5. Simulation core

### 5.1 Commands in, events out

The core is a reducer: `apply(state, command) -> { state, events }`. State is a plain JSON serialisable object; commands are plain objects; the core never mutates its input.

The full list of commands (54 at M0.6) is the `Command` union in `src/sim/commands.ts`; `apply` in `src/sim/game.ts` routes them, with the day loop in `settle.ts` and the live market commands in `marketCommands.ts`. By area:

| Area | Commands (examples) |
|---|---|
| Menu | `setTier`, `setSupplier`, `setPrice`, `toggleMenu`, custom dishes |
| Kitchen and room | `buyEquipment`, `sellEquipment`, add-ons and upgrade paths, `placeFurniture`, `moveFurniture`, fire safety, room touches |
| Squad | `hire`, `fire`, raises, courses, coaching, rota, staff policy, agency |
| City and chain | `rentVenue`, `openRestaurant`, `switchRestaurant`, `holdVenue` |
| Market | `startCampaign`, `stopCampaign`, `mysteryDiner`, `startDelivery`, `setDelivery`, `stopDelivery`, `buyVehicle`, `sellVehicle` |
| Money and settings | `takeLoan`, `repayLoan`, `setEconomy`, `freshStart` |
| Time | `runDay`, `runWeek` (fast forward, stops when something needs the player) |

| Event kind | Used by |
|---|---|
| `dayCompleted { report }`, `weekCompleted { reports, stoppedBecause }` | Day and week reports, floor playback |
| `unlocked`, `rankUp` | Unlocks and ranks |
| `restructure` | Safety net (loan pause) |
| `staffNotice`, `staffLeft`, `staffOffer`, `staffReview` | The Squad; they also stop fast forward |
| `market` | A rival's move within reach |
| `info` | Everything else worth a line |

### 5.2 Day model (hybrid simulation)

1. **Aggregate pass (authoritative).** For each segment and each service (lunch, dinner) compute demand with the `balance.md` 1.4 formulas, dish choice by logit, kitchen and seat capacity, utilisation, queue delay, served covers and walk aways, satisfaction, reviews and money. Random elements (party sizes, delivery failures, which parties review, review texts) come from a seeded PRNG stored in state, so a day is exactly reproducible.
2. **Presentation pass (view only).** The floor view turns the day report into a stream of parties (arrival times, table, dish, mood) using a PRNG seeded from the day. It never feeds back into money or reputation.
3. **Off screen locations** (v1.0 chain) run the aggregate pass only, with the manager or caretaker modifiers.

Cost of this choice: interventions during service (comping a dessert, closing a table mid service) must be modelled as modifiers on the next aggregate pass or as small adjustments to the current report. The PRD's interventions are few and fit this.

### 5.3 Time

* The day is resolved in one step (`runDay`). The UI plays it back at the chosen speed (1x, 2x, 4x, pause) using `real_seconds_per_game_minute`. Pausing or skipping the playback never changes the outcome.
* Weekly events (salaries, rent, loan payment, hiring board refresh) happen on Sunday night inside `runDay`.

### 5.3a Speed (M0.6)

* `apply` copies the state with `cloneState`: stored day reports and KPI rows are shared (they never change once stored), everything else is a plain data deep copy.
* A day runs the two pass day model (`dayRun`: a neutral pass measures load, then the day with staff pressure), each staff member's counterfactual in one pass (for the day report), the guests lost to rivals (one pass without live rivals), the managed restaurants and the rivals.
* Measured in Node on the two restaurant fixture with Normal rivals: about 7 ms a day (13.9 ms before M0.6). The rivals cost 1.03 to 1.07 times the day without them (AC-272, `tests/balance/perf.test.ts`). Not yet measured on an iPad.

### 5.4 Determinism

* PRNG: mulberry32 with the seed in state; each subsystem derives its own stream from `(seed, day, subsystem)` so adding a new random call in one system does not shift another.
* No `Date.now()`, `Math.random()` or floating time inside `src/sim` (lint rule).

## 6. Data model (key entities)

> **As built (M0.6):** the diagram below is the first design. Inventory lines and purchase orders were not built (ingredients are bought just in time). Staff have four attributes, an OVR and personalities (`staff-management.md`). The state also holds rivals, market news, campaigns, delivery, managed restaurants (`branches`) and weekly KPI rows; `KEY_SCOPE` in `src/sim/state.ts` says for every field whether it is shared, per restaurant or transient. The types in `src/sim/state.ts` are the reference.

```mermaid
erDiagram
  GAME ||--|| CHAIN : has
  CHAIN ||--|{ LOCATION : owns
  LOCATION }|--|| DISTRICT : "is in"
  LOCATION ||--|{ PLACED_FURNITURE : has
  LOCATION ||--|{ EQUIPMENT : has
  LOCATION ||--|{ STAFF : employs
  LOCATION ||--|{ MENU_ITEM : sells
  MENU_ITEM }|--|| RECIPE : uses
  RECIPE ||--|{ RECIPE_LINE : has
  RECIPE_LINE }|--|| INGREDIENT : uses
  RECIPE_LINE }|--|| SUPPLIER : "bought from"
  LOCATION ||--|{ INVENTORY_LINE : stocks
  LOCATION ||--|{ PURCHASE_ORDER : places
  LOCATION ||--|{ DAY_REPORT : produces
  DAY_REPORT ||--|{ REVIEW : includes
  CHAIN ||--|| LEDGER : keeps
```

| Entity | Key fields |
|---|---|
| District (data) | id, footTraffic, segment shares, wealth, competition, rentPerTile, lunchShare |
| Segment (data) | id, elasticity, budget, qualityAppeal, qualityWeight, waitTolerance, mealLength, partySize, likedTags, speedAppealAtLunch |
| Ingredient (data) | id, category, tags, baseCost per portion, shelfLifeDays, storage type, tiers available |
| QualityTier (data) | id (basic, standard, premium, artisan), quality, priceMult, shelfLifeMult |
| Supplier (data) | id, priceIndex, qualityOffset, reliability, leadDays, minOrder, tiers carried per category |
| Recipe (state) | id, name, kind (pizza, starter, drink, dessert), lines (ingredientId, tier, supplierId, portion), tags, price, onMenu |
| Equipment (data + state) | itemId, family, price, slots, bakeMult, prepMult, qualityMod, skillNeeded, footprint, maintenance, unlock; state holds uid |
| Furniture (data + state) | itemId, kind (table, decor), seats, decorPoints, footprint, price; state holds uid, x, y |
| Staff (state) | id, name, role, skill, potential, fame, traits, morale, salary, shiftsWorked |
| InventoryLine, PurchaseOrder (state, v0.1) | ingredientId, tier, supplierId, qty, expiryDay; order lines, due day, status |
| DayReport (state) | day, per segment demand and served, covers, walk aways, bottleneck, satisfaction breakdown, reviews, P&L lines, cash flow |
| Ledger (state) | cash, loan balance, weekly accruals, history of daily P&L |

## 7. Content and balance as data

* All numbers in `balance.md` live in `src/data/*.ts` as typed constant objects (`as const satisfies Schema`). TypeScript checks shape at build time; a data validation test checks ranges against the "safe range" column.
* Designers change a number in one file; the balance harness in CI shows the effect on the reference builds. A diff in `src/data` is a balance change and is reviewed as such.
* Why TypeScript modules rather than JSON: type checking and comments for free, no runtime schema library. If non engineers need a spreadsheet later, a small script can export and import CSV (ADR-004).

## 8. Saves and cloud sync

* Save = `{ schemaVersion, savedAt, summary, state }` as JSON (schema 7 since M0.6). Revision and base revision for sync live in the sync metadata, not in the save. There is no checksum yet.
* **Local first:** autosave after every `runDay` and on `visibilitychange` to hidden (iPad Safari may kill a background tab without warning). It uses `localStorage` with a previous save slot as fallback, and shows "Not saved on this device" when the browser refuses a write. Day reports older than 7 days keep only their totals, so a two restaurant save stays around 200 KB. IndexedDB is still planned.
* **Migrations:** an ordered list `migrations[n]: (stateVn) => stateVn+1`. Real saves written by schema 5 and schema 6 builds are kept in `tests/fixtures/` and tested: the schema 6 save plays its next week exactly as the old code did.
* **Cloud:** the same Cloudflare Worker that serves the game exposes `/api/*` backed by D1. Anonymous player id plus secret token; a 6 character link code adds a second device. One table `saves(player_id, slot, revision, updated_at, blob)`. Sync on load, after autosave when online, and on focus (ADR-005, ADR-007).
* **Conflicts:** each save carries a `revision` and the `baseRevision` it was derived from. If the cloud revision moved on since the local base, the game shows both saves (day, cash, stars, device, time) and lets the player pick. No silent overwrites of progress.
* D1 is SQLite and the API is four plain HTTP routes, so the exit path is the same schema on any server (ADR-005).

## 9. Non functional targets

| Area | Target |
|---|---|
| Frame rate | 60 fps at 1x with 120 seated guests on the minimum iPad (candidate: iPad 9th gen, A13); 30 fps floor at 4x |
| `runDay` cost | under 5 ms per location on the minimum iPad; a 6 location chain day under 30 ms. Measured: about 7 ms in Node for two restaurants with rivals (5.3a) |
| Load | first load under 2 MB gzipped before art; playable offline after first visit |
| Memory | under 300 MB on iPad Safari |
| Battery | render loop stops when nothing animates or the tab is hidden |
| Privacy | no third party scripts or fonts; strict CSP; only the cloud save endpoint is contacted |
| Accessibility | 44 px touch targets, text size setting, colour blind safe palette, no hover only interactions |

## 10. Failure modes

| Component | Failure | Impact | Mitigation |
|---|---|---|---|
| Browser storage | Safari evicts site data after weeks without use (ITP) or in low storage | Local save lost | Cloud save; ask for persistent storage (`navigator.storage.persist`); installed home screen apps are exempt from the 7 day rule |
| Tab lifecycle | iPad kills a hidden tab | Lost progress since last save | Autosave on `visibilitychange`; days are atomic |
| Cloud Worker or D1 | Down or offline | No sync | Game keeps working locally, sync retries with backoff, badge shows "not synced" |
| Sync | Two devices played offline | Diverging saves | Revision check and explicit player choice |
| Service worker | Stale cached build | Old code with new save | Versioned cache, update prompt at day end, saves carry `schemaVersion` and refuse to load in older code |
| Save migration | Bug in a migration | Corrupt game | Fixture tests for schema 5 and 6; previous save slot; checksum still to do |
| Simulation | Formula change breaks balance | One strategy dominates | Balance harness in CI fails the build |
| Rendering | Too many sprites on old iPad | Stutter | Floor view caps animated guests and batches drawing; PixiJS path (ADR-003) |

## 11. PRD items that are risky or under specified

| Item | Risk | Question that resolves it |
|---|---|---|
| Taste match (5.7) | Used in menu fit, choice and satisfaction but not defined | Proposed and implemented: `taste_match = min(1, 0.1 + 0.45 x liked tags on the dish)`; reproduces the worked example covers within 1%. Game design to confirm. |
| Fair price for sides | The pizza formula makes a $3.50 soft drink look far below fair | Implemented: sides use `1.5 + 0.04 x Q + 1.5 x food cost`. Game design to confirm. |
| Agent sim must match calculator within 10% (AC-72) | Two models drift | Resolved by design: the aggregate model is the only authority (section 5.2) |
| Apple Pencil hover (F-07, AC-20) | Browser support is partial | Keep as progressive enhancement via Pointer Events `pointerType = pen`; drop hover requirement |
| Offline plus cloud saves | Conflicts | Explicit conflict chooser (section 8) |
| Performance on the oldest iPad (Q6) | Unknown floor | M0 performance spike with the floor view |
| Purchasing with lead times in M0 | Adds UI before the maths is proven | M0 buys ingredients just in time at the chosen tier and supplier, with tier waste rates; orders, storage and spoilage arrive in v0.1 |

## 12. M0 technical plan (build order)

1. Repo scaffold: Vite, TypeScript strict, Vitest, ESLint, GitHub Actions CI (typecheck, lint, test, build).
2. `src/data`: districts, segments, tiers, suppliers, ingredients, recipes, equipment, furniture, staff roles and traits from `balance.md`.
3. Formulas (now in `day.ts`, `analysis.ts` and the shared `formulas.ts`): quality, fair price, demand, choice, capacity, service time, queue delay, satisfaction, reviews, reputation. Unit tests per formula against the worked numbers in `balance.md` 2.2 to 2.5.
4. `src/sim/day.ts`: the aggregate day model and P&L. Golden test: starter restaurant day (`balance.md` 2) within tolerance.
5. Balance harness: the three reference builds in three districts (`balance.md` 3) and the checks in 3.5.
6. Commands and state: new game, menu, tiers, prices, equipment, furniture, staff, loans, run day, weekly settlement, safety net.
7. Save layer: serialize, version, local adapter, autosave.
8. Greybox UI: HUD, menu and recipe card with tier selectors, kitchen catalogue, dining room grid with build mode, staff board, day report with P&L and reviews, floor playback.
9. Cloudflare Worker with static assets and the D1 save API; cloud sync and device linking in the client.
10. Deploy; performance check on an iPad.

v0.1 then adds: purchasing, storage and spoilage; IndexedDB; PixiJS floor if needed; art, audio, tutorial.

## 13. As built: the live market, delivery and managed restaurants (M0.4 to M0.6)

| Module | Role |
|---|---|
| `src/sim/rivals.ts` | Rival pizzerias: profiles, attractiveness, pressure on the player, their own day and week, openings, viewings, closings, entrants. Runs after the player's day (`runRivalsDay`). |
| `src/sim/marketing.ts` | Campaign costs, audiences, fatigue, renewals and the demand multipliers. |
| `src/sim/market.ts` | Read only analytics for the UI: shares, guests lost, rival cards, the coach. |
| `src/sim/delivery.ts` | Delivery demand, riders, delivery time, rating (DRep) and the pure `settleDelivery`. The day model calls it inside the capacity loop. |
| `src/sim/chain.ts` | Managed restaurants: `runBranchDay` runs the same day model on a merged view (`{ ...state, ...branch }`) and copies the per restaurant fields back. `LOCATION_KEYS` and `KEY_SCOPE` keep the two in step; a test fails when a field is not classified. |
| `src/sim/team.ts` | The Squad's day: growth, mood, contributions, managers, the market. |
| `src/sim/kpi.ts` | Weekly KPI rows per restaurant and the business review. |
| `src/sim/forecast.ts` | What the UI uses for previews: the real two pass day without noise. |
| `src/sim/formulas.ts` | Small shared formulas with no sim imports. `tests/imports.test.ts` fails on any runtime import cycle in `src/sim` and `src/data`. |
