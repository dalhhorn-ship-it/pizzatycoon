// Commands in, state and events out (solution-design.md 5.1). Never mutates its input.

import { DISTRICTS, PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { RECIPE_BOOK } from '../data/recipes';
import { FIRST_NAMES, LAST_NAMES, ROLE_BASE_SALARY, TRAITS } from '../data/staff';
import type { EquipmentItem, RankId, Role, TierId, TraitId, Unlock } from '../data/types';
import { T } from '../data/tunables';
import { analyse, occupiedTiles, salaryFor } from './analysis';
import { type DayOptions, simulateDay } from './day';
import { autoLayout, bestSpot, kitchenDims, layoutProblem } from './kitchen';
import { Rng } from './rng';
import { type DayReport, type GameState, type Recipe, type RecipeLine, SCHEMA_VERSION, type Staff } from './state';

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
  | { type: 'movePremises'; districtId: string; premisesId: string }
  | { type: 'hire'; candidateId: number }
  | { type: 'fire'; staffId: number }
  | { type: 'giveRaise'; staffId: number }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'setUnlockAll'; on: boolean }
  | { type: 'freshStart' }
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
  // fresh-start.md 4: the day 1 board always offers 2 cooks, 2 servers and a dishwasher of skill 2 to 4.
  const firstBoard: Role[] = state.day === 1 ? ['cook', 'cook', 'server', 'server', 'dishwasher'] : [];
  for (let i = 0; i < T.staff.candidatesPerWeek; i++) {
    const fixed = firstBoard[i];
    const role = fixed ?? rng.pick(roles);
    const skill = fixed ? rng.int(2, 4) : rng.int(role === 'chef' ? 5 : 2, role === 'chef' ? 9 : 7);
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

export function depositFor(districtId: string, premisesId: string): number {
  const district = DISTRICTS[districtId];
  const premises = PREMISES[premisesId];
  if (!district || !premises) return 0;
  const tiles = premises.diningWidth * premises.diningHeight + premises.kitchenTiles;
  return tiles * district.rentPerTile * T.finance.leaseDepositWeeks;
}

export function seatLimit(premisesId: string): number {
  const p = PREMISES[premisesId];
  return p ? Math.floor(T.build.maxSeatsPerDiningTile * p.diningWidth * p.diningHeight) : 0;
}

/** fresh-start.md 2: a new restaurant is empty. Only the deposit is paid. */
export function newGame(seed: number, districtId: string, premisesId = 'hole'): GameState {
  const district = DISTRICTS[districtId];
  const premises = PREMISES[premisesId];
  if (!district || !premises) throw new Error('Unknown district or premises');
  const recipes: Recipe[] = RECIPE_BOOK.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, lines: makeLines(t.ingredients), price: t.price, onMenu: false,
    extraTags: [...(t.tags ?? [])], custom: false,
  }));
  const deposit = depositFor(districtId, premisesId);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION, seed, day: 1, districtId, premisesId,
    cash: T.finance.startingCash - deposit, deposit,
    loan: { balance: 0, annualRate: T.finance.starterLoanRate, weeksLeft: 0, pausedWeeks: 0 },
    rep: T.reputation.start, totalServed: 0, rank: 'cook', recipes, furniture: [], equipment: [], staff: [], candidates: [],
    nextUid: 1, daysBelowZero: 0, history: [], unlockAll: false,
  };
  state.candidates = generateCandidates(state);
  state.nextUid += T.staff.candidatesPerWeek;
  return state;
}

const STARTER_LAYOUT: [string, number, number][] = [
  ['table4', 1, 1], ['table4', 5, 1], ['table2', 8, 1],
  ['table4', 1, 4], ['table4', 5, 4], ['table2', 8, 4],
  ['table2', 2, 6], ['table2', 6, 6],
  ['lamp', 0, 0], ['lamp', 9, 0], ['lamp', 0, 7], ['lamp', 9, 7],
  ['plant', 4, 0], ['plant', 4, 7], ['plant', 9, 3], ['plant', 0, 3],
  ['painting', 3, 3], ['painting', 7, 3],
];

/**
 * The balance.md 2 reference starter (cosy shop, 8 tables, deck oven, 5 staff, classic menu).
 * Not how the game starts any more; kept for the golden day tests and as a sandbox shortcut.
 */
export function withStarterKit(state: GameState): GameState {
  const s = structuredClone(state);
  let uid = s.nextUid;
  s.furniture = STARTER_LAYOUT.map(([itemId, x, y]) => ({ uid: uid++, itemId, x, y }));
  s.equipment = [
    { itemId: 'prepCounter', x: 0, y: 0, rot: 0 as const },
    { itemId: 'deckOven', x: 2, y: 0, rot: 0 as const },
    { itemId: 'prepCounter', x: 2, y: 2, rot: 0 as const },
    { itemId: 'sink', x: 6, y: 0, rot: 0 as const },
    { itemId: 'doughFridge', x: 9, y: 2, rot: 0 as const },
  ].map((e) => ({ uid: uid++, ...e }));
  s.staff = [
    makeStaff(uid++, 'Giulia Rossi', 'cook', 5, 7, 0, ['steady']),
    makeStaff(uid++, 'Marco Bakker', 'cook', 4, 7, 0, ['crowdPleaser']),
    makeStaff(uid++, 'Sofia Moreau', 'server', 5, 7, 0, ['charmer']),
    makeStaff(uid++, 'Luca Silva', 'server', 4, 6, 0, ['nightOwl']),
    makeStaff(uid++, 'Kofi Mensah', 'dishwasher', 4, 6, 0, ['steady']),
  ];
  for (const r of s.recipes) r.onMenu = RECIPE_BOOK.find((t) => t.id === r.id)?.onMenu ?? false;
  s.nextUid = uid;
  return s;
}

/** Tables first in a simple grid with aisles, then decor in free spots; respects the seat limit. */
function relayoutDining(furniture: GameState['furniture'], premisesId: string): { placed: GameState['furniture']; unplaced: GameState['furniture'] } {
  const p = PREMISES[premisesId];
  const W = p?.diningWidth ?? 10;
  const H = p?.diningHeight ?? 8;
  const limit = seatLimit(premisesId);
  const sorted = [...furniture].sort((a, b) => Number(FURNITURE[b.itemId]?.kind === 'table') - Number(FURNITURE[a.itemId]?.kind === 'table'));
  const placed: GameState['furniture'] = [];
  const unplaced: GameState['furniture'] = [];
  let seats = 0;
  for (const f of sorted) {
    const it = FURNITURE[f.itemId];
    if (!it) continue;
    const table = it.kind === 'table';
    if (table && seats + it.seats > limit) {
      unplaced.push(f);
      continue;
    }
    let spot: { x: number; y: number } | null = null;
    const occ = occupiedTiles(placed);
    const step = table ? 2 : 1;
    for (let y = table ? 1 : 0; y + it.h <= H && !spot; y += step) {
      for (let x = table ? 1 : 0; x + it.w <= W && !spot; x += table ? it.w + 1 : 1) {
        let free = true;
        for (let dx = 0; dx < it.w && free; dx++) for (let dy = 0; dy < it.h && free; dy++) if (occ.has(`${x + dx},${y + dy}`)) free = false;
        if (free) spot = { x, y };
      }
    }
    if (spot) {
      placed.push({ ...f, ...spot });
      if (table) seats += it.seats;
    } else unplaced.push(f);
  }
  return { placed, unplaced };
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
      if (cmd.on && !r.onMenu && count >= T.build.menuMaxItems) return fail(input, `The menu holds at most ${T.build.menuMaxItems} items.`);
      if (!cmd.on && r.onMenu && count <= T.build.menuMinItems) return fail(input, `Keep at least ${T.build.menuMinItems} items on the menu.`);
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
      if (!existing && item.kind === 'table') {
        const seats = state.furniture.reduce((a, f) => a + (FURNITURE[f.itemId]?.seats ?? 0), 0);
        const limit = seatLimit(state.premisesId);
        if (seats + item.seats > limit) return fail(input, `Fire safety: at most ${limit} seats in this room.`);
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
    case 'movePremises': {
      // fresh-start.md 3: overnight move; deposit refunded, new deposit paid, everything re-laid out.
      if (cmd.districtId === state.districtId && cmd.premisesId === state.premisesId) return fail(input, 'You already rent this place.');
      const newDeposit = depositFor(cmd.districtId, cmd.premisesId);
      if (!newDeposit) return fail(input, 'Unknown premises.');
      if (state.cash + state.deposit < newDeposit) return fail(input, `You need ${Math.ceil(newDeposit - state.deposit - state.cash).toLocaleString('en-US')} more for the deposit.`);
      state.cash += state.deposit - newDeposit;
      state.deposit = newDeposit;
      state.districtId = cmd.districtId;
      state.premisesId = cmd.premisesId;
      const notes: string[] = [];
      const kitchen = autoLayout(state.equipment, cmd.premisesId);
      state.equipment = kitchen.placed;
      for (const u of kitchen.unplaced) {
        const price = (EQUIPMENT[u.itemId]?.price ?? 0) * T.kitchen.resale;
        state.cash += price;
        notes.push(`${EQUIPMENT[u.itemId]?.name} did not fit and was sold`);
      }
      const room = relayoutDining(state.furniture, cmd.premisesId);
      state.furniture = room.placed;
      for (const f of room.unplaced) {
        state.cash += (FURNITURE[f.itemId]?.price ?? 0) * T.kitchen.resale;
        notes.push(`${FURNITURE[f.itemId]?.name} did not fit and was sold`);
      }
      events.push({ kind: 'info', text: `Moved to the ${PREMISES[cmd.premisesId]?.name} in ${DISTRICTS[cmd.districtId]?.name}.${notes.length ? ` ${notes.join('; ')}.` : ''}` });
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
      const fresh = newGame(state.seed + 1, state.districtId, state.premisesId);
      fresh.rank = state.rank;
      fresh.totalServed = state.totalServed;
      fresh.recipes = state.recipes.map((r) => ({ ...r }));
      fresh.unlockAll = state.unlockAll;
      events.push({ kind: 'info', text: 'A fresh start. Your recipes and unlocks come with you.' });
      return { state: fresh, events };
    }
    case 'runDay':
      return runDay(state, opts);
  }
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
