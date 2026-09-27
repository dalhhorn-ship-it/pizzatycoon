# PRD addendum: City Map and Venues

* Status: Draft 1 for milestone **M0.3**
* Owner: Game Product Management
* Date: 2026-09-26
* Extends: `prd.md` 5.2 (districts and premises) and 5.11 (money); numbers extend `balance.md` 1.2 and 1.3
* Features: F-191 to F-199. Acceptance criteria: AC-293 to AC-310
* Code: `src/data/venues.ts`, `src/sim/location.ts`, `src/ui/city.ts`, `src/ui/city.css`

## 1. Goal and the loop it serves

Founder request: "create map of city view to select venues to rent as restaurant each which is own pros and cons, show demographic cards, foot traffic, rent, square meters per area. We should be able to rent and choose from 15+ locations. Create logical link back to the city view."

Today the player picks one of three districts and one of three premises from two lists on the welcome screen, and that choice is final. The City Map turns the choice into a place: a top down illustrated map of the city with seven neighbourhoods and twenty four rentable venues. Every venue is a real trade off (busy but pricey, cheap but quiet, big but on a back street), shown with demographic cards, foot traffic, weekly rent and floor area in square metres.

* **Loops served:** start of game (where do I open?) and the long loop (outgrow the first site, move to a better one). It adds a strategic decision that matches the three strategies: a luxury pizzeria wants foodies and tourists, a volume pizzeria wants students and lunch trade, the middle road wants a mixed crowd.
* **Design intent:** no venue is a trap. Every venue can run a profitable middle road pizzeria with sensible prices; the best venue for a strategy earns clearly more. Moving is a considered, reversible decision with a visible price, never a way to fail.

## 2. Player verbs and feedback

| Verb | Feedback |
|---|---|
| Open the city (HUD "City map" button or tap the neighbourhood name in the HUD) | Stage and side panel are replaced by the full city view; the current venue shows a "You are here" pin |
| Tap a neighbourhood | Neighbourhood card: blurb, foot traffic, spending power, competition, lunch share, demographic cards; venues in it are highlighted |
| Tap a venue pin or list row | Venue card: key figures, demographic cards, pros and cons, comparison with the current venue, cost to move |
| Sort and filter the venue list | By rent, foot traffic, floor area, or neighbourhood |
| Rent this venue | Confirm sheet listing deposit, refund, moving fee, reputation carried over, items that will not fit; then the game moves and returns to the pizzeria |
| Back to my pizzeria (button, Escape, or the breadcrumb) | Returns to the tab the player left, nothing changed |

The link is two way and always visible: the HUD shows `City map › Neighbourhood › Venue` as a breadcrumb; the city view shows "Back to <venue name>" at the top left. At the start of a new game the city view is the welcome screen: each venue card shows the deposit, what is left to fit out, and the button reads "Sign the lease here" (disabled when the deposit is more than the starting cash).

## 3. The city

The city is Porto Verde, drawn on a 100 x 70 unit map with a canal running through the middle and a harbour at the south east.

| Neighbourhood | Map area | Foot traffic/day | Spending power | Competition | Rent $/tile/week | Lunch share | Main crowd |
|---|---|---|---|---|---|---|---|
| University Quarter | north west | 6,000 | 0.80 | 0.40 | 8 | 50% | students |
| Business District | north | 4,200 | 1.25 | 0.40 | 17 | 65% | professionals |
| Linden Park | north east | 1,600 | 1.05 | 0.15 | 7 | 25% | families, seniors |
| Market Square | west | 3,000 | 1.00 | 0.50 | 12 | 45% | mixed, foodies |
| Canal Quarter | centre | 2,400 | 1.00 | 0.30 | 11 | 40% | mixed |
| Old Town | south | 3,200 | 1.15 | 0.45 | 16 | 35% | tourists, seniors |
| Old Harbour | south east | 2,600 | 1.30 | 0.25 | 19 | 30% | foodies, tourists |

The first three rows marked University, Canal and Harbour keep their `balance.md` values so the balance harness does not move.

## 4. Venues

### 4.1 What a venue is

A venue is one rentable shop front. It sits in a neighbourhood and adjusts it:

| Field | Meaning |
|---|---|
| `premisesId` | Floor plan: dining and kitchen grid (existing premises, plus two new ones below) |
| `rentPerTile` | Replaces the neighbourhood rent for this venue |
| `trafficMult` | Street position: a main square is 1.3, a back street 0.7 |
| `competitionDelta` | Rivals next door (+) or none nearby (−) |
| `lunchShareDelta` | Offices and schools nearby push lunch up |
| `wealthMult` | Spending power of this street compared with the neighbourhood |
| `tilt` | Multiplies segment shares (then renormalised to 1), for example a campus gate tilts students 1.4 |
| `pros`, `cons` | Two to three short lines each, written from the numbers above |

Effective location (the one the day model uses):

* `footTraffic = district.footTraffic x trafficMult`
* `shares = normalise(district.shares x tilt)`
* `wealth = district.wealth x wealthMult`
* `competition = clamp(district.competition + competitionDelta, 0, 0.9)`
* `lunchShare = clamp(district.lunchShare + lunchShareDelta, 0.15, 0.8)`
* `weekly rent = (dining tiles + kitchen tiles) x rentPerTile`

### 4.2 Square metres

One grid tile is **1.5 m²** (`T.city.sqmPerTile`). Floor area is shown split into dining room and kitchen, plus the total, from the real grids. A cosy corner shop is 80 dining tiles (120 m²) plus a 14 x 6 kitchen (126 m²) = 246 m². Rent keeps the balance sheet rule (dining tiles plus `kitchenTiles`).

### 4.3 Premises shapes

The hole in the wall (6 x 5 dining, 8 x 3 kitchen, 81 m²) comes from `fresh-start.md` and is the affordable way to start. Two shapes are new:

| Premises | Dining (w x h) | Kitchen (w x h) | Total m² |
|---|---|---|---|
| Corner unit (new) | 12 x 8 | 14 x 6 | 270 |
| Warehouse loft (new) | 14 x 10 | 18 x 7 | 399 |

Both keep the starter furniture and starter kitchen layouts valid (dining at least 10 x 8, kitchen at least 14 x 6).

### 4.4 The twenty four venues

| # | Venue | Neighbourhood | Premises | Rent/tile | Traffic | Notes |
|---|---|---|---|---|---|---|
| 1 | Campus Gate Slice | University | Cosy | 9 | 1.2 | Students 1.4, lunch +10% |
| 2 | Library Lane Hall | University | Big hall | 7 | 0.85 | Cheap space, back street |
| 3 | Dorm Row Corner | University | Corner | 8 | 1.0 | Two rival pizzerias (+0.15) |
| 4 | Tower Plaza Lobby | Business | Corner | 19 | 1.15 | Lunch +15%, professionals 1.3 |
| 5 | Exchange Arcade | Business | Trattoria | 15 | 0.9 | Evening crowd, wealth 1.1 |
| 6 | Parkside Pavilion | Linden Park | Big hall | 6 | 0.9 | Families 1.3, dinner heavy |
| 7 | Village High Street | Linden Park | Cosy | 8 | 1.2 | No rivals (−0.1) |
| 8 | Market Hall Stall | Market Square | Hole in the wall | 12 | 1.3 | Rivals (+0.2), very busy |
| 9 | Spice Row | Market Square | Trattoria | 13 | 1.0 | Foodies 1.5 |
| 10 | Tannery Yard | Market Square | Loft | 9 | 0.8 | Huge and cheap, quiet |
| 11 | Lock Keeper's Cottage | Canal | Cosy | 11 | 1.0 | Neutral reference venue |
| 12 | Bridge Street Trattoria | Canal | Trattoria | 11 | 1.05 | Balanced |
| 13 | Old Warehouse Loft | Canal | Loft | 10 | 0.9 | Space to grow |
| 14 | Cathedral Square | Old Town | Trattoria | 20 | 1.3 | Tourists 1.3, rivals (+0.2) |
| 15 | Cobbler's Alley | Old Town | Hole in the wall | 12 | 0.7 | Foodies 1.5, hidden gem |
| 16 | Guildhall Cellar | Old Town | Corner | 14 | 0.9 | Seniors 1.3, wealth 1.1 |
| 17 | Quayside Nook | Old Harbour | Cosy | 19 | 1.0 | Neutral harbour reference |
| 18 | Lighthouse View | Old Harbour | Trattoria | 23 | 0.85 | Foodies 1.3, wealth 1.15 |
| 19 | Fish Market Hall | Old Harbour | Big hall | 13 | 1.1 | Tourists 1.3, lunch +10% |
| 20 | Student Hatch | University | Hole in the wall | 8 | 1.1 | Students 1.2 |
| 21 | Plaza Pizza Hatch | Business | Hole in the wall | 15 | 1.0 | Lunch +15% |
| 22 | Bandstand Kiosk | Linden Park | Hole in the wall | 6 | 0.9 | Families 1.2 |
| 23 | Towpath Kiosk | Canal | Hole in the wall | 10 | 0.95 | Default pick for a new game |
| 24 | Net Loft Hatch | Old Harbour | Hole in the wall | 16 | 0.9 | Foodies 1.2 |

Every neighbourhood has one hole in the wall, so a new player with $7,000 (`fresh-start.md`) can start anywhere. All venues are available from day 1 (unlock gating is out of scope, section 10). Exact values live in `src/data/venues.ts`.

## 5. Demographic cards

Each neighbourhood and venue shows one card per customer segment, sorted by share:

* Segment name and a colour chip
* Share of passersby (%) and people per day (`footTraffic x share`, rounded)
* Spending: segment budget x wealth, shown as "spends about $X a head"
* What they like (tags from `segments.ts`) and how price sensitive they are (Low, Medium, High from elasticity)
* A small bar so the cards read at a glance

Above the cards: a one line "Best for" verdict computed from the shares: Volume (students + families ≥ 55%), Luxury (foodies + tourists ≥ 40%), otherwise Middle road.

## 6. Moving to another venue (relocation)

Command `rentVenue { venueId }`. Allowed any morning (not during a service).

| Step | Rule |
|---|---|
| Deposit | New deposit = 4 weeks of the new venue's rent (`T.finance.leaseDepositWeeks`) |
| Refund | The deposit held (`state.deposit`, `fresh-start.md` 3) comes back in full |
| Moving fee | `T.city.movingFee` = $1,500 |
| Net cost | new deposit − old deposit + moving fee; must be affordable (cash ≥ net cost when positive) |
| Dining room | If every piece fits and the seat limit holds, the layout is kept; otherwise it is laid out again and what does not fit is sold at 80% of the price paid |
| Kitchen | If the layout still fits and is valid it is kept; otherwise auto layout, and what does not fit is sold at 80% of the price paid |
| Reputation | Same neighbourhood: keep 90%. Another neighbourhood: keep 60%, the rest moves toward the starting value (30). Word of mouth is local |
| Staff, menu, recipes, loan, rank, guests served | Unchanged |

The confirm sheet lists every line above with real numbers before the player commits. Old saves (schema 3) migrate to the venue matching their neighbourhood and premises. The existing `movePremises` command (the "Buy another restaurant" market of `fresh-start.md`) also lands on the matching venue; the "Buy another restaurant" buttons now open the city map.

## 7. UI

* **City view** replaces the main area (not a modal) so the map has room. Left: the map (SVG, scales to fit, tap targets at least 44 px). Right: a detail card. Below the map: the sortable venue list.
* **Map:** neighbourhoods as soft coloured blocks with names, the canal and harbour water, a few streets, and one pin per venue coloured by premises size. The selected pin is enlarged; the current venue has a "You are here" flag.
* **Venue card:** name, address, neighbourhood; four key figures (foot traffic, rent per week, floor area in m², competition); dining and kitchen m² split; lunch and dinner split; demographic cards; pros (green) and cons (amber); comparison chips against the current venue (traffic +12%, rent −$200/week); cost to move; the Rent button.
* **Phone and iPad portrait:** map on top, card below, list last; no horizontal scroll.
* **Theme:** uses the existing colour tokens so light and dark both work.

## 8. Features

| ID | Feature |
|---|---|
| F-191 | City map view with seven neighbourhoods |
| F-192 | Twenty four venues (72 since M0.5, competition.md 4) with their own modifiers, pros and cons |
| F-193 | Demographic cards for neighbourhoods and venues |
| F-194 | Floor area in m² (dining, kitchen, total) |
| F-195 | Venue list with sort and filter |
| F-196 | Relocation command with deposit, fee, resale and reputation rules |
| F-197 | Two way link: HUD button and breadcrumb to the city, "Back to" button from the city |
| F-198 | New game starts on the city map |
| F-199 | Save migration schema 3 to 4 (`venueId`) |

## 9. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-293 | At least 15 venues exist, each with a valid premises and neighbourhood, at least two pros and two cons |
| AC-294 | At least 5 venues in 5 neighbourhoods leave $2,920 to fit out after the deposit; the reference starter kit fits every venue that is not a hole in the wall |
| AC-295 | Effective shares of every venue sum to 1 (within 0.001) |
| AC-296 | A new game at a venue uses that venue's rent, foot traffic and premises |
| AC-297 | `rentVenue` charges new deposit − old deposit + moving fee and fails when cash is short |
| AC-298 | `rentVenue` to the current venue fails with a clear message |
| AC-299 | After a move, furniture outside the new room and unplaceable equipment are sold at 80% and reported |
| AC-300 | After a move, reputation follows the same or other neighbourhood carry rule |
| AC-301 | After a move, staff, recipes, loan, rank and guests served are unchanged |
| AC-302 | Commands never mutate their input (existing rule holds for `rentVenue`) |
| AC-303 | Schema 2 and 3 saves load, get a deposit and a matching `venueId`, and keep playing |
| AC-304 | Balance harness numbers for the three original districts do not change |
| AC-305 | The city view opens from the HUD button and from the neighbourhood name |
| AC-306 | The city view always offers a way back (button, Escape) that returns to the previous tab unchanged |
| AC-307 | Venue card shows foot traffic, weekly rent, floor area in m² with dining and kitchen split, and demographic cards |
| AC-308 | The confirm sheet shows the same net cost that the command charges |
| AC-309 | A new game starts on the city map and the player can open at any venue |
| AC-310 | City view works at 375 px wide without horizontal scroll, in light and dark themes |

## 10. Out of scope for M0.3

* Unlocking venues by rank or reputation
* Rent that changes over time, lease lengths, landlords and negotiation
* Running more than one venue at once (chains are v1.0)
* Live rival restaurants on the map
* Moving furniture into storage instead of selling it
