# Product documents

What each document is the authority for. When two documents disagree, the newer addendum wins for its own system, and `balance.md` wins for numbers; `src/data/tunables.ts` is what the game actually uses.

| Document | Milestone | Status | Authority for |
|---|---|---|---|
| `prd.md` | M0 onward | Base PRD; sections marked "Superseded" point to the addendum that replaced them | Vision, personas, pillars, the core loop, non goals |
| `features.md` | All | Living | Feature IDs (F-nn) and their status |
| `acceptance-criteria.md` | All | Living | Acceptance criteria (AC-nn) not kept inside an addendum |
| `versions.md` | All | Living | Milestones delivered and planned |
| `balance.md` | M0 onward | Living | Formulas, reference builds and the tuning log (section 4) |
| `fresh-start.md` | M0.2 | Built (down payment added in M0.7, section 13) | Starting from empty premises, the restaurant market, restarting, the down payment for larger restaurants |
| `kitchen-builder.md` | M0.2 | Built | Kitchen floor plan, flow and the service pipeline |
| `kitchen-upgrades.md` | M0.3 | Built | Equipment add-ons and upgrade paths |
| `city-map.md` | M0.3 | Built (venues extended to 72 in M0.5) | The city, venues, renting and moving |
| `staff-management.md` | M0.4 | Built | The Squad: attributes, training, market, mood, managers |
| `kitchen-bottlenecks.md` | M0.4 | Built | Stations, tending, wash points, dough, the capacity view |
| `competition.md` | M0.5 | Built; balance items open (section 15) | Live rivals, marketing, the coach, delivery |
| `business-review.md` | M0.6 | Built | Weekly KPIs and the business review |
| `delivery-tab.md` | M0.7 | Built; balance notes open (section 9) | Two layers of tabs, the Delivery tab (promotion, menu and deals, fleet, scorecard), zone, vehicles, delivery menu, minimum order, deal days |
| `../cleanup-sprints.md` | M0.6 | In progress | The cleanup backlog and sprint scope |

Numbering: feature IDs run F-01 to F-236 and ACs AC-01 to AC-344 across all documents, with no reuse (the city map moved to F-191 to F-199 and AC-293 to AC-310). A new addendum takes the next free numbers.
