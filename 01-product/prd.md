# PRD: Pizza D

* Status: Draft 1, ready for solution architecture handoff
* Owner: Game Product Management
* Date: 2026-09-26
* Companion files: `features.md`, `versions.md`, `acceptance-criteria.md`, `balance.md`

"Pizza D" is an original title inspired by Pizza Tycoon (MicroProse, 1994, sold as "Pizza Connection" in Europe), which is someone else's IP.

### Founder decisions (2026-09-26, supersede anything below that conflicts)

* **Name:** Pizza D (Q1 closed).
* **Business model:** free to play in full. No price, no in-app purchases, no ads, no premium currency (Q2 and Q3 closed; 10.1 updated).
* **Platform:** browser only. Played in Safari or Chrome on iPad and in any modern desktop browser, installable to the home screen as a web app. **No native app and no App Store build.** App Store, TestFlight and Apple Pencil hover items become "where the browser supports it" or are dropped.
* **Saves:** cloud saves from v0.1, so a game started on iPad continues in a desktop browser and back. The game stays fully playable offline and syncs when online (Q4 closed; A3 and A4 updated).

---

## 1. Vision

Start with one small pizzeria in a warm, fictional European city and grow it, at your own pace, into a beloved local chain. You design the pizzas and choose how good every ingredient is, pick suppliers, save up for the kitchen of your dreams, lay out the dining room, hire the people and watch evening service glow. Will you become the candle-lit trattoria by the harbour where foodies book weeks ahead, or the buzzing slice hall that feeds half the university at lunch? Later you hand the day to day to managers you trust and think like a restaurateur: which district next, which dishes define the brand, how to buy smarter across all locations.

It is the business depth of the 1994 original with the calm of Stardew Valley and the readable charm of Two Point Hospital, built for touch on iPad, for adults, sold once with no tricks.

### 1.1 Design pillars

1. **Cosy, never punishing.** No game over. Setbacks arrive slowly, are visible early, and always come with a path back. Pause is always available.
2. **Craft you can taste.** Recipes, ingredient choices, kitchen and rooms are personal expression. The player should feel proud of "their" Margherita and "their" dining room.
3. **Your restaurant, your strategy.** Luxury and high volume are both real, profitable paths with different rhythms; the choice shows in ingredients, equipment, prices, district and room.
4. **Every number explains itself.** Any metric can be tapped to see its cause in plain language. Depth for Priya, calm summaries for Maya.
5. **From hands-on to hands-off, made for the sofa.** Early game is craft, late game is strategy and delegation. Touch first, landscape iPad, 15 to 30 minute sessions with natural stopping points and a recap on return.

### 1.2 The feeling

Warm light on a busy Friday dinner, the murmur of happy guests, the crackle of the wood fired oven you saved three weeks for, a 5 star review that mentions your new basil. The satisfaction of a problem understood and solved. Never the panic of a timer.

---

## 2. Problem and opportunity

**Problem.** Adults who enjoy management games on tablets have two weak options:

* Mobile restaurant games (Good Pizza Great Pizza, Cooking Fever, idle tycoons) are reflex or timer driven, shallow, and monetised with ads, energy and IAP.
* Deep business sims (the original Pizza Tycoon, Restaurant Empire, Two Point) live on PC with mouse and keyboard UIs and often lean stressful.

**For whom.** iPad owners aged roughly 25 to 55 who play in the evening or at weekends to unwind, like planning and optimising, and will pay once for quality.

**Evidence and comparable titles** (public signals; figures to be verified by marketing before greenlight):

* Cosy and management games are a large, durable category: Stardew Valley (tens of millions sold across platforms, including a premium iOS version), Two Point Hospital and Two Point Campus, PlateUp!, and cafe or bakery sims that regularly chart on Steam.
* Premium management ports sell on iOS at 5 to 15 USD: Stardew Valley, RollerCoaster Tycoon Classic, Game Dev Tycoon, Mini Metro, Prison Architect.
* Nostalgia is alive: Pizza Connection 3 (2018) and ongoing fan communities for the original show appetite for the "pizza empire" fantasy.
* App Store reviews of free-to-play cooking games repeatedly complain about ads, energy timers and pay walls. That is our positioning gap: depth plus respect.

A light discovery sprint (survey of 300 target players plus 8 interviews) should run in parallel with architecture to validate price and session length.

---

## 3. Personas and play patterns

| Persona | Who | Play pattern | Wants | Drives design of |
|---|---|---|---|---|
| **Maya, 36, the unwinder** (primary) | Product designer, loves Stardew and Animal Crossing | 30 to 60 min on the sofa, 4 evenings a week, mostly at 1x | Beautiful room, happy guests, a menu she is proud of; drawn to the luxury path | Build mode, ambience, quality equipment, audio, cosy tone |
| **Tom, 48, the returning tycoon** (primary) | Played Pizza Tycoon and Transport Tycoon in the 90s | 20 min on the train on weekdays, 2 hour weekend sessions, often at 4x | Empire, profit, clear P&L, delegation; drawn to the volume path | Chain, finance, managers, volume equipment |
| **Priya, 29, the optimiser** | Data analyst, plays Factorio and Two Point | Long sessions, pauses constantly, rebuilds layouts | Transparent formulas, overlays, records, bottleneck hunting | Analytics, kitchen throughput panel, "why" panels |
| **Linda, 57, the casual tablet player** | Plays word games, cooks at home | 15 min at a time, irregular | Recognisable ingredients, large text, forgiving controls | Accessibility, onboarding, simple view |

Scope decisions favour Maya and Tom. Priya shapes transparency, Linda shapes accessibility.

---

## 4. Core loop

### 4.1 Time scale (tuning assumption)

* 1 in-game minute = 0.5 real seconds at 1x.
* A service day runs 09:00 to 23:30. Lunch service 11:30 to 14:30, dinner 18:00 to 22:30. Quiet hours (15:00 to 17:30 and after close) auto fast forward.
* A full day at 1x is about 6 real minutes; at 4x about 1.5 minutes.
* 1 week = 7 days, 1 season = 4 weeks, 1 year = 4 seasons = 112 days.

### 4.2 Loops at four time scales

| Scale | Duration | Player verbs | Feedback |
|---|---|---|---|
| **Moment to moment** | Seconds | Watch, tap to inspect, drag a server to a section, comp a dessert, open or close a table | Guest thought bubbles, emotes, cash chime, oven ding, queue icons, live wait timers, oven slot lights |
| **Service day** | 5 to 8 min | Morning prep: check stock and deliveries, order ingredients, tweak prices, set daily special, adjust staff. Then watch service | End of day summary: covers, revenue, profit, satisfaction, bottleneck, top reviews, waste, one advisor tip |
| **Week / season** | 45 min to 3 h | Hire and train, redesign the room, save for and install equipment, change ingredient tiers, add recipes, change suppliers, take a loan | Weekly P&L, reputation graph, savings goal progress, district trend card, milestone unlocks |
| **Long term** | 20+ h | Commit to a strategy per location, open locations, hire managers, set chain menu and policies, central purchasing, new districts and (v2.0) cities | Chain map, brand reputation, career rank, chain P&L, trophies |

### 4.3 Walkthrough of one typical session (Maya, day 23, one location)

1. Maya opens the app. A **recap card** says: "Welcome back. Friday, week 4 of Spring. Yesterday: 71 guests, profit $310, a review loved the new Funghi. Pending: mozzarella delivery at 09:00. Saving for: Stone Hearth Oven, $4,100 of $6,000."
2. Morning prep, auto paused. A yellow stock chip shows basil will run out tonight. She orders Premium basil from Green Valley Farm (2 day lead) and sets tonight's special to a basil free pizza.
3. She presses play at 2x. Lunch is calm. She taps a table with a sad face: "Waited 16 min for our pizza". The kitchen panel shows the deck oven at 100% for 40 minutes of dinner. The advisor notes that a Double Deck Oven would double oven capacity, while the Stone Hearth she is saving for would add quality but no capacity.
4. She decides her restaurant is going upmarket. In the recipe designer she switches the Margherita's mozzarella from Standard to Premium: quality 61 to 68, food cost $2.40 to $3.12, mozzarella shelf life 5 to 4 days; the fair price moves from $12.50 to $14.10.
5. Dinner at 1x with warm lamps and music. The summary shows satisfaction up 3 points and one Foodie review.
6. The week ends. A skill 7 chef with the trait "Perfectionist" appears on the hiring board. The impact card reads "+9 dish quality, unlocks full bonus of artisan equipment, +$380 per week". She hires.
7. The next milestone unlocks the Proving Cabinet. She closes the app at the natural stopping point; the game autosaves.

---

## 5. System specifications

All formulas are **starting tuning assumptions** for prototyping. Every constant lives in data files designers can edit without code changes. The full parameter table and worked examples are in `balance.md`. Currency is shown as "$" as a placeholder for a localisable neutral currency.

**Simulation authority.** The visible restaurant runs an agent level simulation (individual guests and staff). The aggregate formulas below are the design reference and are also used for off-screen locations. The agent simulation must reproduce the aggregate reference builds in `balance.md` within 10% on covers and revenue per day; if they disagree, design retunes constants.

### 5.1 City and property

> **M0.5 update:** `competition.md` grows the city map from 24 to 72 venues and fills it with live rival pizzerias (six archetypes that compete on price, quality, marketing or a mix) that occupy venues, announce viewings 7 days ahead, expand into small chains, struggle and close; new rivals can enter later. The player can hold a free venue for 28 days. Rival count, skill, start capital and new entrants are set in a new Competition group of the settings menu. Where it conflicts with this section, the addendum wins.

* **Loop:** long term (where to open) and the very first decision of the game.
* **Verbs:** browse districts, compare properties, lease, buy (v1.0), close or move.
* **Rules:**
  * v0.1: 3 districts. v1.0: 6 districts in city 1. v2.0: second city.
  * Each district has daily foot traffic `T`, segment mix (six shares summing to 1), wealth index `W` (0.8 to 1.3, scales what guests are willing to pay), rent per grid tile per week, competition `C` (0 to 1), lunch share, lunch and dinner rush peaks, seasonal modifiers.
  * v0.1 districts (starting values, full table in `balance.md`):
    * **University Quarter:** T 6,000, 60% students, W 0.8, rent $8 per tile, C 0.40. Volume territory.
    * **Canal Quarter:** T 2,400, balanced mix, W 1.0, rent $11 per tile, C 0.30. Starter district, suits the middle ground.
    * **Old Harbour:** T 2,600, 30% foodies and 30% tourists, W 1.3, rent $19 per tile, C 0.25. Luxury territory.
  * The three recommended starter properties are two in Canal Quarter and one in University Quarter; Old Harbour properties are available from day 1 but marked "ambitious".
  * Each property has a dining grid, a kitchen grid, and lease terms (deposit 8 weeks rent). Starter properties come with a basic kitchen (1 deck oven, 2 prep counters, 1 fridge, 1 sink). Purchase price from v1.0.
* **Feedback:** district card with segment pie, wealth, traffic, rent, competition, "good for" tags (cheap eats, date night) and a projected guests per day range for the player's current menu and price.
* **Failure and recovery:** a poor district choice is recoverable: adapt the concept to the local segments, or close and move (lease break fee 4 weeks rent). The projection warns before signing.

### 5.2 Ingredients and quality tiers

* **Loop:** week (sourcing decisions) and craft expression. A core lever of the luxury vs volume choice.
* **Verbs:** choose the tier of each ingredient per recipe, choose the supplier per ingredient and tier.
* **Rules:**
  * Every ingredient exists in up to four tiers. The player picks the tier **per ingredient per recipe** (a pizza can use Artisan mozzarella and Basic flour). One ingredient may be stocked in two tiers at once; each tier is its own stock line.

| Tier | Base quality | Price multiplier | Shelf life multiplier | Typical waste | Who stocks it (v0.1) |
|---|---|---|---|---|---|
| Basic | 35 | x0.70 | x1.3 | 3% | Fratelli Market, Metro Wholesale |
| Standard | 55 | x1.00 | x1.0 | 5% | Fratelli Market, Metro Wholesale, Green Valley Farm (produce) |
| Premium | 75 | x1.60 | x0.8 | 7% | Metro Wholesale (dry goods, cured meats), Green Valley Farm |
| Artisan | 90 | x2.40 | x0.6 | 10% | Green Valley Farm (produce, dairy); Casa Artigiana (v1.0: cheeses, cured meats, heritage flour) |

  * Supplier quality offset on top of tier quality: Fratelli -3, Metro 0, Green Valley +3, Casa Artigiana +5.
  * Artisan ingredients add the taste tag "artisan"; Premium and Artisan produce in season add "seasonal" and +5 quality (v1.0).
  * Standard reference costs per pizza portion: dough $0.45, tomato sauce $0.40, mozzarella $1.20, basil $0.25, olive oil $0.10 (Margherita $2.40 at all Standard).
* **Feedback:** tier selector on each ingredient in the recipe card showing the delta it causes (quality, cost per portion, shelf life, fair price) before confirming; supplier availability badges.
* **Failure and recovery:** Artisan stock spoils fast; the stock screen shows days of cover and the waste log names the tier and cost of anything thrown away. Switching a tier is instant for future dishes.

### 5.3 Menu and recipes

* **Loop:** service day (pricing) and week (new recipes). Main expression system.
* **Verbs:** create recipe, drag ingredients onto a pizza, set each ingredient's tier, set price, add to menu, set daily special, retire dish.
* **Rules:**
  * Pizza = dough + sauce + cheese + 0 to 6 toppings. Starters, drinks and desserts use preset recipes where the player picks ingredient tiers.
  * Menu holds 4 to 16 items. v0.1 has 25 ingredients; v1.0 about 60.
  * Taste tags: cheesy, spicy, classic, artisan, veggie, seasonal, kid friendly, meaty. A harmony data table lists matching pairs (tomato + basil) and clashing pairs (pineapple + anchovy).
* **Formulas:**

```
dish_quality Q (0..100) = clamp( (0.50*IQ + 0.15*H + 0.35*K) * F + E , 0, 100)
  IQ = ingredient quality averaged by portion cost weight (tier quality + supplier offset)
  H  = harmony: 60 + 10 per matching pair - 15 per clashing pair
       - 10 per topping beyond 4, clamped 0..100
  K  = kitchen skill = 30 + 7*skill of the preparing cook (1..10)
       + 5 if a chef whose specialty matches the dish is on shift
  F  = freshness: 1.00 normally, 0.90 if any ingredient is in its last 25% of shelf life
  E  = equipment quality modifier (see 5.5), clamped -6..+15

food_cost   = sum(portion qty * unit price at chosen tier and supplier)
fair_price  = 4 + 0.08*Q + 1.5*food_cost
```

* **Feedback:** live recipe card with Q and its four contributors, cost, harmony stars, fair price band (0.9 to 1.1 x fair price), margin %, and per-segment appeal bars. Dish report shows sales, average satisfaction and profit per dish.
* **Failure and recovery:** an unpopular dish simply sells little; the dish report flags it after 3 days with a suggestion. Experimenting is never penalised.

### 5.4 Purchasing and logistics

* **Loop:** service day (morning prep) and week (supplier choice). Later automated as a reward.
* **Verbs:** compare suppliers, place order, set par levels and standing orders (v1.0), set up central purchasing (v1.0), discard spoiled stock.
* **Rules:**
  * Supplier stats: price index, tiers carried per product, quality offset, reliability (chance a delivery arrives complete and on time), lead time, minimum order.
  * v0.1 suppliers: **Fratelli Market** (price x1.00, Basic and Standard, reliability 0.85, lead 1 day, no minimum), **Metro Wholesale** (price x0.90, Basic to Premium dry goods and cured meats, reliability 0.97, lead 2 days, $300 minimum), **Green Valley Farm** (price x1.10, Standard to Artisan produce and dairy, reliability 0.92, lead 2 days, $150 minimum).
  * Unreliable deliveries arrive the next day (70%) or 50% complete (30%). Never lost entirely.
  * Storage capacity in units: dry shelf 200, fridge 120, freezer 80, walk-in cold room 400 (v1.0). Deliveries beyond capacity are refused at the door with a clear message and a refund.
  * Stock is used first in, first out. Shelf life = ingredient base shelf life x tier multiplier (x1.25 in a walk-in cold room). Expired stock becomes waste.
  * Standing orders (v1.0): top up to par level every N days from a chosen supplier.
  * Loyalty (v1.0): each consecutive 4 weeks with the same supplier gives 2% discount, capped at 8%.
  * Central purchasing (v1.0): chain contract gives 5% volume discount at 3 participating locations, 10% at 6.
* **Feedback:** stock screen with days of cover per stock line (green over 3 days, amber 1 to 3, red under 1), deliveries timeline, waste log in money with cause and tier, supplier scorecards (on time %).
* **Failure and recovery:** a stock-out auto marks affected dishes "sold out"; guests choose another dish (satisfaction -5 for that party) and the advisor proposes an emergency order from Fratelli (1 day lead, +20% price). No closure.

### 5.5 Kitchen equipment

* **Loop:** week and season (saving up is a mid term goal) and long term (equipment defines the restaurant's strategy).
* **Verbs:** browse catalogue, set a savings goal, buy and place, sell (80% refund), upgrade, compare in the kitchen throughput panel.
* **Three families plus artisan gear:**
  * **Volume equipment:** more servings per hour, little or no quality gain (sometimes a small quality cost). Speed barely depends on cook skill, so cheaper staff can run it.
  * **Quality equipment:** raises dish quality, volume neutral.
  * **Hybrid equipment:** both, expensive and unlocked late.
  * **Artisan equipment** (a quality sub-family): the highest quality bonus but **lower throughput than basic gear**, and it needs a skilled cook to reach its full bonus.
* **Catalogue (starting values; full table with maintenance and unlocks in `balance.md`):**

| Item | Family | Price | Servings per hour at skill 5 | Quality mod | Kitchen footprint | Maintenance per week | Unlock |
|---|---|---|---|---|---|---|---|
| Deck Oven | Basic | $2,400 | 20 | 0 | 2x2 | $40 | Start |
| Double Deck Oven | Volume | $5,500 | 40 | -1 | 2x2 | $70 | Serve 500 guests |
| Conveyor Oven | Volume | $8,500 | 45 | -3 | 3x2 | $110 | Rank Owner |
| Stone Hearth Oven | Quality | $6,000 | 20 | +5 | 2x2 | $60 | Location Rep 40 |
| Wood Fired Oven | Artisan | $11,000 | 12 | +10 (skill 7 needed) | 3x3 | $150 | Location Rep 55 |
| Master Dome Oven (v1.0) | Artisan | $19,000 | 14 | +14 (skill 9 needed) | 3x3 | $180 | Rank Restaurateur and Rep 75 |
| Twin Chamber Combi Oven (v1.0) | Hybrid | $24,000 | 47 | +5 | 3x2 | $220 | Rank Chain Founder |
| Prep Counter | Basic | $1,200 | 30 dishes | 0 | 2x1 | $10 | Start |
| Dough Sheeter | Volume | $2,500 | x1.35 prep at its counter | -2 | 1x1 | $25 | Serve 500 guests |
| Heat Lamp Pass | Volume | $1,500 | serve time x0.7 | -1 | 2x1 | $10 | Day 5 |
| Dish Machine | Volume | $4,000 | dishwashing x1.8 | 0 | 1x2 | $40 | Day 8 |
| Proving Cabinet | Quality | $3,500 | neutral | +3 | 1x1 | $30 | Location Rep 40 |
| Marble Bench | Quality | $4,000 | 30 dishes (replaces counter) | +2 | 2x1 | $10 | Location Rep 45 |
| Hand Stretch and Mozzarella Station (v1.0) | Artisan | $7,500 | x0.8 prep (replaces counter) | +5 (skill 6 needed) | 2x1 | $60 | Location Rep 60 |
| Pro Prep Line (v1.0) | Hybrid | $12,000 | x1.4 prep (replaces counter) | +2 | 3x1 | $90 | Rank Chain Founder |
| Walk-in Cold Room (v1.0) | Storage | $9,000 | 400 units, shelf life x1.25 | 0 | 3x3 | $60 | Rank Restaurateur |

* **Formulas:**

```
oven servings per hour = slots * 60 / (12 min * bake_multiplier) * speed
  bake_multiplier: deck 1.0, double deck 1.0, conveyor 0.55, stone hearth 1.0,
                   wood fired 1.25, master dome 1.1, twin chamber 0.85
  slots:           deck 4, double deck 8, conveyor 5, stone hearth 4,
                   wood fired 3, master dome 3, twin chamber 8
speed (basic, quality, artisan, hybrid gear) = 0.7 + 0.06 * cook skill
speed (volume gear)                          = 0.9 + 0.02 * cook skill
prep dishes per hour  = 30 * speed * tool multiplier, one cook per counter
prep load per cover   = 1 + 0.4 * (starter attach + dessert attach)
kitchen capacity per hour = min( sum of oven servings, sum of prep dishes / prep load )

E (equipment quality mod for a dish) = quality mod of the oven that bakes it
                                     + quality mods of prep tools at its station
artisan skill rule: if cook skill < required skill, the item's quality mod is scaled
                    by skill / required and its speed by 0.9
```

* **Feedback:** kitchen throughput panel (servings per hour per station, current bottleneck highlighted, utilisation during last service), equipment card comparing "your kitchen now" vs "with this item" (servings per hour, Q on each menu dish, weekly cost), savings goal pinned to the HUD.
* **Failure and recovery:** buying the wrong item costs only 20% (resale at 80%). The advisor warns before a purchase that does not address the current bottleneck ("Your seats are the limit, not the oven").

### 5.6 Dining room builder

* **Loop:** week (redesign) and expression; drives seats, flow and ambience.
* **Verbs:** place, rotate, move, sell (80% refund), undo, copy layout (v1.0 blueprint to another location), choose floor and wall finishes.
* **Rules:**
  * Square grid. Build mode pauses time. Items have footprint, cost, ambience points and (v1.0) style tag (Rustic, Modern, Retro).
  * Tables: 2-top, 4-top, 6-top, booth for 4 (+1 comfort).
  * Required for opening: at least 1 table, 1 oven, 1 prep counter, 1 fridge, 1 sink, entrance reachable, every table reachable from the kitchen pass by a path 1 tile wide.
  * Ambience:

```
ambience (0..100) = clamp( 25 + 5 * (decor points per 10 dining tiles)
                  + style_set_bonus (0..15, v1.0)
                  + lighting_bonus (0..10)
                  - 5 per table with no free tile beside it
                  , 0, 100)
```

* **Feedback:** live cost, seat and ambience deltas while dragging; red footprint when invalid; overlays for reachability, congestion heat map (last service) and ambience.
* **Failure and recovery:** invalid layouts cannot be confirmed (clear reason); unreachable tables are blocked at placement. Selling is always possible at 80%.

### 5.7 Guests, demand, service and turnover

> **M0.5 update:** `competition.md` replaces the static `C_eff` with a per segment value: background competition (half the district number plus the venue delta) plus live pressure from each rival in reach (0.10 x proximity x relative attractiveness, clamped 0.25 to 2.5) plus 0.2 per other own restaurant in the district, capped at 0.9 as before. Marketing campaigns multiply demand per segment (`mkt_s`, up to 1.5). Food delivery (from Rep 60) adds orders that share the oven and prep line with the dining room, with its own delivery time and delivery reputation. With live rivals off the formula here is unchanged. Where it conflicts with this section, the addendum wins.

* **Loop:** moment to moment and service day. The heart of the simulation.
* **Verbs:** set opening hours, assign server sections (v1.0), comp a dessert, open or close tables, inspect anyone.
* **Customer segments (starting values):**

| Segment | Price elasticity e | Budget per main B | Quality appeal qa | Wait tolerance (min) | Meal length (min) | Avg party | Liked tags |
|---|---|---|---|---|---|---|---|
| Students | 2.0 | $10 | 0.0 | 10 | 25 | 3.0 | cheesy, spicy, meaty |
| Families | 1.5 | $12 | 0.1 | 12 | 40 | 3.8 | classic, kid friendly |
| Professionals | 1.0 | $16 | 0.35 | 8 lunch, 15 dinner | 30 lunch, 50 dinner | 2.2 | classic, veggie |
| Foodies | 0.6 | $24 | 1.0 | 20 | 60 | 2.0 | artisan, seasonal |
| Seniors | 1.2 | $15 | 0.3 | 15 | 50 | 2.0 | classic, veggie |
| Tourists | 0.8 | $20 | 0.5 | 15 | 45 | 2.5 | classic, artisan |

* **Demand:**

```
guests_per_day(s) = T * share_s * capture_base * rep_mult * season_mult * weekday_mult
                    * menu_fit_s * price_mult_s * budget_mult_s * quality_mult_s
                    * speed_mult_s * (1 - 0.5*C_eff)

capture_base   = 0.035
rep_mult       = 0.5 + Rep/100                                   (0.5 .. 1.5)
season_mult    = per district and season, 0.85 .. 1.15
weekday_mult   = Mon 0.80, Tue 0.85, Wed 0.90, Thu 1.00, Fri 1.25, Sat 1.35, Sun 1.10
menu_fit_s     = 0.6 + 0.8 * mean taste match of the 5 best dishes for s (0..1)
r              = average main price / average fair price (sales weighted)
price_mult_s   = clamp(r^(-e_s), 0.2, 1.5)                        relative value
budget_mult_s  = clamp((B_s * W / average main price)^2, 0.1, 1.2) absolute affordability
quality_mult_s = clamp(1 + qa_s * (Q_menu - 60)/50, 0.3, 1.6)     attraction to quality
speed_mult_s   = clamp(20 / service_time, 0.8, 1.25) for Students and Professionals
                 at lunch only; 1.0 otherwise                      attraction to speed
C_eff          = district competition + 0.2 per other own location in the district (cap 0.9)
```

Arrivals are split lunch and dinner per district and released as a random stream around the rush peak. Party size is random around the segment average, 1 to 6, capped by the largest table.

* **Dish choice:**

```
appeal(d, s) = wq_s*Q/100 + 0.4*taste_match(d, s) + 0.3*value_score_s(d)
               (wq: Students 0.30, Families 0.35, Professionals 0.40,
                Foodies 0.60, Seniors 0.40, Tourists 0.35)
P(d)         = exp(3*appeal(d)) / sum over available dishes of exp(3*appeal)
attach rates: drink    = 0.80 + 0.10 * clamp((ambience - 60)/25, 0, 1)
              starter  = 0.30 + 0.20 * clamp((ambience - 60)/25, 0, 1)
              dessert  = 0.20 + 0.25 * clamp((ambience - 45)/40, 0, 1)
```

* **Service timeline and turnover:**

```
seat_time     = 2 min with a host on shift, 5 min without
order_time    = 3 min / server_speed
cook_time     = 12 min * bake_multiplier / oven speed (average of ovens in use)
serve_time    = 1.5 min / server_speed  (x0.7 with a heat lamp pass)
pay_bus_time  = 4 min / server_speed
service_time  = seat + order + cook + serve + pay_bus
table_cycle   = service_time + segment meal length (random 0.9..1.1)
server_speed  = (0.7 + 0.06*skill) * morale_mult * load_mult
load_mult     = 1.0 up to 4 tables per server, then -0.15 per extra table (floor 0.4)

seat capacity per hour    = seats * 0.75 * 60 / table_cycle   (0.75 = party size fit)
capacity per hour         = min(kitchen capacity per hour, seat capacity per hour)
service capacity          = capacity per hour * service hours * U  (U: lunch 0.60, dinner 0.65)
served                    = min(demand, service capacity); the rest walk away
utilisation rho           = demand / service capacity
kitchen queue delay (min) = min(25, 2*rho/(1-rho)), 25 when rho >= 0.95
```

* **Dishwashing:** 3 plates per cover; a dishwasher cleans 60 plates per hour x (0.7 + 0.06*skill); a dish machine multiplies by 1.8. Starting plate stock 90. At zero clean plates, serving waits (visible plate stack icon).
* **Satisfaction:**

```
S (0..100) = 100 * ( 0.40*food_score + 0.20*service_score + 0.15*ambience/100
                   + 0.15*value_score + 0.10*wait_score )
food_score    = 0.7*Q/100 + 0.3*taste_match
service_score = clamp(0.30 + 0.06*server skill + 0.10 if host on shift + trait bonus, 0, 1)
value_score   = clamp(0.7 - 0.6*(r-1)*e_s, 0, 1)
wait_score    = clamp(1 - max(0, perceived_wait - tolerance)/tolerance, 0, 1)
perceived_wait = order_time + serve_time + queue delay (x0.5 at lunch, x0.6 at dinner)
```

* **Reviews:** 20% of parties write one. Stars = round(1 + 4*S/100). Text comes from templates keyed to the highest and lowest sub-score, so every review explains itself.
* **Feedback:** thought bubbles, table wait timers, bottleneck banner ("Seats full 90% of dinner", "Oven at capacity"), service analytics (average wait, turns per table, kitchen utilisation, walk-aways by segment), per-guest satisfaction breakdown.
* **Failure and recovery:** a bad service lowers reputation only slightly (5.10). The summary names the single biggest cause and a fix. Optional comp dessert (+15 satisfaction for that party, costs the dessert's food cost).

### 5.8 Staff

> **M0.4 update:** `staff-management.md` replaces the single skill with four attributes (Quality, Speed, Composure, Mentoring) and an OVR, adds training courses and coaching, a city wide staff market, personalities that react to how the restaurant performs, staff contributions in the day and week reports, and staff policies for restaurant managers. Where it conflicts with this section, the addendum wins.

* **Loop:** week (hire, train) and long term (managers enable the chain). Every hire has a cost, a reputation and a measurable impact.
* **Roles:** chef, cook, server, host, dishwasher (v0.1); restaurant manager (v1.0); area manager (v2.0).
* **Verbs:** browse hiring board, interview (reveals the hidden trait), hire, set shifts, give raise, train, promote (cook to chef; chef or server to manager), let go (2 weeks pay).
* **Attributes:** skill 1 to 10, weekly salary, fame 0 to 3 stars, 2 traits (1 visible, 1 revealed by interview or after 1 week), morale 0 to 100, potential (hidden cap, 6 to 10), shifts per week (default 5 of 7 days; lunch plus dinner = 1 shift).
* **Formulas:**

```
weekly salary = role_base * (1 + 0.12*(skill-5)) * (1 + 0.25*fame)
role_base     = chef 900, cook 550, server 450, host 420, dishwasher 380,
                restaurant manager 1100, area manager 1800
morale_mult   = 0.85 + 0.30*morale/100
morale drift  = 3 points per day toward 70
              ; +10 once after a raise of 10% or more
              ; -2 per day for each shift above 5 in a week
              ; -1 per day while the location is understaffed (load_mult < 1)
              ; +1 per day if a staff room exists (v1.0)
fame effect   = +1.5 Rep per week per fame star (cap +5 per location)
              ; chef fame: +5% Foodie arrivals per star
skill growth  = +1 skill per 40 shifts worked, up to potential
training      = +1 skill for $600 and 3 days off the rota (v1.0)
```

* **Equipment interaction:** chef and cook skill drive K (quality) and the speed of basic, quality and artisan gear; artisan gear needs a minimum skill for its full bonus; volume gear flattens skill differences. A luxury kitchen therefore needs expensive talent, a volume kitchen can run on junior cooks.
* **Traits (8 at v0.1, 25 at v1.0):** Speedy (+15% speed), Perfectionist (+8 K, +10% cook time), Charmer (+0.05 service score), Steady (morale never below 50), Mentor (+1 skill per season to one teammate), Night Owl (+10% speed at dinner, -10% at lunch), Frugal (manager: -5% purchasing cost), Crowd Pleaser (+5% menu fit for Families). Every trait has one visible numeric effect.
* **Hiring board:** 6 new candidates per week; a fame 1+ candidate appears at most once a week and only when location Rep is 50 or more.
* **Feedback:** staff card shows the **measurable impact** as a delta vs the current rota ("+6 dish quality, -2 min average cook time, +$180 per week"), morale face, and weekly contribution.
* **Failure and recovery:** staff with morale under 30 for 7 days hand in notice with 7 days warning, which a raise or time off can reverse. Nobody quits without warning. Understaffing slows service, never closes the restaurant.

### 5.9 Restaurant manager and delegation

* **Loop:** long term. The reward that changes the kind of decisions from running a shop to running a chain.
* **Verbs:** hire manager, set policies (strategy: luxury, middle or volume; price band; ingredient tier floor; stock policy; hiring budget; equipment budget; local menu slots), review weekly report, override any decision.
* **Rules:**

```
manager skill m (1..10)
reorder accuracy     = 0.70 + 0.03*m   (1.0 = no avoidable waste and no stock-outs)
pricing              = moves prices toward the policy's target ratio by at most 5% per week
hiring               = fills vacancies within budget; picks the best of 3 candidates with p = 0.4 + 0.05*m
equipment            = proposes purchases that fit the strategy policy; player approves
profit modifier      = -10% + 2%*m versus a perfectly attentive player (m = 5 equals parity)
area manager (v2.0)  = oversees up to 4 locations; their managers act at m + 1; hires managers
```

* **What the player gives up:** manager salary ($1,100 per week base) and fine control. Override at any time.
* **Feedback:** weekly manager report card: decisions made, results vs last week, one proposal requiring approval.
* **Failure and recovery:** a weak manager underperforms visibly on the chain comparison table; coach, swap or step in.

### 5.10 Reputation

> **M0.5 update:** marketing arrives early as ten campaigns with an audience choice and an audience match score (`competition.md` 5); the foodie press night can move Rep by +2 or -1. Delivery has its own delivery reputation (DRep) that does not change this Rep. Where it conflicts with this section, the addendum wins.

```
Rep (0..100), new location starts at 30 (at 40 if chain brand Rep >= 60)
daily update: Rep = Rep + 0.05 * (review_score_today - Rep)
review_score  = average stars today * 20 (no change if no reviews)
walk-away penalty: -1 Rep if walk-aways exceed 10% of arrivals that day
critic visit (v1.0): that review counts with weight 5
brand Rep (chain) = revenue weighted mean of location Rep + marketing bonus (0..5)
star display = Rep / 20, one decimal
```

* **Loop:** week and long term; main multiplier on demand and a gate for quality equipment unlocks.
* **Feedback:** stars, 28 day graph, top drivers ("food +, waits -").
* **Failure and recovery:** Rep moves 5% of the gap per day, so one bad day costs about 2 points at most. Marketing (v1.0) gives a temporary demand boost while quality is fixed.

### 5.11 Finance

* **Rules:**
  * Starting cash $40,000. Starter loan up to $30,000 at 5% per year, repaid weekly over 104 weeks ($303.26 per week at the full amount).
  * Daily P&L lines: sales; ingredients used; waste; staff (weekly / 7); rent (weekly / 7); utilities ($30 + $0.80 per cover); upkeep ($15 + equipment maintenance per week / 7); loan interest.
  * Cash settles daily for sales, deliveries, utilities and upkeep; weekly (Sunday night) for salaries, rent and loan payments.
  * Savings goals: the player can pin any catalogue item as a goal; the HUD shows progress and projected date at the last 7 day average profit.
  * Expansion loans (v1.0) unlock at location Rep 50: up to 12 x average weekly profit of the last 4 weeks, cap $150,000, 6% per year, 3 years.
  * Buying property (v1.0) removes rent; resale at 90%.
* **P&L simple view:** Money in, Money out (ingredients, waste, staff, rent, other), Profit, and one plain sentence ("Good day. Ingredients were 26% of sales, right in the sweet spot."). Detailed view adds per dish and per category lines.
* **Failure and recovery (safety net, no bankruptcy):**
  1. Cash below $0: amber banner; payments continue; no overdraft interest.
  2. Below $0 for 7 days: the friendly bank advisor offers a **restructure**: loan payments paused 4 weeks, plus 3 concrete suggestions computed from data ("Your food cost is 44%. Switching mozzarella from Artisan to Premium saves $210 a week").
  3. Below -$20,000: sell equipment or furniture, close a location (recover 50% of fit-out value), or take a **fresh start** (keep unlocks, recipes and blueprints; restart with one location and $40,000). The game never ends.

### 5.12 Chain

> **M0.5 update:** cannibalisation (0.2 per other own restaurant in the district) is implemented as part of the live competition formula in `competition.md` 2.1; local radio lifts every restaurant the player owns; the week report gives each managed restaurant a compact competition summary. Where it conflicts with this section, the addendum wins.

* **Rules:**
  * v1.0: up to 6 locations in city 1. v2.0: second city.
  * Opening a location requires Rep 50 at an existing location. Locations the player is not viewing run under their restaurant manager; without one they run in **caretaker mode** (last settings repeated, profit modifier -20%, only standing orders).
  * Each location has its own strategy (luxury, middle, volume), so a chain can mix a harbour trattoria with a university slice hall.
  * **Chain vs local menu:** dishes marked "chain" share recipe, tiers and price band everywhere (+0.05 menu fit for returning guests where brand Rep is 60 or more); 4 local slots per location by default.
  * **Central purchasing:** see 5.4.
  * **Cannibalisation:** each extra own location in the same district adds 0.2 to effective competition there.
  * **Off-screen simulation:** aggregate formulas per day (see simulation authority note).
* **Feedback:** chain map with location cards (stars, strategy badge, weekly profit, manager face), comparison table, chain P&L.

### 5.13 Progression, milestones and optional rival

> **M0.5 update:** the static neutral competition described below is replaced by live rivals (`competition.md` 3), on by default and switchable off in settings. They keep the spirit of this section: no sabotage, no price below 0.75 of fair, no endless price wars. Nonna Bianca appears as an Honest Trattoria; her Pizza Festival stays at v2.0 (F-93).

* **Career ranks:** Cook, Owner, Restaurateur, Chain Founder, Pizza Icon, reached through milestones ("Serve 500 guests", "Reach 3.5 stars", "Hire a chef", "Open a second location", "Earn $10,000 profit in one week").
* **Unlocks** come from milestones and reputation, never payment: ingredients, tiers from new suppliers, equipment, furniture sets, districts, loan tiers.
* **Optional friendly rival (v2.0; default on or off is Q8):** "Nonna Bianca" runs a small rival chain that opens in some districts (adds competition) and hosts a seasonal Pizza Festival judged on one submitted recipe; winners get brand Rep and a unique decor item. No sabotage, no price wars, no poaching. Justification: the original's competition was part of its charm; a warm named rival gives mid game goals and personality without stress. Toggle in settings; when off, competition comes only from static neutral restaurants.

---

## 6. Economy

### 6.1 Sources and sinks

| Resource | Sources | Sinks |
|---|---|---|
| **Cash** | Food and drink sales; starter and expansion loans; equipment and furniture resale (80%); property resale (90%); festival prize (v2.0) | Ingredients (tier choice is the main dial); waste; salaries; rent; utilities and upkeep; equipment maintenance; equipment and furniture purchases; deposits; loan repayments and interest; training; marketing; raises; lease break fees |
| **Reputation** | Good reviews; fame staff; critic praise; marketing (temporary); festival win | Poor reviews; walk-aways over 10%; stock-outs (via satisfaction) |
| **Ingredients** | Supplier deliveries | Dishes cooked; spoilage (faster at higher tiers); refused deliveries |
| **Kitchen capacity** | Equipment purchases; cook skill (non volume gear) | Artisan gear (lower throughput); understaffing; low morale |
| **Staff skill** | Experience; training; Mentor trait | Replacement hires |
| **Morale** | Raises; normal drift; staff room; days off | Overwork; understaffing |
| **Unlocks** | Milestones, reputation | none (permanent) |

### 6.2 Strategies: luxury, volume and the middle ground

Two distinct strategies must both be viable and able to "win" (reach top tier profit), by different routes. The middle ground is possible but not dominant.

| | Luxury | Middle ground | High volume |
|---|---|---|---|
| Ingredients | Premium and Artisan | Standard and Premium | Basic and Standard |
| Equipment | Quality and artisan (wood fired oven, proving cabinet) | Basic plus one quality item | Volume (conveyor ovens, dough sheeters, heat lamp pass, dish machine) |
| Staff | Skilled chef and cooks (skill 7+), fame helps | Mid skill | Junior cooks (skill 4), more servers |
| Room | Spacious, high ambience (80+), fewer seats | Balanced | Dense, many seats, ambience about 45 |
| Price | High ($24 to $30 main) | $12 to $16 | Low ($8 to $10) |
| Guests | Foodies, tourists, affluent professionals | Everyone a little | Students, families, lunch professionals |
| Best district | Old Harbour (W 1.3) | Canal Quarter (mixed) | University Quarter (T 6,000) |
| Covers per day | about 100 | about 140 | about 360 |
| Rhythm | Calm, long dinners, capacity bound at dinner, price it up | Steady, forgiving | Intense lunch rush, fast turns |

**Reference result (from `balance.md`, steady state, Thursday):** luxury in Old Harbour about **$2,064 profit per day**; volume in University Quarter about **$1,984**; middle ground in Canal Quarter about **$1,120**, and never better than 80% of the specialist in the specialist's home district. Outside their home districts specialists struggle (luxury in University Quarter loses money; volume in Old Harbour loses money), while the middle ground earns $1,100 to $1,600 everywhere. So the middle ground is the safe, forgiving choice with a lower ceiling; specialists have higher ceilings but must match their district.

**Why neither specialist strictly dominates:** the formulas give each a lever the other cannot use. Luxury gets `quality_mult` (up to 1.6 for foodies) and `budget_mult` headroom from wealthy districts, and turns scarce capacity into high prices. Volume gets `budget_mult` and `speed_mult` from price and time sensitive segments, and huge capacity from volume equipment run by cheap staff. Each strategy's key segments are rare in the other's home district.

### 6.3 Runaway and dead end checks

* **Runaway (late game snowball):** bounded by district cannibalisation, rent rising 5% per season in saturated districts, manager and area manager salaries, maintenance on large kitchens, and diminishing brand Rep returns. Late spending moves to expression (premium decor, signature ovens, second city).
* **Dead end:** impossible by design (safety net, caretaker mode, fresh start). The minimum viable restaurant (60 tile property, 2 four-top tables, 1 deck oven, 1 prep counter, 1 cook and 1 server of skill 4, Basic and Standard ingredients, priced at fair price) must break even at Rep 30 in Canal Quarter and University Quarter (automated balance test; reference results +$33 and +$93 per day). Old Harbour is flagged "ambitious" on its district card because rent makes a minimal restaurant lose about $55 per day there; none of the three recommended starter properties is in Old Harbour.

### 6.4 Dominant strategy risks and counters

| Risk | Why it could dominate | Counter in design |
|---|---|---|
| Rock bottom prices | Demand rises as price falls | `price_mult` capped at 1.5, `budget_mult` capped at 1.2; capacity limits the gain; margin collapses |
| Max tier ingredients everywhere | Q drives satisfaction and quality appeal | Cost x2.4 and 10% waste; value segments cannot afford the resulting fair price; artisan gains only pay where W and foodie share are high |
| Middle ground everywhere | Robust in every district | Lower ceiling: at most about 80% of the specialist's profit in specialist districts (acceptance criterion) |
| Artisan equipment always | Highest quality | Lower throughput; needs skill 7+ staff; high maintenance |
| Volume equipment always | Most capacity | Quality penalty lowers appeal to affluent segments; capacity is worthless without demand |
| Cram in tables | More seats | Crowding penalty on ambience; server load penalty; kitchen becomes the bottleneck |
| Always hire the highest skill | Skill boosts everything | Salary grows 12% per skill point plus fame premium; volume gear flattens skill |
| One perfect pizza only | Highest appeal wins | `menu_fit` uses the top 5 dishes; regulars' novelty drops 5% per season without a new dish (cap 15%) |
| Many locations in the best district | Best demand | Cannibalisation raises effective competition 0.2 per location |

---

## 7. Progression and unlock ladder

| When (play time) | In-game | What the player can do | New systems revealed |
|---|---|---|---|
| **First 10 minutes** | Day 1 | Pick 1 of 3 recommended starter properties; place tables from a starter pack; set 4 preset pizzas and prices from suggestions; run the first lunch | Time controls, build mode basics, service, end of day summary |
| **First hour** | Days 2 to 9 | Recipe designer with ingredient tiers, orders from 3 suppliers, hiring board, first savings goal, heat lamp and dish machine, first weekly P&L | Purchasing, spoilage, staff impact, reviews, reputation, kitchen throughput |
| **First 5 hours** | Weeks 2 to 8 | Commit to a direction: stone hearth or double deck oven, proving cabinet or dough sheeter, chef hire; wood fired oven at Rep 55; expansion loan at Rep 50; restaurant manager; second location | Strategy choice, manager delegation, standing orders, chain overview |
| **First 20 hours** | Year 1 to 2 | 4 to 6 locations with mixed strategies, chain menu, central purchasing, all districts, hybrid equipment, critic visits; (v2.0) area manager, second city, rival festival | Chain P&L, policies, brand Rep |

Late game changes the kind of decision: from "where does this table go" to "which manager runs Old Harbour and does our University slice hall share the chain's Margherita".

---

## 8. Onboarding and tutorial

* A **guided first week** (7 in-game days, about 35 minutes) led by a warm mentor (a retired pizzaiolo). One new system per day: Day 1 layout and service, Day 2 menu and pricing, Day 3 ordering, tiers and spoilage, Day 4 reviews, Day 5 hiring, Day 6 P&L and savings goals, Day 7 goals and the two strategies ("Harbour or University? You can do either, or something in between").
* Each step is skippable, as is the whole tutorial; skipped topics remain in a "Mentor's notebook".
* No forced wrong choices; the tutorial never takes control away for more than one step.
* Contextual advisor tips at most once per in-game day unless asked.
* "Simple" vs "Detailed" numbers setting.
* Return recap card on launch after 12 real hours away (setting to show every launch).

---

## 9. Presentation direction

* **Art:** warm, stylised, readable at a glance; isometric 2.5D or angled top-down (Q9). A full starter dining room plus kitchen must be legible on an 11 inch iPad at default zoom. Luxury and volume kitchens look and sound different (wood fire glow vs conveyor hum).
* **Time of day:** continuous lighting from morning light to golden hour to lamp lit dinner.
* **Seasons (v1.0):** visual dressing, district demand modifiers, seasonal ingredients (spring asparagus, summer basil +5 quality, autumn porcini, winter truffle).
* **Audio:** adaptive acoustic music by time of day; ambient chatter scaling with occupancy; kitchen sounds per equipment; soft UI sounds; no alarms or sirens.
* **Feel:** satisfying snap on placement, flour puff on recipe save, warm cash chime, a small celebration when a savings goal completes. Warnings use amber and gentle icons, never urgent red flashing.
* **Performance expectation:** 60 fps at 1x with a full 120 seat dining room on the minimum supported iPad; never below 30 fps at 4x; save load under 5 seconds; exact resume from background.

---

## 10. Business model, scope and non-goals

### 10.1 Business model (assumption)

Free. The whole game is free to play in the browser with no ads, no energy, no premium currency, no paid speed ups, no loot boxes and no in-app purchases (founder decision).

### 10.2 In scope (all versions)

City districts and property; ingredient quality tiers; menu and recipe design; purchasing, storage, spoilage and waste; kitchen equipment (volume, quality, hybrid, artisan); dining room builder; guest simulation, turnover, satisfaction and reviews; luxury, middle and volume strategies; staff with salary, skill, fame, traits, morale and measurable impact; restaurant and area managers; reputation; per location and chain finance with loans, savings goals and safety net; chain expansion, chain vs local menu, central purchasing; progression and tutorial; seasons, day and night, audio; iPad landscape, touch and Apple Pencil, offline, local saves.

### 10.3 Non-goals (explicitly out of scope)

* **Crime, mafia, sabotage, bribery, weapons.** In the 1994 original; conflicts with the cosy tone and age rating goal.
* **Game over and bankruptcy.** Replaced by the safety net.
* **Real-time cooking or reflex minigames.**
* **Multiplayer, online leaderboards, accounts, social sharing, UGC** (at least through v1.0).
* **Free-to-play mechanics** of any kind.
* **iPhone and portrait mode** at v1.0.
* **Real brands, real cities, licensed products.**
* **Realistic accounting** (tax, VAT, depreciation).
* **Equipment breakdowns as random disasters.** Maintenance is a flat weekly cost, not a failure event.
* **Delivery apps and online ordering.** Takeaway counter is a v2.0 candidate only.
* **Cuisine beyond pizza plus simple sides** at v1.0 (Q7).
* **Deep alcohol or bar gameplay.**
* **Technology choices** (engine, language, architecture, analytics vendor): the solution architect's call.

### 10.4 Scope risk and recommended cuts

Tycoon games die from too many systems. If v1.0 slips, cut in this order:

1. Friendly rival and festival (already v2.0).
2. Buying property (keep leasing).
3. Critic visits and marketing.
4. Style set bonuses (keep flat ambience).
5. Shift schedule editor (keep automatic 5 shift rotas).
6. Hybrid equipment tier (keep volume, quality, artisan).

Never cut: guest simulation legibility, recipe designer with ingredient tiers, the two strategies and their equipment families, build mode, staff impact card, restaurant manager, safety net, tutorial.

---

## 11. Success metrics

New product, so baselines are **genre benchmarks for premium and cosy mobile or tablet games**, labelled as such, replaced with our own playtest data after v0.1.

| # | Goal | Metric | Baseline (benchmark) | Target |
|---|---|---|---|---|
| M1 | Onboarding is clear | Share of new players who finish the guided first week | About 60% tutorial completion for mid-core mobile sims | 85% in v0.1 playtest; 80% live at v1.0 |
| M2 | Session fits adult life | Median session length | 15 to 20 min for mobile sims | 25 to 40 min |
| M3 | Players return | Day 7 return of buyers (opt-in telemetry) | 20 to 30% for premium mobile games | 40% |
| M4 | Depth pulls into mid game | Share of tutorial finishers who open a second location within 8 hours of play | About 30 to 40% reach a comparable mid game milestone | 50% |
| M5 | Both strategies are real | Share of players whose most profitable location is luxury vs volume (among players with 3+ locations) | No baseline (new) | Neither strategy below 30% of players |
| M6 | It feels relaxing | Playtest "How relaxed do you feel?" (1 to 5) | About 3.5 for non-cosy management sims | 4.2 or more |
| M7 | It feels deep | Playtest "My decisions clearly changed the results" (1 to 5) | About 3.5 | 4.0 or more |
| M8 | Legibility | Playtest: player correctly explains why a satisfaction or profit number moved | No baseline (new) | 80% of players on 3 of 4 probes |
| M9 | Quality perception | App Store rating, first 90 days | About 4.3 for top premium iPad sims | 4.6 or more |
| M10 | Stability | Crash free sessions | 99.0% industry acceptable | 99.7% |
| M11 | Fair value | Refund rate | 3 to 5% for premium iOS games | Under 3% |
| M12 | Commercial | Units sold in first 12 months | 0 (new); indie premium iPad sims roughly 10k to 150k | 60k (validate against budget, Q10) |
| M13 | Performance | Frame rate during a full service on minimum iPad | n/a | 60 fps at 1x, never under 30 at 4x |

Telemetry is opt-in and anonymous; playtest metrics need at least 30 target players per milestone.

---

## 12. Assumptions

* **A1 Platform:** browser game, iPad Safari and Chrome first in landscape, plus desktop browsers; installable as a web app; no native app; minimum device set by the architect against M13.
* **A2 Input:** everything playable with one finger; minimum touch target 44 pt; Apple Pencil adds precise placement and hover preview on hover capable models; keyboard and trackpad where practical.
* **A3 Connectivity:** single player, fully playable offline; a light account (anonymous first, optional email link) enables cloud saves.
* **A4 Saves:** local first with cloud sync across devices; autosave at end of each day and when the tab is hidden; 3 manual slots; exact resume.
* **A5 Business model:** free, see 10.1.
* **A6 Age rating:** 4+ or 9+.
* **A7 Language:** English at v0.1; French, German, Italian, Spanish, Japanese at v1.0.
* **A8 Setting:** fictional European-inspired city; neutral localisable currency.
* **A9 Sessions:** 15 to 30 minute design target with natural stops at end of day.
* **A10 Content at v1.0:** 1 city, 6 districts, about 60 ingredients in 4 tiers, 12 suppliers, 16 equipment items, about 150 furniture and decor items, 25 traits, up to 6 locations.
* **A11 Formulas:** everything in section 5, 6 and `balance.md` is a tuning assumption.
* **A12 Team:** small indie team (about 6 to 10 people); v1.0 about 18 months after M0 (Q10).

## 13. Dependencies

* **D1** Art direction and UX designs for the vertical slice (build mode, recipe designer with tiers, kitchen panel, inspect panels, P&L).
* **D2** Simulation tuning spreadsheet owned by game design, mirroring `balance.md`.
* **D3** Composer and ambient sound library (including per equipment kitchen sounds).
* **D4** Web hosting, domain, privacy policy for the cloud save account.
* **D5** Legal clearance of title and any resemblance to the original.
* **D6** Playtest recruitment (at least 30 target players per milestone).
* **D7** Localisation vendor (v1.0).
* **D8** An opt-in analytics approach that works offline (architect's choice, subject to Q11).

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Depth vs cosiness tension | Players feel overwhelmed | Layered UI, one system per tutorial day, managers remove chores |
| Too many systems for team size | Late or shallow launch | Cut list in 10.4; vertical slice gate at v0.1 |
| Strategy balance drifts (one strategy dominates after tuning) | Choice feels fake, M5 fails | Automated balance tests on the reference builds (acceptance criteria); playtest strategy mix |
| Luxury ramp is slow (needs Rep 55 unlocks) | Maya feels blocked early | Stone hearth and proving cabinet unlock at Rep 40; Premium tier available from day 3 |
| Simulation performance on older iPads | Frame drops | Aggregate off-screen simulation; performance budget M13 |
| IP risk with the original's name | Legal cost, late rename | Original title from day one (Q1) |
| Premium discoverability | Low sales | Apple featuring pitch, cosy games press, nostalgia marketing |

## 15. Open questions

| # | Question | Who can answer |
|---|---|---|
| Q1 | Closed: original title "Pizza D". | Founder |
| Q2 | Closed: free, browser only. | Founder |
| Q3 | A paid expansion later (new city or cuisine): acceptable under "no predatory IAP"? | Founder |
| Q4 | Closed: cloud saves from v0.1, browser on iPad and desktop. | Founder |
| Q5 | Is a Mac or iPhone version planned, which affects UI density now? | Founder with solution architect |
| Q6 | Minimum supported iPad model given M13? | Solution architect after the M0 performance spike |
| Q7 | Pasta and salads as mains at v1.0, or pizza focus plus simple sides? | Game design lead with founder |
| Q8 | Is the friendly rival on by default, and could it ship in v1.0? | Game design lead after v1.0 beta playtest |
| Q9 | Art style: isometric 2.5D or angled 3D top-down? | Art director with solution architect |
| Q10 | Budget, team size and launch window, which bound A10 and A12? | Founder |
| Q11 | Do we collect opt-in telemetry at all? Without it M3 to M5 rely on playtests. | Founder with legal |
| Q12 | Is v0.1 released as an external TestFlight beta? | Founder with delivery lead |
| Q13 | Should the three strategies be named in the UI (badges, manager policy) or stay emergent? | Game design lead with UX after v0.1 playtest |
