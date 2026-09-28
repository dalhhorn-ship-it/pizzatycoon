// Food delivery (competition.md 6): unlock, demand from the catchment, riders, delivery time and DRep.

import { ADJACENT, DISTRICTS } from '../data/districts';
import { DELIVERY_DEALS } from '../data/deliveryDeals';
import { EQUIPMENT } from '../data/equipment';
import type { EquipmentItem } from '../data/types';
import type { Service } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { queueDelay, valueScore } from './formulas';
import { onRota } from './staff';
import type { DealDays, DeliveryDay, DeliveryMode, DeliveryState, DeliveryZone, GameState, MinOrder, Staff, VehicleKind } from './state';
import { activeRivals } from './rivals';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export const MODE_NAMES: Record<DeliveryMode, string> = {
  platform: 'Scoot app, their riders',
  marketplace: 'Scoot app, your riders',
  own: 'Your own ordering page',
};

export const MODE_BLURB: Record<DeliveryMode, string> = {
  platform: 'The app does it all. 30% commission, the app keeps the delivery fee.',
  marketplace: 'Listed on the app, delivered by your riders. 14% commission, you keep the fee.',
  own: 'No commission, but only people who already know you order: 40% of the reach, plus a web shop at $150 a week.',
};

export const ZONE_NAMES: Record<DeliveryZone, string> = { tight: 'Close by', standard: 'Standard', wide: 'Wide' };
export const ZONE_BLURB: Record<DeliveryZone, string> = {
  tight: 'Mostly your own neighbourhood: short rides, hot food, fewer orders.',
  standard: 'Your neighbourhood and half of the ones next to it.',
  wide: 'Deep into the neighbouring districts: more orders, longer rides, colder food.',
};
export const MIN_ORDER_NAMES: Record<MinOrder, string> = { none: 'No minimum', low: 'Low minimum', high: 'High minimum' };
export const DEAL_DAYS_NAMES: Record<DealDays, string> = { all: 'Every day', weekdays: 'Mon to Thu', weekend: 'Fri to Sun' };

export const zoneOf = (d: Pick<DeliveryState, 'zone'> | null | undefined): DeliveryZone => d?.zone ?? 'standard';
export const minOrderOf = (d: Pick<DeliveryState, 'minOrder'> | null | undefined): MinOrder => d?.minOrder ?? 'none';
export const dealDaysOf = (d: Pick<DeliveryState, 'dealDays'> | null | undefined): DealDays => d?.dealDays ?? 'all';

/** The four vehicles (delivery-tab.md 5.3): minutes a ride, orders a trip, price and weekly upkeep. */
export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  ride: number;
  trip: number;
  price: number;
  upkeep: number;
}

export function vehicleSpec(kind: VehicleKind): VehicleSpec {
  const t = T.delivery;
  switch (kind) {
    case 'bike': return { kind, name: 'Bike', ride: t.bikeRide, trip: t.ordersPerTrip, ...t.bike };
    case 'ebike': return { kind, name: 'E-bike', ride: t.ebikeRide, trip: t.ordersPerTrip, ...t.ebike };
    case 'scooter': return { kind, name: 'Scooter', ride: t.scooterRide, trip: t.ordersPerTrip, ...t.scooter };
    case 'car': return { kind, name: 'Delivery car', ride: t.carRide, trip: t.carOrdersPerTrip, ...t.car };
  }
}

export const VEHICLE_KINDS: readonly VehicleKind[] = ['bike', 'ebike', 'scooter', 'car'];

export const vehicleCount = (d: Pick<DeliveryState, 'vehicles'>, kind: VehicleKind): number => d.vehicles[kind] ?? 0;

/** Orders an hour one rider moves with this vehicle, before rider speed. */
export const vehiclePerHour = (v: VehicleSpec): number => (60 / (2 * v.ride + 4)) * v.trip;

/** What is missing before this restaurant can deliver (6.1). */
export function deliveryMissing(state: Pick<GameState, 'rep' | 'daysOpen' | 'equipment'>): string[] {
  const d = T.delivery;
  const out: string[] = [];
  if (state.rep < d.unlockRep) out.push(`reach 3 stars (reputation ${d.unlockRep}); you are at ${state.rep.toFixed(0)}`);
  if (state.daysOpen < d.unlockDays) out.push(`be open ${d.unlockDays} days; ${state.daysOpen} so far`);
  return out;
}

export const deliveryUnlocked = (state: Pick<GameState, 'rep' | 'daysOpen' | 'equipment'>): boolean => deliveryMissing(state).length === 0;

export const hasPacking = (state: Pick<GameState, 'equipment'>): boolean => !!packingOf(state);

/** The best packing station in the kitchen: the heated one keeps food hotter and packs faster. */
export function packingOf(state: Pick<GameState, 'equipment'>): EquipmentItem | undefined {
  return state.equipment.map((e) => EQUIPMENT[e.itemId]).filter((it): it is EquipmentItem => it?.role === 'packing')
    .sort((a, b) => (b.deliveryFood ?? 0) - (a.deliveryFood ?? 0))[0];
}

/** What a delivery deal changes on one service's orders; all zero without a deal (or at dinner for a lunch deal). */
export interface DealTerms {
  mainsDiscount: number;
  sidesDiscount: number;
  extraMains: number;
  extraDrinks: number;
  extraDesserts: number;
  orderLift: number;
  feeWaived: boolean;
}

const NO_DEAL: DealTerms = { mainsDiscount: 0, sidesDiscount: 0, extraMains: 0, extraDrinks: 0, extraDesserts: 0, orderLift: 0, feeWaived: false };

/** Does the deal run on this weekday (Mon = 0)? Without a weekday it always does. */
export function dealRunsOn(d: Pick<DeliveryState, 'dealDays'> | null | undefined, weekday?: number): boolean {
  const days = dealDaysOf(d);
  if (weekday === undefined || days === 'all') return true;
  return days === 'weekdays' ? weekday <= 3 : weekday >= 4;
}

export function dealTerms(d: Pick<DeliveryState, 'deal' | 'dealDays'> | null | undefined, sv: Service, weekday?: number): DealTerms {
  const deal = d?.deal ? DELIVERY_DEALS[d.deal] : undefined;
  if (!deal || (deal.lunchOnly && sv === 'dinner') || !dealRunsOn(d, weekday)) return NO_DEAL;
  return {
    mainsDiscount: deal.mainsDiscount, sidesDiscount: deal.sidesDiscount, extraMains: deal.extraMains, extraDrinks: deal.extraDrinks,
    extraDesserts: deal.extraDesserts, orderLift: deal.orderLift, feeWaived: !!deal.feeWaived,
  };
}

export function newDelivery(day: number, mode: DeliveryMode): DeliveryState {
  const d = T.delivery;
  return {
    on: true, mode, markup: d.markupDefault, packaging: 'basic', throttle: d.throttleDefault, drep: d.startDRep, since: day,
    vehicles: { bike: 0, scooter: 0, ebike: 0, car: 0 }, topRatedDays: 0, topRated: false, deal: null, audience: d.audienceStart,
    zone: 'standard', minOrder: 'none', dealDays: 'all',
  };
}

/** Is delivery taking orders today? */
export const deliveryLive = (state: Pick<GameState, 'delivery' | 'equipment'>): boolean => !!state.delivery?.on && hasPacking(state);

/** People who can order: the district plus a share of the neighbouring ones, half in the standard zone (6.3, delivery-tab.md 5.3). */
export function catchment(districtId: string, footTraffic: number, adjacent: number = T.delivery.adjacentWeight): number {
  return footTraffic + adjacent * (ADJACENT[districtId] ?? []).reduce((x, id) => x + (DISTRICTS[id]?.footTraffic ?? 0), 0);
}

/** Delivery competition (6.3): a background of 0.3 plus rivals that deliver nearby. */
export function deliveryCompetition(state: GameState, districtId: string, drep: number): number {
  let c = T.delivery.background;
  for (const r of activeRivals(state)) {
    for (const l of r.locations) {
      if (!l.delivery) continue;
      const d = VENUES[l.venueId]?.districtId;
      const prox = d === districtId ? 1 : d && (ADJACENT[districtId] ?? []).includes(d) ? 0.5 : 0;
      if (prox) c += 0.1 * prox * clamp(l.drep / Math.max(1, drep), 0.25, 2.5);
    }
  }
  return Math.min(0.9, c);
}

/** Share of the catchment that knows this restaurant delivers (6.13). */
export const audienceOf = (d: Pick<DeliveryState, 'audience'> | null | undefined): number => clamp(d?.audience ?? T.delivery.audienceLegacy, 0, 1);

/** Orders a day multiplier from everything but the menu (6.3, 6.12, 6.13): only the people who know you deliver order. */
export function deliveryReachMult(d: DeliveryState, _day: number): number {
  const t = T.delivery;
  return t.reach[d.mode] * audienceOf(d) * (d.topRated ? t.topRatedBoost : 1) * (T.demand.repMultBase + T.demand.repMultSlope * d.drep);
}

/**
 * The delivery audience after a day (6.13): word of mouth from a good delivery rating grows it slowly, delivery campaigns
 * grow it fast, and it fades a little every day. Growth only fills the part of the catchment that does not know you yet.
 */
export function nextAudience(d: DeliveryState, campaignLift: number, delivered: number): { after: number; organic: number; campaigns: number } {
  const t = T.delivery;
  const a = audienceOf(d);
  const room = 1 - a;
  // Word of mouth needs orders going out: nobody talks about a restaurant they never ordered from.
  const talk = delivered >= 1 ? t.audienceOrganic * (d.drep / 100) * (d.topRated ? t.audienceTopRated : 1) : 0;
  const organic = talk * room;
  const campaigns = ((t.audienceFromLift * campaignLift) / 7) * room;
  const after = clamp(a + organic + campaigns - t.audienceFade * a, 0, 1);
  return { after, organic, campaigns };
}

export interface Riders {
  onShift: number;
  /** Orders per hour the riders can take. */
  capPerHour: number;
  ride: number;
  quality: number;
}

/** The fleet, the vehicle that moves the most orders an hour first (delivery-tab.md 5.3). */
export function fleetOf(d: Pick<DeliveryState, 'vehicles'>): VehicleSpec[] {
  return VEHICLE_KINDS.map(vehicleSpec).sort((a, b) => vehiclePerHour(b) - vehiclePerHour(a))
    .flatMap((v) => Array<VehicleSpec>(vehicleCount(d, v.kind)).fill(v));
}

/**
 * Riders on shift today with a vehicle each, the best vehicles first (6.5, 6.8, delivery-tab.md 6). The ride is the mean of
 * the vehicles in use times the riders' speed and the zone; orders a trip the mean of those vehicles, so bikes and scooters
 * alone give the same numbers as before.
 */
export function ridersToday(state: Pick<GameState, 'staff' | 'day' | 'delivery'>): Riders {
  const d = state.delivery;
  const t = T.delivery;
  const zone = t.zones[zoneOf(d)];
  if (!d || d.mode === 'platform') return { onShift: 0, capPerHour: Infinity, ride: t.platformRide * zone.ride, quality: 50 };
  const riders = onRota(state.staff, state.day).filter((s) => s.role === 'rider').sort((a, b) => b.attrs.speed - a.attrs.speed);
  const vehicles = fleetOf(d);
  const n = Math.min(riders.length, vehicles.length);
  if (!n) return { onShift: 0, capPerHour: 0, ride: t.bikeRide * zone.ride, quality: 50 };
  const used = riders.slice(0, n);
  const inUse = vehicles.slice(0, n);
  const spd = used.reduce((x, s) => x + s.attrs.speed, 0) / n;
  const ride = (inUse.reduce((x, v) => x + v.ride, 0) / n) * (1.15 - 0.003 * spd) * zone.ride;
  const trip = inUse.reduce((x, v) => x + v.trip, 0) / n;
  return { onShift: n, capPerHour: (n * 60 / (2 * ride + 4)) * trip, ride, quality: used.reduce((x, s) => x + s.attrs.quality, 0) / n };
}

/** Riders needed for a peak of this many orders an hour (6.11). */
export function ridersNeeded(peakPerHour: number, ride: number): number {
  const per = (60 / (2 * ride + 4)) * T.delivery.ordersPerTrip;
  return Math.ceil(peakPerHour / (0.8 * per));
}

/** Minutes from order to door (6.5). */
export function deliveryMinutes(cookTime: number, kitchenRho: number, ordersPerHour: number, r: Riders, mode: DeliveryMode, packMult = 1): number {
  const t = T.delivery;
  const ticket = cookTime + queueDelay(Math.min(kitchenRho, T.service.queueRhoCap)) + t.packMinutes * packMult;
  let wait: number = t.platformWait;
  if (mode !== 'platform') {
    const rhoR = r.capPerHour > 0 ? ordersPerHour / r.capPerHour : 9;
    wait = Math.min(40, queueDelay(Math.min(rhoR, T.service.queueRhoCap)) + 30 * Math.max(0, rhoR - 1));
  }
  return ticket + wait + r.ride;
}

export const timeScore = (minutes: number): number => clamp(1 - Math.max(0, minutes - T.delivery.promise) / T.delivery.span, 0, 1);

/** The day's new DRep and Top rated state (6.6, 6.12). */
export function nextDrep(d: DeliveryState, S: number, accepted: number, cancelled: number, wanted: number, refused: number, repRate: number): { drep: number; topRatedDays: number; topRated: boolean } {
  const t = T.delivery;
  let drep = d.drep;
  if (accepted > 0.5) drep += Math.min(1, T.reputation.learningRate * repRate) * (-10 + 1.1 * S - drep);
  if (accepted > 0 && cancelled / accepted > t.cancelThreshold) drep -= t.cancelPenalty;
  if (wanted > 0) drep -= t.refusePenalty * (refused / wanted);
  drep = clamp(drep, 0, 100);
  const topRatedDays = drep >= t.topRatedDrep ? d.topRatedDays + 1 : 0;
  const topRated = drep < t.topRatedLoseBelow ? false : d.topRated || topRatedDays >= t.topRatedDays;
  return { drep, topRatedDays, topRated };
}

/** Carry the day's result into the restaurant's delivery state. */
export function applyDeliveryDay(d: DeliveryState | null | undefined, day: DeliveryDay | undefined): void {
  if (!d || !day) return;
  d.drep = day.drepAfter;
  if (day.audienceAfter !== undefined) d.audience = day.audienceAfter;
  d.topRated = day.topRated;
  d.topRatedDays = day.topRatedDays ?? d.topRatedDays;
}

/** Weekly running costs that are not wages: web shop and vehicles. */
export function deliveryWeeklyCosts(d: DeliveryState): number {
  const t = T.delivery;
  return (d.mode === 'own' ? t.webShopFee : 0) + VEHICLE_KINDS.reduce((x, k) => x + vehicleCount(d, k) * vehicleSpec(k).upkeep, 0);
}

export const riderWages = (staff: readonly Staff[]): number => staff.filter((s) => s.role === 'rider').reduce((x, s) => x + s.salary, 0);

/** One segment's share of the day's delivery orders at one service. */
export interface DeliverySeg {
  id: SegmentId;
  w: number;
  rD: number;
  food: number;
  probs: readonly { id: string; p: number }[];
}

/** An average order at one service. */
export interface Basket {
  orderValue: number;
  foodPerOrder: number;
  mains: number;
  /** Money given away by the deal on an average order (already out of orderValue). */
  given: number;
  feeWaived: boolean;
  segs: readonly DeliverySeg[];
}

/** Everything the day model measured about delivery today (competition.md 6.5 to 6.7). */
export interface DeliveryInput {
  d: DeliveryState;
  riders: Riders;
  staff: readonly Staff[];
  economy: { reputation: number; ingredients: number };
  basket: Record<Service, Basket>;
  wanted: Record<Service, number>;
  accepted: Record<Service, number>;
  delivered: Record<Service, number>;
  time: Record<Service, number>;
  /** Dining guests today, for the kitchen share. */
  covers: number;
  /** Extra hold on the food from a heated packing station. */
  packingFood?: number;
  /** Delivery orders rivals nearby took yesterday, weighted by distance. */
  rivalOrders?: number;
}

export interface DeliverySettlement {
  day: DeliveryDay;
  deliverySales: number;
  foodCost: number;
  deliveryCosts: number;
  /** Mains sent out, by recipe. */
  dishSales: Record<string, number>;
}

const SERVICES = ['lunch', 'dinner'] as const;

/** Delivery money, time and rating for the day. Pure: the day model adds the result to its P&L and dish sales. */
export function settleDelivery(i: DeliveryInput): DeliverySettlement {
  const t = T.delivery;
  const { d } = i;
  const wanted = i.wanted.lunch + i.wanted.dinner;
  const accepted = i.accepted.lunch + i.accepted.dinner;
  const delivered = i.delivered.lunch + i.delivered.dinner;
  // Scores weigh each service by the orders it delivered (or wanted, on a day nothing went out).
  const weightOf = (sv: Service): number => (delivered > 0 ? i.delivered[sv] / delivered : wanted > 0 ? i.wanted[sv] / wanted : sv === 'dinner' ? 1 : 0);
  const segAvg = (sv: Service, f: (s: DeliverySeg) => number): number => {
    const segs = i.basket[sv].segs;
    const sumW = segs.reduce((x, s) => x + s.w, 0);
    return sumW > 0 ? segs.reduce((x, s) => x + s.w * f(s), 0) / sumW : 0;
  };
  const travel = (t.travel + (i.packingFood ?? 0) + (d.mode === 'platform' ? 0 : 0.0006 * (i.riders.quality - 50))) * t.zones[zoneOf(d)].food;
  const pack = d.packaging === 'eco' ? t.ecoPackaging : 1;
  const food = clamp(SERVICES.reduce((x, sv) => x + weightOf(sv) * segAvg(sv, (s) => s.food), 0) * travel * pack, 0, 1);
  const value = SERVICES.reduce((x, sv) => x + weightOf(sv) * segAvg(sv, (s) => valueScore(s.rD, SEGMENTS[s.id].elasticity)), 0);
  const time = delivered > 0 ? SERVICES.reduce((x, sv) => x + (i.delivered[sv] / delivered) * timeScore(i.time[sv]), 0) : 0;
  const S = 100 * (0.45 * food + 0.35 * time + 0.2 * value);
  const next = nextDrep(d, S, accepted, accepted - delivered, wanted, wanted - accepted, i.economy.reputation);
  const own = d.mode !== 'platform';
  let sales = 0;
  let refunds = 0;
  let commission = 0;
  let foodCost = 0;
  let packaging = 0;
  let dealGiven = 0;
  let feesWaived = 0;
  let mainsOut = 0;
  const dishSales: Record<string, number> = {};
  const bySegment: Partial<Record<SegmentId, number>> = {};
  for (const sv of SERVICES) {
    const b = i.basket[sv];
    const n = i.delivered[sv];
    // Very late orders are partly refunded: nothing down to a time score of 0.5 (about 47 minutes), up to lateRefund of the
    // order value at a time score of 0 (cleanup sprint 4: running the kitchen hot must cost money, not only rating).
    const refund = t.lateRefund * Math.max(0, 1 - 2 * timeScore(i.time[sv])) * b.orderValue * n;
    refunds += refund;
    // Free delivery: own riders lose the fee; on the app you pay it to the app yourself.
    const fee = own && !b.feeWaived ? t.fee : 0;
    const waived = b.feeWaived ? t.fee * n : 0;
    feesWaived += waived;
    sales += n * (b.orderValue + fee) - refund - (own ? 0 : waived);
    commission += t.commission[d.mode] * b.orderValue * n;
    foodCost += n * b.foodPerOrder * i.economy.ingredients;
    packaging += n * b.mains * t.packaging[d.packaging];
    dealGiven += n * b.given;
    mainsOut += n * b.mains;
    const sumW = b.segs.reduce((x, s) => x + s.w, 0) || 1;
    for (const s of b.segs) {
      bySegment[s.id] = (bySegment[s.id] ?? 0) + (n * s.w) / sumW;
      const mains = (n * s.w * b.mains) / sumW;
      for (const p of s.probs) dishSales[p.id] = (dishSales[p.id] ?? 0) + mains * p.p;
    }
  }
  const other = delivered * t.utilitiesPerOrder + deliveryWeeklyCosts(d) / 7;
  const deliveryCosts = commission + packaging + other;
  const wages = riderWages(i.staff) / 7;
  const basketOf = (sv: Service): { wanted: number; accepted: number; delivered: number; orderValue: number; mains: number } => ({
    wanted: i.wanted[sv], accepted: i.accepted[sv], delivered: i.delivered[sv], orderValue: i.basket[sv].orderValue, mains: i.basket[sv].mains,
  });
  return {
    deliverySales: sales, foodCost, deliveryCosts, dishSales,
    day: {
      wanted, accepted, refused: wanted - accepted, cancelled: accepted - delivered, delivered, time: { ...i.time },
      drepBefore: d.drep, drepAfter: next.drep, topRated: next.topRated, topRatedDays: next.topRatedDays,
      profit: sales - foodCost - deliveryCosts - wages,
      kitchenShare: mainsOut + i.covers > 0 ? mainsOut / (mainsOut + i.covers) : 0,
      satisfaction: S, scores: { food, time, value }, sales, commission, food: foodCost, packaging, other,
      orderValue: delivered > 0 ? SERVICES.reduce((x, sv) => x + i.delivered[sv] * i.basket[sv].orderValue, 0) / delivered : i.basket.dinner.orderValue,
      refunds,
      mainsPerOrder: delivered > 0 ? mainsOut / delivered : i.basket.dinner.mains,
      riderWages: wages, dealGiven, feesWaived, deal: d.deal ?? null,
      byService: { lunch: basketOf('lunch'), dinner: basketOf('dinner') },
      bySegment,
      ...(i.rivalOrders !== undefined ? { rivalOrders: i.rivalOrders } : {}),
    },
  };
}

/** Delivery orders rivals near this district took on their last day, weighted like delivery competition (6.3). */
export function rivalDeliveryOrders(state: GameState, districtId: string): number {
  let n = 0;
  for (const r of activeRivals(state)) {
    for (const l of r.locations) {
      if (!l.delivery) continue;
      const d = VENUES[l.venueId]?.districtId;
      const prox = d === districtId ? 1 : d && (ADJACENT[districtId] ?? []).includes(d) ? 0.5 : 0;
      n += prox * (l.last?.deliveryOrders ?? 0);
    }
  }
  return n;
}

export type { Service };
