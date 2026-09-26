// The aggregate day model (ADR-002). This is the only authority on guests, money and reputation.
// Formulas: 01-product/prd.md 5.7, 5.10, 5.11 and balance.md 1.4, 1.8, 1.12.

import { DISTRICTS } from '../data/districts';
import { SEGMENTS, SEGMENT_IDS } from '../data/segments';
import type { DishKind, SegmentId, Service } from '../data/types';
import { T } from '../data/tunables';
import { type Analysis, type DishStats, clamp, kitchenStats, tasteMatch } from './analysis';
import { Rng } from './rng';
import type { DayReport, GameState, PnL, Recipe, Review, SegmentReport, ServiceReport } from './state';

export interface DayOptions {
  /** Daily randomness on demand (plus or minus a few percent). Off for balance tests. */
  noise: boolean;
}

const SERVICES: Service[] = ['lunch', 'dinner'];
const SIDE_KINDS: Exclude<DishKind, 'pizza'>[] = ['drink', 'starter', 'dessert'];

interface Choice {
  probs: { recipe: Recipe; stats: DishStats; p: number }[];
  avgPrice: number;
  avgFair: number;
  avgCost: number;
  avgQuality: number;
  avgTaste: number;
  wasteCost: number;
}

export function valueScore(r: number, elasticity: number): number {
  return clamp(T.pricing.valueBase - T.pricing.valueSlope * (r - 1) * elasticity, 0, 1);
}

export function attachRate(kind: 'drink' | 'starter' | 'dessert', ambience: number): number {
  const a = T.attach[kind];
  return a.base + a.bonus * clamp((ambience - a.pivot) / a.span, 0, 1);
}

export function queueDelay(rho: number): number {
  if (rho >= T.service.queueRhoCap) return T.service.queueCap;
  return Math.min(T.service.queueCap, (2 * rho) / (1 - rho));
}

/** Logit dish choice for one segment among dishes of one kind (prd.md 5.7 "Dish choice"). */
export function chooseDishes(recipes: Recipe[], a: Analysis, segment: SegmentId): Choice | null {
  if (!recipes.length) return null;
  const seg = SEGMENTS[segment];
  const appeals = recipes.map((r) => {
    const st = a.dishes[r.id] as DishStats;
    const value = valueScore(r.price / st.fairPrice, seg.elasticity);
    return (seg.qualityWeight * st.quality) / 100 + 0.4 * tasteMatch(st.tags, segment) + 0.3 * value;
  });
  const maxA = Math.max(...appeals);
  const w = appeals.map((x) => Math.exp(T.demand.choiceTemperature * (x - maxA)));
  const sum = w.reduce((x, y) => x + y, 0);
  const probs = recipes.map((recipe, i) => ({ recipe, stats: a.dishes[recipe.id] as DishStats, p: (w[i] ?? 0) / sum }));
  const avg = (f: (x: (typeof probs)[number]) => number): number => probs.reduce((acc, x) => acc + x.p * f(x), 0);
  return {
    probs,
    avgPrice: avg((x) => x.recipe.price),
    avgFair: avg((x) => x.stats.fairPrice),
    avgCost: avg((x) => x.stats.foodCost),
    avgQuality: avg((x) => x.stats.quality),
    avgTaste: avg((x) => tasteMatch(x.stats.tags, segment)),
    wasteCost: avg((x) => x.stats.foodCost * x.stats.wasteRate),
  };
}

export function menuFit(mains: Recipe[], a: Analysis, segment: SegmentId, crowdPleaser: boolean): number {
  const matches = mains
    .map((r) => tasteMatch((a.dishes[r.id] as DishStats).tags, segment))
    .sort((x, y) => y - x)
    .slice(0, 5);
  const m = matches.length ? matches.reduce((x, y) => x + y, 0) / matches.length : 0;
  const fit = T.demand.menuFitBase + T.demand.menuFitSlope * m;
  return segment === 'families' && crowdPleaser ? fit * (1 + T.demand.crowdPleaserFit) : fit;
}

export function closedReason(state: GameState, a: Analysis): string | null {
  const onMenu = state.recipes.filter((r) => r.onMenu);
  if (!onMenu.some((r) => r.kind === 'pizza')) return 'There is no pizza on the menu.';
  if (a.room.tables === 0) return 'There are no tables in the dining room.';
  if (a.kitchen.ovens === 0) return 'The kitchen has no oven.';
  if (a.kitchen.counters === 0) return 'The kitchen has no prep station.';
  if (!a.kitchen.hasCold) return 'The kitchen needs a fridge to keep the dough cold.';
  if (!a.kitchen.hasSink) return 'The kitchen needs a sink.';
  if (a.kitchen.kitchenStaff === 0) return 'Nobody is working in the kitchen. Hire a cook.';
  if (a.service.servers === 0) return 'Nobody is serving tables. Hire a server.';
  return null;
}

const REVIEW_TEXT: Record<string, { high: readonly string[]; low: readonly string[] }> = {
  food: {
    high: ['The pizza was wonderful.', 'Best crust I have had in ages.', 'You can taste the good ingredients.', 'Perfectly blistered, perfectly topped.'],
    low: ['The pizza was a bit disappointing.', 'The toppings tasted a little tired.', 'Nothing special on the plate.', 'The base was on the bland side.'],
  },
  service: {
    high: ['Friendly, attentive staff.', 'Our server was a delight.', 'Warm welcome from start to finish.'],
    low: ['Service felt stretched.', 'We had to wave for the bill.', 'The staff looked rushed off their feet.'],
  },
  ambience: {
    high: ['Such a lovely, cosy room.', 'Gorgeous little dining room.', 'The lighting makes it feel like home.'],
    low: ['The room felt a bit bare.', 'Could do with some warmth on the walls.', 'A little cramped and plain.'],
  },
  value: {
    high: ['Great value for money.', 'Honest prices for proper pizza.', 'Worth every penny.'],
    low: ['Pricey for what it is.', 'The bill made us wince.', 'A bit steep for a weeknight.'],
  },
  wait: {
    high: ['Barely had to wait.', 'Seated straight away.', 'Food arrived quickly.'],
    low: ['We waited ages for our table.', 'The queue at the door was long.', 'The food took its time.'],
  },
};

export function simulateDay(state: GameState, a: Analysis, opts: DayOptions): DayReport {
  const district = DISTRICTS[state.districtId];
  if (!district) throw new Error(`Unknown district ${state.districtId}`);
  const weekday = (state.day - 1) % 7;
  const reason = closedReason(state, a);
  const rng = Rng.stream(state.seed, state.day, 'day');
  const pnlBase = fixedCosts(state, a, 0);
  if (reason) {
    return {
      day: state.day, weekday, open: false, closedReason: reason, covers: 0, walkAways: 0, services: [], segments: [],
      dishSales: {}, satisfaction: 0, reviews: [], repBefore: state.rep, repAfter: state.rep, pnl: pnlBase,
      cashBefore: state.cash, cashAfter: state.cash, weeklyPayments: 0, tips: [reason],
    };
  }

  const onMenu = state.recipes.filter((r) => r.onMenu);
  const mains = onMenu.filter((r) => r.kind === 'pizza');
  const sidesByKind = Object.fromEntries(SIDE_KINDS.map((k) => [k, onMenu.filter((r) => r.kind === k)])) as Record<
    (typeof SIDE_KINDS)[number],
    Recipe[]
  >;
  const ambience = a.room.ambience;
  const attach = {
    drink: sidesByKind.drink.length ? attachRate('drink', ambience) : 0,
    starter: sidesByKind.starter.length ? attachRate('starter', ambience) : 0,
    dessert: sidesByKind.dessert.length ? attachRate('dessert', ambience) : 0,
  };
  const kitchenBy = { lunch: kitchenStats(state, 'lunch'), dinner: kitchenStats(state, 'dinner') };
  const prepLoad = 1 + T.kitchen.prepLoadFactor * (attach.starter + attach.dessert);

  const crowdPleaser = state.staff.some((s) => s.traits.includes('crowdPleaser'));
  const chefFame = state.staff.filter((s) => s.role === 'chef').reduce((x, s) => x + s.fame, 0);
  const cEff = Math.min(T.demand.competitionCap, district.competition);
  const repMult = T.demand.repMultBase + T.demand.repMultSlope * state.rep;
  const weekdayMult = T.time.weekdayMult[weekday] ?? 1;

  // ---- Demand per segment and service ----
  interface SegCalc {
    id: SegmentId;
    choice: Choice;
    sides: Record<string, Choice | null>;
    r: number;
    demand: Record<Service, number>;
    check: number;
    costPerCover: number;
    wastePerCover: number;
  }
  const segs: SegCalc[] = [];
  for (const id of SEGMENT_IDS) {
    const seg = SEGMENTS[id];
    const choice = chooseDishes(mains, a, id);
    if (!choice) continue;
    const r = choice.avgPrice / choice.avgFair;
    const fit = menuFit(mains, a, id, crowdPleaser);
    const priceMult = clamp(Math.pow(r, -seg.elasticity), T.demand.priceMultMin, T.demand.priceMultMax);
    const budgetMult = clamp(
      Math.pow((seg.budget * district.wealth) / choice.avgPrice, T.demand.budgetExponent),
      T.demand.budgetMultMin,
      T.demand.budgetMultMax,
    );
    const qualityMult = clamp(
      1 + (seg.qualityAppeal * (choice.avgQuality - T.demand.qualityPivot)) / T.demand.qualityDivisor,
      T.demand.qualityMultMin,
      T.demand.qualityMultMax,
    );
    const speedMult = seg.speedAppealAtLunch
      ? clamp(T.demand.speedRef / a.service.serviceTime.lunch, T.demand.speedMultMin, T.demand.speedMultMax)
      : 1;
    const fameMult = id === 'foodies' ? 1 + T.demand.chefFameFoodieBonus * chefFame : 1;
    const noise = opts.noise ? clamp(1 + 0.06 * rng.normal(), 0.8, 1.2) : 1;
    const base =
      district.footTraffic * district.shares[id] * T.demand.captureBase * repMult * weekdayMult *
      fit * priceMult * budgetMult * qualityMult * fameMult * (1 - T.demand.competitionFactor * cEff) * noise;
    const sides: Record<string, Choice | null> = {};
    let check = choice.avgPrice;
    let cost = choice.avgCost;
    let waste = choice.wasteCost;
    for (const k of SIDE_KINDS) {
      const c = chooseDishes(sidesByKind[k], a, id);
      sides[k] = c;
      if (!c) continue;
      check += attach[k] * c.avgPrice;
      cost += attach[k] * c.avgCost;
      waste += attach[k] * c.wasteCost;
    }
    segs.push({
      id, choice, sides, r,
      demand: { lunch: base * district.lunchShare * speedMult, dinner: base * (1 - district.lunchShare) },
      check, costPerCover: cost, wastePerCover: waste,
    });
  }

  // ---- Capacity and service per sitting ----
  const services: ServiceReport[] = [];
  const served: Record<SegmentId, Record<Service, number>> = {} as never;
  const perceivedWait: Record<Service, number> = { lunch: 0, dinner: 0 };
  const queueBy: Record<Service, number> = { lunch: 0, dinner: 0 };
  let totalWalk = 0;
  let impatient = 0;
  for (const sv of SERVICES) {
    const hours = sv === 'lunch' ? T.time.lunchHours : T.time.dinnerHours;
    const demand = segs.reduce((x, s) => x + s.demand[sv], 0);
    const meal = demand > 0 ? segs.reduce((x, s) => x + s.demand[sv] * SEGMENTS[s.id].mealLength[sv], 0) / demand : 45;
    const cycle = a.service.serviceTime[sv] + meal;
    const seatPerHour = (a.room.seats * T.service.partySizeFit * 60) / cycle;
    const k = kitchenBy[sv];
    const prepPerHour = k.prepPerHour / prepLoad;
    const kitchenPerHour = Math.min(k.ovenPerHour, prepPerHour);
    const perHour = Math.min(kitchenPerHour, seatPerHour);
    const serviceCap = perHour * hours * T.service.utilisation[sv];
    const plateCap = (a.service.platesPerHour / T.kitchen.platesPerCover) * hours + T.kitchen.plateStock / T.kitchen.platesPerCover;
    const capacity = Math.min(serviceCap, plateCap);
    const rho = capacity > 0 ? demand / capacity : 99;
    const q = queueDelay(rho);
    queueBy[sv] = q;
    const servedTotal = Math.min(demand, capacity);
    const fill = demand > 0 ? servedTotal / demand : 0;
    let bottleneck: ServiceReport['bottleneck'] = 'none';
    if (rho >= 0.85) {
      if (plateCap < serviceCap) bottleneck = 'plates';
      else if (seatPerHour <= kitchenPerHour) bottleneck = 'seats';
      else bottleneck = k.ovenPerHour <= prepPerHour ? 'oven' : 'prep';
    }
    let walk = demand - servedTotal;
    const share = T.service.perceivedQueueShare[sv];
    for (const s of segs) {
      const tol = SEGMENTS[s.id].waitTolerance[sv];
      const pq = q * share;
      const limit = T.service.walkAwayThreshold * tol;
      const leaveFrac = pq > limit ? Math.min(0.5, (pq - limit) / limit) : 0;
      const got = s.demand[sv] * fill;
      const stays = got * (1 - leaveFrac);
      walk += got - stays;
      impatient += got - stays;
      (served[s.id] ??= { lunch: 0, dinner: 0 })[sv] = stays;
    }
    perceivedWait[sv] = a.service.orderTime[sv] + a.service.serveTime[sv] + q * share;
    totalWalk += walk;
    const servedAfter = segs.reduce((x, s) => x + (served[s.id]?.[sv] ?? 0), 0);
    services.push({
      service: sv, demand, served: servedAfter, walkAways: walk, capacity, rho, queueDelay: q, bottleneck, tableCycle: cycle,
      stages: { prep: prepPerHour, oven: k.ovenPerHour, seats: seatPerHour, plates: a.service.platesPerHour / T.kitchen.platesPerCover },
      demandPerHour: demand / (hours * T.service.utilisation[sv]),
    });
  }

  // ---- Satisfaction, money, dish sales ----
  const segmentReports: SegmentReport[] = [];
  let sales = 0;
  let ingredients = 0;
  let waste = 0;
  let covers = 0;
  let satWeighted = 0;
  const dishSales: Record<string, number> = {};
  for (const s of segs) {
    const seg = SEGMENTS[s.id];
    const n = (served[s.id]?.lunch ?? 0) + (served[s.id]?.dinner ?? 0);
    const food = T.satisfaction.foodQualityShare * (s.choice.avgQuality / 100) + (1 - T.satisfaction.foodQualityShare) * s.choice.avgTaste;
    const value = valueScore(s.r, seg.elasticity);
    let wait = 0;
    for (const sv of SERVICES) {
      const tol = seg.waitTolerance[sv];
      const ws = clamp(1 - Math.max(0, perceivedWait[sv] - tol) / tol, 0, 1);
      wait += n > 0 ? ((served[s.id]?.[sv] ?? 0) / n) * ws : ws / 2;
    }
    const scores = { food, service: a.service.serviceScore, ambience: ambience / 100, value, wait };
    const S =
      100 *
      (T.satisfaction.wFood * food + T.satisfaction.wService * scores.service + T.satisfaction.wAmbience * scores.ambience +
        T.satisfaction.wValue * value + T.satisfaction.wWait * wait);
    segmentReports.push({ segment: s.id, demand: s.demand.lunch + s.demand.dinner, served: n, satisfaction: S, scores });
    sales += n * s.check;
    ingredients += n * s.costPerCover;
    waste += n * s.wastePerCover;
    covers += n;
    satWeighted += n * S;
    for (const p of s.choice.probs) dishSales[p.recipe.id] = (dishSales[p.recipe.id] ?? 0) + n * p.p;
    for (const k of SIDE_KINDS) {
      const c = s.sides[k];
      if (!c) continue;
      for (const p of c.probs) dishSales[p.recipe.id] = (dishSales[p.recipe.id] ?? 0) + n * attach[k] * p.p;
    }
  }
  const satisfaction = covers > 0 ? satWeighted / covers : 0;

  // ---- Reviews and reputation (prd.md 5.10) ----
  const reviews: Review[] = [];
  let parties = 0;
  let reviewScoreWeighted = 0;
  for (const sr of segmentReports) {
    const p = sr.served / SEGMENTS[sr.segment].partySize;
    parties += p;
    reviewScoreWeighted += p * (T.reputation.reviewBase + T.reputation.reviewSlope * sr.satisfaction);
    const expected = p * T.satisfaction.reviewProbability;
    const count = Math.floor(expected) + (rng.chance(expected - Math.floor(expected)) ? 1 : 0);
    for (let i = 0; i < count; i++) {
      const s = clamp(sr.satisfaction + 8 * rng.normal(), 0, 100);
      const entries = Object.entries(sr.scores);
      const hi = entries.reduce((x, y) => (y[1] > x[1] ? y : x));
      const lo = entries.reduce((x, y) => (y[1] < x[1] ? y : x));
      const good = REVIEW_TEXT[hi[0]]?.high ?? [''];
      const bad = REVIEW_TEXT[lo[0]]?.low ?? [''];
      const text = s >= 85 ? `${rng.pick(good)} ${rng.pick(REVIEW_TEXT.food?.high ?? good)}` : s < 40 ? `${rng.pick(bad)}` : `${rng.pick(good)} ${rng.pick(bad)}`;
      reviews.push({ segment: sr.segment, stars: clamp(Math.round(1 + (4 * s) / 100), 1, 5), text });
    }
  }
  let rep = state.rep;
  if (parties * T.satisfaction.reviewProbability >= 0.5) {
    const reviewScore = reviewScoreWeighted / parties;
    rep += T.reputation.learningRate * (reviewScore - rep);
  }
  // Only guests who gave up waiting hurt reputation; a full house turning people away at the door does not.
  const arrivals = covers + impatient;
  if (arrivals > 0 && impatient / arrivals > T.reputation.walkAwayThreshold) rep -= T.reputation.walkAwayPenalty;
  const fame = Math.min(T.staff.fameRepCap, state.staff.reduce((x, s) => x + s.fame, 0) * T.staff.fameRepPerWeek);
  rep = clamp(rep + fame / 7, 0, 100);

  const pnl = fixedCosts(state, a, covers);
  pnl.sales = sales;
  pnl.ingredients = ingredients;
  pnl.waste = waste;
  pnl.profit = sales - ingredients - waste - pnl.staff - pnl.rent - pnl.utilities - pnl.upkeep - pnl.interest;

  return {
    day: state.day, weekday, open: true, closedReason: null, covers, walkAways: totalWalk, services, segments: segmentReports,
    dishSales, satisfaction, reviews, repBefore: state.rep, repAfter: rep, pnl,
    cashBefore: state.cash, cashAfter: state.cash, weeklyPayments: 0,
    tips: tipsFor(services, a, pnl, segmentReports),
  };
}

function fixedCosts(state: GameState, a: Analysis, covers: number): PnL {
  const staff = a.weeklySalaries / 7;
  const rent = a.weeklyRent / 7;
  const utilities = T.finance.utilitiesBase + T.finance.utilitiesPerCover * covers;
  const upkeep = T.finance.upkeepBase + a.kitchen.maintenancePerWeek / 7;
  const interest = (state.loan.balance * state.loan.annualRate) / 52 / 7;
  const profit = -(staff + rent + utilities + upkeep + interest);
  return { sales: 0, ingredients: 0, waste: 0, staff, rent, utilities, upkeep, interest, profit };
}

function tipsFor(services: ServiceReport[], a: Analysis, pnl: PnL, segs: SegmentReport[]): string[] {
  const tips: string[] = [];
  for (const s of services) {
    const pct = Math.round(Math.min(1, s.rho) * 100);
    const name = s.service === 'lunch' ? 'lunch' : 'dinner';
    if (s.bottleneck === 'seats') tips.push(`Seats were full ${pct}% of ${name}. More tables or a host (faster seating) would help.`);
    if (s.bottleneck === 'oven') tips.push(`The oven was the limit at ${name}. A bigger or faster oven would serve more guests.`);
    if (s.bottleneck === 'prep') tips.push(`Prep counters were the limit at ${name}. Another counter, a cook or a dough sheeter would help.`);
    if (s.bottleneck === 'plates') tips.push(`You ran out of clean plates at ${name}. A dishwasher or a dish machine would help.`);
  }
  if (pnl.sales > 0) {
    const fc = (pnl.ingredients + pnl.waste) / pnl.sales;
    if (fc > 0.38) tips.push(`Ingredients were ${Math.round(fc * 100)}% of sales. Cheaper tiers or higher prices would protect your margin.`);
  }
  if (a.room.crowdedTables > 0) tips.push(`${a.room.crowdedTables} table(s) are squeezed with no space beside them, which lowers ambience.`);
  const worst = [...segs].sort((x, y) => x.scores.value - y.scores.value)[0];
  if (worst && worst.served > 3 && worst.scores.value < 0.3) tips.push(`${SEGMENTS[worst.segment].name} found your prices steep.`);
  return tips.slice(0, 3);
}
