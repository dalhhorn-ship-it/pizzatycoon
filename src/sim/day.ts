// The aggregate day model (ADR-002). This is the only authority on guests, money and reputation.
// Formulas: 01-product/prd.md 5.7, 5.10, 5.11 and balance.md 1.4, 1.8, 1.12.

import { PREMISES } from '../data/districts';
import { FIRE_SAFETY } from '../data/fireSafety';
import { ROOM_TOUCHES } from '../data/roomTouches';
import { isMain, WINE_IDS } from '../data/recipes';
import { SEGMENTS, SEGMENT_IDS } from '../data/segments';
import type { DishKind, SegmentId, Service } from '../data/types';
import { T } from '../data/tunables';
import { type Analysis, type DishStats, clamp, kitchenStats, tasteMatch } from './analysis';
import { economyOf } from './economy';
import { stateLocation } from './location';
import { Rng } from './rng';
import { hasTalent, onRota } from './staff';
import { awarenessGain, discountFor, hasLoyalty, mktDelivery, mktFor, runSpendToday } from './marketing';
import { audienceOf, catchment, dealTerms, deliveryCompetition, type DeliveryInput, deliveryLive, deliveryMinutes, deliveryReachMult, nextAudience, packingOf, ridersToday, rivalDeliveryOrders, settleDelivery } from './delivery';
import { playerCompetition } from './rivals';
import { followingDemand, nextFollowing, queueDelay, valueScore } from './formulas';

// Moved to formulas.ts (no import cycles, TD5); re-exported for existing callers.
export { followingDemand, followingTarget, nextFollowing, queueDelay, valueScore } from './formulas';
import { type DayReport, type DeliveryDay, floorOf, type GameState, type MarketDay, type PnL, profitOf, type Recipe, type Review, type SegmentReport, type ServiceReport } from './state';

export interface DayOptions {
  /** Daily randomness on demand (plus or minus a few percent). Off for balance tests. */
  noise: boolean;
  /** Live rivals count (default). False runs the day as if no live rival existed: guests lost (competition.md 7.4). */
  live?: boolean;
}

const SERVICES: Service[] = ['lunch', 'dinner'];
type SideKind = Exclude<DishKind, 'pizza' | 'primo' | 'secondo'>;
const SIDE_KINDS: SideKind[] = ['drink', 'starter', 'dessert', 'aperitivo', 'digestivo'];
/** Bar courses whose attach depends on the segment and on lunch or dinner (balance.md 4.7). */
const BAR_COURSES = ['aperitivo', 'digestivo'] as const;

interface Choice {
  probs: { recipe: Recipe; stats: DishStats; p: number }[];
  avgPrice: number;
  avgFair: number;
  avgCost: number;
  avgQuality: number;
  avgTaste: number;
  wasteCost: number;
  /** Share of plates that go through the pizza oven. */
  ovenShare: number;
  /** Average prep work per plate relative to a simple pizza. */
  avgWork: number;
}


export function attachRate(kind: SideKind, ambience: number): number {
  const a = T.attach[kind];
  return a.base + a.bonus * clamp((ambience - a.pivot) / a.span, 0, 1);
}


/** How good the wine list is, 0..1 (balance.md 4.9): its length beyond the house wine and the quality of what is on it. */
export function wineListScore(wines: readonly Recipe[], a: Analysis): number {
  if (wines.length < 2) return 0;
  const avgQ = wines.reduce((x, r) => x + (a.dishes[r.id]?.quality ?? 60), 0) / wines.length;
  const breadth = (wines.length - 1) / T.attach.wineListFull;
  return clamp(breadth * clamp(avgQ / 60, 0.7, 1.3), 0, 1);
}

/** Logit dish choice for one segment among dishes of one kind (prd.md 5.7 "Dish choice"). */
export function chooseDishes(recipes: Recipe[], a: Analysis, segment: SegmentId, wealth?: number, budgetShare = 1): Choice | null {
  if (!recipes.length) return null;
  const seg = SEGMENTS[segment];
  // With a district's wealth, guests steer away from dishes well beyond their budget (a student skips the ossobuco).
  const budget = wealth === undefined ? Infinity : seg.budget * wealth * budgetShare;
  const appeals = recipes.map((r) => {
    const st = a.dishes[r.id] as DishStats;
    const value = valueScore(r.price / st.fairPrice, seg.elasticity);
    const overBudget = Math.max(0, r.price / budget - T.demand.budgetChoiceSlack);
    return (seg.qualityWeight * st.quality) / 100 + 0.4 * tasteMatch(st.tags, segment) + 0.3 * value - T.demand.budgetChoiceAversion * overBudget;
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
    ovenShare: avg((x) => (x.recipe.kind === 'pizza' ? 1 : 0)),
    avgWork: avg((x) => x.stats.work),
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
  if (a.room.tables === 0 && a.room.standing === 0) return 'There are no tables in the dining room.';
  if (a.kitchen.ovens === 0) return 'The kitchen has no oven.';
  if (a.kitchen.counters === 0) return 'The kitchen has no prep station.';
  if (!a.kitchen.hasCold) return 'The kitchen needs a fridge to keep the dough cold.';
  if (!a.kitchen.hasSink) return 'The kitchen needs a sink.';
  if (a.kitchen.kitchenStaff === 0) return 'Nobody is working in the kitchen. Hire a cook.';
  if (a.service.servers === 0) return 'Nobody is serving tables. Hire a server.';
  return null;
}

const WINE_PRAISE: readonly string[] = [
  'The wine list is a real treat.', 'They found us the perfect Chianti.', 'A glass of Barolo made the evening.',
  'Lovely little wine list for a pizzeria.',
];

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
  const district = stateLocation(state);
  const weekday = (state.day - 1) % 7;
  const reason = closedReason(state, a);
  const rng = Rng.stream(state.seed, state.day, 'day');
  const pnlBase = fixedCosts(state, a, 0);
  if (reason) {
    return {
      day: state.day, weekday, open: false, closedReason: reason, covers: 0, walkAways: 0, services: [], segments: [],
      dishSales: {}, satisfaction: 0, reviews: [], repBefore: state.rep, repAfter: state.rep, pnl: pnlBase,
      followingBefore: state.following, followingAfter: state.following * (1 - T.following.closedDecay), followingTarget: 0,
      cashBefore: state.cash, cashAfter: state.cash, weeklyPayments: 0, tips: [reason],
    };
  }

  const onMenu = state.recipes.filter((r) => r.onMenu);
  const mains = onMenu.filter((r) => isMain(r.kind));
  const sidesByKind = Object.fromEntries(SIDE_KINDS.map((k) => [k, onMenu.filter((r) => r.kind === k)])) as Record<
    (typeof SIDE_KINDS)[number],
    Recipe[]
  >;
  const ambience = a.room.ambience;
  const attach = Object.fromEntries(SIDE_KINDS.map((k) => [k, sidesByKind[k].length ? attachRate(k, ambience) : 0])) as Record<SideKind, number>;
  // How the room runs (floor-service.md): at the counter nobody suggests a starter or a digestivo.
  const floor = floorOf(state);
  const F = T.floor;
  if (floor.style === 'counter') {
    attach.starter *= F.counterSideAttach;
    attach.dessert *= F.counterSideAttach;
    attach.aperitivo *= F.counterBarAttach;
    attach.digestivo *= F.counterBarAttach;
  }
  const bookingDemand = floor.bookings === 'reservations' ? F.reservationsDemand : floor.bookings === 'walkIn' ? F.walkInDemand : null;
  const tableFit = T.service.partySizeFit + (floor.bookings === 'reservations' ? F.reservationsTableFit : floor.bookings === 'walkIn' ? F.walkInTableFit : 0);
  const queueShareMult = floor.bookings === 'reservations' ? F.reservationsQueueShare : floor.bookings === 'walkIn' ? F.walkInQueueShare : 1;
  const walkAwayMult = floor.bookings === 'reservations' ? F.reservationsWalkAway : 1;
  const mealMult = floor.style === 'counter' ? F.counterMealMult : 1;
  // A wider wine list: more guests order a second glass (balance.md 4.7).
  const wineList = sidesByKind.drink.filter((r) => WINE_IDS.has(r.id));
  attach.drink *= 1 + Math.min(T.attach.wineListCap, T.attach.wineListPerWine * Math.max(0, wineList.length - 1));
  // Servers who took Sommelier Basics sell more wine (staff-management.md 3.3).
  if (wineList.length) attach.drink *= 1 + Math.min(T.training.sommelierCap, T.training.sommelierWine * (a.sommeliers ?? 0));
  const wine = wineListScore(wineList, a);
  const kitchenBy = { lunch: kitchenStats(state, 'lunch', a.pressure?.lunch), dinner: kitchenStats(state, 'dinner', a.pressure?.dinner) };
  const sideLoad = T.kitchen.prepLoadFactor * (attach.starter + attach.dessert);

  const crew = onRota(state.staff, state.day);
  const crowdPleaser = crew.some((s) => hasTalent(s, 'crowdPleaser'));
  const chefFame = crew.filter((s) => s.role === 'chef').reduce((x, s) => x + s.fame, 0);
  const repMult = T.demand.repMultBase + T.demand.repMultSlope * state.rep;
  const weekdayMult = T.time.weekdayMult[weekday] ?? 1;
  const followMult = followingDemand(state.following);

  // ---- Demand per segment and service ----
  interface SegCalc {
    id: SegmentId;
    choice: Choice;
    sides: Record<string, Choice | null>;
    /** Side orders per guest by kind, for this segment. */
    sideAttach: Record<SideKind, number>;
    /** Extra minutes at the table from aperitivi and digestivi. */
    extraMeal: Record<Service, number>;
    r: number;
    demand: Record<Service, number>;
    check: number;
    costPerCover: number;
    wastePerCover: number;
  }
  const segs: SegCalc[] = [];
  // Every segment's pull first (competition.md 2.2), then the competition it meets, then demand.
  const campaigns = state.campaigns;
  const pull: Record<SegmentId, number> = Object.fromEntries(SEGMENT_IDS.map((id) => [id, 0])) as Record<SegmentId, number>;
  const segPre: { id: SegmentId; choice: Choice; r: number; fit: number; priceMult: number; budgetMult: number; qualityMult: number; speedMult: number; discount: number }[] = [];
  for (const id of SEGMENT_IDS) {
    const seg = SEGMENTS[id];
    const choice = chooseDishes(mains, a, id, district.wealth);
    if (!choice) continue;
    // A student deal lowers what students pay for mains: value and price appeal rise, sales fall (competition.md 5.3).
    const discount = discountFor(campaigns, id, state.day);
    const r = (choice.avgPrice * (1 - discount)) / choice.avgFair;
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
    const speedA = seg.speedAppealAtLunch ? district.lunchShare * speedMult + (1 - district.lunchShare) : 1;
    pull[id] = (district.venue?.trafficMult ?? 1) * district.visibility * repMult * fit * priceMult * budgetMult * qualityMult * speedA * followMult * mktFor(campaigns, id, state.day);
    segPre.push({ id, choice, r, fit, priceMult, budgetMult, qualityMult, speedMult, discount });
  }
  const competition = playerCompetition(state, district, pull, opts.live !== false);
  for (const { id, choice, r, fit, priceMult, budgetMult, qualityMult, speedMult, discount } of segPre) {
    const cEff = competition.cEff[id];
    const fameMult = id === 'foodies' ? 1 + T.demand.chefFameFoodieBonus * chefFame : 1;
    const noise = opts.noise ? clamp(1 + 0.06 * rng.normal(), 0.8, 1.2) : 1;
    const base =
      district.footTraffic * district.visibility * district.shares[id] * T.demand.captureBase * repMult * weekdayMult *
      fit * priceMult * budgetMult * qualityMult * fameMult * followMult * (1 + (T.attach.wineDemand[id] ?? 0) * wine) * (1 - T.demand.competitionFactor * cEff) * noise * economyOf(state).demand *
      (bookingDemand?.[id] ?? 1);
    const sides: Record<string, Choice | null> = {};
    const demandBy = {
      lunch: base * district.lunchShare * speedMult * mktFor(campaigns, id, state.day, 'lunch'),
      dinner: base * (1 - district.lunchShare) * mktFor(campaigns, id, state.day, 'dinner'),
    };
    const dinnerFrac = demandBy.lunch + demandBy.dinner > 0 ? demandBy.dinner / (demandBy.lunch + demandBy.dinner) : 1;
    const affinity = T.attach.barAffinity[id] ?? 1;
    const sideAttach = { ...attach };
    for (const k of BAR_COURSES) sideAttach[k] = attach[k] * affinity * (dinnerFrac + (1 - dinnerFrac) * T.attach.barLunch);
    const barMinutes = (sv: Service): number => {
      const f = affinity * (sv === 'lunch' ? T.attach.barLunch : 1);
      return f * (attach.aperitivo * T.attach.aperitivoMinutes + attach.digestivo * T.attach.digestivoMinutes);
    };
    let check = choice.avgPrice * (1 - discount);
    let cost = choice.avgCost;
    let waste = choice.wasteCost;
    for (const k of SIDE_KINDS) {
      const bar = k === 'drink' || k === 'aperitivo' || k === 'digestivo';
      const c = chooseDishes(sidesByKind[k], a, id, bar ? district.wealth : undefined, T.attach.barBudgetShare);
      sides[k] = c;
      if (!c) continue;
      check += sideAttach[k] * c.avgPrice;
      cost += sideAttach[k] * c.avgCost;
      waste += sideAttach[k] * c.wasteCost;
    }
    segs.push({
      id, choice, sides, sideAttach, extraMeal: { lunch: barMinutes('lunch'), dinner: barMinutes('dinner') }, r,
      demand: demandBy,
      check, costPerCover: cost, wastePerCover: waste,
    });
  }

  // ---- Delivery orders wanted (competition.md 6.3) ----
  const dlv = deliveryLive(state) ? state.delivery ?? null : null;
  const riders = dlv ? ridersToday(state) : null;
  const dt = T.delivery;
  const dWanted: Record<Service, number> = { lunch: 0, dinner: 0 };
  const dAccepted: Record<Service, number> = { lunch: 0, dinner: 0 };
  const dDelivered: Record<Service, number> = { lunch: 0, dinner: 0 };
  const dTime: Record<Service, number> = { lunch: 0, dinner: 0 };
  // One average order per service: a lunch deal changes only the lunch basket.
  const dBasket: Record<Service, { orderValue: number; foodPerOrder: number; mains: number; given: number; feeWaived: boolean; segs: { id: SegmentId; w: number; rD: number; choice: Choice }[] }> = {
    lunch: { orderValue: 0, foodPerOrder: 0, mains: dt.mainsPerOrder, given: 0, feeWaived: false, segs: [] },
    dinner: { orderValue: 0, foodPerOrder: 0, mains: dt.mainsPerOrder, given: 0, feeWaived: false, segs: [] },
  };
  if (dlv && riders) {
    const markup = dlv.markup;
    const soft = onMenu.filter((r) => r.id === 'softDrink');
    const base = catchment(district.district.id, district.footTraffic) * dt.orderRate * deliveryReachMult(dlv, state.day) * weekdayMult *
      mktDelivery(campaigns, state.day, district.shares) * (1 - 0.5 * deliveryCompetition(state, district.district.id, dlv.drep)) * economyOf(state).demand;
    for (const sv of SERVICES) {
      const deal = dealTerms(dlv, sv);
      const b = dBasket[sv];
      b.mains = dt.mainsPerOrder + deal.extraMains;
      b.feeWaived = deal.feeWaived;
      const drinks = dt.drinksPerOrder + deal.extraDrinks;
      const desserts = dt.dessertsPerOrder + deal.extraDesserts;
      let sum = 0;
      for (const p of segPre) {
        const seg = SEGMENTS[p.id];
        // Guests judge the price they pay for a main: the app markup, less the deal.
        const unit = p.choice.avgPrice * (1 + markup) * (1 - deal.mainsDiscount);
        const rD = unit / p.choice.avgFair;
        const priceMult = clamp(Math.pow(rD, -seg.elasticity), T.demand.priceMultMin, T.demand.priceMultMax);
        const budgetMult = clamp(Math.pow((seg.budget * district.wealth) / unit, T.demand.budgetExponent), T.demand.budgetMultMin, T.demand.budgetMultMax);
        const w = district.shares[p.id] * (dt.affinity[p.id] ?? 1) * priceMult * budgetMult * p.qualityMult;
        if (w <= 0) continue;
        sum += w;
        b.segs.push({ id: p.id, w, rD, choice: p.choice });
        const drink = chooseDishes(soft, a, p.id);
        const dessert = segs.find((x) => x.id === p.id)?.sides.dessert ?? null;
        const mainsFull = b.mains * p.choice.avgPrice * (1 + markup);
        const sidesFull = drinks * (drink?.avgPrice ?? 0) + desserts * (dessert?.avgPrice ?? 0);
        const given = mainsFull * deal.mainsDiscount + sidesFull * deal.sidesDiscount;
        b.orderValue += w * (mainsFull + sidesFull - given);
        b.given += w * given;
        b.foodPerOrder += w * (b.mains * p.choice.avgCost + drinks * (drink?.avgCost ?? 0) + desserts * (dessert?.avgCost ?? 0));
      }
      if (sum > 0) {
        b.orderValue /= sum;
        b.given /= sum;
        b.foodPerOrder /= sum;
        dWanted[sv] = base * sum * (1 + deal.orderLift) * (sv === 'lunch' ? dt.lunchShare : 1 - dt.lunchShare);
      }
    }
  }

  // ---- Capacity and service per sitting ----
  const services: ServiceReport[] = [];
  const served = {} as Record<SegmentId, Record<Service, number>>;
  const perceivedWait: Record<Service, number> = { lunch: 0, dinner: 0 };
  const ticket: Record<Service, number> = { lunch: 0, dinner: 0 };
  const queueBy: Record<Service, number> = { lunch: 0, dinner: 0 };
  let totalWalk = 0;
  let impatient = 0;
  // Stage capacities per service before cold storage (kitchen-bottlenecks.md).
  const stations = kitchenBy.dinner.stations;
  const stageOf = (sv: Service) => {
    const hours = sv === 'lunch' ? T.time.lunchHours : T.time.dinnerHours;
    const demand = segs.reduce((x, s) => x + s.demand[sv], 0);
    const meal = mealMult * (demand > 0 ? segs.reduce((x, s) => x + s.demand[sv] * (SEGMENTS[s.id].mealLength[sv] + s.extraMeal[sv]), 0) / demand : 45);
    const cycle = a.service.serviceTime[sv] + meal;
    // Standing places (floor-service.md 3): no seating, half the meal, but only for guests happy to stand.
    const standCycle = a.service.serviceTime[sv] - a.service.seatTime + meal * F.standingMealMult;
    const standWilling = segs.reduce((x, s) => x + s.demand[sv] * (F.standingAffinity[sv]?.[s.id] ?? 0), 0) / (hours * T.service.utilisation[sv]);
    const standPerHour = a.room.standing > 0 ? Math.min((a.room.standing * F.standingFit * 60) / standCycle, standWilling) : 0;
    const tablePerHour = (a.room.seats * tableFit * 60) / cycle + standPerHour;
    // Each server looks after a limited number of guests a service (35 at Speed 50, up to 50): the front of house is the lower of the two.
    const serverPerHour = a.service.serverGuests[sv] / (hours * T.service.utilisation[sv]);
    const seatPerHour = Math.min(tablePerHour, serverPerHour);
    const k = kitchenBy[sv];
    // Pasta and secondi skip the oven but ask more of the prep line (menu complexity, balance.md 4.2).
    const mix = (f: (s: SegCalc) => number, fallback: number): number =>
      demand > 0 ? segs.reduce((x, s) => x + s.demand[sv] * f(s), 0) / demand : fallback;
    const ovenShare = mix((s) => s.choice.ovenShare, 1);
    const prepLoad = mix((s) => s.choice.avgWork, 1) + sideLoad;
    const prepPerHour = k.prepPerHour / prepLoad;
    const ovenCoversPerHour = ovenShare > 0 ? k.ovenPerHour / ovenShare : Infinity;
    const plateCap = (a.service.platesPerHour / T.kitchen.platesPerCover) * hours + stations.plateStock / T.kitchen.platesPerCover;
    // Each cook or chef cooks for a limited number of guests a service (50 at Speed 50, up to 75), whatever the stations could do.
    const cookPerHour = k.cookGuests / (hours * T.service.utilisation[sv]);
    const pre = Math.min(Math.min(ovenCoversPerHour, prepPerHour, seatPerHour, cookPerHour) * hours * T.service.utilisation[sv], plateCap);
    return { hours, demand, cycle, seatPerHour, serverPerHour, tablePerHour, k, ovenShare, prepPerHour, ovenCoversPerHour, cookPerHour, plateCap, pizzas: Math.min(demand, pre) * ovenShare, pizzaCap: pre * ovenShare };
  };
  const pre = { lunch: stageOf('lunch'), dinner: stageOf('dinner') };
  // Dough for the day: the fridges hold stations.coldCap pizzas, shared between services as they would be sold.
  const pizzasWanted = pre.lunch.pizzas + pre.dinner.pizzas;
  for (const sv of SERVICES) {
    const { hours, demand, cycle, seatPerHour, serverPerHour, tablePerHour, k, ovenShare, prepPerHour, ovenCoversPerHour, cookPerHour, plateCap } = pre[sv];
    const coldPizzas = pizzasWanted > 0 ? (stations.coldCap * pre[sv].pizzas) / pizzasWanted : stations.coldCap / 2;
    const coldPerHour = ovenShare > 0 ? coldPizzas / ovenShare / (hours * T.service.utilisation[sv]) : Infinity;
    // For the pipeline: the day's dough spread over the services as the rest of the line could sell it.
    const capWanted = pre.lunch.pizzaCap + pre.dinner.pizzaCap;
    const coldStage = ovenShare > 0 && capWanted > 0 ? (stations.coldCap * pre[sv].pizzaCap) / capWanted / ovenShare / (hours * T.service.utilisation[sv]) : 999;
    const kitchenPerHour = Math.min(ovenCoversPerHour, prepPerHour, coldPerHour, cookPerHour);
    // One kitchen, two front doors (competition.md 6.4): the app gets what the throttle leaves, and an overloaded line is shared.
    const U = T.service.utilisation[sv];
    let kitchenForDine = kitchenPerHour;
    let dServedPH = 0;
    if (dlv && dWanted[sv] > 0) {
      const perOrder = dBasket[sv].mains * dt.work;
      const need = (dWanted[sv] / (hours * U)) * perOrder;
      const dineNeed = Math.min(demand / (hours * U), seatPerHour);
      const ridersOk = dlv.mode === 'platform' || (riders?.onShift ?? 0) > 0;
      const allow = !ridersOk ? 0 : dlv.throttle === null ? need : Math.max(0, Math.min(need, dlv.throttle * kitchenPerHour - dineNeed));
      const total = dineNeed + allow;
      if (total <= kitchenPerHour) dServedPH = allow;
      else {
        const share = kitchenPerHour / total;
        kitchenForDine = dineNeed * share;
        dServedPH = allow * share;
      }
      dAccepted[sv] = (allow * hours * U) / perOrder;
      dDelivered[sv] = (dServedPH * hours * U) / perOrder;
    }
    const perHour = Math.min(kitchenForDine, seatPerHour);
    const serviceCap = perHour * hours * T.service.utilisation[sv];
    const capacity = Math.min(serviceCap, plateCap);
    const rho = capacity > 0 ? demand / capacity : 99;
    const q = queueDelay(rho);
    queueBy[sv] = q;
    const servedTotal = Math.min(demand, capacity);
    const fill = demand > 0 ? servedTotal / demand : 0;
    let bottleneck: ServiceReport['bottleneck'] = 'none';
    if (rho >= 0.85) {
      if (plateCap < serviceCap) bottleneck = 'plates';
      else if (seatPerHour <= kitchenPerHour) bottleneck = serverPerHour < tablePerHour ? 'servers' : 'seats';
      else if (cookPerHour <= Math.min(ovenCoversPerHour, prepPerHour, coldPerHour)) bottleneck = 'cooks';
      else if (coldPerHour <= Math.min(ovenCoversPerHour, prepPerHour)) bottleneck = 'cold';
      else bottleneck = ovenCoversPerHour <= prepPerHour ? 'oven' : 'prep';
    }
    let walk = demand - servedTotal;
    const share = T.service.perceivedQueueShare[sv] * queueShareMult;
    for (const s of segs) {
      const tol = SEGMENTS[s.id].waitTolerance[sv];
      const pq = q * share;
      const limit = T.service.walkAwayThreshold * tol;
      const leaveFrac = walkAwayMult * (pq > limit ? Math.min(0.5, (pq - limit) / limit) : 0);
      const got = s.demand[sv] * fill;
      const stays = got * (1 - leaveFrac);
      walk += got - stays;
      impatient += got - stays;
      (served[s.id] ??= { lunch: 0, dinner: 0 })[sv] = stays;
    }
    perceivedWait[sv] = a.service.orderTime[sv] + a.service.serveTime[sv] + q * share;
    // A kitchen running near capacity queues tickets: more or faster stations mean hotter food, sooner.
    const servedPerHour = servedTotal / (hours * T.service.utilisation[sv]);
    // Running out of dough turns guests away; it does not queue tickets on the line.
    const line = Math.min(ovenCoversPerHour, prepPerHour);
    const kitchenRho = line > 0 ? (servedPerHour + dServedPH) / line : 1;
    ticket[sv] = k.cookTime + T.satisfaction.ticketQueueShare * queueDelay(Math.min(kitchenRho, T.service.queueRhoCap));
    if (dlv && riders && dDelivered[sv] > 0) dTime[sv] = deliveryMinutes(k.cookTime, kitchenRho, dDelivered[sv] / (hours * U), riders, dlv.mode, packingOf(state)?.effectMult ?? 1);
    totalWalk += walk;
    const servedAfter = segs.reduce((x, s) => x + (served[s.id]?.[sv] ?? 0), 0);
    services.push({
      service: sv, demand, served: servedAfter, walkAways: walk, capacity, rho, queueDelay: q, bottleneck, tableCycle: cycle, ticketTime: ticket[sv],
      // Plates are expressed per effective service hour so every stage compares on the same basis as seats and ovens.
      stages: {
        prep: prepPerHour, oven: Number.isFinite(ovenCoversPerHour) ? ovenCoversPerHour : k.ovenPerHour, seats: seatPerHour, plates: plateCap / (hours * T.service.utilisation[sv]),
        cold: Number.isFinite(coldStage) ? coldStage : 999,
        cooks: cookPerHour,
        ...(dlv ? { delivery: dServedPH / dt.work } : {}),
      },
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
  const foodBy: Partial<Record<SegmentId, number>> = {};
  for (const s of segs) {
    const seg = SEGMENTS[s.id];
    const n = (served[s.id]?.lunch ?? 0) + (served[s.id]?.dinner ?? 0);
    const food = clamp(
      T.satisfaction.foodQualityShare * (s.choice.avgQuality / 100) + (1 - T.satisfaction.foodQualityShare) * s.choice.avgTaste +
        // Guests who care about quality taste a better kitchen most: foodies more than students.
        T.satisfaction.equipmentFood * Math.max(0, a.kitchen.equipmentE) * (T.satisfaction.equipmentFoodBase + seg.qualityAppeal) +
        T.attach.wineFood * wine * (T.satisfaction.equipmentFoodBase + seg.qualityAppeal),
      0,
      1,
    );
    foodBy[s.id] = food;
    const value = valueScore(s.r, seg.elasticity);
    let wait = 0;
    for (const sv of SERVICES) {
      const tol = seg.waitTolerance[sv];
      const table = clamp(1 - Math.max(0, perceivedWait[sv] - tol) / tol, 0, 1);
      const kitchen = clamp(1 - Math.max(0, ticket[sv] - T.satisfaction.ticketFree) / T.satisfaction.ticketSpan, 0, 1);
      const ws = (1 - T.satisfaction.ticketShare) * table + T.satisfaction.ticketShare * kitchen;
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
      for (const p of c.probs) dishSales[p.recipe.id] = (dishSales[p.recipe.id] ?? 0) + n * s.sideAttach[k] * p.p;
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
      const winePraise = wine > 0 && s >= 60 && rng.chance(wine * 0.5) ? ` ${rng.pick(WINE_PRAISE)}` : '';
      const text = (s >= 85 ? `${rng.pick(good)} ${rng.pick(REVIEW_TEXT.food?.high ?? good)}` : s < 40 ? `${rng.pick(bad)}` : `${rng.pick(good)} ${rng.pick(bad)}`) + winePraise;
      reviews.push({ segment: sr.segment, stars: clamp(Math.round(1 + (4 * s) / 100), 1, 5), text });
    }
  }
  let rep = state.rep;
  if (parties * T.satisfaction.reviewProbability >= 0.5) {
    const reviewScore = reviewScoreWeighted / parties;
    rep += Math.min(1, T.reputation.learningRate * economyOf(state).reputation) * (reviewScore - rep);
  }
  // Only guests who gave up waiting hurt reputation; a full house turning people away at the door does not.
  const arrivals = covers + impatient;
  if (arrivals > 0 && impatient / arrivals > T.reputation.walkAwayThreshold) rep -= T.reputation.walkAwayPenalty;
  const fame = Math.min(T.staff.fameRepCap, state.staff.reduce((x, s) => x + s.fame, 0) * T.staff.fameRepPerWeek);
  rep = clamp(rep + fame / 7, 0, 100);

  // Loyalty cards keep regulars (following falls half as fast, target +0.05); campaigns spread the word (competition.md 5.3).
  const loyal = hasLoyalty(campaigns, state.day);
  const follow = nextFollowing(state.following, satisfaction, covers, impatient, loyal);
  follow.after = clamp(follow.after + awarenessGain(campaigns, state.day, follow.after, district.shares), 0, 1);
  // Foodie press night: the critics come on the first night of the run.
  const press = (campaigns ?? []).find((c) => c.id === 'foodiePress' && c.startDay === state.day);
  if (press) {
    const foodies = segmentReports.find((x) => x.segment === 'foodies');
    if (foodies && foodies.satisfaction >= 65) rep = clamp(rep + 2, 0, 100);
    else if (foodies && foodies.satisfaction < 50) rep = clamp(rep - 1, 0, 100);
  }

  const pnl = fixedCosts(state, a, covers);
  pnl.sales = sales;
  pnl.ingredients = ingredients;
  pnl.waste = waste * a.kitchen.wasteMult;
  if (loyal) pnl.marketing = (pnl.marketing ?? 0) + T.marketing.loyaltyShare * sales;
  const runs = runSpendToday(campaigns, state.day);
  if (runs > 0) {
    pnl.marketing = (pnl.marketing ?? 0) + runs;
    pnl.marketingPrepaid = runs;
  }
  let delivery: DeliveryDay | undefined;
  if (dlv && riders) {
    const basketOut = (sv: Service): DeliveryInput['basket'][Service] => {
      const b = dBasket[sv];
      return { ...b, segs: b.segs.map((x) => ({ id: x.id, w: x.w, rD: x.rD, food: foodBy[x.id] ?? 0.5, probs: x.choice.probs.map((p) => ({ id: p.recipe.id, p: p.p })) })) };
    };
    const settled = settleDelivery({
      d: dlv, riders, staff: state.staff, economy: economyOf(state),
      basket: { lunch: basketOut('lunch'), dinner: basketOut('dinner') },
      wanted: dWanted, accepted: dAccepted, delivered: dDelivered, time: dTime, covers,
      packingFood: packingOf(state)?.deliveryFood ?? 0, rivalOrders: rivalDeliveryOrders(state, district.district.id),
    });
    pnl.deliverySales = settled.deliverySales;
    pnl.ingredients += settled.foodCost;
    pnl.deliveryCosts = settled.deliveryCosts;
    for (const [id, n] of Object.entries(settled.dishSales)) dishSales[id] = (dishSales[id] ?? 0) + n;
    // The delivery audience grows slowly by word of mouth and fast with delivery campaigns (6.13).
    const aud = nextAudience(dlv, mktDelivery(campaigns, state.day, district.shares) - 1, settled.day.delivered);
    delivery = { ...settled.day, audienceBefore: audienceOf(dlv), audienceAfter: aud.after, audienceOrganic: aud.organic, audienceCampaigns: aud.campaigns };
  }
  // Card fees, cleaning, linen and supplies grow with dining sales; delivery has its own cost lines and the app takes payment.
  pnl.utilities += T.finance.runningShare * pnl.sales;
  pnl.profit = profitOf(pnl);
  const market: MarketDay = {
    cEff: competition.cEff, A: pull,
    served: Object.fromEntries(SEGMENT_IDS.map((id) => [id, segmentReports.find((x) => x.segment === id)?.served ?? 0])) as Record<SegmentId, number>,
    lost: Object.fromEntries(SEGMENT_IDS.map((id) => [id, 0])) as Record<SegmentId, number>, lostByRival: {},
  };

  return {
    day: state.day, weekday, open: true, closedReason: null, covers, walkAways: totalWalk, services, segments: segmentReports,
    dishSales, satisfaction, reviews, repBefore: state.rep, repAfter: rep, pnl,
    followingBefore: state.following, followingAfter: follow.after, followingTarget: follow.target,
    cashBefore: state.cash, cashAfter: state.cash, weeklyPayments: 0,
    tips: [...deliveryTip(delivery, services), ...followingTip(follow.after, follow.target, services), ...tipsFor(services, a, pnl, segmentReports)].slice(0, 3),
    market,
    ...(delivery ? { delivery } : {}),
  };

}

/** A line for the advisor when deliveries run late or cannot go out (competition.md 6.6). */
function deliveryTip(d: DeliveryDay | undefined, services: ServiceReport[]): string[] {
  if (!d) return [];
  if (d.wanted > 1 && d.accepted < 0.5) return ['Delivery orders came in but nobody could take them out: put riders with a vehicle on the rota, or switch to the Scoot riders.'];
  const late = (['dinner', 'lunch'] as const).find((sv) => d.time[sv] > T.delivery.promise + 5);
  if (!late) return [];
  const rho = services.find((s) => s.service === late)?.rho ?? 0;
  return [`Deliveries took ${Math.round(d.time[late])} minutes at ${late}: your kitchen was at ${Math.round(Math.min(1, rho) * 100)}%. A lower throttle or more kitchen keeps them under ${T.delivery.promise}.`];
}




function fixedCosts(state: GameState, a: Analysis, covers: number): PnL {
  const staff = a.weeklySalaries / 7;
  const rent = a.weeklyRent / 7;
  const premises = PREMISES[state.premisesId];
  const tiles = premises ? premises.diningWidth * premises.diningHeight + premises.kitchenTiles : 0;
  // Utilities plus the fixed running costs (insurance, licences, accounting, repairs); the share of sales is added once sales are known.
  const utilities = T.finance.utilitiesBase + T.finance.utilitiesPerCover * covers + (T.finance.runningPerTileWeek * tiles) / 7;
  const fireUpkeep = (state.fireSafety ?? []).reduce((x, id) => x + (FIRE_SAFETY[id]?.upkeep ?? 0), 0) +
    (state.roomTouches ?? []).reduce((x, id) => x + (ROOM_TOUCHES[id]?.upkeep ?? 0), 0);
  const upkeep = T.finance.upkeepBase + (a.kitchen.maintenancePerWeek + fireUpkeep) / 7;
  const interest = (state.loan.balance * state.loan.annualRate) / 52 / 7;
  const profit = -(staff + rent + utilities + upkeep + interest);
  return { sales: 0, ingredients: 0, waste: 0, staff, rent, utilities, upkeep, interest, profit };
}

function followingTip(following: number, target: number, services: ServiceReport[]): string[] {
  const quiet = services.every((s) => s.rho < 0.8);
  if (following >= 0.6 || !quiet) return [];
  if (target <= following + 0.02) {
    return [`Only ${Math.round(following * 100)}% of locals know you, and today's guests were not happy enough to spread the word. Better food, fair prices or shorter waits would get people talking.`];
  }
  return [`Word is still getting around: ${Math.round(following * 100)}% of locals know you. Every happy guest brings friends; quiet first weeks are normal.`];
}

function tipsFor(services: ServiceReport[], a: Analysis, pnl: PnL, segs: SegmentReport[]): string[] {
  const tips: string[] = [];
  for (const s of services) {
    const pct = Math.round(Math.min(1, s.rho) * 100);
    const name = s.service === 'lunch' ? 'lunch' : 'dinner';
    if (s.bottleneck === 'seats') tips.push(`Seats were full ${pct}% of ${name}. More tables, a host (faster seating), standing places for quick bites or counter service would help.`);
    if (s.bottleneck === 'oven') tips.push(`The oven was the limit at ${name}. A bigger or faster oven would serve more guests.`);
    if (s.bottleneck === 'prep') {
      tips.push(
        a.kitchen.menu.efficiency < 1
          ? `Prep was the limit at ${name}, and the menu is slowing the line to ${Math.round(a.kitchen.menu.efficiency * 100)}%. A shorter menu, shared ingredients or more skilled cooks would help.`
          : `Prep counters were the limit at ${name}. Another counter, a cook or a dough sheeter would help.`,
      );
    }
    if (s.bottleneck === 'plates') tips.push(`You ran out of clean plates at ${name}. A dishwasher, a bigger sink, plate shelving or a dish machine would help.`);
    if (s.bottleneck === 'servers') tips.push(`Your servers were at their limit at ${name}. Another server, or faster ones, would seat more: a server at Speed 50 looks after 35 guests a service, a top server up to 50.`);
    if (s.bottleneck === 'cooks') tips.push(`Your cooks were at their limit at ${name}: ${Math.round(s.served)} guests between them. A cook at Speed 50 handles 50 a service, a top cook up to 75. Another cook, or faster ones, would serve more.`);
    if (s.bottleneck === 'cold') tips.push(`The fridges ran out of dough at ${name}. Another fridge or a walk in cooler would help.`);
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
