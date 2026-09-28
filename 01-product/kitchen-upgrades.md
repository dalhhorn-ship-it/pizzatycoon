# PRD addendum: Kitchen upgrades and add-ons

* Status: Draft 1 for milestone **M0.3**
* Owner: Game Product Management
* Date: 2026-09-26
* Extends: `kitchen-builder.md` (station card, Replace, flow), `fresh-start.md` 4 (second hand ladder), `balance.md` 1.7
* Features: F-118 to F-123 in `features.md`. Acceptance criteria: AC-175 to AC-193 in `acceptance-criteria.md`
* **Payback figures are hand estimates from the aggregate formulas; AC-188 makes `npm run balance` confirm them.**

## 1. Goal and the loop it serves

Founder request: "ok great also have upgrade / add on options for every part of the kitchen".

Between big purchases the player often has $200 to $1,000 and nothing meaningful to spend it on. Add-ons fill that gap: small, cheap improvements bolted onto a station the player already owns, each nudging one pipeline stage or pizza quality.

* **Loops served:** week (a cheap purchase every few days while saving for the next big one) and session (read the pipeline, fix the bottleneck with a $150 part instead of a $5,500 oven).
* **Feeling:** "I tuned my old oven." Pride in a kitchen that grows with the restaurant.
* **Design intent:** add-ons are polish, not a strategy. Each effect is 5 to 12% or +1 to +2 quality, a hard cap stops stacking, and the specialist builds stay ahead without them.

## 2. Rules

1. An add-on is installed **on one owned station**. It takes no floor tiles and moves, rotates and is sold with its station.
2. **At most 2 add-ons per station**, and never two copies of the same add-on on one station.
3. An add-on fits only the item ids listed in its `fits` field and must be unlocked. Price is paid on install.
4. **Remove** refunds 80% of the add-on price. **Selling a station** refunds 80% of the station plus 80% of each add-on on it.
5. Add-on maintenance is added to `maintenancePerWeek` and so to daily upkeep.
6. Installing, removing and trading in happen in build mode (time paused) and apply from the next service. Undo works within the visit, as for the Kitchen Builder.
7. **The three reference builds of `balance.md` 3.1 carry no add-ons.** Their numbers, and every existing AC, are unchanged.

## 3. Effect fields and where the sim reads them

Every add-on effect is one or more of these eight fields. Nothing else is allowed, so engineering implements them once, generically.

| Field | Station roles | Applied in | Formula |
|---|---|---|---|
| `slotsAdd` | oven | `kitchenStats` oven loop | `slots' = slots + sum(slotsAdd)` |
| `bakeMult` | oven | `kitchenStats` oven loop | `bake' = item bakeMult x product(bakeMult)`; feeds servings per hour and cook time |
| `prepMult` | counter | `stationRate` | `station_prep = 30 x speed x tool x product(prepMult) x cold_mult x reach_mult` |
| `qualityAdd` | oven, counter, sheeter, pass, proving | E | see the quality cap below |
| `washMult` | sink, dishMachine | `serviceStats.platesPerHour` | multiplied by the product on the **best equipped** wash station (not by every station) |
| `serveMult` | pass | `serviceStats.serveTime` | `serve x 0.7 x product(serveMult) / speed` |
| `wasteMult` | cold (Dough Fridge, Prep Fridge) | `day.ts` P&L waste | `waste' = waste x min(all installed wasteMult)`: **only the best one counts** |
| `coldReach` | cold | `kitchenFlow` | that cold store gives cold at hand to plain prep stations at distance 2 or less (normally 1) |

**Quality cap.** Add-on quality is summed the same way E sums the station itself: oven `qualityAdd` is added to that oven's quality mod before the under skill scaling and output weighted like it; counter and attached sheeter `qualityAdd` are averaged over staffed stations; pass and proving add directly. The total add-on contribution is capped:

```
E = clamp(E_stations + min(3, E_addons), -6, 15)
```

Rule of thumb for the preview and for payback: one point of pizza Q is worth about **$13 per day at the cosy starter** and **about $30 per day in the middle build** (+$0.08 fair price and about +1% demand per point).

## 4. The add-on catalogue (18 items)

| id | Name | Fits | Price | Maint. per week | Unlock | Effect | Pays back at | Est. payback |
|---|---|---|---|---|---|---|---|---|
| pizzaStone | Pizza Stone Insert | usedDeckOven, deckOven, doubleDeckOven | $500 | $2 | Start | qualityAdd +2 | cosy starter | 3 weeks |
| thermostatTune | Thermostat Tune up | usedDeckOven, deckOven, doubleDeckOven, stoneHearthOven | $350 | $3 | Day 5 | bakeMult 0.93 | cosy starter | 5 weeks |
| extraDeckRack | Extra Deck Rack | doubleDeckOven | $900 | $8 | Serve 500 | slotsAdd +1 (8 to 9) | trattoria, oven bound | 4 weeks |
| beltSpeedKit | Belt Speed Kit | conveyorOven | $1,200 | $12 | Rank Owner | bakeMult 0.92 | volume, lunch | 6 weeks |
| woodSmokeBox | Wood Smoke Box | woodFiredOven | $800 | $10 | Rep 55 | qualityAdd +2 | early luxury | 5 weeks |
| firebrickLiner | Firebrick Dome Liner | woodFiredOven | $700 | $8 | Rep 55 | bakeMult 0.93 (12.0 to 12.9 per hour, still below 20) | luxury | 6 weeks |
| toppingRail | Topping Rail | oldWorkbench, prepCounter, marbleBench, prepFridge | $400 | $3 | Serve 500 | prepMult 1.08 | volume, prep bound | 5 weeks |
| marbleInsert | Marble Top Insert | oldWorkbench, prepCounter | $400 | $0 | Serve 200 | qualityAdd +1 | middle | 4 weeks |
| portionScale | Portion Scale | oldWorkbench, prepCounter, marbleBench, prepFridge | $250 | $0 | Day 8 | qualityAdd +1 | cosy starter | 5.5 weeks |
| fineRollers | Fine Gauge Rollers | doughSheeter (counts only when attached) | $200 | $3 | Serve 500 | qualityAdd +1 | volume | 6 weeks |
| doorSeals | Door Seals and Shelving | doughFridge, prepFridge | $200 | $0 | Rep 40 | wasteMult 0.88 | middle | 5 weeks |
| tempLogger | Temperature Logger | doughFridge, prepFridge | $450 | $0 | Rep 55 | wasteMult 0.80 | luxury | 4.5 weeks |
| drawerUnit | Drawer Unit | doughFridge, prepFridge | $300 | $0 | Day 8 | coldReach | volume, prep bound | 4 weeks |
| dryingRacks | Drying Racks | sink, dishMachine | $150 | $0 | Day 8 | washMult 1.08 | wash bound | 3 weeks |
| preRinseSpray | Pre rinse Spray | sink, dishMachine | $350 | $3 | Day 8 | washMult 1.12 | wash bound | 4 weeks |
| ticketRail | Ticket Rail | heatLampPass | $150 | $0 | Day 5 | serveMult 0.90 | volume | 4 weeks |
| heatShelf | Heat Shelf | heatLampPass | $400 | $3 | Day 8 | qualityAdd +1 (cancels the pass's -1) | cosy with a pass | 4.5 weeks |
| humidityControl | Humidity Control | provingCabinet | $900 | $5 | Rep 40 | qualityAdd +1 | early luxury | 4.5 weeks |

Blurbs, one line each: Pizza Stone "A proper stone under every base. Crisper, every time." Thermostat "An engineer, a screwdriver and a steadier heat." Deck Rack "Squeeze one more pizza in." Belt Kit "A slightly faster belt, same golden result." Smoke Box "A whisper of oak on every crust." Firebrick "Holds heat like a grandmother holds a grudge." Topping Rail "Everything in reach, nothing to hunt for." Marble Insert "A cool slab of marble set into the bench." Portion Scale "Same cheese, every pizza." Fine Rollers "Thinner, more even bases." Door Seals "Cold stays in, waste stays down." Temperature Logger "It notices before the milk does." Drawer Unit "Cold drawers that slide out to the next bench." Drying Racks "Plates dry while you wash the next stack." Pre rinse Spray "Blast it clean before it goes in." Ticket Rail "Orders in a neat row, oldest first." Heat Shelf "Plates wait hot, not warm." Humidity Control "Dough that proves the same in August and January."

**Why proving and the sheeter have one add-on each:** only `qualityAdd` affects them in the sim; a second quality part would just duplicate the first.

**Maximum stacking** (2 per station): Double Deck with Rack and Thermostat 40 to 48.4 per hour (+21%, value per serving similar to a second Double Deck, so not a shortcut); any other oven at most +8.7%; prep +8% per station; wash +21%; serve time x0.90; waste x0.80; E +3.

## 5. Station upgrade path (trade in)

The station card shows **Upgrade to X** for these natural steps. It is a one action Replace: the new item takes the same tiles (same footprint), the old one is sold at 80%.

| From | To | Net cost |
|---|---|---|
| Second hand Deck Oven | Deck Oven | $1,680 |
| Deck Oven | Double Deck Oven | $3,580 |
| Deck Oven | Stone Hearth Oven | $4,080 |
| Old Workbench | Prep Counter | $960 |
| Prep Counter | Marble Bench | $3,040 |
| Prep Counter | Pizza Prep Fridge with Marble Top | $2,240 |

* Net cost = new price minus 80% of the old price minus 80% of any add-on that does not fit the new item.
* Compatible add-ons stay installed at no cost; incompatible ones (Pizza Stone onto Stone Hearth, Marble Insert onto Marble Bench) are removed and refunded at 80%. The confirm sheet lists "Keeps" and "Refunds" before the player taps.
* The destination must be unlocked. The general Replace of `kitchen-builder.md` 7 also carries compatible add-ons.

## 6. UI

**Station card (side sheet on iPad, bottom sheet on phone), new "Upgrades" section** under the station's stats:

* Header "Upgrades 1 of 2" and, when an Upgrade to X path exists, a highlighted row with its net cost and impact preview.
* **Installed:** icon, name, effect in plain words ("Bakes 7% faster"), and Remove showing the refund ("Remove, +$280").
* **Available:** every add-on that fits this item, installed ones excluded. Row: icon, name, price, maintenance per week, plain effect, and the impact preview from the existing `compare()` on the hypothetical state (profit per day, covers per day, pizza Q, pipeline stage raised). Warnings reuse the Kitchen Builder wording ("Your seats are the limit, not the oven").
* Button states: **Install $350**; "Need $X more"; the unlock text when locked; "Station full, remove one first" at 2; "Kitchen quality boost is at its +3 limit" when a quality add-on would add nothing (preview shows +0).
* Plain word effects: bakeMult 0.93 "Bakes 7% faster"; slotsAdd "+1 pizza at a time"; prepMult 1.08 "Prep 8% faster"; qualityAdd "+N pizza quality"; washMult "Washes N% faster"; serveMult 0.90 "Serves 10% faster"; wasteMult "Wastes N% less (best one counts)"; coldReach "Keeps benches 2 tiles away cold".

**Floor plan:** each installed add-on shows as an 8 pt dot in the station's top right corner (at most 2), gold for quality, orange for speed, blue for cold and waste, teal for wash and serve. Dots are drawn in every mode and never need hover. The pipeline breakdown (Detailed numbers) lists add-on factors on their own line.

On install: a small spanner twirl and a soft click; the dot pops in.

## 7. Balance and dominant strategy checks

* **No add-ons in reference builds** (rule 7): all `balance.md` 3.5 checks run unchanged.
* **New check, fully upgraded middle:** the middle build with every station carrying its most profitable allowed add-on set (exhaustive per station, unlimited cash) must still be beaten by **each specialist's best home profit by 15% or more**. Hand estimate: middle gains 4 to 6% (E +2 from counters, waste x0.80, Stone Hearth cook time 0.8 min shorter): University Quarter $1,652 to about $1,740 vs volume $2,106 (+21%, pass); Old Harbour $1,415 to about $1,490 vs luxury about $2,045 (+37%, pass).
* **Risk:** the M0 live sim had volume only 16% above middle in University Quarter (`balance.md` 4.1 watch item 2). A 5% middle gain would fail. Fix in this order: `addons.qualityCap` 3 to 2; then Students B per `balance.md` 3.7; then drop prepCounter from Marble Insert's fits.
* **Always buy everything?** No: throughput parts pay back only on the binding stage, and the preview says so; quality is capped at +3; every part carries maintenance.
* **Cheap Marble Bench?** Prep Counter plus Marble Insert plus Portion Scale is +2 for $1,850, but it uses both slots and the kitchen cap; a Marble Bench can still take add-ons on top of its own +2.

| Tunable (`T.addons`) | Unit | Start | Safe range |
|---|---|---|---|
| maxPerStation | count | 2 | 1 to 3 |
| qualityCap | E points | 2 (was 3; lowered after the live balance run, see section 7 risk) | 2 to 4 |
| coldReachTiles | tiles | 2 | 2 to 3 |
| resale | fraction | 0.80 (reads `kitchen.resale`) | 0.6 to 0.9 |

Add-on prices and effects live in the add-on data file; each price may move within plus or minus 40% and each effect within the 5 to 15% / +1 to +3 band without a spec change.

## 8. Save migration, failure and recovery

* `OwnedEquipment` gains `addons: string[]`. Older saves load with empty lists and identical stats.
* A wrong add-on costs 20% to remove. A station can never exceed 2 add-ons; invalid installs are rejected with the reason and state unchanged.

## 9. Out of scope for M0.3

* Add-ons that change footprint, add tiles or create new stations.
* Wear, breakdowns or add-ons expiring.
* Add-ons for dining furniture.
* Automatic "install best add-on" (a v1.0 manager delegation candidate).

**Scope risk.** About half an engineering day for data and sim, half a day for UI. If it runs long, cut in this order: floor plan dots (F-121), trade in shortcut (F-122, Replace still works), coldReach (drop Drawer Unit). Never cut the impact preview: it is the feedback that makes a $150 part a decision.

## 10. M0.3 definition of done

AC-175 to AC-193 pass; `npm run balance` prints the add-on payback table and the fully upgraded middle check passes; the founder can open a Second hand Deck Oven on an iPad, install a Thermostat Tune up, see the dot appear and the oven bar grow, then Upgrade to Deck Oven for $1,680 and keep the thermostat.

## 11. Higher end equipment and a foldable catalogue (as built, M0.7)

Founder request: "have more kitchen upgrades available, make categories groupable/foldable also have a wide range of higher quality equipment available."

**19 new stations** in `src/data/equipment.ts`, each on an existing role so the sim reads them generically. Prices and unlocks sit above the M0.3 ladder, so the reference builds of `balance.md` 3.1 are unchanged.

| Item | Role, family | Price | Key numbers | Unlock | Upgrade from |
|---|---|---|---|---|---|
| Electric Deck Oven Pro | oven, quality | $4,200 | 4 slots, bake x0.9, quality +2 | serve 500 | Deck Oven |
| Gas Fired Stone Oven | oven, hybrid | $9,000 | 5 slots, bake x0.95, quality +6, tend 0.6 | rep 50 | Deck Pro, Stone Hearth |
| Triple Deck Oven | oven, volume | $9,500 | 12 slots, quality -1, tend 0.75 | serve 2,000 | Double Deck |
| Rotating Stone Deck Oven | oven, hybrid, 3x3 | $16,000 | 6 slots, bake x0.85, quality +7, skill 5 | rank Restaurateur | none |
| Twin Belt Conveyor Oven | oven, volume, 3x2 | $15,000 | 9 slots, bake x0.55, quality -3, tend 0.35 | rank Restaurateur | Conveyor |
| Neapolitan Dome Oven | oven, artisan, 3x3 | $18,000 | 4 slots, bake x1.15, quality +12, skill 8 | rep 70 | Wood Fired |
| Stainless Prep Table | counter, basic | $1,800 | prep x1.05 | day 5 | Workbench, Prep Counter |
| Granite Pastry Bench | counter, quality | $6,500 | prep x1.05, quality +3 | rep 55 | Marble Bench |
| Refrigerated Marble Make Line | counter, quality, 3x1 | $7,800 | prep x1.3, cold, dough for 150, quality +3 | rep 60 | none |
| Chef's Olive Wood Bench | counter, artisan | $9,000 | prep x0.95, quality +5 | rep 70 | Granite Bench |
| Precision Dough Press | sheeter, quality | $5,000 | prep x1.3, quality 0 (the basic sheeter is -2) | rep 50 | Dough Sheeter |
| Automatic Dough Divider | sheeter, volume | $7,000 | prep x1.5, quality -2 | serve 2,000 | Dough Sheeter |
| Retarder Prover | proving, quality, 1x2 | $7,000 | quality +5, cold, dough for 120 | rep 60 | none |
| Heated Stone Pass | pass, quality | $4,000 | serving x0.65, quality +1 | rep 55 | Heat Lamp Pass |
| Hood Type Dishwasher | dish machine, volume | $8,000 | dishwashing x2.4 | serve 2,000 | Dish Machine |
| Blast Chiller | cold, quality, 1x1 | $4,500 | dough for 300 on one tile | rep 55 | Dough Fridge |
| Double Door Fridge | cold, basic, 2x1 | $3,200 | dough for 500 | serve 500 | none |
| Heated Packing Station | packing, quality | $3,500 | packs in half the time, delivery food +0.04 | rep 65 | Packing Station |
| Plate Warmer Cabinet | storage, quality | $1,200 | 150 more plates | serve 1,000 | Plate Shelving |

Sim changes so the new items count: the pass, sheeter and dish machine now use their own item's numbers (the attached sheeter per station, the fastest dish machine, the best proving cabinet), and any packing role item opens delivery. Existing add-ons fit the new stations of the same kind.

Guardrail kept: the artisan Neapolitan Dome bakes about 17 pizzas an hour at skill 5, under the deck oven's 20 (`tests/formulas.test.ts`).

**UI.** The Add equipment list, Your equipment and a new **Equipment catalogue** (every item, now and later, with its unlock) are grouped in foldable sections. **Group by** switches between *Station* (Ovens, Prep stations, Dough tools, Cold storage, Washing, Pass and plates, Delivery) and *Quality line* (Basic, Volume, Quality, Hybrid, Artisan). Open all and Fold all sit next to it; folds are remembered per browser. Inside a group, unlocked items come first, cheapest first.


## 12. Tuning for speed, quality or both (as built, M0.7)

Founder request: "invent more kitchen upgrades to tune for quality, or speed, or both."

Every new item has a clear lean, so the player picks a direction rather than just the next price step. **Speed** gear sits in the Volume line, **quality** gear in Quality or Artisan, and gear that does **both** sits in Hybrid and costs the most. All reuse existing roles, so the sim reads them generically, and none is in a reference build, so `balance.md` 3.1 is unchanged.

**8 new stations** (`src/data/equipment.ts`):

| Item | Lean | Role, family | Price | Key numbers | Unlock | Upgrade from |
|---|---|---|---|---|---|---|
| Air Impinger Oven | speed | oven, volume, 2x2 | $6,800 | 3 slots, bake x0.45, quality -2, tend 0.3 | serve 1,000 | Conveyor |
| Double Sided Make Table | speed | counter, volume, 3x1 | $5,200 | prep x1.45, quality -1 | serve 1,000 | Prep Counter, Stainless |
| Rack Conveyor Dishwasher | speed | dish machine, volume, 3x1 | $14,000 | dishwashing x3.2, 3 washers, 2 wash points | rank Restaurateur | Hood Type |
| Mother Dough Cellar | quality | proving, artisan, 2x2 | $12,000 | quality +7, cold, dough for 150 | rep 75 | Retarder Prover |
| Dual Fuel Brick Oven | both | oven, hybrid, 3x3 | $26,000 | 7 slots, bake x0.75, quality +8, skill 6 | rep 75 | Gas Stone, Rotating Stone |
| Pizzaiolo Station | both | counter, hybrid, 3x1 | $11,500 | prep x1.35, quality +4, cold, dough for 120 | rep 70 | Make Line |
| Cold Press Sheeter | both | sheeter, hybrid | $8,500 | prep x1.4, quality +1 | rep 65 | Dough Press, Divider |
| Expo Pass with Ticket Screen | both | pass, hybrid | $6,500 | serving x0.55, quality +1 | serve 2,000 | Heat Lamp, Heated Stone |

**9 new add-ons** (`src/data/addons.ts`). Two are deliberate trades: the add-on quality cap (`T.addons.qualityCap`) still applies, and a negative quality counts against it.

| Add-on | Lean | Fits | Price | Effect | Unlock |
|---|---|---|---|---|---|
| Convection Fan Kit | speed for quality | deck ovens, air impinger | $900 | bakes 15% faster, -1 quality | serve 500 |
| Pizza Screen Rack | speed | conveyors, air impinger | $700 | +1 pizza at a time | serve 1,000 |
| Sauce Dispenser | speed | prep stations | $450 | prep 12% faster | serve 500 |
| Kitchen Ticket Screen | speed | passes | $1,100 | serves 15% faster | serve 1,000 |
| Glass and Plate Racks | speed | wash stations | $600 | washes 15% faster | serve 1,000 |
| Biscotto Stone Floor | quality | stone and brick ovens | $1,400 | +2 quality | rep 50 |
| Fresh Basil Pots | quality for speed | prep stations | $300 | prep 3% slower, +2 quality | rep 45 |
| Infrared Top Heater | both | deck, stone and brick ovens | $1,800 | bakes 10% faster, +1 quality | rep 60 |
| Overhead Gantry Shelf | both | prep stations | $800 | prep 5% faster, +1 quality | rep 55 |

Existing add-ons that fit the same kind of station fit the new ones too (the smoke box and firebrick liner on the dual fuel oven, humidity control on the dough cellar, and so on). The add-on text now reads negative effects plainly ("Prep 3% slower", "-1 pizza quality").

Tests: `tests/speedQualityGear.test.ts`.
