# Balance: Pizza D

* Companion to `prd.md` (sections 5 and 6 define the formulas).
* **Every value here is a starting tuning assumption.** All of them live in data files (F-01) and are tuned from playtests, never in code.
* Currency "$" is a placeholder for a neutral localisable currency.
* The worked numbers in sections 2 and 3 were produced with a design reference calculator that implements the aggregate formulas of prd.md exactly (expected values, no randomness). The agent simulation must match them within 10% (AC-72). Rounding: values are shown to 2 decimals and totals were computed before rounding, so a line may differ by $0.01.

---

## 1. Tunable parameters

### 1.1 Time and calendar

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| real_seconds_per_game_minute | s | 0.5 | 0.3 to 1.0 | Time (F-02) |
| speed_levels | multiplier | 1, 2, 4 | up to 8 | Time |
| quiet_hours_speed | multiplier | 8 | 4 to 16 | Day structure (F-03) |
| lunch_window | clock | 11:30 to 14:30 | 2.5 to 3.5 h | Demand, service |
| dinner_window | clock | 18:00 to 22:30 | 4 to 5 h | Demand, service |
| days_per_season | days | 28 | 21 to 35 | Seasons (F-96) |
| weekday_mult | multiplier | Mon 0.80, Tue 0.85, Wed 0.90, Thu 1.00, Fri 1.25, Sat 1.35, Sun 1.10 | each 0.6 to 1.5 | Demand |

### 1.2 Districts (v0.1)

| Name | Unit | University Quarter | Canal Quarter | Old Harbour | Safe range | Read by |
|---|---|---|---|---|---|---|
| foot_traffic T | passers-by per day | 6,000 | 2,400 | 2,600 | 800 to 8,000 | Demand |
| share Students | fraction | 0.60 | 0.15 | 0.03 | shares sum to 1 | Demand |
| share Families | fraction | 0.15 | 0.25 | 0.07 | | Demand |
| share Professionals | fraction | 0.15 | 0.25 | 0.20 | | Demand |
| share Foodies | fraction | 0.02 | 0.10 | 0.30 | | Demand |
| share Seniors | fraction | 0.04 | 0.15 | 0.10 | | Demand |
| share Tourists | fraction | 0.04 | 0.10 | 0.30 | | Demand |
| wealth W | multiplier on budgets | 0.8 | 1.0 | 1.5 (was 1.3, M0.2) | 0.6 to 1.6 | Demand (budget_mult) |
| competition C | 0..1 | 0.40 | 0.30 | 0.25 | 0 to 0.8 | Demand |
| rent | $ per tile per week | 8 | 11 | 19 | 5 to 30 | Finance |
| lunch_share | fraction of daily guests | 0.50 | 0.40 | 0.30 | 0.2 to 0.7 | Demand, service |
| season_mult | multiplier | 1.00 all seasons in v0.1 | same | same | 0.85 to 1.15 | Demand (v1.0) |

### 1.3 Customer segments

| Name | Unit | Students | Families | Professionals | Foodies | Seniors | Tourists | Safe range | Read by |
|---|---|---|---|---|---|---|---|---|---|
| elasticity e | exponent | 2.0 | 1.5 | 1.0 | 0.6 | 1.2 | 0.8 | 0.3 to 3.0 | price_mult, value_score |
| budget B | $ per main | 11 (was 10, tuned in M0) | 12 | 16 | 28 (was 24, M0.2) | 15 | 20 | 6 to 40 | budget_mult |
| quality appeal qa | multiplier | 0.0 | 0.1 | 0.35 | 1.0 | 0.3 | 0.5 | 0 to 1.5 | quality_mult |
| quality weight wq | weight | 0.30 | 0.35 | 0.40 | 0.60 | 0.40 | 0.35 | 0.1 to 0.8 | dish choice |
| wait tolerance | game min | 10 | 12 | 8 lunch, 15 dinner | 20 | 15 | 15 | 5 to 30 | wait_score, walk-aways |
| meal length | game min | 25 lunch, 45 dinner (was 25, M0.2) | 40 | 30 lunch, 50 dinner | 60 lunch, 90 dinner (was 60, M0.2) | 50 | 45 | 15 to 120 | table cycle |
| party size | guests (mean) | 3.0 | 3.8 | 2.2 | 2.0 | 2.0 | 2.5 | 1 to 6 | arrivals |
| speed appeal | applies at lunch | yes | no | yes | no | no | no | | speed_mult |

### 1.4 Demand and choice

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| capture_base | fraction of passers-by | 0.035 | 0.02 to 0.06 | Demand |
| rep_mult | formula | 0.5 + Rep/100 | slope 0.005 to 0.015 | Demand |
| menu_fit | formula | 0.6 + 0.8 x mean taste match of top 5 dishes | base 0.4 to 0.8 | Demand |
| price_mult cap | min, max | 0.2, 1.5 | max 1.2 to 2.0 | Demand |
| budget_mult exponent | exponent | 2.0 | 1.0 to 3.0 | Demand |
| budget_mult cap | min, max | 0.1, 1.2 | max 1.0 to 1.5 | Demand |
| quality_mult pivot | Q | 60 | 50 to 70 | Demand |
| quality_mult divisor | Q points | 50 | 30 to 80 | Demand |
| quality_mult cap | min, max | 0.3, 1.6 | max 1.2 to 2.0 | Demand |
| speed_ref | game min | 20 | 15 to 25 | speed_mult |
| speed_mult cap | min, max | 0.8, 1.25 | 0.7 to 1.4 | Demand |
| cannibalisation | competition per own location | 0.2 | 0.1 to 0.3 | Demand (chain) |
| C_eff cap | 0..1 | 0.9 | 0.7 to 0.95 | Demand |
| choice temperature | exponent factor | 3 | 1 to 6 | Dish choice |
| attach drink | formula | 0.80 + 0.10 x clamp((amb-60)/25, 0, 1) | base 0.6 to 0.9 | Revenue |
| attach starter | formula | 0.30 + 0.20 x clamp((amb-60)/25, 0, 1) | base 0.2 to 0.4 | Revenue, prep load |
| attach dessert | formula | 0.20 + 0.25 x clamp((amb-45)/40, 0, 1) | base 0.1 to 0.3 | Revenue, prep load |

### 1.5 Ingredients, recipes and pricing

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| tier quality | 0..100 | Basic 35, Standard 55, Premium 75, Artisan 90 | spread 15 to 25 between tiers | Dish quality |
| tier price multiplier | multiplier | 0.70, 1.00, 1.60, 2.40 | Artisan 1.8 to 3.0 | Food cost |
| tier shelf life multiplier | multiplier | 1.3, 1.0, 0.8, 0.6 | Artisan 0.4 to 0.8 | Spoilage |
| typical waste by tier | fraction of ingredient cost | 3%, 5%, 7%, 10% | result, not input (check) | Balance check |
| supplier quality offset | quality points | Fratelli -3, Metro 0, Green Valley +3, Casa Artigiana +5 | -10 to +10 | Dish quality |
| supplier price index | multiplier | Fratelli 1.00, Metro 0.90, Green Valley 1.10 | 0.8 to 1.4 | Food cost |
| supplier reliability | probability | Fratelli 0.85, Metro 0.97, Green Valley 0.92 | 0.75 to 0.99 | Deliveries |
| supplier lead time | days | Fratelli 1, Metro 2, Green Valley 2 | 1 to 4 | Deliveries |
| minimum order | $ | Fratelli 0, Metro 300, Green Valley 150 | 0 to 500 | Deliveries |
| late share of failed deliveries | fraction | 0.70 next day, 0.30 half on time | | Deliveries |
| emergency order premium | multiplier | 1.20 | 1.1 to 1.5 | Stock-outs |
| Standard portion costs (Margherita) | $ | dough 0.45, sauce 0.40, mozzarella 1.20, basil 0.25, oil 0.10 | +/- 30% | Food cost |
| Q weights | weights | IQ 0.50, H 0.15, K 0.35 | sum 1.0 | Dish quality |
| harmony base, match, clash, extra topping | points | 60, +10, -15, -10 per topping beyond 4 | | Dish quality |
| K formula | points | 30 + 7 x skill, +5 chef specialty | slope 5 to 8 | Dish quality |
| freshness factor | multiplier | 0.90 in last 25% of shelf life | 0.8 to 0.95 | Dish quality |
| E clamp | quality points | -6 to +15 | max +10 to +20 | Dish quality |
| fair price | formula | 4 + 0.08 x Q + 1.5 x food cost | intercept 2 to 6, Q slope 0.05 to 0.12 | Pricing |
| fair price band | multiplier | 0.9 to 1.1 | | Pricing UI |
| value_score | formula | clamp(0.7-0.6 x (r-1) x e, 0, 1) | base 0.6 to 0.8 | Satisfaction |
| menu size | items | 4 to 16 | | Menu |
| stock-out satisfaction penalty | points | -5 | -2 to -10 | Satisfaction |
| novelty decay | menu fit per season without new dish | -5%, cap -15% | | Demand |

### 1.6 Storage

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| dry shelf | units, $ | 200 units, $400 | | Storage |
| fridge | units, $ | 120 units, $1,500 | | Storage |
| freezer | units, $ | 80 units, $1,800 | | Storage |
| walk-in cold room (v1.0) | units, $, shelf life | 400 units, $9,000, x1.25 | shelf life 1.1 to 1.5 | Storage, spoilage |

### 1.7 Kitchen equipment

Servings per hour are at cook skill 5. Speed: non volume gear 0.7 + 0.06 x skill; volume gear 0.9 + 0.02 x skill. Oven servings per hour = slots x 60 / (12 x bake multiplier) x speed.

| Item | Family | Price $ | Slots | Bake mult | Servings per hour | Quality mod | Skill needed | Footprint | Maintenance $/week | Unlock | Safe range notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Deck Oven | Basic | 2,400 | 4 | 1.00 | 20 | 0 | none | 2x2 | 40 | Start | reference item |
| Double Deck Oven | Volume | 5,500 | 8 | 1.00 | 40 | -1 | none | 2x2 | 70 | Serve 500 guests | quality mod 0 to -2 |
| Conveyor Oven | Volume | 8,500 | 5 | 0.55 | 45 | -3 | none | 3x2 | 110 | Rank Owner | 35 to 55 per hour |
| Stone Hearth Oven | Quality | 6,000 | 4 | 1.00 | 20 | +5 | none | 2x2 | 60 | Rep 40 | +3 to +7 |
| Wood Fired Oven | Artisan | 11,000 | 3 | 1.25 | 12 | +10 | 7 | 3x3 | 150 | Rep 55 | must stay below Deck Oven throughput |
| Master Dome Oven (v1.0) | Artisan | 19,000 | 3 | 1.10 | 14 (13.6) | +14 | 9 | 3x3 | 180 | Restaurateur and Rep 75 | must stay below Deck Oven throughput |
| Twin Chamber Combi Oven (v1.0) | Hybrid | 24,000 | 8 | 0.85 | 47 | +5 | none | 3x2 | 220 | Chain Founder | price at least 2x the best single family item |
| Prep Counter | Basic | 1,200 | n/a | n/a | 30 dishes | 0 | none | 2x1 | 10 | Start | |
| Dough Sheeter | Volume | 2,500 | n/a | n/a | x1.35 prep at its counter | -2 | none | 1x1 | 25 | Serve 500 guests | x1.2 to x1.5 |
| Heat Lamp Pass | Volume | 1,500 | n/a | n/a | serve time x0.7 | -1 | none | 2x1 | 10 | Day 5 | |
| Dish Machine | Volume | 4,000 | n/a | n/a | dishwashing x1.8 | 0 | none | 1x2 | 40 | Day 8 | |
| Proving Cabinet | Quality | 3,500 | n/a | n/a | neutral | +3 | none | 1x1 | 30 | Rep 40 | |
| Marble Bench | Quality | 4,000 | n/a | n/a | 30 dishes (replaces counter) | +2 | none | 2x1 | 10 | Rep 45 | |
| Hand Stretch and Mozzarella Station (v1.0) | Artisan | 7,500 | n/a | n/a | x0.8 prep (replaces counter) | +5 | 6 | 2x1 | 60 | Rep 60 | |
| Pro Prep Line (v1.0) | Hybrid | 12,000 | n/a | n/a | x1.4 prep (replaces counter) | +2 | none | 3x1 | 90 | Chain Founder | |
| Second hand Deck Oven (M0.2) | Basic | 900 | 3 | 1.00 | 15 | -2 | none | 2x2 | 30 | Start | 12 to 18 per hour |
| Old Workbench (M0.2) | Basic | 300 | n/a | n/a | x0.9 prep (a prep station) | 0 | none | 2x1 | 5 | Start | x0.8 to x0.95 |
| Pizza Prep Fridge with Marble Top (M0.2) | Quality | 3,200 | n/a | n/a | x1.15 prep (a prep station; a sheeter does not stack, the higher applies); cold store | +1 | none | 2x1 | 25 | Serve 200 guests | x1.10 to x1.25; +1 to +2 |
| Dough Fridge (M0.2) | Basic | 600 | n/a | n/a | cold store: x1.05 prep for a touching Prep Counter, Old Workbench or Marble Bench | 0 | none | 1x1 | 0 | Start | $400 to $1,000 |
| Sink (M0.2) | Basic | 400 | n/a | n/a | wash station, required to open | 0 | none | 1x1 | 0 | Start | $250 to $700 |

Kitchen flow constants (M0.2, `kitchen-builder.md` 4): prep free distance 2 tiles, -4% per extra tile, cap -20%; plate walk free 3 tiles, +0.2 min per extra tile, cap +2 min; wash walk free 4 tiles, -3% per extra tile, cap -15%; cold at hand +5%.

Other kitchen constants:

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| pizza base bake time | game min | 12 | 8 to 15 | Kitchen |
| prep base rate | dishes per hour per counter | 30 | 20 to 40 | Kitchen |
| prep load per cover | formula | 1 + 0.4 x (starter attach + dessert attach) | factor 0.2 to 0.6 | Kitchen |
| artisan under-skill rule | scaling | quality mod x skill/required; speed x0.9 | | Kitchen, quality |
| plates per cover | plates | 3 | 2 to 4 | Dishwashing |
| dishwasher rate | plates per hour | 60 x (0.7 + 0.06 x skill) | 40 to 80 base | Dishwashing |
| starting plate stock | plates | 90 | 60 to 150 | Dishwashing |
| resale value | fraction | 0.80 | 0.6 to 0.9 | Build, equipment |

### 1.8 Service and turnover

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| seat time | game min | 2 with host, 5 without | | Service |
| order time | game min | 3 / server_speed | | Service |
| serve time | game min | 1.5 / server_speed | | Service |
| pay and bus time | game min | 4 / server_speed | | Service |
| server_speed | formula | (0.7 + 0.06 x skill) x morale_mult x load_mult | | Service |
| tables per server before penalty | tables | 5 (was 4, tuned in M0) | 3 to 6 | load_mult |
| load penalty | per extra table | -0.15, floor 0.4 | -0.1 to -0.25 | load_mult |
| party size fit | fraction of seats usable | 0.75 | 0.6 to 0.9 | Seat capacity |
| service utilisation U | fraction | lunch 0.60, dinner 0.65 | 0.5 to 0.8 | Service capacity |
| queue delay | formula | min(25, 2 x rho / (1-rho)), 25 at rho 0.95+ | cap 15 to 40 | Waits |
| perceived queue share | fraction | lunch 0.5, dinner 0.6 | | wait_score |
| walk-away threshold | x tolerance | 1.5 | 1.2 to 2.0 | Walk-aways |
| satisfaction weights | weights | food 0.40, service 0.20, ambience 0.15, value 0.15, wait 0.10 | sum 1.0 | Satisfaction |
| food_score | formula | 0.7 x Q/100 + 0.3 x taste match | | Satisfaction |
| service_score | formula | clamp(0.30 + 0.06 x skill + 0.10 host, 0, 1) | | Satisfaction |
| review probability | per party | 0.20 | 0.1 to 0.3 | Reviews |
| comp dessert bonus | satisfaction points | +15 | +5 to +25 | Interventions |

### 1.9 Build and ambience

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| ambience base | points | 25 | 15 to 35 | Ambience |
| decor factor | points per decor point per 10 dining tiles | 5 | 3 to 8 | Ambience |
| lighting bonus | points | 0 to 10 | | Ambience |
| crowding penalty | points per crowded table | -5 | -2 to -10 | Ambience |
| style set bonus (v1.0) | points | 15 x share of items in one style, only if share is 0.5 or more | max 10 to 20 | Ambience |
| undo depth | steps | 20 | 10 to 50 | Build mode |
| seat limit (M0.2) | seats per dining tile | 0.55, floor applied | 0.45 to 0.65 | Build mode, covers ceiling |
| Folding Table (M0.2) | $, seats, comfort | $120, 2 seats, comfort -1, 1x1 | $80 to $200 | Build, ambience |
| Table for two, four, six, booth | $, seats | $350 / 2, $600 / 4, $900 / 6, $1,100 / 4 (+1 comfort) | | Build |

### 1.10 Staff

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| role_base salary | $ per week | chef 900, cook 550, server 450, host 420, dishwasher 380, restaurant manager 1,100, area manager 1,800 | +/- 30% | Finance |
| salary per skill point | fraction | +0.12 per point above 5 | 0.08 to 0.18 | Finance |
| salary per fame star | fraction | +0.25 | 0.15 to 0.40 | Finance |
| morale target and drift | points | toward 70 at 3 per day | 60 to 80; 1 to 5 | Morale |
| morale_mult | formula | 0.85 + 0.30 x morale/100 | range 0.2 to 0.4 | Speed |
| overwork | morale per day per extra shift | -2 | -1 to -4 | Morale |
| understaffed | morale per day | -1 | | Morale |
| raise bonus | morale, once | +10 for a raise of 10% or more | | Morale |
| notice rule | days | below 30 for 7 days, then 7 days notice | | Staff |
| fame Rep effect | Rep per week per star | +1.5, cap +5 per location | | Reputation |
| chef fame foodie effect | arrivals per star | +5% Foodies | | Demand |
| skill growth | shifts per skill point | 40 | 25 to 60 | Staff |
| training | $, days | 600, 3 days | | Staff |
| candidates per week | count | 6 | 4 to 10 | Hiring |
| first board guarantee (M0.2) | count, skill | at least 2 cooks, 2 servers, 1 dishwasher, skill 2 to 4 | | Hiring (day 1) |
| fame candidate gate | Rep | 50 | 40 to 70 | Hiring |
| manager reorder accuracy | formula | 0.70 + 0.03 x m | | Manager |
| manager profit modifier | formula | -10% + 2% x m | | Manager, off-screen |
| manager price step | per week | 5% | 2% to 10% | Manager |
| caretaker profit modifier | fraction | -20% | -10% to -30% | Off-screen |

### 1.11 Reputation

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| starting Rep | points | 30 (40 if brand Rep 60+) | 20 to 50 | Reputation |
| Rep learning rate | fraction of gap per day | 0.05 | 0.03 to 0.10 | Reputation |
| walk-away penalty | Rep | -1 if guests who gave up waiting exceed 10% of arrivals (guests turned away by a full house do not count; M0 change) | | Reputation |
| critic review weight | multiplier | 5 | 3 to 10 | Reputation |
| marketing brand bonus | Rep | 0 to 5 | | Brand Rep |

### 1.12 Finance

| Name | Unit | Start | Safe range | Read by |
|---|---|---|---|---|
| starting cash | $ | 7,000 (was 40,000, M0.2) | 5,000 to 10,000 | Finance |
| starter loan | $, rate, term | up to 5,000, 5% per year, 52 weeks, $98.62 per week at full amount (was 30,000 over 104 weeks, M0.2) | 3,000 to 8,000 | Finance |
| lease deposit | weeks of rent | 4 (was 8, M0.2) | 2 to 8 | Property |
| menu minimum | items | 0 (was 4, M0.2); maximum 16 | | Menu |
| lease break fee | weeks of rent | 4 | | Property |
| utilities | $ per day | 30 + 0.80 per cover | | Finance |
| upkeep | $ per day | 15 + equipment maintenance per week / 7 | | Finance |
| expansion loan | multiple, cap, rate, term | 12 x avg weekly profit, $150,000, 6%, 3 years; unlock Rep 50 | | Finance |
| restructure trigger | days below $0 | 7 | 5 to 14 | Safety net |
| restructure pause | weeks | 4 | | Safety net |
| fresh start threshold | $ | -20,000 | | Safety net |
| property resale | fraction | 0.90 | | Property |
| saturated rent growth | per season | +5% | 0 to 10% | Property (runaway guard) |
| loyalty discount | per 4 weeks, cap | 2%, 8% | | Purchasing |
| central purchasing discount | at 3 and 6 locations | 5%, 10% | | Purchasing |

### 1.13 Premises (M0.2)

New games start empty (`fresh-start.md`). Rent = tiles x district rent per tile.

| Premises | Dining grid | Kitchen grid | Tiles | Seat limit | Rent per week Univ / Canal / Harbour | Read by |
|---|---|---|---|---|---|---|
| Hole in the wall (new) | 6 x 5 | 8 x 3 | 54 | 16 | $432 / $594 / $1,026 | Property, build |
| Cosy corner shop | 10 x 8 | 10 x 3 | 110 | 44 | $880 / $1,210 / $2,090 | Property, build |
| Neighbourhood trattoria | 10 x 10 | 12 x 3 | 136 | 55 | $1,088 / $1,496 / $2,584 | Property, build |
| Big hall | 20 x 11 | 15 x 4 | 280 | 121 | $2,240 / $3,080 / $5,320 | Property, build |

---

## 2. Worked example: one full day at the starter restaurant

**M0.2 note.** New games now start empty with $7,000 in a Hole in the wall; that opening and its first week are worked in `fresh-start.md` 7. This section now describes the **cosy corner shop stage** (typically weeks 3 to 8). Its cash lines (starting cash, loan, deposit) are illustrative of the old start and are not a new game state. With the M0.2 dinner meal lengths (Students 45, Foodies 90 min) the dinner seat capacity falls from 15.1 to about 14.2 per hour, so dinner serves about 41.5 instead of 42.7 and profit is about $349 instead of $366; all other lines are unchanged.

### 2.1 Set-up

* **Location:** 110 tile starter property in Canal Quarter (80 dining tiles, 30 kitchen tiles), leased at $11 per tile = $1,210 per week.
* **Day:** Thursday of week 1, spring (weekday_mult 1.00, season_mult 1.00). Rep 30 (new restaurant).
* **Cash before opening:** starting cash $40,000 plus starter loan $30,000 = $70,000; minus deposit $9,680, tables and decor $6,400 (4 two-tops $1,400, 4 four-tops $2,400, decor and lamps $2,600), freezer and dry shelf $2,200, opening stock $1,200 = **$50,520** on day 1. Thursday morning cash is taken as **$51,240** for this example (illustrative result of days 1 to 3).
* **Room:** 8 tables, 24 seats, ambience 55, no host.
* **Kitchen (pre-installed):** 1 Deck Oven, 2 Prep Counters, 1 fridge, 1 sink, plus the freezer and dry shelf bought above. Maintenance $40 + $20 = $60 per week.
* **Staff (weekly):** cook skill 5 $550, cook skill 4 $484, server skill 5 $450, server skill 4 $396, dishwasher skill 4 $334.40 = **$2,214.40 per week**.
* **Ingredients:** mostly Standard from Metro (offset 0) with Fratelli basil (offset -3): IQ 54.

**Menu (sales weighted averages used by the model):**

| Dish | Price | Food cost | Share of mains |
|---|---|---|---|
| Margherita | $11.00 | $2.40 | 40% |
| Pepperoni | $13.00 | $3.30 | 30% |
| Funghi | $12.00 | $2.70 | 20% |
| Quattro Formaggi | $13.00 | $3.10 | 10% |
| **Average main** | **$12.00** | **$2.80** | |
| Soft drink or house wine (average) | $4.00 | $0.85 | attach 0.80 |
| Garlic bread or bruschetta (average) | $6.00 | $1.60 | attach 0.30 |
| Tiramisu or panna cotta (average) | $6.00 | $1.40 | attach 0.2625 |

### 2.2 Quality, fair price and appeal

```
K  = 30 + 7 x 4.5 (average cook skill)          = 61.5
Q  = 0.50 x 54 + 0.15 x 70 + 0.35 x 61.5 + E 0   = 59.0
fair price = 4 + 0.08 x 59.0 + 1.5 x 2.80        = $12.92
r  = 12.00 / 12.92                               = 0.93  (inside the fair band, slightly cheap)
average check     = 12.00 + 0.80 x 4 + 0.30 x 6 + 0.2625 x 6 = $18.575
cost per cover    = 2.80 + 0.80 x 0.85 + 0.30 x 1.60 + 0.2625 x 1.40 = $4.3275
```

### 2.3 Demand by segment

`T x share x 0.035 x rep_mult 0.80 x menu_fit x price_mult x budget_mult x quality_mult x speed_mult x (1-0.5 x 0.30)`

| Segment | Guests | Main driver |
|---|---|---|
| Students | 6.6 | small share; budget_mult 0.69 at $12; speed_mult 0.8 at lunch (slow service without a host) |
| Families | 18.5 | good taste match for classics |
| Professionals | 18.2 | budget comfortable, speed_mult 0.8 at lunch |
| Foodies | 6.2 | quality_mult 0.98 at Q 59 |
| Seniors | 12.1 | |
| Tourists | 7.5 | |
| **Total** | **69.0** | lunch 26.3, dinner 42.7 |

### 2.4 Capacity and service

| | Lunch | Dinner |
|---|---|---|
| Service time (seat 5 + order 3.1 + cook 12.4 + serve 1.5 + pay 4.1) | 26.1 min | 26.1 min |
| Table cycle (with meal) | 66.7 min | 71.4 min |
| Seat capacity per hour (24 x 0.75 x 60 / cycle) | 16.2 | 15.1 |
| Kitchen capacity per hour (oven 19.4, prep 47.5) | 19.4 | 19.4 |
| Bottleneck | seats | seats |
| Service capacity (x hours x U) | 29.1 | 44.3 |
| Demand | 26.3 | 42.7 |
| Utilisation rho | 0.90 | 0.96 |
| Kitchen and seating queue delay | 18.6 min | 25 min |
| Served / walk-aways | 26 / 0 | 43 / 0 |

**What the player sees:** a pleasantly busy lunch, then a packed dinner where tables wait. End of day bottleneck banner: "Seats were full 96% of dinner. Two more 2-top tables (+$700) or a host (seat time 5 to 2 min, $420 per week) would help."

### 2.5 One guest, end to end

A family of four arrives at 19:40, waits for a table, orders Margherita and Pepperoni, a starter and drinks.

```
food_score    = 0.7 x 0.59 + 0.3 x 0.70           = 0.623
service_score = 0.30 + 0.06 x 4.5 (no host)        = 0.57
ambience      = 55 / 100                           = 0.55
value_score   = 0.7 - 0.6 x (0.93 - 1) x 1.5       = 0.763
perceived wait= 3.1 + 1.5 + 0.6 x 25               = 19.6 min vs tolerance 12
wait_score    = 1 - (19.6 - 12) / 12               = 0.363
S = 100 x (0.40 x 0.623 + 0.20 x 0.57 + 0.15 x 0.55 + 0.15 x 0.763 + 0.10 x 0.363) = 59.6
stars = round(1 + 4 x 0.596) = 3
review: "Lovely classic pizza, but we waited ages for our table."
```

### 2.6 Money flow (P&L, accrual view)

| Line | Calculation | Amount |
|---|---|---|
| **Sales** | 69 covers x $18.575 (lunch $482.95, dinner $798.73) | **$1,281.68** |
| Ingredients used | 69 x $4.3275 | -$298.60 |
| Waste | 5% of ingredients used (Standard tier) | -$14.93 |
| Staff | $2,214.40 / 7 | -$316.34 |
| Rent | $1,210 / 7 | -$172.86 |
| Utilities | $30 + $0.80 x 69 | -$85.20 |
| Upkeep | $15 + $60 / 7 | -$23.57 |
| Loan interest | $30,000 x 5% / 52 / 7 | -$4.12 |
| **Profit** | | **$366.06** |

Food cost ratio (ingredients plus waste over sales) = 24.5%, just under the healthy 25% to 35% band, which the advisor notes as good value for guests.

### 2.7 Money flow (cash view)

| Time | Event | Cash |
|---|---|---|
| 09:00 | Opening balance | $51,240.00 |
| 09:00 | Metro delivery (ordered Tuesday) paid on arrival | -$305.00 |
| 11:30 to 14:30 | Lunch sales | +$482.95 |
| 18:00 to 22:30 | Dinner sales | +$798.73 |
| 23:30 | Utilities and upkeep settled daily | -$108.77 |
| 23:30 | **Closing balance** | **$52,107.91** |

Cash rose $867.91 while profit was $366.06, because salaries, rent and loan are settled on Sunday night (week 1: salaries $2,214.40, rent $1,210.00, loan payment $303.26 including interest) and because $305 of stock arrived while $313.53 was used or wasted (stock value fell $8.53). The P&L screen explains this in one sentence: "Rent and wages are paid on Sunday; today's share is already counted in your profit."

### 2.8 Reputation after the day

About 26 parties, 20% review (5 reviews), expected review score 20 + 0.8 x 60.9 = 68.7. Rep = 30 + 0.05 x (68.7-30) = **31.9**. At this pace the restaurant reaches Rep 50 in about 2 weeks if it keeps satisfaction near 61, faster once a host and more tables fix the dinner waits.

---

## 3. Strategy comparison: luxury vs volume vs middle ground

### 3.1 Reference builds

Each build is a mature single location at steady state reputation (Rep where daily review score equals Rep), on a Thursday, spring. Prices are the reference prices; section 3.4 shows best prices.

| | Luxury "Trattoria Stella" | Volume "Slice Hall" | Middle "Canal Corner" |
|---|---|---|---|
| Home district | Old Harbour | University Quarter | Canal Quarter |
| Property | 136 tiles (100 dining, 36 kitchen) | 280 tiles (220 dining, 60 kitchen) | 150 tiles (110 dining, 40 kitchen) |
| Seats, tables | 40 seats, 12 tables, booths | 120 seats, 34 tables | 56 seats, 16 tables |
| Ambience | 85 | 45 | 65 |
| Ingredients | Premium and Artisan, IQ 84, pizza food cost $6.20 | Basic and Standard, IQ 42, pizza food cost $2.10 | Standard and Premium, IQ 65, pizza food cost $3.90 |
| Ovens | 2 Wood Fired (12 each at skill 5; 13.8 each at skill 7.5) | 3 Conveyor (44.5 each at skill 4) | 2 Stone Hearth (21.2 each at skill 6) |
| Prep | 2 Prep Counters, 1 Proving Cabinet | 4 Prep Counters each with a Dough Sheeter, Heat Lamp Pass, Dish Machine | 2 Prep Counters |
| Equipment modifier E | +10 oven +3 proving = +13 | -3 oven -2 sheeter = -5 | +5 |
| Staff | chef skill 8 fame 1 ($1,530), cook skill 7 ($682), 3 servers skill 6 ($1,512), host ($420), 2 dishwashers ($760) = $4,904 per week | 4 cooks skill 4 ($1,936), 7 servers skill 4 ($2,772), host ($420), 2 dishwashers skill 4 ($668.80) = $5,796.80 per week | 2 cooks skill 6 ($1,232), 4 servers skill 5 ($1,800), host ($420), 2 dishwashers ($760) = $4,212 per week |
| Kitchen skill K | 30 + 7 x 7.5 + 5 (chef specialty) = 87.5 | 30 + 7 x 4 = 58 | 30 + 7 x 6 = 72 |
| Harmony H | 85 | 65 | 75 |
| **Dish quality Q** | **98.4** | **46.1** | **74.0** |
| Fair price | $21.17 | $10.83 | $15.77 |
| Reference main price | $38.00 (r 1.80; was $28.00, M0.2) | $8.50 (r 0.78) | $13.00 (r 0.82) |
| Sides (drink, starter, dessert) | $7.00, $9.00, $8.00 | $3.00, $4.50, $4.00 | $4.50, $7.00, $6.50 |
| Attach (from ambience) | 0.90, 0.50, 0.45 | 0.80, 0.30, 0.20 | 0.82, 0.34, 0.325 |
| Equipment maintenance | $350 per week | $520 per week | $140 per week |
| Waste rate (tier mix) | 9% | 3.5% | 6% |
| Capex (equipment, furniture, deposit) | about $92,000 | about $95,000 | about $55,000 |

### 3.2 Results in their home districts (per day)

Luxury column retuned in M0.2 (hand estimate, pending `npm run balance`; pre M0.2 values in brackets). Volume and middle are unchanged by the retune except that middle's dinner queue grows slightly (rho about 0.9).

| | Luxury in Old Harbour | Volume in University Quarter | Middle in Canal Quarter |
|---|---|---|---|
| Steady state Rep | about 84 (86) | 70 | 80 |
| Average satisfaction | about 79.8 (82.6) | 62.7 | 74.5 |
| Demand | about 88 (126) | 358 | 143 |
| Covers served | about 79 (106) | 358 | 143 |
| **Covers per service, lunch / dinner (M0.2)** | **about 26 / 53** (38 / 68) | **about 189 / 169** | **about 55 / 88** |
| Walk-aways | about 9 turned away at the door, dinner full (20) | 0 | 0 |
| Bottleneck | seats at dinner (rho about 1.15) | seats and kitchen at the lunch rush (rho 0.92) | none (rho 0.8) |
| Top segments served | Foodies 52, Tourists 18, Professionals 6 (59, 31, 10) | Students 222, Families 63, Professionals 47 | Professionals 40, Families 31, Seniors 26 |
| Service time | 23.1 min | 17.3 min (speed_mult 1.16) | 21.8 min |
| Average check | $52.40 ($42.40) | $13.05 | $21.18 |
| Cost per cover | $10.20 | $3.06 | $5.85 |
| **Sales** | **about $4,155 ($4,490.71)** | **$4,671.99** | **$3,021.47** |
| Ingredients used | about -$809 (-$1,080.31) | -$1,095.50 | -$834.73 |
| Waste | about -$73 (-$97.23) | -$38.34 | -$50.08 |
| Staff | -$700.57 | -$828.11 | -$601.71 |
| Rent | -$369.14 | -$320.00 | -$235.71 |
| Utilities | about -$93.44 (-$114.73) | -$316.41 | -$144.11 |
| Upkeep | -$65.00 | -$89.29 | -$35.00 |
| **Profit per day** | **about $2,045 ($2,063.73)** | **$1,984.34** | **$1,120.12** |
| Profit per cover | about $25.80 ($19.49) | $5.54 | $7.85 |
| Payback on capex | about 45 days | about 48 days | about 49 days |

**Reading the comparison.** Luxury and volume land within 4% of each other by opposite routes: luxury earns $19.49 per cover from 106 covers, volume earns $5.54 per cover from 358 covers. Luxury's limit is seats (long dinners), so it prices up; volume's limit is the lunch rush, so it adds ovens and seats. Both need about $92,000 to $95,000 of investment and pay it back in about 6.5 to 7 weeks. The middle build needs less capital, is calmer, and pays back at a similar rate but with roughly half the daily profit.

**M0.2 reading.** After the realism retune luxury is a true fine dining room: about 53 dinner covers over 90 minute foodie evenings at a $52.40 check, $25.80 profit per cover. Volume and luxury stay within 3%.

### 3.3 Every build in every district (reference prices, profit per day)

| Build | University Quarter | Canal Quarter | Old Harbour |
|---|---|---|---|
| Luxury ($38 since M0.2; rerun required, pre M0.2 values at $28 shown) | -$192 (25 covers) | $58 (35 covers) | **about $2,045** (79 covers; was $2,064, 106 covers) |
| Volume ($8.50) | **$1,984** (358 covers) | -$50 (147 covers) | -$576 (125 covers) |
| Middle ($13) | $1,563 (169 covers) | **$1,120** (143 covers) | $1,142 (156 covers) |

### 3.4 Best price per build and district (price searched within each strategy's band)

| Build (band) | University Quarter | Canal Quarter | Old Harbour |
|---|---|---|---|
| Luxury ($20 to $40 since M0.2; rerun required) | $667 at $20 | $1,014 at $20 | **about $2,045 at $38** (was $2,078 at $30) |
| Volume ($8 to $10) | **$2,106 at $8** | -$50 at $8.50 | -$576 at $8.50 |
| Middle ($12 to $16) | $1,652 at $12 | **$1,236 at $12** | $1,415 at $16 |

### 3.5 Balance checks (automated, F-81)

| Check | Rule | Result |
|---|---|---|
| Two strategies both win | Luxury home profit and volume home profit within 10% | $2,064 vs $1,984, 4% apart: pass (M0.2 estimate $2,045 vs $1,984, 3%) |
| Neither strictly dominates | No build is the top earner in all districts | Luxury tops Old Harbour, volume tops University Quarter, middle tops Canal Quarter: pass |
| Middle ground not dominant | Each specialist beats the best middle build in its home district by 15% or more | Volume +27% ($2,106 vs $1,652); luxury +47% ($2,078 vs $1,415): pass |
| Middle ground possible | Best middle build profit positive in all districts and top in the mixed district | $1,236 to $1,652, top in Canal Quarter: pass |
| Specialists must fit their district | Specialists lose money in the other specialist's home district | Luxury -$192 in University Quarter, volume -$576 in Old Harbour: pass |
| No dead end | Minimum viable restaurant at Rep 30 at fair price breaks even in Canal and University | +$33 and +$93 per day: pass (Old Harbour -$55, flagged "ambitious"). Since M0.2 the minimum viable restaurant is the `fresh-start.md` 7 opening: about +$134 in Canal Quarter, more in University Quarter, about +$30 to +$70 in Old Harbour (AC-163) |
| Fine dining covers (M0.2) | Luxury home dinner covers 40 to 60 | about 53: pass (estimate, AC-169) |
| Fast turnaround covers (M0.2) | Volume home dinner covers at most 180 | about 169: pass (estimate, AC-169) |
| Covers ceiling (M0.2) | At the seat limit, all Students, volume service speed: premises below the Big hall at most 180 per dinner, Big hall at most about 250 | 34, 93, 116 and 255: pass (AC-170) |

### 3.6 Why each strategy works, in the formulas

* **Luxury (M0.2):** since the retune, Foodies B 28 x W 1.5 = $42 keeps budget_mult at 1.2 even at a $38 main, and dinners last 90 minutes, so the room serves about 53 dinner covers at a $52.40 check. **Luxury (pre M0.2 text):** quality_mult for Foodies is 1.6 (capped) at Q 98 and Old Harbour's wealth W 1.3 lifts Foodies' budget to $31.20, so budget_mult stays 1.2 at a $28 main. Tourists (budget $26 in the harbour) still come at 0.86. The Wood Fired Ovens give +10 quality but only 27.6 servings per hour, so the room fills with long 60 minute dinners and the right answer is to raise prices rather than add covers.
* **Volume:** University students' budget is $8 (W 0.8), so at $8.50 their budget_mult is 0.89, while at the middle build's $12 it is 0.44. The conveyor ovens, heat lamp pass and host cut service time to 17.3 minutes, earning speed_mult 1.16 at lunch for Students and Professionals. Volume gear keeps speed high with cheap skill 4 cooks.
* **Middle:** decent at everything, so it is never punished, but it cannot reach the foodie premium (quality_mult 1.28 instead of 1.6 and a price too low for the harbour) nor the student lunch rush (budget_mult 0.44 and no speed bonus).

### 3.7 Tuning guardrails

* If playtests show one strategy chosen by fewer than 30% of experienced players (M5), adjust in this order: segment budgets B, district wealth W, equipment throughput, before touching global constants.
* Artisan equipment throughput must stay below the Deck Oven's 20 servings per hour at skill 5.
* Hybrid equipment must cost at least twice the best single family item it combines, so it is a late game upgrade, not a shortcut.
* Any change that moves a reference build's profit by more than 15% requires rerunning sections 2 and 3 and updating AC-10, AC-11, AC-12, AC-105 and AC-114.

---

## 4. M0 tuning log

The M0 simulation (`src/sim`) is now the reference calculator. `npm run balance` prints the live strategy table and enforces the section 3.5 checks. Changes made while implementing it:

| Change | Why |
|---|---|
| Students budget B 10 to 11 | With the formulas implemented exactly, the volume build fell 17% short of luxury and only 3% above the middle build in University Quarter. Budget is the first lever in 3.7. |
| Tables per server before penalty 4 to 5 | The reference volume (34 tables, 7 servers) and middle builds assumed no load penalty. |
| Walk-away penalty only for guests who gave up waiting | A full luxury room turns guests away every dinner; the reference steady state Rep 86 assumed no penalty for that. |
| `taste_match = min(1, 0.1 + 0.45 x liked tags)` | Not defined in the PRD; reproduces the starter day covers within 1%. |
| Sides fair price `1.5 + 0.04 x Q + 1.5 x food cost` | The pizza formula made every side look far below fair. |
| Volume reference menu targets students (Pepperoni, Diavola, Salsiccia, Quattro Formaggi, Margherita) | A volume player builds for the district's main segment. |

Current results (`npm run balance`, steady reputation, Thursday):

| Build | University Quarter | Canal Quarter | Old Harbour |
|---|---|---|---|
| Luxury | about -$5 (best $1,117 at $20) | about $180 | about $1,980 (best about $2,000 at $30) |
| Volume | about $1,920 (best about $2,000) | loses money | loses money |
| Middle | best about $1,720 | best about $1,320 (top here) | best about $1,310 |

### 4.1 M0.2 tuning log: Fresh Start and realistic covers (2026-09-26)

Founder requirements: start from an empty premises with little money (rags to riches), and realistic covers (fine dining about 40 to 60 per dinner, fast turnaround up to about 180, only a warehouse about 250). Specs: `fresh-start.md`, `kitchen-builder.md`. **All results below are hand calculated with the aggregate formulas; engineering must rerun `npm run balance` and paste the live table here (AC-169 to AC-171).**

| Change | Old | New | Why |
|---|---|---|---|
| `finance.startingCash` | 40,000 | 7,000 | Rags to riches: the cheapest opening ($5,296 in Canal Quarter) leaves $1,704 |
| `finance.starterLoanMax` | 30,000 | 5,000 | A small cushion, not a shortcut |
| `finance.starterLoanWeeks` | 104 | 52 | Keeps the weekly payment small ($98.62) on a small loan |
| `finance.leaseDepositWeeks` | 8 | 4 | Makes each premises move a step, not a wall |
| Menu minimum items (`game.ts` toggleMenu, move to data as `menu.minItems`) | 4 | 0 | The menu starts empty; opening needs 1 pizza |
| New premises `hole` | none | dining 6x5, kitchen 8x3, 54 tiles | Cheap first home: rent $432 to $1,026 per week |
| `PREMISES` kitchen grids (new fields) | none | cosy 10x3, medium 12x3, large 15x4, hole 8x3 | Kitchen Builder |
| Seat limit (new, `build.maxSeatsPerDiningTile`) | none | 0.55 | Guarantees the covers ceiling |
| Students meal length, dinner | 25 | 45 | Realism; lowers the warehouse ceiling to about 255 |
| Foodies meal length, dinner | 60 | 90 | Fine dining: luxury dinner 68 to about 53 covers |
| Foodies budget B | 24 | 28 | Luxury keeps its foodies at a $38 main (3.7: budgets first) |
| Old Harbour wealth W | 1.3 | 1.5 | Same for harbour tourists and professionals; volume in the harbour unaffected (its budgets were capped) |
| Luxury reference main price and band (balance calculator) | $28, band $20 to $34 | $38, band $20 to $40 | Fewer, longer, pricier dinners |
| New items | none | Second hand Deck Oven, Old Workbench, Folding Table, Pizza Prep Fridge with Marble Top, Dough Fridge, Sink (1.7, 1.9) | Entry level ladder and Kitchen Builder |
| New game state | 1 Deck Oven, 2 Prep Counters, starter tables and decor, 5 staff, 4 pizzas and sides on menu | everything empty | Founder requirement 1 |
| First hiring board | random | at least 2 cooks, 2 servers, 1 dishwasher, skill 2 to 4 | The empty start must always be openable |

Expected results after the change (Thursday, steady Rep):

| Build | Lunch covers | Dinner covers | Profit per day |
|---|---|---|---|
| Fresh start opening, Canal, Rep 30 | 13.9 | 19.7 | $134 |
| Cosy starter (section 2) | 26.3 | about 41.5 | about $349 |
| Middle, Canal | about 55 | about 88 | about $1,100 |
| Luxury, Old Harbour | about 26 | about 53 | about $2,045 |
| Volume, University | about 189 | about 169 (about 228 on a Saturday) | $1,984 |

**Watch list for the rerun.** (1) If the middle build loses the top spot in Canal Quarter because Foodies B 28 lifts luxury there, set Foodies B to 26 first. (2) If volume in University Quarter falls under +15% over the best middle build (it is +16% in the M0 sim), the retune did not cause it, but fix it before M0.2 closes by Students B, per 3.7. (3) The M0 sim's luxury ran about 4% below this document; the $38 price may need to become $36 to $40 after the rerun.

### 4.2 Primi, secondi and menu complexity (2026-09-26)

Founder request: a wider menu with primi piatti and secondi, more ingredients to combine, and a real cost to a wide or fancy menu: more complexity for the kitchen and lower output.

**Content.** 15 primi (pasta, fresh pasta, risotto, gnocchi), 9 secondi (meat, fish, one vegetarian), 3 new antipasti, 36 new ingredients and a new `seafood` supplier category (Fratelli Standard, Metro Basic to Premium, Casa Premium and Artisan). New harmony pairs for the classics (guanciale and pecorino, butter and sage, sea bass and lemon, ...) and the Italian rule "no cheese on fish" as clashes. The recipe creator makes pizzas, primi (on a pasta, rice or gnocchi base) and secondi. Older saves get the new dishes in their recipe book on load.

**Mains.** A guest orders one main: a pizza, a primo or a secondo (`MAIN_KINDS`). Primi and secondi use the main pricing line plus `pricing.fairKindPremium` (primo +$1, secondo +$4) and allow 5 extras before the harmony penalty (`quality.maxExtrasBeforePenaltyNonPizza`). Dish choice now steers away from mains above a segment's budget: appeal minus `demand.budgetChoiceAversion` (1.5) x (price / (budget x wealth) minus `demand.budgetChoiceSlack` (1.2)). With pizzas only and prices inside the slack this changes nothing.

**Kitchen.** Primi and secondi do not use the pizza oven: oven covers per hour = oven pizzas per hour / pizza share of mains. They do load the prep line: work per plate is 1 for a pizza, 1.25 for a primo, 1.5 for a secondo, plus 0.08 per extra above 4 (`menu.work`, `menu.workPerExtra`).

**Menu complexity** (`src/sim/menu.ts`, tunables `menu`):

`complexity = 1 x food dishes on the menu + 0.5 x distinct food ingredients`
`allowance = 16 + 1 x (average kitchen skill - 5)`
`efficiency = max(0.6, 1 - 0.02 x max(0, complexity - allowance))`

Prep speed is multiplied by the efficiency and ticket (cook) times grow by half of the slowdown. Drinks do not count. The classic starter menu (score 12) and every reference build (score 13.5 to 15) sit inside the allowance, so the golden day and the strategy table are unchanged.

Measured (steady Rep, Thursday, extras on top of the reference menus):

| Build | Menu | Complexity | Line speed | Covers | Profit per day |
|---|---|---|---|---|---|
| Middle, Canal | reference | 13.5 / 17 | 100% | 155 | $1,260 |
| Middle, Canal | + 4 simple primi | 21.5 / 17 | 91% | 167 | $1,515 |
| Middle, Canal | + 10 fancy primi, secondi, antipasti | 36.5 / 17 | 61% | 134 (prep bound) | $1,220 |
| Volume, University | reference | 15 / 15 | 100% | 364 | $1,927 |
| Volume, University | + 2 primi | 20.5 / 15 | 89% | 373 | $2,206 |
| Volume, University | + 10 fancy dishes | 38 / 15 | 60% | 313 (prep bound) | $1,695 |

A few primi that share ingredients pay off: they relieve the oven and lift the check. A long, fancy menu turns prep into the bottleneck and costs covers and profit unless the brigade is skilled. `build.menuMaxItems` went from 16 to 24.

### 4.3 Earning a local following, and visibility (2026-09-26)

Founder request: bring demand closer to capacity, and make getting started hard. A new restaurant has no loyal base yet and has to earn it.

**Why it was easy.** Demand did not depend on the size of the restaurant, so the 12 seat opening in Canal Quarter had 2.1 to 2.4 times more guests wanting in than it could seat from day 1. Price barely mattered: +40% on every dish doubled profit over 100 days.

**Visibility** (new `Premises.visibility`): the share of passers-by who notice the shopfront. Hole in the wall 0.5, cosy corner shop 0.75, corner unit 0.9, trattoria, loft and big hall 1.0. The reference builds use 1.0 premises, so the strategy table (3.3) is unchanged.

**Local following** (new `GameState.following`, tunables `following`), 0 to 100%:

`demand x (0.25 + 0.75 x following)`

A new restaurant starts at 10%, so about a third of full demand comes in. Each open day the following moves toward a target set by the day's satisfaction:

`target = (satisfaction - 35) / (62 - 35)`, clamped to 0..1

It rises at 4% of the gap a day (word of mouth; scaled down when fewer than 30 guests are served) and falls at 4% a day. Guests who give up waiting take away 0.1 x the share who gave up. Closed days lose 2%. Moving within a neighbourhood keeps 60% of the following; moving across town starts over at 10%. Saves from before this change load at 80% (established).

A solidly liked restaurant (satisfaction 62 or more) earns the full following; a mediocre one (52) settles near 63%. Overpricing lowers the value score and so the following, so it now costs guests over time as well as on the day.

**Measured** (cheapest opening in Canal Quarter, fair prices, nothing else changed):

| Day | Following | Guests | Dinner demand / capacity | Profit per day | Cash |
|---|---|---|---|---|---|
| 1 | 11% | 8 | 0.26 | -$145 | $1,753 |
| 7 | 18% | 14 | 0.44 | -$73 | $989 |
| 14 | 26% | 19 | 0.57 | -$23 | $583 |
| 28 | 44% | 26 | 0.80 | +$68 | $721 |
| 56 | 65% | 35 | 1.11 | +$168 | $3,539 |
| 120 | 78% | 32 | 0.95 | +$137 | $13,724 |

The first three weeks lose money; cash bottoms out around $500 without the loan. The same opening at +40% prices loses money for about 9 weeks. In University Quarter (cheaper rent) the first profitable week is week 2.

Tests updated: the golden starter day (section 2) now runs at an established following with the cosy shop's 0.75 visibility: 52.6 guests at Rep 30 with no bottleneck (was 67.5 with seats full). AC-162 now checks that the first two weeks lose money, week 8 makes at least 80% of the old $134 a day, and cash stays above zero.

**Fast forward.** "Run a week" runs up to 7 days without the service animation and shows a week summary. It stops early when the restaurant cannot open, someone hands in notice or leaves, or the bank restructures the loan.

### 4.4 Fire safety upgrades, and a kitchen guests can feel (2026-09-26)

Founder requests: buy fire safety equipment to raise the room's capacity, only once the restaurant has been open for two months; and when kitchen equipment improves, guest satisfaction should visibly go up.

**Fire safety** (`src/data/fireSafety.ts`, `T.fireSafety`). Four one time upgrades, bought in order from the Room tab. Each raises the fire safety seat limit (0.55 seats per dining tile) by a share of the base:

| Upgrade | Price | Seats | Inspections per week |
|---|---|---|---|
| Extinguishers and exit signs | $900 | +5% | $5 |
| Fire alarm system | $2,800 | +10% | $15 |
| Second emergency exit | $6,500 | +10% | $0 |
| Sprinkler system | $12,000 | +15% | $40 |

All four together allow 40% more seats. They unlock after 60 days open (`GameState.daysOpen` counts only days the restaurant opened). They belong to the building: moving leaves them behind and restarts the 60 days. Saves from before this change count every day played as a day open.

**Craft on the plate.** Food score + `satisfaction.equipmentFood` (0.01) x E x (0.5 + segment quality appeal), where E is the equipment quality bonus when positive. Foodies (appeal 1.0) feel it three times as much as students (0). Speed focused volume gear with a negative E costs nothing extra here; it already lowers dish quality.

**Ticket time.** Minutes from order to plate = cook time + 0.5 x the kitchen queue (the same queue formula as the door, on served guests per hour against kitchen capacity per hour). It counts for 40% of the wait score: full marks up to 12 minutes, zero at 32. More or faster stations bring food out sooner when the kitchen is busy.

Measured on the cosy starter: deck oven 67.2 satisfaction; Stone Hearth 70.4 (was +1.7, now +3.2); plus a Proving Cabinet 72.2. In University Quarter the plain middle build's lunch tickets take about 24 minutes; a second oven brings them down.

**Retune.** The add-on guardrail (kitchen-upgrades.md 7) had only $7 a day of headroom before this change, and a fully upgraded middle build gained about $30. Following the order in kitchen-upgrades.md 7 and 3.7 (qualityCap was already 2): Students budget B 11 to 11.5. Volume at home $1,922 to $2,113 a day; middle in University Quarter $1,615 to $1,689; luxury and the other districts within a few dollars. The add-on test now takes each specialist's best price in its band, as the spec says, instead of a fixed $8. The upgraded middle build trails volume by 17% and luxury by 42%.

**Start setting (settings menu, `Economy.start`).** "Slow start" (default on Normal and Hard) opens a new restaurant at a 10% following as described in 4.3. "Normal start" (default on Easy) opens at 100%, as before the following existed; it then only drops if guests are unhappy. The choice applies to new games, fresh starts and moves, and is remembered on the device for the next new game.

### 4.5 A second restaurant under a restaurant manager (2026-09-26)

Founder request: before buying another restaurant, the player hires a manager for the current one; that restaurant is then run according to the manager's skills. First slice of prd.md 5.9 and 5.12.

**Manager.** New staff role, base salary $1,100 a week (prd.md 5.8), skill 3 to 9 on the hiring board; one manager candidate applies every week from the second week on (own random stream, so the rest of the board is unchanged). While the player runs the restaurant the manager has nothing to do.

**Opening another restaurant.** City map, any venue you do not run: "Open a new restaurant here" next to "Move here". It needs a restaurant manager on the current team and the new venue's deposit. The current restaurant (room, kitchen, team, menu, reputation, following, fire safety) becomes a managed restaurant; the new one starts empty at Rep 30 and the start setting's following, with a copy of the recipe book and menu. Cash, loan, rank and the hiring board are shared. "Go and run it" (Money tab or city map) switches between restaurants; the one you leave needs a manager.

**How a manager runs it** (`T.manager`, `src/sim/chain.ts`), skill m:

| | Formula | m = 3 | m = 5 | m = 9 |
|---|---|---|---|---|
| Guests | 1 - 0.10 + 0.02 x m | -4% | as the player | +8% |
| Stock accuracy | 0.70 + 0.03 x m | 0.79 | 0.85 | 0.97 |
| Waste | 1 + 2 x (0.85 - accuracy) | +12% | as the player | -24% |

A frugal manager buys 5% cheaper. Without a manager (caretaker mode): 20% fewer guests, waste x1.5. Better managers cost more (salary scales with skill), so a skill 9 manager pays off in a busy restaurant, not a quiet one.

**Each day** every managed restaurant runs the same day model with those effects (its own randomness, no loan interest). Sales and daily costs settle into the shared cash; wages and rent on Sunday. Its reputation, following, days open and last 28 days of reports update. Staff at a managed restaurant do not grow or change morale yet. The day and week reports list the other restaurants; "Run a week" no longer stops for a closed day when other restaurants are earning.

Not in this slice (prd.md 5.9): manager policies (strategy, price band, tier floor), manager pricing, hiring and equipment proposals, weekly manager report card, cannibalisation in the same district, chain menu and central purchasing.

**Reputation gate** (`T.manager.openRep`, prd.md 5.12): opening another restaurant needs reputation 50 (2.5 stars) at a restaurant you already run. The city map says so and shows your current reputation. Measured at fair prices: the cheapest opening in Canal Quarter reaches 50 on day 17, a cosy starter on day 12. See 4.6 for the stricter reputation that makes this gate a real hurdle.

### 4.6 Reputation follows satisfaction more strictly (2026-09-26)

Founder request: reputation 50 should be a real first hurdle before a second restaurant. Reputation used to settle at 20 + 0.8 x satisfaction, so a mediocre restaurant (satisfaction 52) still reached about 62.

| Tunable | Old | New |
|---|---|---|
| `reputation.reviewBase` | 20 | -10 |
| `reputation.reviewSlope` | 0.8 | 1.1 |
| `demand.repMultSlope` | 0.010 | 0.012 |

Reputation now settles near satisfaction itself: 52 gives 47, 60 gives 56, 70 gives 67, 80 gives 78. Because established restaurants now sit about 10 points lower, each reputation point is worth a little more demand (0.5 + 0.012 x Rep), so the reference builds earn about what they did.

Strategy table after the change (reference price, best price in band): luxury in Old Harbour $2,155 / $2,166; volume in University Quarter $2,138; middle best $1,699 University, $1,410 Canal, $1,296 Old Harbour. All balance checks pass; the fully upgraded middle build trails volume by 18% and luxury by 43%.

Measured, reputation 50 (the gate for a second restaurant, 4.5): the cheapest opening at fair prices on day 45 (it settles near 54); the same at +40% prices on day 87; a properly set up cosy restaurant (satisfaction about 67) on day 18. The golden starter day at Rep 30 now has 57.0 guests and $1,086 sales (was 52.6 and $1,003), because Rep 30 counts for a little more demand.

### 4.7 The bar: Italian wine list, aperitivi and digestivi (2026-09-26)

Founder request: more drink options to raise revenue per guest (share of wallet): an Italian wine selection and grappa.

**Content.** Drinks: sparkling water, Italian lager, and six wines by the glass (Prosecco, Pinot Grigio, Montepulciano d'Abruzzo, Chianti Classico, Barolo, Brunello di Montalcino; the house wine counts as a wine too). Two new courses: aperitivi (Aperol Spritz, Negroni, Bellini, Campari Soda) and digestivi (espresso, limoncello, grappa, grappa riserva, amaro, sambuca). The menu now holds up to 36 items. Bar items need no kitchen work and do not count toward menu complexity (4.2).

**Rules** (`T.attach`, `T.pricing.barCostMult`):
* Wine list: every wine on the menu beyond the first adds 5% more drinks per guest (second glasses), up to +25%.
* Aperitivi: attach 0.12, up to 0.27 with ambience (pivot 55, span 30). Digestivi: 0.15, up to 0.35. Both x segment affinity (students 0.4, families 0.4, professionals 1.1, foodies 1.4, seniors 1.0, tourists 1.3) and x 0.3 at lunch.
* Guests linger: +6 minutes at the table per aperitivo and +8 per digestivo ordered, so a full room turns tables a little slower.
* Drinks are chosen against 40% of the segment's meal budget (the main dish rule of 4.1 with budgetShare 0.4): students take the house wine, foodies the Barolo.
* Fair price for bar items uses 2.5 x cost instead of 1.5: guests accept a bigger markup on wine and spirits.

Measured on the cosy starter at Rep 60, adding four wines, two aperitivi and four digestivi: spend per guest $19.07 to $22.22 (+16%), profit +$146 a day, one guest a day fewer from slower table turns. The reference builds do not use the new items, so the strategy table is unchanged.

### 4.8 Room touches: decoration without giving up a table (2026-09-26)

Founder request: more, smaller decorations to make the room beautiful without sacrificing a table.

`src/data/roomTouches.ts`: 13 one time purchases for the whole room that take no floor tile, grouped as walls (bunting, chalkboard, family photos, gilded mirror, grapevine trellis, Amalfi coast mural), tables (candles, checked tablecloths, fresh flowers, seat cushions), lighting (brass wall sconces, pendant lights) and atmosphere (Italian music). Each adds decor points, lighting and or comfort to ambience exactly like floor decor; fresh flowers ($25), music ($10) and candles ($5) cost a little each week. They move with you; removing one sells it at 80%. The dining room view draws them: wall pieces on the back wall, candles, flowers and pendant light glow on every table.

With everything installed the cosy starter room reaches ambience 94 (from 57), which lifts satisfaction and how many guests order drinks, starters, desserts, aperitivi and digestivi.

### 4.9 A good wine list draws foodies and lifts the rating (2026-09-26)

Founder request: a larger wine list should mean higher spend per guest, more foodies and a higher rating.

**Wine list score** (`wineListScore` in `src/sim/day.ts`, 0 to 1): wines beyond the first / 6, x average wine quality / 60 (clamped 0.7 to 1.3), capped at 1. So the house wine plus six more at Standard tier scores 1; better tiers reach it sooner.

* **Spend per guest:** second glasses, +5% drinks per wine beyond the first, up to +25% (4.7).
* **More foodies:** demand x (1 + wineDemand x score): foodies +25%, tourists +10%, professionals +8%, seniors +5%, students and families 0.
* **Higher rating:** food score + 0.10 x score x (0.5 + segment quality appeal): foodies +0.15, students +0.05 at a full list. Reviews sometimes praise the wine list.

Measured at steady reputation, cosy shop, adding six wines to the house wine: Canal Quarter reputation 61.7 to 64.3, satisfaction 65.1 to 67.3, foodies wanting in 4.3 to 5.4, spend per guest $19.08 to $21.50, profit $411 to $562 a day. Old Harbour (foodie district): reputation 60.4 to 64.4, foodies 14.1 to 18.3, spend $19.13 to $23.30, profit $186 to $399. The reference builds carry only the house wine (score 0), so the strategy table is unchanged.

**Wine cellar (2026-09-26).** Ten more famous Italian wines by the glass, each priced inside its fair band: Lambrusco $6, Nero d'Avola $6.50, Soave Classico $7, Vermentino di Sardegna $7.50, Primitivo di Manduria $8, Franciacorta $11, Barbaresco $13, Amarone della Valpolicella $15, Tignanello $19, Sassicaia $26. That makes 17 wines including the house wine. The wine list score still reaches its maximum at 7 wines (house plus six), so the extra choice is for variety and for pairing the list to the district: budget wines for students and families, the big Tuscans and Piedmontese for foodies and tourists.
