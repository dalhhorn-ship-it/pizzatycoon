# PRD addendum: Staff management (the Squad)

* Status: Draft 1 for milestone **M0.4**
* Owner: Game Product Management
* Date: 2026-09-27
* Extends: `prd.md` 5.8 (Staff) and 5.9 (Restaurant manager), `balance.md` 1.10 and 4.5, `src/sim/chain.ts`
* Features: F-124 to F-140 in `features.md`. Acceptance criteria: AC-194 to AC-225 in `acceptance-criteria.md`
* **All numbers are start values in `T.staff`, `T.training`, `T.mood` and `T.market`; AC-222 and AC-223 make `npm run balance` confirm them.**

## 1. Goal and the loop it serves

Founder request: "develop deeper staff management (in case the owner is managing this restaurant, else the manager manages the staff): training to raise skills in an area; several key skills per staff member (Quality, Speed, Ability to handle pressure, Mentoring), a bit like a FIFA coach; a bigger market for new staff; personal traits x restaurant performance (speed, business, quality) that move morale in different ways, so that personal management, training and replacement matter; and the day and week report show the positive and negative impact of each staff member."

Today a staff member is one number (skill 1 to 10), up to two traits and a morale value that drifts to 70 on its own. There is little to read and almost nothing to decide after the hire. This addendum turns the team into a **squad**: people with a player card, strengths and weaknesses, a personality that reacts to how the restaurant is doing, and a development path the player (or their manager) shapes.

* **Loops served:**
  * **Day:** read the team card in the day report: who carried the dinner rush, who struggled, who is unhappy and why.
  * **Week:** train, coach, give a raise, scout the market, replace the weak spot. Fast forward reports show the week's star and the week's problem.
  * **Long term:** grow apprentices into gold card chefs; build a team that fits the strategy (a volume kitchen of fast, calm cooks; a luxury kitchen of craftspeople); hand the whole job to a restaurant manager when the chain grows.
* **Feeling:** "That's my team." The pride of a coach who spotted a 38 rated apprentice and made them a 76 rated head chef.
* **Design intent:** staff decisions should be **legible, few and meaningful**. The player never manages shifts minute by minute; they read a card, see a clear reason and make one decision a week. Nobody quits without warning (pillar kept from prd.md 5.8).

### 1.1 Who manages the staff

| Restaurant | Who makes staff decisions | What the player sees |
|---|---|---|
| The one the player runs | **The player**: hire, train, coach, raise, promote, let go | Full Squad screen, all actions |
| The one the player runs, with a manager on the team and "Let my manager handle the team" on | **The manager**, by policy (section 8) | Squad screen read only plus Override on any card |
| A managed restaurant | **The manager**, by policy (section 8) | Squad screen read only, weekly manager report, Override on any card |
| A managed restaurant with no manager | Nobody: caretaker mode, nobody is trained or replaced, morale drifts | Warning in reports (existing `CARETAKER_TEXT`) |

## 2. The player card: four key attributes

Every staff member has four attributes on a **1 to 99** scale (card style, like a football game):

| Attribute | Short | What it does in the sim | Kitchen (chef, cook) | Floor (server, host) | Back (dishwasher) | Manager |
|---|---|---|---|---|---|---|
| **Quality** | QUA | How good the work is | Kitchen skill K (pizza quality), artisan gear threshold, menu complexity | Service score | Plates washed clean (no effect at M0.4) | Stock accuracy, pricing sense |
| **Speed** | SPD | How fast the work is | Personal speed at oven and prep | Server speed (order, serve, pay) | Plates per hour | Guests (running the room) |
| **Composure** | CMP | Handling pressure: how a person performs and feels when the restaurant is busy | Speed and quality under pressure | Speed and service under pressure | Speed under pressure | Keeps the team calm (mood) |
| **Mentoring** | MEN | Making teammates better | Coaching and team growth | Coaching and team growth | Coaching and team growth | Staff development at a managed restaurant |

### 2.1 Overall rating (OVR) and card tier

`OVR = round(sum of weight x attribute)` with role weights (like a position rating):

| Role | QUA | SPD | CMP | MEN |
|---|---|---|---|---|
| Chef | 0.45 | 0.15 | 0.20 | 0.20 |
| Cook | 0.30 | 0.40 | 0.25 | 0.05 |
| Server | 0.35 | 0.35 | 0.25 | 0.05 |
| Host | 0.50 | 0.15 | 0.30 | 0.05 |
| Dishwasher | 0.10 | 0.60 | 0.30 | 0.00 |
| Manager | 0.25 | 0.10 | 0.30 | 0.35 |

Example: a cook with QUA 60, SPD 70, CMP 50, MEN 30 has OVR 18 + 28 + 12.5 + 1.5 = **60**.

**Card tier** (card colour on every screen): Bronze OVR 1 to 49, Silver 50 to 64, Gold 65 to 79, Elite 80 to 99. A fame star adds a small star badge to the card (fame rules of prd.md 5.8 unchanged).

**Potential (POT)** replaces the hidden 6 to 10 potential: an OVR ceiling from 30 to 95. It is shown as a range ("POT 68 to 78") that narrows to the exact value after 4 weeks on the team (section 4.3). Growth above POT is possible but slow (section 3.3).

### 2.2 Where the attributes enter the existing formulas

The sim keeps its formulas; the single `skill` input is replaced by the attribute that fits, on the old 1 to 10 scale (`attribute / 10`):

| Existing formula (file) | Was | Becomes |
|---|---|---|
| Kitchen skill K (`analysis.ts` kitchenStats) | `kitchenBase + kitchenPerSkill x skill` | `... x QUA/10 x pressure_q x morale_q` |
| Personal speed (`analysis.ts` personalSpeed) | `speedBase + speedPerSkill x skill` | `... x SPD/10`, then `x pressure_s` |
| Artisan gear threshold, menu complexity | average kitchen skill | average kitchen QUA/10 |
| Service score (`analysis.ts` serviceStats) | `servicePerSkill x avg server skill` | `servicePerSkill x avg server QUA/10 x pressure_q` |
| Manager effect m (`chain.ts` managerEffect) | manager skill | manager OVR/10 |
| Salary (`analysis.ts` salaryFor) | `base x (1 + 0.12 x (skill - 5))` | `base x (1 + 0.012 x (OVR - 50))`: identical at OVR = 10 x skill |

### 2.3 Composure: performance under pressure

Pressure is the **load on the person's own area** in that service, measured from the day's stages (built: first review). A queue at the door is not the kitchen's problem:

```
kitchen load = seated guests per hour / min(prep, oven) per hour
floor load   = guests who want in per hour / seats per hour
back load    = plates the kitchen sends per hour / plates washed per hour
```

A first pass of the day at neutral composure measures these loads; the day then runs with them. They are read before any composure effect, so there is no feedback loop.

```
excess     = clamp(load - 0.8, 0, 0.6)
if CMP < 50: pressure = 1 - 0.50 x excess x (50 - CMP) / 50     (worst 0.70)
if CMP >= 50: pressure = 1 + 0.25 x excess x (CMP - 50) / 50    (best 1.15)
pressure_s = pressure                     applied to that person's speed
pressure_q = 1 + min(0, pressure - 1) / 2  applied to that person's quality contribution
```

Example at load 1.2 (a packed Friday dinner): CMP 20 gives speed x0.88 and quality x0.94; CMP 50 x1.00; CMP 90 speed x1.08, quality unchanged. Calm keeps standards up but does not raise them. At load 0.8 or below composure has no effect.

**Why this matters for strategy:** a volume kitchen runs flat out, so calm cooks earn money there; a luxury kitchen has room to breathe, so composure is cheap there and Quality is what counts. Staff builds reinforce the three strategies of prd.md 6.2 instead of adding a fourth.

### 2.4 Talents and personality

The eight traits of prd.md 5.8 split into two kinds:

* **Talent** (0 or 1 per person): a fixed performance perk. Speedy, Perfectionist, Charmer, Night Owl, Frugal, Crowd Pleaser (unchanged), plus two new: **Eager Learner** (training and coaching gains x1.25) and **Big Game Player** (+15 CMP on Friday and Saturday dinner).
* **Personality** (exactly 1 per person, gold and elite cards may have 2): what makes this person happy or unhappy. It is the heart of section 5. Steady becomes a personality. Mentor is retired: its job is done by the Mentoring attribute (migration in section 10).

## 3. Training and development

Three ways to raise an attribute, from cheap and slow to expensive and fast.

### 3.1 Natural growth (on the job)

Every 4 shifts worked a person gains **1 attribute point**, given to the attribute with the highest role weight that is still below POT (ties by lowest value). That is 10 points per 40 shifts, the same pace as today's +1 skill per 40 shifts. Team growth bonus: `x (1 + (best MEN in the same area - 50) / 100)`, so a MEN 80 head chef makes the whole kitchen grow 30% faster. Areas: Kitchen (chef, cook), Floor (server, host), Back (dishwasher). This replaces the Mentor trait.

### 3.2 Coaching (in house, free, slow)

Pair a **coach** (MEN 50 or more, same area, not the same person) with a **trainee** and pick one attribute. While paired:

* trainee gains `(coach MEN - 30) / 20` points per week in that attribute (MEN 70 gives +2 per week, MEN 90 gives +3);
* the coach works at speed x0.90 (they are teaching during service);
* one trainee per coach; the pairing lasts until the player ends it or the attribute reaches POT.

### 3.3 Courses (external, paid, fast)

The trainee is off the rota for the course days (salary still paid). One course per person per 14 days.

| id | Course | Raises | Roles | Price | Days off | Base gain | Unlock |
|---|---|---|---|---|---|---|---|
| doughSkills | Dough and Knife Skills | QUA | chef, cook | $300 | 1 | +10 | Start |
| lineDrills | Line Speed Drills | SPD | chef, cook, dishwasher | $250 | 1 | +10 | Start |
| tableService | Table Service Course | QUA | server, host | $250 | 1 | +10 | Start |
| floorFlow | Floor Flow Workshop | SPD | server, host | $220 | 1 | +10 | Start |
| rushBootcamp | Rush Hour Bootcamp (evening workshop) | CMP | all | $260 | 0 | +12 | Day 8 |
| trainTrainer | Train the Trainer | MEN | all | $350 | 1 | +12 | Serve 500 |
| sommelier | Sommelier Basics | QUA | server | $600 | 2 | +12, and +3% wine sales per sommelier trained (cap +6%) | Rep 45 |
| napoliMaster | Napoli Masterclass | QUA | chef, cook | $550 | 2 | +16 | Rep 55 |
| leadership | Leadership for Managers | MEN and CMP | manager | $900 | 2 | +10 each | Rank Owner |

```
gain = round(base_gain x headroom x learn x mood)
headroom = clamp((POT - OVR) / 20, 0.25, 1)
learn    = 1.25 Eager Learner, 1.0 otherwise
mood     = 0.7 if morale below 40, else 1.0
attributes never exceed 99
```

Examples: a cook OVR 50, POT 70, Dough and Knife Skills: +10 QUA. The same cook at OVR 66: headroom 0.25, +3 (2.5 rounded half up). An Eager Learner at OVR 50: +13 (12.5 rounded half up).

**Tuning note (build):** the first draft (+6 for $450 and 2 days off) paid back in 15 to 270 weeks in the balance run, because one person's six points move a whole kitchen very little and a cook away costs covers. Gains and prices above are the retuned values; `npm run balance` prints the payback table (3.8 to 10 weeks today).

**The training preview** (before paying) shows: gain per attribute, new OVR, the days off on a mini calendar with the rota impact ("Dinner prep will be the limit on Tue and Wed: about -$90"), the salary the person will expect at the next review, and an estimated payback in weeks from the existing `compare()` impact model.

### 3.4 Train versus retain

Training raises OVR, and OVR raises **market value** (section 4.4). Every 8 weeks, and after any course that lifts OVR by 3 or more, a person has a **contract review**: they ask for their market value. Accept, and the salary rises; decline, and the pay fairness mood driver (section 5.1) turns negative. A trained, underpaid person is exactly who a rival tries to hire (section 6.2). That is the core tension: training is cheap, keeping what you trained is not free.

### 3.5 Promotion

Unchanged verbs from prd.md 5.8 with a rule: promote cook to chef at OVR 60 or more; chef or server to restaurant manager at MEN 55 or more. On promotion OVR is recomputed with the new role's weights, so a fast but careless cook may look worse as a chef. The preview shows it.

## 4. The staff market

The weekly board of 6 becomes a **city wide market**.

### 4.1 Pool and refresh

* **24 candidates** at any time. Each week 8 new ones arrive and the oldest leave; a candidate stays 21 days unless hired. At least one per hireable role, always (existing rule kept).
* **Tier mix** depends on the best reputation among the player's restaurants:

| Best Rep | Bronze | Silver | Gold | Elite |
|---|---|---|---|---|
| below 40 | 55% | 40% | 5% | 0% |
| 40 to 59 | 35% | 45% | 18% | 2% |
| 60 and up | 20% | 45% | 28% | 7% |

* **Interest:** gold candidates join only a restaurant with Rep 45 or more, elite with Rep 60 or more. Below that the card reads "Not interested yet: wants a 3 star restaurant". They stay visible as a goal.
* **Apprentices corner:** 2 apprentices a week from the culinary school: OVR 25 to 40, POT 60 to 88, salary 60% of the role base, no severance. The long term project hire.
* **Recruitment agency:** pay $250 for 3 candidates of a chosen role with a chosen key attribute of 60 or more (70 or more for $500), delivered in 2 days. For replacing someone quickly.

### 4.2 Scouting

A candidate card first shows **attribute ranges** (true value plus or minus 8 for bronze and silver, plus or minus 5 for gold and elite), OVR as a range, the talent, and the personality as "?". **Interview** reveals the exact attributes and the personality: 3 free interviews a week, then $40 each. This keeps the existing interview verb meaningful.

### 4.3 Getting to know someone

After 4 weeks on the team the POT range becomes exact. Hires are a small gamble on the ceiling, never on the numbers you pay for.

### 4.4 Market value and asking salary

```
market value = role_base x (1 + 0.012 x (OVR - 50)) x (1 + 0.25 x fame)
               x (1 + min(0.10, 0.005 x max(0, POT - OVR)))     young talent premium
               x 1.10 if Money Minded
asking salary on the market = market value
```

Offer at asking and the hire is certain. Offer 10% below and the chance is 60% (Money Minded 20%); a refusal takes the candidate off the market. No other negotiation.

### 4.5 Compare to the current team

Every market card shows a **compare line** against the weakest current team member in that role: "+14 OVR over Marco, about +$62 per day, +$85 per week in wages". It reuses the staff impact card (F-63) and the `compare()` preview.

## 5. Mood: personality x restaurant performance

Morale no longer drifts to a fixed 70. Each person has a **mood target** built from how the restaurant did today and who they are; morale moves toward it by up to 4 points a day.

```
target = clamp(65 + sum(universal drivers) + sum(personality drivers), 5, 95)
morale += sign(target - morale) x min(4, |target - morale|)
```

### 5.1 Universal drivers (everyone)

| Driver | Reads | Effect on target |
|---|---|---|
| Pay fairness | salary / market value | `(ratio - 1) x 50`, clamp -15 to +10 |
| Workload | understaffed (load_mult below 1), shifts above 5 a week | understaffed -6; -4 per extra shift |
| Pressure | today's highest rho | `-20 x max(0, rho - 0.9) x (1 - CMP/100)`, cap -10 |
| Development | course, coaching or 3+ natural points in the last 28 days | +4 |
| Team | a teammate left or was let go in the last 7 days | -3 |

### 5.2 Personalities and what they react to

Each personality reads one or two **restaurant performance signals**: business (rho), speed (average ticket time against the table's target), quality (the food score from satisfaction), reputation, pay or growth.

| Personality | Reads | Happy when | Unhappy when | Spawn weight |
|---|---|---|---|---|
| **Thrill Seeker** | business | rho 0.9 or more: +8 | rho below 0.5: -8 | 12 |
| **Calm Soul** | business | rho 0.5 to 0.85: +6 | the pressure driver counts double | 12 |
| **Craftsperson** | quality | food score 0.75 or more: +8 | food score 0.5 or less: -10; Basic tier in more than half the menu: -4 | 12 |
| **Racer** | speed | ticket time at or under target: +6 | ticket time 5+ min over target: -8 | 12 |
| **Glory Hunter** | reputation | Rep up over 7 days: +6 | Rep down over 7 days: -6; -2 per 1 star review today | 10 |
| **Money Minded** | pay | pay fairness counts double | pay fairness counts double; a raise gives +20 instead of +10 | 10 |
| **Ambitious** | growth | development driver +8 instead of +4 | no development in 28 days: -6; OVR 75+ and not promoted in 8 weeks: -6 | 10 |
| **Team Player** | team | team average morale 70 or more: +6 | a teammate let go: -8 instead of -3 | 8 |
| **Steady** | none | morale never below 50 (existing rule) | | 6 |
| **Loyal** | none | every negative driver x0.5; never poached | | 4 |
| **Easy Going** | none | base 72 instead of 65; every driver x0.75 | | 4 |
| **Hothead** | all | every driver x1.5 | at morale below 40, teammates in the same area -3 | 4 |

Worked example, a Thrill Seeker cook (CMP 50, paid at market) on a packed Friday (rho 1.0): 65 + 0 pay + 0 workload - 1 pressure + 8 business = **target 72**. The same cook on three quiet Tuesday lunches (rho 0.4): 65 - 8 = **57**, and after a week of that the day report says "Luca is bored: the room has been quiet (Thrill Seeker)".

### 5.3 What morale does

* **Speed:** existing `morale_mult = 0.85 + 0.30 x morale / 100` (0.85 to 1.15).
* **Quality:** new `morale_q = 0.95 + 0.10 x morale / 100` (0.95 to 1.05) on the person's quality contribution.
* **Form:** 5 days at morale 80 or more puts a person **In form** (+3 on every attribute while it lasts, green arrow); 5 days below 35 puts them **Out of form** (-3, red arrow). Otherwise a flat grey arrow.
* **Notice:** unchanged: below 30 for 7 days gives 7 days notice, reversible by a raise, a course (Ambitious), or 2 days off. Nobody quits without warning.

The Squad card lists the drivers behind the target in plain words ("Heading to 58: quiet lunches -8, paid below market -5, recently trained +4"), so every mood has a readable cause and a fix.

## 6. Replacement and turnover

### 6.1 Letting go

Unchanged: 2 weeks of salary (apprentices free). Team Players on the team take the -8 hit, everyone else -3 (section 5.1).

### 6.2 Rival offers (poaching)

A person with OVR 70 or more who is paid 10% or more below market value has a 15% chance each week to get an outside offer. The player gets 7 days warning ("Trattoria Nonna wants Giulia: match $742 or she leaves on day 64") and can **Match** (salary to market value, +10 morale) or **Let her go**. Loyal people never get offers. At most one offer at a time per restaurant.

### 6.3 Replacement suggestions

When someone hands in notice, gets an offer or leaves, the market opens pre filtered on that role, sorted by compare line, with the Agency shortcut at the top.

## 7. The team in the day and week report

### 7.1 Contribution: value over a standard replacement

For each staff member the game computes the day's profit with them and with a **standard replacement** in their place (same role, all attributes 50, morale 65, no talent or personality, paid the role base salary):

```
contribution_i = profit(actual team) - profit(team with i replaced)     in $ per day
```

Both runs use the same seed and the same day options, so the difference is only that person. It already includes their salary against the base salary. A positive number is someone better than a typical hire, a negative one someone costing money. It is computed on open days only and must take 50 ms or less on an 11 inch iPad for a 15 person team (fallback: the `analyse()` level estimate the impact card uses).

Each contribution gets **one reason**, the channel that moved most between the two runs:

| Channel | Positive text | Negative text |
|---|---|---|
| Speed (covers, walk aways) | "Kept the line moving: 6 more guests served" | "Slow on the line: 4 guests walked away" |
| Quality (food or service score) | "Pizza quality +3 raised the food score" | "Service score down 5 points" |
| Pressure (composure) | "Stayed calm in the dinner rush" | "Struggled under pressure at dinner (CMP 28)" |
| Morale | "In form" | "Unhappy and slow (morale 31)" |
| Cost | "Great value for the wage" | "Paid well above what they bring" |

### 7.2 Day report: new "Team" card

Placed after "How guests felt":

* **Star of the day** (top contribution, green) and **Weak spot** (lowest, red), each with name, role, OVR, amount and reason.
* Up to two more green and two more red lines when their contribution is $10 or more either way.
* **Mood lines**, at most two a day: the biggest morale moves of 5 or more with their cause ("Sofia is proud: 4 star week (Glory Hunter) +6").
* Notices, rival offers and course completions stay in the events list as today.

### 7.3 Week report (and fast forward): new "Team this week" card

* **Player of the week** badge.
* A table of every staff member, sorted by week contribution: name, role, OVR (with change this week), morale start to end with form arrow, week contribution, main reason.
* **Needs attention:** notice given, rival offer, underpaid by 10% or more, Ambitious without development for 3+ weeks, anyone below morale 40.
* **Advisor suggestion** (one): the single staff action with the best estimated payback, for example "Rush Hour Bootcamp for Marco: about +$40 per week, pays back in 10 weeks" or "Replace Luca (-$22 per day): 3 silver servers on the market".
* For managed restaurants: the manager's line (section 8.3) inside the existing "Your other restaurants" card.

## 8. The manager manages the staff

### 8.1 Policies (set per managed restaurant on its Squad screen)

| Policy | Options | Default |
|---|---|---|
| Training budget | $0, $250, $500, $1,000 per week | $250 |
| Pay | Tight (90% of market), Fair (100%), Generous (110%) | Fair |
| Hiring focus | Match the strategy (luxury: QUA; volume: SPD and CMP; middle: OVR), Best value, Grow apprentices | Match the strategy |
| Replace underperformers | Off, On (let go anyone at -$15 per day or worse for 14 days) | Off |

### 8.2 How well the manager does it

People skill `P = (MEN + CMP) / 2` of the manager.

* **Choices:** for each hire, course or coaching pair the manager looks at the 3 best options and picks the truly best with `p = 0.40 + 0.005 x P` (P 50: 0.65; P 90: 0.85), otherwise a random one of the other two. This matches prd.md 5.9 hiring accuracy.
* **Coaching:** the manager coaches everyone at half rate: `(MEN - 30) / 40` points per week, spread over the lowest attribute below POT of each person.
* **Calm:** the manager's CMP above 50 softens the team's pressure driver: `x (1 - (CMP - 50) / 100)`.
* **Rival offers:** a manager matches automatically when the person's contribution is positive and the budget allows.
* **Raises:** at contract reviews the manager pays per the Pay policy.

Staff at managed restaurants now grow and change morale, which removes the limitation noted in `balance.md` 4.5.

### 8.3 Weekly manager report line

"Nora (Manager, OVR 72): trained 2, hired 1, let go 0, raises $64; team morale 68 (+3); spent $410 of $500." Tap for the manager's single proposal of the week (existing prd.md 5.9 idea) and an Override on any card.

## 9. UI: the Squad

**Squad tab** (replaces the Staff panel). A lineup board by area, each person a card:

* Card: OVR large top left, role below it, name, card tier colour (bronze, silver, gold, elite), fame star, four attribute bars labelled QUA SPD CMP MEN with numbers, morale face and form arrow, a small book icon while in training, a whistle icon while coaching.
* Areas as rows: **Kitchen**, **Floor**, **Back**, **Office**. Empty slots show "Hire" and open the market pre filtered.
* **Team ratings strip** at the top, like a football team's attack, midfield and defence: Kitchen Quality, Kitchen Speed, Floor Quality, Floor Speed, Composure, Team Morale, each 1 to 99 (weighted averages of the people on the rota). One of them glows amber when it is today's bottleneck (reads the existing pipeline bottleneck).

**Player card** (tap a card; side sheet on iPad, bottom sheet on phone):

* Diamond chart of the four attributes, POT range, talent and personality chips with plain effects.
* **Mood:** current morale, target, and the driver list in plain words (section 5).
* **Contract:** salary, market value, next review day, rival offer if any.
* **Form:** last 14 days of contribution as a sparkline.
* Actions: Train, Coach, Raise, Promote, Let go (or Override when the manager is in charge). Each shows its cost and preview before confirming.

**Market** (from the Squad tab): role filter chips, sort by OVR, compare line, price or POT, tier filter, shortlist star, Interview button with the weekly free count, Apprentices corner, Agency button.

**Training** sheet: course list for the selected person with gain preview, days off calendar, rota impact and payback; the coaching pair picker lists eligible coaches with their weekly gain.

Accessibility: colours always come with numbers or words; nothing needs hover; every card and bar has a text label for screen readers.

Moments of delight: a card flips and its tier colour changes when OVR crosses a tier ("Giulia is now Gold!"), a small whistle sound when coaching starts, confetti on Player of the week.

## 10. Save migration

`Staff` gains `attrs: { quality, speed, composure, mentoring }`, `personality: PersonalityId[]`, `talent: TalentId | null`, `potential` on the 30 to 95 scale, `trainingUntil: number | null`, `lastDevelopedDay`, `coachOf: number | null`, `nextReviewDay`, `offer: { salary, leavesOnDay } | null`. `skill` becomes derived.

Old saves:

* QUA and SPD = 10 x skill. CMP = 50 and MEN = 50 (so pressure and coaching are neutral). Managers: all four = 10 x skill, so manager OVR/10 = old skill and `managerEffect` is unchanged.
* Mentor trait becomes MEN 70 and the trait is removed; Steady becomes the Steady personality; other traits become the talent (a second talent is dropped, the first kept).
* Everyone without a personality gets **Easy Going**, so morale of an existing team does not suddenly swing.
* potential = 10 x old potential. Salaries are kept as stored.
* The market is generated fresh on load.

## 11. Balance and dominant strategy checks

* **Reference builds unchanged:** the three builds of `balance.md` 3.1 load with migrated staff (CMP 50, Easy Going) and give identical numbers (AC-222).
* **New check, strategy fit:** the volume build with its cooks at CMP 80 must gain more profit per day than the luxury build with the same change; cooks going from QUA 50 to 70 must lift luxury satisfaction more than volume satisfaction (AC-223). Same day profit is the wrong yardstick for Quality in luxury: that room is already full at fixed prices, so better food pays through satisfaction, reputation and prices.
* **Training payback band:** each course, taken by the role it targets in its reference build, pays back in 3 to 10 weeks including the rota cost of days off. Outside the band, retune the price within plus or minus 40%.
* **Everyone at 99?** No: POT caps growth (headroom 0.25 past POT), salaries follow OVR, and course cooldown is 14 days. An all elite team costs more than it earns below Rep 60.
* **Always hire Loyal and Easy Going?** They are rare (weight 4 of 104 each) and only visible after an interview; Easy Going also dampens positive drivers.
* **Morale tedium risk:** mood reads daily aggregates only, and the day report shows at most two mood lines. A healthy team of mixed personalities in a fitting restaurant should sit at 60 to 75 without any action (AC-220).
* **Manager too good?** A P 90 manager with a $1,000 budget must not beat an attentive player: over 8 weeks the managed team's average OVR growth is at most 90% of a player who spends the same budget optimally (AC-224).

| Tunable | Unit | Start | Safe range |
|---|---|---|---|
| `T.staff.pressureOnset` | rho | 0.8 | 0.7 to 0.9 |
| `T.staff.pressurePenalty` / `pressureBonus` | factor | 0.50 / 0.25 | 0.3 to 0.7 / 0.1 to 0.4 |
| `T.staff.shiftsPerPoint` | shifts | 4 | 3 to 6 |
| `T.training.cooldownDays` | days | 14 | 7 to 28 |
| `T.training.coachDivisor` | points | 20 | 15 to 30 |
| `T.mood.base` / `T.mood.maxStep` | points | 65 / 4 | 60 to 70 / 3 to 6 |
| `T.mood.payWeight` | points per ratio | 50 | 30 to 80 |
| `T.market.pool` / `T.market.newPerWeek` | people | 24 / 8 | 12 to 36 / 4 to 12 |
| `T.market.freeInterviews` | per week | 3 | 1 to 5 |
| `T.market.poachChance` | per week | 0.15 | 0.05 to 0.25 |
| `T.market.reviewWeeks` | weeks | 8 | 4 to 12 |

Course prices, gains and personality driver sizes live in data files (`src/data/training.ts`, `src/data/personalities.ts`) and may move within plus or minus 40% without a spec change.

## 12. Out of scope for M0.4

* Manual shift schedules (F-67 stays at v1.0).
* Team chemistry between specific pairs of people, friendships and relationships.
* Staff ageing, retirement, contracts with fixed lengths, agents.
* Poaching staff from rival restaurants yourself.
* Area manager (F-70, v2.0).
* A staff room and other morale furniture (F-50 stays at v1.0; it will add a universal driver).

## 13. Scope, slices and cut order

About 7 to 8 engineering days. Delivered in five slices, each playable on its own:

| Slice | Contents | Features | Estimate |
|---|---|---|---|
| A. Player card | Four attributes, OVR, tiers, POT, sim wiring, composure, migration, Squad tab | F-124 to F-127 | 2 days |
| B. Market | Pool, tiers, scouting, apprentices, agency, compare line | F-128, F-129 | 1.5 days |
| C. Development | Natural growth, coaching, courses, reviews, promotion rule | F-130 to F-132 | 1.5 days |
| D. Mood and report | Mood target, personalities, form, rival offers, day and week Team cards | F-133 to F-137 | 2 days |
| E. Manager runs the team | Policies, manager choices, managed staff grow, report line | F-138, F-139 | 1 day |
| Balance | Checks and payback table | F-140 | with each slice |

**Cut order if it runs long:** team ratings strip, agency, sommelier wine bonus, form (In form, Out of form), rival offers (keep notice), "Let my manager handle the team" at the player's own restaurant. **Never cut:** the four attributes, composure under pressure, personality drivers with readable causes, and the contribution lines in the reports. Those are the founder's request.

## 14. M0.4 definition of done

AC-194 to AC-225 pass; `npm run balance` prints the course payback table and the strategy fit check passes; the founder can open the Squad tab on an iPad, see a silver cook struggle in a Friday rush in the day report ("Struggled under pressure at dinner"), send them to Rush Hour Bootcamp, see their CMP rise and the next Friday's report show them as Star of the day; then open a second restaurant, set its manager to a $500 training budget and read the manager's line in the week report.
