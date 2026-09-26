// More than one restaurant (prd.md 5.9, 5.12): the player runs one, restaurant managers run the rest.

import { DISTRICTS, PREMISES } from '../data/districts';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { analyse } from './analysis';
import { type DayOptions, simulateDay } from './day';
import { economyOf } from './economy';
import { type BranchDay, type GameState, LOCATION_KEYS, type Location, type Staff } from './state';

export function locationName(loc: Pick<GameState, 'venueId' | 'districtId' | 'premisesId'>): string {
  return (loc.venueId ? VENUES[loc.venueId]?.name : null) ?? `${PREMISES[loc.premisesId]?.name ?? 'Pizzeria'}, ${DISTRICTS[loc.districtId]?.name ?? ''}`;
}

/** The best restaurant manager on a team, if any. */
export function managerOf(staff: readonly Staff[]): Staff | undefined {
  return staff.filter((s) => s.role === 'manager').sort((a, b) => b.skill - a.skill)[0];
}

export interface ManagerEffect {
  /** Multiplier on guests who want to come in. */
  demand: number;
  /** Multiplier on waste (stock accuracy). */
  waste: number;
  /** Multiplier on ingredient costs. */
  ingredients: number;
}

/** What a manager of this skill does to a restaurant the player is not running (prd.md 5.9). */
export function managerEffect(m: Staff | undefined): ManagerEffect {
  const t = T.manager;
  if (!m) return { demand: 1 + t.caretakerDemand, waste: t.caretakerWaste, ingredients: 1 };
  const accuracy = Math.min(1, t.accuracyBase + t.accuracyPerSkill * m.skill);
  return {
    demand: 1 + t.demandBase + t.demandPerSkill * m.skill,
    waste: Math.max(0.5, 1 + t.wastePerAccuracy * (t.parityAccuracy - accuracy)),
    ingredients: m.traits.includes('frugal') ? t.frugalIngredients : 1,
  };
}

export function extractLocation(state: GameState): Location {
  const loc = { id: state.locationId } as Location;
  for (const k of LOCATION_KEYS) (loc as Record<string, unknown>)[k] = state[k];
  return loc;
}

export function applyLocation(state: GameState, loc: Location): void {
  for (const k of LOCATION_KEYS) (state as unknown as Record<string, unknown>)[k] = loc[k];
  state.locationId = loc.id;
}

/** Best reputation among the restaurants the player owns: the gate for opening another (prd.md 5.12). */
export function bestRep(state: GameState): number {
  return Math.max(state.rep, ...state.branches.map((b) => b.rep));
}

/** Every venue the player rents right now. */
export function ownedVenues(state: GameState): Set<string> {
  return new Set([state.venueId, ...state.branches.map((b) => b.venueId)].filter((v): v is string => !!v));
}

/** A managed restaurant's day: the same day model, with the manager's effect and shared cash. Returns the day and the weekly bills paid. */
export function runBranchDay(state: GameState, b: Location, weekday: number, opts: DayOptions): { day: BranchDay; weekly: number } {
  const manager = managerOf(b.staff);
  const eff = managerEffect(manager);
  const eco = economyOf(state);
  const s: GameState = {
    ...state,
    ...b,
    locationId: b.id,
    // Its own daily randomness; the loan belongs to the owner, not to the restaurant.
    seed: state.seed + b.id * 7919,
    loan: { ...state.loan, balance: 0 },
    economy: { ...eco, demand: eco.demand * eff.demand, ingredients: eco.ingredients * eff.ingredients },
  };
  const a = analyse(s);
  const report = simulateDay(s, a, opts);
  const p = report.pnl;
  p.waste *= eff.waste;
  p.profit = p.sales - p.ingredients - p.waste - p.staff - p.rent - p.utilities - p.upkeep - p.interest;
  state.cash += p.sales - p.ingredients - p.waste - p.utilities - p.upkeep;
  let weekly = 0;
  if (weekday === 6) {
    weekly = a.weeklySalaries + a.weeklyRent;
    state.cash -= weekly;
  }
  b.rep = report.repAfter;
  b.following = report.followingAfter;
  if (report.open) b.daysOpen += 1;
  b.history = [...b.history, report].slice(-28);
  state.totalServed += report.covers;
  return {
    day: {
      id: b.id, name: locationName(b), open: report.open, covers: report.covers, profit: p.profit,
      manager: manager?.name ?? null, managerSkill: manager?.skill ?? 0,
    },
    weekly,
  };
}

export const CARETAKER_TEXT = `Without a manager a restaurant runs in caretaker mode: ${Math.round(-T.manager.caretakerDemand * 100)}% fewer guests and more waste.`;
