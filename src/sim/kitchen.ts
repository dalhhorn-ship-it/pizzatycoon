// Kitchen floor plan: geometry, placement rules, flow and auto layout (01-product/kitchen-builder.md 3, 4, 9).

import { PREMISES } from '../data/districts';
import { EQUIPMENT } from '../data/equipment';
import type { EquipmentItem } from '../data/types';
import { T } from '../data/tunables';
import type { GameState, OwnedEquipment } from './state';

export interface KitchenDims {
  W: number;
  H: number;
  /** The two pass tiles in row 0, next to the dining room. */
  pass: [number, number][];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function kitchenDims(premisesId: string): KitchenDims {
  const p = PREMISES[premisesId];
  const W = p?.kitchenWidth ?? 10;
  const H = p?.kitchenHeight ?? 3;
  const px = Math.floor((W - 2) / 2);
  return { W, H, pass: [[px, 0], [px + 1, 0]] };
}

export function rectOf(e: Pick<OwnedEquipment, 'itemId' | 'x' | 'y' | 'rot'>): Rect {
  const it = EQUIPMENT[e.itemId];
  const w = it?.w ?? 1;
  const h = it?.h ?? 1;
  return e.rot ? { x: e.x, y: e.y, w: h, h: w } : { x: e.x, y: e.y, w, h };
}

export function tilesOf(r: Rect): [number, number][] {
  const out: [number, number][] = [];
  for (let dx = 0; dx < r.w; dx++) for (let dy = 0; dy < r.h; dy++) out.push([r.x + dx, r.y + dy]);
  return out;
}

/** Smallest |dx| + |dy| between any tile of a and any tile of b (touching = 1). */
export function distance(a: Rect, b: Rect): number {
  const dx = Math.max(0, b.x - (a.x + a.w - 1), a.x - (b.x + b.w - 1));
  const dy = Math.max(0, b.y - (a.y + a.h - 1), a.y - (b.y + b.h - 1));
  return dx + dy;
}

export function passRect(d: KitchenDims): Rect {
  return { x: d.pass[0]?.[0] ?? 0, y: 0, w: 2, h: 1 };
}

const isPassTile = (d: KitchenDims, x: number, y: number): boolean => d.pass.some(([px, py]) => px === x && py === y);

/** Returns a player facing reason when the layout breaks a rule, or null when valid (kitchen-builder.md 3.3). */
export function layoutProblem(equipment: OwnedEquipment[], d: KitchenDims): string | null {
  const occ = new Map<string, number>();
  for (const e of equipment) {
    const it = EQUIPMENT[e.itemId];
    if (!it) return 'Unknown equipment.';
    const r = rectOf(e);
    if (r.x < 0 || r.y < 0 || r.x + r.w > d.W || r.y + r.h > d.H) return 'Off the kitchen.';
    if (it.role === 'pass' && e.rot) return 'The pass cannot be turned.';
    const tiles = tilesOf(r);
    const onPass = tiles.filter(([x, y]) => isPassTile(d, x, y)).length;
    if (it.role === 'pass') {
      if (onPass !== 2 || tiles.length !== 2) return 'The heat lamp pass goes on the hatch.';
    } else if (onPass) {
      return 'The pass stays clear.';
    }
    for (const [x, y] of tiles) {
      const k = `${x},${y}`;
      if (occ.has(k)) return 'Something is already there.';
      occ.set(k, e.uid);
    }
  }
  if (equipment.filter((e) => EQUIPMENT[e.itemId]?.role === 'pass').length > 1) return 'Only one heat lamp pass fits the hatch.';
  const free = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < d.W && y < d.H && !occ.has(`${x},${y}`) && !isPassTile(d, x, y);
  const touchesFree = (r: Rect): boolean =>
    tilesOf(r).some(([x, y]) => free(x + 1, y) || free(x - 1, y) || free(x, y + 1) || free(x, y - 1));
  for (const e of equipment) if (!touchesFree(rectOf(e))) return 'Needs a free tile to work from.';
  if (!touchesFree(passRect(d))) return 'Keep the space in front of the pass free.';
  return null;
}

// ---------- Flow ----------

export interface StationFlow {
  uid: number;
  dOven: number;
  reachMult: number;
  coldMult: number;
  sheeter: boolean;
}

export interface Flow {
  stations: Record<number, StationFlow>;
  /** Extra minutes per pizza carrying plates from the ovens to the pass. */
  walkMin: number;
  ovenDPass: Record<number, number>;
  washMult: number;
  dWash: number;
  /** Sheeters that touch no free prep station. */
  unattachedSheeters: number[];
}

const itemOf = (e: OwnedEquipment): EquipmentItem | undefined => EQUIPMENT[e.itemId];

export function kitchenFlow(state: GameState): Flow {
  const d = kitchenDims(state.premisesId);
  const f = T.kitchenFlow;
  const eq = state.equipment;
  const ovens = eq.filter((e) => itemOf(e)?.role === 'oven');
  const counters = eq.filter((e) => itemOf(e)?.role === 'counter');
  const colds = eq.filter((e) => itemOf(e)?.cold);
  const sheeters = eq.filter((e) => itemOf(e)?.role === 'sheeter');
  const pass = passRect(d);

  const stations: Record<number, StationFlow> = {};
  const taken = new Set<number>();
  const unattached: number[] = [];
  for (const s of sheeters) {
    const target = counters.find((c) => !taken.has(c.uid) && distance(rectOf(s), rectOf(c)) === 1);
    if (target) taken.add(target.uid);
    else unattached.push(s.uid);
  }
  for (const c of counters) {
    const r = rectOf(c);
    const dOven = ovens.length ? Math.min(...ovens.map((o) => distance(r, rectOf(o)))) : 99;
    const reachMult = 1 - Math.min(f.prepPenaltyCap, f.prepPenaltyPerTile * Math.max(0, dOven - f.prepFreeTiles));
    const selfCold = !!itemOf(c)?.cold;
    const coldMult = !selfCold && colds.some((k) => k.uid !== c.uid && distance(r, rectOf(k)) === 1) ? 1 + f.coldAtHandBonus : 1;
    stations[c.uid] = { uid: c.uid, dOven, reachMult, coldMult, sheeter: taken.has(c.uid) };
  }
  const ovenDPass: Record<number, number> = {};
  for (const o of ovens) ovenDPass[o.uid] = distance(rectOf(o), pass);
  const wash = eq.filter((e) => itemOf(e)?.role === 'sink' || itemOf(e)?.role === 'dishMachine');
  const dWash = wash.length ? Math.min(...wash.map((w) => distance(rectOf(w), pass))) : 99;
  const washMult = 1 - Math.min(f.washPenaltyCap, f.washPenaltyPerTile * Math.max(0, dWash - f.washFreeTiles));
  return { stations, walkMin: 0, ovenDPass, washMult, dWash, unattachedSheeters: unattached };
}

export function plateWalk(dPass: number): number {
  const f = T.kitchenFlow;
  return Math.min(f.plateWalkCap, f.plateWalkPerTile * Math.max(0, dPass - f.passFreeTiles));
}

// ---------- Auto layout (kitchen-builder.md 9) ----------

type Placed = OwnedEquipment;

function candidates(itemId: string, d: KitchenDims): { x: number; y: number; rot: 0 | 1 }[] {
  const out: { x: number; y: number; rot: 0 | 1 }[] = [];
  const it = EQUIPMENT[itemId];
  if (!it) return out;
  const rots: (0 | 1)[] = it.role === 'pass' || it.w === it.h ? [0] : [0, 1];
  for (let y = 0; y < d.H; y++) for (let x = 0; x < d.W; x++) for (const rot of rots) out.push({ x, y, rot });
  return out;
}

/** Best valid spot for one more item, scoring by the item's role (closest to what it serves). */
export function bestSpot(placed: Placed[], uid: number, itemId: string, d: KitchenDims): Placed | null {
  const it = EQUIPMENT[itemId];
  if (!it) return null;
  const pass = passRect(d);
  const ovens = placed.filter((e) => itemOf(e)?.role === 'oven');
  const counters = placed.filter((e) => itemOf(e)?.role === 'counter');
  let best: Placed | null = null;
  let bestScore = Infinity;
  for (const c of candidates(itemId, d)) {
    const cand: Placed = { uid, itemId, x: c.x, y: c.y, rot: c.rot };
    if (layoutProblem([...placed, cand], d)) continue;
    const r = rectOf(cand);
    let score: number;
    switch (it.role) {
      case 'oven':
        score = distance(r, pass);
        break;
      case 'counter':
        score = ovens.length ? Math.min(...ovens.map((o) => distance(r, rectOf(o)))) : distance(r, pass);
        break;
      case 'sheeter': {
        // Each prep station takes one sheeter: aim for a station no other sheeter touches yet.
        const others = placed.filter((e) => itemOf(e)?.role === 'sheeter');
        const freeStations = counters.filter((k) => !others.some((o) => distance(rectOf(o), rectOf(k)) === 1));
        const dc = freeStations.length ? Math.min(...freeStations.map((k) => distance(r, rectOf(k)))) : 9;
        score = dc === 1 ? 0 : 10 + dc;
        break;
      }
      case 'cold': {
        const plain = counters.filter((k) => !itemOf(k)?.cold);
        const dc = plain.length ? Math.min(...plain.map((k) => distance(r, rectOf(k)))) : 9;
        score = dc === 1 ? 0 : 10 + dc;
        break;
      }
      case 'sink':
      case 'dishMachine':
        score = distance(r, pass);
        break;
      default:
        score = 0;
    }
    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

const ORDER: Record<string, number> = { pass: 0, oven: 1, counter: 2, sheeter: 3, cold: 4, sink: 5, dishMachine: 6, proving: 7 };

/** Deterministic greedy layout; returns the placed items and the ones that did not fit. */
export function autoLayout(items: { uid: number; itemId: string }[], premisesId: string): { placed: Placed[]; unplaced: { uid: number; itemId: string }[] } {
  const d = kitchenDims(premisesId);
  const sorted = [...items].sort((a, b) => {
    const ia = EQUIPMENT[a.itemId];
    const ib = EQUIPMENT[b.itemId];
    const ra = ORDER[ia?.role ?? ''] ?? 9;
    const rb = ORDER[ib?.role ?? ''] ?? 9;
    if (ra !== rb) return ra - rb;
    const outA = (ia?.slots ?? 0) / (ia?.bakeMult ?? 1) + (ia?.qualityMod ?? 0) / 100;
    const outB = (ib?.slots ?? 0) / (ib?.bakeMult ?? 1) + (ib?.qualityMod ?? 0) / 100;
    return outB - outA || a.uid - b.uid;
  });
  const placed: Placed[] = [];
  const unplaced: { uid: number; itemId: string }[] = [];
  for (const item of sorted) {
    const spot = bestSpot(placed, item.uid, item.itemId, d);
    if (spot) placed.push(spot);
    else unplaced.push(item);
  }
  return { placed, unplaced };
}
