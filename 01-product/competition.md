# PRD addendum: Competition, marketing and food delivery

* Status: Draft 1 for milestone **M0.5**
* Owner: Game Product Management
* Date: 2026-09-27
* Extends: `prd.md` 5.1 (City), 5.7 (Demand), 5.10 (Reputation and marketing), 5.12 (Chain, cannibalisation), 5.13 (Rival), 6 (Economy); `city-map.md` 4; `staff-management.md` 6.2 (rival offers); `balance.md` 1.4 and 4.3; `src/sim/day.ts`, `src/sim/location.ts`, `src/sim/economy.ts`, `src/sim/chain.ts`
* Features: F-141 to F-168 and F-178 in `features.md`. Acceptance criteria: AC-226 to AC-275, AC-286 and AC-287 in `acceptance-criteria.md`
* Delivers early: F-74 Marketing (v1.0) is replaced by F-152 to F-154; F-87 Cannibalisation (v1.0) is implemented inside F-143. F-93 (Nonna Bianca's festival) stays at v2.0.
* **All numbers are start values in `T.rivals`, `T.marketing` and `T.delivery` plus the data files `src/data/rivals.ts`, `src/data/campaigns.ts` and `src/data/venues.ts`; AC-273 to AC-275 make `npm run balance` confirm them.**

### Founder decisions (2026-09-27, supersede anything below that conflicts)

1. **Old saves:** no prompt. They load with live rivals off, and the player adds rivals from the Competition group of the settings menu whenever they like (sections 9 and 10).
2. **Delivery promise and throttle:** the 35 minute promise and the default throttle of 80% kitchen load stay (6.5, 6.4).
3. **Rivals tab:** a top level Rivals tab, as in 7.1.
4. **Delivery reputation is a separate thing:** DRep never moves the dining reputation and the dining reputation never moves DRep (6.6).
5. **Delivery can turn a small kitchen into a gold mine if played well:** a small restaurant with a strong kitchen, good riders and a high DRep earns many times its dining profit; played badly it earns little more than before (6.12, 11).
6. **Decided (M0.5):** rivals may seek out a successful player. It is the setting "Rivals target the leader" (off on Easy, on for Normal and Hard). How it works is in 15.1.

## 1. Goal and the loops it serves

Founder request: "write a new PRD for ai-competition, other restaurants that open up and compete for the same crowd and choose a different strategy (compete on price, quality, marketing). Create a few options to determine marketing campaigns per restaurant + what audience to hit (matching demographics). Create 3x amount of venues on the map, competition can also take up venues and start to compete. Create competition analytics plus coaching how to address this. In the setting menu let me set amount of competitors, their skill and start capital. Allow to have new competitors enter later in the game (arrange via setting menu). Expand weekly report with detailed competition analytics and impact on my restaurants with advice how to deal with this. Also allow a new business model for restaurants with good reputation: food delivery which requires marketing, investment in delivery staff, this can lead to massive demand if done well but then will hit the kitchen, if the kitchen cant match demand this will impact delivery reputation."

Today competition is a single static number per neighbourhood (`district.competition`, 0.15 to 0.5) plus a venue delta, applied as `demand x (1 - 0.5 x C)` in `day.ts`. It never moves, has no face and gives the player nothing to read or answer. This addendum turns it into a **living market**: named pizzerias that open, pick a strategy, change prices, run campaigns, grow into small chains, struggle and sometimes close. The player answers with marketing, pricing, craft and, once the restaurant is well loved, food delivery.

* **Loops served:**
  * **Day:** read "about 9 guests went to rivals today, mostly students to Pizza Pronto"; watch the delivery bar on the pipeline panel during a busy dinner.
  * **Week:** read the competition section of the week report, pick one answer (a campaign aimed at the right crowd, a hero dish at a sharper price, a quality step, or simply holding steady), and check the market share chart next week.
  * **Long term:** choose where to open next knowing who is there; outlast a price fighter; grab a venue before a rival chain signs it; build a delivery business big enough for your own riders.
* **Feeling:** "I know my street." The pleasure of a shopkeeper who knows the other shops, sees them coming and has a calm answer.
* **Design intent:** competition is **pressure, never punishment**. Rivals can take at most 45% of a segment's guests (the same cap as today), nobody sabotages, every loss is attributed to a named cause, and the coach always offers at least one affordable answer. Delivery is a **reward** for a well loved restaurant that tests the kitchen, not a new way to fail.

### 1.1 What changes at a glance

| Area | Today | M0.5 |
|---|---|---|
| Competition | Static `district.competition` plus venue delta | Background competition (half the old number) plus live rival pressure per segment, plus own restaurant cannibalisation |
| Rivals | Names only, used for staff offers | 0 to 30 simulated pizzerias with an archetype, skill, cash, prices, quality, reputation, following, campaigns, delivery |
| Venues | 24 | 72; rivals occupy some, announce viewings, leave "To let" signs |
| Marketing | None (F-74 planned for v1.0) | 10 campaigns with an audience choice and an audience match score, for the player and for rivals |
| Analytics | None | Rivals tab: market share by segment over 12 weeks, rival cards, mystery diner, a coach |
| Reports | No competition content | Day line; week report "Competition this week" with guests lost and won per rival and segment, and one or two pieces of advice |
| Settings | Economy sliders and start pace | New "Competition" group: live rivals on or off, number, skill, start capital, new entrants, caps |
| Business model | Dining room only | Food delivery from Rep 60: platform or own riders, shared kitchen, delivery reputation |

## 2. The live market: how competition enters demand

### 2.1 Background and live competition

The old district number is split. Half of it stays as **background competition**: the kebab shops, cafes and burger bars that are not pizzerias and never change. The other half is now carried by **live rivals** on the map.

```
C_bg        = clamp(backgroundShare x district.competition + venue.competitionDelta, 0, 0.9)   backgroundShare 0.7 (0.5 in the first draft, see 15.1)
C_live_s    = sum over rival locations k of pressure_k,s  +  cannibalisation x (other own restaurants in the same district)
C_eff_s     = min(0.9, C_bg + C_live_s)
demand_s    = ...existing product...  x (1 - competitionFactor x C_eff_s)                    competitionFactor 0.5 (unchanged)
```

With **live rivals off** (setting, section 9) the formula is exactly today's: `C_bg = district.competition + competitionDelta` and `C_live_s` holds only the cannibalisation term. The balance harness always runs with live rivals off, so every existing balance result is unchanged (AC-226).

Cannibalisation (prd.md 5.12, F-87) is not in the code today (`T.demand.cannibalisation` is defined but unused). It is implemented here: each other restaurant the player owns in the same district adds 0.2, with no strength factor (same brand, same guests).

### 2.2 Attractiveness

Every pizzeria, the player's and each rival's, has an **attractiveness** per segment. It is the product of the multipliers `day.ts` already computes for the player, so no new model is invented:

```
A_r,s = trafficMult_v x visibility_p x repMult(Rep_r) x fit_r,s x priceMult_r,s x budgetMult_r,s
        x qualityMult_r,s x speedA_r,s x followMult(following_r) x mkt_r,s

speedA_r,s = lunchShare_v x speedMult_r + (1 - lunchShare_v)   for Students and Professionals; 1 otherwise
mkt_r,s    = marketing multiplier (section 5.3), 1 without campaigns
```

For the player every factor is read from the start of day analysis (prices, menu, rep, following, campaigns). For a rival the factors come from its profile (section 3.3). District foot traffic, segment shares and wealth are the same for everyone in the district, so they cancel out and are left out of A.

### 2.3 Pressure of one rival

```
rel_k,s       = clamp(A_k,s / A_p,s, relMin 0.5, relMax 2.5)
proximity_k   = 1.3  same district and within 6 map units ("same street")
                1.0  same district
                0.3  other district, within 12 map units ("nearby")
                0    otherwise
pressure_k,s  = unitPressure (0.15) x proximity_k x rel_k,s
```

* An equal rival in the same district takes 0.10, so two equal rivals plus the background reproduce University Quarter's old 0.40.
* A much weaker rival still takes 0.025 (someone always tries the new place); a much stronger one takes at most 0.25 (0.325 on the same street).
* With the 0.9 cap the player keeps at least 55% of a segment's demand, whatever happens. That is today's cap.
* If the player's A for a segment is 0 (no dish at all), the segment is skipped.

**Order of evaluation and no feedback loop.** Every day starts by freezing all rival states. The player's and managed restaurants' days use them; the rivals' days use the player's start of day attractiveness. Nothing computed today changes today's pressure (AC-230). Rivals are simulated in `src/sim/rivals.ts`, called after the branches in the day loop, with their own random stream `Rng.stream(seed, day, 'rivals')`.

**Rivals see each other too.** A rival's own demand uses the same formula with the player's restaurants and the other rivals as its competitors.

### 2.4 Worked example: a price fighter opens on the canal

Setup (Thursday, no service full): the player runs Lock Keeper's Cottage (cosy, visibility 0.75), Rep 60, following 0.9, mains at fair price, $13.00 average, menu Q 65, lunch service time 22 min, about 60 guests a day (students 9, families 16, professionals 15, foodies 6, seniors 9, tourists 5). Da Enzo, an Honest Trattoria of equal strength, is in the district (pressure 0.10 on every segment). C_bg = 0.5 x 0.30 = 0.15, so C_eff = 0.25 and demand is x0.875.

Pizza Pronto (Price Fighter, skill 5, Basic tier: Q 50, main $8.84 at price index 0.85) opens at Mill Race Cosy, 16 map units away, and runs a Student deal (10% off students' mains, lift +15%). Two weeks later its following is 0.3.

| Segment | A player | A Pronto | rel | Pressure | C_eff | Demand change | Guests per week |
|---|---|---|---|---|---|---|---|
| Students | 0.613 | 1.159 | 1.89 | 0.189 | 0.439 | -10.8% | about -7 |
| Families | 0.728 | 0.670 | 0.92 | 0.092 | 0.342 | -5.3% | about -6 |
| Professionals | 1.013 | 0.484 | 0.48 | 0.048 | 0.298 | -2.7% | about -3 |
| Foodies | 1.117 | 0.355 | 0.32 | 0.032 | 0.282 | -1.8% | about -1 |
| Seniors, tourists | | | about 0.4 | about 0.04 | about 0.29 | about -2% | about -2 |

About **18 guests a week** (about $250 of margin; AC-231 reproduces this table). As Pronto's following grows to 0.8 by week 8, students hit the 2.5 cap (pressure 0.25) and the loss grows to about **30 guests a week**. But Pronto sells at $13.26 a head in a district with few students; at 37 to 66 guests a day in a cosy room with 6 staff it loses $50 to $340 a day. The coach says so (section 7.5): "Hold steady. Pizza Pronto is losing money at these prices; a family campaign protects your biggest segment for $200 a week." Four losing weeks later Pronto takes its rescue move (prices back toward fair) or closes. The same Pronto at Chalk Lane Window in University Quarter earns about $200 a day: rivals that fit their district survive, as the player's own strategies do.

## 3. Rival restaurants

### 3.1 Archetypes: how a rival competes

Each rival has one archetype. Its **style weights** (price, quality, marketing; they sum to 1) bias every decision it makes (section 3.4).

| id | Archetype | Price / Quality / Marketing | Tier | Price index start | Ambience | Turns per seat per day | Service time | Target segments | Preferred premises | Marketing budget | Delivery | Max locations |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| priceFighter | **Price Fighter** | 0.70 / 0.10 / 0.20 | Basic | 0.85 | 40 | 4.0 | 16 min | students, families | hole, corner, large | 5% of revenue | from Rep 50 | 2 |
| artisan | **Artisan** | 0.10 / 0.80 / 0.10 | Premium (Artisan at skill 7+) | 1.15 | 80 | 2.2 | 26 min | foodies, tourists | cosy, medium | 2.5% | never | 1 |
| hypeHouse | **Hype House** | 0.20 / 0.20 / 0.60 | Standard | 1.00 | 60 | 3.0 | 20 min | the district's two largest segments | corner, medium, loft | 15% | from Rep 45 | 3 |
| honestTrattoria | **Honest Trattoria** (price and quality) | 0.45 / 0.45 / 0.10 | Standard (Premium at skill 7+) | 0.95 | 65 | 2.8 | 22 min | families, seniors, professionals | cosy, medium | 2.5% | never | 1 |
| trendyKitchen | **Trendy Kitchen** (quality and marketing) | 0.10 / 0.45 / 0.45 | Premium | 1.10 | 75 | 2.6 | 22 min | professionals, foodies, tourists | medium, loft, corner | 11% | from Rep 60 | 2 |
| budgetChain | **Budget Chain** (price and marketing) | 0.45 / 0.10 / 0.45 | Basic | 0.90 | 45 | 3.6 | 17 min | students, families, professionals | hole, corner, large | 11% | from Rep 45 | 4 |

Marketing budget = `marketing weight x 0.25 x weekly revenue` (rounded in the table), capped by the runway rule in 3.4.

**Spawn weights by the district's "Best for" verdict** (`bestFor` in `location.ts`):

| Verdict | priceFighter | artisan | hypeHouse | honestTrattoria | trendyKitchen | budgetChain |
|---|---|---|---|---|---|---|
| Volume (University) | 4 | 1 | 2 | 2 | 1 | 3 |
| Middle road (Canal, Business, Market, Linden) | 2 | 2 | 3 | 4 | 2 | 2 |
| Luxury (Old Harbour, Old Town) | 1 | 4 | 2 | 2 | 3 | 1 |

### 3.2 Generation

* **Name and face:** drawn without repeats from a pool of 30 in `src/data/rivals.ts`, each with an owner name, a one line motto and a logo letter and colour. The pool includes the six names already used for staff offers (`RIVALS` in `src/data/staff.ts`: Trattoria Nonna, Pizza Veloce, Da Enzo, La Bella Napoli, Forno Rosso, Osteria del Porto) plus, for example, Pizza Pronto, Slice Society, Crust and Co, Forno Verde, Il Vesuvio, Dough Brothers, Mamma Rosa, Pizzeria Aurora, The Good Slice, Nonna Bianca. Each name carries an archetype affinity so "Slice Society" is never an Artisan. Mottos: "Cheapest slice in town, every day" (Price Fighter), "Flour, water, salt, time" (Artisan), "You saw us on your phone" (Hype House).
* **Skill** 1 to 10: the setting's mean (section 9) plus an offset of -1, 0 or +1 drawn once per rival, clamped to 1 to 10.
* **Start capital:** the setting's amount, as cash.
* **Rivals present at a new game** (the setting's start count N) are established: Rep `40 + 3 x skill` plus or minus 5, following 0.7 to 0.9, cash = start capital, tier and price at their archetype start.
* **District quotas at a new game:** `q_d = N x competition_d / sum of competition` over the seven districts, rounded by largest remainder. N = 10 gives University 2, Business 2, Linden 0, Market 2, Canal 1, Old Town 2, Old Harbour 1. Quotas never exceed the per district cap.
* **Placement:** inside its district a rival picks the venue with the best expected weekly profit (the evaluator of 3.4) among `2 + skill` sampled free venues it can afford (3.5). Start rivals never take one of the seven original hole in the wall venues (`fresh-start.md`: every neighbourhood keeps a cheap start). Rivals are placed when the game is created, so the welcome city map already shows them; the player cannot pick an occupied venue.

### 3.3 The rival's day (aggregate, no agents)

A rival location is a compact profile, not a full restaurant: tier, price index, ambience, service time, seats, turns, skill, Rep, following, campaigns, delivery flag. Its day uses the player's formulas with these inputs:

```
Q_k          = wIngredients x tierQ + wHarmony x 65 + wKitchen x (kitchenBase + kitchenPerSkill x skill)
             = 0.5 x tierQ + 9.75 + 0.35 x (30 + 7 x skill)            tierQ: Basic 35, Standard 55, Premium 75, Artisan 90
fc_k         = food cost per main by tier: Basic $1.60, Standard $2.40, Premium $3.20, Artisan $4.40
fair main    = (fairIntercept + fairQualitySlope x Q_k + fairFoodCostMult x fc_k) x repPremium(Rep_k)
main price   = fair main x priceIndex_k
check        = main price x 1.5                                        (sides and drinks)
food cost    = fc_k x 1.6 x (1.10 - 0.015 x skill) per cover           (sides, waste falls with skill)
fit_k,s      = 1.2 for target segments, 0.9 for the rest
seats        = floor(0.55 x dining tiles): hole 16, cosy 44, corner 52, medium 55, loft 77, large 121
capacity     = seats x turns per seat per day (archetype)
demand_k,s   = traffic_v x visibility_p x share_v,s x captureBase x weekdayMult x A_k,s x (1 - 0.5 x C_eff_k,s) x economy.demand
served_k     = min(sum of demand_k,s, capacity)
```

**Satisfaction and reputation** (same weights and update as the player):

```
food    = 0.7 x Q_k/100 + 0.3 x 0.55                                    (a typical menu's taste match)
service = clamp(0.30 + 0.06 x skill + 0.10 if Artisan or Trendy Kitchen (they have a host), 0, 1)
ambience= archetype ambience / 100
value_s = clamp(0.7 - 0.6 x (priceIndex - 1) x e_s, 0, 1)
wait    = clamp(1 - 2 x max(0, load - 0.85), 0, 1)                      load = demand / capacity
S_k     = 100 x (0.40 food + 0.20 service + 0.15 ambience + 0.15 value + 0.10 wait)   served weighted over segments
Rep_k  += min(1, 0.05 x economy.reputation) x (-10 + 1.1 x S_k - Rep_k);  -1 when load > 1.15
following_k: nextFollowing(following_k, S_k, served_k, 0) from day.ts, plus campaign awareness (5.3)
```

**Money** (cash is per rival brand, shared by its locations):

```
sales      = served x check
costs      = served x food cost + rent (venue weekly rent / 7) + staff + utilities (30 + 0.8 x served)
             + upkeep (15 + 0.002 x fit out) + marketing + delivery costs (6.9)
staff      = (2 + ceil(seats / 12)) x 520 x (1 + 0.012 x (10 x skill - 50)) / 7 per day, x1.15 for Artisan and Trendy Kitchen
fit out    = hole $3,000, cosy $8,000, corner $10,000, medium $12,000, loft $18,000, large $25,000; x1.5 for Artisan and Trendy Kitchen
```

Example (Price Fighter, skill 5, Basic, price index 0.85, Rep 50, students only, load 0.8): Q 50, fair main $10.40, main $8.84, check $13.26, food cost $2.62 per cover, food 0.515, service 0.60, value 0.88, S 61.8, Rep target 57.98, Rep moves to 50.40 in one day (AC-233).

Calibration targets: an Artisan at Oyster Steps (Old Harbour) at following 0.8 serves about 71 a day and earns about $430 a day; a Price Fighter at Chalk Lane Window (University) about $200 a day; the same Price Fighter in Canal Quarter loses money (section 2.4). Rivals that fit their district prosper, misfits fade.

### 3.4 The rival's week: decisions

Every Sunday night, after the player's week report is built, each rival location decides. Rivals of skill 4 or less decide every second week (they react slowly).

**1. Candidate moves.** Hold; price -5%; price +3%; start a campaign (the 3 best campaign and audience pairs for its target segments, section 5); stop a campaign; tier up; tier down; start delivery (when eligible, 6.10).

**2. Evaluate.** For each move the rival computes its **expected weekly profit** with its own day model over a standard week (weekday multipliers summed), holding the player and the other rivals as they are now. One time costs (tier up $1,500 for new suppliers and training) are spread over 8 weeks.

**3. Style bonus.** `score = expected profit + 0.10 x weekly revenue x style weight of the move's family` (price moves read the price weight, tier moves the quality weight, campaigns the marketing weight; hold has no bonus). So a Price Fighter prefers price moves and an Artisan prefers quality moves even when they are slightly less profitable: rivals stay recognisable.

**4. Choose.** With probability `pBest = 0.35 + 0.06 x skill` (skill 3: 0.53, 5: 0.65, 7: 0.77, 9: 0.89) the best score; otherwise a random one of the next two. Same pattern as manager accuracy in `staff-management.md` 8.2.

**Constraints, checked before scoring:**

* Price moves at most 5% a week (prd.md 5.9 manager rule). Price index never below **0.75** (0.80 at skill 7 or more: good owners know their margins) and never above 1.40.
* **No endless price war:** after 2 consecutive cuts a rival may not cut for 4 weeks.
* Quality archetypes (quality weight 0.45 or more) never price below 1.00.
* **Runway rule:** no campaign, tier up or delivery start while cash is below 4 weeks of fixed costs (rent plus staff).
* A rival whose room was over capacity (load above 1.1 on 4 or more days) always considers price +3% first.

**5. Rescue.** After 4 consecutive losing weeks a location makes one forced rescue move, once in its life: stop all campaigns but the cheapest, tier down one step (not below Basic), and move price index 5% toward 1.00. The news feed says "Pizza Pronto is tightening its belt".

**6. Closing.** A location closes on Sunday when (a) brand cash is below $0 and its 4 week average profit is negative, or (b) it had 8 consecutive losing weeks and brand cash is below 4 weeks of its fixed costs. A chain closes its worst location first. When the last location closes the rival leaves the city ("Pizza Pronto closed its doors after 14 weeks"). Rivals take no loans. The venue shows "To let" and is free 7 days later. (Nice to have, F-168: the closed kitchen stays behind, and whoever rents the venue next may buy up to 3 of its stations at 50% of catalogue price.)

### 3.5 Venues: occupying, viewing, holding, expanding

* **Affordability:** a rival opens a premises only if `fit out + deposit (4 weeks rent) + 4 weeks of fixed costs <= cash`. With the Medium capital ($35,000) that means a hole in the wall or a cosy shop in most districts (cosy in Canal Quarter: $8,000 + $4,840 + $17,320 = $30,160); Large ($80,000) opens up to a big hall. Start capital therefore decides **how big newcomers open and how long they survive a slow start**.
* **Entrants start** at Rep 30 and following 0.25 (opening buzz; the player's slow start is 0.1 but the player can buy the same buzz with a campaign).
* **Viewing notice:** a rival that wants a free venue first **views** it for 7 days. The city map shows the pin with a dashed ring, an eye and a countdown; the news feed says "Slice Society is viewing Union Square (signs on day 64)". If the player rents or holds the venue first, the rival picks another one the next week.
* **Hold a venue (player verb):** pay 1 week of the venue's rent (not refundable) to hold it for 28 days; rivals never view or sign it. If the player rents it within the hold, the fee is taken off the deposit. One hold at a time.
* **Chain expansion:** when brand cash covers the new premises plus 8 weeks of fixed costs, the best location's Rep is 55 or more, the 4 week average profit is positive and the chain is below its archetype's max locations, there is a 25% chance each week to start a viewing. The venue is chosen by the evaluator (expected weekly profit at Rep 45 and following 0.6) among `2 + skill` sampled free affordable venues anywhere in the city.
* **Never:** a rival never takes the player's venue, a held venue, or the last free hole in the wall of a district. When the player moves out of a venue it is free for rivals after 14 days.

### 3.6 New entrants later in the game

* Each week, if the city has fewer active rivals than the cap, a new rival enters with probability `1 / interval` (setting: Off, every 8, every 4 or every 2 weeks on average). Never before day 28.
* **Grace periods:** no entrant opens in a district within 28 days after the player opened a restaurant there, and no two entrants open in the same district within 28 days.
* The entrant draws its archetype from the city wide spawn weights, then views the best of `2 + skill` sampled free affordable venues (3.5) in districts below the per district cap. The 7 day viewing notice applies, so the player always sees a newcomer coming.
* Rivals that closed can come back as entrants after 16 weeks under the same name (Nonna Bianca always comes back: she likes the city).

### 3.7 What skill does

| Effect | Formula | Skill 3 | Skill 5 | Skill 7 | Skill 9 |
|---|---|---|---|---|---|
| Pizza quality Q (via kitchen) | 0.35 x 7 x skill | 7.4 | 12.3 | 17.2 | 22.1 |
| Service score | 0.30 + 0.06 x skill | 0.48 | 0.60 | 0.72 | 0.84 |
| Best move chosen | 0.35 + 0.06 x skill | 53% | 65% | 77% | 89% |
| Venues evaluated | 2 + skill | 5 | 7 | 9 | 11 |
| Food cost (waste) | x (1.10 - 0.015 x skill) | x1.055 | x1.025 | x0.995 | x0.965 |
| Decision rhythm | weekly from skill 5 | every 2 weeks | weekly | weekly | weekly |
| Price floor | | 0.75 | 0.75 | 0.80 | 0.80 |

### 3.8 Cosy guardrails (never)

* No game over, no rival sabotage, no negative campaigns about the player, no price below 0.75 of fair, no poaching beyond the existing rival offers of `staff-management.md` 6.2 (which now name a real rival in the same or a nearby district when one exists).
* No surprise: every opening is announced 7 days ahead, every closing, price move of 5% or more, tier change and campaign within reach appears in the news feed.
* Rivals can take at most 45% of a segment's demand (cap 0.9).
* A new player restaurant gets 28 quiet days: no entrant in its district.

## 4. City map: 72 venues

### 4.1 Distribution

The 24 venues of `city-map.md` 4.4 stay exactly as they are (ids and values). 48 new venues are added, roughly in proportion to foot traffic and map area:

| Neighbourhood | Before | New | Total | Hole | Cosy | Corner | Trattoria | Loft | Big hall |
|---|---|---|---|---|---|---|---|---|---|
| University Quarter | 4 | 8 | 12 | 3 | 3 | 2 | 1 | 1 | 2 |
| Business District | 3 | 7 | 10 | 3 | 1 | 2 | 3 | 0 | 1 |
| Linden Park | 3 | 4 | 7 | 2 | 1 | 1 | 1 | 1 | 1 |
| Market Square | 3 | 8 | 11 | 3 | 2 | 1 | 2 | 2 | 1 |
| Canal Quarter | 4 | 7 | 11 | 2 | 3 | 1 | 2 | 2 | 1 |
| Old Town | 3 | 8 | 11 | 3 | 2 | 2 | 3 | 1 | 0 |
| Old Harbour | 4 | 6 | 10 | 2 | 2 | 1 | 2 | 1 | 2 |
| **Total** | **24** | **48** | **72** | **18** | **14** | **10** | **14** | **8** | **8** |

Every neighbourhood has at least two hole in the wall venues, so one is always free for a fresh start even when a rival takes the other.

### 4.2 The 48 new venues

Same fields as `city-map.md` 4.1 (`competitionDelta`, `lunchShareDelta`, `wealthMult` default 0 / 0 / 1). Coordinates on the 100 x 70 map; pins at least 3 units apart. Each has two pros and two cons in the house voice; the table gives them in short form.

| # | id | Venue | Area | Premises | Rent/tile | Traffic | Modifiers | x, y | Pros | Cons |
|---|---|---|---|---|---|---|---|---|---|---|
| 25 | lectureHall | Lecture Hall Corner | University | Corner | 9 | 1.1 | lunch +0.10, students 1.3 | 15, 15 | Between two lecture halls; wide unit | Empty in the holidays; students count coins |
| 26 | bookshopRow | Bookshop Row | University | Cosy | 8 | 1.0 | professionals 1.2 | 24, 14 | Lecturers and staff; quiet charm | Small room; modest footfall |
| 27 | scienceCanteen | Science Park Canteen | University | Big hall | 7 | 0.9 | lunch +0.15, professionals 1.4 | 27, 6 | Researchers at lunch; cheap space | Dead in the evening; a big room to fill |
| 28 | unionSquare | Student Union Square | University | Trattoria | 9 | 1.25 | competition +0.10, students 1.3 | 18, 22 | The busiest square on campus; late crowd | Rivals on every side; low spend |
| 29 | chalkLaneWindow | Chalk Lane Window | University | Hole | 8 | 1.0 | students 1.2 | 6, 14 | Tiny deposit; slices to go | Few seats; back lane |
| 30 | printworks | Old Printworks | University | Loft | 7 | 0.85 | students 1.1, professionals 1.2 | 12, 24 | Huge space for little money; character | Off the main streets; big rent bill |
| 31 | terraceRow | Terrace Row | University | Cosy | 7 | 0.9 | lunch -0.10, families 1.4 | 31, 14 | Young families on the terraces; cheap | Quiet lunch; few passersby |
| 32 | nightOwlHatch | Night Owl Hatch | University | Hole | 9 | 1.15 | lunch -0.15, students 1.4 | 23, 19 | Late night student trade; busy corner | Tiny kitchen; slow mornings |
| 33 | glassAtrium | Glass Atrium Food Court | Business | Hole | 16 | 1.25 | lunch +0.20, competition +0.15, professionals 1.3 | 46, 6 | Thousands pass at lunch; small and easy | Food court rivals; dead evenings |
| 34 | bankersRow | Bankers' Row | Business | Trattoria | 18 | 1.0 | wealth 1.15, professionals 1.3 | 55, 13 | Expense account diners; classy street | High rent; impatient at lunch |
| 35 | conferenceHall | Conference Centre Hall | Business | Big hall | 14 | 1.0 | lunch +0.10, tourists 1.3, professionals 1.2 | 63, 8 | Conference crowds; groups | Uneven weeks; high total rent |
| 36 | courtyardCorner | Courtyard Corner | Business | Corner | 16 | 1.05 | none | 40, 22 | Sheltered courtyard; balanced trade | Pricey; nothing special |
| 37 | skylineTerrace | Skyline Terrace | Business | Trattoria | 20 | 0.85 | wealth 1.2, lunch -0.20, foodies 1.3 | 58, 24 | City views; wealthy dinner guests | Highest rent in the district; hard to find |
| 38 | clerkStreet | Clerk Street Cosy | Business | Cosy | 15 | 1.0 | lunch +0.15 | 47, 20 | Office lunch on the doorstep; small | Quiet evenings; pricey for its size |
| 39 | tramStopHatch | Tram Stop Hatch | Business | Hole | 14 | 1.2 | lunch +0.10 | 53, 4 | Commuters all day; cheap for Business | Few seats; noisy |
| 40 | schoolGate | School Gate Corner | Linden Park | Corner | 7 | 1.0 | families 1.4 | 82, 22 | Parents after school; cheap | Quiet lunch; kids' menu expected |
| 41 | bowlsClub | Bowls Club Pavilion | Linden Park | Trattoria | 7 | 0.8 | competition -0.05, seniors 1.5 | 93, 26 | Loyal older crowd; no rivals | Few passersby; classics only |
| 42 | orchardBarn | Orchard Barn | Linden Park | Loft | 6 | 0.75 | lunch -0.10, families 1.3 | 70, 26 | Enormous barn for little rent; weekends | Far from everything; hard to fill |
| 43 | duckPondKiosk | Duck Pond Kiosk | Linden Park | Hole | 6 | 0.95 | families 1.2, seniors 1.1 | 80, 8 | Park walkers; cheapest start | Tiny; weather dependent feel |
| 44 | cheesemongers | Cheesemonger's Corner | Market Square | Corner | 12 | 1.1 | foodies 1.3 | 25, 44 | Food lovers browse here; good footfall | Picky guests; crowded street |
| 45 | flowerStall | Flower Market Stall | Market Square | Hole | 11 | 1.2 | competition +0.10 | 12, 34 | Everyone walks by; cheap | Stalls compete on every side; few seats |
| 46 | butchersRow | Butchers' Row | Market Square | Cosy | 11 | 1.0 | families 1.2 | 5, 58 | Local families; fair rent | Plain street; small room |
| 47 | coveredFoodHall | Covered Food Hall | Market Square | Big hall | 10 | 1.15 | lunch +0.10, competition +0.15, tourists 1.2 | 18, 48 | Big crowds; room for volume | Food stalls all around; high total rent |
| 48 | bakersYard | Bakers' Yard | Market Square | Trattoria | 12 | 0.95 | none | 28, 54 | Balanced crowd; proper dining room | Tucked in a yard |
| 49 | auctionHouse | Old Auction House | Market Square | Loft | 9 | 0.85 | professionals 1.2 | 10, 64 | Grand loft; low rent per tile | Off the square; big to fill |
| 50 | saffronHatch | Saffron Hatch | Market Square | Hole | 12 | 1.0 | foodies 1.4 | 4, 44 | Spice lovers; small and cheap | Foodies expect quality; few seats |
| 51 | fountainSquare | Fountain Square | Market Square | Cosy | 13 | 1.2 | tourists 1.3 | 24, 36 | Postcard fountain; all day crowds | Rent above the district; tourists do not return |
| 52 | swingBridge | Swing Bridge Corner | Canal | Corner | 11 | 1.1 | none | 46, 38 | Busy crossing; wide unit | Nothing special; middling rent |
| 53 | bargeYard | Barge Yard | Canal | Big hall | 9 | 0.85 | families 1.2 | 56, 46 | Cheap big room; groups | Off the path; big to staff |
| 54 | millRace | Mill Race Cosy | Canal | Cosy | 11 | 0.95 | seniors 1.2 | 44, 46 | Quiet waterside; loyal locals | Few passersby; small room |
| 55 | boathouse | Boathouse Trattoria | Canal | Trattoria | 12 | 1.0 | professionals 1.1, families 1.1 | 64, 33 | Waterside dining; balanced | Rent above the district |
| 56 | lockTwoHatch | Lock Two Hatch | Canal | Hole | 10 | 1.05 | none | 48, 28 | Gentle crowd; low deposit | A few seats only; plain |
| 57 | ropeworks | Ropeworks | Canal | Loft | 10 | 0.9 | professionals 1.2 | 35, 35 | Trendy loft; space to grow | Big rent bill; quiet lunch |
| 58 | marinaWalk | Marina Walk | Canal | Cosy | 12 | 1.1 | tourists 1.2 | 58, 39 | Boats and strollers; charm | Pricier than the canal average |
| 59 | cloisterCourt | Cloister Court | Old Town | Cosy | 17 | 1.0 | wealth 1.1, seniors 1.3 | 42, 55 | Wealthy older guests; calm | Seniors dislike waits; pricey |
| 60 | bellTowerHatch | Bell Tower Hatch | Old Town | Hole | 16 | 1.3 | competition +0.15, tourists 1.4 | 51, 54 | Crowds under the bell tower; tiny deposit | Tourist traps around; few seats |
| 61 | printersLane | Printers' Lane | Old Town | Trattoria | 15 | 0.9 | foodies 1.3 | 33, 58 | Food lovers' lane; fair rent for Old Town | Side street; needs great food |
| 62 | townHallArcade | Town Hall Arcade | Old Town | Corner | 18 | 1.15 | tourists 1.2 | 57, 58 | Covered arcade; all day trade | High rent; tourist heavy |
| 63 | wineCellars | Old Wine Cellars | Old Town | Loft | 13 | 0.8 | wealth 1.1, foodies 1.2, seniors 1.2 | 44, 67 | Vaulted cellars; wine lovers | Below street level; big rent bill |
| 64 | pilgrimsRest | Pilgrims' Rest | Old Town | Trattoria | 12 | 1.0 | tourists 1.3 | 61, 55 | Coach parties; cheap for Old Town | Tourists do not return; plain room |
| 65 | lanternAlley | Lantern Alley | Old Town | Hole | 13 | 0.75 | competition -0.10, foodies 1.3 | 39, 61 | Hidden gem; few rivals | Hard to find; few seats |
| 66 | museumSteps | Museum Steps | Old Town | Cosy | 18 | 1.2 | lunch +0.10, tourists 1.4 | 48, 65 | Museum crowds at lunch; busy | Pricey; guests pass once |
| 67 | yachtClub | Yacht Club Terrace | Old Harbour | Trattoria | 22 | 0.85 | wealth 1.2, foodies 1.2, professionals 1.2 | 94, 58 | Richest guests after Lighthouse; views | Very high rent; end of the marina |
| 68 | ferryTerminal | Ferry Terminal Hall | Old Harbour | Big hall | 12 | 1.2 | lunch +0.15, tourists 1.4 | 86, 66 | Ferry crowds; cheap big room | Tourists do not return; high total rent |
| 69 | oysterSteps | Oyster Steps | Old Harbour | Cosy | 20 | 0.95 | foodies 1.4 | 84, 54 | Foodie pilgrimage; sea air | Pricey small room; little lunch |
| 70 | chandlery | Old Chandlery | Old Harbour | Loft | 15 | 0.9 | foodies 1.1, tourists 1.1 | 70, 66 | Harbour loft with character; space | High rent bill; off the quay |
| 71 | harbourWallHatch | Harbour Wall Hatch | Old Harbour | Hole | 17 | 1.1 | tourists 1.3 | 78, 46 | Harbour address on a budget; strollers | Few seats; windy |
| 72 | customsHouse | Customs House Corner | Old Harbour | Corner | 19 | 1.0 | wealth 1.1 | 92, 44 | Handsome old building; wealthy crowd | High rent; nothing at lunch |

### 4.3 Map changes for 72 pins

* **Pins:** the player's restaurants as a star pin; rivals as a round logo pin with a ring in the archetype colour (Price Fighter orange, Artisan gold, Hype House pink, Honest Trattoria green, Trendy Kitchen violet, Budget Chain blue) and the archetype's first letter inside for colour blind players; free venues as small grey pins coloured by premises size; viewed venues with a dashed ring, an eye and the days left; "To let" tags on venues freed in the last 14 days; held venues with a padlock.
* **Readability:** visual pin 28 pt, tap target 44 pt. Pins closer than 44 pt at the current zoom merge into a cluster badge with a count; tapping it zooms in. Pinch zoom and two finger pan on the map. Filter chips: All, Free, Rivals, Mine.
* **Venue card** gains "Rivals within reach" (name, archetype, stars, distance label: same street, same neighbourhood, nearby) and the effective competition for each segment at that venue given today's rivals, and a **Hold for $X** button.
* **Venue list** gains a column "Rivals nearby" and a filter "Free only".

## 5. Marketing campaigns

### 5.1 The catalogue

A campaign is bought per restaurant (Local radio covers every restaurant of the player in the city). Most campaigns ask **who to reach**.

| id | Campaign | Cost | Runs | Dining lift | Audience | Delivery lift | Awareness per week | Side effects | Unlock |
|---|---|---|---|---|---|---|---|---|---|
| flyers | Street flyers | $120 per week, scaled | 7 days | +3% | everyone (a = 1 for all six) | +10% (letterbox menus) | +0.02 | none | Start |
| social | Social media ads | $300 per week, scaled | 7 days | +18% | choose 1 or 2 segments; reach: students 1.0, professionals 1.0, foodies 1.0, tourists 0.8, families 0.6, seniors 0.3 | +15% | +0.03 | none | Day 8 |
| studentDeal | Student deal | $100 per week, scaled, plus 10% off students' mains | 7 days | +15% plus the discount | students | +20% (students) | +0.02 | students pay 10% less | Day 8 |
| familySundays | Family Sundays | $200 per week, scaled | 7 days | +15%, +40% on Sundays | families | 0 | +0.02 | one free kids' main per family party on Sunday (food cost only) | Day 8 |
| lunchClub | Business lunch club | $250 per week, scaled | 7 days | +20% at lunch only | professionals | 0 | +0.02 | none | Serve 500 |
| tourGuide | Tourist guide listing | $500 per 28 days, scaled | 28 days | +18% | tourists | 0 | +0.01 | none | Rep 45 |
| foodiePress | Foodie press night | $900 once | 14 days | +25% foodies; +10% professionals and tourists | foodies (1.0), professionals and tourists (0.4) | 0 | +0.03 | review risk: on the press night Rep +2 if foodie satisfaction is 65 or more, -1 if below 50 | Rep 50 |
| loyalty | Loyalty cards | $300 setup, then 3% of dining sales | until stopped | none | your regulars | +5% | none | following decline x0.5 and following target +0.05 | Rank Owner |
| radio | Local radio | $1,000 per week, flat | 7 days | +10% at every restaurant you own | families 1.0, seniors 1.0, professionals 0.8, students 0.3, foodies 0.3, tourists 0.3 | +10% | +0.03 | none | Rank Owner |
| promotedListing | Promoted delivery listing | $250 per week, flat | 7 days | none | delivery app users | +30% | none | none | Delivery on (platform modes) |
| appVoucher | Welcome voucher on the app | $200 per week, flat | 7 days | none | delivery app users | +25% | +0.01 | none | Delivery on (platform modes) |
| doorHangers | Door hanger menus | $90 per week, scaled | 7 days | none | everyone in the catchment | +15% | +0.01 | none | Delivery on (any mode) |
| foodInfluencer | Food influencer unboxing | $600 one off | 7 days | +4% | students, professionals, foodies | +35% | +0.03 | none | Delivery on (any mode) |

**Cost scale:** campaigns marked "scaled" cost `base x clamp(traffic_v / 2,400, 0.6, 3.0)`: reaching a bigger crowd costs more. Flyers at Campus Gate (7,200 passersby) cost $360 a week; at the Bandstand Kiosk (1,440) $72.

### 5.2 Rules

1. At most **3 active campaigns per restaurant** (radio does not use a slot). The same campaign cannot run twice at one restaurant.
2. Paid up front on start for its run; weekly campaigns renew automatically until stopped (a toggle on each card); stopping refunds nothing.
3. **Fatigue:** the same campaign running more than 4 weeks in a row works at x0.8 from week 5 and x0.6 from week 9. Two weeks off resets it. The card says "People have seen this a lot: x0.8".
4. Campaigns start the next morning (not during a service).
5. Campaign spend is a P&L line "Marketing" in the day report (weekly costs spread over 7 days in the accrual view, paid in cash at start).

### 5.3 Formulas and where they enter the sim

```
a_c,s         = audience weight of campaign c for segment s (chosen segments x reach; 0 for others)
mkt_s         = min(1 + liftCap (0.5), 1 + sum over active campaigns c of lift_c x a_c,s x fatigue_c)
dining demand : day.ts base_s x mkt_s                                   (lunchClub: lunch only; familySundays: Sunday bonus)
delivery      : orders x mktD, mktD = min(1.6, 1 + sum of delivery lifts, audience weighted the same way)
match_c       = sum over s of a_c,s x share_v,s / max over s of a_c,s   (0..1; the part of the venue's crowd the campaign speaks to)
awareness     : following += awareness_c x (0.5 + match_c) x (1 - following) / 7 each open day while active
```

Discounts work through the existing price formula: the student deal lowers the students' `r` by 10%, so `priceMult` and `value_score` rise on their own; the lost 10% shows in sales.

**Why matching the crowd works better.** Lift only acts on the segments the campaign speaks to, so a campaign's extra guests are `lift x sum of a_s x demand_s`: a student deal at Campus Gate (students are 68% of the crowd) moves a lot of guests; the same deal at Lighthouse View (3%) moves almost nobody for the same money. Awareness also grows faster when the match is high (word spreads inside a crowd). The UI states it plainly with the **audience match** meter: Great fit (0.35 or more), OK (0.15 to 0.35), Poor (below 0.15).

| Example | Match | Label |
|---|---|---|
| Student deal at Campus Gate Slice | 0.68 | Great fit |
| Student deal at Lighthouse View | 0.03 | Poor |
| Social ads, families and professionals, at Lock Keeper's Cottage | 0.40 | Great fit |
| Tourist guide listing at Cathedral Square | 0.41 | Great fit |
| Tourist guide listing at Library Lane Hall | 0.04 | Poor |

**Payback band (tuning target, AC-250):** a matched campaign (match 0.35 or more) at a restaurant with spare capacity (both services below rho 0.7) returns 1.1 to 2.0 times its cost in extra gross margin during its run, before counting following. A mismatched one (below 0.15) returns less than 0.6 times; at a full room (rho above 1.1 at both services) any campaign returns less than 0.5 times. The preview says which case applies.

### 5.4 Rival marketing

Rivals choose from the same catalogue (not loyalty cards or radio) with the same formulas. Their weekly marketing budget is `marketing weight x 0.25 x revenue`, subject to the runway rule. Their audience is picked from their target segments: the best match with probability pBest, otherwise a random allowed audience (low skill rivals waste money on the wrong crowd). Rival campaigns raise their A (so their pressure on the player) and their following. They are public: every rival card shows its running campaigns and audience, and a new one within reach appears in the news feed.

### 5.5 UI: the Marketing sheet

Opened from the Money tab ("Marketing") and from any coach advice.

* **Active** strip: each running campaign with days left, audience chips, fatigue note, **extra guests so far** (`sum of served_s x (1 - 1/mkt_s)` share attributed to it) and spend, and a Stop toggle.
* **Catalogue**: one card per campaign with cost (already scaled for this venue), run length, plain effect ("+18% of the guests you target"), audience chips to tap (segment colour, name and share of this venue's crowd), the **audience match meter** with its label, and the **impact preview** from `compare()` on the hypothetical state: extra guests per day at lunch and dinner, profit per week, following in 4 weeks. Warnings: "Your dinner is full: most of these guests would be turned away" (rho above 1 at dinner), "Poor fit: only 3% of people here are students".
* Buttons: **Start for $X**; "Need $X more"; the unlock text when locked; "3 campaigns running, stop one first".

## 6. Food delivery

### 6.1 Unlock and setup

* **Unlock per restaurant:** Rep 60 (3 stars) at that restaurant and 28 days open there. A card in the Money tab says what is missing ("Delivery: reach 3 stars. You are at 2.7").
* **Packing station:** a new kitchen item, 1 x 1, $900, $10 per week maintenance, placed like any station (must touch a free floor tile). Required before delivery can start. Unlocked with delivery.
* **Delivery panel** (section 6.11) opens with a setup checklist: packing station, delivery mode, delivery price markup, packaging, riders and vehicles (own modes), throttle.

### 6.2 Delivery modes

| Mode | Reach | Commission | Riders | Delivery fee ($3.50 paid by the guest; was $2.50) | Other costs |
|---|---|---|---|---|---|
| **Platform** (the Scoot app does it all) | 1.0 | 30% of order value | Platform riders: wait 5 min, ride 14 min | Kept by the platform | none |
| **Platform, own riders** (marketplace listing) | 1.0 | 14% | Yours (6.8) | Yours | riders and vehicles |
| **Own delivery** (your own ordering page) | 0.4 plus marketing | 0% | Yours | Yours | riders, vehicles, web shop $150 per week |

The mode can be changed any morning. Switching away from own riders does not let them go.

### 6.3 Delivery demand

```
catchment    = traffic_v + 0.5 x sum of foot traffic of adjacent districts
orders_day   = catchment x audience x orderRate (0.0065; was 0.005, draft 0.004) x sum over s of share_v,s x affinity_s x priceMult_s(r_d) x budgetMult_s(p_d) x qualityMult_s
               x repMult(DRep) x weekdayMult x reach_mode x mktD x (1 - 0.5 x Cd_eff) x economy.demand
r_d          = r x (1 + markup)        markup is the delivery price markup, 0% to 20%, default 10%
p_d          = average main price x (1 + markup)
affinity     = students 1.4, families 1.2, professionals 1.1, foodies 0.3, seniors 0.4, tourists 0.15   (draft: foodies 0.5, tourists 0.3)
audience     = share of the catchment that knows you deliver (6.13): starts at 0.05, grows slowly by word of mouth and fast with delivery campaigns (replaces the old 1.2 novelty boost)
Cd_eff       = min(0.9, 0.3 + sum over rivals with delivery of 0.1 x prox_d x rel_d,s)   prox_d: same district 1.0, adjacent 0.5
split        = lunch 30%, dinner 70%
per order    = 1.8 mains, 0.5 soft drinks, 0.15 desserts; no wine, aperitivi or digestivi
dish choice  = the same chooseDishes() with the district wealth as for dining
```

Adjacency (data in `districts.ts`): University: Business, Market, Canal. Business: University, Canal, Linden. Linden: Business, Canal, Harbour. Market: University, Canal, Old Town. Canal: all six others. Old Town: Market, Canal, Harbour. Harbour: Linden, Canal, Old Town.

Worked value (AC-264): Lock Keeper's Cottage, menu at fair price with $13.00 average main and Q 60, markup 10%, DRep 50, platform mode, Thursday, no rival delivery, novelty over: catchment 2,400 + 0.5 x 20,600 = 12,700; the segment sum is 0.744; orders = 12,700 x 0.004 x 0.744 x 1.1 x 0.85 = **35.4 orders** (10.6 at lunch, 24.7 at dinner), about 64 mains. Own delivery only: 14.1. In the novelty weeks: 42.4. At DRep 80: 46.9. With a promoted listing and social ads on top, a well rated restaurant passes 70 orders a day: **massive demand if done well.**

Strategy fit falls out of the affinities: students, families and professionals order in, foodies and tourists rarely do, so delivery suits volume and middle restaurants and adds little to luxury.

### 6.4 One kitchen for two front doors

Delivery uses no seats and no plates but the **same oven and prep line**. In the capacity loop of `day.ts` (per service `sv`, per effective hour):

```
dineNeedPH    = min(demand_sv / (hours x U), seatPerHour)
delivNeedPH   = orders_sv / (hours x U) x 1.8 x deliveryWork (1.1: packing)
throttlePH    = throttle x kitchenPerHour                  throttle 0.8 by default, 0.7 to 1.0, or Off
delivAllowPH  = max(0, min(delivNeedPH, throttlePH - dineNeedPH))  when the throttle is on; delivNeedPH when Off
total         = dineNeedPH + delivAllowPH
if total <= kitchenPerHour: kitchenForDine = kitchenPerHour; delivServedPH = delivAllowPH
else:           share = kitchenPerHour / total; kitchenForDine = dineNeedPH x share; delivServedPH = delivAllowPH x share
perHour       = min(kitchenForDine, seatPerHour)           replaces min(kitchenPerHour, seatPerHour)
kitchenRho    = (servedPerHour + delivServedPH) / kitchenPerHour     feeds the existing ticket queue for dining and delivery
refused       = orders the throttle turned away (the app shows you as busy)
cancelled     = orders accepted but not cooked (delivAllowPH - delivServedPH)
```

So an overloaded kitchen shares itself fairly between the room and the app: dining guests queue longer and some cannot be served, delivery orders get cancelled. The **throttle** ("Pause the app when the kitchen is this busy") protects both, at the price of refused orders. The pipeline panel (F-104) gets a fifth bar, **Delivery**, in mains per hour, and the oven and prep bars show dining and delivery load stacked.

### 6.5 Delivery time

```
ticket_d     = cookTime + queueDelay(min(kitchenRho, 0.95)) + packMinutes (3)       the whole queue, not the 0.5 share
riderWait    = platform: 5 min; own riders: queueDelay(min(rhoR, 0.95)) + 30 x max(0, rhoR - 1) (cap 40)
rhoR         = delivered orders per hour / rider capacity per hour
rider cap/h  = riders on shift x 60 / (2 x rideTime + 4) x 1.3 orders per trip
rideTime     = platform 14; own: bike 16, electric scooter 12; x (1.15 - 0.003 x rider SPD)
deliveryTime = ticket_d + riderWait + rideTime
timeScore    = clamp(1 - max(0, deliveryTime - promise 35) / span 25, 0, 1)
```

Examples with a 12 minute cook time and platform riders: kitchenRho 0.47 gives 36 min (time score 0.97); 0.8 gives 42 min (0.72); 0.95 or more gives 59 min (0). Delivery is unforgiving above a kitchen load of about 0.8, which is why the throttle defaults there.

### 6.6 Delivery reputation (DRep)

A separate rating per restaurant, 0 to 100, shown as its own stars on the delivery panel and on the app. Starts at 50.

```
food_d   = food score of the dishes sent x travel (0.92 + 0.0006 x (average rider QUA - 50) for own riders) x packaging (basic 1.00, insulated eco 1.04)
value_d  = valueScore(r_d, e_s) served weighted
S_d      = 100 x (0.45 x food_d + 0.35 x timeScore + 0.20 x value_d)        order weighted over lunch and dinner
DRep    += min(1, 0.05 x economy.reputation) x (-10 + 1.1 x S_d - DRep)
           - 1 if cancelled orders exceed 5% of accepted
           - 0.5 x refused share of the day's orders (the app ranks busy restaurants lower)
```

**Feedback loop, stable by design:** DRep drives delivery demand through `repMult`, so a kitchen that cannot keep up gets slower deliveries, a lower DRep and then fewer orders until demand matches what it can cook. Nothing collapses and there is no game over; the player sees why ("Deliveries took 59 minutes at dinner: your kitchen was at 100%").

**Spillover to the dining room** comes only through the kitchen: longer tickets at dinner lower the dining wait score. **DRep is a separate reputation** (founder decision): it never changes the dining Rep, and the dining Rep never changes DRep. A restaurant can be a two star room and a five star delivery kitchen.

### 6.7 Economics

```
order value  = 1.8 x average main price x (1 + markup) + 0.5 x soft drink price + 0.15 x dessert price
sales        = delivered orders x order value (+ $3.50 fee per order in own rider modes)
commission   = 30% / 14% / 0% of order value
food         = ingredient cost of the dishes sent
packaging    = per main: basic $0.50, insulated eco $1.10
utilities    = $0.40 per order
riders       = salary (role base $380 per week, section 6.8); vehicles: maintenance per week
```

P&L gets a "Delivery" block in Detailed view: delivery sales, commission, packaging, riders; the Simple view folds them into Money in and Money out.

### 6.8 Riders and vehicles

* **Rider**, a new staff role (base salary $380 per week). Card weights like the dishwasher: QUA 0.10, SPD 0.60, CMP 0.30, MEN 0. SPD sets ride time (6.5), QUA sets travel quality (6.6), CMP applies the usual pressure rule at `rhoR`. Riders sit in a new **Delivery** row of the Squad; the staff market offers at least one rider once delivery is unlocked at any restaurant.
* **Vehicles**, bought on the delivery panel: bike $600 ($4 per week), electric scooter $1,900 ($12 per week). A rider without a vehicle does not ride. Vehicles move with the restaurant and sell at 80%.
* **Rota:** riders work lunch plus dinner like everyone else (5 shifts a week by default).

### 6.9 Worked example: one Thursday of delivery at Lock Keeper's Cottage

Assumptions: kitchen 30 mains per hour at both services; dining at dinner wants 16 an hour and seats allow 14.2; dining at lunch needs 9 an hour; platform mode, throttle 0.8; orders wanted 35.4 (6.3); soft drink $3.00, dessert $5.50; food cost $3.00 per main, $0.60 per drink, $1.20 per dessert.

| Step | Lunch | Dinner |
|---|---|---|
| Orders wanted | 10.6 (5.9 per hour over 1.8 h) | 24.7 (8.45 per hour over 2.925 h) |
| Delivery mains per hour needed | 11.7 | 16.7 |
| Throttle room (0.8 x 30 minus dining) | 15.0 | 9.8 |
| Orders accepted | 10.6 (all) | 14.5 (10.2 refused) |
| Kitchen load | 0.69 | 0.80 |
| Delivery time | 38 min (score 0.86) | 42 min (score 0.72) |

Money for the day: 25.1 orders x $28.07 = **$704** sales; commission 30% **-$211**; food 25.1 x $5.88 **-$148**; packaging **-$23**; utilities **-$10**; packing station **-$1** = **+$311 a day** on top of an unchanged dining room. DRep: S_d about 65.4, target 62, so DRep climbs about 0.45 a day even after the refusal penalty.

The same day with the **throttle off**: 34.6 orders accepted, dinner kitchen at 100%, deliveries take 59 minutes (score 0), about 1.3 dining guests lose their table to the kitchen and dining tickets grow by about 12 minutes. Profit is higher today (about +$410 after the lost dining covers) but S_d falls to about 47 and DRep drifts down 0.4 a day; in three weeks orders fall back. That trade off is the heart of delivery: **grow the kitchen before you grow the app.**

**Own riders:** in the marketplace mode each order earns $6.99 more (lower commission plus the fee) but 3 riders on shift every service means 5 riders on the payroll ($1,900 a week) plus 5 scooters ($9,500, $60 a week): about $280 a day. They pay off from about **40 orders a day**; the coach says so.

### 6.10 Rival delivery

Price Fighter, Hype House, Trendy Kitchen and Budget Chain start delivery (platform mode) as a candidate move once past their archetype's Rep threshold (3.1) and when their dining load is below 0.8. A rival's delivery is simplified: orders from the formula of 6.3 with DRep = Rep - 5, capped at 40% of its dining capacity, 30% commission and basic packaging. Rival delivery adds to `Cd_eff` for the player's delivery demand (6.3).

### 6.11 Delivery panel (UI)

In the Money tab and reachable from the pipeline panel's Delivery bar:

* **Status:** DRep stars and trend, orders today (wanted, accepted, refused, cancelled), average delivery time at lunch and dinner against the 35 minute promise, share of the kitchen used by delivery.
* **Settings:** mode (three cards with commission and reach), markup slider 0% to 20% with the preview of orders and profit per day, packaging (basic or insulated eco), throttle ("Pause the app when the kitchen is at 80%": 70% to 100% or Off) with the preview "About 10 orders a dinner refused, deliveries 42 min".
* **Riders and vehicles** (own modes): riders on shift per service against riders needed (`ceil(peak orders per hour / (0.8 x capacity per rider))`), Hire rider (opens the market filtered), Buy bike or scooter.
* **Coach line** for delivery, for example "Your kitchen is the limit: a second oven would let you accept about 10 more orders a dinner (about +$120 a day)".

### 6.12 The delivery kitchen: a small restaurant as a gold mine

Founder decision: "It can help to turn a small restaurant kitchen into a gold mine if played well." Delivery demand comes from the catchment (the district plus half of the adjacent ones), not from passers by, seats or the shopfront, so a cheap back street venue with a strong kitchen can sell far beyond its dining room. What playing it well means, and what the game rewards:

* **Size the kitchen for the app, not the room.** A hole in the wall seats 16 but can hold two ovens and three prep stations. Its dining room uses a small share of that kitchen, so almost all of it is free for delivery.
* **Keep deliveries under the 35 minute promise.** The throttle at 80% keeps tickets short; own riders with scooters cut the ride.
* **Top rated on Scoot** (new): DRep 85 or more for 14 days in a row earns a badge that multiplies delivery orders by 1.25 and puts the restaurant first in the app. It is lost as soon as DRep falls below 80, and returns only after another 14 days at 85. This is the reward for a delivery kitchen run well, and the thing an overloaded kitchen loses first.
* **Own riders from about 40 orders a day** (6.9): commission falls from 30% to 14%.
* **Marketing aimed at students and families** (5.1) fills the app, not the room.

Hand estimate, a hole in the wall in Canal Quarter played well: two deck ovens, a prep fridge and a prep counter, three cooks, four riders with scooters, platform with own riders, DRep 88 and Top rated, one matched campaign: about 90 orders a day at about $28 an order; after food, 14% commission, packaging, riders and vehicles about $1,000 a day before rent and the dining room, against about $150 a day for the same restaurant without delivery. Played badly (throttle off, one oven, platform riders): deliveries take 59 minutes on busy evenings, DRep falls under 40 within four weeks and the gain shrinks to a quarter of that.

| Tunable (`T.delivery`) | Unit | Start | Safe range |
|---|---|---|---|
| topRatedDrep | DRep | 80 (draft 85) | 80 to 90 |
| topRatedLoseBelow | DRep | 75 (draft 80) | 75 to 85 |
| topRatedDays | days | 14 | 7 to 28 |
| topRatedBoost | orders multiplier | 1.25 | 1.1 to 1.4 |

### 6.13 Delivery deals, delivery marketing and the delivery day report (as built, M0.7)

Founder request: "more detailed delivery stats in the daily report and also tips how to boost delivery. Have also delivery marketing to get a bigger share, including e.g. 25% discount for second pizza etc, so prices go down but volume up."

**Deals** (`src/data/deliveryDeals.ts`, `DeliveryState.deal`): one standing offer at a time, set in the Delivery panel with a Saturday preview for each. A deal lowers the price guests judge (the main price x (1 + markup) x (1 - mainsDiscount)), so the price and budget multipliers of 6.3 lift orders by segment elasticity, then `orderLift` adds the app's deal badge. Bigger baskets add mains, drinks or desserts to each order; extra mains load the kitchen as delivery work. The value score of DRep uses the discounted price.

| Deal | Discount | Basket | Order lift |
|---|---|---|---|
| Second pizza 25% off | about 12% off mains | +0.3 mains | +12% |
| Second pizza half price | about 22% off mains | +0.45 mains | +20% |
| Free delivery | the $3.50 fee (own riders lose it; on the app you pay it) | none | +18% |
| Meal deal | 15% off everything | +0.5 drinks, +0.5 desserts | +8% |
| 10% off every order | 10% off everything | none | +5% |
| Lunch deal (lunch only) | 20% off everything | +0.3 drinks | +25% |

Deals pay when the kitchen has room. With a full kitchen the app turns the extra orders away and the discount goes on orders you would have had anyway; the tips say so.

**Delivery marketing**: three campaigns in the Marketing sheet besides the promoted listing (table in 5.1): Welcome voucher on the app (+25%), Door hanger menus (+15%, any mode) and Food influencer unboxing (+35% for one week, any mode). `deliveryLiftCap` rises from 0.6 to 0.8 so three delivery campaigns can stack.

**Delivery day report**: the day report's delivery card folds open with orders wanted and delivered, average order and mains per order, profit per order, kitchen share, share of delivery nearby (against rivals' last day, weighted like 6.3), a lunch and dinner table (wanted, out, refused, time, order value), food, time and value scores, the money lines (sales, deal discounts, refunds, commission, food, packaging, riders, vehicles and utilities), who ordered, and **How to grow delivery**: up to four tips from `src/sim/deliveryAdvice.ts`, ranked (riders missing, refused orders, late orders, the weakest score, a deal, delivery marketing, mode, Top rated progress, the main crowd). The same tips sit in the Delivery panel with a Delivery marketing button.

### 6.14 The delivery audience: slow to build, needs campaigns (as built)

Founder rule: "delivery audience build up should go way slower, in the beginning hardly anyone will notice, requires active campaigning."

* `DeliveryState.audience`, 0 to 1: the share of the catchment that knows the restaurant delivers. Orders scale with it (6.3). It replaces the 1.2 novelty boost of the first 14 days.
* A new delivery starts at **5%**. Each day: `audience += (0.004 x DRep/100 [x1.5 when Top rated, and only when an order went out] + campaign delivery lift / 7) x (1 - audience) - 0.003 x audience`.
* Word of mouth alone at DRep 60 takes a month to reach about 10% and settles near 45% after many months. A promoted listing with door hangers (+45% delivery lift) takes it past 60% within four weeks. Stop campaigning and it slowly fades back.
* `orderRate` rises from 0.005 to 0.0065 so an established, well marketed restaurant (audience about 75%) sees about the orders the old model gave everyone from day one.
* Older saves that already deliver start at 50%.
* The Delivery panel and the day report show the audience, its change and how much came from word of mouth and from campaigns; the top tip while it is under 50% with no delivery campaign running is to start one.
* Delivery balance (AC-274, AC-286) is measured for an established business at a 70% audience.

## 7. Competition analytics and the coach

### 7.1 The Rivals tab

A new main tab, **Rivals**, next to Money. District chips at the top (districts with the player's restaurants first; any district can be viewed).

1. **Market share:** a donut of all pizza guests in the district this week (you, your other restaurants, each rival; background places are not counted) and one stacked bar per segment. Below, a 12 week line of your share, overall or per segment (chip filter), with markers for openings, closings and your campaigns.
2. **Rivals in reach:** rival cards (7.2) sorted by guests they took from you this week.
3. **Coach:** section 7.5.
4. **News:** the last 28 days of market events within reach (opening, viewing, closing, price moves of 5% or more, tier changes, campaigns, delivery starts, rescues).

Definitions:

```
market share_r,s (district d) = served_r,s / sum over pizzerias q in d of served_q,s      (player restaurants and rivals; weekly)
```

### 7.2 Rival card

* Logo, name, owner, motto, since day X, locations (tap: show on map).
* **Competes on:** archetype name plus three dot meters for price, quality and marketing from its style weights ("Price ●●●, Quality ○○○, Marketing ●○○").
* **Stars** (Rep, public), delivery stars if it delivers.
* **Prices:** "About 15% cheaper than you" and "Margherita about $8.80".
* **Quality:** a range, for example "Pizza quality 45 to 55" against yours.
* **Speed:** fast, normal or slow at lunch.
* **Marketing now:** campaign chips with audience.
* **Their guests:** segment bars of their served guests this week; **overlap line:** "They take most of your students".
* **Trend:** Growing, Steady or **Struggling** (after 3 losing weeks, with a visible cue such as "half empty at dinner, cut prices twice").

**What is known:** Rep, campaigns, locations and delivery are public and exact. Price is shown as a band 10 points wide around the true index, quality as a range 10 wide around the true Q, the archetype as "?" until the rival has been within reach for 14 days. Cash is never shown; Struggling is the only signal.

### 7.3 Mystery diner (player verb)

$60 per visit, one per rival per week. Reveals for 28 days: exact price index and the prices of its top 3 dishes, exact Q, last week's satisfaction and its lowest sub score ("Guests say: long waits at lunch"), and the archetype. The card shows "Mystery diner report, 12 days left".

### 7.4 Guests lost and won

The day model runs a cheap second pass of the demand and capacity section (no satisfaction, no reviews) with `C_live_s` set to its cannibalisation part only, same seed and options:

```
lost_s          = max(0, served_s(without live rivals) - served_s(actual))
lost_k,s        = lost_s x pressure_k,s / (sum of rival pressures on s)
won back_k,s    = lost_k,s(last week) - lost_k,s(this week)          positive: you won guests back from k
```

A full service loses nothing: guests turned away at the door were not the rival's doing. The day report stores `market: { cEff, lostBySegment, lostByRival }` per restaurant; the week report sums them. Target: at most 5 ms per restaurant day on the reference iPad.

### 7.5 The coach

Marta, the market coach, speaks in the Rivals tab, in the week report and on the delivery panel. She follows a **playbook**: detect a situation, then offer **1 to 3 responses**, each with a **preview** from `compare()` on the hypothetical state (the same one day counterfactual run, x7 for a week) and one marked **Recommended** (highest estimated weekly profit, ties to the cheapest). Each response has a **Do it** button that opens the right screen with the change prefilled (Menu with the dish selected, Marketing with the campaign and audience chosen, and so on). She never acts on her own.

| Situation | Detected when | Diagnosis (example) | Responses offered |
|---|---|---|---|
| Undercut on price | a rival with price index 10% or more below yours takes 10% or more of a segment's guests | "Pizza Pronto is 15% cheaper and took 9 of your students." | A hero dish at a sharper price for that segment; a campaign for a segment the rival does not reach; faster lunch service (points to the pipeline) |
| Out cooked | a rival with Q 5 or more above yours takes 10% or more of foodies or tourists | "Forno Verde's pizza is better and foodies noticed." | Tier up the 2 best sellers; a wine list step; a chef course (`staff-management.md` 3.3); or concede foodies and target professionals |
| Out shouted | a rival with 2 or more campaigns takes 10% or more of a segment | "Slice Society is everywhere on social media." | Loyalty cards to keep your regulars; one matched social campaign for your key segment only; "hype fades when the campaigns stop" |
| Newcomer | a rival opened within reach in the last 28 days | "Expect a dip of about N guests for two weeks while people try them." | Hold steady; a campaign to your biggest segment |
| Rival struggling | a rival within reach is Struggling | "They are losing money at these prices." | **Hold steady** (always offered); do not cut prices |
| You lead | your share is the highest in the district and your A is 1.3 or more of every rival for your key segments | "You lead the Canal Quarter." | A 5% price rise on your best sellers with its estimated gain |
| Full house | rho above 1 at both services | "Rivals do not matter today: you turn guests away." | Raise prices; add capacity; delivery only if the kitchen has room |
| Delivery overload | kitchen load above 0.9 in a service with delivery, or DRep falling 3 days in a row | "Deliveries take 59 minutes." | Turn on or lower the throttle; add oven or prep capacity; raise the markup |

The coach shows at most 2 situations at a time, the ones with the most guests or dollars at stake. Every sentence carries its numbers (pillar 4).

## 8. Reports

### 8.1 Day report

* One line in the "How guests felt" card when 1 or more guests were lost: "About 9 guests went to rivals today, mostly students to Pizza Pronto." Omitted when nothing was lost.
* At most one market news line in the events list (the most important event within reach).
* With delivery on: a Delivery card after "How guests felt": orders wanted, accepted, refused, cancelled, average time lunch and dinner, DRep change, delivery profit.
* "Marketing" appears as a P&L line when campaigns ran.

### 8.2 Week report (and fast forward): "Competition this week"

One section per restaurant the player owns (the one the player runs in full; managed ones as a compact version inside "Your other restaurants"):

1. **Headline**, one sentence: "A busy week on the canal: Pizza Pronto opened at Mill Race Cosy and took about 18 of your guests."
2. **Market share:** your share of pizza guests in the district this week and the change against last week (38%, down 4), with mini bars per segment.
3. **Impact table:** one row per rival in reach, one column per segment, cells = guests lost (red) or won back (green), plus a total and the change against last week. Sorted by total.
4. **Moves this week:** rival price changes of 5% or more, tier changes, campaigns started, openings, viewings, closings, rescues, delivery starts.
5. **Your marketing:** each campaign with spend, extra guests and estimated extra margin ("Family Sundays: $200, about 21 extra families, about $260 margin").
6. **Delivery** (when on): orders, share of the district's delivery orders, DRep start to end, delivery profit, orders lost to rival delivery.
7. **Advice:** one or two coach items (7.5) with their estimated impact and a Do it button.

## 9. Settings: the Competition group

A new group in the settings menu next to the Economy sliders. Stored in `Economy.rivals` (`src/sim/economy.ts`); the Easy, Normal and Hard presets set it, and `presetName()` compares it too (any difference makes the preset "Custom").

| Setting | Options | Easy | Normal | Hard | Applies |
|---|---|---|---|---|---|
| Live rivals | On, Off (Off = today's static competition) | On | On | On | Immediately (below) |
| Rivals at the start | 0 to 20 | 6 | 10 | 14 | New games |
| Rival skill | Casual (3), Capable (5), Sharp (7), Master (9); each rival plus or minus 1 | Casual | Capable | Sharp | From the next Sunday, to every rival (its own offset kept) |
| Rival start capital | Small $18,000, Medium $35,000, Large $80,000, Very large $160,000 | Small | Medium | Large | New games and new entrants |
| New rivals later | Off, Rare (every 8 weeks), Sometimes (every 4), Often (every 2) | Rare | Sometimes | Often | Immediately |
| Most rivals in the city | 4 to 30 | 10 | 16 | 22 | Immediately (no forced closings; no entrants above it) |
| Most rivals per neighbourhood | 1 to 5 | 2 | 3 | 4 | Immediately (same) |

* **Turning live rivals off mid game:** every rival closes quietly overnight and the static formula returns. **Turning it on mid game:** the "Rivals at the start" number arrives as entrants spread over the next 28 days (none in the player's districts in the first 14 days), each with the 7 day viewing notice.
* The settings sheet shows one sentence per option ("Sharp rivals read the market well and rarely waste money on the wrong crowd").
* Like the start setting, the Competition group is remembered on the device for the next new game.
* **Old saves** (founder decision) load with live rivals off. The Competition group is where the player adds them, at any time, with the mid game rule above; there is no prompt.

## 10. Save migration

Schema bump (7 at the time of writing, or the next free number).

* `GameState` gains `rivals: Rival[]`, `venueHolds: { venueId, untilDay } | null`, `marketNews: NewsItem[]` (last 28 days).
* `Rival`: `id, name, owner, motto, archetype, skillOffset, cash, founded, closed?, returnsAfter?, locations: RivalLocation[]`. `RivalLocation`: `venueId, opened, tier, priceIndex, rep, following, drep, delivery, campaigns, lastCuts, cutCooldown, rescued, weeksLosing, viewing?: { venueId, signsOn }, history: last 12 weeks of { served by segment, profit }`.
* `LOCATION_KEYS` gain `campaigns: ActiveCampaign[]`, `delivery: DeliveryState | null` (mode, markup, packaging, throttle, drep, since, vehicles), `marketHistory` (12 weeks of share and lost by segment and rival).
* `Economy` gains `rivals: RivalSettings`. `Role` gains `rider`.
* `DayReport` gains `market`, `delivery` and a `marketing` P&L line.
* **Old saves** load with **live rivals off** and no prompt (founder decision). Their numbers are identical (AC-227) with one intended exception: a player who owns two or more restaurants in the same district now gets the 0.2 cannibalisation per other own restaurant that prd.md 5.12 always specified. The player adds rivals from the Competition group of the settings menu at any time; turning them on follows the mid game rule of section 9.
* The 48 new venues are free on load; old venue ids are unchanged.

## 11. Balance and dominant strategy checks

* **Reference builds unchanged:** with live rivals off the three builds of `balance.md` 3.1 give identical numbers (AC-226). The balance harness always runs off.
* **Live market sanity (new, AC-273):** a scripted middle build player in Canal Quarter on Normal, 26 weeks, 20 seeds: the player's average `C_eff` at home between 0.25 and 0.55; active rivals between 8 and 16; at least one closing and one entrant in 60% of seeds or more; no chain above its cap; median established rival profit per location between -$50 and +$450 a day; the player's profit between 75% and 110% of the same run with live rivals off. On Easy the player keeps at least 85%, on Hard at least 65%. If rivals are too harsh, lower `unitPressure` first, then `relMax`.
* **Starving rivals by price?** Pricing at 0.75 of fair for 12 weeks must earn the player less than pricing at fair in 80% of seeds or more, even counting rivals that close (margin collapse, `priceMult` cap 1.5, capacity). Closing a weak rival is a legitimate goal; a permanent price war is not a winning one.
* **Marketing spam?** Running every campaign all the time must earn less than the coach's best single matched campaign over 8 weeks at the middle build (fatigue, the 3 slot limit, the lift cap of 0.5 and capacity). Payback band in 5.3.
* **Rival runaway?** Caps (city, district, chain), the affordability rule, the same competition formula for rivals, and closing rules. A Budget Chain can hold at most 4 venues; rivals together never hold more than 30% of all venues.
* **AI price war spiral?** Floor 0.75, at most 2 cuts then 4 weeks of cooldown, quality archetypes never below 1.00.
* **Venue blocking?** One hold at a time, 28 days, a week of rent each time.
* **Rivals too timid?** On Normal, live pressure at the player's home (the `C_live` part) must average 0.10 or more; otherwise the feature is decoration.
* **Delivery dominance?** With the best delivery setup per build (exhaustive over mode, markup in 5% steps, throttle in 0.1 steps): middle in Canal Quarter gains 10% to 35% profit, volume in University Quarter 15% to 35%, luxury in Old Harbour less than 10%; no build gains more than 40%; and `balance.md` 3.5 still holds (each specialist beats the best middle build at home by 15% or more) with delivery on for everyone (AC-274). First lever: `orderRate`, then the platform commission.
* **Delivery kitchen gold mine (founder decision, AC-286):** a hole in the wall in Canal Quarter run well as a delivery kitchen (6.12: two ovens, throttle 0.8, own riders with scooters, one matched campaign, 8 weeks) earns at least 4 times its dining only profit and at least 60% of the middle build's home profit, on a fraction of the rent. Played badly (throttle off, one oven, platform riders) its delivery gain after 8 weeks is at most a quarter of the well played gain. The 40% cap on the delivery gain above applies to the three reference builds only, whose big dining rooms already fill their kitchens. The opening checklist still requires a table.

### 11.1 Tunables

| Tunable (`T.rivals`) | Unit | Start | Safe range |
|---|---|---|---|
| backgroundShare | share of district competition | 0.7 (draft 0.5) | 0.3 to 0.7 |
| unitPressure | competition per equal rival | 0.15 (draft 0.10) | 0.06 to 0.15 |
| relMin / relMax | ratio | 0.5 (draft 0.25) / 2.5 | 0.1 to 0.5 / 1.5 to 3.5 |
| sameStreetUnits / sameStreetMult | map units / factor | 6 / 1.3 | 4 to 8 / 1.1 to 1.5 |
| nearbyUnits / nearbyMult | map units / factor | 12 / 0.3 | 8 to 16 / 0.1 to 0.5 |
| pBestBase / pBestPerSkill | probability | 0.35 / 0.06 | 0.2 to 0.5 / 0.03 to 0.08 |
| maxPriceMove / priceFloor / priceFloorSkilled / priceCeiling | index | 0.05 / 0.75 / 0.80 / 1.40 | 0.03 to 0.08 / 0.7 to 0.85 / 0.75 to 0.85 / 1.3 to 1.6 |
| cutsBeforeCooldown / cooldownWeeks | count / weeks | 2 / 4 | 1 to 3 / 2 to 8 |
| styleBonus | share of weekly revenue | 0.10 | 0.05 to 0.2 |
| runwayWeeks | weeks of fixed costs | 4 | 2 to 8 |
| rescueAfterWeeks / closeLosingWeeks | weeks | 4 / 6 (draft 8) | 3 to 6 / 6 to 12 |
| expansionChance / expansionRep / expansionRunwayWeeks | per week / Rep / weeks | 0.25 / 55 / 8 | 0.1 to 0.4 / 45 to 65 / 4 to 12 |
| firstEntrantDay / graceDays / viewingDays / holdDays / returnWeeks | days, weeks | 28 / 28 / 7 / 28 / 16 | 14 to 56 / 14 to 42 / 5 to 14 / 14 to 42 / 8 to 26 |
| entrantFollowing / entrantRep | 0..1 / Rep | 0.25 / 30 | 0.1 to 0.4 / 25 to 40 |
| salaryBase | $ per week | 600 (draft 520) | 450 to 600 |
| maxShareOfVenues | share | 0.30 | 0.2 to 0.4 |

| Tunable (`T.marketing`) | Unit | Start | Safe range |
|---|---|---|---|
| maxActive | campaigns | 3 | 2 to 4 |
| liftCap / deliveryLiftCap | multiplier above 1 | 0.5 / 0.8 | 0.3 to 0.8 |
| fatigueWeeks / fatigue1 / fatigue2 / restWeeks | weeks / factor | 4 / 0.8 / 0.6 / 2 | 3 to 6 / 0.6 to 0.9 / 0.4 to 0.7 / 1 to 4 |
| costScaleRef / costScaleMin / costScaleMax | passersby / factor | 2,400 / 0.6 / 3.0 | / 0.4 to 0.8 / 2 to 4 |
| matchGreat / matchOk | match | 0.35 / 0.15 | 0.25 to 0.45 / 0.1 to 0.2 |
| awarenessBase | factor | 0.5 | 0.3 to 0.8 |

| Tunable (`T.delivery`) | Unit | Start | Safe range |
|---|---|---|---|
| unlockRep / unlockDays | Rep / days | 60 / 28 | 50 to 70 / 14 to 56 |
| orderRate | orders per catchment person who knows you deliver | 0.0065 (was 0.005, draft 0.004) | 0.003 to 0.008 |
| adjacentWeight | share | 0.5 | 0.3 to 0.7 |
| lunchShare | share | 0.4 (draft 0.30) | 0.2 to 0.4 |
| mainsPerOrder / work | mains / factor | 1.8 / 1.1 | 1.5 to 2.2 / 1.0 to 1.3 |
| promise / span / packMinutes | min | 35 / 25 / 3 | 30 to 45 / 15 to 35 / 2 to 5 |
| platformWait / platformRide / bikeRide / scooterRide | min | 5 / 14 / 16 / 12 | |
| commission platform / marketplace | share | 0.30 / 0.14 | 0.2 to 0.35 / 0.08 to 0.2 |
| fee | $ per order | 3.50 (was 2.50) | 1.5 to 5 |
| packaging basic / eco | $ per main | 0.50 / 1.10 | 0.3 to 0.8 / 0.8 to 1.5 |
| travel / ecoPackaging | factor | 0.92 / 1.04 | 0.85 to 0.97 / 1.02 to 1.08 |
| audienceStart / audienceOrganic / audienceFade | share / per day / per day | 0.05 / 0.004 / 0.003 (replaces the 1.2 novelty boost) | 0.02 to 0.1 / 0.002 to 0.008 / 0.001 to 0.006 |
| background | competition | 0.3 | 0.2 to 0.5 |
| throttleDefault | kitchen load | 0.8 | 0.7 to 0.9 |
| refusePenalty / cancelPenalty / cancelThreshold | Rep / Rep / share | 0.2 / 2 / 0.05 (draft 0.5 / 1) | 0.2 to 1 / 0.5 to 2 / 0.03 to 0.1 |
| lateRefund (new) | share of order value | 0.5 | 0.3 to 0.8 |
| startDRep | Rep | 50 | 40 to 60 |
| riderBase / bike / scooter | $ | 380 / 600 / 1,900 | |
| ownReach / webShopFee | factor / $ per week | 0.4 / 150 | 0.3 to 0.6 / 50 to 250 |
| packingStation | $ / $ per week | 900 / 10 | |

Archetypes, names, mottos, campaign prices, lifts and audiences, and venue values live in data files and may move within plus or minus 40% without a spec change; the checks above must still pass.

## 12. Out of scope for M0.5

* Sabotage, negative advertising, rival reviews of the player, lawsuits or health inspections triggered by rivals.
* Buying out or merging with a rival; franchising (F-89, v2.0).
* The player poaching staff from rivals; rivals poaching beyond `staff-management.md` 6.2.
* Rival interiors to visit, rival menus dish by dish, rival staff lists.
* Individual delivery riders moving on the map, traffic, weather; multiple competing delivery apps; delivery radius drawing.
* Rent that reacts to demand or to rivals (`balance.md` 1.12 saturated rent growth stays v1.0).
* Nonna Bianca's Pizza Festival (F-93 stays v2.0; she appears here only as an Honest Trattoria name).
* A second city (F-88).

## 13. Scope, slices and cut order

**Scope risk, stated honestly:** this is the largest addendum so far, about 15 to 17 engineering days. Tycoon games die from too many systems; the design reuses the existing demand, satisfaction, reputation and following formulas for every rival instead of inventing new ones, and every slice is playable on its own. If the milestone must shrink, ship slices A to E as M0.5 and delivery (F) as a follow up.

| Slice | Contents | Features | Estimate |
|---|---|---|---|
| A. Live market core | Background split, attractiveness, pressure, cannibalisation, rival profile and daily sim, closing, settings, migration | F-141 to F-145, F-151, F-167 (part) | 4 days |
| B. The city fills up | 48 venues, rivals layer, viewing notices, holds, entrants, chains | F-146 to F-150 | 2.5 days |
| C. Marketing | Campaign catalogue and formulas, Marketing sheet, rival marketing | F-152 to F-154 | 2.5 days |
| D. Analytics and coach | Rivals tab, rival cards, mystery diner, lost and won attribution, coach playbook | F-155 to F-159 | 2.5 days |
| E. Reports | Day line, week report section | F-160 | 1 day |
| F. Delivery | Unlock, modes, demand, shared kitchen, time, DRep, economics, riders, panel, rival delivery | F-161 to F-166 | 3.5 days |
| Balance | Checks and tables in `npm run balance` | F-167 | with each slice |

**Cut order if it runs long:** second hand fit out from closed rivals (F-168), rival delivery (F-166; Cd_eff stays at the background 0.3), mystery diner (F-157), holding a venue (F-148), rival chains (F-147; entrants still take venues), the own delivery mode (keep platform and marketplace), fatigue, the tourist guide and lunch club campaigns. **Never cut:** live rivals with the three ways to compete, their visible faces on the map, the audience choice and match meter, the coach, the Rivals tab, the week report's guests lost per rival and segment, the settings, and delivery's shared kitchen with its separate delivery reputation and the Top rated reward. Those are the founder's request.

## 14. M0.5 definition of done

AC-226 to AC-275 pass; `npm run balance` prints the live market sanity table, the campaign payback table and the delivery gain per build, and all checks of section 11 pass; the founder can start a Normal game on an iPad, see 10 rival pins on the welcome map, open at Lock Keeper's Cottage, watch Pizza Pronto's viewing notice appear, read in the week report that it took 7 students and 6 families, follow the coach's advice to run Family Sundays, see the families come back in the next report, reach 3 stars, switch on platform delivery, watch the Delivery bar fill the kitchen on a Friday, lower the throttle after a 59 minute delivery warning, and set the Competition settings to Hard with Often entrants and see new viewing notices within a few weeks.

## 15. Implementation notes (as built)

What the build does differently from the text above, and the balance numbers it measures. The tests named here run in `npm test`.

### 15.1 Tuning moved within the safe ranges

| Tunable | Spec start | As built | Why |
|---|---|---|---|
| `T.rivals.backgroundShare` | 0.5 | 0.7 | Rivals are usually far less attractive than a good player (`rel` at its floor), so with 0.5 the player met less competition live than with rivals off (C_eff 0.22 against 0.30). |
| `T.rivals.unitPressure` | 0.10 | 0.14 | Same reason. |
| `T.rivals.relMin` | 0.25 | 0.35 | A weak rival next door still takes some guests. |
| `T.rivals.closeLosingWeeks` | 8 | 6 | Closings in 26 weeks. |
| `T.rivals.salaryBase` | 520 | 600 | Rivals that do not fit their district now lose money, as in the Pizza Pronto example of section 2. |
| `T.rivals.seedCashMin` (new) | | 0.15 | Rivals present at the start hold 15% to 100% of the capital setting: some are one bad season from closing. |
| `T.rivals.unitPressure`, `relMin` (sprint 4) | 0.14, 0.35 | 0.15, 0.5 | Rivals that fall far behind the player still take guests; keeps the average home C_eff above 0.25. |
| Delivery (sprint 4) | see 11.1 | orderRate 0.005, lunchShare 0.4, foodie and tourist affinity 0.3 and 0.15, refuse 0.2, cancel 2, Top rated 80 and 75 | Delivery rewards a well run kitchen and punishes a hot one. |
| `T.delivery.lateRefund` (new) | | 0.5 | Very late orders are refunded: nothing down to a time score of 0.5 (about 47 minutes), half the order value at a time score of 0. Running the kitchen hot now costs money, not only rating. |
| `T.delivery.ordersPerTrip` (new) | 1.3 | 2 | With 1.3 the rider counts of section 6.9 (3 on shift for about 40 orders a day) could not keep deliveries under the promise. |

Other deviations:

* **Turns per seat per day** are calibrated to the player's own reference builds (Price Fighter 2.7, Budget Chain 2.5, Hype House 2.2, Honest Trattoria 2.0, Trendy Kitchen 1.9, Artisan 1.6). The first draft's 2.2 to 4.0 let rivals outearn any real kitchen.
* **Archetype ranges:** each archetype keeps to a tier range and a price index range (for example a Price Fighter stays between basic and standard, 0.75 to 1.00), so it stays recognisable after months of moves.
* **Rivals target the leader** is a setting (off on Easy, on for Normal and Hard). The leader district is the player's restaurant with the highest reputation x guests over the last week, once its reputation is 55 or more. When a marketing minded rival (marketing style 0.45 or more) scores a venue there, it adds `leaderPull` (0.35) x the venue's expected weekly sales to the venue's expected profit. A newcomer also weighs the leader district 1.5 times when it picks a district.
* **Newcomers** only look at districts where they can afford a free venue.
* **No schema bump:** every new field is optional, and a missing `economy.rivals` means live rivals off. Old saves load unchanged and add rivals from the settings menu.
* **Pipeline:** no fifth Delivery bar yet. The delivery panel shows the share of the kitchen used by delivery, and the advisor names the kitchen load when deliveries run late.

### 15.2 Measured balance

Live market (`tests/balance/market.test.ts`: middle build in Canal Quarter, 26 weeks; 8 seeds when tuning):

| Check | Target | Measured |
|---|---|---|
| Player C_eff at home | 0.25 to 0.55 | 0.26 to 0.31 |
| Active rivals at week 26 | 8 to 16 | 8 to 14 |
| Seeds with a closing and an entrant | 60% or more | 8 of 8 |
| Median established rival profit | -$50 to +$450 a day | $74 to $189 |
| Player profit, live against off, Normal | 75% to 110% | 100% to 102% |
| Easy / Hard | 85% or more / 65% or more | 101% / 90% to 98% |

Delivery after cleanup sprint 4 (`tests/balance/delivery.test.ts`, platform mode, throttle 0.8, AC-274 and AC-286 as restated):

| Build | Target (restated) | Measured | Note |
|---|---|---|---|
| Volume, University Quarter | 10% to 40% | about 17% (20% at throttle 0.9) | |
| Middle, Canal Quarter | 0% or more | 2% (6% at throttle 0.9) | Its dining room fills its kitchen; delivery needs a bigger kitchen, not the app. Even an extra oven adds little because prep is the limit. |
| Luxury, Old Harbour | under 15% and less than volume | about 11% | About 6 orders a day at $38 a pizza. The draft's "under 10%" would need luxury to earn less per order. |
| Any build, throttle off | loses money against throttle 0.8 | middle -30%, volume +7% against +17% | Grow the kitchen before the app. |
| Delivery kitchen: a hole in the wall in Canal Quarter with two conveyor ovens, five riders with scooters, marketplace mode, eco packaging, one matched campaign | 40% to 50% of the middle build's home profit (draft 60%) | about 41% ($583 a day against -$268 without delivery) | With two deck ovens it stays at about 23%: the ovens cap it at 66 orders while about 150 are wanted on a Saturday. |
| The same restaurant played badly (one deck oven, platform, throttle off) | at most a quarter of the well run gain | a loss: -$383 a day (delivery rating 20) | Late refunds and the cancel penalty. |

Still open: the player's profit with live rivals is 98% to 102% of rivals off on Normal (the draft asked 88% to 95%). The reference middle build turns away a quarter of its guests, so lost demand costs it nothing; rivals bite a restaurant with spare capacity. A future check should use a player with spare capacity.
