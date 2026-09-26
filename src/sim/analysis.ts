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

export interface KitchenStats {
  kitchenStaff: number;
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

export function salaryFor(role: Staff['role'], skill: number, fame: number, base: number): number {
  return Math.round(base * (1 + T.staff.salaryPerSkill * (skill - 5)) * (1 + T.staff.salaryPerFame * fame) * 100) / 100;
}

function nightOwlMult(s: Staff, service: Service): number {
  if (!s.traits.includes('nightOwl')) return 1;
  return service === 'dinner' ? 1 + T.service.nightOwl : 1 - T.service.nightOwl;
}

function personalSpeed(s: Staff, volumeGear: boolean): number {
  const base = volumeGear
    ? T.kitchen.volumeSpeedBase + T.kitchen.volumeSpeedPerSkill * s.skill
    : T.kitchen.speedBase + T.kitchen.speedPerSkill * s.skill;
  return base * moraleMult(s) * (s.traits.includes('speedy') ? 1 + T.kitchen.speedyBonus : 1);
}

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

function ovenSpeed(item: EquipmentItem, cooks: Staff[], avgSkill: number, service: Service): number {
  const volume = item.family === 'volume';
  let speed = cooks.length ? mean(cooks.map((c) => personalSpeed(c, volume) * nightOwlMult(c, service))) : 0;
  if (avgSkill < item.skillNeeded) speed *= T.kitchen.underSkillSpeed;
  return speed;
}

export function kitchenStats(state: GameState, service: Service = 'dinner'): KitchenStats {
  const cooks = state.staff.filter((s) => s.role === 'chef' || s.role === 'cook');
  const avgSkill = mean(cooks.map((c) => c.skill));
  const hasChef = cooks.some((c) => c.role === 'chef');
  const K = cooks.length
    ? mean(cooks.map((c) => T.quality.kitchenBase + T.quality.kitchenPerSkill * c.skill + (c.traits.includes('perfectionist') ? T.quality.perfectionistK : 0))) +
      (hasChef ? T.quality.chefSpecialty : 0)
    : T.quality.kitchenBase;
  const items = state.equipment.map((e) => EQUIPMENT[e.itemId]).filter((e): e is EquipmentItem => !!e);
  const owned = state.equipment.filter((e) => !!EQUIPMENT[e.itemId]);
  const ovens = owned.filter((e) => EQUIPMENT[e.itemId]?.role === 'oven');
  const counters = owned.filter((e) => EQUIPMENT[e.itemId]?.role === 'counter');
  const flow = kitchenFlow(state);
  const hasPass = items.some((i) => i.role === 'pass');
  const hasDishMachine = items.some((i) => i.role === 'dishMachine');
  const proving = items.find((i) => i.role === 'proving');

  const perfectionistShare = cooks.length ? cooks.filter((c) => c.traits.includes('perfectionist')).length / cooks.length : 0;
  const cookTimeMult = 1 + (T.kitchen.perfectionistCookTime - 1) * perfectionistShare;

  let ovenPerHour = 0;
  let cookTimeWeighted = 0;
  let qualityWeighted = 0;
  let walkWeighted = 0;
  const ovenOutput: Record<number, number> = {};
  let addonOvenQ = 0;
  for (const oe of ovens) {
    const o = EQUIPMENT[oe.itemId] as EquipmentItem;
    const speed = ovenSpeed(o, cooks, avgSkill, service);
    const slots = (o.slots ?? 0) + addonSum(oe, 'slotsAdd');
    const bake = (o.bakeMult ?? 1) * addonProduct(oe, 'bakeMult');
    const perHour = (slots * 60) / (T.kitchen.bakeMinutes * bake * cookTimeMult) * speed;
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
  const counterSpeed = cooks.length ? mean(cooks.map((c) => personalSpeed(c, false) * nightOwlMult(c, service))) : 0;
  const sheeterItem = EQUIPMENT.doughSheeter;
  const stationRate = (e: (typeof counters)[number]): number => {
    const it = EQUIPMENT[e.itemId] as EquipmentItem;
    const st = flow.stations[e.uid];
    const tool = Math.max(it.prepMult ?? 1, st?.sheeter ? (sheeterItem?.prepMult ?? 1.35) : 1);
    return T.kitchen.prepRate * counterSpeed * tool * addonProduct(e, 'prepMult') * (st?.coldMult ?? 1) * (st?.reachMult ?? 1) * menu.efficiency;
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
    counterQ += (EQUIPMENT[c.itemId]?.qualityMod ?? 0) + (withSheeter ? (sheeterItem?.qualityMod ?? 0) : 0);
    const sheeter = state.equipment.find((x) => x.uid === flow.stations[c.uid]?.sheeterUid);
    counterAddonQ += addonSum(c, 'qualityAdd') + (sheeter ? addonSum(sheeter, 'qualityAdd') : 0);
  });
  counterQ = staffedCounters ? counterQ / staffedCounters : 0;
  counterAddonQ = staffedCounters ? counterAddonQ / staffedCounters : 0;
  const passE = owned.find((e) => EQUIPMENT[e.itemId]?.role === 'pass');
  const provingE = owned.find((e) => EQUIPMENT[e.itemId]?.role === 'proving');
  // kitchen-upgrades.md 3: add-on quality is capped in total.
  const addonE = Math.min(
    T.addons.qualityCap,
    ovenAddonQ + counterAddonQ + (passE ? addonSum(passE, 'qualityAdd') : 0) + (provingE ? addonSum(provingE, 'qualityAdd') : 0),
  );
  const colds = owned.filter((e) => EQUIPMENT[e.itemId]?.cold);
  const wasteMult = Math.min(1, ...colds.map((e) => addonProduct(e, 'wasteMult')));

  const E = clamp(
    ovenQ + counterQ + (proving?.qualityMod ?? 0) + (hasPass ? (EQUIPMENT.heatLampPass?.qualityMod ?? 0) : 0) + addonE,
    T.quality.eMin,
    T.quality.eMax,
  );
  const premises = PREMISES[state.premisesId];
  return {
    kitchenStaff: cooks.length,
    avgSkill,
    kitchenSkillK: K,
    equipmentE: E,
    ovenPerHour,
    prepPerHour,
    cookTime,
    ovens: ovens.length,
    counters: counters.length,
    staffedCounters,
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

export function serviceStats(state: GameState, kitchen: Record<Service, KitchenStats>, tables: number): ServiceStats {
  const servers = state.staff.filter((s) => s.role === 'server');
  const hasHost = state.staff.some((s) => s.role === 'host');
  const avgServerSkill = mean(servers.map((s) => s.skill));
  const extra = servers.length ? Math.max(0, tables / servers.length - T.service.tablesPerServer) : 0;
  const loadMult = Math.max(T.service.loadFloor, 1 - T.service.loadPenalty * extra);
  const speedFor = (service: Service): number =>
    servers.length ? mean(servers.map((s) => personalSpeed(s, false) * nightOwlMult(s, service))) * loadMult : 0;
  const seatTime = hasHost ? T.service.seatWithHost : T.service.seatWithoutHost;
  const passE = state.equipment.find((e) => EQUIPMENT[e.itemId]?.role === 'pass');
  const passMult = passE ? (EQUIPMENT.heatLampPass?.effectMult ?? 1) * addonProduct(passE, 'serveMult') : 1;
  const mk = (f: (sv: Service) => number): Record<Service, number> => ({ lunch: f('lunch'), dinner: f('dinner') });
  const serverSpeed = mk(speedFor);
  const orderTime = mk((sv) => (serverSpeed[sv] > 0 ? T.service.order / serverSpeed[sv] : 99));
  const serveTime = mk((sv) => (serverSpeed[sv] > 0 ? (T.service.serve * passMult) / serverSpeed[sv] : 99));
  const payTime = mk((sv) => (serverSpeed[sv] > 0 ? T.service.payBus / serverSpeed[sv] : 99));
  const serviceTime = mk((sv) => seatTime + orderTime[sv] + kitchen[sv].cookTime + serveTime[sv] + payTime[sv]);
  const serviceScore = clamp(
    T.satisfaction.serviceBase +
      T.satisfaction.servicePerSkill * avgServerSkill +
      (hasHost ? T.satisfaction.hostBonus : 0) +
      (servers.some((s) => s.traits.includes('charmer')) ? T.satisfaction.charmerBonus : 0),
    0,
    1,
  );
  const dishwashers = state.staff.filter((s) => s.role === 'dishwasher');
  const machine = kitchen.dinner.hasDishMachine ? (EQUIPMENT.dishMachine?.effectMult ?? 1) : 1;
  // Wash add-ons count on the best equipped wash station only (kitchen-upgrades.md 3).
  const washAddon = Math.max(1, ...state.equipment.filter((e) => ['sink', 'dishMachine'].includes(EQUIPMENT[e.itemId]?.role ?? '')).map((e) => addonProduct(e, 'washMult')));
  const platesPerHour =
    dishwashers.reduce((a, d) => a + T.kitchen.dishwasherRate * personalSpeed(d, false), 0) * machine * kitchen.dinner.flow.washMult * washAddon;
  return { servers: servers.length, hasHost, serverSpeed, loadMult, seatTime, orderTime, serveTime, payTime, serviceTime, serviceScore, platesPerHour };
}

export function weeklyRent(state: GameState): number {
  if (!PREMISES[state.premisesId] || !DISTRICTS[state.districtId]) return 0;
  return stateLocation(state).weeklyRent * economyOf(state).rent;
}

export function analyse(state: GameState): Analysis {
  const kitchen = { lunch: kitchenStats(state, 'lunch'), dinner: kitchenStats(state, 'dinner') };
  const room = roomStats(state);
  const service = serviceStats(state, kitchen, room.tables);
  const frugal = state.staff.some((s) => s.role === 'chef' && s.traits.includes('frugal'));
  const dishes: Record<string, DishStats> = {};
  for (const r of state.recipes) {
    dishes[r.id] = dishStats(r, kitchen.dinner.kitchenSkillK, kitchen.dinner.equipmentE, frugal, economyOf(state).ingredients, repPriceMult(state.rep));
  }
  return {
    dishes,
    kitchen: kitchen.dinner,
    room,
    service,
    weeklySalaries: state.staff.reduce((a, s) => a + s.salary, 0) * economyOf(state).wages,
    weeklyRent: weeklyRent(state),
    frugal,
  };
}

