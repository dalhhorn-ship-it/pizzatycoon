// Small pure formulas shared by the day model, rivals and delivery. This module imports no other sim module, so
// nothing that needs them has to import day.ts (no import cycles, TD5).

import { T } from '../data/tunables';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function valueScore(r: number, elasticity: number): number {
  return clamp(T.pricing.valueBase - T.pricing.valueSlope * (r - 1) * elasticity, 0, 1);
}

export function queueDelay(rho: number): number {
  if (rho >= T.service.queueRhoCap) return T.service.queueCap;
  return Math.min(T.service.queueCap, (2 * rho) / (1 - rho));
}

/** Share of full demand that comes in: curious walk-ins plus locals who know the place (balance.md 4.3). */
export function followingDemand(following: number): number {
  return T.following.walkIn + (1 - T.following.walkIn) * clamp(following, 0, 1);
}

export function followingTarget(satisfaction: number): number {
  const f = T.following;
  return clamp((satisfaction - f.satZero) / (f.satFull - f.satZero), 0, 1);
}

/** Word of mouth: satisfied guests bring friends, unhappy ones and guests who gave up waiting keep them away. */
export function nextFollowing(following: number, satisfaction: number, covers: number, impatient: number, loyal = false): { after: number; target: number } {
  const f = T.following;
  const target = Math.min(1, followingTarget(satisfaction) + (loyal ? 0.05 : 0));
  const reach = clamp(covers / f.wordOfMouthGuests, f.wordOfMouthMin, 1);
  const rate = target > following ? f.growth * reach : f.decline * (loyal ? 0.5 : 1);
  const arrivals = covers + impatient;
  const gaveUp = arrivals > 0 ? impatient / arrivals : 0;
  return { after: clamp(following + rate * (target - following) - f.walkAwayLoss * gaveUp, 0, 1), target };
}
