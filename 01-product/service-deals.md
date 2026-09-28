# Lunch and dinner: the restaurant scorecard, set menus and lunch promotions (as built, M0.7)

Founder request: "Restaurant also needs a score card so we can tune for lunch and dinner. Also have promotions to boost lunch vs dinner (e.g. having a three course lunch deal, 3-4-5 course dinner deal), lunch coupons, lunch flyers."

Delivery had a graded scorecard; the dining room had none, and nothing in the game could move lunch without moving dinner too (only the business lunch club). This adds a Scorecard tab to the Restaurant group that grades lunch and dinner side by side, set menus for each service, and two lunch only campaigns. The defaults change nothing: no set menu runs until chosen, and every existing save plays as before.

## 1. Where it lives

* `serviceDeals` on each restaurant (`GameState.serviceDeals`, a location key; missing means none). Set with the command `setServiceDeal { service, deal }`.
* Set menus in `src/data/serviceDeals.ts`, lunch campaigns in `src/data/campaigns.ts`.
* Day model: `src/sim/day.ts` (per service check and food cost), helpers in `src/sim/serviceDeals.ts`.
* Scorecard: `src/sim/serviceScore.ts`; UI in `src/ui/services.ts` (Restaurant · Scorecard).
* Each `ServiceReport` now carries `sales`, `food`, `dealGuests`, `dealGiven` and `deal`, so lunch and dinner can be told apart in money as well as guests.

## 2. Set menus

One set menu per service at most. A set menu is a bundle (the main plus its courses) at a discount off the full price.

| Set menu | Service | Courses beside the main | Discount | Lift | Take | Room it needs | Extra minutes |
|---|---|---|---|---|---|---|---|
| Two course lunch | Lunch | starter | 12% | +10% | 50% | any | 8 |
| Three course lunch deal | Lunch | starter, dessert | 18% | +18% | 45% | any | 15 |
| Three course dinner | Dinner | starter, dessert | 12% | +8% | 35% | ambience 40 | 15 |
| Four course dinner | Dinner | aperitivo, starter, dessert | 15% | +10% | 30% | ambience 55 | 25 |
| Five course tasting | Dinner | aperitivo, starter, pasta, dessert | 18% | +14% | 25% | ambience 70 | 45 |

Lift and take are multiplied by each crowd's appeal: lunch menus pull professionals first (1.0), then seniors, tourists and students; dinner menus pull foodies and tourists; the tasting menu barely reaches students or families. At the counter a set menu sells half as well. Below the ambience it needs, lift and take fall by 1/35 per point, to 10%.

A set menu needs a dish of every course kind on the menu; if one is taken off, the set menu pauses (the UI says why) and the command refuses to start it.

## 3. How a set menu plays

For each crowd and service with a set menu:

* Demand at that service x (1 + lift x appeal).
* A share `take x appeal` (at most 85%) orders the bundle. They pay the bundle price instead of their usual main and extras: courses they would have ordered anyway get cheaper, courses they would not have ordered get sold. The check per guest usually rises; the margin per guest falls.
* Each extra course sold costs its food; starters and desserts load the prep line, a pasta course loads it like a main.
* The table stays `take x extra minutes` longer on average, so a set menu at a full service can lose guests.
* Value for money improves by the share given away.

**Lunch coupons** (campaign): guests reached pay less for mains at lunch (20% off for holders, about 7% across lunch), counted in `dealGiven`.

## 4. Lunch promotions

| Campaign | Cost a week | Lift | Who | Unlock |
|---|---|---|---|---|
| Lunch flyers | $80, scaled by foot traffic | +12% at lunch | professionals most, then students and seniors | from the start |
| Lunch coupons | $60, scaled | +25% at lunch, mains about 7% cheaper at lunch | students, professionals, seniors most | day 8 |
| Business lunch club (existing) | $250, scaled | +20% professionals at lunch | professionals | 500 guests |

Each uses a campaign slot. Rivals do not use the two new ones.

## 5. The scorecard

Lunch and dinner over the last 7 open days (older days keep only totals). Five KPIs per service, each scored against its A mark and graded A to E as the delivery scorecard is:

| KPI | Weight | A at lunch | A at dinner | Fix |
|---|---|---|---|---|
| Seats filled (served / capacity) | 25 | 75% | 85% | set menus and promotions on this tab |
| Guests served (served / came) | 20 | 95% | 95% | the tab of the most frequent bottleneck |
| Ticket time | 15 | 12 min | 12 min | Kitchen |
| Check per guest | 20 | 1.35x the average main | 1.7x the average main | set menus |
| Margin after food | 20 | 68% | 68% | Menu |

The focus card names the weakest KPI across both services. Under it: guests, sales, sales after food, set menu guests and money given away per day for each service, and the limit. Each set menu and lunch promotion shows a week's forecast (lunch or dinner guests, profit) against now.

## 6. Balance notes

Measured on the reference builds (a week, before campaign cost): promotions pay where seats are empty and cost money where the service is full. A volume pizzeria in the Business District gains about $400 to $750 a week from a lunch deal, lunch flyers or coupons; a full luxury room in the Old Town loses money on every set menu. That is the point of the scorecard: seats filled says whether demand or capacity is the problem.

## 7. Features and acceptance

* F-237 Restaurant scorecard. AC-345: lunch and dinner are graded side by side on five KPIs over the last 7 open days, with a focus naming the weakest. AC-346: lunch and dinner sales add up to dining sales.
* F-238 Set menus. AC-347: a three course lunch lifts lunch guests and the lunch check and leaves dinner alone. AC-348: more dinner courses keep tables longer; the tasting menu draws foodies. AC-349: a set menu needs its courses on the menu.
* F-239 Lunch flyers and coupons. AC-350: both lift lunch only; coupons lower the lunch check.

Tests: `tests/serviceDeals.test.ts`; the smoke suite opens the tab.
