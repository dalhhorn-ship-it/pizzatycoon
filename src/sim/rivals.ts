// Live rival pizzerias (competition.md 2, 3): profiles, attractiveness, pressure, their day and week, openings and closings.
// Rival states are frozen during the player's day; rivals then run their own day with the player's start of day pull.

import { CAMPAIGNS, type CampaignId } from '../data/campaigns';
import { ADJACENT, DISTRICTS, PREMISES } from '../data/districts';
import {
  ARCHETYPE_IDS, ARCHETYPES, type ArchetypeId, FIT_OUT, MOTTOS, RIVAL_NAMES, type RivalTier, SPAWN_WEIGHTS, TIER_FOOD_COST, TIER_ORDER, TIER_Q,
} from '../data/rivals';
import { SEGMENT_IDS, SEGMENTS } from '../data/segments';
import type { SegmentId } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { repPriceMult } from './analysis';
import { followingDemand, nextFollowing, valueScore } from './day';
import { economyOf, rivalSettingsOf } from './economy';
import { bestFor, type LocationFacts, locationFacts } from './location';
import { audienceMatch, audienceWeight, campaignCost, fatigueOf } from './marketing';
import { Rng } from './rng';
import type { GameState, NewsItem, Rival, RivalCampaign, RivalLocation } from './state';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const zeroSeg = (): Record<SegmentId, number> => Object.fromEntries(SEGMENT_IDS.map((s) => [s, 0])) as Record<SegmentId, number>;

// ---------- Settings and lookups ----------

export const liveOn = (state: Pick<GameState, 'economy'>): boolean => rivalSettingsOf(state).on;

export function rivalSkill(state: Pick<GameState, 'economy'>, r: Pick<Rival, 'skillOffset'>): number {
  return clamp(rivalSettingsOf(state).skill + r.skillOffset, 1, 10);
}

export const activeRivals = (state: Pick<GameState, 'rivals'>): Rival[] => (state.rivals ?? []).filter((r) => r.closedDay === undefined && r.locations.length > 0);

export function rivalLocations(state: Pick<GameState, 'rivals'>): { rival: Rival; loc: RivalLocation }[] {
  return activeRivals(state).flatMap((rival) => rival.locations.map((loc) => ({ rival, loc })));
}

const factsCache = new Map<string, LocationFacts>();
export function venueFacts(venueId: string): LocationFacts {
  let f = factsCache.get(venueId);
  if (!f) {
    const v = VENUES[venueId];
    if (!v) throw new Error(`Unknown venue ${venueId}`);
    f = locationFacts(v.districtId, v.premisesId, v.id);
    factsCache.set(venueId, f);
  }
  return f;
}

/** Every restaurant the player owns, with where it is. */
export function ownRestaurants(state: GameState): { id: number; districtId: string; venueId: string | null }[] {
  if (state.ownList) return state.ownList;
  return [{ id: state.locationId, districtId: state.districtId, venueId: state.venueId }, ...state.branches.map((b) => ({ id: b.id, districtId: b.districtId, venueId: b.venueId }))];
}

// ---------- A rival's profile (3.3) ----------

export function rivalTierFor(archetype: ArchetypeId, skill: number): RivalTier {
  const a = ARCHETYPES[archetype];
  return skill >= 7 && a.skilledTier ? a.skilledTier : a.tier;
}

export const rivalQ = (tier: RivalTier, skill: number): number =>
  T.quality.wIngredients * TIER_Q[tier] + T.quality.wHarmony * 65 + T.quality.wKitchen * (T.quality.kitchenBase + T.quality.kitchenPerSkill * skill);

export function rivalFair(loc: Pick<RivalLocation, 'tier' | 'rep'>, skill: number): number {
  return (T.pricing.fairIntercept + T.pricing.fairQualitySlope * rivalQ(loc.tier, skill) + T.pricing.fairFoodCostMult * TIER_FOOD_COST[loc.tier]) * repPriceMult(loc.rep);
}

export const rivalMainPrice = (loc: Pick<RivalLocation, 'tier' | 'rep' | 'priceIndex'>, skill: number): number => rivalFair(loc, skill) * loc.priceIndex;

export function rivalSeats(venueId: string): number {
  const p = PREMISES[VENUES[venueId]?.premisesId ?? ''];
  return p ? Math.floor(T.build.maxSeatsPerDiningTile * p.diningWidth * p.diningHeight) : 0;
}

export function targetsOf(archetype: ArchetypeId, facts: LocationFacts): SegmentId[] {
  const t = ARCHETYPES[archetype].targets;
  if (t !== 'top2') return [...t];
  return [...SEGMENT_IDS].sort((a, b) => facts.shares[b] - facts.shares[a]).slice(0, 2);
}

/** Rival campaigns as the dining multiplier for a segment. */
export function rivalMkt(campaigns: readonly RivalCampaign[], s: SegmentId, day: number): number {
  let lift = 0;
  for (const c of campaigns) {
    if (day >= c.endsDay) continue;
    const def = CAMPAIGNS[c.id];
    if (!def) continue;
    lift += def.lift * audienceWeight(def, c.audience, s) * fatigueOf(c.weeksRunning);
  }
  return Math.min(1 + T.marketing.liftCap, 1 + lift);
}

/** Attractiveness of a rival location for a segment (2.2): the same multipliers the player's demand uses. */
export function rivalA(state: Pick<GameState, 'economy'>, rival: Rival, loc: RivalLocation, s: SegmentId, day: number): number {
  const facts = venueFacts(loc.venueId);
  const a = ARCHETYPES[rival.archetype];
  const skill = rivalSkill(state, rival);
  const seg = SEGMENTS[s];
  const d = T.demand;
  const price = rivalMainPrice(loc, skill);
  const Q = rivalQ(loc.tier, skill);
  const repMult = d.repMultBase + d.repMultSlope * loc.rep;
  const fit = targetsOf(rival.archetype, facts).includes(s) ? 1.2 : 0.9;
  const priceMult = clamp(Math.pow(loc.priceIndex, -seg.elasticity), d.priceMultMin, d.priceMultMax);
  const budgetMult = clamp(Math.pow((seg.budget * facts.wealth) / price, d.budgetExponent), d.budgetMultMin, d.budgetMultMax);
  const qualityMult = clamp(1 + (seg.qualityAppeal * (Q - d.qualityPivot)) / d.qualityDivisor, d.qualityMultMin, d.qualityMultMax);
  const speed = clamp(d.speedRef / a.serviceTime, d.speedMultMin, d.speedMultMax);
  const speedA = seg.speedAppealAtLunch ? facts.lunchShare * speed + (1 - facts.lunchShare) : 1;
  return (facts.venue?.trafficMult ?? 1) * facts.visibility * repMult * fit * priceMult * budgetMult * qualityMult * speedA *
    followingDemand(loc.following) * rivalMkt(loc.campaigns, s, day);
}

// ---------- Pressure (2.3) ----------

function distance(a: string | null, b: string | null): number {
  const va = a ? VENUES[a] : undefined;
  const vb = b ? VENUES[b] : undefined;
  if (!va || !vb) return Infinity;
  return Math.hypot(va.x - vb.x, va.y - vb.y);
}

/** How close two places are: same street, same neighbourhood, nearby, or out of reach. */
export function proximity(aDistrict: string, aVenue: string | null, bDistrict: string, bVenue: string | null): number {
  const t = T.rivals;
  const dist = distance(aVenue, bVenue);
  if (aDistrict === bDistrict) return dist <= t.sameStreetUnits ? t.sameStreetMult : 1;
  return dist <= t.nearbyUnits ? t.nearbyMult : 0;
}

export function proximityLabel(p: number): string {
  if (p >= T.rivals.sameStreetMult) return 'same street';
  if (p >= 1) return 'same neighbourhood';
  if (p > 0) return 'nearby';
  return 'out of reach';
}

export interface Competition {
  cEff: Record<SegmentId, number>;
  /** Pressure of each rival by segment (for guests lost). */
  byRival: Record<number, Record<SegmentId, number>>;
}

/**
 * Competition a player restaurant faces per segment (2.1): background, live rivals and own restaurants nearby.
 * With live rivals off (or `live` false) it is today's static number plus cannibalisation.
 */
export function playerCompetition(state: GameState, facts: LocationFacts, A: Record<SegmentId, number>, live = true): Competition {
  const t = T.rivals;
  const on = live && liveOn(state);
  const bg = on ? clamp(t.backgroundShare * facts.district.competition + (facts.venue?.competitionDelta ?? 0), 0, T.city.competitionMax) : facts.competition;
  const others = ownRestaurants(state).filter((o) => o.id !== state.locationId && o.districtId === facts.district.id).length;
  const base = bg + T.demand.cannibalisation * others;
  const cEff = zeroSeg();
  const byRival: Record<number, Record<SegmentId, number>> = {};
  for (const s of SEGMENT_IDS) cEff[s] = base;
  if (on) {
    for (const { rival, loc } of rivalLocations(state)) {
      const vf = venueFacts(loc.venueId);
      const prox = proximity(facts.district.id, state.venueId, vf.district.id, loc.venueId);
      if (prox <= 0) continue;
      for (const s of SEGMENT_IDS) {
        if (A[s] <= 0) continue;
        const p = t.unitPressure * prox * clamp(rivalA(state, rival, loc, s, state.day) / A[s], t.relMin, t.relMax);
        cEff[s] += p;
        (byRival[rival.id] ??= zeroSeg())[s] += p;
      }
    }
  }
  for (const s of SEGMENT_IDS) cEff[s] = Math.min(T.demand.competitionCap, cEff[s]);
  return { cEff, byRival };
}

/** A competitor as a rival sees it: where it is and how attractive, per segment. */
interface Presence {
  key: string;
  districtId: string;
  venueId: string | null;
  A: Record<SegmentId, number>;
}

function rivalCompetition(me: Presence, others: readonly Presence[]): Record<SegmentId, number> {
  const t = T.rivals;
  const district = DISTRICTS[me.districtId];
  const vf = me.venueId ? venueFacts(me.venueId) : undefined;
  const bg = clamp(t.backgroundShare * (district?.competition ?? 0.3) + (vf?.venue?.competitionDelta ?? 0), 0, T.city.competitionMax);
  const c = zeroSeg();
  for (const s of SEGMENT_IDS) {
    let x = bg;
    for (const o of others) {
      if (o.key === me.key) continue;
      const prox = proximity(me.districtId, me.venueId, o.districtId, o.venueId);
      if (prox <= 0 || me.A[s] <= 0) continue;
      x += t.unitPressure * prox * clamp(o.A[s] / me.A[s], t.relMin, t.relMax);
    }
    c[s] = Math.min(T.demand.competitionCap, x);
  }
  return c;
}

// ---------- A rival location's day (3.3) ----------

export interface RivalDay {
  served: number;
  bySegment: Record<SegmentId, number>;
  sales: number;
  profit: number;
  satisfaction: number;
  lowest: string;
  load: number;
  deliveryOrders: number;
}

function staffPerDay(rival: Rival, venueId: string, skill: number): number {
  const a = rival.archetype;
  const seats = rivalSeats(venueId);
  const premium = a === 'artisan' || a === 'trendyKitchen' ? 1.15 : 1;
  return ((2 + Math.ceil(seats / 12)) * T.rivals.salaryBase * (1 + T.staff.salaryPerOvr * (10 * skill - 50)) * premium) / 7;
}

function fitOut(archetype: ArchetypeId, premisesId: string): number {
  return (FIT_OUT[premisesId] ?? 8000) * (archetype === 'artisan' || archetype === 'trendyKitchen' ? 1.5 : 1);
}

/** Rent plus staff for a week at a venue. */
export function fixedWeekly(state: Pick<GameState, 'economy'>, rival: Rival, venueId: string, skill: number): number {
  return venueFacts(venueId).weeklyRent * economyOf(state).rent + 7 * staffPerDay(rival, venueId, skill);
}

/** One day of a rival location with competition frozen as given. Pure: the caller applies the result. */
export function rivalDay(state: Pick<GameState, 'economy' | 'day'>, rival: Rival, loc: RivalLocation, day: number, cEff: Record<SegmentId, number>, A: Record<SegmentId, number>): RivalDay {
  const facts = venueFacts(loc.venueId);
  const a = ARCHETYPES[rival.archetype];
  const skill = rivalSkill(state, rival);
  const eco = economyOf(state);
  const weekday = (day - 1) % 7;
  const wd = T.time.weekdayMult[weekday] ?? 1;
  const demand = zeroSeg();
  let total = 0;
  for (const s of SEGMENT_IDS) {
    demand[s] = facts.district.footTraffic * facts.shares[s] * T.demand.captureBase * wd * A[s] * (1 - T.demand.competitionFactor * cEff[s]) * eco.demand;
    total += demand[s];
  }
  const capacity = rivalSeats(loc.venueId) * a.turns;
  const served = Math.min(total, capacity);
  const fill = total > 0 ? served / total : 0;
  const load = capacity > 0 ? total / capacity : 0;
  const bySegment = zeroSeg();
  for (const s of SEGMENT_IDS) bySegment[s] = demand[s] * fill;
  const Q = rivalQ(loc.tier, skill);
  const food = 0.7 * (Q / 100) + 0.3 * 0.55;
  const service = clamp(0.3 + 0.06 * skill + (rival.archetype === 'artisan' || rival.archetype === 'trendyKitchen' ? 0.1 : 0), 0, 1);
  const ambience = a.ambience / 100;
  const wait = clamp(1 - 2 * Math.max(0, load - 0.85), 0, 1);
  const w = T.satisfaction;
  let S = 0;
  let valueAvg = 0;
  for (const s of SEGMENT_IDS) {
    const value = valueScore(loc.priceIndex, SEGMENTS[s].elasticity);
    valueAvg += served > 0 ? (value * bySegment[s]) / served : value / 6;
    S += served > 0 ? (bySegment[s] / served) * 100 * (w.wFood * food + w.wService * service + w.wAmbience * ambience + w.wValue * value + w.wWait * wait) : 0;
  }
  if (served <= 0) S = 100 * (w.wFood * food + w.wService * service + w.wAmbience * ambience + w.wValue * 0.7 + w.wWait * wait);
  const scores: [string, number][] = [['the food', food], ['the service', service], ['the room', ambience], ['the prices', valueAvg], ['long waits', wait]];
  const lowest = scores.reduce((x, y) => (y[1] < x[1] ? y : x))[0];
  const check = rivalMainPrice(loc, skill) * 1.5;
  const foodCost = TIER_FOOD_COST[loc.tier] * 1.6 * (1.1 - 0.015 * skill) * eco.ingredients;
  const rent = (facts.weeklyRent * eco.rent) / 7;
  const staff = staffPerDay(rival, loc.venueId, skill) * eco.wages;
  const utilities = 30 + 0.8 * served;
  const upkeep = 15 + 0.002 * fitOut(rival.archetype, facts.premises.id);
  // Simplified rival delivery (6.10): platform orders, capped at 40% of dining capacity.
  let deliveryOrders = 0;
  let deliveryProfit = 0;
  if (loc.delivery) {
    const catchment = facts.footTraffic + T.delivery.adjacentWeight * (ADJACENT[facts.district.id] ?? []).reduce((x, id) => x + (DISTRICTS[id]?.footTraffic ?? 0), 0);
    const aff = SEGMENT_IDS.reduce((x, s) => x + facts.shares[s] * (T.delivery.affinity[s] ?? 1), 0);
    deliveryOrders = Math.min(T.delivery.rivalCap * capacity, catchment * T.delivery.orderRate * aff * (T.demand.repMultBase + T.demand.repMultSlope * loc.drep) * wd * eco.demand);
    const orderValue = rivalMainPrice(loc, skill) * T.delivery.mainsPerOrder;
    deliveryProfit = deliveryOrders * (orderValue * (1 - T.delivery.commission.platform) - TIER_FOOD_COST[loc.tier] * T.delivery.mainsPerOrder * eco.ingredients - T.delivery.packaging.basic * T.delivery.mainsPerOrder);
  }
  const sales = served * check;
  const profit = sales - served * foodCost - rent - staff - utilities - upkeep + deliveryProfit;
  return { served, bySegment, sales, profit, satisfaction: S, lowest, load, deliveryOrders };
}

// ---------- Everyone's pull, frozen at the start of the rivals' day ----------

function presences(state: GameState, playerA: readonly { id: number; districtId: string; venueId: string | null; A: Record<SegmentId, number> }[]): Presence[] {
  const out: Presence[] = playerA.map((p) => ({ key: `p${p.id}`, districtId: p.districtId, venueId: p.venueId, A: p.A }));
  for (const { rival, loc } of rivalLocations(state)) {
    const A = zeroSeg();
    for (const s of SEGMENT_IDS) A[s] = rivalA(state, rival, loc, s, state.day);
    out.push({ key: `r${rival.id}:${loc.venueId}`, districtId: venueFacts(loc.venueId).district.id, venueId: loc.venueId, A });
  }
  return out;
}

/** The player's restaurants' pull today, from their day reports (the start of day analysis). */
export function playerPresence(state: GameState): { id: number; districtId: string; venueId: string | null; A: Record<SegmentId, number> }[] {
  const out: { id: number; districtId: string; venueId: string | null; A: Record<SegmentId, number> }[] = [];
  const last = state.history.at(-1);
  if (last?.market) out.push({ id: state.locationId, districtId: state.districtId, venueId: state.venueId, A: last.market.A });
  for (const b of state.branches) {
    const r = b.history.at(-1);
    if (r?.market) out.push({ id: b.id, districtId: b.districtId, venueId: b.venueId, A: r.market.A });
  }
  return out;
}

// ---------- News ----------

export function news(state: GameState, rival: Rival, kind: NewsItem['kind'], text: string, venueId?: string): void {
  const districtId = venueId ? (VENUES[venueId]?.districtId ?? '') : venueFacts(rival.locations[0]?.venueId ?? '').district.id;
  state.marketNews = [...(state.marketNews ?? []).filter((n) => state.day - n.day < T.history.newsDays), { day: state.day, text, districtId, kind, rivalId: rival.id }];
}

/** Is a rival within reach of any of the player's restaurants? */
export function inReach(state: GameState, rival: Rival): boolean {
  return rival.locations.some((l) => {
    const vf = venueFacts(l.venueId);
    return ownRestaurants(state).some((o) => proximity(o.districtId, o.venueId, vf.district.id, l.venueId) > 0);
  });
}

// ---------- Venues ----------

/** The hole in the wall venues of the original 24 (city-map.md 4.4): start rivals leave them for fresh starts. */
const ORIGINAL_HOLES = new Set(Object.values(VENUES).slice(0, 24).filter((v) => v.premisesId === 'hole').map((v) => v.id));

/** Free for a rival: not the player's, not held, not taken or viewed, and not the last free hole in the wall of its district. */
export function freeVenues(state: GameState, opts: { start?: boolean } = {}): string[] {
  const taken = new Set<string>();
  for (const o of ownRestaurants(state)) if (o.venueId) taken.add(o.venueId);
  for (const r of activeRivals(state)) for (const l of r.locations) taken.add(l.venueId);
  for (const r of state.rivals ?? []) if (r.viewing && r.closedDay === undefined) taken.add(r.viewing.venueId);
  if (state.venueHold && state.venueHold.untilDay > state.day) taken.add(state.venueHold.venueId);
  const free = Object.values(VENUES).filter((v) => !taken.has(v.id));
  const freeHoles = (d: string): number => free.filter((v) => v.districtId === d && v.premisesId === 'hole').length;
  return free.filter((v) => {
    if (v.premisesId === 'hole' && freeHoles(v.districtId) <= 1) return false;
    if (opts.start && ORIGINAL_HOLES.has(v.id)) return false;
    return true;
  }).map((v) => v.id);
}

export function rivalAt(state: Pick<GameState, 'rivals'>, venueId: string): Rival | undefined {
  return activeRivals(state).find((r) => r.locations.some((l) => l.venueId === venueId));
}

export function viewerOf(state: Pick<GameState, 'rivals'>, venueId: string): Rival | undefined {
  return (state.rivals ?? []).find((r) => r.closedDay === undefined && r.viewing?.venueId === venueId);
}

function affordable(state: GameState, rival: Rival, venueId: string, skill: number, runwayWeeks: number): boolean {
  const facts = venueFacts(venueId);
  const deposit = facts.weeklyRent * economyOf(state).rent * T.finance.leaseDepositWeeks;
  return fitOut(rival.archetype, facts.premises.id) + deposit + runwayWeeks * fixedWeekly(state, rival, venueId, skill) <= rival.cash;
}

function blankLocation(venueId: string, day: number, tier: RivalTier, priceIndex: number, rep: number, following: number): RivalLocation {
  return {
    venueId, opened: day, tier, priceIndex, rep, following, drep: Math.max(0, rep - 5), delivery: false, campaigns: [], cutsInRow: 0,
    cutCooldownUntil: 0, rescued: false, weeksLosing: 0, overDays: 0,
    week: { served: 0, profit: 0, sales: 0, bySegment: zeroSeg() }, history: [],
    last: { served: 0, profit: 0, satisfaction: 0, lowest: '', bySegment: zeroSeg(), deliveryOrders: 0 },
  };
}

/** Expected weekly profit of a (possible) location, holding the rest of the market as it is now (3.4 evaluator). */
export function expectedWeek(state: GameState, rival: Rival, loc: RivalLocation, market: readonly Presence[]): { profit: number; sales: number } {
  const me: Presence = { key: `eval`, districtId: venueFacts(loc.venueId).district.id, venueId: loc.venueId, A: zeroSeg() };
  for (const s of SEGMENT_IDS) me.A[s] = rivalA(state, rival, loc, s, state.day);
  const others = market.filter((p) => !(p.venueId === loc.venueId));
  const cEff = rivalCompetition(me, others);
  let profit = 0;
  let sales = 0;
  const base = state.day - ((state.day - 1) % 7);
  for (let i = 0; i < 7; i++) {
    const d = rivalDay(state, rival, loc, base + i, cEff, me.A);
    profit += d.profit;
    sales += d.sales;
  }
  return { profit, sales };
}

/** Pick the best of up to 2 + skill sampled venues by expected weekly profit (3.2, 3.5), with the leader pull when set. */
function chooseVenue(state: GameState, rng: Rng, rival: Rival, candidates: string[], skill: number, market: readonly Presence[]): string | null {
  const a = ARCHETYPES[rival.archetype];
  const preferred = candidates.filter((id) => a.premises.includes(VENUES[id]?.premisesId ?? ''));
  const pool = preferred.length ? preferred : candidates;
  const sample: string[] = [];
  const bag = [...pool];
  while (bag.length && sample.length < 2 + skill) sample.push(bag.splice(Math.floor(rng.next() * bag.length), 1)[0] as string);
  const leader = rivalSettingsOf(state).targetLeader && a.style.marketing >= 0.45 ? leaderDistrict(state) : null;
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const venueId of sample) {
    const tier = rivalTierFor(rival.archetype, skill);
    const loc = blankLocation(venueId, state.day, tier, a.priceIndex, 45, 0.6);
    const e = expectedWeek(state, rival, loc, market);
    const pull = leader && VENUES[venueId]?.districtId === leader ? T.rivals.leaderPull * e.sales : 0;
    if (e.profit + pull > bestScore) {
      bestScore = e.profit + pull;
      best = venueId;
    }
  }
  return best;
}

/** The district of the player's most successful restaurant (target the leader, founder decision on question 6). */
export function leaderDistrict(state: GameState): string | null {
  const all = [{ districtId: state.districtId, rep: state.rep, served: state.history.slice(-7).reduce((x, r) => x + r.covers, 0) },
    ...state.branches.map((b) => ({ districtId: b.districtId, rep: b.rep, served: b.history.slice(-7).reduce((x, r) => x + r.covers, 0) }))];
  const best = all.sort((a, b) => b.rep * b.served - a.rep * a.served)[0];
  return best && best.rep >= 55 ? best.districtId : null;
}

// ---------- New rivals ----------

function pickWeighted<X extends string>(rng: Rng, weights: Record<X, number>): X {
  const keys = Object.keys(weights) as X[];
  const total = keys.reduce((a, k) => a + weights[k], 0);
  let r = rng.next() * total;
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1] as X;
}

function newRival(state: GameState, rng: Rng, archetype: ArchetypeId): Rival {
  const settings = rivalSettingsOf(state);
  const used = new Set((state.rivals ?? []).filter((r) => r.closedDay === undefined).map((r) => r.name));
  const names = RIVAL_NAMES.filter((n) => !used.has(n.name) && n.suits.includes(archetype));
  const pick = names.length ? rng.pick(names) : rng.pick(RIVAL_NAMES.filter((n) => !used.has(n.name)).length ? RIVAL_NAMES.filter((n) => !used.has(n.name)) : RIVAL_NAMES);
  const meta = (state.rivalMeta ??= { nextId: 1, lastEntrantDay: -999, lastEntrantByDistrict: {}, pendingEntrants: 0, pendingFrom: 0 });
  return {
    id: meta.nextId++, name: pick.name, owner: pick.owner, motto: rng.pick(MOTTOS[archetype]), archetype,
    skillOffset: rng.int(-1, 1), cash: settings.capital, founded: state.day, locations: [],
  };
}

/** Rivals present when a new game starts (3.2): district quotas by competition, established, placed now. */
export function seedRivals(state: GameState): void {
  const settings = rivalSettingsOf(state);
  state.rivals = [];
  state.marketNews = [];
  state.rivalMeta = { nextId: 1, lastEntrantDay: -999, lastEntrantByDistrict: {}, pendingEntrants: 0, pendingFrom: 0 };
  if (!settings.on || settings.start <= 0) return;
  const rng = Rng.stream(state.seed, 0, 'rivals-seed');
  const ids = Object.keys(DISTRICTS);
  const sum = ids.reduce((a, id) => a + (DISTRICTS[id]?.competition ?? 0), 0);
  const exact = ids.map((id) => ({ id, q: (settings.start * (DISTRICTS[id]?.competition ?? 0)) / sum }));
  const quota: Record<string, number> = Object.fromEntries(exact.map((x) => [x.id, Math.floor(x.q)]));
  let left = settings.start - Object.values(quota).reduce((a, b) => a + b, 0);
  for (const x of [...exact].sort((a, b) => (b.q % 1) - (a.q % 1))) if (left-- > 0) quota[x.id] = (quota[x.id] ?? 0) + 1;
  for (const id of ids) {
    const n = Math.min(settings.districtCap, quota[id] ?? 0);
    for (let i = 0; i < n; i++) {
      const facts = locationFacts(id, 'cosy', null);
      const archetype = pickWeighted(rng, SPAWN_WEIGHTS[bestFor(facts.shares)]);
      const rival = newRival(state, rng, archetype);
      const skill = rivalSkill(state, rival);
      const market = presences(state, []);
      const candidates = freeVenues(state, { start: true }).filter((v) => VENUES[v]?.districtId === id && affordable(state, rival, v, skill, T.rivals.runwayWeeks));
      const venueId = chooseVenue(state, rng, rival, candidates, skill, market);
      if (!venueId) continue;
      const a = ARCHETYPES[archetype];
      rival.founded = state.day - rng.int(30, 400);
      rival.locations.push(blankLocation(venueId, rival.founded, rivalTierFor(archetype, skill), a.priceIndex, clamp(40 + 3 * skill + rng.int(-5, 5), 0, 100), rng.range(0.7, 0.9)));
      // Established rivals have spent some of their capital already: some are one bad season from closing.
      rival.cash = Math.round(settings.capital * rng.range(T.rivals.seedCashMin, 1));
      state.rivals.push(rival);
    }
  }
}

/** A newcomer views the best free venue it can afford in a district with room (3.6). */
function startEntrant(state: GameState, rng: Rng, avoidPlayerDistricts: boolean): boolean {
  const settings = rivalSettingsOf(state);
  const t = T.rivals;
  const active = activeRivals(state).length + (state.rivals ?? []).filter((r) => r.closedDay === undefined && !r.locations.length && r.viewing).length;
  if (active >= settings.cityCap) return false;
  const meta = state.rivalMeta ?? { nextId: 1, lastEntrantDay: -999, lastEntrantByDistrict: {}, pendingEntrants: 0, pendingFrom: 0 };
  const perDistrict = (d: string): number => rivalLocations(state).filter(({ loc }) => VENUES[loc.venueId]?.districtId === d).length +
    (state.rivals ?? []).filter((r) => r.closedDay === undefined && r.viewing && VENUES[r.viewing.venueId]?.districtId === d).length;
  const playerDistricts = new Set(ownRestaurants(state).map((o) => o.districtId));
  const districts = Object.keys(DISTRICTS).filter((d) => perDistrict(d) < settings.districtCap &&
    state.day - (state.openedIn?.[d] ?? -999) >= t.graceDays && state.day - (meta.lastEntrantByDistrict[d] ?? -999) >= t.graceDays &&
    !(avoidPlayerDistricts && playerDistricts.has(d)));
  if (!districts.length) return false;
  // A newcomer only looks where it can afford a venue (with the start capital and a cosy fit out).
  const probe: Rival = { id: -1, name: '', owner: '', motto: '', archetype: 'honestTrattoria', skillOffset: 0, cash: settings.capital, founded: state.day, locations: [] };
  const free = freeVenues(state);
  const reachable = districts.filter((d) => free.some((v) => VENUES[v]?.districtId === d && affordable(state, probe, v, rivalSkill(state, probe), t.runwayWeeks)));
  if (!reachable.length) return false;
  const leader = settings.targetLeader ? leaderDistrict(state) : null;
  const weights = Object.fromEntries(reachable.map((d) => [d, (DISTRICTS[d]?.competition ?? 0.3) * (d === leader ? 1.5 : 1)]));
  const districtId = pickWeighted(rng, weights);
  const facts = locationFacts(districtId, 'cosy', null);
  const archetype = pickWeighted(rng, SPAWN_WEIGHTS[bestFor(facts.shares)]);
  // A rival that closed at least 16 weeks ago may come back under its old name.
  const back = (state.rivals ?? []).find((r) => r.closedDay !== undefined && state.day - r.closedDay >= 7 * t.returnWeeks && r.archetype === archetype);
  const rival = back ?? newRival(state, rng, archetype);
  if (back) {
    delete back.closedDay;
    back.cash = rivalSettingsOf(state).capital;
    back.locations = [];
  }
  const skill = rivalSkill(state, rival);
  const candidates = freeVenues(state).filter((v) => VENUES[v]?.districtId === districtId && affordable(state, rival, v, skill, t.runwayWeeks));
  const venueId = chooseVenue(state, rng, rival, candidates, skill, presences(state, playerPresence(state)));
  if (!venueId) {
    if (!back) meta.nextId -= 1;
    return false;
  }
  rival.viewing = { venueId, signsOn: state.day + t.viewingDays };
  if (!back) (state.rivals ??= []).push(rival);
  meta.lastEntrantDay = state.day;
  meta.lastEntrantByDistrict[districtId] = state.day;
  state.rivalMeta = meta;
  news(state, rival, 'viewing', `${rival.name} (${ARCHETYPES[archetype].name}) is viewing ${VENUES[venueId]?.name} and signs on day ${rival.viewing.signsOn}.`, venueId);
  return true;
}

/** Switching live rivals on mid game: the start number arrives over 28 days (9). Off: every rival closes quietly. */
export function applyRivalToggle(state: GameState, wasOn: boolean): void {
  const on = liveOn(state);
  if (on && !wasOn) {
    state.rivalMeta = { ...(state.rivalMeta ?? { nextId: 1, lastEntrantDay: -999, lastEntrantByDistrict: {} }), pendingEntrants: rivalSettingsOf(state).start, pendingFrom: state.day };
    state.rivals ??= [];
    state.marketNews ??= [];
  }
  if (!on && wasOn) {
    for (const r of state.rivals ?? []) if (r.closedDay === undefined) {
      r.closedDay = state.day;
      r.locations = [];
      delete r.viewing;
    }
  }
}

// ---------- The rivals' day (called after the player's restaurants) ----------

/** Run every rival location for today, then weekly decisions on Sunday, openings and entrants. Mutates state; returns today's news. */
export function runRivalsDay(state: GameState): NewsItem[] {
  if (!liveOn(state)) return [];
  const rng = Rng.stream(state.seed, state.day, 'rivals');
  const market = presences(state, playerPresence(state));
  // Today's day for every location with competition frozen at the start of the day.
  for (const { rival, loc } of rivalLocations(state)) {
    const me = market.find((p) => p.key === `r${rival.id}:${loc.venueId}`);
    if (!me) continue;
    const cEff = rivalCompetition(me, market);
    const d = rivalDay(state, rival, loc, state.day, cEff, me.A);
    rival.cash += d.profit;
    loc.week.served += d.served;
    loc.week.profit += d.profit;
    loc.week.sales += d.sales;
    for (const s of SEGMENT_IDS) loc.week.bySegment[s] += d.bySegment[s];
    loc.last = { served: d.served, profit: d.profit, satisfaction: d.satisfaction, lowest: d.lowest, bySegment: d.bySegment, deliveryOrders: d.deliveryOrders };
    if (d.load > 1.1) loc.overDays += 1;
    const rate = Math.min(1, T.reputation.learningRate * economyOf(state).reputation);
    loc.rep = clamp(loc.rep + rate * (T.reputation.reviewBase + T.reputation.reviewSlope * d.satisfaction - loc.rep) - (d.load > 1.15 ? 1 : 0), 0, 100);
    if (loc.delivery) loc.drep = clamp(loc.drep + rate * (loc.rep - 5 - loc.drep), 0, 100);
    const facts = venueFacts(loc.venueId);
    const aware = loc.campaigns.filter((c) => state.day < c.endsDay).reduce((x, c) => {
      const def = CAMPAIGNS[c.id];
      return x + (def ? (def.awareness * (T.marketing.awarenessBase + audienceMatch(def, c.audience, facts.shares)) * (1 - loc.following)) / 7 : 0);
    }, 0);
    loc.following = clamp(nextFollowing(loc.following, d.satisfaction, d.served, 0).after + aware, 0, 1);
  }
  for (const r of activeRivals(state)) if (r.seenSince === undefined && inReach(state, r)) r.seenSince = state.day;

  // Viewings sign on.
  for (const r of state.rivals ?? []) {
    if (!r.viewing || r.closedDay !== undefined || state.day < r.viewing.signsOn) continue;
    const venueId = r.viewing.venueId;
    delete r.viewing;
    const takenByPlayer = ownRestaurants(state).some((o) => o.venueId === venueId) || (state.venueHold?.venueId === venueId && state.venueHold.untilDay > state.day);
    if (takenByPlayer || rivalAt(state, venueId)) {
      if (!r.locations.length) r.closedDay = state.day;
      continue;
    }
    const skill = rivalSkill(state, r);
    const facts = venueFacts(venueId);
    const deposit = facts.weeklyRent * economyOf(state).rent * T.finance.leaseDepositWeeks;
    r.cash -= fitOut(r.archetype, facts.premises.id) + deposit;
    const a = ARCHETYPES[r.archetype];
    r.locations.push(blankLocation(venueId, state.day, rivalTierFor(r.archetype, skill), a.priceIndex, T.rivals.entrantRep, T.rivals.entrantFollowing));
    news(state, r, 'opening', `${r.name} opened at ${VENUES[venueId]?.name}: ${a.competesOn.toLowerCase()}.`, venueId);
  }

  // Mid game switch on: the start number trickles in over 28 days.
  const meta = state.rivalMeta;
  if (meta && meta.pendingEntrants > 0) {
    const daysLeft = Math.max(1, meta.pendingFrom + 28 - state.day);
    if (rng.chance(Math.min(1, meta.pendingEntrants / daysLeft))) {
      if (startEntrant(state, rng, state.day - meta.pendingFrom < 14)) meta.pendingEntrants -= 1;
      else if (daysLeft <= 1) meta.pendingEntrants = 0;
    }
  }

  if ((state.day - 1) % 7 === 6) weekly(state, rng);
  // The feed is trimmed as it grows, so today's items are picked by day, never by position.
  return (state.marketNews ?? []).filter((n) => n.day === state.day);
}

// ---------- The rivals' week (3.4) ----------

type Move =
  | { kind: 'hold' }
  | { kind: 'price'; mult: number }
  | { kind: 'campaign'; id: CampaignId; audience: SegmentId[] }
  | { kind: 'stop'; id: CampaignId }
  | { kind: 'tier'; dir: 1 | -1 }
  | { kind: 'delivery' };

const familyOf = (m: Move): 'price' | 'quality' | 'marketing' | null =>
  m.kind === 'price' ? 'price' : m.kind === 'tier' ? 'quality' : m.kind === 'campaign' || m.kind === 'stop' ? 'marketing' : null;

function applyMove(loc: RivalLocation, m: Move, day: number): RivalLocation {
  const l = structuredClone(loc);
  if (m.kind === 'price') l.priceIndex = Math.round(l.priceIndex * m.mult * 1000) / 1000;
  if (m.kind === 'tier') l.tier = TIER_ORDER[clamp(TIER_ORDER.indexOf(l.tier) + m.dir, 0, TIER_ORDER.length - 1)] as RivalTier;
  if (m.kind === 'campaign') {
    const prev = loc.campaigns.find((c) => c.id === m.id);
    l.campaigns = [...l.campaigns.filter((c) => c.id !== m.id), { id: m.id, audience: m.audience, endsDay: day + 1 + (CAMPAIGNS[m.id]?.runDays ?? 7), weeksRunning: (prev?.weeksRunning ?? 0) + 1 }];
  }
  if (m.kind === 'stop') l.campaigns = l.campaigns.filter((c) => c.id !== m.id);
  if (m.kind === 'delivery') {
    l.delivery = true;
    l.drep = Math.max(0, l.rep - 5);
  }
  return l;
}

function moveCost(state: GameState, loc: RivalLocation, m: Move): number {
  if (m.kind === 'campaign') return campaignCost(CAMPAIGNS[m.id], venueFacts(loc.venueId).footTraffic);
  if (m.kind === 'tier' && m.dir > 0) return T.rivals.tierUpCost / 8;
  void state;
  return 0;
}

function describe(r: Rival, loc: RivalLocation, m: Move): { kind: NewsItem['kind']; text: string } | null {
  const where = VENUES[loc.venueId]?.name ?? '';
  if (m.kind === 'price') return { kind: 'price', text: `${r.name} ${m.mult < 1 ? 'cut' : 'raised'} its prices by ${Math.round(Math.abs(1 - m.mult) * 100)}% at ${where}.` };
  if (m.kind === 'tier') return { kind: 'tier', text: `${r.name} switched to ${m.dir > 0 ? 'better' : 'cheaper'} ingredients at ${where}.` };
  if (m.kind === 'campaign') return { kind: 'campaign', text: `${r.name} started ${CAMPAIGNS[m.id]?.name.toLowerCase()} for ${m.audience.map((s) => SEGMENTS[s].name.toLowerCase()).join(' and ')} at ${where}.` };
  if (m.kind === 'delivery') return { kind: 'delivery', text: `${r.name} now delivers from ${where}.` };
  return null;
}

function weekly(state: GameState, rng: Rng): void {
  const t = T.rivals;
  const settings = rivalSettingsOf(state);
  const week = Math.floor((state.day - 1) / 7);
  const market = presences(state, playerPresence(state));
  for (const rival of activeRivals(state)) {
    const skill = rivalSkill(state, rival);
    const a = ARCHETYPES[rival.archetype];
    for (const loc of [...rival.locations]) {
      // Close the week.
      loc.history = [...loc.history, { served: loc.week.served, profit: loc.week.profit, bySegment: { ...loc.week.bySegment } }].slice(-12);
      const lost = loc.week.profit < 0;
      loc.weeksLosing = lost ? loc.weeksLosing + 1 : 0;
      const revenue = Math.max(1, loc.week.sales);
      const overFull = loc.overDays >= 4;
      loc.week = { served: 0, profit: 0, sales: 0, bySegment: zeroSeg() };
      loc.overDays = 0;
      loc.campaigns = loc.campaigns.filter((c) => state.day + 1 < c.endsDay || c.weeksRunning > 0).filter((c) => state.day + 1 < c.endsDay);

      // Rescue after 4 losing weeks, once.
      if (loc.weeksLosing >= t.rescueAfterWeeks && !loc.rescued) {
        loc.rescued = true;
        const cheapest = [...loc.campaigns].sort((x, y) => (CAMPAIGNS[x.id]?.cost ?? 0) - (CAMPAIGNS[y.id]?.cost ?? 0))[0];
        loc.campaigns = cheapest ? [cheapest] : [];
        loc.tier = TIER_ORDER[Math.max(TIER_ORDER.indexOf(a.tierRange[0]), TIER_ORDER.indexOf(loc.tier) - 1)] as RivalTier;
        loc.priceIndex += clamp(1 - loc.priceIndex, -0.05, 0.05);
        news(state, rival, 'rescue', `${rival.name} is tightening its belt at ${VENUES[loc.venueId]?.name}.`, loc.venueId);
        continue;
      }
      // Low skill rivals decide every second week.
      if (skill <= 4 && week % 2 === 1) continue;
      const floor = skill >= 7 ? t.priceFloorSkilled : t.priceFloor;
      // Each archetype keeps to its own range, so a Price Fighter never becomes a luxury house (competition.md 3.1).
      const minPrice = Math.max(a.priceRange[0], a.style.quality >= 0.45 ? Math.max(1, floor) : floor);
      const maxPrice = Math.min(a.priceRange[1], t.priceCeiling);
      const tierIdx = TIER_ORDER.indexOf(loc.tier);
      const tierMin = TIER_ORDER.indexOf(a.tierRange[0]);
      const tierMax = TIER_ORDER.indexOf(a.tierRange[1]);
      const fixed = fixedWeekly(state, rival, loc.venueId, skill);
      const runway = rival.cash >= t.runwayWeeks * fixed;
      const moves: Move[] = [{ kind: 'hold' }];
      const canCut = state.day >= loc.cutCooldownUntil && loc.priceIndex * (1 - t.maxPriceMove) >= minPrice - 1e-9;
      if (canCut) moves.push({ kind: 'price', mult: 1 - t.maxPriceMove });
      if (loc.priceIndex * 1.03 <= maxPrice + 1e-9) moves.push({ kind: 'price', mult: 1.03 });
      const facts = venueFacts(loc.venueId);
      const targets = targetsOf(rival.archetype, facts);
      if (runway && loc.campaigns.length < T.marketing.maxActive) {
        const options = (Object.values(CAMPAIGNS).filter((c) => c.rivals && c.lift > 0 && c.id !== 'promotedListing')).flatMap((c) => {
          if (loc.campaigns.some((x) => x.id === c.id)) return [];
          const audience = c.audience === 'choose' ? targets.slice(0, c.choose ?? 1) : SEGMENT_IDS.filter((s) => audienceWeight(c, [], s) > 0);
          return [{ c, audience, match: audienceMatch(c, audience, facts.shares) }];
        }).sort((x, y) => y.match - x.match);
        // Low skill rivals sometimes pick the wrong crowd (5.4).
        const pBest = t.pBestBase + t.pBestPerSkill * skill;
        for (const o of options.slice(0, 3)) {
          const aud = rng.chance(pBest) || o.c.audience !== 'choose' ? o.audience : [rng.pick(SEGMENT_IDS)];
          moves.push({ kind: 'campaign', id: o.c.id, audience: aud });
        }
      }
      for (const c of loc.campaigns) moves.push({ kind: 'stop', id: c.id });
      if (runway && tierIdx < tierMax && rival.cash > t.tierUpCost) moves.push({ kind: 'tier', dir: 1 });
      if (tierIdx > tierMin) moves.push({ kind: 'tier', dir: -1 });
      if (runway && !loc.delivery && a.deliveryRep !== null && loc.rep >= a.deliveryRep && loc.history.at(-1) && overFull === false) moves.push({ kind: 'delivery' });

      const scored = moves.map((m) => {
        const next = applyMove(loc, m, state.day);
        const e = expectedWeek(state, rival, next, market);
        const fam = familyOf(m);
        const bonus = fam && m.kind !== 'stop' ? t.styleBonus * revenue * a.style[fam] : 0;
        // A full room considers a price rise first.
        const full = overFull && m.kind === 'price' && m.mult > 1 ? t.styleBonus * revenue : 0;
        return { m, score: e.profit - moveCost(state, loc, m) + bonus + full };
      }).sort((x, y) => y.score - x.score);
      const pBest = t.pBestBase + t.pBestPerSkill * skill;
      const choice = rng.chance(pBest) || scored.length < 2 ? scored[0] : scored[1 + Math.floor(rng.next() * Math.min(2, scored.length - 1))];
      if (!choice) continue;
      const m = choice.m;
      const next = applyMove(loc, m, state.day);
      Object.assign(loc, next);
      if (m.kind === 'price') {
        if (m.mult < 1) {
          loc.cutsInRow += 1;
          if (loc.cutsInRow >= t.cutsBeforeCooldown) {
            loc.cutCooldownUntil = state.day + 7 * t.cooldownWeeks;
            loc.cutsInRow = 0;
          }
        } else loc.cutsInRow = 0;
      }
      if (m.kind === 'campaign') rival.cash -= campaignCost(CAMPAIGNS[m.id], facts.footTraffic);
      if (m.kind === 'tier' && m.dir > 0) rival.cash -= t.tierUpCost;
      const d = describe(rival, loc, m);
      if (d && (m.kind !== 'price' || Math.abs(1 - m.mult) >= 0.05)) news(state, rival, d.kind, d.text, loc.venueId);
      // Running campaigns renew weekly while the rival keeps them.
      for (const c of loc.campaigns) {
        if (state.day + 1 >= c.endsDay && CAMPAIGNS[c.id]?.renews && runway) {
          c.endsDay = state.day + 1 + (CAMPAIGNS[c.id]?.runDays ?? 7);
          c.weeksRunning += 1;
          rival.cash -= campaignCost(CAMPAIGNS[c.id], facts.footTraffic);
        }
      }
    }

    // Closing (3.4 step 6): worst location first.
    const fixedAll = rival.locations.reduce((x, l) => x + fixedWeekly(state, rival, l.venueId, skill), 0);
    for (const loc of [...rival.locations].sort((x, y) => avgProfit(x) - avgProfit(y))) {
      const broke = rival.cash < 0 && avgProfit(loc) < 0;
      const tired = loc.weeksLosing >= t.closeLosingWeeks && rival.cash < t.runwayWeeks * fixedAll;
      if (!broke && !tired) continue;
      rival.locations = rival.locations.filter((l) => l !== loc);
      if (!rival.locations.length) {
        rival.closedDay = state.day;
        news(state, rival, 'closing', `${rival.name} closed its doors after ${Math.max(1, Math.round((state.day - loc.opened) / 7))} weeks. ${VENUES[loc.venueId]?.name} is to let.`, loc.venueId);
      } else news(state, rival, 'closing', `${rival.name} closed ${VENUES[loc.venueId]?.name}.`, loc.venueId);
      break;
    }

    // Chain expansion (3.5).
    if (rival.closedDay === undefined && !rival.viewing && rival.locations.length < a.maxLocations) {
      const best = Math.max(...rival.locations.map((l) => l.rep));
      const positive = rival.locations.every((l) => avgProfit(l) > 0);
      if (best >= t.expansionRep && positive && rng.chance(t.expansionChance) && activeRivals(state).length <= settings.cityCap) {
        const venuesShare = rivalLocations(state).length / Object.keys(VENUES).length;
        if (venuesShare < t.maxShareOfVenues) {
          const candidates = freeVenues(state).filter((v) => affordable(state, rival, v, skill, t.expansionRunwayWeeks));
          const venueId = chooseVenue(state, rng, rival, candidates, skill, market);
          if (venueId) {
            rival.viewing = { venueId, signsOn: state.day + t.viewingDays };
            news(state, rival, 'viewing', `${rival.name} is viewing ${VENUES[venueId]?.name} for a new branch (signs on day ${rival.viewing.signsOn}).`, venueId);
          }
        }
      }
    }
  }

  // New entrants (3.6).
  const meta = state.rivalMeta;
  if (settings.entrants > 0 && state.day >= t.firstEntrantDay && rng.chance(1 / settings.entrants) && (!meta || meta.pendingEntrants <= 0)) startEntrant(state, rng, false);
}

function avgProfit(loc: RivalLocation): number {
  const h = loc.history.slice(-4);
  return h.length ? h.reduce((x, w) => x + w.profit, 0) / h.length : 0;
}

// ---------- For the Rivals tab ----------

export function weeklyPressureAt(state: GameState, rival: Rival): number {
  return rival.locations.reduce((x, l) => {
    const vf = venueFacts(l.venueId);
    return Math.max(x, proximity(state.districtId, state.venueId, vf.district.id, l.venueId));
  }, 0);
}

export const archetypeKnown = (state: GameState, r: Rival): boolean =>
  (r.mysteryUntil ?? 0) > state.day || (r.seenSince !== undefined && state.day - r.seenSince >= T.rivals.knownAfterDays);

export { ARCHETYPE_IDS };
