// Weekly business review (WBR): one row of raw totals per restaurant per week, and the KPIs derived from them.
// Raw totals add up across weeks and restaurants; ratios are derived after adding, never averaged.

import { T } from '../data/tunables';
import { ovr } from './staff';
import { rivalLocations, venueFacts } from './rivals';
import type { DayReport, GameState, Staff } from './state';

/** Raw totals for one restaurant and one week (Monday to Sunday). */
export interface WeekKpi {
  /** Week number: week 1 is days 1 to 7. */
  week: number;
  locationId: number;
  days: number;
  daysOpen: number;
  diningSales: number;
  deliverySales: number;
  profit: number;
  covers: number;
  /** Ingredients plus waste. */
  food: number;
  staff: number;
  rent: number;
  marketing: number;
  deliveryCosts: number;
  /** Satisfaction x covers. */
  satW: number;
  /** Guests who wanted to come in, and those who could not. */
  demand: number;
  turnedAway: number;
  /** Capacity used (rho capped at 1), summed per open service, and the number of those services. */
  lunchUse: number;
  lunchN: number;
  dinnerUse: number;
  dinnerN: number;
  /** Minutes from order to plate at dinner x dinner guests. */
  ticketW: number;
  dinnerCovers: number;
  lostToRivals: number;
  /** Pizza guests of live rivals in the same neighbourhood this week. */
  rivalGuests: number;
  deliveryOrders: number;
  deliveryLate: number;
  /** End of week values. */
  rep: number;
  following: number;
  drep: number | null;
  staffCount: number;
  ovrSum: number;
  moraleSum: number;
  departures: number;
}

const zero = (week: number, locationId: number): WeekKpi => ({
  week, locationId, days: 0, daysOpen: 0, diningSales: 0, deliverySales: 0, profit: 0, covers: 0, food: 0, staff: 0, rent: 0, marketing: 0,
  deliveryCosts: 0, satW: 0, demand: 0, turnedAway: 0, lunchUse: 0, lunchN: 0, dinnerUse: 0, dinnerN: 0, ticketW: 0, dinnerCovers: 0,
  lostToRivals: 0, rivalGuests: 0, deliveryOrders: 0, deliveryLate: 0, rep: 0, following: 0, drep: null, staffCount: 0, ovrSum: 0,
  moraleSum: 0, departures: 0,
});

export const weekOf = (day: number): number => Math.floor((day - 1) / 7) + 1;

/** One restaurant's week from its day reports (compacted reports still give money, guests and ratings). */
export function weekKpi(
  week: number, locationId: number, reports: readonly DayReport[],
  end: { rep: number; following: number; drep: number | null; staff: readonly Staff[]; departures: number; rivalGuests: number },
): WeekKpi {
  const k = zero(week, locationId);
  for (const r of reports) {
    k.days += 1;
    if (r.open) k.daysOpen += 1;
    const p = r.pnl;
    k.diningSales += p.sales;
    k.deliverySales += p.deliverySales ?? 0;
    k.profit += p.profit;
    k.covers += r.covers;
    k.food += p.ingredients + p.waste;
    k.staff += p.staff;
    k.rent += p.rent;
    k.marketing += p.marketing ?? 0;
    k.deliveryCosts += p.deliveryCosts ?? 0;
    k.satW += r.satisfaction * r.covers;
    k.turnedAway += r.walkAways;
    k.demand += r.covers + r.walkAways;
    for (const s of r.services) {
      const use = Math.min(1, s.rho);
      if (s.service === 'lunch') {
        k.lunchUse += use;
        k.lunchN += 1;
      } else {
        k.dinnerUse += use;
        k.dinnerN += 1;
        k.ticketW += (s.ticketTime ?? 0) * s.served;
        k.dinnerCovers += s.served;
      }
    }
    k.lostToRivals += Object.values(r.market?.lost ?? {}).reduce((a, b) => a + b, 0);
    const d = r.delivery;
    if (d) {
      k.deliveryOrders += d.delivered;
      const promise = T.delivery.promise;
      k.deliveryLate += d.delivered * ((d.time.lunch > promise ? T.delivery.lunchShare : 0) + (d.time.dinner > promise ? 1 - T.delivery.lunchShare : 0));
    }
  }
  k.rep = end.rep;
  k.following = end.following;
  k.drep = end.drep;
  k.staffCount = end.staff.length;
  k.ovrSum = end.staff.reduce((a, s) => a + ovr(s), 0);
  k.moraleSum = end.staff.reduce((a, s) => a + s.morale, 0);
  k.departures = end.departures;
  k.rivalGuests = end.rivalGuests;
  return k;
}

/** Rival pizza guests this week in a neighbourhood (their last closed week). */
function rivalGuestsIn(state: GameState, districtId: string): number {
  return rivalLocations(state).filter(({ loc }) => venueFacts(loc.venueId).district.id === districtId)
    .reduce((a, { loc }) => a + (loc.history.at(-1)?.served ?? 0), 0);
}

/** Sunday night, after the rivals closed their week: add this week's row for every restaurant the player owns. */
export function closeWeek(state: GameState): void {
  const week = weekOf(state.day);
  const firstDay = (week - 1) * 7 + 1;
  const keep = T.history.kpiWeeks;
  const row = (loc: Pick<GameState, 'history' | 'rep' | 'following' | 'delivery' | 'staff' | 'departures' | 'districtId' | 'kpis'>, id: number): WeekKpi[] => {
    const reports = loc.history.filter((r) => r.day >= firstDay && r.day <= state.day);
    const k = weekKpi(week, id, reports, {
      rep: loc.rep, following: loc.following, drep: loc.delivery?.on ? loc.delivery.drep : null, staff: loc.staff,
      departures: (loc.departures ?? []).filter((d) => d.day >= firstDay).length, rivalGuests: rivalGuestsIn(state, loc.districtId),
    });
    return [...(loc.kpis ?? []).filter((x) => x.week !== week), k].slice(-keep);
  };
  state.kpis = row(state, state.locationId);
  for (const b of state.branches) b.kpis = row(b, b.id);
}

/** Rebuild weekly rows from the day reports a save already has (used when loading a save from before the review). */
export function backfillKpis(loc: Pick<GameState, 'history' | 'rep' | 'following' | 'delivery' | 'staff' | 'departures'>, id: number): WeekKpi[] {
  const byWeek = new Map<number, DayReport[]>();
  for (const r of loc.history) byWeek.set(weekOf(r.day), [...(byWeek.get(weekOf(r.day)) ?? []), r]);
  const out: WeekKpi[] = [];
  for (const [week, reports] of [...byWeek].sort((a, b) => a[0] - b[0])) {
    if (reports.length < 7) continue;
    const last = reports.at(-1) as DayReport;
    out.push(weekKpi(week, id, reports, {
      rep: last.repAfter, following: last.followingAfter, drep: last.delivery?.drepAfter ?? null, staff: loc.staff, departures: 0, rivalGuests: 0,
    }));
  }
  return out.slice(-T.history.kpiWeeks);
}

/** Add rows together (several restaurants, or several weeks). End of week ratings become covers weighted. */
export function addUp(rows: readonly WeekKpi[], week = 0, locationId = 0): WeekKpi {
  const k = zero(week, locationId);
  let w = 0;
  let drepW = 0;
  let drepN = 0;
  for (const r of rows) {
    for (const key of Object.keys(k) as (keyof WeekKpi)[]) {
      if (key === 'week' || key === 'locationId' || key === 'rep' || key === 'following' || key === 'drep') continue;
      (k[key] as number) += r[key] as number;
    }
    const cw = Math.max(1, r.covers);
    w += cw;
    k.rep += r.rep * cw;
    k.following += r.following * cw;
    if (r.drep !== null) {
      drepW += r.drep * Math.max(1, r.deliveryOrders);
      drepN += Math.max(1, r.deliveryOrders);
    }
  }
  if (w > 0) {
    k.rep /= w;
    k.following /= w;
  }
  k.drep = drepN > 0 ? drepW / drepN : null;
  return k;
}

// ---------- KPI definitions ----------

export type KpiFormat = 'money' | 'pct' | 'num' | 'num1' | 'min' | 'rating';
export type KpiGroup = 'Financial' | 'Guests' | 'Operations' | 'Market' | 'Delivery' | 'Team';

export interface KpiDef {
  id: string;
  label: string;
  group: KpiGroup;
  format: KpiFormat;
  /** Which way is good. */
  better: 'up' | 'down' | 'none';
  /** The value, or null when it does not apply (for example delivery before it starts). */
  value: (k: WeekKpi) => number | null;
  /** A level that needs attention, with the reason shown in the call outs. */
  guard?: { above?: number; below?: number; text: string };
  /** Totals (money, guests) rather than levels: per restaurant columns add up. */
  total?: boolean;
  help: string;
}

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const sales = (k: WeekKpi): number => k.diningSales + k.deliverySales;

export const KPIS: readonly KpiDef[] = [
  { id: 'sales', label: 'Sales', group: 'Financial', format: 'money', better: 'up', total: true, value: sales, help: 'Dining and delivery sales.' },
  { id: 'profit', label: 'Profit', group: 'Financial', format: 'money', better: 'up', total: true, value: (k) => k.profit, help: 'After food, wages, rent, running costs, marketing, delivery costs and loan interest.' },
  { id: 'margin', label: 'Profit margin', group: 'Financial', format: 'pct', better: 'up', value: (k) => ratio(k.profit, sales(k)), guard: { below: 0, text: 'is losing money' }, help: 'Profit as a share of sales.' },
  { id: 'prime', label: 'Prime cost', group: 'Financial', format: 'pct', better: 'down', value: (k) => ratio(k.food + k.staff, sales(k)), guard: { above: 0.65, text: 'prime cost above 65% of sales' }, help: 'Food plus wages as a share of sales. Restaurants aim for 55% to 65%.' },
  { id: 'foodCost', label: 'Food cost', group: 'Financial', format: 'pct', better: 'down', value: (k) => ratio(k.food, sales(k)), guard: { above: 0.35, text: 'food cost above 35% of sales' }, help: 'Ingredients and waste as a share of sales.' },
  { id: 'labour', label: 'Labour', group: 'Financial', format: 'pct', better: 'down', value: (k) => ratio(k.staff, sales(k)), guard: { above: 0.35, text: 'wages above 35% of sales' }, help: 'Wages as a share of sales.' },
  { id: 'rentPct', label: 'Rent', group: 'Financial', format: 'pct', better: 'down', value: (k) => ratio(k.rent, sales(k)), guard: { above: 0.15, text: 'rent above 15% of sales' }, help: 'Rent as a share of sales.' },
  { id: 'marketing', label: 'Marketing spend', group: 'Financial', format: 'money', better: 'none', total: true, value: (k) => k.marketing, help: 'Campaigns and loyalty cards.' },
  { id: 'covers', label: 'Guests served', group: 'Guests', format: 'num', better: 'up', total: true, value: (k) => k.covers, help: 'Dining guests served.' },
  { id: 'check', label: 'Average check', group: 'Guests', format: 'money', better: 'up', value: (k) => ratio(k.diningSales, k.covers), help: 'Dining sales per guest.' },
  { id: 'sat', label: 'Satisfaction', group: 'Guests', format: 'num', better: 'up', value: (k) => ratio(k.satW, k.covers), guard: { below: 60, text: 'satisfaction below 60' }, help: 'Average guest satisfaction, 0 to 100.' },
  { id: 'rep', label: 'Reputation', group: 'Guests', format: 'rating', better: 'up', value: (k) => (k.days ? k.rep : null), help: 'At the end of the week.' },
  { id: 'following', label: 'Local following', group: 'Guests', format: 'pct', better: 'up', value: (k) => (k.days ? k.following : null), help: 'Locals who know you, at the end of the week.' },
  { id: 'turnedAway', label: 'Turned away', group: 'Guests', format: 'pct', better: 'down', value: (k) => ratio(k.turnedAway, k.demand), guard: { above: 0.1, text: 'turned away more than 10% of guests' }, help: 'Guests who wanted to eat but could not be served or gave up waiting.' },
  { id: 'daysOpen', label: 'Days open', group: 'Operations', format: 'num', better: 'up', total: true, value: (k) => k.daysOpen, help: 'Days the restaurant opened.' },
  { id: 'lunchUse', label: 'Lunch capacity used', group: 'Operations', format: 'pct', better: 'none', value: (k) => ratio(k.lunchUse, k.lunchN), help: 'Demand against what the kitchen, seats and plates could serve, capped at 100%.' },
  { id: 'dinnerUse', label: 'Dinner capacity used', group: 'Operations', format: 'pct', better: 'none', value: (k) => ratio(k.dinnerUse, k.dinnerN), help: 'At 100% you are turning guests away; below 60% you have room to grow.' },
  { id: 'ticket', label: 'Dinner ticket time', group: 'Operations', format: 'min', better: 'down', value: (k) => ratio(k.ticketW, k.dinnerCovers), guard: { above: 25, text: 'dinner tickets take over 25 minutes' }, help: 'Minutes from order to plate at dinner.' },
  { id: 'share', label: 'Neighbourhood share', group: 'Market', format: 'pct', better: 'up', value: (k) => (k.rivalGuests > 0 ? k.covers / (k.covers + k.rivalGuests) : null), help: 'Your guests against the live rivals in the same neighbourhood.' },
  { id: 'lost', label: 'Guests lost to rivals', group: 'Market', format: 'num', better: 'down', total: true, value: (k) => (k.lostToRivals > 0 || k.rivalGuests > 0 ? k.lostToRivals : null), help: 'Guests who would have come without the live rivals.' },
  { id: 'orders', label: 'Delivery orders', group: 'Delivery', format: 'num', better: 'up', total: true, value: (k) => (k.drep !== null || k.deliveryOrders > 0 ? k.deliveryOrders : null), help: 'Orders delivered.' },
  { id: 'deliverySales', label: 'Delivery sales', group: 'Delivery', format: 'money', better: 'up', total: true, value: (k) => (k.drep !== null || k.deliverySales > 0 ? k.deliverySales : null), help: 'Sales through delivery.' },
  { id: 'onTime', label: 'Delivered on time', group: 'Delivery', format: 'pct', better: 'up', value: (k) => (k.deliveryOrders > 0 ? 1 - k.deliveryLate / k.deliveryOrders : null), guard: { below: 0.8, text: 'fewer than 80% of deliveries on time' }, help: `Orders at the door within the ${T.delivery.promise} minute promise.` },
  { id: 'drep', label: 'Delivery rating', group: 'Delivery', format: 'rating', better: 'up', value: (k) => k.drep, help: 'At the end of the week.' },
  { id: 'staffCount', label: 'Staff', group: 'Team', format: 'num', better: 'none', total: true, value: (k) => (k.days ? k.staffCount : null), help: 'People on the payroll at the end of the week.' },
  { id: 'ovr', label: 'Average OVR', group: 'Team', format: 'num', better: 'up', value: (k) => ratio(k.ovrSum, k.staffCount), help: 'Average overall rating of the team.' },
  { id: 'morale', label: 'Average morale', group: 'Team', format: 'num', better: 'up', value: (k) => ratio(k.moraleSum, k.staffCount), guard: { below: 45, text: 'team morale below 45' }, help: 'Average morale, 0 to 100.' },
  { id: 'departures', label: 'Departures', group: 'Team', format: 'num', better: 'down', total: true, value: (k) => k.departures, help: 'People who left or were let go this week.' },
];

export const KPI_GROUPS: readonly KpiGroup[] = ['Financial', 'Guests', 'Operations', 'Market', 'Delivery', 'Team'];

// ---------- The review ----------

export interface ReviewScope {
  /** Restaurant id, or 'all' for every restaurant together. */
  location: number | 'all';
  weeks: number;
}

export interface KpiLine {
  def: KpiDef;
  /** One value per week, oldest first (null where it does not apply). */
  series: (number | null)[];
  last: number | null;
  /** Change against the week before, and against the average of the earlier weeks in the window. */
  wow: number | null;
  vsAvg: number | null;
}

export interface Callout {
  tone: 'good' | 'bad';
  text: string;
}

export interface Review {
  weeks: number[];
  lines: KpiLine[];
  callouts: Callout[];
  /** Last week per restaurant, and the whole window per restaurant. */
  byRestaurant: { id: number; name: string; last: WeekKpi; window: WeekKpi }[];
}

/** Every restaurant's weekly rows, by id. */
export function kpiRows(state: GameState): Map<number, WeekKpi[]> {
  const out = new Map<number, WeekKpi[]>();
  out.set(state.locationId, state.kpis ?? []);
  for (const b of state.branches) out.set(b.id, b.kpis ?? []);
  return out;
}

/** Change from a to b: relative for totals and money, in points for shares and ratings. */
export function change(def: KpiDef, from: number | null, to: number | null): number | null {
  if (from === null || to === null) return null;
  if (def.format === 'pct' || def.format === 'rating' || def.id === 'sat' || def.id === 'ovr' || def.id === 'morale') return to - from;
  if (Math.abs(from) < 1e-9) return null;
  return (to - from) / Math.abs(from);
}

export function buildReview(state: GameState, scope: ReviewScope, names: (id: number) => string): Review {
  const rows = kpiRows(state);
  const ids = scope.location === 'all' ? [...rows.keys()] : [scope.location];
  const allWeeks = [...new Set(ids.flatMap((id) => (rows.get(id) ?? []).map((r) => r.week)))].sort((a, b) => a - b);
  const weeks = allWeeks.slice(-scope.weeks);
  const perWeek = weeks.map((w) => addUp(ids.flatMap((id) => (rows.get(id) ?? []).filter((r) => r.week === w)), w));
  const lines: KpiLine[] = KPIS.map((def) => {
    const series = perWeek.map((k) => def.value(k));
    const last = series.at(-1) ?? null;
    const prev = series.length >= 2 ? (series.at(-2) ?? null) : null;
    const earlier = perWeek.slice(0, -1);
    const avgRow = earlier.length ? addUp(earlier) : null;
    // Totals compare with the weekly average; levels with the level over the earlier weeks.
    let avg = avgRow ? def.value(avgRow) : null;
    if (avg !== null && def.total && earlier.length) avg /= earlier.length;
    return { def, series, last, wow: change(def, prev, last), vsAvg: change(def, avg, last) };
  }).filter((l) => l.series.some((v) => v !== null));

  const callouts: Callout[] = [];
  const lastWeek = weeks.at(-1);
  // Guardrails per restaurant, so one weak restaurant is not hidden in the total.
  for (const id of ids) {
    const k = (rows.get(id) ?? []).find((r) => r.week === lastWeek);
    if (!k) continue;
    if (k.days >= 7 && k.daysOpen === 0) callouts.push({ tone: 'bad', text: `${names(id)} was closed all week and cost ${formatKpi(KPIS[1] as KpiDef, -k.profit)}.` });
    for (const def of KPIS) {
      const v = def.value(k);
      if (v === null || !def.guard) continue;
      if ((def.guard.above !== undefined && v > def.guard.above) || (def.guard.below !== undefined && v < def.guard.below)) {
        callouts.push({ tone: 'bad', text: `${names(id)} ${def.guard.text} (${formatKpi(def, v)}).` });
      }
    }
  }
  // The biggest movers against the window average.
  const movers = lines.filter((l) => l.vsAvg !== null && l.def.better !== 'none' && !(l.def.total && (l.last ?? 0) < 5))
    .map((l) => ({ l, size: moverSize(l) }))
    .filter((x) => x.size >= 1)
    .sort((a, b) => b.size - a.size)
    .slice(0, 4);
  for (const { l } of movers) {
    const up = (l.vsAvg ?? 0) > 0;
    const good = (l.def.better === 'up') === up;
    callouts.push({ tone: good ? 'good' : 'bad', text: `${l.def.label} ${up ? 'up' : 'down'} ${formatChange(l.def, l.vsAvg)} against the ${weeks.length - 1} week average, at ${formatKpi(l.def, l.last ?? 0)}.` });
  }

  const byRestaurant = ids.map((id) => {
    const r = (rows.get(id) ?? []).filter((x) => weeks.includes(x.week));
    return { id, name: names(id), last: r.find((x) => x.week === lastWeek) ?? zero(lastWeek ?? 0, id), window: addUp(r, 0, id) };
  });
  return { weeks, lines, callouts: callouts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'bad' ? -1 : 1)).slice(0, 8), byRestaurant };
}

/** How notable a move is: 1 means 10% for totals and money, 3 points for shares, 3 for scores. */
function moverSize(l: KpiLine): number {
  const v = Math.abs(l.vsAvg ?? 0);
  if (l.def.format === 'pct') return v / 0.03;
  if (l.def.format === 'rating' || l.def.id === 'sat' || l.def.id === 'ovr' || l.def.id === 'morale') return v / 3;
  return v / 0.1;
}

// ---------- Formatting (shared with the UI; plain text, no DOM) ----------

export function formatKpi(def: KpiDef, v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '·';
  switch (def.format) {
    case 'money': return `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
    case 'pct': return `${(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;
    case 'min': return `${v.toFixed(0)} min`;
    case 'rating': return v.toFixed(0);
    case 'num1': return v.toFixed(1);
    default: return Math.round(v).toLocaleString('en-US');
  }
}

export function formatChange(def: KpiDef, c: number | null): string {
  if (c === null || !Number.isFinite(c)) return '·';
  const sign = c > 0 ? '+' : c < 0 ? '-' : '';
  if (def.format === 'pct') return `${sign}${Math.abs(c * 100).toFixed(1)} pts`;
  if (def.format === 'rating' || def.id === 'sat' || def.id === 'ovr' || def.id === 'morale') return `${sign}${Math.abs(c).toFixed(1)}`;
  return `${sign}${Math.abs(c * 100).toFixed(0)}%`;
}

export const KPI_WEEKS_OPTIONS = [6, 12] as const;
