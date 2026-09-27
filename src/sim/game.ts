// Commands in, state and events out (solution-design.md 5.1). Never mutates its input.

import { DISTRICTS, PREMISES } from '../data/districts';
import { ADDONS, type AddonItem, UPGRADE_PATHS } from '../data/addons';
import { EQUIPMENT } from '../data/equipment';
import { FIRE_SAFETY } from '../data/fireSafety';
import { ROOM_TOUCHES } from '../data/roomTouches';
import { FURNITURE } from '../data/furniture';
import { INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { menuSection, PIZZA_BASE, PRIMO_BASES, RECIPE_BOOK } from '../data/recipes';
import { ROLE_NAMES } from '../data/staff';
import { COURSES } from '../data/training';
import type { AttrId, EquipmentItem, MainKind, RankId, Role, TierId, Unlock } from '../data/types';
import { T } from '../data/tunables';
import { VENUES, venueFor } from '../data/venues';
import { occupiedTiles } from './analysis';
import type { DayOptions } from './day';
import { buyPrice, clampEconomy, type Economy, economyOf, sellPrice, startFollowing } from './economy';
import { autoLayout, bestSpot, kitchenDims, layoutProblem, rectOf } from './kitchen';
import { locationFacts } from './location';
import { applyLocation, bestRep, extractLocation, locationName, managerOf, ownedVenues, runBranchDay } from './chain';
import { Rng } from './rng';
import { coachProblem, hasPersonality, interestProblem, ovr, salaryFor, staffFromSkill } from './staff';
import { CAMPAIGNS, type CampaignId } from '../data/campaigns';
import type { SegmentId } from '../data/types';
import type { Analysis } from './analysis';
import { simulateDay } from './day';
import { rivalSettingsOf } from './economy';
import { campaignCost, newCampaign, renewCampaigns, slotsUsed, streakOnRestart } from './marketing';
import { applyRivalToggle, inReach, ownRestaurants, playerCompetition, rivalAt, runRivalsDay, seedRivals } from './rivals';
import { stateLocation } from './location';
import { dailyCash, type DayReport, type GameState, type OwnedEquipment, type Recipe, type RecipeLine, SCHEMA_VERSION, type StaffPolicy } from './state';
import {
  bookCourse, dayRun, deliverAgency, ensureEveryRole as fillRoles, firstMarket, HIREABLE_ROLES, hiredFromMarket, managerWeek, policyOf,
  recordDeparture, refreshMarket, teamDay, weekNumber,
} from './team';

export { HIREABLE_ROLES };

export type Command =
  | { type: 'setTier'; recipeId: string; ingredientId: string; tier: TierId }
  | { type: 'setSupplier'; recipeId: string; ingredientId: string; supplierId: string }
  | { type: 'setPrice'; recipeId: string; price: number }
  | { type: 'toggleMenu'; recipeId: string; on: boolean }
  | { type: 'createPizza'; name: string; toppings: string[]; price: number }
  /** A custom main. `base` is the pasta or rice for a primo; pizzas always get dough, sauce and mozzarella. */
  | { type: 'createDish'; kind: MainKind; name: string; base?: string; ingredients: string[]; price: number }
  | { type: 'deleteRecipe'; recipeId: string }
  | { type: 'placeFurniture'; itemId: string; x: number; y: number }
  | { type: 'moveFurniture'; uid: number; x: number; y: number }
  | { type: 'removeFurniture'; uid: number }
  | { type: 'buyEquipment'; itemId: string; x?: number; y?: number; rot?: 0 | 1 }
  | { type: 'moveEquipment'; uid: number; x: number; y: number; rot: 0 | 1 }
  | { type: 'sellEquipment'; uid: number }
  | { type: 'tidyKitchen' }
  | { type: 'installAddon'; uid: number; addonId: string }
  | { type: 'removeAddon'; uid: number; addonId: string }
  | { type: 'upgradeStation'; uid: number; toItemId: string }
  | { type: 'movePremises'; districtId: string; premisesId: string }
  /** Hire at the asking salary, or offer 10% below (staff-management.md 4.4). */
  | { type: 'hire'; candidateId: number; low?: boolean }
  | { type: 'interview'; candidateId: number }
  | { type: 'agency'; role: Role; plus?: boolean }
  | { type: 'fire'; staffId: number; locationId?: number }
  | { type: 'giveRaise'; staffId: number; locationId?: number }
  | { type: 'train'; staffId: number; courseId: string; locationId?: number }
  | { type: 'coach'; coachId: number; traineeId: number; attr: AttrId; locationId?: number }
  | { type: 'stopCoaching'; coachId: number; locationId?: number }
  | { type: 'promote'; staffId: number; role: Role; locationId?: number }
  | { type: 'daysOff'; staffId: number; locationId?: number }
  | { type: 'answerReview'; staffId: number; accept: boolean; locationId?: number }
  | { type: 'answerOffer'; staffId: number; match: boolean; locationId?: number }
  | { type: 'setStaffPolicy'; policy: Partial<StaffPolicy>; locationId?: number }
  | { type: 'setDelegateStaff'; on: boolean }
  /** Marketing (competition.md 5). */
  | { type: 'startCampaign'; campaignId: CampaignId; audience: SegmentId[]; locationId?: number }
  | { type: 'stopCampaign'; campaignId: CampaignId; locationId?: number }
  /** Hold a free venue for 28 days so no rival takes it (3.5). */
  | { type: 'holdVenue'; venueId: string }
  /** Mystery diner at a rival (7.3). */
  | { type: 'mysteryDiner'; rivalId: number }
  | { type: 'takeLoan'; amount: number }
  | { type: 'repayLoan'; amount: number }
  | { type: 'setUnlockAll'; on: boolean }
  | { type: 'setEconomy'; economy: Partial<Economy> }
  | { type: 'freshStart' }
  | { type: 'rentVenue'; venueId: string }
  | { type: 'buyFireSafety'; id: string }
  | { type: 'buyRoomTouch'; id: string }
  | { type: 'removeRoomTouch'; id: string }
  /** Open a second (third...) restaurant; the current one stays open under its restaurant manager. */
  | { type: 'openRestaurant'; venueId: string }
  /** Go and run another restaurant you own; the one you leave needs a manager. */
  | { type: 'switchRestaurant'; locationId: number }
  | { type: 'runDay' }
  /** Fast forward: up to 7 days, stopping early when something needs the player (see WEEK_STOPS, and a closed day with a single restaurant). */
  | { type: 'runWeek' };

export interface GameEvent {
  kind: 'dayCompleted' | 'weekCompleted' | 'unlocked' | 'rankUp' | 'restructure' | 'staffLeft' | 'staffNotice' | 'staffReview' | 'staffOffer' | 'market' | 'info';
  text: string;
  report?: DayReport;
  /** weekCompleted: every day that ran, and why it stopped early (null when all 7 ran). */
  reports?: DayReport[];
  stoppedBecause?: string | null;
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

const money0 = (n: number): string => `$${Math.ceil(n).toLocaleString('en-US')}`;

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

/** Adds recipe book dishes a save does not know yet (new content after an update), off the menu. */
export function withRecipeBook(state: GameState): GameState {
  const known = new Set(state.recipes.map((r) => r.id));
  for (const t of RECIPE_BOOK) {
    if (known.has(t.id)) continue;
    state.recipes.push({
      id: t.id, name: t.name, kind: t.kind, lines: makeLines(t.ingredients), price: t.price, onMenu: false,
      extraTags: [...(t.tags ?? [])], custom: false,
    });
  }
  return state;
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

/** Adds a candidate for every role missing from the market (after a hire, or for an older save). */
export function ensureEveryRole(state: GameState): void {
  fillRoles(state, bestRep(state));
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

export function depositFor(districtId: string, premisesId: string, venueId: string | null = null): number {
  if (!DISTRICTS[districtId] || !PREMISES[premisesId]) return 0;
  return locationFacts(districtId, premisesId, venueId).weeklyRent * T.finance.leaseDepositWeeks;
}

/** Deposit for a venue on the city map (city-map.md 6). */
export function venueDeposit(venueId: string): number {
  const v = VENUES[venueId];
  return v ? depositFor(v.districtId, v.premisesId, v.id) : 0;
}

export function seatLimit(premisesId: string, fireSafety: readonly string[] = []): number {
  const p = PREMISES[premisesId];
  const bonus = fireSafety.reduce((a, id) => a + (FIRE_SAFETY[id]?.seatBonus ?? 0), 0);
  return p ? Math.floor(T.build.maxSeatsPerDiningTile * p.diningWidth * p.diningHeight * (1 + bonus)) : 0;
}

/** fresh-start.md 2: a new restaurant is empty. Only the deposit is paid. */
/** Start at a venue on the city map (city-map.md 2). */
export function newGameAt(seed: number, venueId: string, economy?: Economy): GameState {
  const venue = VENUES[venueId];
  if (!venue) throw new Error('Unknown venue');
  return newGame(seed, venue.districtId, venue.premisesId, economy, venueId);
}

export function newGame(seed: number, districtId: string, premisesId = 'hole', economy?: Economy, venueId: string | null = null): GameState {
  const district = DISTRICTS[districtId];
  const premises = PREMISES[premisesId];
  if (!district || !premises) throw new Error('Unknown district or premises');
  const recipes: Recipe[] = RECIPE_BOOK.map((t) => ({
    id: t.id, name: t.name, kind: t.kind, lines: makeLines(t.ingredients), price: t.price, onMenu: false,
    extraTags: [...(t.tags ?? [])], custom: false,
  }));
  const deposit = depositFor(districtId, premisesId, venueId);
  const state: GameState = {
    schemaVersion: SCHEMA_VERSION, seed, day: 1, districtId, premisesId, venueId,
    cash: Math.round(T.finance.startingCash * (economy?.startingCash ?? 1)) - deposit, deposit,
    loan: { balance: 0, annualRate: T.finance.starterLoanRate, weeksLeft: 0, pausedWeeks: 0 },
    rep: T.reputation.start, following: startFollowing({ economy }), totalServed: 0, rank: 'cook', recipes, furniture: [], equipment: [], staff: [], candidates: [],
    nextUid: 1, daysBelowZero: 0, daysOpen: 0, fireSafety: [], roomTouches: [], history: [], locationId: 1, branches: [], unlockAll: false,
  };
  if (economy) state.economy = clampEconomy(economy);
  state.openedIn = { [districtId]: 1 };
  // Live rivals are placed when the game is created, so the welcome map already shows them (competition.md 3.2).
  if (rivalSettingsOf(state).on) seedRivals(state);
  firstMarket(state);
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
  // kitchen-builder.md 3.4 layout, placed relative to the pass hatch so it fits any kitchen size.
  const kd = kitchenDims(s.premisesId);
  const px = kd.pass[0]?.[0] ?? 4;
  s.equipment = [
    { itemId: 'prepCounter', x: px - 4, y: 0, rot: 0 as const },
    { itemId: 'deckOven', x: px - 2, y: 0, rot: 0 as const },
    { itemId: 'prepCounter', x: px - 2, y: 2, rot: 0 as const },
    { itemId: 'sink', x: px + 2, y: 0, rot: 0 as const },
    { itemId: 'doughFridge', x: kd.W - 1, y: kd.H - 1, rot: 0 as const },
  ].map((e) => ({ uid: uid++, ...e }));
  s.staff = [
    staffFromSkill(uid++, 'Giulia Rossi', 'cook', 5, { potential: 7, personality: ['steady'] }),
    staffFromSkill(uid++, 'Marco Bakker', 'cook', 4, { potential: 7, talent: 'crowdPleaser' }),
    staffFromSkill(uid++, 'Sofia Moreau', 'server', 5, { potential: 7, talent: 'charmer' }),
    staffFromSkill(uid++, 'Luca Silva', 'server', 4, { potential: 6, talent: 'nightOwl' }),
    staffFromSkill(uid++, 'Kofi Mensah', 'dishwasher', 4, { potential: 6, personality: ['steady'] }),
  ];
  // The reference kitchen is drawn for the cosy shop; bigger kitchens move the pass, so tidy it there.
  if (layoutProblem(s.equipment, kitchenDims(s.premisesId))) s.equipment = autoLayout(s.equipment, s.premisesId).placed;
  for (const r of s.recipes) r.onMenu = RECIPE_BOOK.find((t) => t.id === r.id)?.onMenu ?? false;
  // The reference starter is an established restaurant: the neighbourhood already knows it (balance.md 4.3).
  s.following = 1;
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

/** Why an add-on cannot go on this station, or null (kitchen-upgrades.md 2). */
export function addonProblem(state: GameState, e: OwnedEquipment, addon: AddonItem): string | null {
  if (!addon.fits.includes(e.itemId)) return 'That does not fit this station.';
  if (!isUnlocked(state, addon.unlock)) return `Locked: ${unlockText(addon.unlock)}.`;
  const installed = e.addons ?? [];
  if (installed.some((a) => a.id === addon.id)) return 'Already installed.';
  if (installed.length >= T.addons.maxPerStation) return 'Station full, remove one first.';
  return null;
}

// ---------- Commands ----------

const fail = (state: GameState, error: string): Result => ({ state, events: [], error });

/** Staff commands can target a managed restaurant (Override, staff-management.md 1.1): run them there. */
function atLocation(input: GameState, cmd: Command & { locationId?: number }, opts: DayOptions): Result | null {
  if (cmd.locationId === undefined || cmd.locationId === input.locationId) return null;
  const target = input.branches.find((b) => b.id === cmd.locationId);
  if (!target) return fail(input, 'You do not own that restaurant.');
  const state = structuredClone(input);
  const here = extractLocation(state);
  state.branches = state.branches.map((b) => (b.id === target.id ? here : b));
  applyLocation(state, structuredClone(target));
  const r = apply(state, { ...cmd, locationId: undefined } as Command, opts);
  if (r.error) return fail(input, r.error);
  const out = r.state;
  const there = extractLocation(out);
  const back = out.branches.find((b) => b.id === here.id);
  if (!back) return fail(input, 'Lost track of your restaurant.');
  out.branches = out.branches.map((b) => (b.id === here.id ? there : b));
  applyLocation(out, back);
  return { state: out, events: r.events };
}

export function apply(input: GameState, cmd: Command, opts: DayOptions = { noise: true }): Result {
  if ('locationId' in cmd && cmd.type !== 'switchRestaurant') {
    const there = atLocation(input, cmd, opts);
    if (there) return there;
  }
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
      const section = menuSection(state.recipes, r.kind);
      if (cmd.on && !r.onMenu && section.count >= section.max) {
        return fail(input, `The ${section.name} menu is full (${section.max} items). Take something off first.`);
      }
      if (!cmd.on && r.onMenu && count <= T.build.menuMinItems) return fail(input, `Keep at least ${T.build.menuMinItems} items on the menu.`);
      r.onMenu = cmd.on;
      break;
    }
    case 'createPizza':
    case 'createDish': {
      const kind: MainKind = cmd.type === 'createPizza' ? 'pizza' : cmd.kind;
      const picked = cmd.type === 'createPizza' ? cmd.toppings : cmd.ingredients;
      const extras = [...new Set(picked)].filter((t) => INGREDIENTS[t] && !INGREDIENTS[t]?.base && INGREDIENTS[t]?.category !== 'drinks');
      if (extras.length > 6) return fail(input, kind === 'pizza' ? 'At most 6 toppings.' : 'At most 6 ingredients.');
      let base: readonly string[] = [];
      if (kind === 'pizza') base = PIZZA_BASE;
      if (kind === 'primo') {
        const b = cmd.type === 'createDish' ? cmd.base : undefined;
        if (!b || !PRIMO_BASES.includes(b)) return fail(input, 'Pick a pasta, rice or gnocchi for the primo.');
        base = [b];
      }
      if (kind === 'secondo' && extras.length === 0) return fail(input, 'Pick at least one ingredient.');
      const name = cmd.name.trim().slice(0, 40) || 'House special';
      const id = `custom${state.nextUid++}`;
      state.recipes.push({
        id, name, kind, lines: makeLines([...base, ...extras]),
        price: Math.round(Math.max(1, Math.min(60, cmd.price)) * 2) / 2, onMenu: false, extraTags: [], custom: true,
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
        const limit = seatLimit(state.premisesId, state.fireSafety);
        if (seats + item.seats > limit) return fail(input, `Fire safety: at most ${limit} seats in this room.`);
      }
      if (existing) {
        existing.x = cmd.x;
        existing.y = cmd.y;
      } else {
        const cost = buyPrice(state, item.price);
        if (state.cash < cost) return fail(input, 'Not enough cash.');
        state.cash -= cost;
        state.furniture.push({ uid: state.nextUid++, itemId, x: cmd.x, y: cmd.y, paid: cost });
      }
      break;
    }
    case 'removeFurniture': {
      const f = state.furniture.find((x) => x.uid === cmd.uid);
      if (!f) return fail(input, 'Nothing there.');
      state.cash += sellPrice(state, FURNITURE[f.itemId]?.price ?? 0, f.paid);
      state.furniture = state.furniture.filter((x) => x.uid !== cmd.uid);
      break;
    }
    case 'buyEquipment': {
      const item = EQUIPMENT[cmd.itemId];
      if (!item) return fail(input, 'Unknown equipment.');
      if (!isUnlocked(state, item.unlock)) return fail(input, `Locked: ${unlockText(item.unlock)}.`);
      const cost = buyPrice(state, item.price);
      if (state.cash < cost) return fail(input, `You need ${Math.ceil(cost - state.cash).toLocaleString('en-US')} more.`);
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
      state.cash -= cost;
      state.equipment.push({ ...placed, paid: cost });
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
      const venueId = venueFor(cmd.districtId, cmd.premisesId);
      const sameDistrictMove = cmd.districtId === state.districtId;
      const newDeposit = depositFor(cmd.districtId, cmd.premisesId, venueId);
      if (!newDeposit) return fail(input, 'Unknown premises.');
      if (state.cash + state.deposit < newDeposit) return fail(input, `You need ${Math.ceil(newDeposit - state.deposit - state.cash).toLocaleString('en-US')} more for the deposit.`);
      state.cash += state.deposit - newDeposit;
      state.deposit = newDeposit;
      state.districtId = cmd.districtId;
      state.premisesId = cmd.premisesId;
      state.venueId = venueId;
      state.following = followingAfterMove(state.following, sameDistrictMove, startFollowing(state));
      state.fireSafety = [];
      state.daysOpen = 0;
      const notes: string[] = [];
      const kitchen = autoLayout(state.equipment, cmd.premisesId);
      state.equipment = kitchen.placed;
      for (const u of kitchen.unplaced) {
        state.cash += sellPrice(state, EQUIPMENT[u.itemId]?.price ?? 0, u.paid);
        state.cash += (u.addons ?? []).reduce((x, a) => x + sellPrice(state, ADDONS[a.id]?.price ?? 0, a.paid), 0);
        notes.push(`${EQUIPMENT[u.itemId]?.name} did not fit and was sold`);
      }
      const room = relayoutDining(state.furniture, cmd.premisesId);
      state.furniture = room.placed;
      for (const f of room.unplaced) {
        state.cash += sellPrice(state, FURNITURE[f.itemId]?.price ?? 0, f.paid);
        notes.push(`${FURNITURE[f.itemId]?.name} did not fit and was sold`);
      }
      events.push({ kind: 'info', text: `Moved to the ${PREMISES[cmd.premisesId]?.name} in ${DISTRICTS[cmd.districtId]?.name}.${notes.length ? ` ${notes.join('; ')}.` : ''}` });
      break;
    }
    case 'installAddon': {
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      const addon = ADDONS[cmd.addonId];
      if (!e || !addon) return fail(input, 'Not found.');
      const problem = addonProblem(state, e, addon);
      if (problem) return fail(input, problem);
      const cost = buyPrice(state, addon.price);
      if (state.cash < cost) return fail(input, `You need ${Math.ceil(cost - state.cash).toLocaleString('en-US')} more.`);
      state.cash -= cost;
      e.addons = [...(e.addons ?? []), { id: addon.id, paid: cost }];
      break;
    }
    case 'removeAddon': {
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      const inst = e?.addons?.find((a) => a.id === cmd.addonId);
      if (!e || !inst) return fail(input, 'Not installed.');
      state.cash += sellPrice(state, ADDONS[inst.id]?.price ?? 0, inst.paid);
      e.addons = (e.addons ?? []).filter((a) => a !== inst);
      break;
    }
    case 'upgradeStation': {
      // kitchen-upgrades.md 5: trade in on the same tiles; compatible add-ons stay, others are refunded.
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      const to = EQUIPMENT[cmd.toItemId];
      if (!e || !to) return fail(input, 'Not found.');
      if (!UPGRADE_PATHS.some(([a, b]) => a === e.itemId && b === to.id)) return fail(input, 'That is not an upgrade for this station.');
      if (!isUnlocked(state, to.unlock)) return fail(input, `Locked: ${unlockText(to.unlock)}.`);
      const cost = buyPrice(state, to.price);
      const refund = sellPrice(state, EQUIPMENT[e.itemId]?.price ?? 0, e.paid);
      const keep = (e.addons ?? []).filter((a) => ADDONS[a.id]?.fits.includes(to.id));
      const drop = (e.addons ?? []).filter((a) => !keep.includes(a));
      const dropRefund = drop.reduce((x, a) => x + sellPrice(state, ADDONS[a.id]?.price ?? 0, a.paid), 0);
      const net = cost - refund - dropRefund;
      if (state.cash < net) return fail(input, `You need ${Math.ceil(net - state.cash).toLocaleString('en-US')} more.`);
      const before = { itemId: e.itemId, paid: e.paid, addons: e.addons };
      e.itemId = to.id;
      e.paid = cost;
      e.addons = keep;
      const problem = layoutProblem(state.equipment, kitchenDims(state.premisesId));
      if (problem) {
        Object.assign(e, before);
        return fail(input, problem);
      }
      state.cash -= net;
      events.push({ kind: 'info', text: `Upgraded to ${to.name}.` });
      break;
    }
    case 'sellEquipment': {
      const e = state.equipment.find((x) => x.uid === cmd.uid);
      if (!e) return fail(input, 'Not found.');
      state.cash += (e.addons ?? []).reduce((x, a) => x + sellPrice(state, ADDONS[a.id]?.price ?? 0, a.paid), 0);
      state.cash += sellPrice(state, EQUIPMENT[e.itemId]?.price ?? 0, e.paid);
      state.equipment = state.equipment.filter((x) => x.uid !== cmd.uid);
      break;
    }
    case 'hire': {
      const c = state.candidates.find((x) => x.id === cmd.candidateId);
      if (!c) return fail(input, 'That candidate is no longer available.');
      const interest = interestProblem(c, bestRep(state));
      if (interest) return fail(input, `${c.name}: ${interest}.`);
      state.candidates = state.candidates.filter((x) => x.id !== cmd.candidateId);
      let salary = c.salary;
      if (cmd.low) {
        const m = T.market;
        const chance = hasPersonality(c, 'moneyMinded') ? m.lowOfferChanceMoney : m.lowOfferChance;
        if (!Rng.stream(state.seed, state.day, `offer-${c.id}`).chance(chance)) {
          events.push({ kind: 'info', text: `${c.name} turned down your offer and took another job.` });
          ensureEveryRole(state);
          return { state, events };
        }
        salary = Math.round(c.salary * m.lowOffer * 100) / 100;
      }
      state.staff.push(hiredFromMarket(c, state.day, salary));
      events.push({ kind: 'info', text: `${c.name} joins the team.` });
      // Hired the last one of that role: someone new applies straight away, so every role stays hireable.
      ensureEveryRole(state);
      break;
    }
    case 'interview': {
      const c = state.candidates.find((x) => x.id === cmd.candidateId);
      if (!c) return fail(input, 'That candidate is no longer available.');
      if (c.scouted) return fail(input, `You already interviewed ${c.name}.`);
      const week = weekNumber(state.day);
      const used = state.interviews?.week === week ? state.interviews.used : 0;
      const price = used >= T.market.freeInterviews ? T.market.interviewPrice : 0;
      if (price && state.cash < price) return fail(input, `An interview costs $${price}.`);
      state.cash -= price;
      state.interviews = { week, used: used + 1 };
      c.scouted = true;
      break;
    }
    case 'agency': {
      const m = T.market;
      const price = cmd.plus ? m.agencyPricePlus : m.agencyPrice;
      if (state.cash < price) return fail(input, `The agency charges $${price}.`);
      state.cash -= price;
      state.agencyOrders = [...(state.agencyOrders ?? []), { role: cmd.role, min: cmd.plus ? 70 : 60, readyDay: state.day + m.agencyDays }];
      events.push({ kind: 'info', text: `The agency is looking for ${ROLE_NAMES[cmd.role].toLowerCase()}s. Three candidates arrive in ${m.agencyDays} days.` });
      break;
    }
    case 'fire': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      state.cash -= s.apprentice ? 0 : s.salary * T.staff.severanceWeeks;
      state.staff = state.staff.filter((x) => x.id !== cmd.staffId);
      for (const c of state.staff) if (c.coaching?.traineeId === s.id) c.coaching = null;
      recordDeparture(state, true);
      events.push({ kind: 'info', text: s.apprentice ? `${s.name} leaves.` : `${s.name} leaves with two weeks' pay.` });
      break;
    }
    case 'giveRaise': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      s.salary = Math.round(s.salary * (1 + T.staff.raiseFraction) * 100) / 100;
      s.morale = Math.min(100, s.morale + (hasPersonality(s, 'moneyMinded') ? T.mood.moneyMindedRaise : T.staff.raiseMorale));
      s.leavingOnDay = null;
      s.lowMoraleDays = 0;
      break;
    }
    case 'train': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      const error = bookCourse(state, s, cmd.courseId, bestRep(state));
      if (error) return fail(input, error);
      events.push({ kind: 'info', text: `${s.name} is off to ${COURSES[cmd.courseId]?.name} for ${COURSES[cmd.courseId]?.daysOff} days.` });
      break;
    }
    case 'coach': {
      const coach = state.staff.find((x) => x.id === cmd.coachId);
      const trainee = state.staff.find((x) => x.id === cmd.traineeId);
      if (!coach || !trainee) return fail(input, 'Not found.');
      const problem = coachProblem(coach, trainee);
      if (problem) return fail(input, problem);
      if (state.staff.some((x) => x.id !== coach.id && x.coaching?.traineeId === trainee.id)) return fail(input, `${trainee.name} already has a coach.`);
      if (trainee.attrs[cmd.attr] >= Math.min(99, trainee.potential)) return fail(input, `${trainee.name} has reached their potential in that.`);
      coach.coaching = { traineeId: trainee.id, attr: cmd.attr };
      break;
    }
    case 'stopCoaching': {
      const coach = state.staff.find((x) => x.id === cmd.coachId);
      if (!coach?.coaching) return fail(input, 'Not coaching.');
      coach.coaching = null;
      break;
    }
    case 'promote': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      const t = T.staff;
      if (cmd.role === 'chef') {
        if (s.role !== 'cook') return fail(input, 'Only a cook can become chef.');
        if (ovr(s) < t.promoteChefOvr) return fail(input, `A cook needs OVR ${t.promoteChefOvr} to become chef (now ${ovr(s)}).`);
      } else if (cmd.role === 'manager') {
        if (s.role !== 'chef' && s.role !== 'server') return fail(input, 'A chef or a server can become restaurant manager.');
        if (s.attrs.mentoring < t.promoteManagerMen) return fail(input, `Needs Mentoring ${t.promoteManagerMen} to manage (now ${s.attrs.mentoring}).`);
      } else return fail(input, 'Promotions are cook to chef, and chef or server to manager.');
      s.role = cmd.role;
      s.salary = Math.max(s.salary, salaryFor(cmd.role, ovr(s), s.fame));
      s.promotedDay = state.day;
      s.coaching = null;
      s.morale = Math.min(100, s.morale + T.staff.raiseMorale);
      events.push({ kind: 'info', text: `${s.name} is now ${cmd.role === 'chef' ? 'chef' : 'restaurant manager'} (OVR ${ovr(s)}).` });
      break;
    }
    case 'daysOff': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s) return fail(input, 'Not found.');
      if (s.offUntil !== null || s.course) return fail(input, `${s.name} is already away.`);
      s.offUntil = state.day + T.staff.daysOff;
      s.morale = Math.min(100, s.morale + T.staff.daysOffMorale);
      s.leavingOnDay = null;
      s.lowMoraleDays = 0;
      events.push({ kind: 'info', text: `${s.name} takes ${T.staff.daysOff} days off.` });
      break;
    }
    case 'answerReview': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s?.review) return fail(input, 'No pay review waiting.');
      if (cmd.accept) {
        s.salary = Math.max(s.salary, s.review.ask);
        s.morale = Math.min(100, s.morale + (hasPersonality(s, 'moneyMinded') ? T.mood.moneyMindedRaise : T.staff.raiseMorale));
      }
      s.review = null;
      s.nextReviewDay = state.day + 7 * T.market.reviewWeeks;
      break;
    }
    case 'answerOffer': {
      const s = state.staff.find((x) => x.id === cmd.staffId);
      if (!s?.offer) return fail(input, 'No offer waiting.');
      if (cmd.match) {
        s.salary = Math.max(s.salary, s.offer.salary);
        s.morale = Math.min(100, s.morale + T.staff.raiseMorale);
        s.offer = null;
      } else {
        state.staff = state.staff.filter((x) => x.id !== s.id);
        for (const c of state.staff) if (c.coaching?.traineeId === s.id) c.coaching = null;
        recordDeparture(state, false);
        events.push({ kind: 'info', text: `${s.name} leaves for ${s.offer.rival}.` });
      }
      break;
    }
    case 'setStaffPolicy': {
      const next = { ...policyOf(state), ...cmd.policy };
      if (!T.delegation.budgets.includes(next.budget)) return fail(input, 'Pick one of the training budgets.');
      if (!T.delegation.kitchenBudgets.includes(next.kitchenBudget)) return fail(input, 'Pick one of the kitchen budgets.');
      state.staffPolicy = next;
      break;
    }
    case 'setDelegateStaff': {
      if (cmd.on && !managerOf(state.staff)) return fail(input, 'Hire a restaurant manager first.');
      state.delegateStaff = cmd.on;
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
    case 'setEconomy': {
      const wasOn = rivalSettingsOf(state).on;
      const next = { ...economyOf(state), ...cmd.economy };
      if (!cmd.economy.rivals && state.economy?.rivals) next.rivals = state.economy.rivals;
      state.economy = clampEconomy(next);
      applyRivalToggle(state, wasOn);
      break;
    }
    case 'startCampaign': {
      const c = CAMPAIGNS[cmd.campaignId];
      if (!c) return fail(input, 'Unknown campaign.');
      if (c.unlock === 'delivery') {
        if (!state.delivery?.on || state.delivery.mode === 'own') return fail(input, 'A promoted listing needs delivery on a platform.');
      } else if (!isUnlocked(state, c.unlock)) return fail(input, `Locked: ${unlockText(c.unlock)}.`);
      const running = (state.campaigns ?? []).find((x) => x.id === c.id && (x.renew || state.day < x.endsDay));
      if (running) return fail(input, `${c.name} is already running here.`);
      if (!c.everyRestaurant && slotsUsed(state.campaigns, state.day) >= T.marketing.maxActive) return fail(input, `${T.marketing.maxActive} campaigns are running here; stop one first.`);
      const audience = c.audience === 'choose' ? [...new Set(cmd.audience)] : [];
      if (c.audience === 'choose' && (audience.length < 1 || audience.length > (c.choose ?? 1))) return fail(input, `Pick 1 to ${c.choose ?? 1} crowds to reach.`);
      const facts = stateLocation(state);
      const cost = campaignCost(c, facts.footTraffic);
      if (state.cash < cost) return fail(input, `${c.name} costs $${cost}; you need $${Math.ceil(cost - state.cash)} more.`);
      state.cash -= cost;
      const run = newCampaign(c.id, audience, state.day, facts, streakOnRestart(state.campaigns, c.id, state.day));
      state.campaigns = [...(state.campaigns ?? []).filter((x) => x.id !== c.id), run];
      // Local radio plays in every restaurant you own, paid once.
      if (c.everyRestaurant) for (const b of state.branches) b.campaigns = [...(b.campaigns ?? []).filter((x) => x.id !== c.id), { ...run, spent: 0, renew: false }];
      events.push({ kind: 'info', text: `${c.name} starts today.` });
      break;
    }
    case 'stopCampaign': {
      const run = (state.campaigns ?? []).find((x) => x.id === cmd.campaignId && x.renew);
      if (!run) return fail(input, 'That campaign is not renewing.');
      run.renew = false;
      break;
    }
    case 'holdVenue': {
      const v = VENUES[cmd.venueId];
      if (!v) return fail(input, 'Unknown venue.');
      if (ownedVenues(state).has(v.id)) return fail(input, 'You already run a restaurant here.');
      if (rivalAt(state, v.id)) return fail(input, 'A rival runs a restaurant there.');
      if (state.venueHold && state.venueHold.untilDay > state.day) return fail(input, 'You can hold one venue at a time.');
      const fee = Math.round(locationFacts(v.districtId, v.premisesId, v.id).weeklyRent * economyOf(state).rent);
      if (state.cash < fee) return fail(input, `Holding costs a week of rent, $${fee}.`);
      state.cash -= fee;
      state.venueHold = { venueId: v.id, untilDay: state.day + T.rivals.holdDays, fee };
      events.push({ kind: 'info', text: `${v.name} is held for you until day ${state.venueHold.untilDay}. The fee comes off the deposit if you take it.` });
      break;
    }
    case 'mysteryDiner': {
      const r = state.rivals?.find((x) => x.id === cmd.rivalId && x.closedDay === undefined);
      if (!r) return fail(input, 'That rival is not open.');
      if ((r.mysteryUntil ?? 0) - T.rivals.mysteryDinerDays + 7 > state.day) return fail(input, 'One mystery diner per rival a week.');
      if (state.cash < T.rivals.mysteryDinerPrice) return fail(input, `A mystery diner costs $${T.rivals.mysteryDinerPrice}.`);
      state.cash -= T.rivals.mysteryDinerPrice;
      r.mysteryUntil = state.day + T.rivals.mysteryDinerDays;
      events.push({ kind: 'info', text: `Your mystery diner ate at ${r.name}. Their report is on the rival card for 28 days.` });
      break;
    }
    case 'freshStart': {
      if (state.cash > T.finance.freshStartThreshold) return fail(input, 'A fresh start is offered when cash falls below -$20,000.');
      const fresh = newGame(state.seed + 1, state.districtId, state.premisesId, state.economy, state.venueId);
      fresh.rank = state.rank;
      fresh.totalServed = state.totalServed;
      fresh.recipes = state.recipes.map((r) => ({ ...r }));
      fresh.unlockAll = state.unlockAll;
      events.push({ kind: 'info', text: 'A fresh start. Your recipes and unlocks come with you.' });
      return { state: fresh, events };
    }
    case 'rentVenue':
      return rentVenue(input, cmd.venueId);
    case 'buyFireSafety': {
      const item = FIRE_SAFETY[cmd.id];
      if (!item) return fail(input, 'Unknown upgrade.');
      if (state.fireSafety.includes(item.id)) return fail(input, 'Already installed.');
      if (!fireSafetyUnlocked(state)) return fail(input, `Fire safety upgrades unlock after ${T.fireSafety.unlockDaysOpen} days open.`);
      if (item.requires && !state.fireSafety.includes(item.requires)) return fail(input, `Install the ${FIRE_SAFETY[item.requires]?.name.toLowerCase()} first.`);
      const cost = buyPrice(state, item.price);
      if (state.cash < cost) return fail(input, 'Not enough cash.');
      state.cash -= cost;
      state.fireSafety.push(item.id);
      events.push({ kind: 'info', text: `${item.name} installed. The room now allows ${seatLimit(state.premisesId, state.fireSafety)} seats.` });
      break;
    }
    case 'buyRoomTouch': {
      const item = ROOM_TOUCHES[cmd.id];
      if (!item) return fail(input, 'Unknown decoration.');
      if (state.roomTouches.includes(item.id)) return fail(input, 'Already in the room.');
      const cost = buyPrice(state, item.price);
      if (state.cash < cost) return fail(input, 'Not enough cash.');
      state.cash -= cost;
      state.roomTouches.push(item.id);
      break;
    }
    case 'removeRoomTouch': {
      const item = ROOM_TOUCHES[cmd.id];
      if (!item || !state.roomTouches.includes(item.id)) return fail(input, 'Not in the room.');
      state.roomTouches = state.roomTouches.filter((x) => x !== item.id);
      state.cash += sellPrice(state, item.price);
      break;
    }
    case 'openRestaurant': {
      const venue = VENUES[cmd.venueId];
      if (!venue) return fail(input, 'Unknown venue.');
      if (ownedVenues(state).has(venue.id)) return fail(input, 'You already run a restaurant here.');
      if (rivalAt(state, venue.id)) return fail(input, `${rivalAt(state, venue.id)?.name} runs a restaurant there.`);
      const here = locationName(state);
      if (bestRep(state) < T.manager.openRep) {
        return fail(input, `Build your name first: opening another restaurant needs reputation ${T.manager.openRep} at one you run (now ${Math.floor(bestRep(state))}).`);
      }
      if (!managerOf(state.staff)) return fail(input, `Hire a restaurant manager for ${here} first, so it keeps running while you open the new one.`);
      const held = state.venueHold?.venueId === venue.id && state.venueHold.untilDay > state.day ? state.venueHold.fee : 0;
      const deposit = venueDeposit(venue.id);
      if (state.cash < deposit - held) return fail(input, `The deposit is ${money0(deposit - held)}; you need ${money0(deposit - held - state.cash)} more.`);
      state.branches.push(extractLocation(state));
      const id = Math.max(state.locationId, ...state.branches.map((b) => b.id)) + 1;
      // A new restaurant: empty premises and an empty menu. The recipe book (own dishes, tiers, prices) comes along;
      // the player picks this restaurant's menu. The neighbourhood has to get to know you.
      applyLocation(state, {
        id, districtId: venue.districtId, premisesId: venue.premisesId, venueId: venue.id, deposit,
        rep: T.reputation.start, following: startFollowing(state), recipes: structuredClone(state.recipes).map((r) => ({ ...r, onMenu: false })),
        furniture: [], equipment: [], staff: [], daysOpen: 0, fireSafety: [], roomTouches: [], history: [],
      });
      state.cash -= deposit - held;
      if (held) state.venueHold = null;
      state.openedIn = { ...(state.openedIn ?? {}), [venue.districtId]: state.day };
      events.push({ kind: 'info', text: `You signed the lease on ${venue.name}. ${here} carries on under its manager.` });
      break;
    }
    case 'switchRestaurant': {
      const target = state.branches.find((b) => b.id === cmd.locationId);
      if (!target) return fail(input, 'You do not own that restaurant.');
      if (!managerOf(state.staff)) return fail(input, `Hire a restaurant manager for ${locationName(state)} first, so it keeps running while you are away.`);
      state.branches = state.branches.map((b) => (b.id === target.id ? extractLocation(state) : b));
      applyLocation(state, target);
      events.push({ kind: 'info', text: `You are now running ${locationName(state)}.` });
      break;
    }
    case 'runDay':
      return runDay(state, opts);
    case 'runWeek':
      return runWeek(state, opts);
  }
  return { state, events };
}

// ---------- Moving (city-map.md 6) ----------

/** Regulars follow you down the street, not across town (balance.md 4.3). */
export function followingAfterMove(following: number, sameDistrict: boolean, start: number = T.following.start): number {
  const keep = sameDistrict ? T.following.keepSameDistrict : T.following.keepOtherDistrict;
  return Math.max(start, following * keep);
}

export interface MoveQuote {
  newDeposit: number;
  refund: number;
  movingFee: number;
  net: number;
  repAfter: number;
  followingAfter: number;
  sameDistrict: boolean;
  /** Items that will not fit and are sold at the resale rate. */
  soldFurniture: string[];
  soldEquipment: string[];
  resale: number;
  /** What the move takes from cash: net minus the resale of items that do not fit. */
  total: number;
}

/** Keep the player's own dining layout when it fits the new room; otherwise lay it out again. */
function moveDining(state: GameState, premisesId: string): { placed: GameState['furniture']; unplaced: GameState['furniture'] } {
  const p = PREMISES[premisesId];
  const seats = state.furniture.reduce((a, f) => a + (FURNITURE[f.itemId]?.seats ?? 0), 0);
  const fits = !!p && seats <= seatLimit(premisesId) && state.furniture.every((f) => {
    const it = FURNITURE[f.itemId];
    return !!it && f.x + it.w <= p.diningWidth && f.y + it.h <= p.diningHeight;
  });
  return fits ? { placed: state.furniture, unplaced: [] } : relayoutDining(state.furniture, premisesId);
}

/** Keep the player's own kitchen layout when it still fits; otherwise tidy it into the new kitchen. */
function moveKitchen(state: GameState, premisesId: string): { placed: GameState['equipment']; unplaced: GameState['equipment'] } {
  const dims = kitchenDims(premisesId);
  const fits = state.equipment.every((e) => {
    const r = rectOf(e);
    return r.x + r.w <= dims.W && r.y + r.h <= dims.H;
  });
  if (fits && !layoutProblem(state.equipment, dims)) return { placed: state.equipment, unplaced: [] };
  const { placed, unplaced } = autoLayout(state.equipment, premisesId);
  const byUid = new Map(state.equipment.map((e) => [e.uid, e]));
  return {
    // Auto layout drops the price paid; carry it over so later refunds stay honest.
    placed: placed.map((e) => {
      const paid = byUid.get(e.uid)?.paid;
      return paid === undefined ? e : { ...e, paid };
    }),
    unplaced: unplaced.map((u) => byUid.get(u.uid) ?? { ...u, x: 0, y: 0, rot: 0 as const }),
  };
}

/** Everything the confirm sheet shows; rentVenue charges exactly this. */
export function moveQuote(state: GameState, venueId: string): MoveQuote | null {
  const venue = VENUES[venueId];
  if (!venue || !PREMISES[venue.premisesId]) return null;
  const refund = state.deposit;
  const newDeposit = venueDeposit(venueId);
  const dining = moveDining(state, venue.premisesId);
  const kitchen = moveKitchen(state, venue.premisesId);
  const resale =
    dining.unplaced.reduce((a, f) => a + sellPrice(state, FURNITURE[f.itemId]?.price ?? 0, f.paid), 0) +
    kitchen.unplaced.reduce((a, e) => a + sellPrice(state, EQUIPMENT[e.itemId]?.price ?? 0, e.paid), 0);
  const sameDistrict = venue.districtId === state.districtId;
  const keep = sameDistrict ? T.city.repKeepSameDistrict : T.city.repKeepOtherDistrict;
  const repAfter = state.rep * keep + T.reputation.start * (1 - keep);
  const net = newDeposit - refund + T.city.movingFee;
  return {
    newDeposit, refund, movingFee: T.city.movingFee, net, repAfter, followingAfter: followingAfterMove(state.following, sameDistrict, startFollowing(state)), sameDistrict,
    soldFurniture: dining.unplaced.map((f) => FURNITURE[f.itemId]?.name ?? f.itemId),
    soldEquipment: kitchen.unplaced.map((e) => EQUIPMENT[e.itemId]?.name ?? e.itemId),
    resale,
    total: net - resale,
  };
}

function rentVenue(input: GameState, venueId: string): Result {
  const venue = VENUES[venueId];
  const quote = moveQuote(input, venueId);
  if (!venue || !quote) return fail(input, 'Unknown venue.');
  if (input.venueId === venueId) return fail(input, 'You already rent this venue.');
  if (ownedVenues(input).has(venueId)) return fail(input, 'You already run a restaurant there.');
  if (rivalAt(input, venueId)) return fail(input, `${rivalAt(input, venueId)?.name} runs a restaurant there.`);
  if (quote.total > 0 && input.cash < quote.total) return fail(input, `Moving costs $${Math.ceil(quote.total).toLocaleString('en-US')}; you need $${Math.ceil(quote.total - input.cash).toLocaleString('en-US')} more.`);
  const state = structuredClone(input);
  state.furniture = moveDining(state, venue.premisesId).placed;
  state.equipment = moveKitchen(state, venue.premisesId).placed;
  const held = state.venueHold?.venueId === venueId && state.venueHold.untilDay > state.day ? state.venueHold.fee : 0;
  if (held) state.venueHold = null;
  state.cash -= quote.total - held;
  state.deposit = quote.newDeposit;
  state.openedIn = { ...(state.openedIn ?? {}), [venue.districtId]: state.day };
  state.rep = quote.repAfter;
  state.following = quote.followingAfter;
  // A new building: fire safety stays behind and the clock for unlocking it starts again.
  state.fireSafety = [];
  state.daysOpen = 0;
  state.districtId = venue.districtId;
  state.premisesId = venue.premisesId;
  state.venueId = venue.id;
  const events: GameEvent[] = [{ kind: 'info', text: `Welcome to ${venue.name}, ${DISTRICTS[venue.districtId]?.name ?? ''}!` }];
  const sold = [...quote.soldFurniture, ...quote.soldEquipment];
  if (sold.length) events.push({ kind: 'info', text: `Sold what did not fit (${sold.join(', ')}) for $${Math.round(quote.resale).toLocaleString('en-US')}.` });
  return { state, events };
}

// ---------- Guests lost to rivals (competition.md 7.4) ----------

/** The same day without live rivals: what they took from you, by segment and by rival. A full service loses nothing. */
function guestsLost(state: GameState, a: Analysis, report: DayReport, opts: DayOptions): void {
  const m = report.market;
  if (!m || !rivalSettingsOf(state).on) return;
  const comp = playerCompetition(state, stateLocation(state), m.A);
  if (!Object.keys(comp.byRival).length) return;
  const without = simulateDay(state, a, { ...opts, live: false });
  for (const seg of without.segments) {
    const s = seg.segment;
    const lost = Math.max(0, seg.served - (m.served[s] ?? 0));
    m.lost[s] = lost;
    const total = Object.values(comp.byRival).reduce((x, r) => x + (r[s] ?? 0), 0);
    if (total <= 0 || lost <= 0) continue;
    for (const [id, r] of Object.entries(comp.byRival)) {
      const byRival = (m.lostByRival[Number(id)] ??= Object.fromEntries(Object.keys(m.lost).map((k) => [k, 0])) as Record<SegmentId, number>);
      byRival[s] = (lost * (r[s] ?? 0)) / total;
    }
  }
}

// ---------- Fire safety ----------

export function fireSafetyUnlocked(state: GameState): boolean {
  return state.unlockAll || state.daysOpen >= T.fireSafety.unlockDaysOpen;
}

// ---------- Fast forward ----------

/** Events that end a fast forward early so the player can react. */
const WEEK_STOPS: readonly GameEvent['kind'][] = ['staffNotice', 'staffLeft', 'staffOffer', 'restructure'];

function runWeek(state: GameState, opts: DayOptions): Result {
  const reports: DayReport[] = [];
  const events: GameEvent[] = [];
  let stoppedBecause: string | null = null;
  for (let i = 0; i < 7; i++) {
    const r = runDay(state, opts);
    state = r.state;
    const day = r.events.find((e) => e.kind === 'dayCompleted');
    if (day?.report) reports.push(day.report);
    const others = r.events.filter((e) => e.kind !== 'dayCompleted');
    events.push(...others);
    // With only one restaurant a closed day needs the player; with more, the others keep earning while this one is set up.
    if (day?.report && !day.report.open && !state.branches.length) stoppedBecause = `Closed on day ${day.report.day}: ${day.report.closedReason}`;
    const stop = others.find((e) => WEEK_STOPS.includes(e.kind));
    if (stop) stoppedBecause = stop.text;
    if (stoppedBecause) break;
  }
  const covers = reports.reduce((a, r) => a + r.covers, 0);
  return {
    state,
    events: [{ kind: 'weekCompleted', text: `${reports.length} days run, ${Math.round(covers)} guests served.`, reports, stoppedBecause }, ...events],
  };
}

// ---------- Day settlement ----------

function runDay(state: GameState, opts: DayOptions): Result {
  const events: GameEvent[] = [];
  const unlockedBefore = unlockedIds(state);
  const rankBefore = state.rank;
  // Campaigns renew at the start of the day, paid now (competition.md 5.2).
  const renewed = renewCampaigns(state.campaigns, state.day, stateLocation(state), state.cash);
  state.campaigns = renewed.campaigns;
  state.cash -= renewed.paid;
  const { a, report } = dayRun(state, opts);
  const p = report.pnl;
  if (report.market && report.open) guestsLost(state, a, report, opts);

  // Daily cash: sales in, ingredients (bought just in time in M0), utilities, upkeep and marketing out.
  state.cash += dailyCash(p);
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
  // The other restaurants, run by their managers, share the same cash (prd.md 5.12).
  const branchDays = state.branches.map((b) => runBranchDay(state, b, report.weekday, opts));
  if (branchDays.length) report.branches = branchDays.map((x) => x.day);
  for (const d of branchDays) events.push(...d.events);
  weekly += branchDays.reduce((x, d) => x + d.weekly, 0);
  report.weeklyPayments = weekly;
  report.cashAfter = state.cash;

  state.rep = report.repAfter;
  state.following = report.followingAfter;
  state.totalServed += report.covers;
  if (report.open) state.daysOpen += 1;

  // The team (staff-management.md): growth, coaching, courses, mood, reviews, offers, contributions.
  const team = teamDay(state, report, a, { ...opts, managed: false, contrib: true, bestRep: bestRep(state) });
  events.push(...team.events);
  if (team.team.length) report.team = team.team;
  if (team.mood.length) report.mood = team.mood;
  if (report.weekday === 6 && state.delegateStaff) {
    const week = managerWeek(state);
    if (week) events.push({ kind: 'info', text: `${week.line} ${week.proposal}` });
  }
  events.push(...deliverAgency(state, bestRep(state)));

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
  // The rival pizzerias run their day after yours, with your start of day pull (competition.md 2.3).
  const newsBefore = (state.marketNews ?? []).length;
  runRivalsDay(state);
  const fresh = (state.marketNews ?? []).slice(newsBefore).filter((n) => {
    const r = state.rivals?.find((x) => x.id === n.rivalId);
    return !!r && (inReach(state, r) || ownRestaurants(state).some((o) => o.districtId === n.districtId));
  });
  if (fresh[0]) events.push({ kind: 'market', text: fresh[0].text });
  state.day += 1;
  if (report.weekday === 6) refreshMarket(state, bestRep(state), state.day);

  const unlockedAfter = unlockedIds(state);
  for (const id of unlockedAfter) {
    if (!unlockedBefore.has(id)) events.push({ kind: 'unlocked', text: `New equipment available: ${(EQUIPMENT[id] as EquipmentItem).name}.` });
  }
  events.unshift({ kind: 'dayCompleted', text: `Day ${report.day} complete.`, report });
  return { state, events };
}
