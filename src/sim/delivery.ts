// Food delivery (competition.md 6): unlock, demand from the catchment, riders, delivery time and DRep.

import { ADJACENT, DISTRICTS } from '../data/districts';
import type { Service } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { queueDelay } from './day';
import { onRota } from './staff';
import type { DeliveryDay, DeliveryMode, DeliveryState, GameState, Staff } from './state';
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

/** What is missing before this restaurant can deliver (6.1). */
export function deliveryMissing(state: Pick<GameState, 'rep' | 'daysOpen' | 'equipment'>): string[] {
  const d = T.delivery;
  const out: string[] = [];
  if (state.rep < d.unlockRep) out.push(`reach 3 stars (reputation ${d.unlockRep}); you are at ${state.rep.toFixed(0)}`);
  if (state.daysOpen < d.unlockDays) out.push(`be open ${d.unlockDays} days; ${state.daysOpen} so far`);
  return out;
}

export const deliveryUnlocked = (state: Pick<GameState, 'rep' | 'daysOpen' | 'equipment'>): boolean => deliveryMissing(state).length === 0;

export const hasPacking = (state: Pick<GameState, 'equipment'>): boolean => state.equipment.some((e) => e.itemId === 'packingStation');

export function newDelivery(day: number, mode: DeliveryMode): DeliveryState {
  const d = T.delivery;
  return {
    on: true, mode, markup: d.markupDefault, packaging: 'basic', throttle: d.throttleDefault, drep: d.startDRep, since: day,
    vehicles: { bike: 0, scooter: 0 }, topRatedDays: 0, topRated: false,
  };
}

/** Is delivery taking orders today? */
export const deliveryLive = (state: Pick<GameState, 'delivery' | 'equipment'>): boolean => !!state.delivery?.on && hasPacking(state);

/** People who can order: the district plus half of the neighbouring ones (6.3). */
export function catchment(districtId: string, footTraffic: number): number {
  return footTraffic + T.delivery.adjacentWeight * (ADJACENT[districtId] ?? []).reduce((x, id) => x + (DISTRICTS[id]?.footTraffic ?? 0), 0);
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

/** Orders a day multiplier from everything but the menu (6.3, 6.12). */
export function deliveryReachMult(d: DeliveryState, day: number): number {
  const t = T.delivery;
  const novelty = day - d.since < t.noveltyDays ? t.novelty : 1;
  return t.reach[d.mode] * novelty * (d.topRated ? t.topRatedBoost : 1) * (T.demand.repMultBase + T.demand.repMultSlope * d.drep);
}

export interface Riders {
  onShift: number;
  /** Orders per hour the riders can take. */
  capPerHour: number;
  ride: number;
  quality: number;
}

/** Riders on shift today with a vehicle each (scooters first) (6.5, 6.8). */
export function ridersToday(state: Pick<GameState, 'staff' | 'day' | 'delivery'>): Riders {
  const d = state.delivery;
  const t = T.delivery;
  if (!d || d.mode === 'platform') return { onShift: 0, capPerHour: Infinity, ride: t.platformRide, quality: 50 };
  const riders = onRota(state.staff, state.day).filter((s) => s.role === 'rider').sort((a, b) => b.attrs.speed - a.attrs.speed);
  const vehicles = [...Array(d.vehicles.scooter).fill(t.scooterRide), ...Array(d.vehicles.bike).fill(t.bikeRide)] as number[];
  const n = Math.min(riders.length, vehicles.length);
  if (!n) return { onShift: 0, capPerHour: 0, ride: t.bikeRide, quality: 50 };
  const used = riders.slice(0, n);
  const spd = used.reduce((x, s) => x + s.attrs.speed, 0) / n;
  const ride = (vehicles.slice(0, n).reduce((x, v) => x + v, 0) / n) * (1.15 - 0.003 * spd);
  return { onShift: n, capPerHour: (n * 60 / (2 * ride + 4)) * t.ordersPerTrip, ride, quality: used.reduce((x, s) => x + s.attrs.quality, 0) / n };
}

/** Riders needed for a peak of this many orders an hour (6.11). */
export function ridersNeeded(peakPerHour: number, ride: number): number {
  const per = (60 / (2 * ride + 4)) * T.delivery.ordersPerTrip;
  return Math.ceil(peakPerHour / (0.8 * per));
}

/** Minutes from order to door (6.5). */
export function deliveryMinutes(cookTime: number, kitchenRho: number, ordersPerHour: number, r: Riders, mode: DeliveryMode): number {
  const t = T.delivery;
  const ticket = cookTime + queueDelay(Math.min(kitchenRho, T.service.queueRhoCap)) + t.packMinutes;
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
  d.topRated = day.topRated;
  d.topRatedDays = day.topRatedDays ?? d.topRatedDays;
}

/** Weekly running costs that are not wages: web shop and vehicles. */
export function deliveryWeeklyCosts(d: DeliveryState): number {
  const t = T.delivery;
  return (d.mode === 'own' ? t.webShopFee : 0) + d.vehicles.bike * t.bike.upkeep + d.vehicles.scooter * t.scooter.upkeep;
}

export const riderWages = (staff: readonly Staff[]): number => staff.filter((s) => s.role === 'rider').reduce((x, s) => x + s.salary, 0);

export type { Service };
