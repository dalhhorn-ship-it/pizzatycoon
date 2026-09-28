# Delivery tab (M0.7)

Food delivery grows from one card in the Money tab into its own place in the game: a **Delivery** tab with four sub tabs, reached through a second layer of tabs on the right side of the screen. The delivery game also goes deeper: a delivery zone, a fleet of four vehicle types, a minimum order, deals that run on chosen days, and a weekly scorecard with graded KPIs and tips.

* Features: F-222 to F-233. Acceptance criteria: AC-311 to AC-336.
* Builds on `competition.md` 6 (delivery), 6.13 (deals, delivery marketing, tips). Numbers here are start values; `src/data/tunables.ts` is what the game uses.

## 1. Problem

Delivery became a full business inside the game (three modes, riders, vehicles, deals, campaigns, an audience, a rating), but all of it sits in one long card at the bottom of the Money tab. Players told us three things:

1. They cannot find it. Delivery unlocks after four weeks, the intro sends them to Money, and the card is below the week summary.
2. They cannot see how it is going. The numbers are for one day; there is no week view that says what is good and what is not.
3. Once it runs, there is little to do. Choosing a mode and a deal is most of the game; riders and vehicles are a single row of buttons.

## 2. Goals and non goals

**Goals**

* G1. Delivery is one tap away from anywhere, and it is obvious where each delivery decision lives.
* G2. The right side of the screen scales to more systems without the tab row overflowing on an iPad.
* G3. Delivery gets real choices in four areas: how you get known (promotion), what you sell and at what price (menu and discounts), how orders reach the door (fleet), and how you know it works (scorecard).
* G4. Every new lever shows its effect on a busy Saturday before the player commits, like the existing deal and throttle previews.
* G5. Old saves load and play the same until the player changes a new setting.

**Non goals**

* A separate delivery menu with its own dishes (dish choice stays shared with the dining room; see open question Q1).
* Rider routing on a map, individual orders or live tracking.
* Dark kitchens as a separate venue type (already possible by renting a small venue and delivering from it).
* New save format version: every new field is optional.

## 3. Personas

* **The optimiser** (prd.md persona 1) wants a scorecard, grades and a clear next lever.
* **The cosy builder** (persona 2) wants to buy scooters and see a fleet, without reading a P&L.
* **The returning player** opens an older save and must find delivery where it moved.

## 4. Two layers of tabs (F-222)

The side panel on the right gets two rows of tabs:

| Layer 1 (group) | Layer 2 (tabs) |
|---|---|
| 🍕 Restaurant | Menu · Kitchen · Room · Squad |
| 🛵 Delivery | Promotion · Menu & deals · Fleet · Scorecard |
| 📈 Business | Rivals · Money |

* The group row is the top row, the tab row sits under it, then the checklist and the panel. Both rows are ARIA tablists.
* Tapping a group opens the tab last used in that group (the first one the first time). The chosen tab is remembered on the device, as today.
* Staged reveal stays: Rivals appears with the first rival or campaign, as before. The Delivery group is always visible; until delivery unlocks, every Delivery tab shows the path to it (reputation, days open, packing station) instead of hiding.
* On phones (under 480 px) both rows shrink their type and padding and scroll sideways rather than wrap.
* The Kitchen tab still switches the stage to the kitchen plan; every other tab shows the dining room.
* The Money tab keeps a one line delivery summary with a button to the Delivery tab. The delivery intro, the coach and the day report tips now lead to the Delivery tab.

## 5. The Delivery tab

Every Delivery tab opens with the same **status strip**: mode, delivery rating with its trend, audience, Top rated progress and yesterday's profit, with Pause or Start on the right. Below the strip each tab has its own content.

Before delivery runs, all four tabs show the **setup** view: what is missing (3 stars, 28 days, a packing station), then the three modes with Start buttons.

### 5.1 Promotion (F-223, F-224)

How people learn that you deliver.

* **Audience funnel**: people in the catchment → share who know you deliver → orders wanted → accepted → delivered, for the last day. The weakest step is highlighted.
* **Where you are listed**: the three modes (Scoot with their riders, Scoot with your riders, own ordering page), with reach and commission side by side. Changing mode is here.
* **Delivery campaigns** inline: Promoted listing, Welcome voucher, Door hangers, Food influencer and Street flyers, each with its cost, its effect and a Saturday preview (orders and profit against now, after its cost). Start and stop renewing from the card. Slots are shared with dining campaigns.
* **Top rated on Scoot**: days at 80 so far, the boost, and what it takes to keep it.

### 5.2 Menu & deals (F-225, F-226, F-227)

What an order costs, what it contains and what it earns.

* **App prices**: the markup above the menu (0 to 20% in steps of 5), with the Saturday effect of the next step.
* **Deals** (existing six) with the Saturday preview each.
* **Deal days** (new): *Every day*, *Mon to Thu* (quiet days) or *Fri to Sun* (busy days). A deal on quiet days fills the oven when it has room and leaves full weekends at full price.
* **Minimum order** (new): *None*, *Low minimum* or *High minimum*. A minimum makes each order bigger (more mains and drinks) and loses some small orders.

  | Minimum | Orders | Mains an order | Drinks an order |
  |---|---|---|---|
  | None | x1.00 | +0 | +0 |
  | Low | x0.93 | +0.2 | +0.15 |
  | High | x0.80 | +0.5 | +0.3 |

* **Packaging**: basic or insulated eco.
* **One order, unpacked** (F-227): the average order of the last day split into food, commission, packaging, rider and vehicle cost, deal given away, and what is left. Shows at a glance whether a deal or the app eats the margin.

### 5.3 Fleet (F-228, F-229, F-230)

How orders reach the door.

* **Riders**: everyone on the payroll with speed, quality and whether they ride today; rider candidates on the market with a Hire button (same hire as the Squad tab). Riders needed at the dinner peak against riders out.
* **Vehicles** (F-229): four types. A rider takes the vehicle that moves the most orders an hour; a rider without a vehicle does not ride.

  | Vehicle | Ride (min) | Orders a trip | Price | Upkeep a week |
  |---|---|---|---|---|
  | Bike | 16 | 2 | $600 | $4 |
  | E-bike | 13 | 2 | $1,200 | $7 |
  | Scooter | 12 | 2 | $1,900 | $12 |
  | Delivery car | 14 | 4 | $7,500 | $45 |

  Buy and sell per type (sell at 80%). With only bikes and scooters, the fleet works exactly as before.
* **Delivery zone** (F-230): how far you deliver.

  | Zone | Neighbouring districts count for | Ride time | Food on arrival |
  |---|---|---|---|
  | Close by | 20% | x0.85 | x1.02 |
  | Standard | 50% | x1.00 | x1.00 |
  | Wide | 90% | x1.30 | x0.96 |

  The zone works in every mode (the Scoot riders ride further too). Wide brings more orders and later, colder food; close by is fast and small.
* **Kitchen limit**: the three throttle presets (Protect rating, Balanced, Max orders) with their Saturday preview and the kitchen stage that limits orders.
* Saturday preview for every change here: orders, minutes at dinner, profit against now.

### 5.4 Scorecard (F-231, F-232)

How delivery is doing, over the last 7 delivery days.

| KPI | Measure | Grade A at | Fix in |
|---|---|---|---|
| On time | Share of orders delivered within the 35 minute promise | 90% | Fleet |
| Food on arrival | Food score of delivery guests | 85 | Menu & deals |
| Value for money | Value score of delivery guests | 80 | Menu & deals |
| Orders fulfilled | Delivered over wanted | 95% | Fleet |
| Delivery rating | Rating at the end of the week | 85 | All |
| Profit per order | Delivery profit over orders | $6 | Menu & deals |
| Audience | Share of the catchment that knows you deliver | 60% | Promotion |

* Each KPI gets a score from 0 to 1 (its measure over the A mark, capped at 1; profit per order counts from -$2) and a grade: A at 1, B from 0.85, C from 0.7, D from 0.5, E below. The week column shows the change against the 7 delivery days before.
* An **overall delivery score** (0 to 100) weights the KPIs: on time 20, food 20, fulfilled 15, rating 15, profit 15, value 10, audience 5.
* **Focus this week**: the lowest graded KPI with one sentence on why and a button to the tab that fixes it.
* **Tips**: the ranked delivery tips (existing, competition.md 6.13), now also covering zone, fleet and minimum order.
* **This week in numbers**: the existing week summary (orders, refused, late dinners, sales, rating, profit).
* With fewer than 3 delivery days, the scorecard says it needs more days and shows what it has.

## 6. Simulation changes

All pure, in `src/sim/delivery.ts` and the day model, and all optional on the save:

| Field on `DeliveryState` | Values | Default when missing |
|---|---|---|
| `zone` | `tight`, `standard`, `wide` | `standard` |
| `minOrder` | `none`, `low`, `high` | `none` |
| `dealDays` | `all`, `weekdays`, `weekend` | `all` |
| `vehicles.ebike`, `vehicles.car` | count | 0 |

* Catchment: `footTraffic + zone.adjacent x sum(neighbour foot traffic)`.
* Rides: every ride (own riders and Scoot riders) x `zone.ride`; food on arrival x `zone.food`.
* Riders: vehicles are ordered by orders an hour; the ride is the mean of the vehicles in use x the speed factor, orders a trip the mean of those vehicles (so bikes and scooters alone give today's numbers).
* Minimum order: wanted orders x `orders`, mains and drinks per order + the table above.
* Deal days: `dealTerms` gives no deal outside the chosen days (weekday Mon = 0).
* Scorecard: `deliveryScorecard(history)` is pure and reads only `DayReport.delivery`.

## 7. Feature list

| ID | Feature | Priority |
|---|---|---|
| F-222 | Two layers of tabs: groups and tabs | Must |
| F-223 | Delivery tab with status strip and setup view | Must |
| F-224 | Promotion: audience funnel, listing, inline delivery campaigns, Top rated | Must |
| F-225 | Menu & deals: markup, deals, packaging | Must |
| F-226 | Deal days and minimum order | Should |
| F-227 | One order, unpacked | Should |
| F-228 | Fleet: riders, hire riders, kitchen limit | Must |
| F-229 | E-bike and delivery car | Should |
| F-230 | Delivery zone | Should |
| F-231 | Delivery scorecard with grades and overall score | Must |
| F-232 | Focus this week and tips linked to the tab that fixes them | Should |
| F-233 | Money tab delivery summary and links to the Delivery tab | Must |

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-311 | The side panel shows a group row (Restaurant, Delivery, Business) above a tab row with the group's tabs |
| AC-312 | Tapping a group opens the tab last used in that group; the first time, its first tab |
| AC-313 | The chosen tab survives a reload on the same device |
| AC-314 | The Rivals tab stays hidden until the first rival or campaign, as before |
| AC-315 | Before delivery unlocks, every Delivery tab shows what is missing; after unlock and before it runs, the three modes with Start |
| AC-316 | Every Delivery tab starts with the status strip: mode, rating and trend, audience, Top rated, last profit, Pause |
| AC-317 | Promotion shows the audience funnel for the last day and highlights its weakest step |
| AC-318 | Delivery campaigns start and stop from Promotion and use the shared campaign slots |
| AC-319 | Each delivery campaign not running shows its Saturday effect on orders and profit after its cost |
| AC-320 | Changing mode from Promotion changes the mode from the next service |
| AC-321 | A deal limited to Mon to Thu gives no discount on a Saturday and does on a Tuesday |
| AC-322 | A high minimum order gives fewer orders and a higher average order than none, all else equal |
| AC-323 | One order, unpacked starts from the average order value and its lines add up to the profit per order |
| AC-324 | Fleet lists riders with who rides today, and rider candidates can be hired from it |
| AC-325 | E-bikes and delivery cars can be bought and sold at 80%; their upkeep is in the weekly delivery costs |
| AC-326 | A rider with a car carries 4 orders a trip; riders take the vehicles that move the most orders first |
| AC-327 | With only bikes and scooters and a standard zone, a save plays exactly as before (same day result) |
| AC-328 | A wide zone brings more wanted orders and longer delivery times than close by, all else equal |
| AC-329 | Every Fleet and Menu & deals setting shows its Saturday effect before it is chosen |
| AC-330 | The scorecard grades seven KPIs from A to E over the last 7 delivery days |
| AC-331 | The overall score is the weighted mean of the KPI scores, 0 to 100 |
| AC-332 | Focus this week names the lowest graded KPI and opens the tab that fixes it |
| AC-333 | With fewer than 3 delivery days the scorecard says it needs more days |
| AC-334 | The Money tab shows a delivery summary line with a button to the Delivery tab |
| AC-335 | The delivery intro and the coach's delivery answer open the Delivery tab |
| AC-336 | Saves from before M0.7 load without migration; missing fields read as standard zone, no minimum, deals every day, no e-bikes or cars |

## 9. Balance notes

* Deal days: a deal on Mon to Thu should earn more a week than the same deal every day for a kitchen that is full at the weekend, and less for one that is not.
* The delivery car should pay for itself only from about 40 orders a day; below that, scooters are better.
* Wide zone should be worth it only with scooters or cars and a good packing station; with bikes it should cost rating.
* High minimum should suit families and professionals (bigger baskets) and hurt with students.
* The delivery balance lane (`tests/balance/delivery.test.ts`) must stay green with the defaults.

## 10. Open questions

* Q1. A separate delivery menu (dishes that travel badly left off) would deepen Menu & deals; it needs a second dish choice model. Proposed for M0.8.
* Q2. Should Top rated need a minimum on time share as well as the rating?
* Q3. Rider shifts (lunch only, dinner only) as a cheaper alternative to full riders.
