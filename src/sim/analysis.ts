// Static analysis of a restaurant: everything that does not depend on today's guests.
// Formulas follow 01-product/prd.md 5.3, 5.5, 5.6, 5.7 and balance.md 1.

import { DISTRICTS, PREMISES } from '../data/districts';
import { ADDONS } from '../data/addons';
import { EQUIPMENT } from '../data/equipment';
import { FURNITURE } from '../data/furniture';
import { ROOM_TOUCHES } from '../data/roomTouches';
import { HARMONY_CLASHES, HARMONY_MATCHES, INGREDIENTS, SUPPLIERS, TIERS } from '../data/ingredients';
import { isBar, isMain } from '../data/recipes';
import { SEGMENTS } from '../data/segments';
import type { EquipmentItem, MainKind, SegmentId, Service, Tag } from '../data/types';
import { T } from '../data/tunables';
import { economyOf } from './economy';
import { addonProduct, addonSum, type Flow, kitchenFlow, plateWalk } from './kitchen';
import { stateLocation } from './location';
import { dishWork, type MenuComplexity, menuComplexity } from './menu';
import { ROLE_AREA, ROLE_BASE_SALARY } from '../data/staff';
import { effAttr, hasTalent, moraleQuality, onRota, pressureMult, pressureQuality } from './staff';
import type { GameState, PlacedFurniture, Recipe, Staff } from './state';

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface DishStats {
  recipeId: string;
  foodCost: number;
  ingredientQuality: number;
  harmony: number;
  quality: number;
  fairPrice: number;
  wasteRate: number;
  tags: Set<Tag>;
  toppings: number;
  /** Prep work per plate relative to a simple pizza (0 for sides). */
  work: number;
}

/**
 * Station bottlenecks (kitchen-bottlenecks.md): where equipment and staff do not match.
 * Every multiplier is 1 when the kitchen is set up for its team.
 */
export interface Stations {
  /** Oven tending needed (a deck oven 0.5, a wood fired 1) and what the cooks can give. */
  tendNeed: number;
  tendRatio: number;
  /** Wash points for cooks (sinks, dish machine, hand wash) and cooks beyond what they serve. */
  washPoints: number;
  washStrain: number;
  prepWashMult: number;
  /** Dishwashers who fit at the wash stations; the rest stand idle. */
  washSlots: number;
  idleWashers: number;
  /** People on the kitchen floor beyond what the free tiles hold, and the speed that costs. */
  kitchenPeople: number;
  roomFor: number;
  crowdOver: number;
  crowdMult: number;
  /** Dough for this many pizzas a day. */
  coldCap: number;
  plateStock: number;
}

export function stationsOf(state: GameState): Stations {
  const t = T.stations;
  const crew = onRota(state.staff, state.day);
  const cooks = crew.filter((s) => s.role === 'chef' || s.role === 'cook').length;
  const washers = crew.filter((s) => s.role === 'dishwasher').length;
  const items = state.equipment.map((e) => EQUIPMENT[e.itemId]).filter((e): e is EquipmentItem => !!e);
  const tendNeed = items.filter((i) => i.role === 'oven').reduce((a, i) => a + (i.tend ?? t.defaultTend), 0);
  const tendRatio = tendNeed > 0 ? Math.min(1, (cooks * t.tendPerCook) / tendNeed) : 1;
  const washPoints = items.reduce((a, i) => a + (i.washPoints ?? 0), 0);
  const washStrain = Math.max(0, cooks - washPoints * t.cooksPerWashPoint);
  const washSlots = items.reduce((a, i) => a + (i.washers ?? 0), 0);
  const premises = PREMISES[state.premisesId];
  const free = (premises?.kitchenTiles ?? 30) - 2 - items.reduce((a, i) => a + i.footprint, 0);
  // Cooks work at stations and dishwashers at wash stations; only the people beyond those places need free floor.
  const cookPlaces = items.reduce((a, i) => a + (i.role === 'counter' ? i.w * t.placesPerCounterTile : i.role === 'oven' || i.role === 'sheeter' || i.role === 'pass' ? t.placesPerStation : 0), 0);
  const atWash = Math.min(washers, washSlots);
  const kitchenPeople = cooks + atWash;
  // Everyone working at a station stands on a tile of floor in front of it; the rest of the floor is the aisle.
  const roomFor = cookPlaces + atWash + Math.max(0, Math.floor((free - cookPlaces - atWash) / t.tilesPerPerson));
  const crowdOver = Math.max(0, kitchenPeople - Math.max(1, roomFor));
  return {
    tendNeed, tendRatio, washPoints, washStrain, prepWashMult: 1 - Math.min(t.washStrainCap, washStrain * t.washStrainPerCook),
    washSlots, idleWashers: Math.max(0, washers - washSlots), kitchenPeople, roomFor, crowdOver,
    crowdMult: 1 - Math.min(t.crowdCap, crowdOver * t.crowdPerPerson),
    coldCap: items.reduce((a, i) => a + (i.coldCap ?? 0), 0),
    plateStock: T.kitchen.plateStock + items.reduce((a, i) => a + (i.plateStock ?? 0), 0),
  };
}

export interface KitchenStats {
  /** Station bottlenecks between equipment and staff. */
  stations: Stations;
  kitchenStaff: number;
  /** Guests the cooks on the rota can cook for in this service (founder rule: 50 each at Speed 50, up to 75). */
  cookGuests: number;
  avgSkill: number;
  kitchenSkillK: number;
  equipmentE: number;
  ovenPerHour: number;
  prepPerHour: number;
  cookTime: number;
  ovens: number;
  counters: number;
  staffedCounters: number;
  footprintUsed: number;
  footprintMax: number;
  maintenancePerWeek: number;
  hasPass: boolean;
  hasDishMachine: boolean;
  hasCold: boolean;
  hasSink: boolean;
  /** Extra minutes per pizza walking plates from the ovens to the pass. */
  plateWalk: number;
  flow: Flow;
  /** Output per prep station by uid, for the kitchen view. */
  stationPrep: Record<number, number>;
  /** Quality from add-ons after the cap (kitchen-upgrades.md 3). */
  addonE: number;
  /** Best waste multiplier from cold store add-ons. */
  wasteMult: number;
  /** Output per oven by uid, for the kitchen view. */
  ovenOutput: Record<number, number>;
  /** How hard the menu is on the line; already applied to prep and cook time. */
  menu: MenuComplexity;
}

export interface RoomStats {
  seats: number;
  tables: number;
  diningTiles: number;
  decorPoints: number;
  lighting: number;
  crowdedTables: number;
  ambience: number;
}

export interface ServiceStats {
  servers: number;
  hasHost: boolean;
  serverSpeed: Record<Service, number>;
  /** Guests the servers on the rota can look after in a service (founder rule: 35 each at Speed 50, up to 50). */
  serverGuests: Record<Service, number>;
  loadMult: number;
  seatTime: number;
  orderTime: Record<Service, number>;
  serveTime: Record<Service, number>;
  payTime: Record<Service, number>;
  serviceTime: Record<Service, number>;
  serviceScore: number;
  platesPerHour: number;
}

export interface Analysis {
  /** Load per area and service the staff feel as pressure (staff-management.md 2.3); 0 when not known. */
  pressure: Record<Service, AreaLoad>;
  /** Servers on the rota who took Sommelier Basics. */
  sommeliers: number;
  dishes: Record<string, DishStats>;
  kitchen: KitchenStats;
  room: RoomStats;
  service: ServiceStats;
  weeklySalaries: number;
  weeklyRent: number;
  frugal: boolean;
}

// ---------- Staff ----------

export function moraleMult(s: Staff): number {
  return 0.85 + (0.3 * s.morale) / 100;
}

function nightOwlMult(s: Staff, service: Service): number {
  if (!hasTalent(s, 'nightOwl')) return 1;
  return service === 'dinner' ? 1 + T.service.nightOwl : 1 - T.service.nightOwl;
}

/** Where a person works today: service, its load ratio and the day (weekday talents). */
/**
 * How hard each area works in a service: guests reaching it per hour over what it can handle.
 * Kitchen: seated guests over the prep and oven line. Floor: guests who want in over the seats (a queue at the door).
 * Back: plates over washing. Read before any composure effect.
 */
export interface AreaLoad {
  kitchen: number;
  floor: number;
  back: number;
}
export const NO_LOAD: AreaLoad = { kitchen: 0, floor: 0, back: 0 };
export const NO_PRESSURE: Record<Service, AreaLoad> = { lunch: NO_LOAD, dinner: NO_LOAD };

export interface WorkContext {
  service: Service;
  load: AreaLoad;
  day: number;
}

export function loadFor(s: Staff, load: AreaLoad): number {
  const area = ROLE_AREA[s.role];
  return area === 'kitchen' ? load.kitchen : area === 'back' ? load.back : load.floor;
}

/** Composure under pressure for this person in this service (staff-management.md 2.3). */
export function personalPressure(s: Staff, ctx: WorkContext): number {
  return pressureMult(effAttr(s, 'composure', ctx.service, ctx.day), loadFor(s, ctx.load));
}

/** Speed on the old 1 to 10 scale is Speed / 10; Quality / 10 feeds kitchen skill and service. */
function personalSpeed(s: Staff, volumeGear: boolean, ctx: WorkContext): number {
  const skill = effAttr(s, 'speed', ctx.service, ctx.day) / 10;
  const base = volumeGear
    ? T.kitchen.volumeSpeedBase + T.kitchen.volumeSpeedPerSkill * skill
    : T.kitchen.speedBase + T.kitchen.speedPerSkill * skill;
  return base * moraleMult(s) * (hasTalent(s, 'speedy') ? 1 + T.kitchen.speedyBonus : 1) *
    (s.coaching ? T.training.coachSpeed : 1) * personalPressure(s, ctx);
}

/** Quality on the old 1 to 10 scale, with pressure and morale (staff-management.md 2.2, 5.3). */
function personalQuality(s: Staff, ctx: WorkContext): number {
  return (effAttr(s, 'quality', ctx.service, ctx.day) / 10) * pressureQuality(personalPressure(s, ctx)) * moraleQuality(s.morale);
}

/**
 * Wages saved by the owner's own shifts: you work about 60 hours a week in the restaurant you run, covering part of a cook
 * position. Not at a managed restaurant, nor where a restaurant manager runs the place; never more than the wage bill.
 */
export function ownerShifts(state: Pick<GameState, 'staff' | 'ownerAway'>): number {
  if (state.ownerAway || state.staff.some((s) => s.role === 'manager')) return 0;
  return Math.min(state.staff.reduce((a, s) => a + s.salary, 0), T.staff.ownerShiftShare * ROLE_BASE_SALARY.cook);
}

/** Guests one cook can cook for in a service: faster, calmer and happier cooks handle more (founder rule). */
function guestsFor(c: Staff, ctx: WorkContext): number {
  const k = T.kitchen;
  return clamp(k.guestsPerCook + k.guestsPerCookSlope * (personalSpeed(c, false, ctx) * nightOwlMult(c, ctx.service) - 1), k.guestsPerCookMin, k.guestsPerCookMax);
}

/** Guests one server can look after in a service: faster, calmer and happier servers handle more (founder rule). */
function guestsForServer(s: Staff, ctx: WorkContext): number {
  const t = T.service;
  return clamp(t.guestsPerServer + t.guestsPerServerSlope * (personalSpeed(s, false, ctx) * nightOwlMult(s, ctx.service) - 1), t.guestsPerServerMin, t.guestsPerServerMax);
}

export const kitchenCrew = (state: Pick<GameState, 'staff' | 'day'>): Staff[] => onRota(state.staff, state.day).filter((s) => s.role === 'chef' || s.role === 'cook');

// ---------- Dishes ----------

export function linePrice(ingredientId: string, tier: Recipe['lines'][number]['tier'], supplierId: string): number {
  const ing = INGREDIENTS[ingredientId];
  const sup = SUPPLIERS[supplierId];
  if (!ing || !sup) return 0;
  return ing.portionCost * TIERS[tier].priceMult * sup.priceIndex;
}

export function harmonyOf(ingredientIds: string[], maxExtras: number = T.quality.maxToppingsBeforePenalty): number {
  const set = new Set(ingredientIds);
  let h = T.quality.harmonyBase;
  for (const [a, b] of HARMONY_MATCHES) if (set.has(a) && set.has(b)) h += T.quality.harmonyMatch;
  for (const [a, b] of HARMONY_CLASHES) if (set.has(a) && set.has(b)) h += T.quality.harmonyClash;
  const toppings = ingredientIds.filter((id) => !INGREDIENTS[id]?.base).length;
  h += T.quality.harmonyExtraTopping * Math.max(0, toppings - maxExtras);
  return clamp(h, 0, 100);
}

/** A good name lets a restaurant charge more (balance.md 4.10): fair prices rise above repPremiumFrom. */
export function repPriceMult(rep: number): number {
  const p = T.pricing;
  return 1 + p.repPremium * clamp((rep - p.repPremiumFrom) / (100 - p.repPremiumFrom), 0, 1);
}

export function dishStats(recipe: Recipe, K: number, E: number, frugal: boolean, costMult = 1, priceMult = 1): DishStats {
  let cost = 0;
  let qSum = 0;
  let wSum = 0;
  let artisanCost = 0;
  const tags = new Set<Tag>(recipe.extraTags as Tag[]);
  let hasMeat = false;
  for (const line of recipe.lines) {
    const ing = INGREDIENTS[line.ingredientId];
    const sup = SUPPLIERS[line.supplierId];
    if (!ing || !sup) continue;
    const c = linePrice(line.ingredientId, line.tier, line.supplierId);
    cost += c;
    qSum += c * (TIERS[line.tier].quality + sup.qualityOffset);
    wSum += c * TIERS[line.tier].wasteRate;
    if (line.tier === 'artisan') artisanCost += c;
    for (const t of ing.tags) tags.add(t);
    if (ing.category === 'meat' || ing.category === 'seafood') hasMeat = true;
  }
  const iq = cost > 0 ? qSum / cost : 0;
  const wasteRate = cost > 0 ? wSum / cost : 0;
  const ids = recipe.lines.map((l) => l.ingredientId);
  const toppings = ids.filter((id) => !INGREDIENTS[id]?.base).length;
  const main = isMain(recipe.kind);
  if (main) {
    if (!hasMeat) tags.add('veggie');
    if (toppings <= 2 && !tags.has('spicy') && !tags.has('bold')) tags.add('kid friendly');
  }
  if (cost > 0 && artisanCost / cost >= T.quality.artisanShareForTag) tags.add('artisan');
  if (frugal) cost *= 1 - T.staff.frugalDiscount;
  cost *= costMult;
  const harmony = !main
    ? T.quality.harmonyBase + 10
    : harmonyOf(ids, recipe.kind === 'pizza' ? T.quality.maxToppingsBeforePenalty : T.quality.maxExtrasBeforePenaltyNonPizza);
  const quality = clamp(T.quality.wIngredients * iq + T.quality.wHarmony * harmony + T.quality.wKitchen * K + E, 0, 100);
  const fairPrice = priceMult * (
    (main ? T.pricing.fairIntercept : T.pricing.sideFairIntercept) +
    (main ? T.pricing.fairQualitySlope : T.pricing.sideFairQualitySlope) * quality +
    (isBar(recipe.kind) ? T.pricing.barCostMult : T.pricing.fairFoodCostMult) * cost +
    (main ? T.pricing.fairKindPremium[recipe.kind as MainKind] : 0));
  return { recipeId: recipe.id, foodCost: cost, ingredientQuality: iq, harmony, quality, fairPrice, wasteRate, tags, toppings, work: dishWork(recipe) };
}

export function tasteMatch(tags: Set<Tag>, segment: SegmentId): number {
  const liked = SEGMENTS[segment].likedTags.filter((t) => tags.has(t)).length;
  return Math.min(1, T.demand.tasteMatchBase + T.demand.tasteMatchPerTag * liked);
}

// ---------- Kitchen ----------

function ovenSpeed(item: EquipmentItem, cooks: Staff[], avgSkill: number, ctx: WorkContext): number {
  const volume = item.family === 'volume';
  let speed = cooks.length ? mean(cooks.map((c) => personalSpeed(c, volume, ctx) * nightOwlMult(c, ctx.service))) : 0;
  if (avgSkill < item.skillNeeded) speed *= T.kitchen.underSkillSpeed;
  return speed;
}

export function kitchenStats(state: GameState, service: Service = 'dinner', load: AreaLoad = NO_LOAD): KitchenStats {
  const ctx: WorkContext = { service, load, day: state.day };
  const cooks = kitchenCrew(state);
  const stations = stationsOf(state);
  const avgSkill = mean(cooks.map((c) => effAttr(c, 'quality', service, state.day) / 10));
  const hasChef = cooks.some((c) => c.role === 'chef');
  const K = cooks.length
    ? mean(cooks.map((c) => T.quality.kitchenBase + T.quality.kitchenPerSkill * personalQuality(c, ctx) + (hasTalent(c, 'perfectionist') ? T.quality.perfectionistK : 0))) +
      (hasChef ? T.quality.chefSpecialty : 0)
    : T.quality.kitchenBase;
  const items = state.equipment.map((e) => EQUIPMENT[e.itemId]).filter((e): e is EquipmentItem => !!e);
  const owned = state.equipment.filter((e) => !!EQUIPMENT[e.itemId]);
  const ovens = owned.filter((e) => EQUIPMENT[e.itemId]?.role === 'oven');
  const counters = owned.filter((e) => EQUIPMENT[e.itemId]?.role === 'counter');
  const flow = kitchenFlow(state);
  const hasPass = items.some((i) => i.role === 'pass');
  const hasDishMachine = items.some((i) => i.role === 'dishMachine');
  // The best proving cabinet counts; a second one adds nothing.
  const proving = items.filter((i) => i.role === 'proving').sort((a, b) => b.qualityMod - a.qualityMod)[0];

  const perfectionistShare = cooks.length ? cooks.filter((c) => hasTalent(c, 'perfectionist')).length / cooks.length : 0;
  const cookTimeMult = 1 + (T.kitchen.perfectionistCookTime - 1) * perfectionistShare;

  let ovenPerHour = 0;
  let cookTimeWeighted = 0;
  let qualityWeighted = 0;
  let walkWeighted = 0;
  const ovenOutput: Record<number, number> = {};
  let addonOvenQ = 0;
  for (const oe of ovens) {
    const o = EQUIPMENT[oe.itemId] as EquipmentItem;
    const speed = ovenSpeed(o, cooks, avgSkill, ctx);
    const slots = (o.slots ?? 0) + addonSum(oe, 'slotsAdd');
    const bake = (o.bakeMult ?? 1) * addonProduct(oe, 'bakeMult');
    // Ovens need tending, and a crowded kitchen slows everyone (kitchen-bottlenecks.md).
    const perHour = (slots * 60) / (T.kitchen.bakeMinutes * bake * cookTimeMult) * speed * stations.tendRatio * stations.crowdMult;
    const scale = avgSkill < o.skillNeeded ? avgSkill / o.skillNeeded : 1;
    ovenPerHour += perHour;
    ovenOutput[oe.uid] = perHour;
    walkWeighted += perHour * plateWalk(flow.ovenDPass[oe.uid] ?? 0);
    if (speed > 0) cookTimeWeighted += perHour * ((T.kitchen.bakeMinutes * bake * cookTimeMult) / speed);
    qualityWeighted += perHour * o.qualityMod * scale;
    addonOvenQ += perHour * addonSum(oe, 'qualityAdd') * scale;
  }
  // A crowded menu slows every ticket: more stations to run, more mise en place to hunt through.
  const menu = menuComplexity(state.recipes, cooks.length ? avgSkill : 5);
  const walk = ovenPerHour > 0 ? walkWeighted / ovenPerHour : 0;
  const ticketMult = 1 + T.menu.ticketShare * (1 / menu.efficiency - 1);
  const cookTime = ((ovenPerHour > 0 ? cookTimeWeighted / ovenPerHour : T.kitchen.bakeMinutes) + walk) * ticketMult;
  const ovenQ = ovenPerHour > 0 ? qualityWeighted / ovenPerHour : 0;
  const ovenAddonQ = ovenPerHour > 0 ? addonOvenQ / ovenPerHour : 0;

  // Prep stations (kitchen-builder.md 4): each staffed station gets one cook, best stations first.
  const counterSpeed = cooks.length ? mean(cooks.map((c) => personalSpeed(c, false, ctx) * nightOwlMult(c, service))) : 0;
  // The sheeter attached to a station sets its tool speed and quality (a dough press or divider differs from the basic one).
  const sheeterOf = (uid: number): EquipmentItem | undefined => {
    const su = flow.stations[uid]?.sheeterUid;
    const se = su === null || su === undefined ? undefined : state.equipment.find((x) => x.uid === su);
    return se ? EQUIPMENT[se.itemId] : undefined;
  };
  const stationRate = (e: (typeof counters)[number]): number => {
    const it = EQUIPMENT[e.itemId] as EquipmentItem;
    const st = flow.stations[e.uid];
    const tool = Math.max(it.prepMult ?? 1, st?.sheeter ? (sheeterOf(e.uid)?.prepMult ?? 1.35) : 1);
    return T.kitchen.prepRate * counterSpeed * tool * addonProduct(e, 'prepMult') * (st?.coldMult ?? 1) * (st?.reachMult ?? 1) * menu.efficiency *
      stations.prepWashMult * stations.crowdMult;
  };
  const ranked = [...counters].sort((a, b) => stationRate(b) - stationRate(a) || (EQUIPMENT[b.itemId]?.qualityMod ?? 0) - (EQUIPMENT[a.itemId]?.qualityMod ?? 0));
  const staffedCounters = Math.min(counters.length, cooks.length);
  let prepPerHour = 0;
  let counterQ = 0;
  let counterAddonQ = 0;
  const stationPrep: Record<number, number> = {};
  ranked.forEach((c, i) => {
    const rate = stationRate(c);
    if (i >= staffedCounters) {
      stationPrep[c.uid] = 0;
      return;
    }
    stationPrep[c.uid] = rate;
    prepPerHour += rate;
    const withSheeter = flow.stations[c.uid]?.sheeter ?? false;
    counterQ += (EQUIPMENT[c.itemId]?.qualityMod ?? 0) + (withSheeter ? (sheeterOf(c.uid)?.qualityMod ?? 0) : 0);
    const sheeter = state.equipment.find((x) => x.uid === flow.stations[c.uid]?.sheeterUid);
    counterAddonQ += addonSum(c, 'qualityAdd') + (sheeter ? addonSum(sheeter, 'qualityAdd') : 0);
  });
  counterQ = staffedCounters ? counterQ / staffedCounters : 0;
  counterAddonQ = staffedCounters ? counterAddonQ / staffedCounters : 0;
  const passE = owned.find((e) => EQUIPMENT[e.itemId]?.role === 'pass');
  const provingE = owned.find((e) => e.itemId === proving?.id);
  // kitchen-upgrades.md 3: add-on quality is capped in total.
  const addonE = Math.min(
    T.addons.qualityCap,
    ovenAddonQ + counterAddonQ + (passE ? addonSum(passE, 'qualityAdd') : 0) + (provingE ? addonSum(provingE, 'qualityAdd') : 0),
  );
  const colds = owned.filter((e) => EQUIPMENT[e.itemId]?.cold);
  const wasteMult = Math.min(1, ...colds.map((e) => addonProduct(e, 'wasteMult')));

  const E = clamp(
    ovenQ + counterQ + (proving?.qualityMod ?? 0) + (passE ? (EQUIPMENT[passE.itemId]?.qualityMod ?? 0) : 0) + addonE,
    T.quality.eMin,
    T.quality.eMax,
  );
  const premises = PREMISES[state.premisesId];
  return {
    kitchenStaff: cooks.length,
    cookGuests: cooks.reduce((x, c) => x + guestsFor(c, ctx), 0),
    avgSkill,
    kitchenSkillK: K,
    equipmentE: E,
    ovenPerHour,
    prepPerHour,
    cookTime,
    ovens: ovens.length,
    counters: counters.length,
    staffedCounters,
    stations,
    footprintUsed: items.reduce((a, i) => a + i.footprint, 0),
    footprintMax: (premises?.kitchenTiles ?? 30) - 4,
    maintenancePerWeek:
      items.reduce((a, i) => a + i.maintenance, 0) + owned.reduce((a, e) => a + (e.addons ?? []).reduce((b, x) => b + (ADDONS[x.id]?.maintenance ?? 0), 0), 0),
    addonE,
    wasteMult,
    hasPass,
    hasDishMachine,
    hasCold: items.some((i) => i.cold),
    hasSink: items.some((i) => i.role === 'sink'),
    plateWalk: walk,
    flow,
    stationPrep,
    ovenOutput,
    menu,
  };
}

// ---------- Dining room ----------

export function occupiedTiles(furniture: PlacedFurniture[], skipUid?: number): Set<string> {
  const set = new Set<string>();
  for (const f of furniture) {
    if (f.uid === skipUid) continue;
    const item = FURNITURE[f.itemId];
    if (!item) continue;
    for (let dx = 0; dx < item.w; dx++) for (let dy = 0; dy < item.h; dy++) set.add(`${f.x + dx},${f.y + dy}`);
  }
  return set;
}

export function roomStats(state: GameState): RoomStats {
  const premises = PREMISES[state.premisesId];
  const W = premises?.diningWidth ?? 10;
  const H = premises?.diningHeight ?? 8;
  const occupied = occupiedTiles(state.furniture);
  let seats = 0;
  let tables = 0;
  let decorPoints = 0;
  let lighting = 0;
  let comfort = 0;
  for (const id of state.roomTouches ?? []) {
    const r = ROOM_TOUCHES[id];
    if (!r) continue;
    decorPoints += r.decorPoints;
    lighting += r.lighting;
    comfort += r.comfort;
  }
  let crowded = 0;
  for (const f of state.furniture) {
    const item = FURNITURE[f.itemId];
    if (!item) continue;
    decorPoints += item.decorPoints;
    lighting += item.lighting;
    comfort += item.comfort;
    if (item.kind !== 'table') continue;
    seats += item.seats;
    tables += 1;
    let free = false;
    for (let dx = -1; dx <= item.w && !free; dx++) {
      for (let dy = -1; dy <= item.h && !free; dy++) {
        const edge = (dx === -1 || dx === item.w) !== (dy === -1 || dy === item.h);
        if (!edge) continue;
        const x = f.x + dx;
        const y = f.y + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        if (!occupied.has(`${x},${y}`)) free = true;
      }
    }
    if (!free) crowded += 1;
  }
  const diningTiles = W * H;
  const ambience = clamp(
    T.ambience.base +
      (T.ambience.decorFactor * decorPoints) / (diningTiles / 10) +
      Math.min(T.ambience.lightingCap, lighting) +
      comfort -
      T.ambience.crowdingPenalty * crowded,
    0,
    100,
  );
  return { seats, tables, diningTiles, decorPoints, lighting, crowdedTables: crowded, ambience };
}

// ---------- Service ----------

export function serviceStats(state: GameState, kitchen: Record<Service, KitchenStats>, tables: number, load: Record<Service, AreaLoad> = NO_PRESSURE): ServiceStats {
  const crew = onRota(state.staff, state.day);
  const servers = crew.filter((s) => s.role === 'server');
  const hasHost = crew.some((s) => s.role === 'host');
  const dinner: WorkContext = { service: 'dinner', load: load.dinner, day: state.day };
  const avgServerSkill = mean(servers.map((s) => personalQuality(s, dinner)));
  const extra = servers.length ? Math.max(0, tables / servers.length - T.service.tablesPerServer) : 0;
  const loadMult = Math.max(T.service.loadFloor, 1 - T.service.loadPenalty * extra);
  const speedFor = (service: Service): number =>
    servers.length ? mean(servers.map((s) => personalSpeed(s, false, { service, load: load[service], day: state.day }) * nightOwlMult(s, service))) * loadMult : 0;
  const seatTime = hasHost ? T.service.seatWithHost : T.service.seatWithoutHost;
  const passE = state.equipment.find((e) => EQUIPMENT[e.itemId]?.role === 'pass');
  const passMult = passE ? (EQUIPMENT[passE.itemId]?.effectMult ?? 1) * addonProduct(passE, 'serveMult') : 1;
  const mk = (f: (sv: Service) => number): Record<Service, number> => ({ lunch: f('lunch'), dinner: f('dinner') });
  const serverSpeed = mk(speedFor);
  // A pass lets plates wait for a runner, so each server can look after more guests: x1.2 with a heat lamp pass.
  const passReach = Math.sqrt(1 / passMult);
  const serverGuests = mk((service) => passReach * servers.reduce((x, s) => x + guestsForServer(s, { service, load: load[service], day: state.day }), 0));
  const orderTime = mk((sv) => (serverSpeed[sv] > 0 ? T.service.order / serverSpeed[sv] : 99));
  const serveTime = mk((sv) => (serverSpeed[sv] > 0 ? (T.service.serve * passMult) / serverSpeed[sv] : 99));
  const payTime = mk((sv) => (serverSpeed[sv] > 0 ? T.service.payBus / serverSpeed[sv] : 99));
  const serviceTime = mk((sv) => seatTime + orderTime[sv] + kitchen[sv].cookTime + serveTime[sv] + payTime[sv]);
  const serviceScore = clamp(
    T.satisfaction.serviceBase +
      T.satisfaction.servicePerSkill * avgServerSkill +
      (hasHost ? T.satisfaction.hostBonus : 0) +
      (servers.some((s) => hasTalent(s, 'charmer')) ? T.satisfaction.charmerBonus : 0),
    0,
    1,
  );
  // Only as many dishwashers as the wash stations have room for; the fastest take the places.
  const st = kitchen.dinner.stations;
  const dishwashers = crew.filter((s) => s.role === 'dishwasher')
    .sort((a, b) => personalSpeed(b, false, dinner) - personalSpeed(a, false, dinner)).slice(0, st.washSlots);
  // The fastest dish machine sets the pace.
  const machine = Math.max(1, ...state.equipment.filter((e) => EQUIPMENT[e.itemId]?.role === 'dishMachine').map((e) => EQUIPMENT[e.itemId]?.effectMult ?? 1));
  // Wash add-ons count on the best equipped wash station only (kitchen-upgrades.md 3).
  const washAddon = Math.max(1, ...state.equipment.filter((e) => ['sink', 'dishMachine'].includes(EQUIPMENT[e.itemId]?.role ?? '')).map((e) => addonProduct(e, 'washMult')));
  const platesPerHour =
    dishwashers.reduce((a, d) => a + T.kitchen.dishwasherRate * personalSpeed(d, false, dinner), 0) * machine * kitchen.dinner.flow.washMult * washAddon * st.crowdMult;
  return { servers: servers.length, hasHost, serverSpeed, serverGuests, loadMult, seatTime, orderTime, serveTime, payTime, serviceTime, serviceScore, platesPerHour };
}

export function weeklyRent(state: GameState): number {
  if (!PREMISES[state.premisesId] || !DISTRICTS[state.districtId]) return 0;
  return stateLocation(state).weeklyRent * economyOf(state).rent;
}

/** Everything that does not depend on today's guests. `pressure` is the load per area and service (staff-management.md 2.3). */
export function analyse(state: GameState, pressure: Record<Service, AreaLoad> = NO_PRESSURE, opts: { menuOnly?: boolean } = {}): Analysis {
  const kitchen = { lunch: kitchenStats(state, 'lunch', pressure.lunch), dinner: kitchenStats(state, 'dinner', pressure.dinner) };
  const room = roomStats(state);
  const service = serviceStats(state, kitchen, room.tables, pressure);
  const crew = onRota(state.staff, state.day);
  const frugal = crew.some((s) => s.role === 'chef' && hasTalent(s, 'frugal'));
  const dishes: Record<string, DishStats> = {};
  // The day model only reads dishes on the menu; the Menu tab wants the whole recipe book (menuOnly false).
  for (const r of state.recipes) {
    if (opts.menuOnly && !r.onMenu) continue;
    dishes[r.id] = dishStats(r, kitchen.dinner.kitchenSkillK, kitchen.dinner.equipmentE, frugal, economyOf(state).ingredients, repPriceMult(state.rep));
  }
  return {
    pressure,
    sommeliers: crew.filter((s) => s.role === 'server' && s.certs.includes('sommelier')).length,
    dishes,
    kitchen: kitchen.dinner,
    room,
    service,
    weeklySalaries: Math.max(0, state.staff.reduce((a, s) => a + s.salary, 0) - ownerShifts(state)) * economyOf(state).wages,
    weeklyRent: weeklyRent(state),
    frugal,
  };
}

