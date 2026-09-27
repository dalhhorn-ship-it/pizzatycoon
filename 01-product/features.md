# Features: Pizza D

* Companion to `prd.md` (system specs), `versions.md` (milestones), `acceptance-criteria.md` (tests), `balance.md` (numbers).
* Priority: **Must** = required for the launch product (v1.0) or for the milestone listed; **Should** = strongly wanted, cut only under schedule pressure (see prd.md 10.4); **Nice** = only if capacity allows.
* Milestones: **M0** systems prototype, **M0.2** Kitchen Builder and Fresh Start (`kitchen-builder.md`, `fresh-start.md`), **M0.3** Kitchen upgrades (`kitchen-upgrades.md`), **M0.4** Staff management (`staff-management.md`), **M0.5** Competition, marketing and delivery (`competition.md`), **v0.1** vertical slice, **v1.0** launch, **v2.0** growth. A feature listed at v0.1 with an expansion at v1.0 shows both.
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
| F-100 | Kitchen floor plan grid and validity | Tile grid per premises (hole in the wall 8x3, cosy 10x3, trattoria 12x3, big hall 15x4) with a 2 tile pass on the dining side and a decorative back door; items have w x h footprints, position and 90 degree rotation; validity: inside, no overlap, pass kept for the Heat Lamp Pass only, every item and the pass touch a free floor tile, opening minimum (oven, prep station, cold store, Sink), sheeters work only when touching a prep station; replaces the "kitchenTiles minus 4" footprint cap | W | Must | M0.2 | F-38, F-44 |
| F-101 | Kitchen builder interaction | Kitchen tab switches the stage to the floor plan; tap a tile to buy there, tap a station for Move, Rotate, Sell (80%) and Replace; drag with ghost and snap; moves are free; time paused; undo within the visit | W | Must | M0.2 | F-100, F-06 |
| F-102 | Kitchen flow model | Reach: -4% prep per tile beyond 2 from a prep station to its nearest oven (cap -20%); plate walk: +0.2 min cook time per tile beyond 3 from oven to pass (cap +2 min); wash walk: -3% plates per hour per tile beyond 4 from pass to the nearest Sink or Dish Machine (cap -15%); cold at hand: +5% prep for a counter touching a cold store; all constants in data | D | Must | M0.2 | F-100, F-39 |
| F-103 | New kitchen equipment | Pizza Prep Fridge with Marble Top ($3,200, 2x1, x1.15 prep, +1 quality, cold store, $25 per week, serve 200 guests); Dough Fridge ($600, 1x1, cold store, start); Sink ($400, 1x1, wash station, start); w x h added to all existing items | W | Must | M0.2 | F-38, F-100 |
| F-104 | Service pipeline panel | Four stages (Dough and prep, Oven, Pass and serve, Dishwashing) in covers per hour for lunch and dinner, last service demand marker, bottleneck outlined amber with a one line suggestion, tap a stage to highlight its stations | D | Must | M0.2 | F-102, F-39 |
| F-105 | Fit filtered catalogue and impact preview | Tapping an empty tile lists only items that fit there, grouped by station; each row shows price, maintenance and the compare() preview of profit per day, covers, pizza Q and the stage it raises, with the "not the bottleneck" warning; optional "Pin as savings goal" when F-41 exists | W | Must | M0.2 | F-101, F-42 |
| F-106 | Save migration and auto layout | Schema bump; older saves get a deterministic greedy auto layout plus a free Dough Fridge and Sink if missing; items that cannot fit are refunded at full price with a note; the balance calculator uses the same auto layout | all | Must | M0.2 | F-100, F-04, F-81 |
| F-107 | Tidy up | Button that previews the auto layout as a ghost with before and after flow badges; apply for free, undoable | W | Should | M0.2 | F-106 |
| F-108 | Flow lines and badges | While dragging, dotted lines from each prep station to its nearest oven and from each oven to the pass labelled with tile counts, green within the free distance and amber beyond; per station badges (tick, "-8% walk", snowflake for cold at hand) | MM | Should | M0.2 | F-102, F-101 |
| F-109 | Phone layout for the kitchen | Plan at 44 pt tiles with horizontal scroll, bottom sheet instead of side sheet, pipeline collapsed to four chips | W | Should | M0.2 | F-101, F-104 |

## P. Fresh Start economy (spec: `fresh-start.md`)

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-110 | Empty premises start and opening checklist | New game has no tables, decor, equipment or staff and an empty menu (recipe book full; menu minimum 4 removed); opening requires 1 pizza, 1 table, 1 oven, 1 prep station, 1 cold store, 1 Sink, 1 cook, 1 server; HUD checklist shows each missing item with its cheapest option and a suggested $2,920 opening kit | D | Must | M0.2 | F-100, F-103 |
| F-111 | Hole in the wall premises and 4 week deposits | New premises: dining 6x5, kitchen 8x3, 54 tiles; lease deposit 4 weeks of rent for all premises (was 8) | LT | Must | M0.2 | F-14 |
| F-112 | Entry level and second hand items | Second hand Deck Oven ($900, 15 per hour, -2 quality, $30 per week), Old Workbench ($300, prep x0.9, $5 per week), Folding Table ($120, 2 seats, comfort -1) | W | Must | M0.2 | F-38, F-45 |
| F-113 | Fresh start finance | Starting cash $7,000; starter loan up to $5,000 at 5% over 52 weeks | LT | Must | M0.2 | F-76 |
| F-114 | First hiring board guarantee | Day 1 board offers at least 2 cooks, 2 servers and 1 dishwasher of skill 2 to 4 | W | Must | M0.2 | F-62 |
| F-115 | Move premises | Overnight move to a vacant premises in any district; old deposit refunded, new deposit paid; furniture and equipment move by auto layout, misfits sold at 80%; staff, recipes, Rep and unlocks carry over | LT | Must | M0.2 | F-106, F-111 |
| F-116 | Seat limit | Seats at most floor(0.55 x dining tiles): hole in the wall 16, cosy 44, trattoria 55, big hall 121; shown as "Seats 24 of 44" | W | Must | M0.2 | F-44 |
| F-117 | Realistic covers retune | Foodies dinner meal 90 min, Students dinner meal 45 min, Foodies budget $28, Old Harbour W 1.5, luxury reference price $38 (band $20 to $40); automated covers per service and ceiling checks added to the balance suite | all | Must | M0.2 | F-81, F-53 |

## Q. Kitchen upgrades and add-ons (spec: `kitchen-upgrades.md`)

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-118 | Add-on data and install rules | 18 add-ons in a data file (id, name, fits, price, maintenance per week, unlock, blurb, effects); installed on an owned station with no footprint; at most 2 per station and no duplicates; remove refunds 80%; selling a station refunds 80% of it and of each add-on; add-ons move with the station; `addons: string[]` on owned equipment with save migration | W | Must | M0.3 | F-100, F-101, F-103 |
| F-119 | Generic add-on effects in the sim | Eight effect fields only: slotsAdd and bakeMult (ovens), prepMult (prep stations), qualityAdd (oven, prep, attached sheeter, pass, proving; kitchen total capped at +3 E), washMult (best equipped wash station), serveMult (pass), wasteMult (cold stores; only the best counts), coldReach (cold at hand within 2 tiles); add-on maintenance in upkeep; `T.addons` tunables | D | Must | M0.3 | F-118, F-102, F-39 |
| F-120 | Upgrades section in the station card | Installed add-ons with plain word effect and Remove (refund shown); compatible add-ons with price, maintenance, plain effect, compare() impact preview and Install; states for short cash, locked, station full and quality cap reached | W | Must | M0.3 | F-118, F-105 |
| F-121 | Add-on dots on the floor plan | One 8 pt dot per installed add-on in the station's top right corner, coloured by effect family (quality, speed, cold and waste, wash and serve) | MM | Should | M0.3 | F-118, F-101 |
| F-122 | Station upgrade path (trade in) | "Upgrade to X" on the station card for Second hand Deck Oven to Deck Oven, Deck Oven to Double Deck or Stone Hearth, Old Workbench to Prep Counter, Prep Counter to Marble Bench or Prep Fridge; same tiles; net cost new price minus 80% of old; compatible add-ons kept, others refunded at 80%; Replace also carries compatible add-ons | W | Should | M0.3 | F-118, F-101 |
| F-123 | Add-on balance checks | Reference builds carry no add-ons; new check that the fully upgraded middle build is still beaten by each specialist's best home profit by 15% or more; `npm run balance` prints each add-on's payback in its reference scenario | all | Must | M0.3 | F-119, F-81 |

## R. Staff management, the Squad (spec: `staff-management.md`)

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-124 | Four attributes and OVR | Quality, Speed, Composure, Mentoring on 1 to 99; role weighted OVR; card tiers bronze, silver, gold, elite; POT 30 to 95 shown as a range; salary from OVR | W | Must | M0.4 | F-62 |
| F-125 | Attributes in the sim | QUA drives kitchen K, artisan threshold, menu complexity and service score; SPD drives personal speed; manager effect reads OVR/10; identical results at QUA = SPD = 10 x skill, CMP 50 | D | Must | M0.4 | F-124, F-39, F-40 |
| F-126 | Composure under pressure | Per service pressure multiplier from rho and CMP (onset 0.8, worst x0.70, best x1.15) on speed, half of it on quality | D | Must | M0.4 | F-125 |
| F-127 | Squad tab and player card | Lineup by area with cards (OVR, tier, bars, morale face, form arrow); team ratings strip with bottleneck glow; player card with diamond chart, chips, mood drivers, contract, form sparkline and actions | W | Must | M0.4 | F-124 |
| F-128 | Staff market | Pool of 24, 8 new per week, 21 day stay, at least one per role; tier mix by best Rep; interest gates for gold and elite; apprentices corner; recruitment agency; offer at asking or 10% below | W | Must | M0.4 | F-124, F-62 |
| F-129 | Scouting and compare line | Attribute ranges until interview (3 free per week, then $40); POT exact after 4 weeks; compare line against the weakest teammate in the role | W | Must | M0.4 | F-128, F-63 |
| F-130 | Natural growth and team growth bonus | 1 attribute point per 4 shifts to the highest weighted attribute below POT; area bonus from best MEN; replaces the Mentor trait | W | Must | M0.4 | F-124 |
| F-131 | Coaching and courses | Coach and trainee pairs, gain (MEN - 30)/20 per week, coach speed x0.90; 9 courses with price, days off, gain formula with headroom, learn and mood; 14 day cooldown; training preview with rota impact and payback | W | Must | M0.4 | F-130, F-63 |
| F-132 | Contract reviews and promotion rule | Review every 8 weeks and after a course lifting OVR by 3 or more; market value with young talent premium; promotion thresholds and recomputed OVR in the preview | W | Should | M0.4 | F-131 |
| F-133 | Mood target and universal drivers | Morale moves up to 4 per day toward a target of 65 plus drivers: pay fairness, workload, pressure, development, team; morale also scales quality (0.95 to 1.05) | D | Must | M0.4 | F-64 |
| F-134 | Personalities | 12 personalities reading business, speed, quality, reputation, pay or growth, with spawn weights; talents split from personality; Eager Learner and Big Game Player talents | D | Must | M0.4 | F-133, F-65 |
| F-135 | Form | In form after 5 days at morale 80+ (+3 all attributes), Out of form after 5 days below 35 (-3); arrow on every card | D | Should | M0.4 | F-133 |
| F-136 | Rival offers | OVR 70+ and paid 10%+ below market: 15% weekly chance, 7 days warning, Match or Let go; Loyal exempt; replacement suggestions open the market pre filtered | W | Should | M0.4 | F-128, F-132 |
| F-137 | Team card in day and week reports | Contribution per person against a standard replacement (same seed), one reason per person; day: Star of the day, Weak spot, up to 2 more each, 2 mood lines; week: Player of the week, sorted table, Needs attention, one advisor suggestion | D | Must | M0.4 | F-125, F-133 |
| F-138 | Manager staff policies | Training budget, pay, hiring focus, replace underperformers; manager choice accuracy 0.40 + 0.005 x P; coaching at half rate; calm effect; staff at managed restaurants grow and change morale | LT | Must | M0.4 | F-69, F-131, F-133 |
| F-139 | Manager report line and override | Weekly manager line in the report with a proposal; read only Squad with Override; "Let my manager handle the team" at the player's own restaurant | LT | Should | M0.4 | F-138 |
| F-140 | Staff balance checks and migration | Save migration of section 10; reference builds identical; strategy fit check; course payback table in `npm run balance`; managed team growth at most 90% of an optimal player | all | Must | M0.4 | F-124 to F-138, F-81 |

## S. Competition, marketing and delivery (spec: `competition.md`)

| ID | Feature | Description | Loop | Priority | Milestone | Depends on |
|---|---|---|---|---|---|---|
| F-141 | Live competition and background split | District competition split into background (0.5 x district competition + venue delta) and live rival pressure per segment; C_eff_s = min(0.9, C_bg + C_live_s); with live rivals off the formula is exactly today's | D | Must | M0.5 | F-53 |
| F-142 | Rival generation | 6 archetypes (Price Fighter, Artisan, Hype House, Honest Trattoria, Trendy Kitchen, Budget Chain) with price, quality and marketing style weights; 30 named rivals with owner, motto and logo; skill from the setting plus or minus 1; start capital; district quotas by competition with largest remainder; placement by expected profit among 2 + skill venues; never on the original hole in the wall venues | LT | Must | M0.5 | F-141, F-149 |
| F-143 | Rival pressure in demand and cannibalisation | Attractiveness A per restaurant and segment from the existing demand multipliers; rel clamped 0.25 to 2.5; pressure 0.10 x proximity (same street 1.3, same district 1.0, nearby 0.3) x rel; 0.2 per other own restaurant in the district (implements F-87); rival states frozen at the start of the day | D | Must | M0.5 | F-141, F-142 |
| F-144 | Rival daily simulation and finances | Aggregate rival day with the player's formulas: Q from tier and skill, fair price, check, food cost, seats x turns, satisfaction, Rep and following updates; P&L with rent, staff, utilities, upkeep, marketing; brand cash; own random stream | D | Must | M0.5 | F-143 |
| F-145 | Rival weekly decisions, rescue and closing | Candidate moves scored by expected weekly profit plus a style bonus; best move with p = 0.35 + 0.06 x skill; price moves at most 5% a week, floor 0.75 (0.80 at skill 7+), ceiling 1.40, 2 cuts then 4 weeks cooldown; runway rule; one rescue after 4 losing weeks; closing rules; "To let" for 7 days | W | Must | M0.5 | F-144 |
| F-146 | New entrants over time | Weekly entry chance 1 / interval from the setting, not before day 28; 28 day grace in the player's new districts and between entrants; affordability rule (fit out, deposit, 4 weeks of fixed costs); entrants at Rep 30, following 0.25; 7 day viewing notice; closed rivals may return after 16 weeks | LT | Must | M0.5 | F-145, F-151 |
| F-147 | Rival chains and viewing notices | Expansion at 25% a week when cash covers the premises plus 8 weeks, Rep 55+, positive 4 week profit, below the archetype's max locations; 7 day viewing notice cancelled when the player rents or holds the venue; rivals hold at most 30% of venues | LT | Should | M0.5 | F-146 |
| F-148 | Hold a venue | Pay 1 week of rent to hold a free venue for 28 days; rivals never view or sign it; fee taken off the deposit if rented within the hold; one hold at a time | LT | Should | M0.5 | F-147 |
| F-149 | 72 venues | 48 new venues (University 8, Business 7, Linden 4, Market 8, Canal 7, Old Town 8, Old Harbour 6) with premises, rent, traffic, modifiers, tilt, coordinates, two pros and two cons; the 24 existing venues unchanged; at least 2 hole in the wall venues per neighbourhood | LT | Must | M0.5 | F-13 |
| F-150 | City map rivals layer | Star pins for own restaurants, logo pins ringed by archetype colour with a letter, viewing pins with eye and countdown, To let and held tags; 44 pt targets with clusters, pinch zoom, filters All, Free, Rivals, Mine; venue card lists rivals in reach, per segment competition and a Hold button | LT | Must | M0.5 | F-149, F-142 |
| F-151 | Competition settings | Settings group: live rivals on or off, rivals at the start 0 to 20, skill Casual to Master, start capital $18,000 to $160,000, new rivals later Off to Often, caps per city and per neighbourhood; Easy, Normal, Hard presets; mid game rules; old saves load with rivals off and a one time prompt | all | Must | M0.5 | F-09, F-141 |
| F-152 | Marketing campaigns | 10 campaigns (flyers, social ads, student deal, family Sundays, business lunch club, tourist guide, foodie press night, loyalty cards, local radio, promoted delivery listing) with cost scaled by foot traffic, run length, lift, audience weights, delivery lift, awareness and side effects; mkt_s in the demand formula capped at 1.5; audience match 0 to 1; 3 slots; fatigue; Marketing P&L line (replaces F-74) | W | Must | M0.5 | F-53, F-75 |
| F-153 | Marketing sheet | Active campaigns with days left, extra guests and spend; catalogue cards with audience chips, match meter (Great, OK, Poor), compare() preview of guests, profit and following, full room and poor fit warnings, start and stop | W | Must | M0.5 | F-152, F-42 |
| F-154 | Rival marketing | Rivals run the same campaigns (not loyalty or radio) on a budget of marketing weight x 0.25 x revenue under the runway rule; audience matched with pBest; campaigns public on cards and in the news feed | W | Must | M0.5 | F-152, F-145 |
| F-155 | Rivals tab and market share | Rivals tab with district chips; donut and per segment stacked bars of pizza guests this week; 12 week share line with event markers; news feed of the last 28 days | W | Must | M0.5 | F-144 |
| F-156 | Rival cards | Archetype with price, quality and marketing dots, stars, estimated price band and quality range, speed, campaigns, segment bars, overlap line, trend (Growing, Steady, Struggling); archetype hidden for the first 14 days | W | Must | M0.5 | F-155 |
| F-157 | Mystery diner | $60, one per rival per week; exact prices, Q, satisfaction, lowest sub score and archetype for 28 days | W | Should | M0.5 | F-156 |
| F-158 | Guests lost and won | Second demand and capacity pass without live rivals, same seed; lost per segment attributed to rivals by pressure share; won back week over week; nothing lost at a full service; stored per day and restaurant | D | Must | M0.5 | F-143 |
| F-159 | Competition coach | Playbook of 8 situations (undercut, out cooked, out shouted, newcomer, rival struggling, you lead, full house, delivery overload); 1 to 3 responses with compare() previews, one Recommended, Do it deep links; at most 2 situations shown | W | Must | M0.5 | F-158, F-153 |
| F-160 | Competition in the day and week reports | Day: lost guests line, one market news line, Delivery card, Marketing P&L line; week: headline, market share, impact table by rival and segment with won back, rival moves, your marketing results, delivery, one or two coach items | D | Must | M0.5 | F-158, F-159 |
| F-161 | Delivery unlock and modes | Unlock at Rep 60 and 28 days open per restaurant; Packing Station ($900, 1 x 1, $10 per week); three modes: platform (30%), platform with own riders (14%), own delivery (reach 0.4, $150 per week web shop) | LT | Must | M0.5 | F-71, F-100 |
| F-162 | Delivery demand and delivery reputation | Orders from catchment (own traffic plus half of adjacent districts) x 0.004 x segment affinity, price, budget and quality multipliers, repMult(DRep), reach, delivery marketing, novelty 1.2 for 14 days, delivery competition; split 30% lunch; separate DRep starting at 50 with cancellation and refusal penalties | D | Must | M0.5 | F-161, F-53 |
| F-163 | Shared kitchen, delivery time and throttle | Delivery mains (1.8 per order, x1.1 work) share oven and prep with dining in proportion to need; throttle at a kitchen load (default 0.8) refuses orders; cancellations when overloaded; delivery time = cook + full queue + pack + rider wait + ride against a 35 minute promise; Delivery bar in the pipeline panel | D | Must | M0.5 | F-162, F-39, F-104 |
| F-164 | Delivery economics, riders and vehicles | Order value with markup 0% to 20%; fee, commission, packaging (basic, insulated eco), utilities; Rider role ($380 base, SPD, QUA, CMP effects); bikes and electric scooters; Delivery block in the P&L | W | Must | M0.5 | F-162, F-124 |
| F-165 | Delivery panel | DRep, orders wanted, accepted, refused and cancelled, times against the promise, kitchen share; mode, markup, packaging and throttle with previews; riders needed and vehicle purchases; delivery coach line | D | Must | M0.5 | F-163, F-164 |
| F-166 | Rival delivery | Price Fighter, Hype House, Trendy Kitchen and Budget Chain start platform delivery past their Rep threshold; simplified orders capped at 40% of dining capacity; adds to the player's delivery competition | W | Should | M0.5 | F-162, F-145 |
| F-167 | Competition balance checks and migration | Save migration of competition.md 10; reference builds identical with rivals off; live market sanity, campaign payback, delivery gain per build and dominant strategy checks in `npm run balance`; performance budget | all | Must | M0.5 | F-141 to F-166, F-81 |
| F-168 | Second hand fit out from closed rivals | The next tenant of a closed rival's venue may buy up to 3 of its stations at 50% | LT | Nice | M0.5 | F-145, F-101 |

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

168 features is already a lot for a small team. The cut order in prd.md 10.4 applies. Features that carry the two strategies (F-19, F-20, F-38, F-39, F-40, F-53, F-81) are pillars and are not cut.
