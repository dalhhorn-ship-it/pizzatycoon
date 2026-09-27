// Reference builds from 01-product/balance.md section 3, assembled through the real game state.

import { FURNITURE } from '../../src/data/furniture';
import { INGREDIENTS, SUPPLIERS } from '../../src/data/ingredients';
import type { Category, Role, TierId } from '../../src/data/types';
import { analyse, occupiedTiles, roomStats } from '../../src/sim/analysis';
import { staffFromSkill } from '../../src/sim/staff';
import { simulateDay } from '../../src/sim/day';
import { newGame, tiersFor } from '../../src/sim/game';
import { autoLayout } from '../../src/sim/kitchen';
import type { DayReport, GameState, PlacedFurniture } from '../../src/sim/state';
import { PREMISES } from '../../src/data/districts';

export type BuildId = 'luxury' | 'volume' | 'middle';

export interface BuildSpec {
  premises: string;
  tables: Record<string, number>;
  ambience: number;
  tierFor: Partial<Record<Category, TierId>>;
  menu: string[];
  mainPrice: number;
  sides: { drink: number; starter: number; dessert: number };
  equipment: string[];
  staff: [Role, number, number][]; // role, skill, fame
}

export const BUILDS: Record<BuildId, BuildSpec> = {
  luxury: {
    premises: 'medium',
    tables: { booth4: 4, table4: 4, table2: 4 },
    ambience: 85,
    tierFor: { dry: 'premium', dairy: 'artisan', produce: 'artisan', meat: 'premium', drinks: 'premium' },
    menu: ['margherita', 'prosciuttoRucola', 'burrata', 'tartufo', 'funghi'],
    mainPrice: 38,
    sides: { drink: 7, starter: 9, dessert: 8 },
    equipment: ['woodFiredOven', 'woodFiredOven', 'prepCounter', 'prepCounter', 'provingCabinet'],
    staff: [['chef', 8, 1], ['cook', 7, 0], ['server', 6, 0], ['server', 6, 0], ['server', 6, 0], ['host', 5, 0], ['dishwasher', 5, 0], ['dishwasher', 5, 0]],
  },
  volume: {
    premises: 'large',
    tables: { table4: 26, table2: 8 },
    ambience: 45,
    tierFor: { dry: 'basic', dairy: 'standard', produce: 'basic', meat: 'basic', drinks: 'basic' },
    menu: ['pepperoni', 'diavola', 'salsiccia', 'quattroFormaggi', 'margherita'],
    mainPrice: 8.5,
    sides: { drink: 3, starter: 4.5, dessert: 4 },
    equipment: [
      'conveyorOven', 'conveyorOven', 'conveyorOven', 'prepCounter', 'prepCounter', 'prepCounter', 'prepCounter',
      'doughSheeter', 'doughSheeter', 'doughSheeter', 'doughSheeter', 'heatLampPass', 'dishMachine', 'walkInCooler',
    ],
    staff: [
      ['cook', 4, 0], ['cook', 4, 0], ['cook', 4, 0], ['cook', 4, 0],
      ['server', 4, 0], ['server', 4, 0], ['server', 4, 0], ['server', 4, 0], ['server', 4, 0], ['server', 4, 0], ['server', 4, 0],
      ['host', 5, 0], ['dishwasher', 4, 0], ['dishwasher', 4, 0],
    ],
  },
  middle: {
    premises: 'medium',
    tables: { table4: 10, table2: 8 },
    ambience: 65,
    tierFor: { dry: 'standard', dairy: 'premium', produce: 'premium', meat: 'standard', drinks: 'standard' },
    menu: ['margherita', 'pepperoni', 'funghi', 'quattroFormaggi', 'prosciuttoFunghi'],
    mainPrice: 13,
    sides: { drink: 4.5, starter: 7, dessert: 6.5 },
    equipment: ['stoneHearthOven', 'stoneHearthOven', 'prepCounter', 'prepCounter'],
    staff: [['cook', 6, 0], ['cook', 6, 0], ['server', 5, 0], ['server', 5, 0], ['server', 5, 0], ['server', 5, 0], ['host', 5, 0], ['dishwasher', 5, 0], ['dishwasher', 5, 0]],
  },
};

function bestSupplier(ingredientId: string, tier: TierId): string {
  const ing = INGREDIENTS[ingredientId];
  const options = Object.values(SUPPLIERS).filter((s) => ing && s.carries[ing.category]?.includes(tier));
  // Premium strategies buy from the best quality supplier; cheap ones from the cheapest.
  options.sort((a, b) => (tier === 'basic' || tier === 'standard' ? a.priceIndex - b.priceIndex : b.qualityOffset - a.qualityOffset));
  return options[0]?.id ?? 'fratelli';
}

function layout(state: GameState, spec: BuildSpec): PlacedFurniture[] {
  const p = PREMISES[spec.premises];
  if (!p) throw new Error('premises');
  const out: PlacedFurniture[] = [];
  let uid = 1000;
  const queue: string[] = [];
  for (const [id, n] of Object.entries(spec.tables)) for (let i = 0; i < n; i++) queue.push(id);
  // Shelf packing with a one tile aisle after each item and each row.
  let y = 0;
  while (queue.length && y < p.diningHeight) {
    let x = 0;
    let rowH = 1;
    for (let i = 0; i < queue.length; ) {
      const item = FURNITURE[queue[i] as string];
      if (!item) throw new Error('item');
      if (x + item.w <= p.diningWidth && y + item.h <= p.diningHeight) {
        out.push({ uid: uid++, itemId: item.id, x, y });
        x += item.w + 1;
        rowH = Math.max(rowH, item.h);
        queue.splice(i, 1);
      } else i++;
    }
    y += rowH + 1;
  }
  if (queue.length) throw new Error(`could not fit ${queue.length} tables`);
  // Decor until the target ambience, never squeezing a table.
  const decor = ['lanterns', 'lamp', 'lanterns', 'lamp', 'fountain', 'shelf', 'painting', 'plant'];
  let guard = 0;
  while (guard++ < 400) {
    const trial = { ...state, furniture: out };
    const room = roomStats(trial);
    if (room.ambience >= spec.ambience) break;
    let placed = false;
    const occ = occupiedTiles(out);
    for (const id of decor) {
      const item = FURNITURE[id];
      if (!item) continue;
      for (let yy = 0; yy + item.h <= p.diningHeight && !placed; yy++) {
        for (let xx = 0; xx + item.w <= p.diningWidth && !placed; xx++) {
          let free = true;
          for (let dx = 0; dx < item.w; dx++) for (let dy = 0; dy < item.h; dy++) if (occ.has(`${xx + dx},${yy + dy}`)) free = false;
          if (!free) continue;
          const cand = [...out, { uid: uid, itemId: id, x: xx, y: yy }];
          if (roomStats({ ...state, furniture: cand }).crowdedTables > room.crowdedTables) continue;
          out.push({ uid: uid++, itemId: id, x: xx, y: yy });
          placed = true;
        }
      }
      if (placed) break;
    }
    if (!placed) break;
  }
  return out;
}

export function buildState(build: BuildId, districtId: string, mainPrice?: number): GameState {
  return buildFromSpec(BUILDS[build], districtId, mainPrice, build);
}

/** A restaurant from any spec, for tests that need a build of their own (never add to BUILDS). */
export function buildFromSpec(spec: BuildSpec, districtId: string, mainPrice?: number, build = 'custom'): GameState {
  const s = newGame(7, districtId, spec.premises);
  s.day = 4; // Thursday
  s.cash = 0;
  s.furniture = layout(s, spec);
  const { placed, unplaced } = autoLayout([...spec.equipment, 'doughFridge', 'sink'].map((itemId, i) => ({ uid: 5000 + i, itemId })), s.premisesId);
  if (unplaced.length) throw new Error(`${build}: kitchen auto layout could not place ${unplaced.map((u) => u.itemId).join(', ')}`);
  s.equipment = placed;
  s.staff = spec.staff.map(([role, skill, fame], i) => staffFromSkill(6000 + i, `${role} ${i}`, role, skill, { fame, morale: 50 }));
  for (const r of s.recipes) {
    r.onMenu = r.kind === 'pizza' ? spec.menu.includes(r.id) : ['softDrink', 'houseWine', 'garlicBread', 'tiramisu'].includes(r.id);
    if (r.kind === 'pizza') r.price = mainPrice ?? spec.mainPrice;
    if (r.kind === 'drink') r.price = spec.sides.drink;
    if (r.kind === 'starter') r.price = spec.sides.starter;
    if (r.kind === 'dessert') r.price = spec.sides.dessert;
    for (const line of r.lines) {
      const cat = INGREDIENTS[line.ingredientId]?.category;
      const want = (cat && spec.tierFor[cat]) ?? 'standard';
      const tiers = tiersFor(line.ingredientId);
      const order: TierId[] = ['artisan', 'premium', 'standard', 'basic'];
      const tier = tiers.includes(want) ? want : (order.slice(order.indexOf(want)).find((t) => tiers.includes(t)) ?? tiers[0] ?? 'standard');
      line.tier = tier;
      line.supplierId = bestSupplier(line.ingredientId, tier);
    }
  }
  return s;
}

/**
 * Run Thursdays until reputation and the local following settle (balance.md 3.1, 4.3): an established restaurant,
 * where the daily review score equals Rep and word of mouth has done its work.
 */
export function steadyState(state: GameState): { state: GameState; report: DayReport } {
  const s = structuredClone(state);
  const a = analyse(s);
  let report = simulateDay(s, a, { noise: false });
  for (let i = 0; i < 2000; i++) {
    s.rep = report.repAfter;
    s.following = report.followingAfter;
    report = simulateDay(s, a, { noise: false });
    if (Math.abs(report.repAfter - s.rep) < 1e-4 && Math.abs(report.followingAfter - s.following) < 1e-5) break;
  }
  return { state: s, report };
}
