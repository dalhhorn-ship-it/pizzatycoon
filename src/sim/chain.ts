// More than one restaurant (prd.md 5.9, 5.12): the player runs one, restaurant managers run the rest.

import { DISTRICTS, PREMISES } from '../data/districts';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import type { DayOptions } from './day';
import { economyOf } from './economy';
import { hasTalent, managerOf, ovr } from './staff';
import { type BranchDay, type GameState, LOCATION_KEYS, type Location, type Staff } from './state';
import { dayRun, managerWeek, teamDay, type TeamEvent } from './team';

export { managerOf };

export function locationName(loc: Pick<GameState, 'venueId' | 'districtId' | 'premisesId'>): string {
  return (loc.venueId ? VENUES[loc.venueId]?.name : null) ?? `${PREMISES[loc.premisesId]?.name ?? 'Pizzeria'}, ${DISTRICTS[loc.districtId]?.name ?? ''}`;
}

export interface ManagerEffect {
  /** Multiplier on guests who want to come in. */
  demand: number;
  /** Multiplier on waste (stock accuracy). */
  waste: number;
  /** Multiplier on ingredient costs. */
  ingredients: number;
}

/** A manager's skill m on the old 1 to 10 scale: OVR / 10 (staff-management.md 2.2). */
export const managerSkill = (m: Staff): number => ovr(m) / 10;

/** What a manager of this skill does to a restaurant the player is not running (prd.md 5.9). */
export function managerEffect(m: Staff | undefined): ManagerEffect {
  const t = T.manager;
  if (!m) return { demand: 1 + t.caretakerDemand, waste: t.caretakerWaste, ingredients: 1 };
  const skill = managerSkill(m);
  const accuracy = Math.min(1, t.accuracyBase + t.accuracyPerSkill * skill);
  return {
    demand: 1 + t.demandBase + t.demandPerSkill * skill,
    waste: Math.max(0.5, 1 + t.wastePerAccuracy * (t.parityAccuracy - accuracy)),
    ingredients: hasTalent(m, 'frugal') ? t.frugalIngredients : 1,
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
  return Math.max(state.rep, ...(state.branches ?? []).map((b) => b.rep));
}

/** Every venue the player rents right now. */
export function ownedVenues(state: GameState): Set<string> {
  return new Set([state.venueId, ...state.branches.map((b) => b.venueId)].filter((v): v is string => !!v));
}

/** A managed restaurant's day: the same day model, with the manager's effect and shared cash. Returns the day and the weekly bills paid. */
export function runBranchDay(state: GameState, b: Location, weekday: number, opts: DayOptions): { day: BranchDay; weekly: number; events: TeamEvent[] } {
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
  const { a, report } = dayRun(s, opts);
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
  state.totalServed += report.covers;
  // The manager runs the team (staff-management.md 8): staff grow and change morale here too.
  // Contributions are measured on Sundays only, for the manager's decisions.
  const view: GameState = { ...s, cash: state.cash, staff: b.staff, departures: b.departures, managerLog: b.managerLog, staffPolicy: b.staffPolicy, candidates: state.candidates, nextUid: state.nextUid, history: b.history };
  const team = teamDay(view, report, a, { ...opts, managed: true, contrib: weekday === 6, bestRep: bestRep(state) });
  b.staff = view.staff;
  b.departures = view.departures;
  b.managerLog = view.managerLog;
  state.candidates = view.candidates;
  state.nextUid = view.nextUid;
  state.cash = view.cash;
  b.history = [...b.history, report].slice(-28);
  const week = weekday === 6 ? managerWeek(b as unknown as GameState) : null;
  return {
    day: {
      id: b.id, name: locationName(b), open: report.open, covers: report.covers, profit: p.profit,
      manager: manager?.name ?? null, managerSkill: manager ? ovr(manager) : 0,
      staffLine: week?.line, proposal: week?.proposal,
    },
    weekly,
    events: team.events.map((e) => ({ ...e, text: `${locationName(b)}: ${e.text}` })),
  };
}

export const CARETAKER_TEXT = `Without a manager a restaurant runs in caretaker mode: ${Math.round(-T.manager.caretakerDemand * 100)}% fewer guests and more waste.`;
