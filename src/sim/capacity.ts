// Capacity and station bottlenecks (kitchen-bottlenecks.md): how many guests each service can take, how far each day
// gets, what holds it back, and which levers move it.

import { EQUIPMENT } from '../data/equipment';
import { isMain } from '../data/recipes';
import type { Service } from '../data/types';
import { T } from '../data/tunables';
import { type Analysis, analyse } from './analysis';
import { simulateDay } from './day';
import type { DayReport, GameState, ServiceReport } from './state';
import { dayRun } from './team';

export interface StationIssue {
  id: 'tend' | 'washStrain' | 'idleWashers' | 'crowd' | 'cold' | 'plates' | 'cooks';
  /** What is wrong, in plain words. */
  text: string;
  /** What fixes it. */
  fix: string;
  /** How much it slows the kitchen (0 = not at all) or how close it is to binding. */
  severity: number;
}

const pct = (x: number): string => `${Math.round(x * 100)}%`;

/** Mismatches between equipment and staff that slow the kitchen now, or will as it gets busier. */
export function stationIssues(state: GameState, a: Analysis = analyse(state), lastDay?: DayReport): StationIssue[] {
  const st = a.kitchen.stations;
  const out: StationIssue[] = [];
  if (st.tendRatio < 1) {
    out.push({
      id: 'tend', severity: 1 - st.tendRatio,
      text: `${a.kitchen.kitchenStaff} cook${a.kitchen.kitchenStaff === 1 ? '' : 's'} for ${a.kitchen.ovens} oven${a.kitchen.ovens === 1 ? '' : 's'}: the ovens run at ${pct(st.tendRatio)} because nobody is free to load them.`,
      fix: 'Hire a cook, or swap to fewer, bigger ovens (a conveyor needs little tending).',
    });
  }
  if (st.washStrain > 0) {
    out.push({
      id: 'washStrain', severity: 1 - st.prepWashMult,
      text: `${a.kitchen.kitchenStaff} cooks share ${st.washPoints} wash point${st.washPoints === 1 ? '' : 's'}: they queue to wash hands and tools, prep is ${pct(1 - st.prepWashMult)} slower.`,
      fix: `A Hand Wash Station ($${EQUIPMENT.handWash?.price ?? 300}) or a Double Sink gives them room.`,
    });
  }
  if (st.idleWashers > 0) {
    out.push({
      id: 'idleWashers', severity: st.idleWashers / Math.max(1, st.idleWashers + st.washSlots),
      text: `${st.idleWashers} dishwasher${st.idleWashers === 1 ? ' stands' : 's stand'} idle: the wash stations have room for ${st.washSlots}.`,
      fix: 'A Double Sink or a Dish Machine gives them somewhere to work, or let one go.',
    });
  }
  if (st.crowdOver > 0) {
    out.push({
      id: 'crowd', severity: 1 - st.crowdMult,
      text: `${st.kitchenPeople} people in a kitchen with working room for ${st.roomFor}: everyone works ${pct(1 - st.crowdMult)} slower.`,
      fix: 'Every counter gives a cook a place to work: swap a small station for a longer counter, send someone to the floor, or move to a bigger kitchen.',
    });
  }
  const pizzas = lastDay?.open ? Object.entries(lastDay.dishSales).filter(([id]) => state.recipes.find((r) => r.id === id)?.kind === 'pizza').reduce((x, [, n]) => x + n, 0) : 0;
  if (st.coldCap > 0 && pizzas > 0.85 * st.coldCap) {
    out.push({
      id: 'cold', severity: Math.min(1, pizzas / st.coldCap - 0.85),
      text: `The fridges hold dough for ${st.coldCap} pizzas a day; the last day sold ${Math.round(pizzas)}.`,
      fix: 'A Reach in Fridge (350 a day) or a Walk in Cooler (700 a day).',
    });
  }
  // Cooks cook for a limited number of guests a service (founder rule): warn from 85% of what they can handle.
  const busiest = lastDay?.open ? Math.max(0, ...lastDay.services.map((s) => s.served)) : 0;
  const cookCap = a.kitchen.cookGuests;
  if (cookCap > 0 && busiest > 0.85 * cookCap) {
    out.push({
      id: 'cooks', severity: Math.min(1, busiest / cookCap - 0.85 + 0.2),
      text: `${a.kitchen.kitchenStaff} cook${a.kitchen.kitchenStaff === 1 ? '' : 's'} cooked for ${Math.round(busiest)} guests at the busiest service; together they handle about ${Math.round(cookCap)}.`,
      fix: 'Hire another cook, or train Speed: a cook at Speed 50 handles 50 guests a service, a top cook up to 75.',
    });
  }
  const platesRan = lastDay?.services.some((s) => s.bottleneck === 'plates');
  if (platesRan) {
    out.push({
      id: 'plates', severity: 0.5,
      text: 'Clean plates ran out at the last service.',
      fix: `Plate Shelving ($${EQUIPMENT.plateShelving?.price ?? 350}) holds 90 more plates; a faster sink or a dishwasher keeps them coming.`,
    });
  }
  return out.sort((x, y) => y.severity - x.severity);
}

// ---------- Capacity ----------

export interface ServiceCapacity {
  service: Service;
  /** Guests the restaurant could serve this service if enough wanted in. */
  capacity: number;
  /** Guests who wanted in. */
  demand: number;
  served: number;
  bottleneck: ServiceReport['bottleneck'];
}

export interface CapacityOutlook {
  /** Average day of the coming week, noise off. */
  lunch: ServiceCapacity;
  dinner: ServiceCapacity;
  /** Whether demand or the restaurant is what limits guests. */
  limit: 'demand' | 'capacity' | 'mixed';
  profit: number;
  covers: number;
}

function serviceOf(r: DayReport, sv: Service): ServiceCapacity {
  const x = r.services.find((y) => y.service === sv);
  return { service: sv, capacity: x?.capacity ?? 0, demand: x?.demand ?? 0, served: x?.served ?? 0, bottleneck: x?.bottleneck ?? 'none' };
}

export function capacityOf(r: DayReport): { lunch: ServiceCapacity; dinner: ServiceCapacity } {
  return { lunch: serviceOf(r, 'lunch'), dinner: serviceOf(r, 'dinner') };
}

/** Capacity and demand across the coming week, at today's settings. */
export function capacityOutlook(state: GameState): CapacityOutlook | null {
  const base = state.day - ((state.day - 1) % 7);
  const acc = { lunch: { capacity: 0, demand: 0, served: 0 }, dinner: { capacity: 0, demand: 0, served: 0 } };
  const bns: Record<Service, Map<string, number>> = { lunch: new Map(), dinner: new Map() };
  let profit = 0;
  let covers = 0;
  for (let i = 0; i < 7; i++) {
    const r = dayRun({ ...state, day: base + i }, { noise: false }).report;
    if (!r.open) return null;
    profit += r.pnl.profit;
    covers += r.covers;
    for (const sv of ['lunch', 'dinner'] as Service[]) {
      const c = serviceOf(r, sv);
      acc[sv].capacity += c.capacity / 7;
      acc[sv].demand += c.demand / 7;
      acc[sv].served += c.served / 7;
      bns[sv].set(c.bottleneck, (bns[sv].get(c.bottleneck) ?? 0) + 1);
    }
  }
  const top = (sv: Service): ServiceReport['bottleneck'] => {
    const found = [...bns[sv].entries()].filter(([k]) => k !== 'none').sort((x, y) => y[1] - x[1])[0];
    return (found && found[1] >= 3 ? found[0] : 'none') as ServiceReport['bottleneck'];
  };
  const lunch: ServiceCapacity = { service: 'lunch', ...acc.lunch, bottleneck: top('lunch') };
  const dinner: ServiceCapacity = { service: 'dinner', ...acc.dinner, bottleneck: top('dinner') };
  const full = (c: ServiceCapacity): boolean => c.demand >= c.capacity * 0.95;
  const limit = full(lunch) && full(dinner) ? 'capacity' : !full(lunch) && !full(dinner) ? 'demand' : 'mixed';
  return { lunch, dinner, limit, profit: profit / 7, covers: covers / 7 };
}

// ---------- Levers ----------

export interface Lever {
  label: string;
  /** Guests per day and profit per day compared with now. */
  guests: number;
  profit: number;
  note: string;
}

function weekAverage(state: GameState, tweak?: (a: Analysis) => void): { guests: number; profit: number } {
  const base = state.day - ((state.day - 1) % 7);
  let guests = 0;
  let profit = 0;
  for (let i = 0; i < 7; i++) {
    const s = { ...state, day: base + i };
    const a = analyse(s);
    tweak?.(a);
    const r = simulateDay(s, a, { noise: false });
    guests += r.covers;
    profit += r.pnl.profit;
  }
  return { guests: guests / 7, profit: profit / 7 };
}

/** What moves guests and profit most right now: price, quality and reputation, measured on the real day model. */
export function levers(state: GameState): Lever[] {
  const now = weekAverage(state);
  const priced = (m: number): GameState => ({ ...state, recipes: state.recipes.map((r) => (isMain(r.kind) && r.onMenu ? { ...r, price: Math.round(r.price * m * 2) / 2 } : r)) });
  const d = (x: { guests: number; profit: number }): { guests: number; profit: number } => ({ guests: x.guests - now.guests, profit: x.profit - now.profit });
  const quality = d(weekAverage(state, (a) => {
    for (const k of Object.keys(a.dishes)) {
      const x = a.dishes[k];
      if (!x) continue;
      x.quality = Math.min(100, x.quality + 5);
      x.fairPrice += T.pricing.fairQualitySlope * 5;
    }
  }));
  const out: Lever[] = [
    { label: 'Mains 10% cheaper', ...d(weekAverage(priced(0.9))), note: 'Value draws price sensitive guests: students and families.' },
    { label: 'Mains 10% dearer', ...d(weekAverage(priced(1.1))), note: 'When guests queue at the door, a higher price costs few of them.' },
    { label: '+5 dish quality', ...quality, note: 'Better ingredients, better cooks or better equipment. Foodies and professionals notice most.' },
    { label: '+5 reputation', ...d(weekAverage({ ...state, rep: Math.min(100, state.rep + 5) })), note: 'Earned with happy guests over a few weeks; brings everyone.' },
  ];
  return out.sort((x, y) => y.profit - x.profit);
}

// ---------- The week ----------

export interface WeekKitchen {
  /** Services by what limited them. */
  limits: Record<string, number>;
  services: number;
  /** Guests who wanted in but were not served. */
  turnedAway: number;
  /** Share of capacity used, lunch and dinner. */
  use: Record<Service, number>;
}

export function weekKitchen(reports: readonly DayReport[]): WeekKitchen {
  const limits: Record<string, number> = {};
  const use = { lunch: { served: 0, cap: 0 }, dinner: { served: 0, cap: 0 } };
  let services = 0;
  let turnedAway = 0;
  for (const r of reports) {
    if (!r.open) continue;
    for (const s of r.services) {
      services += 1;
      limits[s.bottleneck] = (limits[s.bottleneck] ?? 0) + 1;
      use[s.service].served += s.served;
      use[s.service].cap += s.capacity;
      turnedAway += Math.max(0, s.walkAways);
    }
  }
  return {
    limits, services, turnedAway,
    use: { lunch: use.lunch.cap ? use.lunch.served / use.lunch.cap : 0, dinner: use.dinner.cap ? use.dinner.served / use.dinner.cap : 0 },
  };
}
