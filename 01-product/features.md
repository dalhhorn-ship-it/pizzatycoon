# Features: Pizza D

* Companion to `prd.md` (system specs), `versions.md` (milestones), `acceptance-criteria.md` (tests), `balance.md` (numbers).
* Priority: **Must** = required for the launch product (v1.0) or for the milestone listed; **Should** = strongly wanted, cut only under schedule pressure (see prd.md 10.4); **Nice** = only if capacity allows.
* Milestones: **M0** systems prototype, **M0.2** Kitchen Builder (`kitchen-builder.md`), **v0.1** vertical slice, **v1.0** launch, **v2.0** growth. A feature listed at v0.1 with an expansion at v1.0 shows both.
* Loop: **MM** moment to moment, **D** service day, **W** week or season, **LT** long term.

## A. Core, platform and settings

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-01 | Data-driven tuning | Every constant in prd.md section 5 and balance.md lives in designer editable data files; a reference calculator reproduces the balance.md reference builds | all | Must | M0 | none |
| F-02 | Time controls | Pause, 1x, 2x, 4x; configurable auto pause on events (delivery late, stock-out, staff notice, milestone) | MM | Must | v0.1 | F-52 |
| F-03 | Day structure | Auto pause at 09:00 for morning prep; quiet hours fast forward; end of day at 23:30 | D | Must | v0.1 | F-02 |
| F-04 | Local save and resume | Autosave at end of day and on backgrounding; 3 manual slots; exact resume including mid service | all | Must | v0.1 | none |
| F-05 | Return recap card | "Where was I" card: day, yesterday's results, pending deliveries, active savings goal and milestone | D | Must | v0.1 | F-04, F-41, F-57 |
| F-06 | Touch controls | Tap, drag, long press to inspect, pinch zoom, two finger pan; targets at least 44 pt; one finger playable | MM | Must | v0.1 | none |
| F-07 | Apple Pencil support | Precise tile placement, hover preview of placement and tooltips on hover capable models | MM | Should | v1.0 | F-44 |
| F-08 | Keyboard and trackpad | Shortcuts for speed, build mode, undo; pointer hover tooltips | MM | Nice | v1.0 | F-06 |
| F-09 | Settings | Music, ambience and UI volume; Simple vs Detailed numbers; auto pause options; recap frequency | all | Must | v0.1 | none |
| F-10 | Accessibility | 3 text sizes (v0.1), colour blind safe palettes, reduce motion, captions for mentor voice, no information by colour only (v1.0) | all | Must | v0.1 partial, v1.0 full | F-09 |
| F-11 | Opt-in telemetry | Anonymous, opt-in, works offline and uploads later; events needed for metrics M1 to M5 | all | Should | v0.1 | none |
| F-12 | Localisation | FR, DE, IT, ES, JA in addition to EN; currency symbol localised | all | Should | v1.0 | none |

## B. City and property

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-13 | City map and district cards | Districts with foot traffic, segment mix, wealth W, rent per tile, competition, "good for" tags; 3 districts at v0.1, 6 at v1.0 | LT | Must | v0.1 | F-53 |
| F-14 | Lease first restaurant | 3 recommended starter properties with pre-installed basic kitchen, 8 week deposit, projected guests per day for current menu and price | LT | Must | v0.1 | F-13 |
| F-15 | Close or move location | Lease break fee of 4 weeks rent; equipment and furniture resold at 80% or moved to storage | LT | Should | v1.0 | F-14 |
| F-16 | Buy property | Purchase removes rent; resale at 90% | LT | Should | v1.0 | F-14, F-79 |
| F-17 | District trend cards | Weekly card with a temporary segment or traffic change (for example students +20% after holidays) | W | Should | v1.0 | F-13 |
| F-18 | Seasonal district modifiers | season_mult per district and season (0.85 to 1.15) | W | Must | v1.0 | F-96 |

## C. Ingredients, recipes and menu

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-19 | Ingredient catalogue with quality tiers | Basic, Standard, Premium, Artisan per ingredient with quality, price multiplier, shelf life multiplier, supplier availability, taste tags; 25 ingredients at v0.1, 60 at v1.0 | W | Must | v0.1 | F-01 |
| F-20 | Per ingredient tier selection | In each recipe the player picks the tier and supplier of every ingredient; preview shows delta in Q, cost per portion, shelf life, fair price before confirming | W | Must | v0.1 | F-19, F-29 |
| F-21 | Pizza recipe designer | Dough, sauce, cheese, 0 to 6 toppings by drag and drop; live Q with its 4 contributors (IQ, H, K, E), harmony stars | W | Must | v0.1 | F-19, F-20 |
| F-22 | Preset sides, drinks, desserts | Non-pizza items from presets with tier choice per ingredient | W | Must | v0.1 | F-19 |
| F-23 | Pricing panel | Fair price band, margin %, per segment appeal bars (including budget and quality appeal) | D | Must | v0.1 | F-21, F-53 |
| F-24 | Menu board | 4 to 16 items; enable or disable; automatic sold out when stock runs out | D | Must | v0.1 | F-21, F-32 |
| F-25 | Dish performance report | Sales, average satisfaction, profit per dish; flags weak dishes after 3 days | W | Must | v0.1 | F-24, F-55 |
| F-26 | Daily special and seasonal ingredients | One highlighted dish per day; seasonal produce with +5 quality and "seasonal" tag in season | D | Should | v1.0 | F-24, F-96 |
| F-27 | Recipe notebook and unlocks | Mentor's classic recipes unlocked by milestones; novelty effect when adding new dishes | W | Should | v1.0 | F-90 |
| F-28 | Hand drawn menu or sign | Draw restaurant sign or menu art with Apple Pencil | W | Nice | v2.0 | F-07 |

## D. Purchasing and logistics

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-29 | Supplier directory | Price index, tiers carried per product, quality offset, reliability, lead time, minimum order; 3 suppliers at v0.1, 12 at v1.0 | W | Must | v0.1 | F-19 |
| F-30 | Purchase orders and deliveries | Manual orders per stock line; delivery timeline; late or partial deliveries by reliability | D | Must | v0.1 | F-29 |
| F-31 | Storage capacity | Dry shelf 200, fridge 120, freezer 80 units per unit placed; over capacity deliveries refused and refunded | D | Must | v0.1 | F-44 |
| F-32 | Freshness, spoilage and waste log | FIFO use; shelf life by tier; freshness factor; waste logged with cause, tier and money | D | Must | v0.1 | F-30, F-31 |
| F-33 | Stock-outs and emergency order | Dish auto sold out; guests choose alternatives; advisor offers 1 day emergency order at +20% | D | Must | v0.1 | F-24, F-30 |
| F-34 | Standing orders and par levels | Auto top up to par every N days from a chosen supplier and tier | W | Must | v1.0 | F-30 |
| F-35 | Supplier loyalty and expanded roster | 2% discount per 4 consecutive weeks (cap 8%); Casa Artigiana and 8 more suppliers | W | Should | v1.0 | F-29 |
| F-36 | Central purchasing | Chain contract per ingredient, 5% discount at 3 locations, 10% at 6 | LT | Should | v1.0 | F-34, F-83 |
| F-37 | Central commissary | Shared prep kitchen supplying dough to locations | LT | Nice | v2.0 | F-36 |

## E. Kitchen equipment

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-38 | Equipment catalogue with families | Volume, quality and artisan items with price, servings per hour, quality modifier, kitchen footprint, weekly maintenance, unlock stage (prd.md 5.5). v0.1: Deck, Double Deck, Conveyor, Stone Hearth, Wood Fired ovens; Prep Counter, Dough Sheeter, Heat Lamp Pass, Dish Machine, Proving Cabinet, Marble Bench. v1.0 adds Master Dome Oven, Hand Stretch Station, Walk-in Cold Room | W | Must | v0.1 | F-44, F-01 |
| F-39 | Kitchen throughput model and panel | Oven and prep capacity per hour, prep load per cover, kitchen capacity = min of both; panel shows servings per hour per station, bottleneck and last service utilisation | D | Must | v0.1 | F-38, F-52 |
| F-40 | Equipment and skill interaction | Non volume gear speed 0.7 + 0.06 x skill; volume gear 0.9 + 0.02 x skill; artisan items scale quality bonus by skill / required skill below the requirement | W | Must | v0.1 | F-38, F-62 |
| F-41 | Savings goals | Pin any catalogue item; HUD progress, projected date from 7 day average profit; celebration on completion | W | Must | v0.1 | F-75 |
| F-42 | Equipment compare card | "Now vs with this" preview: servings per hour, Q per menu dish, weekly cost; warns if the item does not address the current bottleneck | W | Must | v0.1 | F-39 |
| F-43 | Hybrid equipment | Twin Chamber Combi Oven and Pro Prep Line (volume and quality, expensive, late unlock) | LT | Should | v1.0 | F-38 |

## F. Dining room builder

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-44 | Grid build mode | Place, rotate, move, sell at 80%, undo 20 steps, ghost preview; time paused in build mode; dining and kitchen grids | W | Must | v0.1 | F-06 |
| F-45 | Furniture and decor catalogue | Tables (2, 4, 6, booth), chairs, host stand, decor, plants, lights, floors, walls; 40 items v0.1, about 150 v1.0 | W | Must | v0.1 | F-44 |
| F-46 | Ambience score | Formula in prd.md 5.6 with a breakdown panel and crowding penalty | W | Must | v0.1 | F-45 |
| F-47 | Flow validation and overlays | Opening requirements check; unreachable tables blocked; reachability, congestion heat map and ambience overlays | W | Must | v0.1 | F-44, F-52 |
| F-48 | Style sets | Rustic, Modern, Retro items give up to +15 ambience when coherent | W | Should | v1.0 | F-46 |
| F-49 | Layout blueprints | Save a layout and apply it to another location of equal or larger size | LT | Should | v1.0 | F-44, F-83 |
| F-50 | Staff room | +1 morale per day for staff of that location | W | Should | v1.0 | F-64 |
| F-51 | Seasonal terrace | Outdoor seats in spring and summer | W | Nice | v2.0 | F-96 |

## G. Guests, service and turnover

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-52 | Guest agent simulation | Parties arrive, queue, seat, order, wait for kitchen, eat, pay, leave or walk away; greybox at M0, full art at v0.1 | MM | Must | M0 greybox, v0.1 | F-53 |
| F-53 | Demand model | All multipliers in prd.md 5.7 including budget, quality and speed appeal and district wealth | D | Must | M0 | F-01 |
| F-54 | Opening hours | Lunch and dinner services on or off per weekday | D | Must | v0.1 | F-52 |
| F-55 | Satisfaction model and inspect | Per guest satisfaction with its 5 sub-scores shown on tap | MM | Must | v0.1 | F-52 |
| F-56 | Reviews feed | 20% of parties review; stars and template text keyed to highest and lowest sub-score | D | Must | v0.1 | F-55 |
| F-57 | End of day summary | Covers, revenue, profit, satisfaction, walk-aways, the single biggest bottleneck, top 3 and worst review, waste, one tip | D | Must | v0.1 | F-55, F-75, F-39 |
| F-58 | Service analytics | Average wait, turns per table, seat and kitchen utilisation, walk-aways by segment, 28 day history | D | Must | v0.1 | F-52 |
| F-59 | Live interventions | Comp a dessert (+15 satisfaction for that party); open or close tables; server sections | MM | Should | v1.0 | F-52 |
| F-60 | Reservations and group events | Booked parties and birthdays | D | Nice | v2.0 | F-52 |
| F-61 | Takeaway counter | Orders without seats, uses kitchen capacity | D | Nice | v2.0 | F-39 |

## H. Staff

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-62 | Hiring board | 6 candidates per week for chef, cook, server, host, dishwasher with skill, salary, fame, visible trait; interview reveals the hidden trait | W | Must | v0.1 | F-01 |
| F-63 | Staff impact card | Measurable delta vs current rota: dish quality, cook or service time, satisfaction, weekly cost | W | Must | v0.1 | F-62, F-39 |
| F-64 | Morale and automatic rota | Morale drift rules; default 5 shifts per week rota generated automatically | W | Must | v0.1 | F-62 |
| F-65 | Traits | 8 traits at v0.1, 25 at v1.0, each with one numeric effect | W | Must | v0.1 | F-62 |
| F-66 | Growth, training, raises, promotion | +1 skill per 40 shifts up to potential; training $600 and 3 days; raises; cook to chef, chef or server to manager | W | Should | v1.0 | F-62 |
| F-67 | Shift schedule editor | Manual assignment of staff to lunch and dinner per day | W | Should | v1.0 | F-64 |
| F-68 | Notice period | Staff under 30 morale for 7 days give 7 days notice that can be reversed | W | Should | v1.0 | F-64 |
| F-69 | Restaurant manager and policies | Manager runs a location by policy: strategy (luxury, middle, volume), price band, tier floor, stock, hiring and equipment budgets, local menu slots; weekly report with one proposal | LT | Must | v1.0 | F-62, F-34 |
| F-70 | Area manager | Oversees up to 4 locations, their managers act at skill + 1, hires managers | LT | Should | v2.0 | F-69 |

## I. Reputation and marketing

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-71 | Location reputation | Rep 0 to 100, stars = Rep / 20, daily update rule, 28 day graph with drivers | W | Must | v0.1 | F-56 |
| F-72 | Brand reputation | Revenue weighted chain Rep; new locations start at 40 when brand Rep is 60+ | LT | Must | v1.0 | F-71, F-83 |
| F-73 | Critic visits | Rumoured a day ahead; review weight 5 | W | Should | v1.0 | F-71 |
| F-74 | Marketing | Flyers, local ad, tasting evening: temporary capture boost for a cost | W | Should | v1.0 | F-53 |

## J. Finance

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-75 | Daily and weekly P&L | Simple view with one plain sentence; Detailed view with per dish and per category lines; lines as in prd.md 5.11 | D | Must | v0.1 | F-52 |
| F-76 | Starter loan | Up to $30,000 at 5% per year over 104 weeks | LT | Must | v0.1 | F-75 |
| F-77 | Safety net | No bankruptcy; restructure offer after 7 days below $0; sell, close or fresh start below -$20,000 | LT | Must | v0.1 | F-75 |
| F-78 | Advisor tips | Data driven tip at most once per day; bottleneck and cost warnings | D | Should | v0.1 | F-39, F-75 |
| F-79 | Expansion loans | Unlock at Rep 50; 12 x average weekly profit, cap $150,000, 6%, 3 years | LT | Must | v1.0 | F-76 |
| F-80 | Chain P&L and comparison | Per location and chain totals; comparison table sortable by profit, Rep, covers | LT | Must | v1.0 | F-75, F-83 |

## K. Strategy

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-81 | Strategy balance test suite | Automated tests on the reference builds in balance.md: luxury and volume reach comparable profit in their home districts; neither strictly dominates; middle ground never dominant; rerun on every tuning change | all | Must | M0, maintained each milestone | F-01, F-53, F-39 |
| F-82 | Strategy readout | Location card shows a derived position (luxury, middle, volume) from price, tiers and equipment, and a district fit hint ("Old Harbour guests would pay more for quality") | LT | Should | v1.0 | F-13, F-23 |

## L. Chain

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-83 | Open additional locations | Up to 6 in city 1; requires Rep 50 at an existing location | LT | Must | v1.0 | F-14, F-79 |
| F-84 | Chain map and switcher | Location cards with stars, strategy, weekly profit, manager | LT | Must | v1.0 | F-83 |
| F-85 | Off-screen simulation and caretaker mode | Aggregate daily simulation for locations not on screen; caretaker mode at -20% profit without a manager | LT | Must | v1.0 | F-53, F-69 |
| F-86 | Chain vs local menu | Chain dishes share recipe, tiers and price band; 4 local slots per location | LT | Must | v1.0 | F-24, F-83 |
| F-87 | Cannibalisation | +0.2 effective competition per other own location in the district | LT | Must | v1.0 | F-83 |
| F-88 | Second city | New city with its own districts and suppliers | LT | Should | v2.0 | F-83 |
| F-89 | Franchising | License the brand for a fee and royalty | LT | Nice | v2.0 | F-72 |

## M. Progression and modes

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-90 | Milestones, ranks and unlocks | Career ranks Cook to Pizza Icon; unlocks of equipment, tiers, suppliers, districts, loans by milestone or Rep (ranks 1 to 3 at v0.1) | W | Must | v0.1 | F-71 |
| F-91 | Guided first week | 7 day mentor tutorial, one system per day, skippable, Mentor's notebook | D | Must | v0.1 | most v0.1 features |
| F-92 | Sandbox mode | Choose starting cash, unlocks and districts | LT | Should | v1.0 | F-90 |
| F-93 | Friendly rival and festival | Nonna Bianca's chain and seasonal Pizza Festival; toggle in settings | LT | Nice | v2.0 | F-83 |
| F-94 | Scenarios | Challenge maps with goals (for example "Revive the harbour trattoria") | LT | Nice | v2.0 | F-90 |

## N. Presentation

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-95 | Day and night lighting | Continuous lighting cycle, lamps at dinner | MM | Must | v0.1 | none |
| F-96 | Seasons | Visual dressing, demand modifiers, seasonal ingredients | W | Must | v1.0 | F-18, F-26 |
| F-97 | Audio | Adaptive music by time of day; ambience scaling with occupancy; per equipment kitchen sounds; soft UI sounds; no alarms | MM | Must | v0.1 | none |
| F-98 | Tactile feedback | Placement snap, flour puff on recipe save, cash chime, savings goal celebration, amber (not red) warnings | MM | Must | v0.1 | F-44 |
| F-99 | Photo mode | Hide UI, frame and save a picture of the restaurant | MM | Nice | v2.0 | none |

## O. Kitchen Builder (spec: `kitchen-builder.md`)

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-100 | Kitchen floor plan grid and validity | Tile grid per premises (cosy 10x3, trattoria 12x3, big hall 15x4) with a 2 tile pass on the dining side and a decorative back door; items have w x h footprints, position and 90 degree rotation; validity: inside, no overlap, pass kept for the Heat Lamp Pass only, every item and the pass touch a free floor tile, opening minimum (oven, prep station, cold store, Sink), sheeters work only when touching a prep station; replaces the "kitchenTiles minus 4" footprint cap | W | Must | M0.2 | F-38, F-44 |
| F-101 | Kitchen builder interaction | Kitchen tab switches the stage to the floor plan; tap a tile to buy there, tap a station for Move, Rotate, Sell (80%) and Replace; drag with ghost and snap; moves are free; time paused; undo within the visit | W | Must | M0.2 | F-100, F-06 |
| F-102 | Kitchen flow model | Reach: -4% prep per tile beyond 2 from a prep station to its nearest oven (cap -20%); plate walk: +0.2 min cook time per tile beyond 3 from oven to pass (cap +2 min); wash walk: -3% plates per hour per tile beyond 4 from pass to the nearest Sink or Dish Machine (cap -15%); cold at hand: +5% prep for a counter touching a cold store; all constants in data | D | Must | M0.2 | F-100, F-39 |
| F-103 | New kitchen equipment | Pizza Prep Fridge with Marble Top ($3,200, 2x1, x1.15 prep, +1 quality, cold store, $25 per week, serve 200 guests); Dough Fridge ($900, 1x1, cold store, start); Sink ($600, 1x1, wash station, start); w x h added to all existing items | W | Must | M0.2 | F-38, F-100 |
| F-104 | Service pipeline panel | Four stages (Dough and prep, Oven, Pass and serve, Dishwashing) in covers per hour for lunch and dinner, last service demand marker, bottleneck outlined amber with a one line suggestion, tap a stage to highlight its stations | D | Must | M0.2 | F-102, F-39 |
| F-105 | Fit filtered catalogue and impact preview | Tapping an empty tile lists only items that fit there, grouped by station; each row shows price, maintenance and the compare() preview of profit per day, covers, pizza Q and the stage it raises, with the "not the bottleneck" warning; optional "Pin as savings goal" when F-41 exists | W | Must | M0.2 | F-101, F-42 |
| F-106 | Save migration and auto layout | Schema bump; older saves get a deterministic greedy auto layout plus a free Dough Fridge and Sink if missing; items that cannot fit are refunded at full price with a note; the balance calculator uses the same auto layout | all | Must | M0.2 | F-100, F-04, F-81 |
| F-107 | Tidy up | Button that previews the auto layout as a ghost with before and after flow badges; apply for free, undoable | W | Should | M0.2 | F-106 |
| F-108 | Flow lines and badges | While dragging, dotted lines from each prep station to its nearest oven and from each oven to the pass labelled with tile counts, green within the free distance and amber beyond; per station badges (tick, "-8% walk", snowflake for cold at hand) | MM | Should | M0.2 | F-102, F-101 |
| F-109 | Phone layout for the kitchen | Plan at 44 pt tiles with horizontal scroll, bottom sheet instead of side sheet, pipeline collapsed to four chips | W | Should | M0.2 | F-101, F-104 |

## Dependency map (critical path)

```
F-01 Data tuning
  -> F-53 Demand model -> F-52 Guest simulation -> F-55 Satisfaction -> F-56 Reviews -> F-71 Reputation
  -> F-19 Ingredient tiers -> F-20 Tier selection -> F-21 Recipe designer -> F-23 Pricing -> F-24 Menu
  -> F-29 Suppliers -> F-30 Orders -> F-32 Spoilage -> F-33 Stock-outs
  -> F-44 Build mode -> F-38 Equipment -> F-39 Kitchen throughput -> F-40 Skill interaction -> F-42 Compare card
                     -> F-45 Furniture -> F-46 Ambience -> F-47 Flow
  -> F-62 Hiring -> F-63 Impact card
F-81 Strategy balance tests need F-53, F-39, F-19
F-75 P&L -> F-41 Savings goals, F-76 Starter loan, F-77 Safety net
v1.0 chain: F-79 Expansion loan + F-69 Manager -> F-83 New locations -> F-85 Off-screen sim, F-86 Chain menu, F-36 Central purchasing, F-72 Brand Rep
```

## Scope note

109 features is already a lot for a small team. The cut order in prd.md 10.4 applies. Features that carry the two strategies (F-19, F-20, F-38, F-39, F-40, F-53, F-81) are pillars and are not cut.
