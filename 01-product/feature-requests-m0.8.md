# Feature requests: money pressure, random events and deeper delivery (M0.8 candidate)

* Status: **Request, not scoped for build yet.** Nothing here is built; the numbers are proposals for balancing, not tunables.
* Owner: Game Product Management
* Date: 2026-09-28
* Extends: `prd.md` 1.1 (pillars) and 6 (economy, finance); `competition.md` 6 (delivery); `delivery-tab.md` 5.2 (delivery menu), 5.3 (fleet) and 5.4 (scorecard); `kitchen-bottlenecks.md` (stations, wash points); `city-map.md` (fire safety)
* Proposed IDs: features **F-237 to F-254**, acceptance criteria **AC-345 to AC-376** (the next free numbers after `fresh-start.md` 13). They move into `features.md` and `acceptance-criteria.md` when a request is taken into a milestone.

## 0. Founder request

> (1) Loan Shark loans, ability to loan additionally money but then against 15% to 25% interest
> (2) Random event engine (bit like Monopoly) to get e.g. food service inspection and pay a fine, need to get something repaired, to happen at random every X weeks. Invest 20 events. To kick in after day 100.
> (3) Food delivery menu to allow up to 20 items (bringing high complexity to the kitchen, but also wider audience)
> (4) Aggregator platform take rate / commission elasticity (also based on competitors) for food delivery
> (5) Refund and Fraud Management policies
> (6) Fleet items break down, maintenance upkeep slider, lower maintenance means broken vehicles and missed delivery uptick

## 1. Why these six belong together

The mid game (roughly day 60 onward) has a flat stretch: once the kitchen is tuned and delivery runs, few decisions carry risk and cash only goes up. All six requests add **pressure and trade offs** to that stretch:

| Request | Adds | Main loop |
|---|---|---|
| 1 Loan shark | Fast, expensive money when the bank says no | Long term (expansion), rescue |
| 2 Random events | Surprises that test cash reserves and upkeep | Week |
| 3 Wide delivery menu | Reach against kitchen complexity | Week |
| 4 Commission elasticity | A delivery margin that moves with the market | Week, long term |
| 5 Refunds and fraud | A policy choice between rating and margin | Week |
| 6 Fleet upkeep | A running cost you can starve, at a price | Day, week |

They also feed each other: a wide menu (3) makes more wrong orders, wrong orders cost refunds (5), broken vehicles (6) make missed orders and refunds too, a breakdown can arrive as an event (2), and a player short of cash for the repair may call the loan shark (1).

### 1.1 Design guardrails (from `prd.md` 1.1)

* **Cosy, never punishing.** No event, loan or breakdown can end the game. Every setback shows its cause and at least one answer the player can afford.
* **Every number explains itself.** Each fine, repair, refund and commission line is tappable and says why.
* **Opt out where it is about taste.** Random events and the loan shark have a setting (off, gentle, standard, harsh). Existing saves load with the new systems at *gentle* and a one time note.
* **Old saves play the same until the player changes a new setting**, except random events, which start after day 100 of the save (or 14 days after loading if the save is already past day 100).

---

## 2. Loan shark (F-237, F-238)

### 2.1 Idea

The bank offers the starter loan and, from Rep 50, the expansion loan (balance.md: 12 x average weekly profit, capped at $150,000, 6%). When the bank will not lend more, a friendly but expensive private lender, **"Quick Cash Carlo"**, offers money anyway at 15% to 25% interest. It is the fast answer to "I found the perfect venue and I am $8,000 short" or "the oven died and payday is Sunday".

### 2.2 When he appears

* Unlocks after day 30 (so he is not a shortcut in the opening).
* Always available from the Money tab under Loans, below the bank's offers, with a small warning badge.
* The bank advisor restructure (prd.md 6, cash below $0 for 7 days) mentions him as the last option, never as the first.

### 2.3 Offer

| Term | Amount | Interest (flat over the term) | Repayment |
|---|---|---|---|
| Size | $1,000 to 4 x average weekly sales of the last 4 weeks, capped at $50,000 | | |
| Short | | 15% to 20% | 8 weeks, weekly, Sunday |
| Long | | 20% to 25% | 16 weeks, weekly, Sunday |

* **Interest is flat** (a $10,000 short loan at 18% repays $11,800, $1,475 a week). This reads the request literally and makes the price obvious; see Q1.
* **The rate within the band** is set by risk: start at the low end, +2 points if cash is below $0, +2 if the 4 week average profit is negative, +1 per loan shark loan already open, capped at the top of the band.
* At most **2 loans open** with him at a time. Total owed to him is capped at 6 x average weekly sales.
* The offer sheet shows: amount, total to repay, weekly payment, the rate and why ("+2: you lost money over the last 4 weeks"), and the same amount from the bank if the bank would lend it.

### 2.4 Repaying and missing payments (F-238)

* Payments are taken on Sunday with rent and wages.
* **Early repayment** at any time saves half of the interest not yet due (he is generous, up to a point).
* **A missed payment** (cash below the payment on Sunday):
  1. The payment rolls into next week with a 10% late fee on the missed amount.
  2. After 2 missed weeks: "Carlo's cousin" collects in person. From then on 20% of each day's sales go to him until the arrears are paid; a one line note in the day report, no reputation loss.
  3. After 4 missed weeks: no new loans from him for 26 weeks, and the bank advisor steps in with a restructure that covers his loan too.
* Nothing he does hurts staff, guests or reputation. The cost is money and pride.

### 2.5 UI

* Money tab, Loans card: bank loans first, then the loan shark row with the rate band and "Why so expensive?" explaining the risk points.
* A payback chart on each open loan (paid, interest, still owed).
* The week report lists loan shark payments as their own line, in red.

### 2.6 Balance intent

* Borrowing from him to buy a station that pays for itself in under 10 weeks should be worth it; borrowing to cover running losses should make things worse.
* A disciplined player should never need him; he is a tool for speed and rescue.

---

## 3. Random event engine (F-239, F-240, F-241)

### 3.1 Idea

Like a Monopoly chance card: every few weeks something happens to the restaurant. Most are setbacks (an inspection, a repair), some are windfalls. They start **after day 100**, once the player has a stable business and some reserve.

### 3.2 Engine (F-239)

* **Start:** day 101 of the save. A one time card the day before: "Running a restaurant is never quiet for long. From tomorrow, surprises can happen."
* **Rhythm:** after each event, the next one is drawn between **X and 2X weeks** later, on a random day. X is set in the settings:

  | Setting | X (weeks) | Average events per 10 weeks | Share of good cards |
  |---|---|---|---|
  | Off | | 0 | |
  | Gentle | 3 | about 2 | 50% |
  | Standard (default) | 2 | about 3 | 40% |
  | Harsh | 1 | about 6.5 | 30% |

* **Drawing a card:** each card has a weight that depends on the state of the restaurant (a spotless kitchen is rarely fined, an old oven breaks more often). Cards that do not apply are skipped (no delivery card without delivery). The same card cannot come twice in a row, and at most once per 6 weeks.
* **Size:** costs are scaled to the restaurant: `cost = base x clamp(weekly sales / 5,000, 0.5, 4)`, so a hole in the wall pays a small fine and a busy restaurant a bigger one. No single card costs more than 1.5 weeks of average profit, or $500 if profit is negative.
* **Choices:** most cards offer 2 choices (pay now, or take the slower, cheaper way). The event pauses the game until chosen, like staff notices do.
* **Chains:** each restaurant rolls its own events; the engine draws one card for the chain at a time.
* **Pure and seeded:** events are drawn in the day model with the save's seed, so the same save and the same choices give the same events (ADR 002).

### 3.3 The deck: 20 cards (F-240)

Costs are for a restaurant with $5,000 weekly sales (scale factor 1).

| # | Card | Type | What happens | Choices | Makes it more likely | Makes it less likely |
|---|---|---|---|---|---|---|
| 1 | Food safety inspection | Bad | The inspector checks hygiene | Pass: nothing. Fail: fine $400 to $1,200 and Rep minus 2 | Few wash points, dishwashing over capacity, old stock | Wash points, a Sink per station, low waste |
| 2 | Oven breakdown | Bad | One oven stops | Express repair $900 (fixed tomorrow) or standard $450 (3 days at half capacity) | Second hand ovens, oven load above 90% | Thermostat tune up, new ovens |
| 3 | Fridge failure | Bad | A cold store fails overnight | Lose its stock, repair $500 | Cold store over 90% full, old fridge | A second cold store |
| 4 | Burst pipe | Bad | Water in the dining room | Close 30% of seats for 2 days or pay $700 to fix today | Large rooms, cheap venues | |
| 5 | Power cut | Bad | Dinner service ends 1 hour early | Rent a generator $250, or lose the hour | | |
| 6 | Dishwasher breakdown | Bad | Washing capacity halves | Repair $350 today or hand wash for 2 days (slower tables) | Dishwashing over capacity | |
| 7 | Fire safety audit | Bad | Checks fire safety (city-map.md) | Pass: nothing. Fail: $600 fine and 1 day closed until fixed | Missing extinguishers, crowded kitchen | Full fire safety |
| 8 | Guest falls ill | Bad | A guest blames the food | Offer a gesture $150 (Rep minus 1) or dispute it (50% chance of nothing, 50% of Rep minus 4) | Low tier ingredients, long stock age | Premium ingredients, fresh stock |
| 9 | Supplier price spike | Bad | Cheese costs 25% more for 2 weeks | Pay it, or switch tier for 2 weeks | | |
| 10 | Late supplier | Bad | Tomorrow's delivery comes after lunch | Emergency buy at +40% or run lunch with what is there | Low stock buffer | Larger dry store |
| 11 | Flu week | Bad | 1 or 2 staff off sick for 3 days | Hire temp cover at 1.5x wage or run short | Low morale, overtime | Good mood, managers |
| 12 | Break in | Bad | A window is smashed overnight | Replace $600 | Districts with low safety | |
| 13 | Road works | Bad | Foot traffic minus 20% for 1 week; delivery rides +15% | Put up a sign $100 (halves the traffic loss) or wait | | |
| 14 | Tax review | Bad | The accountant finds a mistake | Pay $300 now | | |
| 15 | Street festival | Good | Foot traffic +40% for a weekend | Extend opening hours (+wages) or not | | |
| 16 | Food critic visit | Good or bad | A critic eats tonight | Nothing to choose: Rep +3 if tonight's food score is 75 or more, minus 2 below 60 | | |
| 17 | Viral post | Good | A guest's photo takes off | Following +10% of the catchment's students for 2 weeks | High presentation score | |
| 18 | Rainy week | Mixed | Dining minus 15%, delivery orders +25% for 1 week | | | |
| 19 | Big match night | Good | Delivery orders +50% one evening | Add a rider for the night $60 or not | Delivery running | |
| 20 | Insurance payout | Good | An old claim pays out | Cash + $500 | | |

Notes:

* Cards 2, 3 and 6 are the "need to get something repaired" cards. Card 2 also exists for vehicles when fleet upkeep (section 7) is live; that one is not in the deck, because breakdowns there come from vehicle condition.
* The deck is data (`src/data/events.ts`, ADR 004) so cards can be added and tuned without engine changes.

### 3.4 Presentation and history (F-241)

* The card slides in at the start of the day it happens, with an illustration, the cost, the choices and "Why me?" listing what made it more likely.
* An **event log** in the Business group lists every card drawn, the choice and the cost, with the running total of good against bad this game.
* The week report gets an "Events this week" line.
* The coach adds one tip after a bad card it could have prevented ("Two wash points more would have passed the inspection").
* Settings, Game group: Random events Off, Gentle, Standard, Harsh; changing it takes effect from the next draw.

---

## 4. Delivery menu of up to 20 items (F-242, F-243, F-244)

### 4.1 Idea

Today the delivery menu is the best selling mains, 3 up to 24 of them, chosen by a slider (`delivery-tab.md` 5.2, F-234). The request is a **hand picked** delivery menu of **up to 20 items across every dish kind**: pizzas, primi, secondi, starters, desserts and drinks. It answers `delivery-tab.md` Q1. A wide menu reaches more people but loads the kitchen with complexity.

### 4.2 Building the menu (F-242)

* Menu & deals tab: a list of every dish on the dining menu with a toggle "on the app". Up to **20 items**, at least 3 mains.
* An **Auto** switch keeps today's behaviour (best selling mains by the slider), so old saves play the same.
* Each dish shows a **travel score** (how well it arrives): pizza 1.00, primi 0.95, desserts 0.95, drinks 1.00, starters 0.90, secondi 0.85; fried or dressed items could carry their own score in `recipes.ts`.
* Guests can now add a starter, dessert or drink to an order when one is on the delivery menu: each adds to the basket (starters 25%, desserts 20%, drinks 40% of orders when present, before deals).

### 4.3 Complexity (F-243)

Every item on the app is another box, another set of ingredients held ready and another chance to get it wrong.

| Effect | Formula (n = items on the app) | 8 items | 12 items | 16 items | 20 items |
|---|---|---|---|---|---|
| Kitchen work per order | 1 + 0.025 x (n above 8) | x1.00 | x1.10 | x1.20 | x1.30 |
| Wrong or missing item rate | 2% + 0.4 points per item above 8 | 2.0% | 3.6% | 5.2% | 6.8% |
| Extra prep time before service | 4 min per item above 8 | 0 | 16 min | 32 min | 48 min |
| Waste of held ingredients | +1.5% food cost per item above 8, delivery only | 0 | +6% | +12% | +18% |

* Wrong or missing items become refunds (section 6) and lower Food on arrival.
* A strong kitchen can soften this: each point of average cook skill above 60 takes 1% off the wrong item rate (relative), and a second packing station halves the extra prep time.

### 4.4 Wider audience (F-244)

* **Reach by variety:** orders x `(distinct dish kinds / 3)^0.3`, capped at 6 kinds. A menu of only pizzas reaches less than one with pasta, a dessert and drinks.
* **Segment fit:** a vegetarian main lifts orders from students and foodies by 5%; a dessert lifts families by 8%; a secondo lifts professionals by 5%. Shown as "who this menu speaks to" chips.
* Word of mouth keeps the existing `(size / 8)^0.5` from F-234.
* The Saturday preview shows orders, basket size, kitchen load, wrong item rate and profit against the current menu while toggling.

---

## 5. Aggregator take rate and commission elasticity (F-245, F-246, F-247)

### 5.1 Idea

Today the platform commission is fixed: 30% on Scoot with their riders, 14% with your riders, 0% on your own page (`T.delivery.commission`). Real platforms move their take rate with their leverage. The request makes the commission **respond to the market and to the player's strength**, and gives the player tiers and deals to negotiate.

### 5.2 Dynamic take rate (F-245)

Recomputed each Monday for the week ahead:

`rate = base x leverage x strength`, clamped to 20% to 38% (platform riders) and 9% to 20% (own riders).

* **Leverage** (competitors on the app): `1 + 0.25 x (rival share of delivery orders in the catchment minus 0.5)`. When rivals do most of the app's business the platform needs you less and charges more; when you are the big name it needs you.
* **Strength** (your volume and rating): minus 1 point for every 100 orders a week above 200, minus 1 point at delivery rating 85 and above, capped at minus 5 points.
* **Second platform:** when a rival aggregator is active (5.4), both platforms charge 3 points less.
* The Promotion tab shows the rate for this week, its trend and the three reasons, with next week's forecast.

### 5.3 Listing tiers (F-246)

The player picks a tier on the platform; the tier trades commission for visibility:

| Tier | Commission change | Reach | Notes |
|---|---|---|---|
| Lite | minus 6 points | x0.75 | Lower in search, no promotions |
| Standard | 0 | x1.00 | Today |
| Plus | +5 points | x1.20 | Top of search in your district, eligible for app wide promotions |

**Elasticity** is shown as the Saturday preview: orders, commission paid and profit per tier, so the player sees when more reach no longer pays for the higher take rate.

### 5.4 Second platform and exclusivity (F-247)

* From day 120 (or when 4 or more rivals deliver), a second aggregator, **"Dash & Dine"**, enters the city with a launch offer (commission 18% for 8 weeks) and a smaller audience (60% of Scoot's).
* The player may list on one, both or neither (plus the own page). Listing on both splits orders by reach with a 15% overlap and costs the weekly listing fee twice.
* **Exclusivity deal:** a platform offers minus 4 points for a 12 week commitment to list only with them. Breaking it early costs a fee of 2 weeks of average commission.
* Rivals follow the same rules; the Rivals tab shows who lists where.

---

## 6. Refund and fraud management (F-248, F-249, F-250)

### 6.1 Idea

Some delivery orders go wrong (late, cold, missing items, never arrived) and some complaints are not honest. Today a bad order only lowers the delivery rating. The request adds **refunds as a cost** and a **policy** that trades money against rating, plus fraud the player can fight.

### 6.2 Refund policy (F-248)

Set on the Menu & deals tab:

| Policy | Refunds paid | Delivery rating effect of a bad order | Fraud claims |
|---|---|---|---|
| Strict | Only proven problems, 50% of the order | x1.5 | x0.5 |
| Fair (default) | Claims with a reason, 100% of the item | x1.0 | x1.0 |
| Generous | Every claim, 100% of the order plus a voucher | x0.5 | x2.0 |

* **Honest claims** come from real problems: wrong or missing items (4.3), late orders beyond 45 min, food on arrival below 50, missed deliveries (7.3).
* **Who pays:** on the platform with its riders, the platform refunds the guest and charges you 100% when the kitchen is at fault, 0% when their rider is late. With your own riders you pay every refund.

### 6.3 Fraud (F-249)

* **Base fraud rate:** 1.0% of orders claim "never arrived" or "missing item" dishonestly, x1.5 in student heavy districts, x policy factor, and rising 0.2 points for each week the player refunds without checks (fraudsters talk).
* **Controls** the player can switch on (each with a cost):

  | Control | Cost | Effect |
  |---|---|---|
  | Photo on delivery | Rides +1 min | Never arrived fraud minus 70% |
  | Sealed bags | +$0.15 per order packaging | Missing item fraud minus 50% |
  | Block repeat claimers | Free | Fraud minus 30%, but 5% of honest repeat claimers are blocked (rating minus 0.5 a week) |
  | Call back before refund over $40 | 10 staff minutes per claim | Fraud on large orders minus 60% |

* **Card chargebacks in the dining room:** 0.2% of card payments come back as chargebacks at high tiers; a small fixed line, no controls, for realism.

### 6.4 Refund report (F-250)

* Scorecard gets a new KPI **Refunds**: refunds as a share of delivery sales, grade A at 2% or less.
* One order, unpacked (F-227) gets a Refunds line.
* A weekly split: honest (by cause) against suspected fraud, and what each control saved.

---

## 7. Fleet breakdowns and a maintenance slider (F-251, F-252, F-253)

### 7.1 Idea

Vehicles today cost a fixed upkeep a week and never fail (`delivery-tab.md` 5.3). The request gives each vehicle a **condition** that wears with use, and a **maintenance slider**: spending less saves money now but breaks vehicles, and broken vehicles mean missed deliveries.

### 7.2 Condition (F-251)

* Each vehicle has a condition from 0 to 100, starting at 100 when bought (second hand vehicles could start at 70; see Q7).
* **Wear per day** = trips that day x wear per trip (bike 0.10, scooter 0.12, car 0.08) x zone ride factor, minus the maintenance repair (7.3).
* **Breakdown chance per day in use** = `0.2% + 4% x ((100 minus condition) / 100)^2`. At 90 about 0.2%, at 60 about 0.8%, at 30 about 2.2%, at 10 about 3.4%.
* **A breakdown** happens during the dinner peak: the rider's current trip is missed (those orders become late or missed), the vehicle is off the road until repaired.
* **Repair:** standard 3 days at 15% of the vehicle's price, or express next day at 30%. Repair restores condition to 80.
* Below 20 condition a vehicle can be sold only for scrap (20% of its price).

### 7.3 Maintenance slider (F-252)

Fleet tab, one slider for the whole fleet, 0% to 150% of the standard upkeep (the table in `delivery-tab.md` 5.3):

| Setting | Upkeep a week | Condition restored a day | Result in a typical week |
|---|---|---|---|
| 0% (skip) | $0 | 0 | Wear adds up, breakdowns climb within 3 weeks |
| 50% | half | 0.5 x daily wear at 20 trips | Slow decline |
| 100% (default) | standard | Equal to wear at 20 trips a day | Steady at around 85 |
| 150% | 1.5x | 1.5 x daily wear at 20 trips | Stays above 90, rarely breaks |

* **Missed deliveries** rise as condition falls: each vehicle below 50 adds 1% of its orders as late (a slow, rattling ride) even without breaking down.
* Riders on a vehicle below 40 lose 1 mood a week (they notice).
* Old saves load all vehicles at 100 condition and the slider at 100%, so they play almost exactly as before (the base breakdown chance of 0.2% is the only change; see Q8).

### 7.4 Fleet health (F-253)

* Fleet tab: each vehicle with a condition bar, days to the next likely breakdown and a Repair button.
* Scorecard: new KPI **Fleet health**, average condition, grade A at 85.
* Missed and late orders caused by vehicles are counted separately in the delivery week summary, so the player sees what skimping cost ("12 orders missed because of breakdowns: $340 in refunds and rating minus 1.5").
* Card 2 of the event deck gets a fleet cousin in the coach tips, never as an event.

---

## 8. Save and simulation notes

* Every new field is optional on the save and defaults to today's behaviour: no loans from the lender, events at Gentle starting 14 days after load (or at day 101), delivery menu on Auto, commission from `T.delivery.commission` with Standard tier and no second platform until its entry rules apply, refund policy Fair with no controls, vehicles at condition 100 and maintenance at 100%.
* All new logic lives in pure functions in `src/sim` (ADR 002) and all numbers in `src/data/tunables.ts` plus a new data file `src/data/events.ts` (ADR 004).
* The balance harness (`npm run balance`, ADR 006) gets lanes for: a loan shark rescue (does it help or hurt a losing restaurant), event cost as a share of profit per setting, delivery menu sizes 8 to 20, the three listing tiers, the three refund policies and maintenance at 0%, 50%, 100% and 150%.

## 9. Feature list

| ID | Feature | Section | Priority (proposed) |
|---|---|---|---|
| F-237 | Loan shark offer with risk priced rate | 2.2, 2.3, 2.5 | Should |
| F-238 | Loan shark repayment, early payoff and missed payments | 2.4 | Should |
| F-239 | Random event engine: start at day 101, rhythm, weights, scaling | 3.2 | Must |
| F-240 | The deck of 20 event cards as data | 3.3 | Must |
| F-241 | Event card UI, event log, coach tip and setting | 3.4 | Must |
| F-242 | Hand picked delivery menu of up to 20 items across dish kinds | 4.2 | Should |
| F-243 | Delivery menu complexity: work, errors, prep, waste | 4.3 | Should |
| F-244 | Delivery reach by variety and segment fit | 4.4 | Should |
| F-245 | Dynamic platform take rate | 5.2 | Should |
| F-246 | Listing tiers Lite, Standard, Plus | 5.3 | Should |
| F-247 | Second platform and exclusivity deals | 5.4 | Nice |
| F-248 | Refund policy and who pays | 6.2 | Should |
| F-249 | Fraud and fraud controls | 6.3 | Should |
| F-250 | Refund KPI and refund report | 6.4 | Should |
| F-251 | Vehicle condition, wear, breakdowns and repair | 7.2 | Must |
| F-252 | Fleet maintenance slider | 7.3 | Must |
| F-253 | Fleet health view and KPI | 7.4 | Should |
| F-254 | Settings: random events and loan shark levels, one time notes for old saves | 1.1, 3.4 | Must |

## 10. Acceptance criteria (draft)

| ID | Feature | Criterion |
|---|---|---|
| AC-345 | F-237 | Before day 31 the loan shark is not offered; from day 31 he is offered below the bank's loans |
| AC-346 | F-237 | A $10,000 short loan at 18% repays $11,800 in 8 weekly payments of $1,475 |
| AC-347 | F-237 | With cash below $0 and a negative 4 week profit, the offered rate is 4 points above the band's low end and the sheet names both reasons |
| AC-348 | F-237 | A third loan cannot be taken while 2 are open, and total owed never exceeds 6 x average weekly sales |
| AC-349 | F-238 | Repaying early saves half of the interest not yet due |
| AC-350 | F-238 | A missed payment adds a 10% late fee; after 2 missed weeks 20% of daily sales go to arrears until paid; reputation and staff are untouched |
| AC-351 | F-239 | No event happens on or before day 100; the first can happen from day 101 |
| AC-352 | F-239 | At Standard, over 200 simulated weeks the average gap between events is between 2 and 4 weeks, and no card repeats within 6 weeks |
| AC-353 | F-239 | The same save, seed and choices give the same events |
| AC-354 | F-239 | No card costs more than 1.5 x the 4 week average weekly profit (or $500 when profit is negative) |
| AC-355 | F-240 | The deck holds 20 cards; cards that do not apply (for example delivery cards without delivery) are never drawn |
| AC-356 | F-240 | A kitchen with a wash point per station fails the food safety inspection less often than one with a single Sink, all else equal |
| AC-357 | F-241 | Every card shows its cost, its choices and why it was more likely; the event log lists every card drawn with its choice and cost |
| AC-358 | F-241 | With random events Off no card is ever drawn |
| AC-359 | F-242 | The delivery menu accepts up to 20 items with at least 3 mains; Auto plays exactly as F-234 |
| AC-360 | F-242 | Starters, desserts and drinks on the delivery menu raise the average basket |
| AC-361 | F-243 | At 20 items the kitchen work per order is x1.30 and the wrong item rate 6.8% before cook skill |
| AC-362 | F-244 | A menu with 4 dish kinds gets more orders than one with only pizzas of the same size, all else equal |
| AC-363 | F-245 | The take rate stays within its clamps and rises when rivals' share of app orders rises, all else equal |
| AC-364 | F-245 | The Promotion tab shows this week's rate, its three reasons and next week's forecast |
| AC-365 | F-246 | Plus tier costs 5 points more commission and gives 20% more reach than Standard; each tier shows its Saturday preview |
| AC-366 | F-247 | The second platform enters no earlier than day 120; breaking exclusivity early charges 2 weeks of average commission |
| AC-367 | F-248 | Under Generous, refunds cost more and a bad order lowers the rating less than under Strict, all else equal |
| AC-368 | F-248 | On the platform with its riders, a late rider costs the restaurant no refund; a wrong item costs the full item |
| AC-369 | F-249 | Photo on delivery cuts never arrived fraud by 70% and adds 1 minute to rides |
| AC-370 | F-250 | The scorecard shows Refunds as a share of delivery sales with a grade; One order, unpacked shows a Refunds line |
| AC-371 | F-251 | A vehicle at condition 30 breaks down more often than one at 90 over 1,000 seeded days |
| AC-372 | F-251 | Standard repair takes 3 days and 15% of the price, express 1 day and 30%; both restore condition to 80 |
| AC-373 | F-252 | At 0% maintenance, a fleet used 20 trips a day falls below condition 60 within 4 weeks; at 100% it holds around 85 |
| AC-374 | F-252 | Missed and late deliveries rise as fleet condition falls, all else equal |
| AC-375 | F-253 | The scorecard shows Fleet health with a grade; the week summary counts orders missed because of breakdowns |
| AC-376 | F-254 | Old saves load without migration; new systems start at their defaults and a one time note explains them |

## 11. Suggested build order

1. **Fleet upkeep (6)**: smallest, extends an existing system, and makes refunds meaningful.
2. **Refunds and fraud (5)**: needs the missed orders from 6 and the wrong items from 3.
3. **Delivery menu (3)**: replaces F-234's slider with a picker, feeds 5.
4. **Random events (2)**: its own engine and data file, touches many systems lightly; best after 5 and 6 so the repair cards and the fleet line up.
5. **Commission elasticity (4)**: depends on rival delivery data from `competition.md` 6; second platform last.
6. **Loan shark (1)**: easiest to build, but best tuned once events exist, since events are what make players need fast cash.

## 12. Open questions

* Q1. Loan shark interest: flat over the term (proposed, reads clearly) or 15% to 25% per year (much milder, closer to a real lender)?
* Q2. Should the loan shark be a named character with a face and lines like the bank advisor, or a plain offer row?
* Q3. Events: should the player be able to insure against some cards (a weekly premium that halves repair costs)? It would be a natural counterpart to the maintenance slider.
* Q4. Events in managed restaurants of a chain: roll per restaurant with the manager choosing automatically, or always ask the player?
* Q5. Delivery menu cap: 20 items total as requested, while today's slider allows up to 24 mains. Keep both (Auto up to 24, hand picked up to 20) or cap everything at 20?
* Q6. Should rivals ever get the Plus tier and push the player down the app, making the tier choice partly defensive?
* Q7. Second hand vehicles at a lower price and starting condition 70: in scope here or later?
* Q8. For old saves, should the base breakdown chance start at 0 until the player first opens the Fleet tab, so a save plays exactly the same?
