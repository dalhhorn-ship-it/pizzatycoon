# PRD addendum: Fresh Start economy

* Status: Draft 1 for milestone **M0.2** (ships with the Kitchen Builder, `kitchen-builder.md`)
* Owner: Game Product Management
* Date: 2026-09-26
* Supersedes where it conflicts: `prd.md` 5.1 (starter properties with a preinstalled kitchen), 5.11 (starting cash and starter loan), 6.2 (luxury price and covers), 6.3 (minimum viable restaurant), 7 (unlock ladder timing); `balance.md` 1.12 and 2.1
* Features: F-110 to F-117. Acceptance criteria: AC-159 to AC-174
* **All numbers below are hand calculated with the aggregate formulas of `src/sim/day.ts`. They are tuning assumptions until `npm run balance` confirms them (AC-169 to AC-171).**

## 1. Founder requirements and the loop they serve

1. **Empty premises.** A new restaurant starts with nothing: no tables, decor, kitchen equipment or staff, and an empty menu. The recipe book is full; the player chooses what to cook.
2. **Rags to riches.** Very little money. The player must open small to attract the first guests. The first week is tight but never a dead end, and growing to the reference luxury and volume restaurants takes hours of play.
3. **Realistic covers.** Fine dining serves about 40 to 60 dinner covers, a fast turnaround place up to about 180, and only a warehouse sized hall about 250.

**Loops.** Long term gains a real arc: hole in the wall, corner shop, trattoria, specialist. The week loop becomes "which one thing do I buy next", which the Kitchen Builder pipeline answers. The session loop starts with a satisfying setup puzzle on day 1.

**Feeling.** "We started with a second hand oven and five folding tables." Pride in the climb, never panic.

## 2. Day 1: an empty premises

* New game: pick a district and a premises. The deposit is paid and rent starts. Everything else is empty.
* **Opening checklist card** (pinned on the HUD until the first service): each requirement with a tick, the cheapest item that satisfies it and its price, and a total "Suggested opening: $2,920" (the section 7 kit with 6 Folding Tables). Tapping a line opens the right builder with that item highlighted.
* **Opening minimum** (the sim's `closedReason`, extended):
  * at least 1 pizza on the menu
  * at least 1 table
  * at least 1 oven, 1 prep station, 1 cold store and 1 Sink (Kitchen Builder rule 5)
  * at least 1 cook and 1 server
* A dishwasher is **not** required. Without one, the plate stock (90 plates, 3 per cover) limits each service to 30 covers, which a tiny room never reaches. The bottleneck banner says when that changes.
* **Menu:** no minimum. The "at least 4 items" rule is removed (`menu.minItems` 4 to 0); 16 stays the maximum. The tutorial suggests four classics and a soft drink.
* Rent and any hired wages accrue from day 1 whether open or not, so there is a gentle reason to open soon. The mentor says so once, warmly.
* The Day 1 tutorial becomes "set up your pizzeria" (checklist driven) instead of "place tables from a starter pack".

## 3. Premises ladder

The deposit falls from 8 to 4 weeks of rent for every premises (`finance.leaseDepositWeeks` 8 to 4), so moving up is a step, not a wall. Rent per tile per district is unchanged.

| Premises | Dining grid | Kitchen grid | Tiles | Seat limit (0.55 per dining tile) | Rent per week (Univ / Canal / Harbour) | Deposit, 4 weeks (Canal) |
|---|---|---|---|---|---|---|
| **Hole in the wall (new)** | 6 x 5 | 8 x 3 | 54 | 16 | $432 / $594 / $1,026 | $2,376 |
| Cosy corner shop | 10 x 8 | 10 x 3 | 110 | 44 | $880 / $1,210 / $2,090 | $4,840 |
| Neighbourhood trattoria | 10 x 10 | 12 x 3 | 136 | 55 | $1,088 / $1,496 / $2,584 | $5,984 |
| Big hall (warehouse class) | 20 x 11 | 15 x 4 | 280 | 121 | $2,240 / $3,080 / $5,320 | $12,320 |

* Hole in the wall kitchen: pass tiles at columns 3 and 4 of row 0 (the Kitchen Builder formula).
* **Seat limit (new rule, "fire safety"):** seats at most `floor(0.55 x dining tiles)`. Placing a table beyond it fails with "Fire safety: at most 44 seats in this room". The room panel shows "Seats 24 of 44". This is what guarantees requirement 3 (section 6).
* **Move premises (new in M0.2, pulls forward the move part of F-15):** choose a vacant premises in any district; the move happens overnight. The old deposit is refunded in full; the new deposit is paid; furniture and equipment move with you and are placed by the auto layout (dining tables in a simple grid, kitchen by the Kitchen Builder auto layout); anything that does not fit is sold at 80% with a note. Staff, recipes, prices, Rep and unlocks carry over. Rep carries because it is the brand's word of mouth; a district change is still a fresh audience through the district's segment mix.

## 4. Entry level and second hand items

| Item | Kind | Price | Footprint | Effect | Quality mod | Maintenance per week | Unlock |
|---|---|---|---|---|---|---|---|
| Second hand Deck Oven | Oven, basic | $900 | 2x2 | 3 slots, bake x1.0: 15 pizzas per hour at skill 5 | -2 | $30 | Start |
| Old Workbench | Prep station, basic | $300 | 2x1 | prep x0.9 (27 dishes per hour at skill 5) | 0 | $5 | Start |
| Folding Table | Table | $120 | 1x1 | 2 seats; comfort -1 (ambience -1 each) | | | Start |
| Dough Fridge (price change) | Cold store | $600 (was $900 in the Kitchen Builder draft) | 1x1 | cold store | 0 | $0 | Start |
| Sink (price change) | Wash station | $400 (was $600) | 1x1 | wash station | 0 | $0 | Start |

* Resale is 80% as for all items, so upgrading from second hand costs little: selling the old oven returns $720.
* **Why the player upgrades:** the Deck Oven ($2,400) gives +33% oven capacity and +2 quality; a Prep Counter ($1,200) gives +11% prep; a Table for two ($350) removes the comfort penalty. Each is visible in the impact preview.
* **Dominance check:** second hand gear is never the best buy once cash allows, because capacity becomes the bottleneck within the first two weeks and quality drives fair price; it is only the best buy on day 1.
* **First hiring board guarantee:** the day 1 board always offers at least 2 cooks, 2 servers and 1 dishwasher of skill 2 to 4 (weekly salary at skill 3: cook $418, server $342, dishwasher $288.80).

## 5. Money at the start

| Tunable | Old | New | Safe range |
|---|---|---|---|
| starting cash | $40,000 | **$7,000** | $5,000 to $10,000 |
| starter loan maximum | $30,000 | **$5,000** | $3,000 to $8,000 |
| starter loan term | 104 weeks | **52 weeks** ($98.62 per week at the full amount, 5% per year) | 26 to 104 |
| lease deposit | 8 weeks | **4 weeks** | 2 to 8 |

The loan is offered, never pushed. The safety net in `prd.md` 5.11 is unchanged: no bankruptcy, restructure after 7 days below $0.

## 6. Realistic covers: the retune

**Problem found.** Under current tuning the luxury build serves about 38 lunch and **68 dinner** covers, above the founder's 40 to 60 for fine dining. Volume (about 169 dinner) and middle (about 88 dinner) already fit. Nothing stops a crammed room from exceeding 250.

**Changes (tuning guardrail order of `balance.md` 3.7: meal lengths for realism, then budgets B and wealth W):**

| Tunable | Old | New | Why |
|---|---|---|---|
| Foodies meal length, dinner | 60 min | **90 min** | Fine dining evenings are long; luxury dinner falls to about 53 |
| Students meal length, dinner | 25 min | **45 min** | Students linger in the evening; lowers the warehouse ceiling |
| Foodies budget B | $24 | **$28** | Lets luxury charge fine dining prices without losing its foodies |
| Old Harbour wealth W | 1.3 | **1.5** | Same, for tourists and professionals in the harbour only |
| Luxury reference main price | $28 | **$38** (band $20 to $40, was $20 to $34) | Fewer, longer, pricier dinners; the check rises from $42.40 to $52.40 |
| seat limit per dining tile | none | **0.55** | Hard ceiling on covers per premises |

**Expected covers per service (Thursday, steady state Rep; hand estimates):**

| Build | Seats | Lunch | Dinner | Day | Profit per day | Founder target |
|---|---|---|---|---|---|---|
| Hole in the wall opening, Canal (section 7) | 12 | 14 | 20 | 34 | $134 | small |
| Cosy starter, Canal (`balance.md` 2) | 24 | 26 | 41.5 (was 43) | 67.5 | about $349 (was $366) | |
| Middle "Canal Corner" | 56 | about 55 | about 88 | 143 | about $1,100 | |
| Luxury "Trattoria Stella", Old Harbour | 40 | about 26 | **about 53** (was 68) | about 79 (was 106) | **about $2,045** (was $2,064) | 40 to 60 dinner: pass |
| Volume "Slice Hall", University | 120 | about 189 | **about 169** | 358 | about $1,984 (unchanged) | up to 180 dinner: pass |
| Ceiling: Big hall at 121 seats, all students, volume service speed | 121 | | **about 255** | | | about 250: pass |

Luxury in detail: dinner cycle 23.1 + 75.1 min meal = 98.2 min, so 40 seats x 0.75 x 60 / 98.2 = 18.3 covers per hour, x 4.5 h x 0.65 = 53.6. Demand at $38 is about 88 (26 lunch, 62 dinner), so dinner is full and about 9 guests are turned away at the door (no Rep penalty). Money: 79.3 covers x $52.40 = $4,155 sales; ingredients $809; waste $73; staff $701; rent $369; utilities $93; upkeep $65; **profit about $2,045**. Luxury and volume stay within 3%.

Ceilings with the seat limit and volume grade service (17.3 min service, 45 min student dinner): hole in the wall 16 seats about 34 dinner covers; cosy 44 seats about 93; trattoria 55 seats about 116; big hall 121 seats about 255. Nothing below warehouse size can pass 180.

**Honest caveat.** On a Saturday (weekday x1.35) the volume hall's dinner demand is about 228, still under its 255 ceiling. If the founder's 180 means "never, even on Saturday", lower the big hall to about 95 seats; this is open question FS-Q1.

**3.5 checks, expected:** luxury vs volume in their homes 3% apart (pass); middle stays top in Canal Quarter (luxury's best there is limited by the same long dinners); luxury beats the best middle build in Old Harbour by about 40% (middle there rises slightly with W 1.5 to about $1,450); volume in Old Harbour still loses money (its budgets were already capped, so W does not help it). **Risk:** Foodies B 28 could lift luxury's best price in Canal Quarter; if middle loses the top spot there, set Foodies B to 26 first.

## 7. Worked example: the cheapest viable opening

**Set up.** Canal Quarter, Hole in the wall, Monday day 1, Rep 30, no loan.

| Purchase | Amount | Cash |
|---|---|---|
| Starting cash | | $7,000 |
| Deposit (54 tiles x $11 x 4 weeks) | -$2,376 | $4,624 |
| Second hand Deck Oven, Old Workbench, Dough Fridge, Sink | -$2,200 | $2,424 |
| 6 Folding Tables (12 seats) | -$720 | **$1,704** |
| Hire cook skill 3 ($418 per week) and server skill 3 ($342 per week) | paid Sunday | |

Menu: Margherita $11.50, Pepperoni $13.50, Funghi $12.50, Quattro Formaggi $12.50 (average about $12.50, food cost $2.80), soft drink $4 (food cost $0.85). No starters or desserts, so prep load is 1.0.

**One day (Thursday):**

```
ambience       = 25 + 0 decor - 6 comfort                         = 19
Q              = 0.50 x 54 + 0.15 x 70 + 0.35 x (30 + 7 x 3) - 2  = 53.4
fair price     = 4 + 0.08 x 53.4 + 1.5 x 2.80                    = $12.47  (r = 1.00)
server speed   = 0.88 x load_mult 0.85 (6 tables, 1 server)       = 0.748
service time   = 5 + 4.01 + 13.64 cook + 2.01 + 5.35              = 30.0 min
oven           = 3 x 60 / 12 x 0.88                               = 13.2 per hour
demand         = about 60 guests (lunch 23, dinner 37): far above seats
lunch          = 12 x 0.75 x 60 / (30.0 + 40.1 meal) x 3 h x 0.60  = 13.9 covers
dinner         = 12 x 0.75 x 60 / (30.0 + 50.0 meal) x 4.5 h x 0.65 = 19.7 covers
plates         = 30 per service without a dishwasher: not binding
check          = 12.50 + 0.80 x 4.00 = $15.70; cost per cover $3.48
```

| P&L line | Calculation | Amount |
|---|---|---|
| **Sales** | 33.6 covers x $15.70 | **$527.52** |
| Ingredients | 33.6 x $3.48 | -$116.93 |
| Waste | 5% | -$5.85 |
| Staff | $760 / 7 | -$108.57 |
| Rent | $594 / 7 | -$84.86 |
| Utilities | $30 + $0.80 x 33.6 | -$56.88 |
| Upkeep | $15 + $35 / 7 | -$20.00 |
| **Profit** | | **$134.43** |

**Week 1 money flow.** Seats are the limit every day (even Monday's demand of about 48 exceeds 34), so every day looks like Thursday. Daily cash in after ingredients, utilities and upkeep: $327.86. Cash: $1,704 after setup, $3,999 by Sunday evening, **$2,645** after Sunday's rent and wages ($1,354). Week 1 profit **$941**. The lowest point is $1,704 on day 1: tight, never negative. Satisfaction is about 49 (long waits, a bare room), which is still above Rep 30, so Rep climbs to about 39 by day 7.

**Week 2 (the natural next moves the pipeline and banner point to):** 2 more Folding Tables (16 seats, the room's limit) and a second server ($342): about 46 covers and **$223 per day**. **Week 3:** the room is full and the advisor points to the Cosy corner shop: net move cost $2,464 (deposit $4,840 minus $2,376 refunded) plus a dishwasher.

**Break even checks (automated):** the same opening at fair price earns about $134 per day in Canal Quarter and more in University Quarter (rent $432); in Old Harbour it is only about $30 to $70 (rent $1,026 and long foodie dinners), so the harbour stays flagged "ambitious". With only 4 tables (8 seats) it is about $0 in Canal Quarter: the floor, not a dead end, because one Folding Table costs $120 and the advisor says so.

## 8. Growth pacing (estimate; validate in playtests)

Reinvested capital grows about 2% per day at every stage (the reference builds pay back in 45 to 50 days), so $7,000 to the $92,000 reference builds is about 3.7 doublings.

| Stage | Typical game time | Real play time (about 4 min per day) | Profit per day |
|---|---|---|---|
| Hole in the wall opening | days 1 to 7 | 0 to 0.5 h | about $130 |
| Full hole in the wall (16 seats, 2 servers) | days 8 to 20 | 0.5 to 1.3 h | about $220 |
| Cosy corner shop, Deck Oven, dishwasher, host | weeks 3 to 8 | 1.3 to 3.7 h | $350 to $600 |
| Trattoria, middle build | weeks 8 to 16 | 3.7 to 7.5 h | $800 to $1,300 |
| Specialist reference build (luxury or volume) | weeks 16 to 24 | 7.5 to 11 h | $1,800 to $2,100 |

The v1.0 expansion loan (Rep 50) shortens the last two rows by about a third. `prd.md` 7 needs its hour marks moved accordingly.

## 9. Feedback, failure and recovery

* Opening checklist with prices; closed days say exactly what is missing ("Nobody is serving tables. Hire a server.").
* Bottleneck banners name the cheapest fix first ("Seats were full all dinner. A Folding Table costs $120.").
* A player who overbuys on day 1 (for example a Cosy shop with the full loan) is covered by the safety net and by selling at 80%; the premises card warns when weekly rent exceeds a third of starting cash.

## 10. Out of scope for M0.2

* Opening stock and deliveries (ingredients stay paid per cover sold, as in the M0 sim).
* Buying property, lease break fees, chain locations (v1.0).
* Second hand market with random offers; only the three fixed entry items exist.
* Changing `menu_fit` to penalise menus under 5 pizzas (open question FS-Q2).

## 11. Acceptance criteria (summary; full rows in `acceptance-criteria.md`, milestone M0.2)

* **AC-159** New game is empty; cash equals $7,000 minus the deposit.
* **AC-160** Each missing opening requirement keeps the restaurant closed with its reason; rent accrues.
* **AC-161** The cheapest opening in Canal Quarter costs $5,296 including deposit.
* **AC-162** The worked example day gives 33.6 covers (plus or minus 5%) and $134 profit (plus or minus 10%); week 1 profit is positive and cash never falls below $0.
* **AC-163** Break even at fair price in Canal and University Quarters.
* **AC-164** Entry item data; **AC-165** loan terms; **AC-166** first hiring board; **AC-167** move premises; **AC-168** seat limit.
* **AC-169** Covers per service for the reference builds; **AC-170** ceilings; **AC-171** `balance.md` 3.5 checks pass after the retune.
* **AC-172** Growth pacing (playtest); **AC-173** opening checklist UI; **AC-174** second hand upgrade preview.

## 12. Open questions

| ID | Question | Who answers |
|---|---|---|
| FS-Q1 | Is 180 dinner covers a typical day cap or an absolute cap including Saturdays? | Founder |
| FS-Q2 | Should menu_fit count missing dishes as zero, so a one pizza menu attracts fewer guests? | Game design lead |
| FS-Q3 | Does Rep carry over in full on a move to another district, or halve? | Game design lead, after playtest |
