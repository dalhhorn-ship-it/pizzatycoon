# Pizza D cleanup sprints

Review of main at `1f567b0` (after M0.5) by three reviewers: architecture and tech debt, QA, and tycoon game design with documentation. This page merges their findings into one backlog and a suggested scope for five cleanup sprints. Effort: **S** under a day, **M** 1 to 3 days, **L** a week or more.

## Where we stand

| Area | Verdict | Headline |
|---|---|---|
| Architecture | Sound core, growing debt | A pure, seeded simulation and a reducer that returns errors are worth keeping. Saves grow without limit, a day costs about 18 ms, and a merged view in `chain.ts` can drift silently. |
| QA | Conditional | 217 tests pass. Determinism and save round trips pass in probes, but no committed test guards them. 60 of 287 acceptance criteria (ACs) are cited in tests. There are no UI tests. |
| Design and docs | Docs two generations behind | `prd.md`, `balance.md`, `versions.md` and the README contradict the code. The core loop is unclear with 6 tabs and 5 advice voices. Delivery rewards bad play. |

Measured by the reviewers:
* `runDay` takes about 18 ms in Node, against a target of under 5 ms on an A13 iPad.
* A save is 503 KB, 83% of which is day history.
* A week with rivals takes 1.57 times as long as without; the budget (AC-272) is 1.3 times.
* The test suite takes 27 s, of which 26 s is the market balance file.

## Confirmed bugs (fix first)

| Id | Bug | Where | Effort |
|---|---|---|---|
| B1 | Saves fail silently when browser storage is full. Errors are swallowed, there is one save slot, and history grows with every restaurant you add. | `src/save/localStore.ts:27`, `src/sim/game.ts:1221`, `src/sim/chain.ts:112` | M |
| B2 | The day's market headline can skip or drop items. `news()` trims items older than 28 days on every push, then `runDay` slices from the old length. | `src/sim/rivals.ts:316`, `src/sim/game.ts:1223` | S |
| B3 | Branches can read the owner's value for any per location field left out of `LOCATION_KEYS`. The transient `ownList` has leaked into `GameState`. | `src/sim/chain.ts:77`, `src/sim/state.ts` | S (test now), L (refactor later) |
| B4 | The delivery balance test passes while its acceptance criteria fail. It measures luxury in Old Town instead of Old Harbour. Its badly run kitchen keeps two ovens. It changes the shared `BUILDS` list. It only checks broad bands. | `tests/balance/delivery.test.ts` | S |

## Backlog by source

### Architecture and tech debt

| Id | Item | Fix | Effort | Priority |
|---|---|---|---|---|
| TD1 | Save size and loss (see B1) | Keep full reports for 7 days and summaries after that. Surface write errors to the player. Move saves to IndexedDB with a previous slot (ADR-005). Schema v7. | M | P1 |
| TD2 | About 18 ms per day | Stop copying the whole 500 KB state on every command (keep history out of it, or copy only what the command changes). Measure staff contributions on Sundays only. Cache `analyse`. | M | P1 |
| TD3 | News bug (see B2) | `runRivalsDay` returns the day's news and trims once at day end. Remove the dead `newsBefore` and `RivalOutcome`. | S | P1 |
| TD4 | Merged branch view (see B3) | Add a test that labels every `GameState` key as shared, per restaurant or temporary, and one helper for swapping restaurant data in and out. Later, pass an explicit `{ world, loc }` context. | S, L | P1 |
| TD5 | Import cycles: day and delivery, day and rivals | Move `queueDelay`, `valueScore`, `followingDemand` and `nextFollowing` into a new `src/sim/formulas.ts` that imports nothing from the sim. Add `import/no-cycle` to lint. | S | P2 |
| TD6 | UI previews use a one pass day, while the real day runs two passes to include staff pressure | Add a `forecast()` in the sim built on `dayRun`. Compute the preview baseline once per Marketing sheet. | S | P2 |
| TD7 | `game.ts` is 1,239 lines with 64 commands in one switch | One handler map per domain behind the same `apply`. Move settlement into `settle.ts`. | M | P2 |
| TD8 | `settleDelivery` is a closure inside `day.ts` that changes outer variables | A pure `settleDelivery(inputs)` in `delivery.ts`. | M | P2 |
| TD9 | New save fields are optional (31 fallbacks) and the schema is still v6 | v7 migration that fills defaults explicitly (shared with TD1). One test save file per schema version. | M | P1 |
| TD10 | Google Fonts breaks the "no third party" privacy target | Host the font ourselves and tighten the content security policy. | S | P2 (P1 if the audience includes children) |
| TD11 | Four copies of `act()`, plus copies of `sm` and `pct` | Move them into `dom.ts`. | S | P3 |
| TD12 | `as never` casts | Type the campaign unlock as `Unlock \| 'delivery'`. | S | P3 |
| TD13 | Hard coded 56, 28 and 28 day windows | Move them to `tunables.ts`. | S | P3 |
| TD14 | Large UI files (`app.ts` 856 lines, `panels.ts` 660, `squad.ts` 551) | Split into one module per tab when each is next touched. | M | P3 |
| TD15 | Service worker: fixed cache name, updates straight away without asking | Put the build hash in the cache name and offer the update at day end. | S | P2 |

### QA

| Id | Item | Effort | Priority |
|---|---|---|---|
| QA1 | Keep real schema 5 and pre M0.5 schema 6 saves as test files (one with branches). Load, run 7 days, and assert rivals are off and numbers unchanged (AC-227). | M | P1 |
| QA2 | Save and reload mid game with rivals, delivery, campaigns and a branch, then check the next N days match | S | P1 |
| QA3 | Determinism with rivals on, and after switching rivals off and on again | S | P1 |
| QA4 | Decide the schema policy (goes with TD9) | S | P1 |
| QA5 | Performance benchmark for AC-272: 3 restaurants and 30 rivals, fail above 1.3 times in the balance lane | M | P1 |
| QA6 | Coach tests: 8 scripted situations (AC-259), shares add up to 100% (AC-254), rival card ranges (AC-255) | M | P2 |
| QA7 | Branches with delivery and campaigns: renewal, switching restaurants, a managed restaurant's delivery P&L | M | P2 |
| QA8 | Tests against the PRD's worked numbers: AC-228 to 234, 248, 249, 264 to 268 (35.4 orders, delivery rating 50.45, $704 in sales) | M | P2 |
| QA9 | Rival AI statistics: AC-235, 236, 239, 241 at the seed counts the spec gives | L | P2 |
| QA10 | Untested commands: `holdVenue`, `stopCampaign`, `stopDelivery`, `sellVehicle`; venue data AC-242 and AC-243 | S | P2 |
| QA11 | Stop changing `BUILDS` in tests, and pick free venues at run time (hard coded venue ids clash with seeded rivals) | S | P3 |
| QA12 | Add `@vitest/coverage-v8` with a branch coverage floor for `src/sim` | S | P3 |
| QA13 | Separate unit and balance lanes: units under 8 s, balance nightly with AC-273 at 20 seeds | S | P2 |
| QA14 | Playwright smoke suite on an iPad screen size that fails on any console error. Eight flows: new game map, venue hold, Rivals tab with mystery diner, Marketing sheet and coach "Do it", delivery panel, day and week reports, save and reload (including an old save code), second restaurant and switch back. | M | P2 |

### Documentation

| Id | Item | Effort | Priority |
|---|---|---|---|
| D1 | Add `01-product/README.md`: every document with its milestone, status and what it is the authority for. Refresh the root README (it still says M0 and 24 venues). | S | P1 |
| D2 | `versions.md`: add milestones M0.2 to M0.5 with goals and done criteria. Remove the App Store and TestFlight tasks and the "cloud sync pending" note. | S | P1 |
| D3 | `features.md`: add a Status column (Built, Partial, Open). Relabel kitchen bottlenecks as M0.6. Mark the delivery pipeline bar as Open. | S | P1 |
| D4 | Renumber the city map features and ACs, which reuse F-118 to F-126 and AC-175 to AC-192 | S | P1 |
| D5 | Fix stale ACs: 04, 10, 11, 12, 26, 27, 28. Mark AC-273 (the live part of competition) and AC-274 and AC-286 as Open with measured values. | S | P1 |
| D6 | `competition.md`: bring sections 2.3, 11.1 and 5.7 up to the built values. Settle "target the leader": founder decision 6, section 15.1 and the code describe it three different ways. | S | P1 |
| D7 | `prd.md`: mark superseded sections, or fix start cash, loan, deposit, menu limits, rep formula and review formula. Remove non goals that have since shipped (delivery, bar, cuisine) and the App Store plans. | M | P2 |
| D8 | `balance.md` section 1: update in place from the section 4 log. Rerun tables 3.2 to 3.5 once. | M | P2 |
| D9 | Give the systems that only exist in the balance log real feature and AC rows: primi and secondi, menu complexity, bar and wine, room touches, fire safety, following, fast forward, cloud sync | M | P2 |
| D10 | `02-architecture`: fix the eight stale statements (folder names, command and event lists, data model, save checksum and slots, network claims, service worker prompt, `formulas.ts`). Add a section on rivals, marketing, delivery and managed restaurants. | M | P2 |
| D11 | Rewrite PRD sections 4 to 7 once as the current truth and keep the addenda as history | L | P3 |

### Design and balance

| Id | Item | Effort | Priority |
|---|---|---|---|
| G1 | Delivery rewards bad play. Refuse penalty 0.5 to 0.2, cancel penalty 1 to 2, a new late refund of 50% on orders with time score 0, then rerun AC-286 with the one oven bad setup. | M | P1 |
| G2 | Delivery kitchen reaches only about 25% of the target. Order rate 0.004 to 0.005. Top rated threshold 85 to 80, and lose it below 75 instead of 80. Retarget to 40% to 50% of the middle build, with a guardrail of return on capital at most 1.5 times the middle build's. | M | P1 |
| G3 | Luxury gains 16%. First rerun in Old Harbour. If still over 10%, set foodie delivery affinity 0.5 to 0.3 and tourists 0.3 to 0.15. | S | P2 |
| G4 | Middle build gains 2%. Restate AC-274 as middle plus one deck oven. Set lunch share 0.3 to 0.4. Add the coach line "add an oven before delivery". | S | P2 |
| G5 | Rivals barely move profit (100% to 102% on Normal). Set `relMin` 0.35 to 0.5 and target 88% to 95% of the rivals off profit. | S | P2 |
| G6 | Rewrite the core loop around one question: what limits me this week, demand or capacity? Delivery then becomes selling spare capacity. | M | P2 |

### Player facing simplification

| Id | Item | Effort | Priority |
|---|---|---|---|
| P1 | One advice voice. Merge the advisor, coach, kitchen and Squad advice into "Top 3 this week", ranked by dollars at stake, each with Do it. | M | P2 |
| P2 | One capacity view. Merge the pipeline strip, Stations card and Capacity card into one Kitchen view that leads with demand against capacity. | M | P2 |
| P3 | Simplify delivery. Replace the throttle with three presets (Protect rating, Balanced, Max orders). Move the markup to Detailed view. Decide on the own delivery mode, which is almost never worth using. | S | P2 |
| P4 | Squad Simple view: OVR, mood face and one line of impact. The rest goes in Detailed view. | S | P3 |
| P5 | One reputation card: Rep, following and delivery rating, each with one sentence on what moves it | S | P3 |
| P6 | Staged reveal. The Rivals tab appears with the first rival in reach, the delivery card at Rep 50, and each new system shows one intro card with a single first action. | M | P2 |
| P7 | Mystery diner: cut it, or make it worth $60 (it only narrows ranges of about 5 points). Alternative: show exact numbers after 14 days in reach. | S | P3 |
| P8 | Guided first week (F-91, never built), once P1 to P6 have shrunk what it has to teach | L | P3 |

## Suggested sprint scope

Each sprint is sized at about 5 to 7 working days. Sprints 1 and 2 are pure engineering and change no numbers, so the balance tests guard them. Sprint 4 is the only one that deliberately changes balance.

### Sprint 1: Safety net (saves, correctness, tests that guard)

Goal: no lost saves, no silent errors, and every later refactor is protected by tests.

* B2 / TD3 news bug (S)
* B3 / TD4 key classification test and the swap helper (S)
* TD9 + QA4 schema v7 with explicit defaults (M)
* TD1 part one: surface save write errors and compact history after 7 days (M)
* QA1 old save test files, QA2 save round trip, QA3 determinism (M, S, S)
* B4 / QA11 fix the delivery balance test and stop changing `BUILDS` (S)
* QA13 separate unit and balance lanes (S)

Done when saves stay under an agreed size (for example 150 KB for one restaurant after a year), and old saves load with unchanged numbers under test. Unit tests must run in under 8 s.

### Sprint 2: Speed and structure

Goal: a day well under the iPad budget and a sim that is easier to change.

* TD2 performance: stop copying the whole state, Sunday contributions, cache `analyse` (M)
* QA5 AC-272 benchmark in the balance lane (M)
* TD5 `formulas.ts` and no-cycle lint (S)
* TD6 `forecast()` for previews (S)
* TD8 pure `settleDelivery` (M)
* TD7 split the `game.ts` reducer by domain (M)
* TD11, TD12, TD13 shared helpers, typed unlocks, windows as tunables (S each)

Done when `runDay` takes under 6 ms in Node on the middle build with Normal rivals and the rivals ratio is 1.3 times or less. There must be no import cycles, and every balance number must be unchanged.

### Sprint 3: Docs tell the truth

Goal: a new reader (or agent) can trust the documents.

* D1 product index and README (S)
* D2 versions, D3 feature status, D4 renumbering, D5 stale ACs, D6 competition numbers (S each)
* D7 PRD banners and fixes (M)
* D8 balance.md in place (M)
* D10 architecture docs (M)
* TD10 self hosted font and TD15 service worker update prompt (S each)

Done when every tunable quoted in a document matches `tunables.ts` (a small script can check the tables), and every built feature has a feature id, a status and ACs.

### Sprint 4: Balance and the tests that prove it

Goal: delivery rewards good play, rivals matter, and the numbers are pinned by tests.

* G1 delivery penalties and late refund (M)
* G2 delivery kitchen tunables and retarget (M)
* G3 luxury, G4 middle build and oven coach line, G5 rival pressure (S each)
* QA6 coach tests, QA7 branch tests, QA8 worked number tests, QA10 untested commands (M, M, M, S)
* D9 feature and AC rows for systems that only live in the balance log (M)

Done when AC-273, AC-274 and AC-286 pass as written (or are restated with founder sign off). Well run delivery must beat badly run delivery by at least 4 times the gain.

### Sprint 5: Less screen, clearer loop

Goal: the player sees one question each week and one voice answering it.

* G6 core loop rewrite in the PRD (M)
* P1 one advice voice (M)
* P2 one capacity view (M)
* P3 delivery presets (S)
* P6 staged reveal (M)
* QA14 Playwright smoke suite, so the UI changes ship guarded (M)
* Stretch: P4 Squad Simple view, P5 reputation card, P7 mystery diner decision (S each)

Done when a full week report holds at most 3 advice items, and the smoke suite passes on an iPad screen size.

### Later

QA9 rival AI statistics (L), QA12 coverage floor (S), TD14 UI file split (as touched), D11 PRD rewrite (L), P8 guided first week (L), and TD4's explicit context refactor (L).

## Decisions needed from the founder

1. **Minimum iPad:** which model is the reference device, and should we measure `runDay` on it?
2. **Audience:** is it children? If so the self hosted font (TD10) becomes P1.
3. **Own delivery mode:** keep it, rebalance it, or cut it?
4. **Mystery diner:** cut it, or give it a stronger reveal?
5. **Rival strength on Normal:** is 88% to 95% of the rivals off profit the right target?
6. **History:** can reports older than 7 days become summaries? Nothing in the game appears to need 56 days of full reports.
7. **Delivery kitchen target:** confirm 40% to 50% of the middle build instead of 60%.
