# Versions and milestones: Pizza D

Feature IDs refer to `features.md`; acceptance criteria to `acceptance-criteria.md`; numbers to `balance.md`. Durations are planning assumptions for a team of about 6 to 10 people (prd.md A12) and are for the delivery lead to confirm.

## Delivered so far (M0.1 to M0.6)

Pizza D is free and plays in the browser (founder decision); the App Store, TestFlight and paid launch items in the plan below are superseded, and cloud saves shipped in M0. The long term milestones (v0.1 onward) still describe the direction of travel.

| Milestone | Scope | Spec | Done when |
|---|---|---|---|
| **M0** Systems prototype | Economy, day model, menu and tiers, dining room, finance, cloud saves | `prd.md`, `balance.md` | Strategy balance suite green (AC-01 to AC-12, AC-72) |
| **M0.1** Menu depth | Primi and secondi, menu complexity, the bar and wine list, room touches | `balance.md` 4.2 to 4.10 | Balance log entries hold in `tests/balance` |
| **M0.2** Kitchen Builder and Fresh Start | Kitchen floor plan and flow, pipeline, empty premises start, restaurant market | `kitchen-builder.md`, `fresh-start.md` | Their ACs pass |
| **M0.3** Kitchen upgrades and the city map | Add-ons and upgrade paths; Porto Verde with rentable venues and moving; fire safety | `kitchen-upgrades.md`, `city-map.md` | Their ACs pass |
| **M0.4** The Squad and kitchen bottlenecks | Four attributes, training, market, mood, team reports; stations, tending, wash points, dough, capacity view | `staff-management.md`, `kitchen-bottlenecks.md` | AC-194 to AC-225, AC-276 to AC-285 |
| **M0.5** Competition, marketing and delivery | Live rivals, 72 venues, campaigns, Rivals tab and coach, food delivery | `competition.md` | AC-226 to AC-287; open balance items in its section 15 |
| **M0.6** Business review and cleanup | Weekly KPIs and the business review; save v7, speed, docs and tests from `cleanup-sprints.md` | `business-review.md`, `cleanup-sprints.md` | AC-288 to AC-292; the five cleanup sprints done |

## Overview

| Milestone | Goal in one line | Question it answers | Indicative length |
|---|---|---|---|
| **M0** Systems prototype | Prove the maths and the core service on screen | Does the economy produce two viable strategies and a legible, performant service? | 8 to 10 weeks |
| **v0.1** Vertical slice | One pizzeria, fully playable and lovely | Is running one pizzeria fun, relaxing and legible for 3+ hours, and do players find both strategies? | 5 to 6 months after M0 |
| **v1.0** Launch | From craft to chain | Does the game sustain 20+ hours through the shift from hands-on to delegation? | 9 to 10 months after v0.1 |
| **v2.0** Growth | More places, more stories | Can we extend lifetime and reach new players without breaking the cosy core? | 6+ months after launch |

---

## M0: Paper and systems prototype

**Goal.** De-risk the simulation before art and UI: a data driven economy, a greybox guest simulation, and automated balance tests.

**Features**
* F-01 Data-driven tuning (reference calculator and data files)
* F-53 Demand model
* F-52 Guest agent simulation (greybox: coloured capsules, grid, no final art)
* F-39 Kitchen throughput model (no panel polish)
* F-40 Equipment and skill interaction (rules only)
* F-19 Ingredient tiers (data only)
* F-81 Strategy balance test suite
* Performance spike on the oldest candidate iPad (answers Q6)
* Paper prototype of the recipe designer and build mode for UX testing (5 players)

**Question it answers.** Do the formulas produce: a starter restaurant that earns a modest profit; luxury and volume builds that reach comparable profit in their home districts; a middle ground that is viable but never dominant; and a 120 seat service that runs at target frame rate?

**Definition of done**
* All M0 acceptance criteria pass (AC-01 to AC-12 and AC-72).
* The greybox simulation reproduces the balance.md reference builds within 10% on covers and revenue per day.
* The performance spike shows 60 fps at 1x with 120 seated guests on the candidate minimum iPad, or a documented alternative minimum.
* Paper prototype: at least 4 of 5 testers build a pizza and set a price without help.
* Go / no-go review with founder, game design lead and solution architect.

---

## v0.1: Vertical slice (single restaurant)

**Goal.** A polished, representative slice of the final game with one location: every craft system present at small content scale, final art style, audio and tutorial. Used for internal and closed playtests (external TestFlight is Q12).

**Features**
* Core: F-02, F-03, F-04, F-05, F-06, F-09, F-10 (text sizes only), F-11
* City: F-13 (3 districts: University Quarter, Canal Quarter, Old Harbour), F-14
* Ingredients and menu: F-19 (25 ingredients, 4 tiers), F-20, F-21, F-22, F-23, F-24, F-25
* Purchasing: F-29 (Fratelli, Metro, Green Valley), F-30, F-31, F-32, F-33
* Equipment: F-38 (11 items: Deck, Double Deck, Conveyor, Stone Hearth, Wood Fired ovens; Prep Counter, Dough Sheeter, Heat Lamp Pass, Dish Machine, Proving Cabinet, Marble Bench), F-39, F-40, F-41, F-42
* Build: F-44, F-45 (40 items), F-46, F-47
* Service: F-52, F-53, F-54, F-55, F-56, F-57, F-58
* Staff: F-62 (chef, cook, server, host, dishwasher), F-63, F-64, F-65 (8 traits)
* Reputation and finance: F-71, F-75, F-76, F-77, F-78
* Progression: F-90 (ranks Cook, Owner, Restaurateur), F-91
* Presentation: F-95, F-97, F-98
* Strategy tests: F-81 maintained

**Content scale:** 1 city, 3 districts, 1 location at a time, about 3 to 5 hours of content to rank Restaurateur.

**Question it answers.** Is the single restaurant loop (menu with tiers, purchasing, equipment saving, layout, service, staff) fun, relaxing and understandable, and do players discover that both an upmarket and a high volume restaurant can work?

**Definition of done**
* All acceptance criteria mapped to M0 and v0.1 pass.
* Playtest with at least 30 target players (mix of the four personas):
  * M1 tutorial completion 85% or more.
  * M6 relaxation 4.2 or more; M7 depth 4.0 or more; M8 legibility 80% on 3 of 4 probes.
  * At least 25% of players who play 3+ hours move clearly toward luxury and at least 25% toward volume (by price and tier choices).
* Performance: M13 met on the minimum iPad with a full 120 seat room.
* Crash free sessions 99.5% or more across the playtest.
* No blocker or critical bugs open; save and resume verified across 50 interrupted sessions.

---

## v1.0: Launch (the chain)

**Goal.** The full first release: from one pizzeria to a chain of up to 6 locations with managers, seasons and full content, localised and accessible.

**Features (in addition to v0.1)**
* Core: F-07, F-08 (Nice), F-10 full, F-12
* City: F-13 (6 districts), F-15, F-16, F-17, F-18
* Ingredients and menu: F-19 (60 ingredients), F-26, F-27
* Purchasing: F-29 (12 suppliers), F-34, F-35, F-36
* Equipment: F-38 (adds Master Dome Oven, Hand Stretch Station, Walk-in Cold Room), F-43 (hybrid)
* Build: F-45 (about 150 items), F-48, F-49, F-50
* Service: F-59
* Staff: F-65 (25 traits), F-66, F-67, F-68, F-69
* Reputation: F-72, F-73, F-74
* Finance: F-79, F-80
* Strategy: F-82
* Chain: F-83, F-84, F-85, F-86, F-87
* Progression: F-90 (all ranks), F-92
* Presentation: F-96

**Question it answers.** Does the game hold players for 20+ hours, with delegation feeling like a reward, and do both strategies stay viable across a chain?

**Definition of done**
* All acceptance criteria mapped to M0, v0.1 and v1.0 pass.
* Beta playtest (at least 30 players, at least 10 hours each):
  * M4: 50% of tutorial finishers open a second location within 8 hours.
  * M5: among players with 3+ locations, neither luxury nor volume is the most profitable location for fewer than 30% of players.
  * M6 to M8 targets still met.
* Performance M13 with 6 locations (5 simulated off screen) on the minimum iPad; crash free sessions 99.7%.
* All 6 languages complete and reviewed; accessibility checklist passed.
* App Store assets, age rating and privacy labels approved.
* Cut list decisions (prd.md 10.4) recorded; nothing on the "never cut" list missing.

---

## v2.0: Growth

**Goal.** Extend lifetime and appeal after launch with new places, stories and modes, informed by launch data.

**Features**
* F-88 Second city (new districts, suppliers, seasonal ingredients)
* F-70 Area manager
* F-93 Friendly rival and Pizza Festival (Nice; see prd.md 5.13)
* F-89 Franchising (Nice)
* F-37 Central commissary (Nice)
* F-60 Reservations and events (Nice), F-61 Takeaway counter (Nice)
* F-51 Seasonal terrace (Nice), F-94 Scenarios (Nice), F-99 Photo mode (Nice), F-28 Hand drawn sign (Nice)
* Candidates pending Q5: Mac and iPhone versions (cloud save sync shipped in M0)

**Question it answers.** Which additions measurably raise long term play (sessions after day 30) and review scores without adding stress?

**Definition of done**
* All acceptance criteria mapped to v2.0 pass, and all earlier criteria still pass (regression).
* Strategy balance suite extended to the second city and still green.
* Players with the update show higher day 30 return than the v1.0 cohort (target +5 points, opt-in telemetry).
* App Store rating stays 4.6 or more.
