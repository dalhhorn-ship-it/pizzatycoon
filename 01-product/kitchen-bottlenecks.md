# PRD addendum: Kitchen bottlenecks and capacity

* Status: Built for milestone **M0.4** (founder requests of 2026-09-27)
* Owner: Game Product Management
* Date: 2026-09-27
* Extends: `kitchen-builder.md` (stations, flow, pipeline), `kitchen-upgrades.md`, `staff-management.md` (people on the rota)
* Code: `src/sim/analysis.ts` (`stationsOf`), `src/sim/day.ts` (cold storage, plate stock), `src/sim/capacity.ts`, `src/ui/capacity.ts`. Tests: `tests/stations.test.ts`
* Features: F-169 to F-177 in `features.md`. Acceptance criteria: AC-276 to AC-285 in `acceptance-criteria.md`
* Founder decision (2026-09-27): "find a way to also develop kitchen bottlenecks": the kitchen is developed like the team, by the player or, when handed over, by the manager within a kitchen budget (section 5).

## 1. Goal

Founder requests:

* "I have opened this huge restaurant, I would expect I would hit several bottlenecks faster (e.g. having one sink for 3 chefs), relatively small kitchen. Make this more fine grained, add in more kitchen upgrades, make the subtle bottlenecks between equipment and staff more common, give feedback in weekly report."
* "Per restaurant clearly indicate what max capacity looks like for lunch and dinner and how far we get each day so we know what we can influence with promotions, price, quality, give pointers of most important drivers for this."

Before this change a sink only had to exist, washing capacity came from the number of dishwashers alone, one cook kept any number of ovens busy, fridges had no capacity and a packed kitchen cost nothing. A 96 seat hall on a small kitchen ran smoothly. Now equipment and people have to match, and the game says where they do not.

* **Loops served:** week (buy the right station, hire or let go the right person) and session (read capacity, decide between fixing the kitchen and filling the room).
* **Design intent:** every constraint is quiet for a kitchen that is set up for its team. The three reference builds of `balance.md` 3.1 show no station issues and keep their strategy results. Constraints show up when a restaurant grows faster than its kitchen.

## 2. Station constraints

| Constraint | Rule | Effect when broken | Tunable (`T.stations`) |
|---|---|---|---|
| Oven tending | Each oven needs part of a cook: deck, stone hearth 0.5; double deck 0.6; conveyor 0.25; wood fired 1. Each cook on the rota gives 1 (alongside prep). | Every oven runs at cooks / need (at most 100%). | `tendPerCook` 1, `defaultTend` 0.5 |
| Wash points for cooks | Sinks, the dish machine and a hand wash station are wash points (a double sink counts 2). Each serves 2 cooks. | Each cook beyond: prep 6% slower (at most 30%). | `cooksPerWashPoint` 2, `washStrainPerCook` 0.06, `washStrainCap` 0.3 |
| Dishwashing slots | A sink or a dish machine has room for 2 dishwashers, a double sink 3. The fastest take the places. | The rest stand idle (paid, washing nothing). | equipment `washers` |
| Kitchen crowding | Cooks work at stations, as in a real line: a counter or bench gives one working place per tile of length, an oven, sheeter or pass one; a dishwasher works at a wash station. Each of them stands on one free tile in front of the station. People beyond those places need 2.25 free tiles of aisle each (free floor = kitchen tiles minus 2 for the pass, minus every station's footprint). Changed in M0.6 after founder feedback: a small kitchen runs several cooks shoulder to shoulder. | Each person beyond: everyone 5% slower (at most 25%). | `placesPerCounterTile` 1, `placesPerStation` 1, `tilesPerPerson` 2.25, `crowdPerPerson` 0.05, `crowdCap` 0.25 |
| Cold storage | Fridges hold dough for a number of pizzas a day: dough fridge 200, prep fridge 80, reach in 350, walk in 700. The day's dough is shared between lunch and dinner as the rest of the line could sell it. | Guests beyond it are turned away (a stock out, not a slower ticket). New pipeline stage and bottleneck "dough in the fridges". | equipment `coldCap` |
| Plate stock | 90 clean plates to start a service, plus 90 per Plate Shelving. | Clean plates run out sooner in a rush. | equipment `plateStock` |

## 3. New kitchen upgrades

| id | Name | Role | Price | Size | Upkeep a week | Unlock | Effect |
|---|---|---|---|---|---|---|---|
| doubleSink | Double Sink | sink | $1,200 | 2x1 | $5 | Day 5 | Room for 3 dishwashers; 2 wash points |
| handWash | Hand Wash Station | handwash | $300 | 1x1 | $0 | Start | 1 wash point for cooks |
| reachInFridge | Reach in Fridge | cold | $1,800 | 1x2 | $10 | Serve 200 | Dough for 350 pizzas a day; cold at hand |
| walkInCooler | Walk in Cooler | cold | $6,500 | 2x2 | $40 | Serve 1,000 | Dough for 700 pizzas a day; cold at hand |
| plateShelving | Plate Shelving | storage | $350 | 1x1 | $0 | Start | 90 more clean plates |

The volume reference build now includes a Walk in Cooler: 440 covers a day do not fit in one dough fridge.

## 4. Feedback

* **Kitchen floor plan badges:** "N% tended" on ovens, "N idle" on a full sink, "cooks queue" on the sink or hand wash station, "200/day" on fridges.
* **Kitchen tab, Stations card:** each issue in plain words with its fix, most severe first.
* **Kitchen tab, Capacity card:** for an average day of the coming week, lunch and dinner as bars (capacity, served, and a marker for guests who want in), "N% of capacity used; M more guests would fit" or "full, the limit is X", one summary (demand is the limit, capacity is the limit, or mixed), the fix for a full service, the last seven days as served of possible per service, and **levers**: mains 10% cheaper, mains 10% dearer, +5 dish quality, +5 reputation, each measured on the real day model as guests and profit per day, sorted by profit. Promotions join the levers with marketing campaigns (`competition.md`).
* **Pipeline strip:** a fifth stage, dough in the fridges.
* **Day report:** one line, "Lunch 23 of 40 possible · Dinner 93 of 160 possible", with the limit when a service was full.
* **Week report, Kitchen and capacity card:** capacity used at lunch and dinner, guests turned away, how many services each limit held back, the top station issues, and up to two pieces of advice (the main limit and its fix, the worst station issue, or "a demand question, not a kitchen one" when a service used under 70% of capacity).

## 5. Developing the kitchen: the player or the manager

Bottlenecks are something to grow out of, week by week, in the same way as the team:

* **The player** reads the Stations card and the week report, and each warning names its fix and price.
* **The manager**, at a managed restaurant or when the team is handed over, fixes the worst station issue each Sunday, one step a week, within the **kitchen budget** policy ($0, $500, $1,500 or $5,000 a week; default $500). Order of priority:

| Issue | What the manager does |
|---|---|
| Ovens not fully tended | Hires a cook from the market (hiring focus and accuracy as for any hire) |
| Fridges more than 90% used by the last day's pizzas | Buys a Reach in Fridge (or a Dough Fridge before it unlocks) |
| Clean plates ran out | Buys a Double Sink when a dishwasher stands idle, otherwise Plate Shelving |
| A dishwasher with no room at the sink | Buys a Double Sink |
| Cooks queue at the sink | Buys a Hand Wash Station |

* The item goes where the Kitchen Builder's own placement would put it; if nothing fits, nothing is bought. Crowding is never fixed automatically: it needs a decision about which station to give up.
* The weekly manager line lists what was done ("bought a Hand Wash Station because cooks queue at the sink"); when the fix costs more than the budget, the proposal says so ("The kitchen needs a Reach in Fridge ($1,800): the fridges are nearly out of dough by closing. A bigger kitchen budget would let me buy it.").

## 6. Staff value and reputation

The Team card's value against a standard hire now includes the reputation a person's work earns: satisfaction difference x `reviewSlope` x what one reputation point adds to the day's profit here. Without it, a better cook in a room that is not full looked worthless, because better food pays back through reputation rather than same day covers.

## 7. Balance

* Reference builds: no station issues (`tests/stations.test.ts`), strategy checks of `balance.md` 3.5 pass, course paybacks stay in band.
* A big hall on a modest kitchen (3 deck ovens, 3 counters, 1 dough fridge, 1 sink, 3 cooks, 3 dishwashers) shows one idle dishwasher, prep 6% slower from the shared sink, and a 200 pizza a day ceiling.

## 8. Save migration

A save gains nothing new except the manager's `kitchenBudget` policy (default $500 when missing). Every other new field is on equipment data, and old kitchens simply get checked against the new rules. A large restaurant with one fridge may now meet the dough limit on busy days; the reports say so and name the fix.
