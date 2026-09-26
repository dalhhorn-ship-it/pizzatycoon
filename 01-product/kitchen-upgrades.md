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
