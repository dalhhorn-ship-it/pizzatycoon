# Business review (M0.6)

A weekly business review in the style of a WBR: the key KPIs of every restaurant over the last 6 or 12 weeks, week on week and against the average, with call outs. Opened from the Money tab (the "Week N" card and the Business review button).

## Data

* Every Sunday night, after the rivals close their week, each restaurant the player owns gets one row of raw weekly totals (`WeekKpi` in `src/sim/kpi.ts`): sales, profit, guests, food, wages, rent, marketing, delivery, satisfaction x guests, demand and guests turned away, capacity used per service, dinner ticket time, guests lost to rivals, rival guests in the neighbourhood, and end of week reputation, following, delivery rating and team.
* 13 rows are kept per restaurant (`T.history.kpiWeeks`), so 12 weeks plus the week before for the first week on week. Rows are small, so the review does not depend on the day reports, which are compacted after 7 days.
* Saves from before the review rebuild their rows from the full weeks of day reports they still have.

## KPIs

| Group | KPIs |
|---|---|
| Financial | Sales, Profit, Profit margin, Prime cost (food plus wages), Food cost, Labour, Rent, Marketing spend |
| Guests | Guests served, Average check, Satisfaction, Reputation, Local following, Turned away |
| Operations | Days open, Lunch and dinner capacity used, Dinner ticket time |
| Market | Neighbourhood share (against live rivals), Guests lost to rivals |
| Delivery | Orders, Delivery sales, Delivered on time, Delivery rating |
| Team | Staff, Average OVR, Average morale, Departures |

**Adding up:** raw totals are added across weeks and restaurants first and ratios are derived afterwards, so the portfolio food cost is total food over total sales, never an average of percentages. End of week ratings are weighted by guests (delivery rating by orders).

**Changes:** money and totals change in percent; shares and ratings in points. "vs average" compares last week with the average of the earlier weeks shown (per week for totals).

## Call outs

* Guardrails per restaurant, so a weak one is not hidden in the total: margin below 0, prime cost above 65%, food cost above 35%, labour above 35%, rent above 15%, satisfaction below 60, turned away above 10%, dinner tickets above 25 minutes, deliveries on time below 80%, morale below 45, and closed all week.
* The four biggest movers against the average (at least 10% for money, 3 points for shares and ratings), marked good or bad by the KPI's direction.

## Screens

* **Money tab:** "Week N" card with six headline KPIs against the 6 week average, the worst call out and a button to the review.
* **Business review:** 6 or 12 weeks; all restaurants or one; call outs; the KPI table (one column per week, week on week, vs average and a trend bar); per restaurant tables for last week and the whole window; "Copy as text" for notes. On a phone the tables scroll sideways inside their card with the KPI column fixed.

## Acceptance criteria

* AC-288: a row is added every Sunday; at most 13 are kept (tests/kpi.test.ts).
* AC-289: a row's sales, profit and guests equal the sum of that week's day reports.
* AC-290: ratios across restaurants are derived from totals (1,000 of 4,000 is 25%, not the 30% average).
* AC-291: the portfolio's profit equals the sum of its restaurants.
* AC-292: old saves get rows back from their reports; a restaurant closed all week is called out.
