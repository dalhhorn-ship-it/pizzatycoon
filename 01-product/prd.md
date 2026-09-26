# PRD: Pizza Tycoon for iPad (working title "Slice & Simmer")

Status: Draft 1 for solution architecture handoff
Owner: Product Management
Date: 2026-09-26

The working title is a placeholder. "Pizza Tycoon" is a 1994 MicroProse title and its name and IP rights are not ours (see Open Questions).

## 1. Summary

A cosy, premium restaurant builder for iPad aimed at adults. The player leases or buys a first pizzeria in a charming city, designs recipes and a menu, sources ingredients from suppliers, lays out the dining room and kitchen on a grid, hires staff with real personalities and costs, and watches service play out calmly. Over many in-game seasons the single pizzeria grows into a small chain run by trusted restaurant managers, while the player focuses on menu craft, brand and expansion.

The game keeps the business depth that made the 1994 original memorable (menus, purchasing, interiors, staff, competition for customers) and removes its crime systems, harsh bankruptcy and stressful micromanagement.

## 2. Problem statement

**Problem.** Adult players who enjoy management and builder games on tablets have two poor options:

* Mobile restaurant games (Good Pizza Great Pizza, Cooking Fever, many idle tycoons) are built for short sessions, rely on reflex play or timers, and are monetised with ads, energy systems and IAP. They have little real business depth.
* Deep business sims (Two Point series, Restaurant Empire, the original Pizza Tycoon) live on PC with mouse and keyboard UIs, are often stressful, and have no great touch-native equivalent.

**For whom.** Adults aged roughly 25 to 55 who own an iPad, play in the evening or on weekends to unwind, like planning and optimising, and are willing to pay once for a quality game with no manipulative monetisation.

**Evidence it is real** (public signals; exact figures to be verified by marketing research before greenlight):

* Cosy and management games are a proven, growing category: Stardew Valley has sold tens of millions of copies across platforms including mobile; Two Point Hospital and Two Point Campus were commercial successes; PlateUp! and Cafe/restaurant sims regularly chart on Steam.
* Premium ports of management games (Stardew Valley, RollerCoaster Tycoon Classic, Prison Architect, Game Dev Tycoon, Mini Metro) have sold well on iOS at 5 to 15 USD, showing adults pay upfront for depth on tablets.
* Nostalgia: Pizza Tycoon / Pizza Connection still has active fan communities, abandonware interest and a 2018 sequel (Pizza Connection 3), which indicates demand for the fantasy of "build your pizza empire".
* Player sentiment in App Store reviews of free-to-play cooking games repeatedly complains about ads, energy timers and pay walls. This is our positioning gap.

A discovery sprint (survey of 300 target players plus 8 interviews) is recommended in parallel with architecture to validate price point and session length (see Open Questions).

## 3. Product principles

1. **Cosy, never punishing.** No game over, no sudden catastrophes. Problems arrive slowly, are visible early, and always have a recoverable path.
2. **Real business depth, readable at a glance.** Every number the player sees must explain itself in one tap ("why is satisfaction 72?").
3. **Pause is always allowed.** The player can pause and plan at any moment; nothing requires reflexes.
4. **Touch first.** Every action works with one finger. Apple Pencil adds precision, never requirement.
5. **Grow from craft to chain.** The early game is hands-on (recipes, layout); the late game is strategic (people, brand, expansion). Delegation removes tedium rather than adding it.
6. **Respect the player.** Premium, no ads, no energy, no timers that punish leaving the app.

## 4. Goals and success metrics

Because this is a new product there is no internal baseline. Baselines below are **industry benchmarks for premium or cosy mobile/tablet games**, labelled as such, and must be replaced with our own data after the v0.1 playtest.

| # | Goal | Metric | Baseline (benchmark) | Target |
|---|------|--------|----------------------|--------|
| M1 | Onboarding is clear | % of new players who complete the guided first week | 60% typical tutorial completion for mid-core mobile sims | 85% in v0.1 playtest, 80% at v1.0 launch |
| M2 | Core loop is engaging | Median session length | 15 to 20 min typical for mobile sims | 30 min or more |
| M3 | Players return | Day-7 return rate of paying players (opt-in telemetry) | 20 to 30% for premium mobile games | 40% |
| M4 | Depth carries players into mid-game | % of players who open a second location | No baseline (new) ; comparable "reach mid-game milestone" rates are 30 to 40% | 50% of players who finish the tutorial, within 6 hours of play |
| M5 | The game feels relaxing | Post-session "How relaxed do you feel?" (1 to 5) in playtests | 3.5 average reported in cosy game UX studies for non-cosy sims | 4.2 or higher |
| M6 | The game feels deep | Playtest agreement with "My decisions clearly changed the results" (1 to 5) | 3.5 benchmark | 4.0 or higher |
| M7 | Quality perception | App Store rating | 4.3 average for top premium sims on iPad | 4.6 or higher in the first 90 days |
| M8 | Stability | Crash-free sessions | 99.0% industry acceptable | 99.7% |
| M9 | Fair value | Refund rate | 3 to 5% typical for premium iOS games | Under 3% |
| M10 | Commercial | Units sold in first 12 months | 0 (new product); indie premium iPad sims range 10k to 150k | 60k units (to be validated against budget) |
| M11 | Performance | Frame rate during a full service on the lowest supported iPad | n/a | Steady 60 fps at 1x, never below 30 fps at 4x |

Telemetry is opt-in only and anonymous. Playtest metrics (M5, M6) come from moderated and unmoderated playtests of at least 30 players per milestone.

## 5. Personas

**P1. Maya, 36, "the unwinder".** Product designer, plays on the sofa after work for 30 to 60 minutes. Loves Stardew Valley and Animal Crossing. Wants to make something beautiful and see it thrive. Dislikes timers and failure screens. Success for Maya: a lovely dining room full of happy guests and a menu she is proud of.

**P2. Tom, 48, "the returning tycoon".** Played Pizza Tycoon and Transport Tycoon in the 1990s. Now a manager with kids, plays on weekends and on trains. Wants depth, numbers, and the satisfaction of building an empire, without learning a PC interface. Success for Tom: a profitable 6-location chain and clear P&L screens.

**P3. Priya, 29, "the optimiser".** Data analyst, plays Factorio and Two Point. Will A/B test prices and rebuild layouts to shave seconds off table turnover. Needs transparent formulas and useful overlays. Success for Priya: understanding exactly why numbers moved and beating her own records.

**P4. Linda, 57, "the casual tablet player".** Plays word games and simple sims on an iPad. Enjoys cooking in real life. Needs large text, forgiving controls and a gentle ramp. Success for Linda: designing pizzas from ingredients she recognises and seeing guests enjoy them.

Primary personas for scope decisions: Maya and Tom. Priya drives the transparency features, Linda drives accessibility.

## 6. Core gameplay loop

### 6.1 Time scale (tuning assumption)

* 1 in-game minute = 0.5 real seconds at 1x speed.
* A service day runs 10:00 to 23:00 game time (lunch 11:30 to 14:30, dinner 18:00 to 22:30). At 1x a full day is about 6.5 real minutes; quiet hours auto fast-forward.
* Speed options: pause, 1x, 2x, 4x.
* 1 week = 7 days. 1 season = 4 weeks. 1 year = 4 seasons (112 days).

### 6.2 Minute loop (during service, moment to moment)

Watch guests arrive, get seated, order, eat and leave. Tap any guest, table or staff member to see their thoughts and numbers. Make light interventions: move a server to a busy section, mark a dish as sold out, open an extra table, give a table a free dessert to rescue a long wait. Everything is optional; service runs without input.

### 6.3 Service day loop

1. **Morning prep (paused by default):** check deliveries arrived, stock levels and today's staff; tweak menu prices or today's special; place orders.
2. **Service:** lunch and dinner play out.
3. **Evening summary:** a cosy one-screen recap: guests served, revenue, profit, average satisfaction, three best and one worst review, waste, and one "tip of the day" from the advisor.

### 6.4 Week loop

Weekly P&L, rent and salaries paid, supplier standing orders arrive, candidates appear on the hiring board, a district trend card is revealed (for example "Students return from holidays: +20% student traffic in University Quarter"). Player sets goals for the week: redesign, hire, adjust menu.

### 6.5 Long-term loop (seasons and years)

Unlock new ingredients and furniture through milestones; grow reputation; take a loan and open a second location; hire restaurant managers so locations run on their own; decide which dishes are chain-wide and which are local; set up central purchasing; expand to new districts and later new cities. Seasonal events (summer terraces, winter comfort food) refresh the rhythm.

## 7. Starting simulation formulas (tuning assumptions)

**Everything in this section is a starting assumption for prototyping and will be tuned in playtests.** Values are expressed in a neutral currency shown with a "$" placeholder. Engineers should keep every constant data-driven (not hard-coded) so design can tune without code changes.

### 7.1 Customer segments

| Segment | Price elasticity e | Quality weight wq | Ambience weight wa | Wait tolerance (game min) | Meal duration (game min) | Avg party size |
|---|---|---|---|---|---|---|
| Students | 2.0 | 0.30 | 0.10 | 10 | 25 | 3.0 |
| Families | 1.5 | 0.35 | 0.15 | 12 | 40 | 3.8 |
| Professionals | 1.0 | 0.40 | 0.20 | 8 (lunch), 15 (dinner) | 30 lunch, 50 dinner | 2.2 |
| Foodies | 0.6 | 0.60 | 0.25 | 20 | 60 | 2.0 |
| Seniors | 1.2 | 0.40 | 0.20 | 15 | 50 | 2.0 |
| Tourists | 0.8 | 0.35 | 0.30 | 15 | 45 | 2.5 |

Each segment also has taste tags with preferences from 0 to 1 (for example Students: "cheesy" 0.9, "spicy" 0.7; Foodies: "artisan" 0.9, "seasonal" 0.8; Families: "classic" 0.9, "kid friendly" 0.8).

### 7.2 District demand

Each district has daily foot traffic `T` (800 to 5,000 passers-by), a segment mix (shares summing to 1), weekly rent per grid tile, and existing competition `C` (0 to 1).

```
potential_guests_per_day(segment s) =
    T * share_s * capture_base
    * rep_mult * season_mult * weekday_mult * menu_fit_s * price_mult_s * (1-0.5*C)

capture_base  = 0.04
rep_mult      = 0.5 + Rep/100              (Rep 0..100 gives 0.5..1.5)
season_mult   = 0.85..1.15 per district and season (data table)
weekday_mult  = Mon 0.8, Tue 0.85, Wed 0.9, Thu 1.0, Fri 1.25, Sat 1.35, Sun 1.1
menu_fit_s    = 0.6 + 0.8 * avg taste match of the top 5 dishes for segment s (0..1)
```

Arrivals are split 40% lunch and 60% dinner (data table per district; business districts invert this) and are released as a Poisson process peaking at 12:30 and 19:30. Parties are generated with the segment's average size (1 to 6, capped by largest table).

### 7.3 Dish quality

```
dish_quality Q (0..100) =
    (0.50 * IQ + 0.15 * H + 0.35 * K) * F

IQ = weighted average ingredient quality (0..100, weight by grams)
H  = recipe harmony (0..100): starts at 60, +10 per matching flavour pair,
     -15 per clashing pair, -10 per topping beyond 4 (data table of pairs)
K  = kitchen skill (0..100) = 30 + 7 * skill of the cook who prepares it
     (+5 if a chef with the matching specialty is on shift)
F  = freshness factor: 1.00 fresh, 0.90 in the last 25% of shelf life,
     ingredient cannot be used after expiry
```

### 7.4 Price, cost and elasticity

```
food_cost        = sum(ingredient qty * supplier unit price)
fair_price       = 6 + 0.10 * Q + 1.5 * food_cost      (pizza baseline)
price_ratio r    = menu_price / fair_price
price_mult_s     = clamp(r ^ (-e_s), 0.2, 1.5)
value_score_s    = clamp(1.2 - 0.6 * (r-1) * e_s, 0, 1)
```

The UI shows a "fair price" band (0.9 to 1.1 of fair_price) and a per-segment appeal preview. Healthy food cost ratio is 25 to 35% of menu price; the advisor flags anything above 40% or below 15%.

### 7.5 Dish choice

Each guest picks a main with weighted random choice:

```
appeal(dish, s) = wq_s * Q/100 + taste_match(dish, s) * 0.4 + value_score_s(dish) * 0.3
P(choose dish)  = exp(3 * appeal) / sum over menu of exp(3 * appeal)
```

Drinks attach at 80%, starters at 30%, desserts at 25% (modified by segment).

### 7.6 Service and turnover

```
seat_time      = 2 min with a host, 5 min without
order_time     = 3 min / server_speed
cook_time      = recipe base time (pizza 12 min) / station_speed
                 + queue wait at oven (ovens have capacity 4 pizzas each)
serve_time     = 1.5 min / server_speed
eat_time       = segment meal duration * (0.9..1.1 random)
pay_bus_time   = 4 min / server_speed

server_speed   = (0.7 + 0.06 * skill) * morale_mult * load_mult
load_mult      = 1.0 up to 4 tables per server, then -0.15 per extra table (floor 0.4)
station_speed  = (0.7 + 0.06 * cook skill) * morale_mult

table_cycle    = seat + order + cook + serve + eat + pay_bus
turns per service = open service minutes / table_cycle (reported, not forced)
```

Dishwashing: each cover produces 3 plates; a dishwasher cleans 60 plates per hour times skill factor. If clean plates reach zero, serving pauses until plates are cleaned (visible stack icon, never a fail state).

Walk-aways: a party at the door leaves if its wait exceeds 1.5 times its wait tolerance. Walk-aways reduce Rep by a small amount only if they exceed 10% of arrivals in a day.

### 7.7 Satisfaction and reviews

```
satisfaction S (0..100) = 100 * (
    0.40 * food_score      (Q/100 blended with taste match)
  + 0.20 * service_score   (server skill, attentiveness, host present)
  + 0.15 * ambience_score  (room ambience / 100)
  + 0.15 * value_score_s
  + 0.10 * wait_score )

wait_score = clamp(1 - max(0, total_wait - tolerance) / tolerance, 0, 1)
```

A 20% share of parties leave a review. Stars = round(1 + 4 * S/100). Reviews are written from templates keyed to the lowest and highest sub-score so they explain themselves ("Pizza was divine but we waited forever").

### 7.8 Reputation

```
daily Rep update: Rep = Rep + 0.08 * (avg_review_score_today - Rep)
avg_review_score = stars * 20
Rep bounded 0..100, starts at 30 for a new location
chain brand Rep = revenue weighted average of location Rep, plus marketing and star staff bonuses
```

Reputation changes slowly on purpose, so one bad day never ruins a location.

### 7.9 Staff impact

Every staff member has: role, skill 1 to 10, salary, fame 0 to 3 stars, 2 traits, morale 0 to 100, fatigue.

```
weekly salary  = role_base * (1 + 0.12 * (skill-5)) * (1 + 0.25 * fame)
role_base      = chef 900, cook 550, server 450, host 420, dishwasher 380,
                 restaurant manager 1,100, area manager 1,800   ($ per week)
morale_mult    = 0.85 + 0.30 * morale/100
morale drift   = toward 70; +10 after a raise, -2 per day over 5 shifts per week,
                 -1 per day understaffed, +1 per day with good ambience in staff room
fame effect    = +1.5 Rep per week per fame star (cap +5 per location), and
                 +5% arrivals from Foodies per chef fame star
```

Example traits (each a single, visible, numeric effect): Speedy (+15% speed), Perfectionist (+8 K, +10% cook time), Charmer (+0.05 service score), Steady (morale floor 50), Mentor (+1 skill per season to one teammate), Night Owl (+10% speed at dinner, -10% at lunch), Frugal Buyer (manager: -5% purchasing cost), Crowd Pleaser (+5% menu fit for families).

The staff card always shows the measurable impact: for example "+6 dish quality, -2 min average cook time, $1,180 per week".

### 7.10 Restaurant manager autonomy

A manager with skill m runs the location when the player is elsewhere:

```
reorder accuracy       = 0.70 + 0.03 * m   (share of optimal order quantity, less waste)
pricing within player band, adjusts at most +/- 5% per week toward fair price
hiring: fills vacancies within the player's budget cap, picks best of 3 candidates
    with probability 0.4 + 0.05 * m
location profit modifier vs player-run baseline = -10% + 2% * m
```

A skill 5 manager therefore performs equal to an attentive player; skill 10 outperforms by 10%.

### 7.11 Finance and safety net

* Starting cash $40,000. Starter loan up to $30,000 at 5% per year, repaid weekly over 2 years.
* First property: lease with 2 months deposit (rent $900 to $3,500 per week) or buy ($120k to $450k, later game).
* Expansion loans unlock at Rep 60 and are capped at 3 times average weekly profit times 10.
* **No bankruptcy.** If cash stays below zero for 7 days a friendly bank advisor offers a restructure: pause loan payments for 4 weeks and suggest 3 concrete actions. If cash falls below minus $20,000 the player may sell furniture, close a location, or accept a "fresh start" that keeps unlocks. The game never ends.

## 8. Scope

### 8.1 In scope (across all versions)

* Buying or leasing the first restaurant in a city with districts that differ in demographics, rent, foot traffic and competition.
* Menu and recipe design: pizzas built from ingredients, plus sides, drinks and desserts; quality, cost, pricing and segment appeal.
* Purchasing and logistics: suppliers with price, quality, reliability and lead time; storage capacity; spoilage and waste.
* Dining room and kitchen builder on a grid: tables, seats, decor, ambience, kitchen stations and capacity, flow.
* Operations and table turnover: arrivals, seating, waits, service times, satisfaction, reviews.
* Staff: chef, cook, server, host, dishwasher, restaurant manager, area manager; salary, skill, fame, traits, morale, measurable impact.
* Reputation per location and chain brand.
* Finances: readable P&L per location and chain, loans, gentle safety net.
* Chain expansion: new locations, delegation, chain vs local menu, central purchasing.
* Progression, onboarding tutorial, seasons, day and night, ambient audio and music.
* Optional friendly rival (see 8.3).
* iPad, landscape, touch and Apple Pencil, offline single player, local saves.

### 8.2 Explicitly out of scope (non-goals)

* **Crime, mafia, sabotage, bribery, weapons.** Present in the 1994 original; conflicts with the cosy tone and age rating goals.
* **Hard fail states and bankruptcy game over.** Replaced by the safety net.
* **Real-time cooking minigames or reflex play** (Overcooked, Good Pizza Great Pizza style). The player designs, not flips pizzas.
* **Multiplayer, leaderboards requiring online, social features, user-generated content sharing** in v1.0.
* **Free-to-play monetisation:** ads, energy, loot boxes, timers, premium currency, paid speed-ups.
* **Portrait mode and iPhone** at v1.0 (iPhone may be evaluated for v2.0).
* **Real brands, real ingredient brands, licensed real cities.** Fictional, European-inspired cities only.
* **Realistic accounting** (tax filings, depreciation schedules, VAT). Finances are simplified and readable.
* **Delivery apps and online ordering** in v1.0 (takeaway counter considered for v2.0).
* **Alcohol-centric gameplay** (bars, cocktails menu depth). Drinks exist as simple items only.
* **Technology choice.** Engine, language and architecture are for the solution architect.

### 8.3 Friendly rival (optional, justified)

A single named rival restaurateur (for example "Nonna Bianca") opens locations in some districts, competes on reputation, and invites the player to a seasonal "Pizza Festival" contest judged on a submitted recipe. There is no sabotage and no price war AI. Justification: the original's competition was part of its appeal; a friendly rival gives mid-game goals and personality without stress. It can be switched off in settings and when off, competition `C` comes only from static neutral restaurants.

## 9. Platform and business assumptions

* **A1. Platform:** iPad first, landscape only, iPadOS versions supported by the chosen technology, targeting devices from the last 5 years. Minimum device to be set by the architect against M11.
* **A2. Input:** full play with one finger. Apple Pencil supported for precise placement, hover previews (on Pencil hover capable devices) and drawing custom sign or menu art (later version). Keyboard and trackpad supported where practical.
* **A3. Connectivity:** fully offline single player. No account required.
* **A4. Saves:** stored on device; autosave at the end of each day and on backgrounding. Cross-device sync is an open question.
* **A5. Business model:** premium one time purchase (assumed 9.99 USD) with no ads and no predatory IAP. A possible paid expansion (new city) after launch is not assumed. See Open Questions.
* **A6. Age rating:** target 4+ or 9+ (no crime, mild alcohol references only as menu drinks).
* **A7. Language:** English at v0.1; French, German, Italian, Spanish, Japanese at v1.0.
* **A8. Setting:** fictional European-inspired cities, currency shown with a neutral symbol that can be localised.
* **A9. Session design:** a meaningful session is 20 to 45 minutes; the game can be closed at any time without loss beyond the current day.
* **A10. Content scale at v1.0:** 1 city with 6 districts, 1 unlockable second city, about 60 ingredients, 12 suppliers, 150 buildable items, 25 staff traits.

## 10. Dependencies

* **D1.** Art direction and UI/UX design (cosy visual style, readable data views) must be ready before v0.1 vertical slice.
* **D2.** Simulation tuning spreadsheet owned by game design, kept in sync with data-driven constants.
* **D3.** Audio: composer and ambient sound library.
* **D4.** Apple developer account, App Store listing, age rating questionnaire.
* **D5.** Legal clearance for title, name references and any resemblance to the original.
* **D6.** Playtest recruitment pipeline (at least 30 target players per milestone).
* **D7.** Localisation vendor for v1.0.
* **D8.** Opt-in analytics solution compatible with offline play and privacy labels (choice by architect).

## 11. Risks

* **Depth vs cosiness tension.** Mitigation: layered UI (summary first, details on tap), advisor tips, managers to delegate.
* **Simulation performance on older iPads** during busy services and multi-location background simulation. Mitigation: non-visible locations simulated statistically (see features F-52).
* **IP risk** around the Pizza Tycoon name. Mitigation: original title and content.
* **Premium discoverability** on the App Store. Mitigation: Apple featuring pitch, cosy games press, nostalgia marketing.

## 12. Open questions

| # | Question | Who can answer |
|---|----------|----------------|
| Q1 | Can we license the "Pizza Tycoon" / "Pizza Connection" name from the current rights holder, or do we ship under an original title? | Founder with legal counsel |
| Q2 | Price point: 9.99 vs 14.99 USD, and do we launch at a discount? Is Apple Arcade a better channel than premium? | Founder with publishing/marketing lead |
| Q3 | Will we sell a paid expansion (new city, new cuisine) later, and does that fit "no predatory IAP"? | Founder |
| Q4 | Cross-device save sync (iCloud or similar) at v1.0 or later? | Solution architect with founder |
| Q5 | Is a Mac version (and later iPhone) in the plan, which affects UI density decisions now? | Founder with solution architect |
| Q6 | Minimum supported iPad model given M11? | Solution architect after a performance spike |
| Q7 | Should the menu expand beyond pizza (pasta, salads) at v1.0 or stay pizza focused with sides? | Game design lead with founder |
| Q8 | Is the friendly rival on by default? | Game design lead after playtest |
| Q9 | Art style: 2.5D isometric vs top-down 3D? | Art director with solution architect |
| Q10 | Budget and team size, which bound the v1.0 content scale in A10? | Founder |
| Q11 | Do we collect opt-in telemetry at all, given privacy positioning? Without it M3 and M4 rely on playtests only. | Founder with legal |
| Q12 | Target launch window and whether v0.1 is used for an external TestFlight beta. | Founder with delivery lead |
