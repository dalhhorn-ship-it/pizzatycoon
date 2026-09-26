// Commands in, state and events out (solution-design.md 5.1). Never mutates its input.

import { DISTRICTS, PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { RECIPE_BOOK } from '../data/recipes';
import { FIRST_NAMES, LAST_NAMES, ROLE_BASE_SALARY, TRAITS } from '../data/staff';
import type { EquipmentItem, RankId, Role, TierId, TraitId, Unlock } from '../data/types';
import { T } from '../data/tunables';
import { VENUES } from '../data/venues';
import { analyse, occupiedTiles, salaryFor } from './analysis';
import { type DayOptions, simulateDay } from './day';
import { autoLayout, bestSpot, kitchenDims, layoutProblem, rectOf } from './kitchen';
import { locationFacts, stateLocation } from './location';
import { Rng } from './rng';
import { type DayReport, type GameState, type OwnedEquipment, type Recipe, type RecipeLine, SCHEMA_VERSION, type Staff } from './state';

export type Command =
  | { type: 'setTier'; recipeId: string; ingredientId: string; tier: TierId }
  | { type: 'setSupplier'; recipeId: string; ingredientId: string; supplierId: string }
  | { type: 'setPrice'; recipeId: string; price: number }
  | { type: 'toggleMenu'; recipeId: string; on: boolean }
  | { type: 'createPizza'; name: string; toppings: string[]; price: number }
  | { type: 'deleteRecipe'; recipeId: string }
  | { type: 'placeFurniture'; itemId: string; x: number; y: number }
  | { type: 'moveFurniture'; uid: number; x: number; y: number }
  | { type: 'removeFurniture'; uid: number }
  | { type: 'buyEquipment'; itemId: string; x?: number; y?: number; rot?: 0 | 1 }
  | { type: 'moveEquipment'; uid: number; x: number; y: number; rot: 0 | 1 }
  | { type: 'sellEquipment'; uid: number }
  | { type: 'tidyKitchen' }
  | { type: 'hire'; candidateId: number }
  | { type: 'fire'; staffId: number }
  | { type: 'giveRaise'; staffId: number }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'setUnlockAll'; on: boolean }
  | { type: 'freshStart' }
  | { type: 'rentVenue'; venueId: string }
  | { type: 'runDay' };

export interface GameEvent {
  kind: 'dayCompleted' | 'unlocked' | 'rankUp' | 'restructure' | 'staffLeft' | 'staffNotice' | 'info';
  text: string;
  report?: DayReport;
}

export interface Result {
  state: GameState;
  events: GameEvent[];
  error?: string;
}

const RANK_ORDER: RankId[] = ['cook', 'owner', 'restaurateur', 'chainFounder'];
export const RANK_NAMES: Record<RankId, string> = {
  cook: 'Cook', owner: 'Owner', restaurateur: 'Restaurateur', chainFounder: 'Chain Founder',
};

// ---------- Helpers ----------

/** Cheapest supplier that carries the tier for this ingredient's category (ties go to better quality). */
export function defaultSupplier(ingredientId: string, tier: TierId): string | null {
  const ing = INGREDIENTS[ingredientId];
  if (!ing) return null;
  const options = Object.values(SUPPLIERS)
    .filter((s) => s.carries[ing.category]?.includes(tier))
    .sort((a, b) => a.priceIndex - b.priceIndex || b.qualityOffset - a.qualityOffset);
  return options[0]?.id ?? null;
}

export function suppliersFor(ingredientId: string, tier: TierId): string[] {
  const ing = INGREDIENTS[ingredientId];
  if (!ing) return [];
  return Object.values(SUPPLIERS).filter((s) => s.carries[ing.category]?.includes(tier)).map((s) => s.id);
}

export function tiersFor(ingredientId: string): TierId[] {
  const ing = INGREDIENTS[ingredientId];
  if (!ing) return [];
  const set = new Set<TierId>();
  for (const s of Object.values(SUPPLIERS)) for (const t of s.carries[ing.category] ?? []) set.add(t);
  return (Object.keys(TIERS) as TierId[]).filter((t) => set.has(t));
}

function makeLines(ingredientIds: readonly string[], tier: TierId = 'standard'): RecipeLine[] {
  return ingredientIds.map((ingredientId) => {
    const t = tiersFor(ingredientId).includes(tier) ? tier : (tiersFor(ingredientId)[0] ?? 'standard');
    return { ingredientId, tier: t, supplierId: defaultSupplier(ingredientId, t) ?? 'fratelli' };
  });
}

export function isUnlocked(state: GameState, unlock: Unlock): boolean {
  if (state.unlockAll) return true;
  switch (unlock.kind) {
    case 'start': return true;
    case 'served': return state.totalServed >= unlock.guests;
    case 'rep': return state.rep >= unlock.rep;
    case 'day': return state.day >= unlock.day;
    case 'rank': return RANK_ORDER.indexOf(state.rank) >= RANK_ORDER.indexOf(unlock.rank);
  }
}

export function unlockText(unlock: Unlock): string {
  switch (unlock.kind) {
    case 'start': return 'Available';
    case 'served': return `Serve ${unlock.guests} guests`;
    case 'rep': return `Reputation ${unlock.rep}`;
    case 'day': return `Day ${unlock.day}`;
    case 'rank': return `Rank ${RANK_NAMES[unlock.rank]}`;
  }
}

function makeStaff(id: number, name: string, role: Role, skill: number, potential: number, fame: number, traits: TraitId[]): Staff {
  return {
    id, name, role, skill, potential, fame, traits, morale: T.staff.moraleStart,
    salary: salaryFor(role, skill, fame, ROLE_BASE_SALARY[role]), shiftsWorked: 0, lowMoraleDays: 0, leavingOnDay: null,
  };
}

function generateCandidates(state: GameState): Staff[] {
  const rng = Rng.stream(state.seed, state.day, 'hiring');
  const roles: Role[] = ['cook', 'cook', 'server', 'server', 'chef', 'host', 'dishwasher'];
  const traitIds = Object.keys(TRAITS) as TraitId[];
  const out: Staff[] = [];
  let fameUsed = false;
  for (let i = 0; i < T.staff.candidatesPerWeek; i++) {
    const role = rng.pick(roles);
    const skill = rng.int(role === 'chef' ? 5 : 2, role === 'chef' ? 9 : 7);
    const potential = Math.min(10, skill + rng.int(0, 3));
    let fame = 0;
    if (!fameUsed && state.rep >= T.staff.fameCandidateRep && skill >= 7 && rng.chance(0.5)) {
      fame = 1;
      fameUsed = true;
    }
    const t1 = rng.pick(traitIds);
    let t2 = rng.pick(traitIds);
    if (t2 === t1) t2 = rng.pick(traitIds);
    const traits = t1 === t2 ? [t1] : [t1, t2];
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    out.push(makeStaff(state.nextUid + i, name, role, skill, potential, fame, traits));
  }
  return out;
}

export function loanPayment(loan: GameState['loan']): number {
  if (loan.balance <= 0 || loan.weeksLeft <= 0) return 0;
  const r = loan.annualRate / 52;
  return (loan.balance * r) / (1 - Math.pow(1 + r, -loan.weeksLeft));
}

function computeRank(state: GameState): RankId {
  const p = T.progression;
  if (state.totalServed >= p.restaurateurServed && state.rep >= p.restaurateurRep) return 'restaurateur';
  if (state.totalServed >= p.ownerServed && state.rep >= p.ownerRep) return 'owner';
  return state.rank;
}

function unlockedIds(state: GameState): Set<string> {
  return new Set(Object.values(EQUIPMENT).filter((e) => isUnlocked(state, e.unlock)).map((e) => e.id));
}

// ---------- New game ----------

const STARTER_LAYOUT: [string, number, number][] = [
  ['table4', 1, 1], ['table4', 5, 1], ['table2', 8, 1],
  ['table4', 1, 4], ['table4', 5, 4], ['table2', 8, 4],
  ['table2', 2, 6], ['table2', 6, 6],
  ['lamp', 0, 0], ['lamp', 9, 0], ['lamp', 0, 7], ['lamp', 9, 7],
  ['plant', 4, 0], ['plant', 4, 7], ['plant', 9, 3], ['plant', 0, 3],
  ['painting', 3, 3], ['painting', 7, 3],
];

/** Start at a venue on the city map (city-map.md 6). */
export function newGameAt(seed: number, venueId: string): GameState {
  const venue = VENUES[venueId];
  if (!venue) throw new Error('Unknown venue');
  return newGame(seed, venue.districtId, venue.premisesId, venueId);
}

export function newGame(seed: number, districtId: string, premisesId = 'cosy', venueId: string | null = null): GameState {
  const district = DISTRICTS[districtId];
  const premises = PREMISES[premisesId];
  if (!district || !premises) throw new Error('Unknown district or premises');
  let uid = 1;
  const furniture = STARTER_LAYOUT.map(([itemId, x, y]) => ({ uid: uid++, itemId, x, y }));
  // kitchen-builder.md 3.4 starter layout.
  const equipment: OwnedEquipment[] = [
    { itemId: 'prepCounter', x: 0, y: 0, rot: 0 as const },
    { itemId: 'deckOven', x: 2, y: 0, rot: 0 as const },
    { itemId: 'prepCounter', x: 2, y: 2, rot: 0 as const },
    { itemId: 'sink', x: 6, y: 0, rot: 0 as const },
    { itemId: 'doughFridge', x: 9, y: 2, rot: 0 as const },
  ].map((e) => ({ uid: uid++, ...e }));
  // The reference layout is drawn for the cosy kitchen; bigger kitchens move the pass, so tidy it there.
  const starterKitchen = layoutProblem(equipment, kitchenDims(premisesId)) ? autoLayout(equipment, premisesId).placed : equipment;
  const staff: Staff[] = [
    makeStaff(uid++, 'Giulia Rossi', 'cook', 5, 7, 0, ['steady']),
    makeStaff(uid++, 'Marco Bakker', 'cook', 4, 7, 0, ['crowdPleaser']),
    makeStaff(uid++, 'Sofia Moreau', 'server', 5, 7, 0, ['charmer']),
    makeStaff(uid++, 'Luca Silva', 'server', 4, 6, 0, ['nightOwl']),
    makeStaff(uid++, 'Kofi Mensah', 'dishwasher', 4, 6, 0, ['steady']),
  ];
  const recipes: Recipe[] = RECIPE_BOOK.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, lines: makeLines(t.ingredients), price: t.price, onMenu: t.onMenu,
    extraTags: [...(t.tags ?? [])], custom: false,
  }));
  const deposit = locationFacts(districtId, premisesId, venueId).weeklyRent * T.finance.leaseDepositWeeks;
  const fitOut = furniture.reduce((a, f) => a + (FURNITURE[f.itemId]?.price ?? 0), 0);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION, seed, day: 1, districtId, premisesId, venueId,
    cash: T.finance.startingCash - deposit - fitOut,
    loan: { balance: 0, annualRate: T.finance.starterLoanRate, weeksLeft: 0, pausedWeeks: 0 },
    rep: T.reputation.start, totalServed: 0, rank: 'cook', recipes, furniture, equipment: starterKitchen, staff, candidates: [],
    nextUid: uid, daysBelowZero: 0, history: [], unlockAll: false,
  };
  state.candidates = generateCandidates(state);
  state.nextUid += T.staff.candidatesPerWeek;
  return state;
}

// ---------- Commands ----------

const fail = (state: GameState, error: string): Result => ({ state, events: [], error });

export function apply(input: GameState, cmd: Command, opts: DayOptions = { noise: true }): Result {
  const state = structuredClone(input);
  const events: GameEvent[] = [];
  const premises = PREMISES[state.premisesId];
  const W = premises?.diningWidth ?? 10;
  const H = premises?.diningHeight ?? 8;

  switch (cmd.type) {
    case 'setTier': {
      const line = state.recipes.find((r) => r.id === cmd.recipeId)?.lines.find((l) => l.ingredientId === cmd.ingredientId);
      if (!line) return fail(input, 'No such ingredient in this recipe.');
      if (!tiersFor(cmd.ingredientId).includes(cmd.tier)) return fail(input, 'No supplier sells that tier.');
      line.tier = cmd.tier;
      if (!suppliersFor(cmd.ingredientId, cmd.tier).includes(line.supplierId)) {
        line.supplierId = defaultSupplier(cmd.ingredientId, cmd.tier) ?? line.supplierId;
      }
      break;
    }
    case 'setSupplier': {
      const line = state.recipes.find((r) => r.id === cmd.recipeId)?.lines.find((l) => l.ingredientId === cmd.ingredientId);
      if (!line) return fail(input, 'No such ingredient in this recipe.');
      if (!suppliersFor(cmd.ingredientId, line.tier).includes(cmd.supplierId)) return fail(input, 'That supplier does not sell this tier.');
      line.supplierId = cmd.supplierId;
      break;
    }
    case 'setPrice': {
      const r = state.recipes.find((x) => x.id === cmd.recipeId);
      if (!r) return fail(input, 'Unknown dish.');
      r.price = Math.round(Math.max(1, Math.min(60, cmd.price)) * 2) / 2;
      break;
    }
    case 'toggleMenu': {
      const r = state.recipes.find((x) => x.id === cmd.recipeId);
      if (!r) return fail(input, 'Unknown dish.');
      const count = state.recipes.filter((x) => x.onMenu).length;
      if (cmd.on && !r.onMenu && count >= 16) return fail(input, 'The menu holds at most 16 items.');
      if (!cmd.on && r.onMenu && count <= 4) return fail(input, 'Keep at least 4 items on the menu.');
      r.onMenu = cmd.on;
      break;
    }
    case 'createPizza': {
      const toppings = cmd.toppings.filter((t) => INGREDIENTS[t] && !INGREDIENTS[t]?.base);
      if (toppings.length > 6) return fail(input, 'At most 6 toppings.');
      const name = cmd.name.trim().slice(0, 40) || 'House special';
      const id = `custom${state.nextUid++}`;
      state.recipes.push({
        id, name, kind: 'pizza', lines: makeLines(['dough', 'tomatoSauce', 'mozzarella', ...toppings]),
        price: cmd.price, onMenu: false, extraTags: [], custom: true,
      });
      events.push({ kind: 'info', text: `${name} added to your recipe book.` });
      break;
    }
    case 'deleteRecipe': {
      const r = state.recipes.find((x) => x.id === cmd.recipeId);
      if (!r || !r.custom) return fail(input, 'Only your own recipes can be deleted.');
      if (r.onMenu) return fail(input, 'Take it off the menu first.');
      state.recipes = state.recipes.filter((x) => x.id !== cmd.recipeId);
      break;
    }
    case 'placeFurniture':
    case 'moveFurniture': {
      const existing = cmd.type === 'moveFurniture' ? state.furniture.find((f) => f.uid === cmd.uid) : undefined;
      const itemId = cmd.type === 'placeFurniture' ? cmd.itemId : existing?.itemId;
      const item = itemId ? FURNITURE[itemId] : undefined;
      if (!item || !itemId) return fail(input, 'Unknown item.');
      if (cmd.x < 0 || cmd.y < 0 || cmd.x + item.w > W || cmd.y + item.h > H) return fail(input, 'That does not fit there.');
      const occ = occupiedTiles(state.furniture, existing?.uid);
      for (let dx = 0; dx < item.w; dx++) for (let dy = 0; dy < item.h; dy++) {
        if (occ.has(`${cmd.x + dx},${cmd.y + dy}`)) return fail(input, 'Something is already there.');
      }
      if (existing) {
        existing.x = cmd.x;
        existing.y = cmd.y;
      } else {
        if (state.cash < item.price) return fail(input, 'Not enough cash.');
        state.cash -= item.price;
        state.furniture.push({ uid: state.nextUid++, itemId, x: cmd.x, y: cmd.y });
      }
      break;
    }
    case 'removeFurniture': {
      const f = state.furniture.find((x) => x.uid === cmd.uid);
      if (!f) return fail(input, 'Nothing there.');
      state.cash += (FURNITURE[f.itemId]?.price ?? 0) * T.kitchen.resale;
      state.furniture = state.furniture.filter((x) => x.uid !== cmd.uid);
      break;
    }
    case 'buyEquipment': {
      const item = EQUIPMENT[cmd.itemId];
      if (!item) return fail(input, 'Unknown equipment.');
      if (!isUnlocked(state, item.unlock)) return fail(input, `Locked: ${unlockText(item.unlock)}.`);
      if (state.cash < item.price) return fail(input, `You need ${Math.ceil(item.price - state.cash).toLocaleString('en-US')} more.`);
      const dims = kitchenDims(state.premisesId);
      const uid = state.nextUid;
      const placed =
        cmd.x !== undefined && cmd.y !== undefined
          ? { uid, itemId: item.id, x: cmd.x, y: cmd.y, rot: cmd.rot ?? 0 }
          : bestSpot(state.equipment, uid, item.id, dims);
      if (!placed) return fail(input, 'There is no room for that in the kitchen. Sell or move something first.');
      const problem = layoutProblem([...state.equipment, placed], dims);
      if (problem) return fail(input, problem);
      state.nextUid += 1;
      state.cash -= item.price;
      state.equipment.push(placed);
      break;
    }
    case 'moveEquipment': {
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      if (!e) return fail(input, 'Not found.');
      e.x = cmd.x;
      e.y = cmd.y;
      e.rot = cmd.rot;
      const problem = layoutProblem(state.equipment, kitchenDims(state.premisesId));
      if (problem) return fail(input, problem);
      break;
    }
    case 'tidyKitchen': {
      const { placed, unplaced } = autoLayout(state.equipment, state.premisesId);
      if (unplaced.length) return fail(input, 'Tidy up could not fit everything; move items by hand.');
      state.equipment = placed;
      break;
    }
    case 'sellEquipment': {
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      if (!e) return fail(input, 'Not found.');
      state.cash += (EQUIPMENT[e.itemId]?.price ?? 0) * T.kitchen.resale;
      state.equipment = state.equipment.filter((x) => x.uid !== cmd.uid);
      break;
    }
    case 'hire': {
      const c = state.candidates.find((x) => x.id === cmd.candidateId);
      if (!c) return fail(input, 'That candidate is no longer available.');
      state.candidates = state.candidates.filter((x) => x.id !== cmd.candidateId);
      state.staff.push(c);
      events.push({ kind: 'info', text: `${c.name} joins the team.` });
      break;
    }
    case 'fire': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      state.cash -= s.salary * T.staff.severanceWeeks;
      state.staff = state.staff.filter((x) => x.id !== cmd.staffId);
      events.push({ kind: 'info', text: `${s.name} leaves with two weeks' pay.` });
      break;
    }
    case 'giveRaise': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      s.salary = Math.round(s.salary * (1 + T.staff.raiseFraction) * 100) / 100;
      s.morale = Math.min(100, s.morale + T.staff.raiseMorale);
      s.leavingOnDay = null;
      s.lowMoraleDays = 0;
      break;
    }
    case 'takeLoan': {
      const room = T.finance.starterLoanMax - state.loan.balance;
      const amount = Math.min(room, Math.max(0, Math.round(cmd.amount)));
      if (amount <= 0) return fail(input, 'The bank will not lend more right now.');
      state.loan.balance += amount;
      state.loan.weeksLeft = T.finance.starterLoanWeeks;
      state.cash += amount;
      break;
    }
    case 'repayLoan': {
      const amount = Math.min(state.loan.balance, Math.max(0, cmd.amount), Math.max(0, state.cash));
      if (amount <= 0) return fail(input, 'Nothing to repay.');
      state.loan.balance -= amount;
      state.cash -= amount;
      if (state.loan.balance < 0.01) state.loan = { ...state.loan, balance: 0, weeksLeft: 0 };
      break;
    }
    case 'setUnlockAll':
      state.unlockAll = cmd.on;
      break;
    case 'freshStart': {
      if (state.cash > T.finance.freshStartThreshold) return fail(input, 'A fresh start is offered when cash falls below -$20,000.');
      const fresh = newGame(state.seed + 1, state.districtId, state.premisesId, state.venueId);
      fresh.rank = state.rank;
      fresh.totalServed = state.totalServed;
      fresh.recipes = state.recipes.map((r) => ({ ...r }));
      fresh.unlockAll = state.unlockAll;
      events.push({ kind: 'info', text: 'A fresh start. Your recipes and unlocks come with you.' });
      return { state: fresh, events };
    }
    case 'rentVenue':
      return rentVenue(input, cmd.venueId);
    case 'runDay':
      return runDay(state, opts);
  }
  return { state, events };
}

// ---------- Moving (city-map.md 6) ----------

export interface MoveQuote {
  newDeposit: number;
  refund: number;
  movingFee: number;
  net: number;
  repAfter: number;
  sameDistrict: boolean;
  /** Items that will not fit and are sold at the resale rate. */
  soldFurniture: string[];
  soldEquipment: string[];
  resale: number;
  /** What the move takes from cash: net minus the resale of items that do not fit. */
  total: number;
}

function moveFurniture(state: GameState, W: number, H: number): { kept: GameState['furniture']; sold: GameState['furniture'] } {
  const kept: GameState['furniture'] = [];
  const sold: GameState['furniture'] = [];
  for (const f of state.furniture) {
    const it = FURNITURE[f.itemId];
    if (it && f.x + it.w <= W && f.y + it.h <= H) kept.push(f);
    else sold.push(f);
  }
  return { kept, sold };
}

/** Keep the player's own kitchen layout when it still fits; otherwise tidy it into the new kitchen. */
function moveKitchen(state: GameState, premisesId: string): { placed: OwnedEquipment[]; unplaced: { uid: number; itemId: string }[] } {
  const dims = kitchenDims(premisesId);
  const fits = state.equipment.every((e) => {
    const r = rectOf(e);
    return r.x + r.w <= dims.W && r.y + r.h <= dims.H;
  });
  if (fits && !layoutProblem(state.equipment, dims)) return { placed: state.equipment, unplaced: [] };
  return autoLayout(state.equipment, premisesId);
}

/** Everything the confirm sheet shows; rentVenue charges exactly this. */
export function moveQuote(state: GameState, venueId: string): MoveQuote | null {
  const venue = VENUES[venueId];
  const premises = venue ? PREMISES[venue.premisesId] : undefined;
  if (!venue || !premises) return null;
  const weeks = T.finance.leaseDepositWeeks;
  const refund = stateLocation(state).weeklyRent * weeks;
  const newDeposit = locationFacts(venue.districtId, venue.premisesId, venueId).weeklyRent * weeks;
  const { sold } = moveFurniture(state, premises.diningWidth, premises.diningHeight);
  const { unplaced } = moveKitchen(state, venue.premisesId);
  const resale =
    (sold.reduce((a, f) => a + (FURNITURE[f.itemId]?.price ?? 0), 0) +
      unplaced.reduce((a, e) => a + (EQUIPMENT[e.itemId]?.price ?? 0), 0)) * T.kitchen.resale;
  const sameDistrict = venue.districtId === state.districtId;
  const keep = sameDistrict ? T.city.repKeepSameDistrict : T.city.repKeepOtherDistrict;
  const repAfter = state.rep * keep + T.reputation.start * (1 - keep);
  return {
    newDeposit, refund, movingFee: T.city.movingFee, net: newDeposit - refund + T.city.movingFee, repAfter, sameDistrict,
    soldFurniture: sold.map((f) => FURNITURE[f.itemId]?.name ?? f.itemId),
    soldEquipment: unplaced.map((e) => EQUIPMENT[e.itemId]?.name ?? e.itemId),
    resale,
    total: newDeposit - refund + T.city.movingFee - resale,
  };
}

function rentVenue(input: GameState, venueId: string): Result {
  const venue = VENUES[venueId];
  const quote = moveQuote(input, venueId);
  if (!venue || !quote) return fail(input, 'Unknown venue.');
  if (input.venueId === venueId) return fail(input, 'You already rent this venue.');
  if (quote.total > 0 && input.cash < quote.total) return fail(input, `Moving costs $${Math.ceil(quote.total).toLocaleString('en-US')}; you need $${Math.ceil(quote.total - input.cash).toLocaleString('en-US')} more.`);
  const state = structuredClone(input);
  const premises = PREMISES[venue.premisesId] as NonNullable<(typeof PREMISES)[string]>;
  state.furniture = moveFurniture(state, premises.diningWidth, premises.diningHeight).kept;
  state.equipment = moveKitchen(state, venue.premisesId).placed;
  state.cash -= quote.total;
  state.rep = quote.repAfter;
  state.districtId = venue.districtId;
  state.premisesId = venue.premisesId;
  state.venueId = venue.id;
  const events: GameEvent[] = [{ kind: 'info', text: `Welcome to ${venue.name}, ${DISTRICTS[venue.districtId]?.name ?? ''}!` }];
  const sold = [...quote.soldFurniture, ...quote.soldEquipment];
  if (sold.length) events.push({ kind: 'info', text: `Sold what did not fit (${sold.join(', ')}) for $${Math.round(quote.resale).toLocaleString('en-US')}.` });
  return { state, events };
}

// ---------- Day settlement ----------

function runDay(state: GameState, opts: DayOptions): Result {
  const events: GameEvent[] = [];
  const unlockedBefore = unlockedIds(state);
  const rankBefore = state.rank;
  const a = analyse(state);
  const report = simulateDay(state, a, opts);
  const p = report.pnl;

  // Daily cash: sales in, ingredients (bought just in time in M0), utilities and upkeep out.
  state.cash += p.sales - p.ingredients - p.waste - p.utilities - p.upkeep;
  let weekly = 0;
  if (report.weekday === 6) {
    weekly += a.weeklySalaries + a.weeklyRent;
    if (state.loan.pausedWeeks > 0) {
      state.loan.pausedWeeks -= 1;
    } else if (state.loan.balance > 0) {
      const pay = loanPayment(state.loan);
      const interest = (state.loan.balance * state.loan.annualRate) / 52;
      state.loan.balance = Math.max(0, state.loan.balance - (pay - interest));
      state.loan.weeksLeft = Math.max(0, state.loan.weeksLeft - 1);
      weekly += pay;
    }
    state.cash -= weekly;
  }
  report.weeklyPayments = weekly;
  report.cashAfter = state.cash;

  state.rep = report.repAfter;
  state.totalServed += report.covers;

  // Staff: morale drift, growth, notices (prd.md 5.8).
  const understaffed = a.service.loadMult < 1;
  const rng = Rng.stream(state.seed, state.day, 'staff');
  for (const s of [...state.staff]) {
    const drift = Math.sign(T.staff.moraleTarget - s.morale) * Math.min(T.staff.moraleDrift, Math.abs(T.staff.moraleTarget - s.morale));
    s.morale += drift + (understaffed && s.role === 'server' ? T.staff.understaffedMorale : 0);
    if (s.traits.includes('steady')) s.morale = Math.max(T.staff.steadyFloor, s.morale);
    s.morale = Math.max(0, Math.min(100, s.morale));
    if (report.open) s.shiftsWorked += 1;
    if (s.shiftsWorked > 0 && s.shiftsWorked % T.staff.shiftsPerSkill === 0 && s.skill < s.potential) {
      s.skill += 1;
      events.push({ kind: 'info', text: `${s.name} has grown into a skill ${s.skill} ${s.role}.` });
    }
    if (s.morale < T.staff.noticeMorale) s.lowMoraleDays += 1;
    else s.lowMoraleDays = 0;
    if (s.leavingOnDay === null && s.lowMoraleDays >= T.staff.noticeDays) {
      s.leavingOnDay = state.day + T.staff.noticeDays;
      events.push({ kind: 'staffNotice', text: `${s.name} has handed in notice. A raise could change their mind.` });
    }
    if (s.leavingOnDay !== null && state.day >= s.leavingOnDay) {
      state.staff = state.staff.filter((x) => x.id !== s.id);
      events.push({ kind: 'staffLeft', text: `${s.name} has left.` });
    }
  }
  if (state.day % T.staff.mentorDays === 0) {
    for (const m of state.staff.filter((s) => s.traits.includes('mentor'))) {
      const mentee = state.staff
        .filter((s) => s.role === m.role && s.id !== m.id && s.skill < s.potential)
        .sort((x, y) => x.skill - y.skill || rng.next() - 0.5)[0];
      if (mentee) {
        mentee.skill += 1;
        events.push({ kind: 'info', text: `${m.name} mentored ${mentee.name} (+1 skill).` });
      }
    }
  }

  // Safety net (prd.md 5.11): never a game over.
  if (state.cash < 0) {
    state.daysBelowZero += 1;
    if (state.daysBelowZero === T.finance.restructureDays && state.loan.balance > 0) {
      state.loan.pausedWeeks = T.finance.restructureWeeks;
      events.push({ kind: 'restructure', text: 'The bank advisor has paused your loan payments for 4 weeks to give you breathing room.' });
    }
  } else {
    state.daysBelowZero = 0;
  }

  state.rank = computeRank(state);
  if (state.rank !== rankBefore) events.push({ kind: 'rankUp', text: `You are now a ${RANK_NAMES[state.rank]}!` });

  state.history = [...state.history, report].slice(-56);
  state.day += 1;
  if (report.weekday === 6) {
    state.candidates = generateCandidates(state);
    state.nextUid += T.staff.candidatesPerWeek;
  }

  const unlockedAfter = unlockedIds(state);
  for (const id of unlockedAfter) {
    if (!unlockedBefore.has(id)) events.push({ kind: 'unlocked', text: `New equipment available: ${(EQUIPMENT[id] as EquipmentItem).name}.` });
  }
  events.unshift({ kind: 'dayCompleted', text: `Day ${report.day} complete.`, report });
  return { state, events };
}
