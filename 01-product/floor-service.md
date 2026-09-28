# Floor service: faster ways to run the dining room (as built, M0.7)

Founder request: "find ways to have faster service options in the restaurant part, like table seating, no reservations, enable standing bar area components for fast bites."

The dining room had one way to run: a server takes the order at the table and brings the bill, a host (or nobody) seats guests. This adds three levers that trade comfort for pace. The defaults change nothing, so every existing save and reference build plays exactly as before.

## 1. Where it lives

* `FloorPolicy` on each restaurant (`GameState.floorPolicy`, a location key; missing means the defaults). Set with the command `setFloorPolicy`.
* Numbers in `T.floor` (`src/data/tunables.ts`).
* UI: a **Service style** card in the Room tab with two switches and the measured impact of each other choice on profit, guests, dish quality and satisfaction (the usual `compare` preview).

## 2. Service style and bookings

**Ordering: table service (default) or counter service.** At the counter guests order and pay at the till; servers only bring food and clear.

| Effect of counter service | Tunable | Start |
|---|---|---|
| Order time | `counterOrderMult` | x0.35 |
| Pay and bus time | `counterPayMult` | x0.5 |
| Guests each server can look after | `counterServerReach` | x1.4 |
| Service score | `counterServiceScore` | -0.08 |
| Meal length (guests linger less) | `counterMealMult` | x0.85 |
| Starters and desserts ordered | `counterSideAttach` | x0.8 |
| Aperitivi and digestivi ordered | `counterBarAttach` | x0.6 |

A shorter service time also raises lunch demand from segments that value speed (students, professionals), through the existing speed appeal.

**Bookings: reservations, bookings and walk ins (default), or no reservations.**

| | Reservations | No reservations |
|---|---|---|
| Party size fit (share of seats a party fills, 0.75 by default) | -0.05 (`reservationsTableFit`): held tables sit empty | +0.10 (`walkInTableFit`): every table turns at once |
| Share of the door queue guests feel | x0.6 (`reservationsQueueShare`) | x1.15 (`walkInQueueShare`) |
| Guests who give up waiting | x0.5 (`reservationsWalkAway`) | unchanged |
| Demand per segment | students 0.9, professionals 1.05, foodies 1.1, seniors 1.08, tourists 0.95 | students 1.08, families 0.97, professionals 1.02, foodies 0.9, seniors 0.92, tourists 1.06 |

## 3. Standing places for quick bites

A new furniture kind, `standing`:

| Item | Size | Price | Places | Decor |
|---|---|---|---|---|
| Standing high table | 1x1 | $220 | 2 | 0 |
| Window ledge | 2x1 | $280 | 3 | 1 |
| Standing bar counter | 3x1 | $950 | 5 | 3 |

* A standing guest skips being seated and eats in half the usual meal time (`standingMealMult` 0.5, `standingFit` 0.95).
* Only guests happy to stand use them (`standingAffinity`): at lunch students 60%, professionals 50%, tourists 40%, foodies 15%, families 5%, seniors 2%; at dinner fewer. Standing capacity per hour is the lower of what the places can turn and what those guests want.
* Standing capacity adds to the table stage of the pipeline; servers still cover each standing piece like a table.
* Fire safety counts a standing place as half a seat (`standingFireShare`), so a small room can take more guests for quick bites.
* A room with only standing places can open.
* The playback shows guests who like a quick bite at the bar or ledge, staying half as long.

## 4. How it plays (measured, `balance` reference builds, a Thursday)

| Build | Default | Counter service | Reservations | No reservations |
|---|---|---|---|---|
| Volume, University | 385 guests, $1,042 | 407, $1,106 | 364, $881 | 399, $1,154 |
| Middle, Canal | 175, $614 | 181, $604 | 164, $489 | 172, $581 |
| Luxury, Old Town | 54, $118 | 54, $95 | 56, $177 | 53, $72 |

Fast options win for a full, cheap, student heavy pizzeria; reservations win for a quiet luxury room; a middle trattoria is best left as it is. That is the intended shape: no choice is right everywhere.

Tests: `tests/floorService.test.ts`.
