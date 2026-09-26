# PRD addendum: Kitchen Builder

* Status: Draft 1 for milestone **M0.2**
* Owner: Game Product Management
* Date: 2026-09-26
* Extends: `prd.md` 5.5 (Kitchen equipment) and 5.7 (service and turnover); numbers extend `balance.md` 1.7
* Features: F-100 to F-109 in `features.md`. Acceptance criteria: AC-134 to AC-158 in `acceptance-criteria.md`
* Companion: `fresh-start.md` (empty premises, second hand items, Hole in the wall premises, covers retune), same milestone

## 1. Goal and the loop it serves

Founder request: "when I click the kitchen tab, I would like to see the kitchen with appliances (or places for it) so i can upgrade the kitchen. make this a really cool feature that you optimise the kitchen and add things to speed up service like pizza dough cooler with marble on top to roll pizza's, pizza ovens. Also create ui for this!"

Today the Kitchen tab is a list. The Kitchen Builder turns it into a place: a top down floor plan where the player sees every oven and bench, taps an empty spot to buy, drags stations into a tidy pizza line, and reads a pipeline that says which stage holds service back.

* **Loops served:** week (save up, buy, place) and session (after each service, read the pipeline, fix the bottleneck). Moment to moment it adds a tactile drag and snap puzzle.
* **Design intent:** a sensible layout is neutral; a careless one costs a few percent; a clever one earns a small bonus. The layout is a satisfying polish layer, never a new way to fail. Equipment choice stays the strategy decision (luxury, volume, middle).

## 2. Player verbs and feedback

| Verb | Feedback |
|---|---|
| Open Kitchen tab | Stage switches from dining room to the kitchen floor plan; pipeline strip appears |
| Tap empty tile | Side sheet lists items that fit there, each with its impact preview |
| Tap station | Station card: what it does, its flow badges, Move, Rotate, Sell |
| Drag (move) | Ghost footprint, flow lines with tile counts, live badges; snaps on drop |
| Rotate | Footprint turns 90 degrees in place (if valid) |
| Sell | Confirm with the 80% refund amount |
| Tidy up | Auto layout proposal shown as a ghost; Apply or Cancel |
| Undo | Reverts the last builder action taken during this visit to the tab |

## 3. The kitchen floor plan

### 3.1 Grid per premises

| Premises | Kitchen grid (w x h) | Tiles (matches `kitchenTiles`) | Pass tiles (row 0) |
|---|---|---|---|
| Hole in the wall (new, `fresh-start.md`) | 8 x 3 | 24 | columns 3 and 4 |
| Cosy corner shop | 10 x 3 | 30 | columns 4 and 5 |
| Neighbourhood trattoria | 12 x 3 | 36 | columns 5 and 6 |
| Big hall | 15 x 4 | 60 | columns 6 and 7 |

* Row 0 borders the dining room. The **pass** is a hatch in that wall; its two tiles sit in row 0 at columns `floor((W minus 2) / 2)` and the next one.
* The **back door** is drawn on the back wall at the last column. It is decoration only in M0.2 (no reserved tile, no rule).
* `PREMISES` gains `kitchenWidth` and `kitchenHeight`. The old rule "footprint used at most kitchenTiles minus 4" is replaced by the validity rules below.

### 3.2 Footprints and rotation

Every item gets `w` and `h` (from `balance.md` 1.7) and a position `x, y, rot`. Rotation by 90 degrees swaps w and h; supported for every item except the Heat Lamp Pass. Rotation is cheap because distances use footprints only, not facing.

### 3.3 Validity rules (all checked by the sim, same function for UI and commands)

1. **Inside:** the footprint lies inside the grid.
2. **No overlap** with another item.
3. **Pass tiles:** only the Heat Lamp Pass may occupy them, and it must cover exactly both (at most one per kitchen). Without it the pass is a plain shelf.
4. **Work face:** after the change, every item, and the pass, touches at least one free floor tile orthogonally (so a placement that walls in a neighbour is invalid too) (free floor = not occupied and not a pass tile). This is the whole "aisle" rule: cooks can reach every station. **No pathfinding in M0.2**; distances are straight grid distances.
5. **Opening minimum:** at least 1 oven, 1 prep station, 1 cold store and 1 Sink (matches `prd.md` 5.6). Selling the last one of any of these is blocked with the reason.
6. **Sheeter attachment:** a Dough Sheeter works only when it touches (distance 1) a prep station; each station takes at most one sheeter. An unattached sheeter shows "Not attached" and gives nothing.

Invalid placements are never committed. The ghost turns amber with one reason: "Off the kitchen", "Something is already there", "The pass stays clear", "Needs a free tile to work from", "Keep at least one oven".

### 3.4 Reference starter kitchen layout (cosy, 10 x 3)

New games start with an empty kitchen (`fresh-start.md`). This layout is the reference for the `balance.md` section 2 cosy kitchen: tests use it, and the tutorial shows it as a good example.

```
row 0:  P P O O H H S . . .      O Deck Oven (2x2)   P Prep Counter (2x1)
row 1:  . . O O . . . . . .      H pass tiles        S Sink    F Dough Fridge
row 2:  . . P P . . . . . F      back door on the back wall behind F
```

Both counters touch the oven, the oven touches the pass, the sink is 1 tile from the pass: **zero flow penalty**. The fridge sits by the back door (where deliveries arrive), so the cold at hand bonus is not active; every number in `balance.md` section 2 is unchanged. Moving the fridge next to a counter is the tutorial's first optimisation hint.

## 4. Kitchen flow: the optimisation rule

**Distance** `d(A, B)` = smallest `|dx| + |dy|` between any tile of A and any tile of B. Touching items have d = 1. The pass counts as an item made of its two tiles.

```
Prep station output (dishes per hour), per staffed prep station:
  station_prep = 30 x speed x tool_mult x cold_mult x reach_mult

  tool_mult  = max(station prep multiplier, 1.35 if a sheeter is attached)
               Prep Counter 1.00, Marble Bench 1.00, Pizza Prep Fridge 1.15
  cold_mult  = 1.05 if a Prep Counter, Old Workbench or Marble Bench touches a cold store (d = 1), else 1.00
               (the Pizza Prep Fridge is its own cold store; its 1.15 already includes it)
  reach_mult = 1 minus min(0.20, 0.04 x max(0, d_oven minus 2))
               d_oven = distance from the station to its nearest oven

Plate walk (added to cook_time, so it flows into service_time and table_cycle):
  walk_min   = sum over ovens of output_share x min(2.0, 0.2 x max(0, d_pass minus 3))
  cook_time' = cook_time + walk_min

Wash walk:
  plates_per_hour' = plates_per_hour x (1 minus min(0.15, 0.03 x max(0, d_wash minus 4)))
  d_wash = distance from the pass to the nearest Sink or Dish Machine
```

| Tunable (`T.kitchenFlow`) | Unit | Start | Safe range |
|---|---|---|---|
| prepFreeTiles | tiles | 2 | 1 to 3 |
| prepPenaltyPerTile | fraction | 0.04 | 0.02 to 0.06 |
| prepPenaltyCap | fraction | 0.20 | 0.10 to 0.30 |
| passFreeTiles | tiles | 3 | 2 to 4 |
| plateWalkPerTile | game min | 0.2 | 0.1 to 0.3 |
| plateWalkCap | game min | 2.0 | 1.0 to 3.0 |
| washFreeTiles | tiles | 4 | 3 to 6 |
| washPenaltyPerTile | fraction | 0.03 | 0.02 to 0.05 |
| washPenaltyCap | fraction | 0.15 | 0.10 to 0.25 |
| coldAtHandBonus | fraction | 0.05 | 0.03 to 0.08 |

**Why this is safe for balance.** Worst case a layout loses 20% prep, adds 2 minutes of service time and loses 15% dishwashing; best case gains 5% prep on touching counters. Prep is rarely the bottleneck in the reference builds (starter prep 47.5 vs oven 19.4), so the cold bonus changes little, and the auto layout reaches zero penalty for all three reference builds. **Dominant strategy check:** the layout has a known good answer (cluster around the pass), which is intended: it is a puzzle, not an economic lever. Buying extra fridges only helps touching counters, once each, capped at 5%.

## 5. New equipment (extends `balance.md` 1.7)

| Item | Family | Price | Footprint | Effect | Quality mod | Maintenance per week | Unlock | Safe range |
|---|---|---|---|---|---|---|---|---|
| Pizza Prep Fridge with Marble Top | Quality | $3,200 | 2x1 | Prep station (one cook, replaces a counter); x1.15 prep; cold store for touching counters; a sheeter does not stack (higher multiplier applies) | +1 | $25 | Serve 200 guests | x1.10 to x1.25; +1 to +2; $2,800 to $4,000 |
| Dough Fridge | Basic | $600 | 1x1 | Cold store (cold at hand bonus); fridge storage 120 units when F-31 lands | 0 | $0 | Start (migrated saves get one free) | $400 to $1,000 |
| Sink | Basic | $400 | 1x1 | Wash station; dishwashers work here; required to open | 0 | $0 | Start (migrated saves get one free) | $250 to $700 |

* Blurbs: Prep Fridge "Cold dough underneath, cool marble on top. Roll, top, slide to the oven." Dough Fridge "Keeps dough cold and happy. Put it next to a bench." Sink "Where plates come back to life."
* The Prep Fridge is the founder's dough cooler: an early, affordable goal (about day 6 in a Hole in the wall) with a visible quality gain, and a speed gain that matters once prep becomes the bottleneck. The Marble Bench stays the quality pick (+2).
* Fridge and Sink have $0 maintenance so the starter's $60 per week in `balance.md` 2.1 is unchanged.
* The entry items of `fresh-start.md` 4 are also placeable: Second hand Deck Oven 2x2, Old Workbench 2x1 (a prep station).
* Existing items keep all numbers and gain `w x h` from 1.7: Deck, Double Deck, Stone Hearth 2x2; Conveyor 3x2; Wood Fired 3x3; Prep Counter, Marble Bench, Heat Lamp Pass 2x1; Dish Machine 1x2; Sheeter, Proving Cabinet 1x1.
* **Cut from M0.2:** the Walk-in Cold Room stays at v1.0 as specified in `prd.md` 5.5; when it arrives it counts as a cold store.

## 6. Service pipeline panel

A horizontal strip under the floor plan with four stages in pizza order, all in **covers per hour** so they compare directly:

| Stage | Capacity per hour | Source |
|---|---|---|
| Dough and prep | sum of station_prep / prep load per cover | kitchenStats |
| Oven | sum of oven servings per hour | kitchenStats |
| Pass and serve | seat capacity per hour (tables turning; includes cook time, plate walk, serve time) | 5.7 |
| Dishwashing | plates_per_hour' / 3 plates per cover | serviceStats |

* Each stage shows a bar for lunch and one for dinner, the number, and a marker for **last service demand per hour** = service demand / (service hours x U). Before the first service: "No service yet".
* The lowest stage is the **bottleneck**, outlined amber with a warm icon and a one line suggestion: prep "Add a prep station or sheeter, or bring stations closer to an oven"; oven "Add or upgrade an oven"; pass and serve "Add tables or a host, or a Heat Lamp Pass"; dishwashing "Hire a dishwasher, buy a Dish Machine, or move the sink toward the pass". The highlighted stage must match the sim's `ServiceReport.bottleneck`.
* Tapping a stage highlights its stations on the plan and shows the formula breakdown (Detailed numbers setting) or one sentence (Simple).

## 7. Upgrade flow

1. Tap an empty tile. The side sheet lists every catalogue item whose footprint fits with its top left on that tile (either orientation), grouped Ovens, Prep, Cold, Wash and pass, Extras. Items that do not fit anywhere are hidden; locked items show their unlock text.
2. Each row shows price, weekly maintenance and an **impact preview** from the existing `compare()` on the hypothetical state: profit per day, covers per day, pizza Q, and the pipeline stage it raises. If it does not raise the bottleneck stage, it says so ("Your seats are the limit, not the oven").
3. Tap Buy: the item appears at that tile with a snap and puff. If cash is short, the button reads "Need $X more" and, where F-41 exists, offers "Pin as savings goal" (optional in M0.2).
4. Tap a station for Move (drag), Rotate, Sell (80%), or Replace (lists items of the same role that fit the same spot; sells the old one at 80% in the same action).

Moving and rotating are free. The Kitchen tab is build mode: time is paused and changes apply from the next service.

## 8. UI

**Look.** Warm top down greybox: terracotta floor tiles, cream walls, the pass as a wooden hatch with a small bell, back door with crates. Items are rounded rectangles with a clear icon and short label (M0.2 art bar); ovens glow orange, the Prep Fridge shows a marble texture. Flow badges are small chips on each station: green tick when free, amber "-8% walk" when penalised, blue snowflake for cold at hand.

**iPad landscape (primary, 1024 x 768 pt and up).**
* Top: existing HUD and tabs.
* Stage (left, about 70% width): the floor plan, scaled so the widest grid (15 tiles) is at least 44 pt per tile; the cosy grid gets larger tiles. Dining room edge drawn at the top with the pass.
* Side sheet (right, about 320 pt): catalogue for the tapped tile or the station card.
* Bottom of stage: pipeline strip, always visible, about 120 pt tall.
* While dragging: ghost footprint, dotted flow lines from each prep station to its nearest oven and from each oven to the pass, each labelled with its tile count, green within the free distance, amber beyond. A Rotate button floats beside the ghost. One finger throughout; no hover needed.

**Desktop.** Same layout; mouse drag; R rotates, Delete opens sell confirm, Ctrl or Cmd Z undoes. Hover tooltips may add detail but never carry information found nowhere else.

**Phone (best effort).** Plan at 44 pt tiles, scrolls horizontally; side sheet becomes a bottom sheet; pipeline collapses to four chips (stage name and capacity, bottleneck amber) that expand on tap.

## 9. Save migration and auto layout

* `schemaVersion` bumps. Loading an older save runs **auto layout** on its equipment list and adds one Dough Fridge and one Sink for free if missing.
* **Auto layout** (deterministic greedy, also used by Tidy up and by the balance calculator): place the Heat Lamp Pass on the pass; ovens by largest output first, each at the valid spot with smallest d_pass; prep stations by quality first at the smallest d_oven; each sheeter touching a prep station without one; cold stores touching a prep counter if possible; Sink and Dish Machine at the smallest d_wash; everything else at the first valid spot. Candidate spots are scanned row by row, left to right, both orientations; ties keep the first found.
* If an item cannot be placed, it is refunded at **full price** with a one time note ("Your old Proving Cabinet did not fit the new kitchen plan; refunded $3,500"). Cash is otherwise unchanged.
* **Tidy up** shows the auto layout as a ghost with its before and after badges; applying it is free and can be undone.

## 10. Failure and recovery

* A bad layout costs at most a few percent and is fixed by dragging, for free, or by Tidy up.
* Invalid layouts cannot be committed; the last valid state always stands.
* Buying the wrong item costs 20% on resale; Replace makes swapping one action.
* The opening minimum cannot be broken from the builder.

## 11. Out of scope for M0.2

* Pathfinding, cook animation walking the line, per station staff assignment.
* Walk-in Cold Room, hybrid and v1.0 items, kitchen decor, hygiene, heat or fire.
* Storage capacity gameplay for fridges (arrives with F-31).
* Multi location layout blueprints (F-49).
* Undo beyond the current visit to the Kitchen tab.

**Scope risk.** Planned at about one engineering day. If it runs long, cut in this order: phone layout (F-109), Tidy up as a button (keep auto layout for migration), rotation, Replace. Never cut the flow lines while dragging: they are the feature's feedback.

## 12. Acceptance criteria (summary; full rows in `acceptance-criteria.md`, milestone M0.2)

* **AC-134** Given the premises data / When loaded / Then grids are 8x3, 10x3, 12x3, 15x4 with pass tiles at columns 3 and 4, 4 and 5, 5 and 6, 6 and 7 of row 0.
* **AC-135** Given any placement off grid, overlapping, on the pass, or with no free touching tile / When submitted / Then it is rejected with its reason and state is unchanged.
* **AC-136** Given a Conveyor Oven / When rotated / Then it occupies 2x3 and all stats are unchanged if distances are unchanged.
* **AC-137** Given the last oven, prep station, cold store or Sink / When the player sells it / Then it is blocked; any other item refunds 80%.
* **AC-138** Given any item / When moved or rotated / Then cash is unchanged and the new stats apply from the next service.
* **AC-139** Given the reference starter kitchen in the 3.4 layout / When kitchen stats are computed / Then flow penalty is zero and oven 19.4, prep 47.5 match AC-56.
* **AC-140** Given the starter kitchen / When the oven moves 5 tiles right / Then prep capacity falls from 47.5 to 40.9 per hour, oven stays 19.4, bottleneck stays oven.
* **AC-141** Given a station 12 tiles from its nearest oven / When computed / Then reach_mult is 0.80.
* **AC-142** Given one oven 6 tiles from the pass / When computed / Then cook time rises by 0.6 min; in no valid layout by more than 2.0 min.
* **AC-143** Given the nearest wash station 7 tiles from the pass / When computed / Then plates per hour fall by 9%.
* **AC-144** Given the starter / When the Dough Fridge moves to touch one counter / Then prep rises from 47.5 to 48.7 per hour.
* **AC-145** Given the equipment data / When loaded / Then the three new items match section 5.
* **AC-146** Given the starter / When one counter is replaced by a Prep Fridge / Then that station's prep is x1.15 and pizza Q rises by 0.5; with a sheeter attached it is x1.35, not x1.55.
* **AC-147** Given a sheeter touching no prep station / When computed / Then it adds nothing and shows "Not attached".
* **AC-148** Given any older save / When loaded / Then every item has a valid position, a Fridge and Sink exist, unplaceable items are refunded at full price, and the result is identical on every load.
* **AC-149** Given the three reference builds with auto layout / When the balance calculator runs / Then flow penalty is zero, each profit is within 2% of the same build with no flow rules (so the layout itself is neutral) and all `balance.md` 3.5 checks pass. (A zero penalty layout was hand checked for each build; the auto layout must find one.)
* **AC-150** Given the starter build / When the pipeline is computed / Then prep 47.5, oven 19.4, pass and serve about 16.2 lunch and 14.2 dinner (after the `fresh-start.md` meal length retune), and pass and serve is the bottleneck, matching the sim's "seats".
* **AC-151 to AC-158:** demand marker, fit filtered catalogue, impact preview, iPad layout, flow lines, Tidy up, phone, bounded flow effects (see the full table).

## 13. M0.2 definition of done

All AC-134 to AC-158 pass; `npm run balance` shows the flow rules move no reference build by more than 2%; an older save loads into a valid kitchen; the founder can open the Kitchen tab on an iPad, buy a Pizza Prep Fridge with Marble Top by tapping an empty tile, drag it next to the oven and watch the pipeline respond.
